// ─── Game Engine (Pure State Machine) — Multi-Hand Support ────────────────────

import { type Card, evaluateHand, TOTAL_CARDS, CUT_CARD_POSITION, SUITS, RANKS } from './deck';
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
  SIDE_BET_PAYOUT,
  type AvailableActions,
} from './rules';
import {
  type ProvablyFairState,
  initProvablyFair,
  rotateServerSeed,
  deriveShoeOrder,
} from './provablyFair';

// ─── Player Hand (one of up to 5) ────────────────────────────────────────────

export interface PlayerHand {
  cards: Card[];
  originalBet: number;
  doubleCount: number;
  justDoubledOnLoneAce: boolean;
  result: HandResult | null;
  message: string;
}

function createEmptyHand(bet: number): PlayerHand {
  return {
    cards: [],
    originalBet: bet,
    doubleCount: 0,
    justDoubledOnLoneAce: false,
    result: null,
    message: '',
  };
}

// ─── Multi-Hand Settlement ────────────────────────────────────────────────────

export interface MultiHandSettlement {
  handResults: Array<{
    result: HandResult;
    payout: number;
    message: string;
  }>;
  sideBetPayout: number;
  totalPayout: number;
  overallMessage: string;
}

// ─── Hand History ─────────────────────────────────────────────────────────────

export interface HandRecord {
  handNumber: number;
  hands: Array<{
    playerCards: Card[];
    result: HandResult;
    originalBet: number;
    totalWager: number;
  }>;
  dealerCards: Card[];
  totalPayout: number;
  sideBetPayout: number;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  cardIndices: number[];
}

// ─── Game State ───────────────────────────────────────────────────────────────

export interface GameState {
  // Core
  phase: GamePhase;
  balance: number;

  // Shoe
  shoe: Card[];
  shoeOrder: number[];
  shoePosition: number;
  needsReshuffle: boolean;

  // Multi-hand
  hands: PlayerHand[];
  activeHandIndex: number;
  numHands: number; // 1-5

  // Dealer
  dealerCards: Card[];

  // Shared bets
  sideBet: number;
  insuranceBet: number; // total cost across all hands
  insuranceTaken: boolean;

  // Settlement
  settlement: MultiHandSettlement | null;

  // Betting UI
  currentBetAmount: number;
  currentSideBetAmount: number;

  // Provably Fair
  provablyFair: ProvablyFairState;

  // History
  handHistory: HandRecord[];
  handNumber: number;
  cardsDealtThisHand: number[];

  // Stats
  stats: {
    totalHands: number;
    wins: number;
    losses: number;
    pushes: number;
    blackjacks: number;
    biggestWin: number;
    totalWagered: number;
  };
}

// ─── Index to Card Mapping ────────────────────────────────────────────────────

function indexToCard(index: number): Card {
  const deckIndex = index % 52;
  const suitIndex = Math.floor(deckIndex / 13);
  const rankIndex = deckIndex % 13;
  return {
    suit: SUITS[suitIndex],
    rank: RANKS[rankIndex],
    faceUp: true,
  };
}

// ─── Create Initial State ─────────────────────────────────────────────────────

export async function createInitialState(): Promise<GameState> {
  const pf = await initProvablyFair();
  const shoeOrder = await deriveShoeOrder(pf.serverSeed, pf.clientSeed, pf.nonce);
  const shoe = shoeOrder.map(i => indexToCard(i));

  return {
    phase: 'BETTING',
    balance: STARTING_BALANCE,
    shoe,
    shoeOrder,
    shoePosition: 0,
    needsReshuffle: false,
    hands: [],
    activeHandIndex: 0,
    numHands: 1,
    dealerCards: [],
    sideBet: 0,
    insuranceBet: 0,
    insuranceTaken: false,
    settlement: null,
    currentBetAmount: 0,
    currentSideBetAmount: 0,
    provablyFair: pf,
    handHistory: [],
    handNumber: 0,
    cardsDealtThisHand: [],
    stats: {
      totalHands: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      blackjacks: 0,
      biggestWin: 0,
      totalWagered: 0,
    },
  };
}

// ─── Card Drawing ─────────────────────────────────────────────────────────────

function drawCard(state: GameState, faceUp: boolean = true): { card: Card; state: GameState } {
  const card = { ...state.shoe[state.shoePosition], faceUp };
  const cardIndex = state.shoeOrder[state.shoePosition];
  return {
    card,
    state: {
      ...state,
      shoePosition: state.shoePosition + 1,
      needsReshuffle: state.shoePosition + 1 >= CUT_CARD_POSITION,
      cardsDealtThisHand: [...state.cardsDealtThisHand, cardIndex],
    },
  };
}

// ─── Helper: update a specific hand in the hands array ────────────────────────

