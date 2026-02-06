// ─── Shared Protocol Types (Client ↔ Server) ──────────────────────────────────

import type { Card } from '../engine/deck';
import type { GamePhase, HandResult } from '../engine/rules';

// ─── Table Phase ──────────────────────────────────────────────────────────────

export type TablePhase = 'LOBBY' | GamePhase;

// ─── Hand (one of up to 5 per player) ────────────────────────────────────────

export interface TableHand {
  cards: Card[];
  doubleCount: number;
  originalBet: number;
  justDoubledOnLoneAce: boolean;
  result: HandResult | null;
  message: string;
  /** Action log: one entry per card after the initial deal. 'H' = Hit, 'D' = Double */
  actions: ('H' | 'D')[];
}

// ─── Player visible at the table ──────────────────────────────────────────────

export interface TablePlayer {
  id: string;
  name: string;
  balance: number;
  buyIn: number;
  hands: TableHand[];
  currentBet: number;      // per-hand bet amount
  sideBet: number;
  hasBet: boolean;
  isReady: boolean;
  connected: boolean;
  isAway: boolean;
}

// ─── Per-hand settlement result ───────────────────────────────────────────────

export interface HandSettlement {
  handIndex: number;
  result: HandResult;
  payout: number;
  message: string;
}

// ─── Per-player settlement result ─────────────────────────────────────────────

export interface PlayerSettlement {
  playerId: string;
  result: HandResult;       // summary / best result
  payout: number;           // total net payout
  message: string;          // summary message
  sideBetPayout: number;
  handResults: HandSettlement[];
}

// ─── Provably Fair Data ──────────────────────────────────────────────────────

export interface ProvablyFairInfo {
  // Current round (commitment)
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  roundNumber: number;

  // Previous round (revealed for verification)
  previousServerSeed?: string;
  previousServerSeedHash?: string;
  previousClientSeed?: string;
  previousNonce?: number;
  previousCardsDealt?: number[];
}

// ─── Full table state sent to each client ─────────────────────────────────────

export interface ClientTableState {
  roomCode: string;
  phase: TablePhase;
  players: TablePlayer[];
  dealerCards: Card[];
  activePlayerId: string | null;
  activeHandIndex: number;
  myPlayerId: string;
  hostId: string;
  /** The player currently holding the "dealer button" */
  buttonPlayerId: string | null;
  settlement: PlayerSettlement[] | null;
  roundNumber: number;
  serverSeedHash: string;
  previousServerSeed?: string;
  provablyFair: ProvablyFairInfo;
  chipDenominations: number[];
}

// ─── Dice Roll Event ─────────────────────────────────────────────────────────

export interface DiceRollResult {
  /** The final dice values [die1, die2] */
  dice: [number, number];
  /** Total of both dice */
  total: number;
  /** Ordered list of player IDs being rolled for */
  playerIds: string[];
  /** Player names for display */
  playerNames: string[];
  /** The player selected as the dealer (button holder) */
  selectedPlayerId: string;
  selectedPlayerName: string;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

// ─── Socket.IO Event Types ────────────────────────────────────────────────────

export interface ClientToServerEvents {
  create_room: (data: { playerName: string; buyIn: number }) => void;
  join_room: (data: { roomCode: string; playerName: string; buyIn: number }) => void;
  leave_room: () => void;
  start_round: () => void;
  place_bet: (data: { amount: number; sideBet: number; numHands: number }) => void;
  player_action: (data: { action: 'hit' | 'stand' | 'double' }) => void;
  insurance_decision: (data: { take: boolean }) => void;
  ready_for_next: () => void;
  set_client_seed: (data: { seed: string }) => void;
  toggle_away: () => void;
  send_chat: (data: { text: string }) => void;
  set_chip_denoms: (data: { denominations: number[] }) => void;
}

export interface ServerToClientEvents {
  room_created: (data: { roomCode: string; playerId: string }) => void;
  room_joined: (data: { roomCode: string; playerId: string }) => void;
  game_state: (data: ClientTableState) => void;
  /** Fired before the first round to animate the dealer selection dice roll */
  dice_roll: (data: DiceRollResult) => void;
  chat_message: (data: ChatMessage) => void;
  error: (data: { message: string }) => void;
}
