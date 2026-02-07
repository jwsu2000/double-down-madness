// ─── Table Controller ─────────────────────────────────────────────────────────
// Server-side game logic for one table. Uses engine functions for core rules.

import {
  type Card,
  evaluateHand,
  SUITS,
  RANKS,
  CUT_CARD_POSITION,
} from '../src/engine/deck';
import {
  type GamePhase,
  type HandResult,
  shouldOfferInsurance,
  shouldPeek,
  dealerHasBlackjack,
  dealerMustHit,
  nextDoubleWager,
  totalWager,
  getAvailableActions,
  settleHand,
  STARTING_BALANCE,
  MAX_BUY_IN,
  SIDE_BET_PAYOUT,
  DEFAULT_CHIP_DENOMINATIONS,
} from '../src/engine/rules';
import {
  type ProvablyFairState,
  initProvablyFair,
  rotateServerSeed,
  deriveShoeOrder,
} from '../src/engine/provablyFair';
import type {
  BuyInRequest,
  ClientTableState,
  TablePlayer,
  TableHand,
  PlayerSettlement,
  HandSettlement,
  TablePhase,
  ProvablyFairInfo,
  DiceRollResult,
} from '../src/shared/protocol';

// ─── Server-side Hand ─────────────────────────────────────────────────────────

export interface ServerHand {
  cards: Card[];
  originalBet: number;
  doubleCount: number;
  justDoubledOnLoneAce: boolean;
  result: HandResult | null;
  message: string;
  /** Action log: one entry per card after the initial deal. 'H' = Hit, 'D' = Double */
  actions: ('H' | 'D')[];
}

// ─── Server-side Player ───────────────────────────────────────────────────────

export interface ServerPlayer {
  id: string;
  name: string;
  socketId: string;
  balance: number;
  buyIn: number;
  hands: ServerHand[];
  currentBet: number;       // per-hand bet amount
  sideBet: number;
  insuranceBet: number;
  insuranceTaken: boolean;
  hasBet: boolean;
  insuranceDecided: boolean;
  isReady: boolean;
  connected: boolean;
  isAway: boolean;
}

// ─── Table Controller Class ───────────────────────────────────────────────────

export class TableController {
  roomCode: string;
  phase: TablePhase = 'LOBBY';
  players = new Map<string, ServerPlayer>();
  playerOrder: string[] = [];
  hostId = '';

  /** The player currently holding the "dealer button" (selected by dice roll) */
  buttonPlayerId: string | null = null;

  // Shoe
  private shoe: Card[] = [];
  private shoeOrder: number[] = [];
  private shoePosition = 0;
  private needsReshuffle = false;

  // Dealer
  dealerCards: Card[] = [];

  // Turn tracking
  activePlayerIndex = 0;
  activeHandIndex = 0;

  // Provably fair
  private provablyFair!: ProvablyFairState;
  private roundNumber = 0;
  private cardsDealtThisRound: number[] = [];

  // Previous round provably fair data (for client-side verification)
  private previousCardsDealt: number[] = [];
  private previousClientSeed?: string;
  private previousNonce?: number;

  // Settlement
  settlements: PlayerSettlement[] = [];

  // Ready tracking
  private readyPlayers = new Set<string>();

  // Chip denominations (configurable by host)
  chipDenominations: number[] = [...DEFAULT_CHIP_DENOMINATIONS];
  private buyInRequests = new Map<string, BuyInRequest>();

  private initialized = false;

  constructor(roomCode: string) {
    this.roomCode = roomCode;
  }

  // ─── Chip Denomination Setting (host only) ──────────────────────────

  setChipDenominations(playerId: string, denominations: number[]): boolean {
    if (playerId !== this.hostId) return false;
    if (this.phase !== 'LOBBY' && this.phase !== 'BETTING') return false;
    // Validate: at least 1, at most 8, all positive integers, sorted ascending
    const filtered = denominations
      .filter((d) => Number.isInteger(d) && d > 0)
      .sort((a, b) => a - b);
    if (filtered.length < 1 || filtered.length > 8) return false;
    // Remove duplicates
    const unique = [...new Set(filtered)];
    if (unique.length < 1) return false;
    this.chipDenominations = unique;
    return true;
  }

