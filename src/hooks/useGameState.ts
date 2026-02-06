// ─── Multiplayer Game State Store (Zustand) ───────────────────────────────────

import { create } from 'zustand';
import { socket } from './useSocket';
import type { ClientTableState, TablePlayer, PlayerSettlement, TablePhase, ProvablyFairInfo, ChatMessage, DiceRollResult } from '../shared/protocol';
import type { Card } from '../engine/deck';
import { getAvailableActions, totalWager, nextDoubleWager, STARTING_BALANCE, DEFAULT_CHIP_DENOMINATIONS, type AvailableActions } from '../engine/rules';

// ─── Stable constants (never create new refs in selectors) ────────────────────

const NO_ACTIONS: AvailableActions = { hit: false, stand: false, double: false };
const EMPTY_CARDS: Card[] = [];
const EMPTY_PLAYERS: TablePlayer[] = [];
const EMPTY_SETTLEMENTS: PlayerSettlement[] = [];
const EMPTY_PF: ProvablyFairInfo = {
  serverSeedHash: '',
  clientSeed: '',
  nonce: 0,
  roundNumber: 0,
};

// ─── Hand History Record ─────────────────────────────────────────────────────

export interface PlayerHandEntryHand {
  cards: Card[];
  bet: number;
  totalWager: number;
  result: string;
  resultLabel: string;
  payout: number;
  /** Action log: one entry per card after the initial deal. 'H' = Hit, 'D' = Double */
  actions: ('H' | 'D')[];
}

export interface PlayerHandEntry {
  id: string;
  name: string;
  hands: PlayerHandEntryHand[];
  totalPayout: number;
  balanceAfter: number;
  isMe: boolean;
}

export interface HandRecord {
  roundNumber: number;
  timestamp: number;
  dealerCards: Card[];
  players: PlayerHandEntry[];
  // My personal summary (for the summary bar)
  myResult: string;
  myPayout: number;
}

// ─── Departed Player (for ledger tracking) ───────────────────────────────────

export interface DepartedPlayer {
  id: string;
  name: string;
  lastBalance: number;
  buyIn: number;
  departedAt: number;
}

// ─── Store Interface ──────────────────────────────────────────────────────────

interface GameStore {
  // Connection
  connected: boolean;
  connecting: boolean;
  myPlayerId: string | null;
  myName: string;
  errorMessage: string | null;

  // Server state
  tableState: ClientTableState | null;

  // Pre-computed derived state (updated when game_state arrives)
  // These exist so selectors never create new object refs.
  _phase: TablePhase | null;
  _dealerCards: Card[];
  _players: TablePlayer[];
  _myPlayer: TablePlayer | null;
  _myBalance: number;
  _isMyTurn: boolean;
  _availableActions: AvailableActions;
  _myNextDouble: number;
  _myTotalWager: number;
  _mySettlement: PlayerSettlement | null;
  _settlements: PlayerSettlement[];
  _activePlayerId: string | null;
  _hostId: string;
  _roomCode: string;
  _provablyFair: ProvablyFairInfo;
  _myIsAway: boolean;
  _myBuyIn: number;
  _chipDenominations: number[];

  // Local betting input
  betInput: number;
  sideBetInput: number;
  numHandsInput: number;

  // UI state
  showProvablyFair: boolean;
  showHistory: boolean;
  showStats: boolean;
  showRules: boolean;
  showLedger: boolean;
  showChat: boolean;
  showStrategy: boolean;
  soundEnabled: boolean;
  isAnimating: boolean;

  // Chat
  chatMessages: ChatMessage[];
  unreadChatCount: number;

  // Dice roll (dealer selection)
  diceRoll: DiceRollResult | null;

  // Local session data
  departedPlayers: DepartedPlayer[];
  handHistory: HandRecord[];
  localStats: {
    totalHands: number;
    wins: number;
    losses: number;
    pushes: number;
    push22s: number;
    blackjacks: number;
    biggestWin: number;
    totalWagered: number;
  };

  // Actions
  connect: () => void;
  disconnect: () => void;
  setMyName: (name: string) => void;
  createRoom: (name: string, buyIn: number) => void;
  joinRoom: (code: string, name: string, buyIn: number) => void;
  leaveRoom: () => void;
  startRound: () => void;
  placeBet: () => void;
  hit: () => void;
  stand: () => void;
  doDouble: () => void;
  insurance: (take: boolean) => void;
  readyForNext: () => void;
  setClientSeed: (seed: string) => void;
  toggleAway: () => void;

