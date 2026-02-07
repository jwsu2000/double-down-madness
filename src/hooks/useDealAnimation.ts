// ─── Deal Animation Hook ──────────────────────────────────────────────────────
// Stages the initial card deal so cards appear one by one across the table.
//
// DDM dealing order:
//   1. Each player hand gets 1 card (left to right, hand by hand)
//   2. Dealer gets upcard (face-up)
//   3. Dealer gets hole card (face-down)
//
// During the animation, components read display* versions of the cards.
// After the animation, display cards sync with server state.

import { useState, useEffect, useRef, useMemo } from 'react';
import { useGameStore, selectPhase, selectDealerCards } from './useGameState';
import type { Card } from '../engine/deck';

// ─── Timing ──────────────────────────────────────────────────────────────────

const DEAL_INTERVAL = 350;          // ms between each card being dealt
const PRE_DEAL_PAUSE = 200;         // brief pause before dealing starts
const POST_DEAL_SETTLE = 300;       // settle time after last card

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DealAnimationState {
  /** Cards to display for each player, keyed by playerId → hand index → cards */
  playerCards: Map<string, Card[][]>;
  /** Cards to display for the dealer */
  dealerCards: Card[];
  /** Whether the deal animation is currently running */
  isDealing: boolean;
  /** Number of cards dealt so far in the current animation (for sound effects) */
  totalDealt: number;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

// ─── React Context (so PlayerArea + DealerArea share the same state) ─────────

import { createContext, useContext } from 'react';

const DealAnimationContext = createContext<DealAnimationState>({
  playerCards: new Map(),
  dealerCards: [],
  isDealing: false,
  totalDealt: 0,
});

export const DealAnimationProvider = DealAnimationContext.Provider;
export const useDealAnimationContext = () => useContext(DealAnimationContext);

// ─── The main hook (call once in App, provide via context) ───────────────────

export function useDealAnimation(): DealAnimationState {
  const tableState = useGameStore((s) => s.tableState);
  const phase = useGameStore(selectPhase);
  const serverDealerCards = useGameStore(selectDealerCards);

  const [displayPlayerCards, setDisplayPlayerCards] = useState<Map<string, Card[][]>>(new Map());
  const [displayDealerCards, setDisplayDealerCards] = useState<Card[]>([]);
  const [isDealing, setIsDealing] = useState(false);
  const [totalDealt, setTotalDealt] = useState(0);

  const timeoutsRef = useRef<number[]>([]);
  const prevPhaseRef = useRef<string | null>(null);
  const dealtRoundRef = useRef<number>(-1);

  // Cleanup on unmount
  useEffect(() => () => {
    timeoutsRef.current.forEach(clearTimeout);
  }, []);

  // Build the full server state of player cards
  const serverPlayerCards = useMemo(() => {
    const map = new Map<string, Card[][]>();
    if (!tableState) return map;
    for (const p of tableState.players) {
      if (p.hands.length > 0) {
        map.set(p.id, p.hands.map((h) => [...h.cards]));
      }
    }
    return map;
  }, [tableState]);

  const roundNumber = tableState?.roundNumber ?? -1;

  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = phase;

    // ─── Detect initial deal transition ───────────────────────────────
    // The deal happens when phase transitions INTO a playing state
    // (PLAYER_TURN, INSURANCE_OFFERED, DEALING, DEALER_TURN, SETTLEMENT)
    // from a non-playing state (LOBBY, BETTING), and there are cards.

    const isPlayingPhase = phase === 'PLAYER_TURN' || phase === 'INSURANCE_OFFERED' ||
      phase === 'DEALING' || phase === 'DEALER_TURN' || phase === 'SETTLEMENT';
    const wasPreDeal = prevPhase === null || prevPhase === 'LOBBY' || prevPhase === 'BETTING';

    const hasPlayerCards = serverPlayerCards.size > 0;
    const hasDealerCards = serverDealerCards.length > 0;

    // Only animate if this is a NEW round we haven't animated yet
    if (isPlayingPhase && wasPreDeal && hasPlayerCards && hasDealerCards && dealtRoundRef.current !== roundNumber) {
      dealtRoundRef.current = roundNumber;

      // Clear any pending animations
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];

      // Start with empty display
      const emptyPlayerMap = new Map<string, Card[][]>();
      for (const [pid, hands] of serverPlayerCards) {
        emptyPlayerMap.set(pid, hands.map(() => []));
      }
      setDisplayPlayerCards(emptyPlayerMap);
      setDisplayDealerCards([]);
      setIsDealing(true);
      setTotalDealt(0);

      // Build the dealing sequence
      // DDM: 1 card to each player hand, then dealer upcard, then dealer hole card
      type DealStep =
        | { type: 'player'; playerId: string; handIdx: number; card: Card }
        | { type: 'dealer'; card: Card };
      const sequence: DealStep[] = [];

      // Player cards: each player hand gets its first card
      const playerOrder = tableState?.players.filter((p) => p.hands.length > 0) ?? [];
      for (const p of playerOrder) {
        const hands = serverPlayerCards.get(p.id);
        if (!hands) continue;
        for (let hi = 0; hi < hands.length; hi++) {
          if (hands[hi].length > 0) {
            sequence.push({ type: 'player', playerId: p.id, handIdx: hi, card: hands[hi][0] });
          }
        }
      }

      // Dealer cards
      for (const card of serverDealerCards) {
        sequence.push({ type: 'dealer', card });
      }

      // Schedule each card
      let delay = PRE_DEAL_PAUSE;
      for (const step of sequence) {
        delay += DEAL_INTERVAL;

        if (step.type === 'player') {
          const { playerId, handIdx, card } = step;
          const t = window.setTimeout(() => {
            setDisplayPlayerCards((prev) => {
              const next = new Map(prev);
              const hands = next.get(playerId);
              if (hands) {
                const updated = [...hands];
                updated[handIdx] = [...(updated[handIdx] || []), card];
                next.set(playerId, updated);
              }
              return next;
            });
            setTotalDealt((n) => n + 1);
          }, delay);
          timeoutsRef.current.push(t);
        } else {
          const { card } = step;
          const t = window.setTimeout(() => {
            setDisplayDealerCards((prev) => [...prev, card]);
            setTotalDealt((n) => n + 1);
          }, delay);
          timeoutsRef.current.push(t);
        }
      }

      // Final: sync to full server state and end animation
      delay += POST_DEAL_SETTLE;
      const finalT = window.setTimeout(() => {
        setDisplayPlayerCards(serverPlayerCards);
        setDisplayDealerCards(serverDealerCards);
        setIsDealing(false);
      }, delay);
      timeoutsRef.current.push(finalT);

      return;
    }

    // ─── No animation needed — sync immediately ─────────────────────
    if (!isDealing) {
      setDisplayPlayerCards(serverPlayerCards);
      setDisplayDealerCards(serverDealerCards);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, serverPlayerCards, serverDealerCards, roundNumber]);

  // When cards reset (new round), clear display
  useEffect(() => {
    if (phase === 'BETTING' || phase === 'LOBBY') {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
      setDisplayPlayerCards(new Map());
      setDisplayDealerCards([]);
      setIsDealing(false);
      setTotalDealt(0);
      dealtRoundRef.current = -1;
    }
  }, [phase]);

  return { playerCards: displayPlayerCards, dealerCards: displayDealerCards, isDealing, totalDealt };
}