  addStack(hostPlayerId: string, targetPlayerId: string, amount: number): boolean {
    if (hostPlayerId !== this.hostId) return false;
    if (this.phase === 'LOBBY') return false;
    if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_BUY_IN) return false;

    const target = this.players.get(targetPlayerId);
    if (!target || !target.connected) return false;
    if (this.isHouseDealer(targetPlayerId)) return false;

    // Treat top-ups as additional buy-in so ledger P/L remains meaningful.
    target.balance += amount;
    target.buyIn += amount;
    this.buyInRequests.delete(targetPlayerId);
    return true;
  }

  requestBuyIn(playerId: string, amount: number): boolean {
    if (this.phase === 'LOBBY') return false;
    if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_BUY_IN) return false;
    if (playerId === this.hostId) return false;

    const player = this.players.get(playerId);
    if (!player || !player.connected) return false;
    if (this.isHouseDealer(playerId)) return false;
    if (player.balance > 0) return false;

    this.buyInRequests.set(playerId, {
      playerId,
      playerName: player.name,
      amount,
      requestedAt: Date.now(),
    });
    return true;
  }

  respondBuyInRequest(hostPlayerId: string, playerId: string, approve: boolean): boolean {
    if (hostPlayerId !== this.hostId) return false;

    const request = this.buyInRequests.get(playerId);
    if (!request) return false;

    this.buyInRequests.delete(playerId);

    if (!approve) return true;

    const player = this.players.get(playerId);
    if (!player || !player.connected) return false;
    if (this.isHouseDealer(playerId)) return false;

    player.balance += request.amount;
    player.buyIn += request.amount;
    return true;
  }

  transferHost(currentHostPlayerId: string, nextHostPlayerId: string): boolean {
    if (currentHostPlayerId !== this.hostId) return false;
    if (nextHostPlayerId === this.hostId) return false;

    const nextHost = this.players.get(nextHostPlayerId);
    if (!nextHost || !nextHost.connected) return false;

    this.hostId = nextHostPlayerId;
    return true;
  }

  setLobbyDealer(hostPlayerId: string, dealerPlayerId: string): boolean {
    if (hostPlayerId !== this.hostId) return false;
    if (this.phase !== 'LOBBY') return false;

    const dealer = this.players.get(dealerPlayerId);
    if (!dealer || !dealer.connected) return false;

    this.buttonPlayerId = dealerPlayerId;
    return true;
  }

  // ─── Initialization ──────────────────────────────────────────────────

  private async init() {
    this.provablyFair = await initProvablyFair();
    this.shoeOrder = await deriveShoeOrder(
      this.provablyFair.serverSeed,
      this.provablyFair.clientSeed,
      this.provablyFair.nonce,
    );
    this.shoe = this.shoeOrder.map((i) => this.indexToCard(i));
    this.initialized = true;
  }

  private indexToCard(index: number): Card {
    const deckIndex = index % 52;
    const suitIndex = Math.floor(deckIndex / 13);
    const rankIndex = deckIndex % 13;
    return { suit: SUITS[suitIndex], rank: RANKS[rankIndex], faceUp: true };
  }

  private drawCard(faceUp = true): Card {
    const card = { ...this.shoe[this.shoePosition], faceUp };
    this.cardsDealtThisRound.push(this.shoeOrder[this.shoePosition]);
    this.shoePosition++;
    this.needsReshuffle = this.shoePosition >= CUT_CARD_POSITION;
    return card;
  }

  // ─── Player Management ───────────────────────────────────────────────

  addPlayer(id: string, name: string, socketId: string, buyIn?: number) {
    const requested = typeof buyIn === 'number' && Number.isInteger(buyIn) ? buyIn : STARTING_BALANCE;
    const amount = requested > 0 ? Math.min(requested, MAX_BUY_IN) : STARTING_BALANCE;
    const player: ServerPlayer = {
      id,
      name,
      socketId,
      balance: amount,
      buyIn: amount,
      hands: [],
      currentBet: 0,
      sideBet: 0,
      insuranceBet: 0,
      insuranceTaken: false,
      hasBet: false,
      insuranceDecided: false,
      isReady: false,
      connected: true,
      isAway: false,
    };
    this.players.set(id, player);
    this.playerOrder.push(id);

    if (this.playerOrder.length === 1) {
      this.hostId = id;
    }
  }

  removePlayer(id: string) {
    this.players.delete(id);
    this.playerOrder = this.playerOrder.filter((pid) => pid !== id);
    this.readyPlayers.delete(id);
    this.buyInRequests.delete(id);

    // Transfer host
    if (this.hostId === id && this.playerOrder.length > 0) {
      this.hostId = this.playerOrder[0];
    }

    // If the designated dealer left mid-round, delay reassignment until round reset.
    // During LOBBY/BETTING we can safely reassign immediately.
    if (this.buttonPlayerId === id) {
      if (this.phase === 'LOBBY' || this.phase === 'BETTING') {
        const nextDealer = this.playerOrder
          .map((pid) => this.players.get(pid))
          .find((p): p is ServerPlayer => !!p && p.connected);
        this.buttonPlayerId = nextDealer?.id ?? null;
      } else {
        this.buttonPlayerId = null;
      }
    }

    // If no players left, reset
    if (this.playerOrder.length === 0) {
      this.phase = 'LOBBY';
    }
  }

  setPlayerConnected(id: string, connected: boolean) {
    const player = this.players.get(id);
    if (player) {
      player.connected = connected;
      if (!connected) player.socketId = '';
      if (!connected) this.buyInRequests.delete(id);

      // Auto-stand for disconnected players during their turn
      if (!connected && this.phase === 'PLAYER_TURN') {
        const activeId = this.playerOrder[this.activePlayerIndex];
        if (activeId === id) {
          this.advanceToNextHand();
        }
      }

      // Auto-decide insurance for disconnected
      if (!connected && this.phase === 'INSURANCE_OFFERED' && !player.insuranceDecided) {
        player.insuranceDecided = true;
      }

      // Clear away when reconnecting
      if (connected) {
        player.isAway = false;
      }
    }
  }

  // ─── Away Toggle ─────────────────────────────────────────────────────

  toggleAway(playerId: string): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;

    player.isAway = !player.isAway;

    if (player.isAway) {
      // During PLAYER_TURN: if it's their turn, auto-stand all remaining hands
      if (this.phase === 'PLAYER_TURN') {
        const activeId = this.playerOrder[this.activePlayerIndex];
        if (activeId === playerId && player.hands.length > 0) {
          this.advanceToNextHand();
        }
      }

      // During INSURANCE: auto-decline
      if (this.phase === 'INSURANCE_OFFERED' && !player.insuranceDecided) {
        player.insuranceDecided = true;
      }
    }

    return true;
  }

  // ─── Dealer Button Selection (Dice Roll) ────────────────────────────

  rollForDealer(): DiceRollResult | null {
    const connected = this.getConnectedPlayers();
    if (connected.length === 0) return null;

    // Map equally likely 2d6 outcomes to players with rejection sampling so
    // dealer selection is unbiased across different lobby sizes.
    const usableOutcomes = Math.floor(36 / connected.length) * connected.length;
    let outcomeIndex = 0;
    do {
      outcomeIndex = Math.floor(Math.random() * 36);
    } while (outcomeIndex >= usableOutcomes);

    const die1 = Math.floor(outcomeIndex / 6) + 1;
    const die2 = (outcomeIndex % 6) + 1;
    const total = die1 + die2;

    const playerIds = connected.map((p) => p.id);
    const playerNames = connected.map((p) => p.name);
    const selectedIndex = outcomeIndex % connected.length;
    const selectedId = playerIds[selectedIndex];
    const selectedName = playerNames[selectedIndex];

    this.buttonPlayerId = selectedId;

    return {
      dice: [die1, die2],
      total,
      playerIds,
      playerNames,
      selectedPlayerId: selectedId,
      selectedPlayerName: selectedName,
    };
  }

  // ─── Game Flow ───────────────────────────────────────────────────────

  async startRound(): Promise<boolean> {
    if (this.phase !== 'LOBBY' && this.phase !== 'BETTING') return false;

    if (!this.initialized) {
      await this.init();
    }

    if (!this.buttonPlayerId || !this.players.has(this.buttonPlayerId)) {
      const nextDealer = this.getConnectedPlayers()[0];
      this.buttonPlayerId = nextDealer?.id ?? null;
    }

    // Reset player round state
    for (const player of this.players.values()) {
      player.hands = [];
      player.currentBet = 0;
      player.sideBet = 0;
      player.insuranceBet = 0;
      player.insuranceTaken = false;
      player.hasBet = false;
      player.insuranceDecided = false;
      player.isReady = false;
    }

    this.dealerCards = [];
    this.settlements = [];
    this.readyPlayers.clear();
    this.cardsDealtThisRound = [];

    this.phase = 'BETTING';
    return true;
  }

  // ─── Betting ─────────────────────────────────────────────────────────

  placeBet(playerId: string, amount: number, sideBet = 0, numHands = 1): boolean {
    if (this.phase !== 'BETTING') return false;
    const player = this.players.get(playerId);
    if (!player || player.hasBet) return false;
    if (this.isHouseDealer(playerId)) return false;
    if (!Number.isInteger(amount) || amount <= 0) return false;
    if (!Number.isInteger(sideBet) || sideBet < 0) return false;
    if (!Number.isInteger(numHands) || numHands < 1 || numHands > 5) return false;
    const totalCost = amount * numHands + sideBet;
    if (!Number.isSafeInteger(totalCost) || totalCost > player.balance) return false;

    player.currentBet = amount;
    player.sideBet = sideBet;
    player.balance -= totalCost;
    player.hasBet = true;

    // Create empty hands (cards dealt later)
    player.hands = [];
    for (let i = 0; i < numHands; i++) {
      player.hands.push({
        cards: [],
        originalBet: amount,
        doubleCount: 0,
        justDoubledOnLoneAce: false,
        result: null,
        message: '',
        actions: [],
      });
    }

    return true;
  }

  allBetsPlaced(): boolean {
    const eligible = this.getConnectedPlayers().filter(
      (p) => !p.isAway && !this.isHouseDealer(p.id),
    );
    return eligible.length > 0 && eligible.every((p) => p.hasBet);
  }

  // ─── Dealing ─────────────────────────────────────────────────────────

  dealCards(): GamePhase {
    this.phase = 'DEALING';

    // Deal 1 card face-up to each hand of each player
    for (const pid of this.playerOrder) {
      const player = this.players.get(pid);
      if (!player || !player.hasBet) continue;

      for (const hand of player.hands) {
        const card = this.drawCard(true);
        hand.cards = [card];
      }
    }

    // Dealer gets 2 cards (face-up + face-down)
    const dealerCard1 = this.drawCard(true);
    const dealerCard2 = this.drawCard(false);
    this.dealerCards = [dealerCard1, dealerCard2];

    // Check for insurance / peek
    if (shouldOfferInsurance(dealerCard1)) {
      this.phase = 'INSURANCE_OFFERED';
      return this.phase;
    }
    if (shouldPeek(dealerCard1)) {
      return this.resolvePeek();
    }

    this.phase = 'PLAYER_TURN';
    this.activePlayerIndex = this.findFirstActivePlayer();
    this.activeHandIndex = 0;
    return this.phase;
  }

  // ─── Insurance ───────────────────────────────────────────────────────

  playerInsurance(playerId: string, take: boolean): boolean {
    if (this.phase !== 'INSURANCE_OFFERED') return false;
    const player = this.players.get(playerId);
    if (!player || player.hands.length === 0 || player.insuranceDecided) return false;

    if (take) {
      // Insurance cost = half the per-hand bet × number of hands
      const cost = player.hands.reduce(
        (sum, h) => sum + Math.floor(h.originalBet / 2),
        0,
      );
      if (cost <= player.balance) {
        player.insuranceTaken = true;
        player.insuranceBet = cost;
        player.balance -= cost;
      }
    }
    player.insuranceDecided = true;
    return true;
  }

  allInsuranceDecided(): boolean {
    return this.getActivePlayers().every((p) => !p.connected || p.insuranceDecided || p.isAway);
  }

  resolvePeek(): GamePhase {
    this.phase = 'PEEK_CHECK';

    const fullDealerCards = this.dealerCards.map((c) => ({ ...c, faceUp: true }));
    if (dealerHasBlackjack(fullDealerCards)) {
      this.dealerCards = fullDealerCards;
      this.settle(true);
      return this.phase; // SETTLEMENT
    }

    this.phase = 'PLAYER_TURN';
    this.activePlayerIndex = this.findFirstActivePlayer();
    this.activeHandIndex = 0;
    return this.phase;
  }

  // ─── Player Actions ──────────────────────────────────────────────────

  playerAction(playerId: string, action: 'hit' | 'stand' | 'double'): boolean {
    if (this.phase !== 'PLAYER_TURN') return false;

    const activePlayerId = this.playerOrder[this.activePlayerIndex];
    if (playerId !== activePlayerId) return false;

    const player = this.players.get(playerId);
    if (!player || player.hands.length === 0) return false;

    const hand = player.hands[this.activeHandIndex];
    if (!hand) return false;

    const actions = getAvailableActions(
      hand.cards,
      hand.doubleCount,
      hand.originalBet,
      player.balance,
      hand.justDoubledOnLoneAce,
    );

    switch (action) {
      case 'hit': {
        if (!actions.hit) return false;
        const card = this.drawCard(true);
        hand.cards.push(card);
        hand.actions.push('H');
        const handEval = evaluateHand(hand.cards);
        if (handEval.isBust || handEval.best === 21) {
          this.advanceToNextHand();
        }
        return true;
      }

      case 'stand': {
        if (!actions.stand) return false;
        this.advanceToNextHand();
        return true;
      }

      case 'double': {
        if (!actions.double) return false;
        const wager = nextDoubleWager(hand.originalBet, hand.doubleCount);
        player.balance -= wager;
        const card = this.drawCard(true);
        hand.cards.push(card);
        hand.actions.push('D');
        hand.doubleCount++;

        const wasLoneAce = hand.cards.length === 2 && hand.cards[0].rank === 'A';
        hand.justDoubledOnLoneAce = wasLoneAce;

        if (wasLoneAce) {
          this.advanceToNextHand();
        } else {
          const handEval = evaluateHand(hand.cards);
          if (handEval.isBust || handEval.best === 21) {
            this.advanceToNextHand();
          }
        }
        return true;
      }
    }

    return false;
  }

  // ─── Hand / Player Advancement ──────────────────────────────────────

  private advanceToNextHand() {
    const currentPlayerId = this.playerOrder[this.activePlayerIndex];
    const currentPlayer = this.players.get(currentPlayerId);

    // Try advancing to the next hand of the same player
    if (currentPlayer && this.activeHandIndex + 1 < currentPlayer.hands.length) {
      this.activeHandIndex++;
      return;
    }

    // No more hands for current player — find next player
    let nextPlayerIndex = this.activePlayerIndex + 1;
    while (nextPlayerIndex < this.playerOrder.length) {
      const player = this.players.get(this.playerOrder[nextPlayerIndex]);
      if (player?.hasBet && player.hands.length > 0 && player.connected && !player.isAway) {
        break;
      }
      // Skip disconnected or away players
      if (player?.hasBet && player.hands.length > 0 && (!player.connected || player.isAway)) {
        nextPlayerIndex++;
        continue;
      }
      nextPlayerIndex++;
    }

    if (nextPlayerIndex >= this.playerOrder.length) {
      // All players done — check if dealer needs to play
      const anyNonBust = this.getActivePlayers().some((p) =>
        p.hands.some((h) => !evaluateHand(h.cards).isBust),
      );
      const anySideBet = this.getActivePlayers().some((p) => p.sideBet > 0);

      if (anyNonBust || anySideBet) {
        this.phase = 'DEALER_TURN';
        this.playDealer();
      } else {
        this.settle(false);
      }
      return;
    }

    this.activePlayerIndex = nextPlayerIndex;
    this.activeHandIndex = 0;
  }

  // ─── Dealer Play ─────────────────────────────────────────────────────

  private playDealer() {
    this.dealerCards = this.dealerCards.map((c) => ({ ...c, faceUp: true }));

    while (dealerMustHit(this.dealerCards)) {
      const card = this.drawCard(true);
      this.dealerCards.push(card);
    }

    this.settle(false);
  }

  // ─── Settlement ──────────────────────────────────────────────────────

  private settle(dealerHasBJ: boolean) {
    this.dealerCards = this.dealerCards.map((c) => ({ ...c, faceUp: true }));
    this.settlements = [];

    for (const pid of this.playerOrder) {
      const player = this.players.get(pid);
      if (!player?.hasBet || player.hands.length === 0) continue;

      const handResults: HandSettlement[] = [];
      let totalBalanceChange = 0;

      // Settle each hand independently
      for (let hi = 0; hi < player.hands.length; hi++) {
        const hand = player.hands[hi];
        const sr = settleHand(
          hand.cards,
          this.dealerCards,
          hand.originalBet,
          hand.doubleCount,
          0, 0, false, // insurance and side bet handled per-player below
          dealerHasBJ,
        );

        hand.result = sr.result;
        hand.message = sr.message;

        const tw = totalWager(hand.originalBet, hand.doubleCount);
        let balanceChange = 0;

        switch (sr.result) {
          case 'PLAYER_WIN':
            balanceChange += tw * 2;
            break;
          case 'PLAYER_BLACKJACK':
            balanceChange += tw + Math.floor(tw * 1.5);
            break;
          case 'PLAYER_BLACKJACK_SUITED':
            balanceChange += tw * 3;
            break;
          case 'PUSH':
          case 'PUSH_22':
            balanceChange += tw;
            break;
          case 'DEALER_WIN':
          case 'DEALER_BLACKJACK':
            break;
        }

        const netPayout = balanceChange - tw;
        totalBalanceChange += balanceChange;

        handResults.push({
          handIndex: hi,
          result: sr.result,
          payout: netPayout,
          message: sr.message,
        });
      }

      // Insurance (once per player, covers all hands)
      if (player.insuranceTaken) {
        if (dealerHasBJ) {
          totalBalanceChange += player.insuranceBet * 3;
        }
      }

      // Side bet (once per player)
      let sideBetPayout = 0;
      if (player.sideBet > 0) {
        const dh = evaluateHand(this.dealerCards);
        if (dh.isBust && dh.best === 22) {
          sideBetPayout = player.sideBet * SIDE_BET_PAYOUT;
          totalBalanceChange += player.sideBet + sideBetPayout;
        } else {
          sideBetPayout = -player.sideBet;
        }
      }

      player.balance += totalBalanceChange;

      // Compute total net payout for display
      const totalWagered = player.hands.reduce(
        (sum, h) => sum + totalWager(h.originalBet, h.doubleCount),
        0,
      );
      const totalRoundCost =
        totalWagered +
        (player.insuranceTaken ? player.insuranceBet : 0) +
        player.sideBet;
      const totalNetPayout = totalBalanceChange - totalRoundCost;

      // Generate summary result & message
      const numHands = player.hands.length;
      let summaryResult: HandResult;
      let summaryMessage: string;

      if (numHands === 1) {
        summaryResult = handResults[0].result;
        summaryMessage = handResults[0].message;
      } else {
        const wins = handResults.filter(
          (r) =>
            r.result === 'PLAYER_WIN' ||
            r.result === 'PLAYER_BLACKJACK' ||
            r.result === 'PLAYER_BLACKJACK_SUITED',
        ).length;
        const losses = handResults.filter(
          (r) => r.result === 'DEALER_WIN' || r.result === 'DEALER_BLACKJACK',
        ).length;

        if (dealerHasBJ) {
          summaryResult = 'DEALER_BLACKJACK';
          summaryMessage = 'DEALER BLACKJACK';
        } else if (wins === numHands) {
          summaryResult =
            handResults.some((r) => r.result.includes('BLACKJACK'))
              ? 'PLAYER_BLACKJACK'
              : 'PLAYER_WIN';
          summaryMessage = 'ALL HANDS WIN!';
        } else if (losses === numHands) {
          summaryResult = 'DEALER_WIN';
          summaryMessage = handResults.some(
            (r) => r.message === 'BUST',
          )
            ? 'ALL BUST'
            : 'DEALER WINS ALL';
        } else if (wins > losses) {
          summaryResult = 'PLAYER_WIN';
          summaryMessage = `${wins}/${numHands} WIN`;
        } else if (losses > wins) {
          summaryResult = 'DEALER_WIN';
          summaryMessage = `${losses}/${numHands} LOSE`;
        } else {
          summaryResult = 'PUSH';
          summaryMessage = 'MIXED RESULTS';
        }
      }

      this.settlements.push({
        playerId: pid,
        result: summaryResult,
        payout: totalNetPayout,
        message: summaryMessage,
        sideBetPayout,
        handResults,
      });
    }

    this.phase = 'SETTLEMENT';
  }

  // ─── Ready / Next Round ──────────────────────────────────────────────

  playerReady(playerId: string) {
    this.readyPlayers.add(playerId);
  }

  allReady(): boolean {
    const active = this.getConnectedPlayers().filter(
      (p) => p.hasBet && !this.isHouseDealer(p.id),
    );
    return active.length > 0 && active.every((p) => this.readyPlayers.has(p.id) || p.isAway);
  }

  // ─── Client Seed Management ──────────────────────────────────────────

  setClientSeed(seed: string): boolean {
    if (this.phase !== 'LOBBY' && this.phase !== 'BETTING') return false;
    if (!seed || seed.length < 1 || seed.length > 64) return false;
    if (!this.provablyFair) return false;

    this.provablyFair.clientSeed = seed;
    return true;
  }

  async prepareNextRound() {
    // Save previous round data for verification
    this.previousCardsDealt = [...this.cardsDealtThisRound];
    this.previousClientSeed = this.provablyFair.clientSeed;
    this.previousNonce = this.provablyFair.nonce;

    this.provablyFair = await rotateServerSeed(this.provablyFair);
    this.roundNumber++;

    // Always reshuffle the shoe every round so each round is independently
    // verifiable: the shoe is derived from this round's own seed parameters,
    // meaning cards dealt at positions 0..N map exactly to deriveShoeOrder()
    // output, which is what the client checks during verification.
    this.shoeOrder = await deriveShoeOrder(
      this.provablyFair.serverSeed,
      this.provablyFair.clientSeed,
      this.provablyFair.nonce,
    );
    this.shoe = this.shoeOrder.map((i) => this.indexToCard(i));
    this.shoePosition = 0;
    this.needsReshuffle = false;

    // Reset for next round
    for (const player of this.players.values()) {
      player.hands = [];
      player.currentBet = 0;
      player.sideBet = 0;
      player.insuranceBet = 0;
      player.insuranceTaken = false;
      player.hasBet = false;
      player.insuranceDecided = false;
      player.isReady = false;
    }

    if (!this.buttonPlayerId || !this.players.has(this.buttonPlayerId)) {
      const nextDealer = this.getConnectedPlayers()[0];
      this.buttonPlayerId = nextDealer?.id ?? null;
    }

    this.dealerCards = [];
    this.settlements = [];
    this.readyPlayers.clear();
    this.cardsDealtThisRound = [];

    this.phase = 'BETTING';
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private isHouseDealer(playerId: string): boolean {
    return this.buttonPlayerId === playerId;
  }

  private getConnectedPlayers(): ServerPlayer[] {
    return this.playerOrder
      .map((id) => this.players.get(id))
      .filter((p): p is ServerPlayer => !!p && p.connected);
  }

  private getActivePlayers(): ServerPlayer[] {
    return this.playerOrder
      .map((id) => this.players.get(id))
      .filter(
        (p): p is ServerPlayer =>
          !!p && p.hasBet && p.hands.length > 0 && !this.isHouseDealer(p.id),
      );
  }

  private findFirstActivePlayer(): number {
    for (let i = 0; i < this.playerOrder.length; i++) {
      const player = this.players.get(this.playerOrder[i]);
      if (
        player?.hasBet &&
        player.hands.length > 0 &&
        player.connected &&
        !player.isAway &&
        !this.isHouseDealer(player.id)
      ) {
        return i;
      }
    }
    return 0;
  }

  // ─── State Serialization ─────────────────────────────────────────────

  getClientState(forPlayerId: string): ClientTableState {
    const players: TablePlayer[] = this.playerOrder.map((pid) => {
      const p = this.players.get(pid)!;
      const hands: TableHand[] = p.hands.map((h) => ({
        cards: h.cards,
        doubleCount: h.doubleCount,
        originalBet: h.originalBet,
        justDoubledOnLoneAce: h.justDoubledOnLoneAce,
        result: h.result,
        message: h.message,
        actions: [...h.actions],
      }));

      return {
        id: p.id,
        name: p.name,
        balance: p.balance,
        buyIn: p.buyIn,
        hands,
        currentBet: p.currentBet,
        sideBet: p.sideBet,
        hasBet: p.hasBet,
        isReady: this.readyPlayers.has(p.id),
        connected: p.connected,
        isAway: p.isAway,
      };
    });

    const activePlayerId =
      this.phase === 'PLAYER_TURN'
        ? this.playerOrder[this.activePlayerIndex] || null
        : null;

    const provablyFair: ProvablyFairInfo = {
      serverSeedHash: this.provablyFair?.serverSeedHash || '',
      clientSeed: this.provablyFair?.clientSeed || '',
      nonce: this.provablyFair?.nonce ?? 0,
      roundNumber: this.roundNumber,
      previousServerSeed: this.provablyFair?.previousServerSeed,
      previousServerSeedHash: this.provablyFair?.previousServerSeedHash,
      previousClientSeed: this.previousClientSeed,
      previousNonce: this.previousNonce,
      previousCardsDealt: this.previousCardsDealt.length > 0
        ? this.previousCardsDealt
        : undefined,
    };

    return {
      roomCode: this.roomCode,
      phase: this.phase,
      players,
      buyInRequests: Array.from(this.buyInRequests.values()),
      dealerCards: this.dealerCards.map((c) => ({ ...c })),
      activePlayerId,
      activeHandIndex: this.activeHandIndex,
      myPlayerId: forPlayerId,
      hostId: this.hostId,
      buttonPlayerId: this.buttonPlayerId,
      settlement: this.phase === 'SETTLEMENT' ? this.settlements : null,
      roundNumber: this.roundNumber,
      serverSeedHash: this.provablyFair?.serverSeedHash || '',
      previousServerSeed: this.provablyFair?.previousServerSeed,
      provablyFair,
      chipDenominations: [...this.chipDenominations],
    };
  }
}