function updateHand(state: GameState, index: number, updates: Partial<PlayerHand>): GameState {
  const newHands = [...state.hands];
  newHands[index] = { ...newHands[index], ...updates };
  return { ...state, hands: newHands };
}

function activeHand(state: GameState): PlayerHand {
  return state.hands[state.activeHandIndex];
}

// ─── Advance to next hand or dealer turn ──────────────────────────────────────

function advanceHand(state: GameState): GameState {
  const nextIndex = state.activeHandIndex + 1;
  if (nextIndex >= state.hands.length) {
    // All hands played — check if dealer needs to play
    const anyNonBust = state.hands.some(h => !evaluateHand(h.cards).isBust);
    const hasSideBet = state.sideBet > 0;
    if (anyNonBust || hasSideBet) {
      return { ...state, phase: 'DEALER_TURN' };
    }
    // All hands busted and no side bet — settle immediately
    return settleAll(state, false);
  }
  return { ...state, activeHandIndex: nextIndex };
}

// ─── Settle all hands against dealer ──────────────────────────────────────────

function settleAll(state: GameState, dealerHasBJ: boolean): GameState {
  const dealerCards = state.dealerCards.map(c => ({ ...c, faceUp: true }));
  const handResults: MultiHandSettlement['handResults'] = [];

  for (const hand of state.hands) {
    const sr = settleHand(
      hand.cards,
      dealerCards,
      hand.originalBet,
      hand.doubleCount,
      0, 0, false, // insurance/side bet handled separately
      dealerHasBJ
    );
    handResults.push({
      result: sr.result,
      payout: sr.payout,
      message: sr.message,
    });
  }

  // Side bet
  let sideBetPayout = 0;
  if (state.sideBet > 0) {
    const dh = evaluateHand(dealerCards);
    if (dh.isBust && dh.best === 22) {
      sideBetPayout = state.sideBet * SIDE_BET_PAYOUT;
    } else {
      sideBetPayout = -state.sideBet;
    }
  }

  const mainPayout = handResults.reduce((s, r) => s + r.payout, 0);
  const totalPayout = mainPayout + sideBetPayout;

  // Overall message
  const wins = handResults.filter(r =>
    r.result === 'PLAYER_WIN' || r.result === 'PLAYER_BLACKJACK' || r.result === 'PLAYER_BLACKJACK_SUITED'
  ).length;
  const losses = handResults.filter(r =>
    r.result === 'DEALER_WIN' || r.result === 'DEALER_BLACKJACK'
  ).length;

  let overallMessage: string;
  if (dealerHasBJ) {
    overallMessage = 'DEALER BLACKJACK';
  } else if (wins === state.hands.length) {
    overallMessage = handResults.some(r => r.result.includes('BLACKJACK')) ? 'BLACKJACK!' : 'YOU WIN!';
  } else if (losses === state.hands.length) {
    overallMessage = handResults.some(r => r.result === 'DEALER_WIN' && r.message === 'BUST') ? 'BUST' : 'DEALER WINS';
  } else if (wins > losses) {
    overallMessage = `${wins} of ${state.hands.length} WIN`;
  } else if (losses > wins) {
    overallMessage = `${losses} of ${state.hands.length} LOSE`;
  } else {
    overallMessage = 'MIXED RESULTS';
  }

  // Update hands with individual results
  const updatedHands = state.hands.map((h, i) => ({
    ...h,
    result: handResults[i].result,
    message: handResults[i].message,
  }));

  return {
    ...state,
    phase: 'SETTLEMENT',
    dealerCards,
    hands: updatedHands,
    settlement: {
      handResults,
      sideBetPayout,
      totalPayout,
      overallMessage,
    },
  };
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export function placeBet(state: GameState): GameState {
  if (state.phase !== 'BETTING') return state;
  if (state.currentBetAmount <= 0) return state;

  const betPerHand = state.currentBetAmount;
  const totalBet = betPerHand * state.numHands;
  if (totalBet > state.balance) return state;

  let newBalance = state.balance - totalBet;
  let sideBet = 0;
  if (state.currentSideBetAmount > 0 && state.currentSideBetAmount <= newBalance) {
    sideBet = state.currentSideBetAmount;
    newBalance -= sideBet;
  }

  // Create N hands
  const hands: PlayerHand[] = [];
  for (let i = 0; i < state.numHands; i++) {
    hands.push(createEmptyHand(betPerHand));
  }

  return {
    ...state,
    phase: 'DEALING',
    hands,
    activeHandIndex: 0,
    sideBet,
    balance: newBalance,
    dealerCards: [],
    insuranceBet: 0,
    insuranceTaken: false,
    settlement: null,
    cardsDealtThisHand: [],
  };
}

export function dealCards(state: GameState): GameState {
  if (state.phase !== 'DEALING') return state;

  let s = state;

  // Deal 1 card face-up to each player hand
  const newHands = [...s.hands];
  for (let i = 0; i < newHands.length; i++) {
    const draw = drawCard(s, true);
    const card = draw.card;
    s = draw.state;
    newHands[i] = { ...newHands[i], cards: [card] };
  }

  // Dealer gets 2 cards: first face-up, second face-down
  const drawDealer1 = drawCard(s, true);
  const dealerCard1 = drawDealer1.card;
  s = drawDealer1.state;
  const drawDealer2 = drawCard(s, false);
  const dealerCard2 = drawDealer2.card;
  s = drawDealer2.state;

  s = {
    ...s,
    hands: newHands,
    dealerCards: [dealerCard1, dealerCard2],
    activeHandIndex: 0,
  };

  // Check if we should offer insurance or peek
  if (shouldOfferInsurance(dealerCard1)) {
    return { ...s, phase: 'INSURANCE_OFFERED' };
  }
  if (shouldPeek(dealerCard1)) {
    return { ...s, phase: 'PEEK_CHECK' };
  }
  return { ...s, phase: 'PLAYER_TURN' };
}

export function takeInsurance(state: GameState): GameState {
  if (state.phase !== 'INSURANCE_OFFERED') return state;

  // Insurance costs half the bet per hand, for all hands
  const costPerHand = state.hands.map(h => Math.floor(h.originalBet / 2));
  const totalCost = costPerHand.reduce((s, c) => s + c, 0);

  if (totalCost > state.balance) {
    return { ...state, phase: 'PEEK_CHECK' };
  }

  return {
    ...state,
    phase: 'PEEK_CHECK',
    insuranceTaken: true,
    insuranceBet: totalCost,
    balance: state.balance - totalCost,
  };
}

export function declineInsurance(state: GameState): GameState {
  if (state.phase !== 'INSURANCE_OFFERED') return state;
  return { ...state, phase: 'PEEK_CHECK' };
}

export function peekCheck(state: GameState): GameState {
  if (state.phase !== 'PEEK_CHECK') return state;

  const fullDealerCards = state.dealerCards.map(c => ({ ...c, faceUp: true }));
  if (dealerHasBlackjack(fullDealerCards)) {
    return settleAll({ ...state, dealerCards: fullDealerCards }, true);
  }

  return { ...state, phase: 'PLAYER_TURN' };
}

export function playerHit(state: GameState): GameState {
  if (state.phase !== 'PLAYER_TURN') return state;

  const hand = activeHand(state);
  const actions = getAvailableActions(
    hand.cards, hand.doubleCount, hand.originalBet, state.balance, hand.justDoubledOnLoneAce
  );
  if (!actions.hit) return state;

  let s = state;
  const draw = drawCard(s, true);
  const card = draw.card;
  s = draw.state;

  const newCards = [...hand.cards, card];
  const handEval = evaluateHand(newCards);

  s = updateHand(s, s.activeHandIndex, { cards: newCards });

  // Bust or 21 → advance to next hand
  if (handEval.isBust || handEval.best === 21) {
    return advanceHand(s);
  }

  return s;
}

export function playerDouble(state: GameState): GameState {
  if (state.phase !== 'PLAYER_TURN') return state;

  const hand = activeHand(state);
  const actions = getAvailableActions(
    hand.cards, hand.doubleCount, hand.originalBet, state.balance, hand.justDoubledOnLoneAce
  );
  if (!actions.double) return state;

  const wager = nextDoubleWager(hand.originalBet, hand.doubleCount);

  let s = { ...state, balance: state.balance - wager };
  const draw = drawCard(s, true);
  const card = draw.card;
  s = draw.state;

  const newCards = [...hand.cards, card];
  const handEval = evaluateHand(newCards);
  const wasLoneAce = hand.cards.length === 1 && hand.cards[0].rank === 'A';

  s = updateHand(s, s.activeHandIndex, {
    cards: newCards,
    doubleCount: hand.doubleCount + 1,
    justDoubledOnLoneAce: wasLoneAce,
  });

  // Lone ace → must stand → advance
  if (wasLoneAce) {
    return advanceHand(s);
  }

  // Bust or 21 → advance
  if (handEval.isBust || handEval.best === 21) {
    return advanceHand(s);
  }

  return s;
}

export function playerStand(state: GameState): GameState {
  if (state.phase !== 'PLAYER_TURN') return state;
  return advanceHand(state);
}

export function dealerDraw(state: GameState): GameState {
  if (state.phase !== 'DEALER_TURN') return state;

  // Reveal hole card
  let dealerCards = state.dealerCards.map(c => ({ ...c, faceUp: true }));

  // Check if dealer needs to hit
  if (!dealerMustHit(dealerCards)) {
    return settleAll({ ...state, dealerCards }, false);
  }

  // Draw one card
  let s = { ...state, dealerCards };
  const draw = drawCard(s, true);
  const card = draw.card;
  s = draw.state;

  dealerCards = [...s.dealerCards, card];
  s = { ...s, dealerCards };

  const dh = evaluateHand(dealerCards);
  if (dh.isBust || !dealerMustHit(dealerCards)) {
    return settleAll(s, false);
  }

  return s;
}

// ─── Complete Settlement (balance + stats + history) ──────────────────────────

export function completeSettlement(state: GameState): GameState {
  if (state.phase !== 'SETTLEMENT' || !state.settlement) return state;

  const { settlement } = state;
  let balanceChange = 0;

  // Settle each hand's main bet
  for (let i = 0; i < state.hands.length; i++) {
    const hand = state.hands[i];
    const hr = settlement.handResults[i];
    const tw = totalWager(hand.originalBet, hand.doubleCount);

    switch (hr.result) {
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
  }

  // Insurance
  if (state.insuranceTaken) {
    const anyDealerBJ = settlement.handResults.some(r => r.result === 'DEALER_BLACKJACK');
    if (anyDealerBJ) {
      balanceChange += state.insuranceBet * 3;
    }
  }

  // Side bet
  if (state.sideBet > 0) {
    const dh = evaluateHand(state.dealerCards);
    if (dh.isBust && dh.best === 22) {
      balanceChange += state.sideBet + state.sideBet * SIDE_BET_PAYOUT;
    }
  }

  const newBalance = state.balance + balanceChange;

  // Stats
  const stats = { ...state.stats };
  stats.totalHands += state.hands.length;

  for (let i = 0; i < state.hands.length; i++) {
    const hr = settlement.handResults[i];
    const tw = totalWager(state.hands[i].originalBet, state.hands[i].doubleCount);
    stats.totalWagered += tw;

    if (hr.result === 'PLAYER_WIN' || hr.result === 'PLAYER_BLACKJACK' || hr.result === 'PLAYER_BLACKJACK_SUITED') {
      stats.wins++;
      if (hr.payout > stats.biggestWin) stats.biggestWin = hr.payout;
    } else if (hr.result === 'DEALER_WIN' || hr.result === 'DEALER_BLACKJACK') {
      stats.losses++;
    } else {
      stats.pushes++;
    }

    if (hr.result === 'PLAYER_BLACKJACK' || hr.result === 'PLAYER_BLACKJACK_SUITED') {
      stats.blackjacks++;
    }
  }

  // Hand history
  const record: HandRecord = {
    handNumber: state.handNumber + 1,
    hands: state.hands.map((h, i) => ({
      playerCards: [...h.cards],
      result: settlement.handResults[i].result,
      originalBet: h.originalBet,
      totalWager: totalWager(h.originalBet, h.doubleCount),
    })),
    dealerCards: [...state.dealerCards],
    totalPayout: settlement.totalPayout,
    sideBetPayout: settlement.sideBetPayout,
    serverSeed: state.provablyFair.serverSeed,
    serverSeedHash: state.provablyFair.serverSeedHash,
    clientSeed: state.provablyFair.clientSeed,
    nonce: state.provablyFair.nonce,
    cardIndices: [...state.cardsDealtThisHand],
  };

  return {
    ...state,
    balance: newBalance,
    handNumber: state.handNumber + 1,
    handHistory: [record, ...state.handHistory].slice(0, 20),
    stats,
  };
}

export async function startNewHand(state: GameState): Promise<GameState> {
  const newPf = await rotateServerSeed(state.provablyFair);

  let shoeOrder = state.shoeOrder;
  let shoe = state.shoe;
  let shoePosition = state.shoePosition;

  if (state.needsReshuffle || shoePosition >= TOTAL_CARDS - 30) {
    shoeOrder = await deriveShoeOrder(newPf.serverSeed, newPf.clientSeed, newPf.nonce);
    shoe = shoeOrder.map(i => indexToCard(i));
    shoePosition = 0;
  }

  return {
    ...state,
    phase: 'BETTING',
    provablyFair: newPf,
    shoe,
    shoeOrder,
    shoePosition,
    needsReshuffle: false,
    hands: [],
    activeHandIndex: 0,
    dealerCards: [],
    sideBet: 0,
    insuranceBet: 0,
    insuranceTaken: false,
    settlement: null,
    cardsDealtThisHand: [],
  };
}

// ─── Helpers for store ────────────────────────────────────────────────────────

export function getPlayerActions(state: GameState): AvailableActions {
  if (state.phase !== 'PLAYER_TURN' || state.hands.length === 0) {
    return { hit: false, stand: false, double: false };
  }
  const hand = state.hands[state.activeHandIndex];
  if (!hand) return { hit: false, stand: false, double: false };
  return getAvailableActions(
    hand.cards,
    hand.doubleCount,
    hand.originalBet,
    state.balance,
    hand.justDoubledOnLoneAce
  );
}