  // Bet input
  setBetInput: (amount: number) => void;
  addToBetInput: (amount: number) => void;
  clearBet: () => void;
  allIn: () => void;
  setSideBetInput: (amount: number) => void;
  setNumHands: (n: number) => void;

  // UI toggles
  toggleProvablyFair: () => void;
  toggleHistory: () => void;
  toggleStats: () => void;
  toggleRules: () => void;
  toggleLedger: () => void;
  toggleChat: () => void;
  toggleStrategy: () => void;
  toggleSound: () => void;
  setAnimating: (v: boolean) => void;
  clearError: () => void;
  sendChat: (text: string) => void;
  setChipDenoms: (denominations: number[]) => void;
}

// ─── Default values ───────────────────────────────────────────────────────────

const defaultStats = {
  totalHands: 0,
  wins: 0,
  losses: 0,
  pushes: 0,
  push22s: 0,
  blackjacks: 0,
  biggestWin: 0,
  totalWagered: 0,
};

// ─── Compute derived state from a game_state update ───────────────────────────

function computeDerived(data: ClientTableState, myPlayerId: string | null) {
  const myPlayer = myPlayerId
    ? data.players.find((p) => p.id === myPlayerId) ?? null
    : null;

  let actions = NO_ACTIONS;
  let myNextDouble = 0;
  let myTotalWager = 0;

  const activeHandIdx = data.activeHandIndex ?? 0;

  if (
    data.phase === 'PLAYER_TURN' &&
    data.activePlayerId === myPlayerId &&
    myPlayer &&
    myPlayer.hands.length > 0
  ) {
    const activeHand = myPlayer.hands[activeHandIdx];
    if (activeHand) {
      actions = getAvailableActions(
        activeHand.cards,
        activeHand.doubleCount,
        activeHand.originalBet,
        myPlayer.balance,
        activeHand.justDoubledOnLoneAce,
      );
      myNextDouble = nextDoubleWager(activeHand.originalBet, activeHand.doubleCount);
    }
    // Total wager across all hands
    myTotalWager = myPlayer.hands.reduce(
      (sum, h) => sum + totalWager(h.originalBet, h.doubleCount),
      0,
    );
  } else if (myPlayer && myPlayer.hands.length > 0) {
    myTotalWager = myPlayer.hands.reduce(
      (sum, h) => sum + totalWager(h.originalBet, h.doubleCount),
      0,
    );
    const hand = myPlayer.hands[activeHandIdx] ?? myPlayer.hands[0];
    if (hand) {
      myNextDouble = nextDoubleWager(hand.originalBet, hand.doubleCount);
    }
  }

  const settlements = data.settlement ?? EMPTY_SETTLEMENTS;
  const mySettlement = myPlayerId
    ? settlements.find((s) => s.playerId === myPlayerId) ?? null
    : null;

  return {
    _phase: data.phase,
    _dealerCards: data.dealerCards.length > 0 ? data.dealerCards : EMPTY_CARDS,
    _players: data.players,
    _myPlayer: myPlayer,
    _myBalance: myPlayer?.balance ?? 0,
    _isMyTurn: data.phase === 'PLAYER_TURN' && data.activePlayerId === myPlayerId,
    _availableActions: actions,
    _myNextDouble: myNextDouble,
    _myTotalWager: myTotalWager,
    _mySettlement: mySettlement,
    _settlements: settlements,
    _activePlayerId: data.activePlayerId,
    _hostId: data.hostId,
    _roomCode: data.roomCode,
    _provablyFair: data.provablyFair ?? EMPTY_PF,
    _myIsAway: myPlayer?.isAway ?? false,
    _myBuyIn: myPlayer?.buyIn ?? STARTING_BALANCE,
    _chipDenominations: data.chipDenominations ?? DEFAULT_CHIP_DENOMINATIONS,
  };
}

// ─── Create Store ─────────────────────────────────────────────────────────────

