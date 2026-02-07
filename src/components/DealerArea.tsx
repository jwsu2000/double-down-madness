// ─── Dealer Area — Multiplayer (with Deal Animation + Sweat Reveal) ───────────
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import CardHand from './CardHand';
import { useGameStore, selectPhase, selectDealerCards } from '../hooks/useGameState';
import { useDealAnimationContext } from '../hooks/useDealAnimation';
import { useSound } from '../hooks/useSound';
import { evaluateHand } from '../engine/deck';
import type { Card as CardType } from '../engine/deck';
import { DEALER_EMOTE_OPTIONS } from '../shared/protocol';

// ─── Sweat Reveal Timing Constants ──────────────────────────────────────────

const HOLE_FLIP_DELAY = 1000;   // Suspense before flipping the hole card
const POST_FLIP_PAUSE = 700;    // Pause to let player read the hole card value
const NEW_CARD_DELAY = 1000;    // Time between each new drawn card
const FINAL_SETTLE_DELAY = 400; // Grace period before showing results
const DEALER_EMOTE_GLYPHS = new Map(
  DEALER_EMOTE_OPTIONS.map((option) => [option.kind, option.glyph]),
);

export default function DealerArea() {
  const serverCards = useGameStore(selectDealerCards);
  const phase = useGameStore(selectPhase);
  const tableState = useGameStore((s) => s.tableState);
  const setAnimating = useGameStore((s) => s.setAnimating);
  const dealerEmote = useGameStore((s) => s.dealerEmote);
  const { play } = useSound();

  // Deal animation context (stages cards one-by-one during initial deal)
  const { dealerCards: animatedDealerCards, isDealing } = useDealAnimationContext();

  const [displayCards, setDisplayCards] = useState<CardType[]>([]);
  const [isRevealing, setIsRevealing] = useState(false);
  const prevServerRef = useRef<CardType[]>([]);
  const timeoutsRef = useRef<number[]>([]);
  const isRevealingRef = useRef(false);

  // Cleanup timeouts on unmount
  useEffect(() => () => {
    timeoutsRef.current.forEach(clearTimeout);
  }, []);

  // ─── During deal animation, display comes from the context ──────────────
  useEffect(() => {
    if (isDealing) {
      setDisplayCards(animatedDealerCards);
    }
  }, [isDealing, animatedDealerCards]);

  // ─── Sweat Reveal Logic (for settlement phase) ─────────────────────────
  useEffect(() => {
    // Don't interfere during deal animation
    if (isDealing) return;

    const prev = prevServerRef.current;
    prevServerRef.current = serverCards;

    // Clear any pending reveal timeouts
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    // ─── Fast / Immediate Cases ─────────────────────────────────────────

    // No cards (new round reset)
    if (serverCards.length === 0) {
      setDisplayCards([]);
      if (isRevealingRef.current) {
        isRevealingRef.current = false;
        setIsRevealing(false);
        setAnimating(false);
      }
      return;
    }

    // Fewer cards than before (shouldn't happen, but safety)
    if (serverCards.length < prev.length) {
      setDisplayCards(serverCards);
      if (isRevealingRef.current) {
        isRevealingRef.current = false;
        setIsRevealing(false);
        setAnimating(false);
      }
      return;
    }

    // Initial deal (prev was empty — cards just appeared)
    // Let the deal animation handle this instead
    if (prev.length === 0) {
      setDisplayCards(serverCards);
      return;
    }

    // ─── Detect Reveal Changes ─────────────────────────────────────────

    const holeFlipIndex = prev.findIndex(
      (c, i) => !c.faceUp && serverCards[i]?.faceUp
    );
    const newCardCount = serverCards.length - prev.length;

    // Nothing to animate — just sync
    if (holeFlipIndex === -1 && newCardCount <= 0) {
      setDisplayCards(serverCards);
      return;
    }

    // ─── SWEAT REVEAL ──────────────────────────────────────────────────

    isRevealingRef.current = true;
    setIsRevealing(true);
    setAnimating(true);

    // Start by holding the current display state
    setDisplayCards(prev);

    let delay = 0;

    // Step 1: Flip the hole card with a dramatic pause
    if (holeFlipIndex !== -1) {
      delay += HOLE_FLIP_DELAY;
      const flipT = window.setTimeout(() => {
        play('flip');
        setDisplayCards((cards) =>
          cards.map((c, i) =>
            i === holeFlipIndex ? { ...c, faceUp: true } : c
          )
        );
      }, delay);
      timeoutsRef.current.push(flipT);

      delay += POST_FLIP_PAUSE;
    }

    // Step 2+: Add each new drawn card one at a time
    for (let i = 0; i < newCardCount; i++) {
      delay += NEW_CARD_DELAY;
      const cardIndex = prev.length + i;
      const newCard = serverCards[cardIndex];
      const t = window.setTimeout(() => {
        play('deal');
        setDisplayCards((cards) => [...cards, newCard]);
      }, delay);
      timeoutsRef.current.push(t);
    }

    // Final: sync to server state & stop animating
    delay += FINAL_SETTLE_DELAY;
    const finalT = window.setTimeout(() => {
      setDisplayCards(serverCards);
      isRevealingRef.current = false;
      setIsRevealing(false);
      setAnimating(false);
    }, delay);
    timeoutsRef.current.push(finalT);

  }, [serverCards, setAnimating, isDealing, play]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  const dealerCards = displayCards;
  const allRevealed = dealerCards.every((c) => c.faceUp);
  const hand = evaluateHand(
    allRevealed ? dealerCards : dealerCards.filter((c) => c.faceUp)
  );

  const isWinner =
    phase === 'SETTLEMENT' &&
    !isRevealing &&
    tableState?.settlement !== null &&
    tableState?.settlement !== undefined &&
    tableState.settlement.every(
      (r) => r.result === 'DEALER_WIN' || r.result === 'DEALER_BLACKJACK'
    );
  const isBust = allRevealed && hand.isBust;
  const emoteText = dealerEmote ? (DEALER_EMOTE_GLYPHS.get(dealerEmote.emote) ?? dealerEmote.emote) : '';

  return (
    <div className="flex flex-col items-center">
      {dealerEmote && (
        <motion.div
          key={dealerEmote.timestamp}
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -6], scale: [0.9, 1, 1, 0.95] }}
          transition={{ duration: 2.6, times: [0, 0.15, 0.8, 1] }}
          className="mb-1 px-3 py-1.5 rounded-full bg-gold/15 border border-gold/30 text-gold text-sm font-bold"
        >
          {dealerEmote.playerName}: {emoteText}
        </motion.div>
      )}
      <CardHand
        cards={dealerCards}
        isWinner={isWinner && phase === 'SETTLEMENT'}
        isBust={isBust && phase === 'SETTLEMENT'}
        showScore={dealerCards.length > 0}
        label="Dealer"
        baseDelay={0}
        hideEmpty={isDealing}
      />
    </div>
  );
}
