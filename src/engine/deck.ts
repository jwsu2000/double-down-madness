// ─── Card & Deck Types ────────────────────────────────────────────────────────

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
}

export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const NUM_DECKS = 6;
export const TOTAL_CARDS = NUM_DECKS * 52; // 312
export const CUT_CARD_POSITION = Math.floor(TOTAL_CARDS * 0.75); // ~234

// ─── Card Value Helpers ───────────────────────────────────────────────────────

export function cardValue(rank: Rank): number {
  if (rank === 'A') return 11;
  if (['K', 'Q', 'J'].includes(rank)) return 10;
  return parseInt(rank, 10);
}

export function isTenValue(rank: Rank): boolean {
  return ['10', 'J', 'Q', 'K'].includes(rank);
}

export function isAce(rank: Rank): boolean {
  return rank === 'A';
}

export function isSuitRed(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

// ─── Hand Evaluation ──────────────────────────────────────────────────────────

export interface HandValue {
  hard: number;
  soft: number;
  best: number;
  isSoft: boolean;
  isBust: boolean;
}

export function evaluateHand(cards: Card[]): HandValue {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    if (card.rank === 'A') {
      aces++;
      total += 11;
    } else {
      total += cardValue(card.rank);
    }
  }

  const soft = total;
  // Reduce aces from 11 to 1 as needed
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return {
    hard: total,
    soft,
    best: total,
    isSoft: aces > 0 && total <= 21,
    isBust: total > 21,
  };
}

export function isBlackjack(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  const hasAce = cards.some(c => c.rank === 'A');
  const hasTen = cards.some(c => isTenValue(c.rank));
  return hasAce && hasTen;
}

export function isSuitedBlackjack(cards: Card[]): boolean {
  if (!isBlackjack(cards)) return false;
  return cards[0].suit === cards[1].suit;
}

// ─── Shoe (6-deck) ───────────────────────────────────────────────────────────

export function createShoe(): Card[] {
  const shoe: Card[] = [];
  for (let d = 0; d < NUM_DECKS; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        shoe.push({ suit, rank, faceUp: true });
      }
    }
  }
  return shoe;
}

/** Get the suit symbol for display */
export function suitSymbol(suit: Suit): string {
  switch (suit) {
    case 'hearts': return '♥';
    case 'diamonds': return '♦';
    case 'clubs': return '♣';
    case 'spades': return '♠';
  }
}

/** Get a short display string like "A♠" */
export function cardDisplay(card: Card): string {
  return `${card.rank}${suitSymbol(card.suit)}`;
}