export const useGameStore = create<GameStore>((set, get) => ({
  // Connection
  connected: false,
  connecting: false,
  myPlayerId: null,
  myName: '',
  errorMessage: null,

  // Server state
  tableState: null,

  // Pre-computed derived
  _phase: null,
  _dealerCards: EMPTY_CARDS,
  _players: EMPTY_PLAYERS,
  _myPlayer: null,
  _myBalance: 0,
  _isMyTurn: false,
  _availableActions: NO_ACTIONS,
  _myNextDouble: 0,
  _myTotalWager: 0,
  _mySettlement: null,
  _settlements: EMPTY_SETTLEMENTS,
  _activePlayerId: null,
  _hostId: '',
  _roomCode: '',
  _provablyFair: EMPTY_PF,
  _myIsAway: false,
  _myBuyIn: STARTING_BALANCE,
  _chipDenominations: [...DEFAULT_CHIP_DENOMINATIONS],

  // Local
  betInput: 10,
  sideBetInput: 0,
  numHandsInput: 1,

  // UI
  showProvablyFair: false,
  showHistory: false,
  showStats: false,
  showRules: false,
  showLedger: false,
  showChat: false,
  showStrategy: false,
  soundEnabled: true,
  isAnimating: false,

  chatMessages: [],
  unreadChatCount: 0,

  diceRoll: null,

  departedPlayers: [],
  handHistory: [],
  localStats: { ...defaultStats },

  // ─── Connection Actions ─────────────────────────────────────────────

  connect: () => {
    // If socket is already connected (e.g. after HMR), just sync state
    if (socket.connected) {
      set({ connected: true, connecting: false });
      return;
    }
    if (get().connecting) return;
    set({ connecting: true });
    socket.connect();
  },

  disconnect: () => {
    socket.disconnect();
    set({
      connected: false,
      connecting: false,
      tableState: null,
      myPlayerId: null,
      _phase: null,
      _dealerCards: EMPTY_CARDS,
      _players: EMPTY_PLAYERS,
      _myPlayer: null,
      _myBalance: 0,
      _isMyTurn: false,
      _availableActions: NO_ACTIONS,
      _myNextDouble: 0,
      _myTotalWager: 0,
      _mySettlement: null,
      _settlements: EMPTY_SETTLEMENTS,
      _activePlayerId: null,
      _hostId: '',
      _roomCode: '',
      _provablyFair: EMPTY_PF,
      _myIsAway: false,
      _myBuyIn: STARTING_BALANCE,
      _chipDenominations: [...DEFAULT_CHIP_DENOMINATIONS],
      departedPlayers: [],
      chatMessages: [],
      unreadChatCount: 0,
      diceRoll: null,
    });
  },

  setMyName: (name) => set({ myName: name }),

  // ─── Room Actions ───────────────────────────────────────────────────

  createRoom: (name, buyIn) => {
    set({ myName: name });
    socket.emit('create_room', { playerName: name, buyIn });
  },

  joinRoom: (code, name, buyIn) => {
    set({ myName: name });
    socket.emit('join_room', { roomCode: code.toUpperCase(), playerName: name, buyIn });
  },

  leaveRoom: () => {
    socket.emit('leave_room');
    set({
      tableState: null,
      myPlayerId: null,
      betInput: 10,
      sideBetInput: 0,
      numHandsInput: 1,
      _phase: null,
      _dealerCards: EMPTY_CARDS,
      _players: EMPTY_PLAYERS,
      _myPlayer: null,
      _myBalance: 0,
      _isMyTurn: false,
      _availableActions: NO_ACTIONS,
      _myNextDouble: 0,
      _myTotalWager: 0,
      _mySettlement: null,
      _settlements: EMPTY_SETTLEMENTS,
      _activePlayerId: null,
      _hostId: '',
      _roomCode: '',
      _provablyFair: EMPTY_PF,
      _myIsAway: false,
      _myBuyIn: STARTING_BALANCE,
      _chipDenominations: [...DEFAULT_CHIP_DENOMINATIONS],
      departedPlayers: [],
      chatMessages: [],
      unreadChatCount: 0,
      diceRoll: null,
    });
  },

  // ─── Game Actions ───────────────────────────────────────────────────

  startRound: () => {
    socket.emit('start_round');
  },

  placeBet: () => {
    const { betInput, sideBetInput, numHandsInput } = get();
    if (betInput <= 0) return;
    socket.emit('place_bet', { amount: betInput, sideBet: sideBetInput, numHands: numHandsInput });
  },

  hit: () => {
    socket.emit('player_action', { action: 'hit' });
  },

  stand: () => {
    socket.emit('player_action', { action: 'stand' });
  },

  doDouble: () => {
    socket.emit('player_action', { action: 'double' });
  },

  insurance: (take) => {
    socket.emit('insurance_decision', { take });
  },

  readyForNext: () => {
    socket.emit('ready_for_next');
  },

  setClientSeed: (seed) => {
    socket.emit('set_client_seed', { seed });
  },

  toggleAway: () => {
    socket.emit('toggle_away');
  },

  // ─── Bet Input ──────────────────────────────────────────────────────

  setBetInput: (amount) => {
    const { numHandsInput, sideBetInput } = get();
    const balance = get()._myBalance;
    const maxPerHand = Math.floor((balance - sideBetInput) / numHandsInput);
    set({ betInput: Math.max(0, Math.min(amount, maxPerHand)) });
  },

  addToBetInput: (amount) => {
    const { betInput, numHandsInput, sideBetInput } = get();
    const balance = get()._myBalance;
    // Max per-hand bet so total cost stays within balance
    const maxPerHand = Math.floor((balance - sideBetInput) / numHandsInput);
    set({ betInput: Math.min(betInput + amount, maxPerHand) });
  },

  clearBet: () => set({ betInput: 0, sideBetInput: 0 }),

  allIn: () => {
    const balance = get()._myBalance;
    if (balance > 0) set({ betInput: balance, sideBetInput: 0, numHandsInput: 1 });
  },

  setSideBetInput: (amount) => {
    const { betInput, numHandsInput } = get();
    const remaining = get()._myBalance - betInput * numHandsInput;
    set({ sideBetInput: Math.max(0, Math.min(amount, remaining)) });
  },

  setNumHands: (n) => {
    const clamped = Math.max(1, Math.min(5, n));
    set({ numHandsInput: clamped });
  },

  // ─── UI Toggles ─────────────────────────────────────────────────────

  toggleProvablyFair: () => set((s) => ({ showProvablyFair: !s.showProvablyFair })),
  toggleHistory: () => set((s) => ({ showHistory: !s.showHistory })),
  toggleStats: () => set((s) => ({ showStats: !s.showStats })),
  toggleRules: () => set((s) => ({ showRules: !s.showRules })),
  toggleLedger: () => set((s) => ({ showLedger: !s.showLedger })),
  toggleChat: () => set((s) => ({
    showChat: !s.showChat,
    unreadChatCount: !s.showChat ? 0 : s.unreadChatCount, // Clear unread when opening
  })),
  toggleStrategy: () => set((s) => ({ showStrategy: !s.showStrategy })),
  toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
  setAnimating: (v) => set({ isAnimating: v }),
  clearError: () => set({ errorMessage: null }),
  sendChat: (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    socket.emit('send_chat', { text: trimmed });
  },
  setChipDenoms: (denominations) => {
    socket.emit('set_chip_denoms', { denominations });
  },
}));

// ─── Socket Event Handlers (set up once, outside the store) ───────────────────

socket.on('connect', () => {
  useGameStore.setState({ connected: true, connecting: false });
});

socket.on('disconnect', () => {
  useGameStore.setState({ connected: false, connecting: false });
});

socket.on('room_created', ({ playerId }) => {
  useGameStore.setState({ myPlayerId: playerId });
});

socket.on('room_joined', ({ playerId }) => {
  useGameStore.setState({ myPlayerId: playerId });
});

socket.on('game_state', (data) => {
  const prev = useGameStore.getState().tableState;
  const myPlayerId = useGameStore.getState().myPlayerId;
  const derived = computeDerived(data, myPlayerId);

  // Detect departed players (were in previous state but not in current)
  if (prev && prev.players.length > 0) {
    const currentIds = new Set(data.players.map((p) => p.id));
    const departed: DepartedPlayer[] = [];
    for (const oldP of prev.players) {
      if (!currentIds.has(oldP.id)) {
        // This player is gone — check they aren't already in departedPlayers
        const existing = useGameStore.getState().departedPlayers;
        if (!existing.some((d) => d.id === oldP.id)) {
          departed.push({
            id: oldP.id,
            name: oldP.name,
            lastBalance: oldP.balance,
            buyIn: oldP.buyIn,
            departedAt: Date.now(),
          });
        }
      }
    }
    if (departed.length > 0) {
      const existing = useGameStore.getState().departedPlayers;
      useGameStore.setState({ departedPlayers: [...existing, ...departed] });
    }
  }

  useGameStore.setState({ tableState: data, ...derived });

  // Track local stats + hand history when settlement arrives
  if (data.phase === 'SETTLEMENT' && data.settlement && prev?.phase !== 'SETTLEMENT') {
    const mySett = derived._mySettlement;
    if (mySett) {
      const me = data.players.find((p) => p.id === myPlayerId);

      useGameStore.setState((s) => {
        const stats = { ...s.localStats };
        // Count each hand separately for stats
        const myHandResults = mySett.handResults ?? [];
        stats.totalHands += Math.max(myHandResults.length, 1);

        for (const hr of myHandResults) {
          if (
            hr.result === 'PLAYER_WIN' ||
            hr.result === 'PLAYER_BLACKJACK' ||
            hr.result === 'PLAYER_BLACKJACK_SUITED'
          ) {
            stats.wins++;
            if (hr.payout > stats.biggestWin) stats.biggestWin = hr.payout;
          } else if (hr.result === 'DEALER_WIN' || hr.result === 'DEALER_BLACKJACK') {
            stats.losses++;
          } else if (hr.result === 'PUSH_22') {
            stats.push22s++;
          } else {
            stats.pushes++;
          }
          if (hr.result === 'PLAYER_BLACKJACK' || hr.result === 'PLAYER_BLACKJACK_SUITED') {
            stats.blackjacks++;
          }
        }
        if (me) {
          stats.totalWagered += me.hands.reduce(
            (sum, h) => sum + totalWager(h.originalBet, h.doubleCount),
            0,
          );
        }

        // Record hand history entry for ALL players
        const playerEntries: PlayerHandEntry[] = data.players
          .filter((p) => p.hands.length > 0 && p.hasBet)
          .map((p) => {
            const sett = data.settlement?.find((s2) => s2.playerId === p.id);
            const handEntries: PlayerHandEntryHand[] = p.hands.map((h, hi) => {
              const hr = sett?.handResults?.find((r) => r.handIndex === hi);
              return {
                cards: [...h.cards],
                bet: h.originalBet,
                totalWager: totalWager(h.originalBet, h.doubleCount),
                result: hr?.result ?? h.result ?? '',
                resultLabel: hr?.message ?? h.message ?? '',
                payout: hr?.payout ?? 0,
                actions: [...(h.actions ?? [])],
              };
            });
            return {
              id: p.id,
              name: p.name,
              hands: handEntries,
              totalPayout: sett?.payout ?? 0,
              balanceAfter: p.balance,
              isMe: p.id === myPlayerId,
            };
          });

        const record: HandRecord = {
          roundNumber: data.roundNumber,
          timestamp: Date.now(),
          dealerCards: [...data.dealerCards],
          players: playerEntries,
          myResult: mySett.result,
          myPayout: mySett.payout,
        };

        return {
          localStats: stats,
          handHistory: [...s.handHistory, record],
        };
      });
    }
  }
});

socket.on('dice_roll', (data) => {
  useGameStore.setState({ diceRoll: data });
});

socket.on('chat_message', (msg) => {
  useGameStore.setState((s) => ({
    chatMessages: [...s.chatMessages, msg].slice(-200), // Keep last 200 messages
    unreadChatCount: s.showChat ? 0 : s.unreadChatCount + 1,
  }));
});

socket.on('error', ({ message }) => {
  useGameStore.setState({ errorMessage: message });
  setTimeout(() => useGameStore.setState({ errorMessage: null }), 5000);
});

// ─── Sync state if socket is already connected (handles HMR / hot-reload) ─────

if (socket.connected) {
  useGameStore.setState({ connected: true, connecting: false });
}

// ─── Stable selectors (read pre-computed fields, never create objects) ────────

export const selectPhase = (s: GameStore) => s._phase;
export const selectDealerCards = (s: GameStore) => s._dealerCards;
export const selectMyPlayer = (s: GameStore) => s._myPlayer;
export const selectMyBalance = (s: GameStore) => s._myBalance;
export const selectIsMyTurn = (s: GameStore) => s._isMyTurn;
export const selectMyActions = (s: GameStore) => s._availableActions;
export const selectMyNextDouble = (s: GameStore) => s._myNextDouble;
export const selectMyTotalWager = (s: GameStore) => s._myTotalWager;
export const selectProvablyFair = (s: GameStore) => s._provablyFair;
export const selectMyIsAway = (s: GameStore) => s._myIsAway;
export const selectMyBuyIn = (s: GameStore) => s._myBuyIn;
export const selectChipDenominations = (s: GameStore) => s._chipDenominations;

// ─── Settlement Timing Constants (must match PlayerArea) ─────────────────────
// These control the cascading reveal of results after the dealer's sweat reveal.

import { useRef, useState, useEffect } from 'react';

export const SETTLEMENT_TIMING = {
  RESULT_REVEAL_BASE: 600,    // delay before first player result
  RESULT_STAGGER_PER: 350,    // stagger between each player's results
  BALANCE_EXTRA: 200,         // extra delay after last player result for balance
  BANNER_EXTRA: 400,          // extra delay after last player result for banner/chips
} as const;

const RESULT_REVEAL_BASE = SETTLEMENT_TIMING.RESULT_REVEAL_BASE;
const RESULT_STAGGER_PER = SETTLEMENT_TIMING.RESULT_STAGGER_PER;
const BALANCE_EXTRA_DELAY = SETTLEMENT_TIMING.BALANCE_EXTRA;
const BANNER_EXTRA_DELAY = SETTLEMENT_TIMING.BANNER_EXTRA;

// ─── Helper: total delay until all player results have appeared ──────────────

function totalResultsDelay(playerCount: number): number {
  return RESULT_REVEAL_BASE + Math.max(0, playerCount - 1) * RESULT_STAGGER_PER;
}

// ─── Display Balance Hook (delays balance update during dealer reveal) ───────
// Returns the balance that should be visually shown. During SETTLEMENT, it
// freezes the pre-settlement balance while the dealer reveal plays, then updates
// after a delay (matching the player-results stagger) once the reveal is done.

export function useDisplayBalance(): number {
  const realBalance = useGameStore(selectMyBalance);
  const phase = useGameStore(selectPhase);
  const isAnimating = useGameStore((s) => s.isAnimating);
  const players = useGameStore((s) => s._players);

  const [displayed, setDisplayed] = useState(realBalance);
  const frozenRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // Entering settlement with animation → freeze display
    if (phase === 'SETTLEMENT' && isAnimating) {
      frozenRef.current = true;
      return;
    }

    // Dealer reveal just finished (still in SETTLEMENT, animation done, still frozen)
    if (phase === 'SETTLEMENT' && !isAnimating && frozenRef.current) {
      // Clear any pending timer
      if (timerRef.current !== null) clearTimeout(timerRef.current);

      // Calculate delay: after all player results have staggered in + extra
      const playerCount = players.filter((p) => p.hands.length > 0).length;
      const delay = totalResultsDelay(playerCount) + BALANCE_EXTRA_DELAY;

      timerRef.current = window.setTimeout(() => {
        frozenRef.current = false;
        setDisplayed(realBalance);
        timerRef.current = null;
      }, delay);

      return;
    }

    // Phase changed away from SETTLEMENT or never was frozen → sync immediately
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    frozenRef.current = false;
    setDisplayed(realBalance);
  }, [realBalance, phase, isAnimating, players]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
  }, []);

  return frozenRef.current ? displayed : realBalance;
}

// ─── Settlement-Ready Hook (delays banner/chips until after result cascade) ──
// Returns true only after the dealer reveal + player result stagger + extra
// delay have all completed, so the banner and win-chip animation appear last.

export function useSettlementReady(): boolean {
  const phase = useGameStore(selectPhase);
  const isAnimating = useGameStore((s) => s.isAnimating);
  const players = useGameStore((s) => s._players);

  const [ready, setReady] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // Clear any pending timer
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Not in settlement or still animating dealer → not ready
    if (phase !== 'SETTLEMENT' || isAnimating) {
      setReady(false);
      return;
    }

    // Dealer reveal just finished → schedule ready after result cascade
    const playerCount = players.filter((p) => p.hands.length > 0).length;
    const delay = totalResultsDelay(playerCount) + BANNER_EXTRA_DELAY;

    timerRef.current = window.setTimeout(() => {
      setReady(true);
      timerRef.current = null;
    }, delay);

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [phase, isAnimating, players]);

  // Reset immediately when leaving settlement
  useEffect(() => {
    if (phase !== 'SETTLEMENT') setReady(false);
  }, [phase]);

  return ready;
}
