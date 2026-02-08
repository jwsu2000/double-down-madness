// ─── Row of Cards (Player or Dealer Hand) ─────────────────────────────────────

import Card from './Card';
import { memo } from 'react';
import { motion } from 'framer-motion';
import type { Card as CardType } from '../engine/deck';
import { evaluateHand } from '../engine/deck';

interface CardHandProps {
  cards: CardType[];
  isWinner?: boolean;
  isBust?: boolean;
  showScore?: boolean;
  label?: string;
  baseDelay?: number;
  hideEmpty?: boolean;
  blackjackExplosion?: 'none' | 'blackjack' | 'suited';
}

function CardHand({
  cards,
  isWinner,
  isBust,
  showScore = true,
  label,
  baseDelay = 0,
  hideEmpty = false,
  blackjackExplosion = 'none',
}: CardHandProps) {
  const visibleCards = cards.filter((c) => c.faceUp);
  const hand = evaluateHand(visibleCards);
  const allVisible = cards.every((c) => c.faceUp);
  const fullHand = evaluateHand(cards);

  const displayValue = allVisible
    ? fullHand.isSoft && fullHand.best <= 21
      ? `${fullHand.best}`
      : `${fullHand.best}`
    : hand.isSoft && hand.best <= 21
      ? `${hand.best}`
      : `${hand.best}`;

  const showExplosion = blackjackExplosion !== 'none' && cards.length === 2;
  const suitedBoom = blackjackExplosion === 'suited';
  const boomScale = suitedBoom ? 1.8 : 1.35;
  const flashColor = suitedBoom ? 'rgba(255, 234, 160, 1)' : 'rgba(255, 216, 110, 0.95)';
  const ringColor = suitedBoom ? 'rgba(255, 219, 115, 0.9)' : 'rgba(255, 194, 66, 0.8)';
  const sparkColor = suitedBoom ? 'rgba(255, 248, 205, 1)' : 'rgba(255, 232, 175, 0.98)';
  const sparkCount = suitedBoom ? 26 : 18;
  const sparkDistance = suitedBoom ? 190 : 150;
  const explosionKey = `${blackjackExplosion}-${cards.map((c) => `${c.suit}${c.rank}`).join('-')}`;
  const shakeX = suitedBoom ? [0, -7, 7, -6, 6, -4, 4, 0] : [0, -4, 4, -3, 3, -2, 2, 0];
  const shakeY = suitedBoom ? [0, -2, 2, -2, 2, -1, 1, 0] : [0, -1, 1, -1, 1, 0, 0, 0];
  const shakeRotate = suitedBoom ? [0, -2, 2, -1.6, 1.6, -1, 1, 0] : [0, -1, 1, -0.8, 0.8, -0.4, 0.4, 0];

  return (
    <div className="flex flex-col items-center gap-2">
      {label && (
        <span className="text-cream/50 text-xs uppercase tracking-widest">{label}</span>
      )}
      <div className="relative flex items-center justify-center min-h-[100px] sm:min-h-[130px] px-2 sm:px-4">
        <motion.div
          className="relative z-10 flex items-center justify-center"
          animate={
            showExplosion
              ? { x: shakeX, y: shakeY, rotate: shakeRotate }
              : { x: 0, y: 0, rotate: 0 }
          }
          transition={showExplosion ? { duration: suitedBoom ? 0.7 : 0.55, ease: 'easeOut' } : { duration: 0.2 }}
        >
          {cards.map((card, i) => (
            <Card
              key={`${card.suit}-${card.rank}-${i}`}
              card={card}
              index={i}
              isWinner={isWinner}
              isBust={isBust}
              delay={baseDelay + i * 0.15}
            />
          ))}
        </motion.div>
        {showExplosion && (
          <div key={explosionKey} className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center mix-blend-screen">
            <motion.div
              className="absolute rounded-full"
              style={{
                width: 185 * boomScale,
                height: 185 * boomScale,
                background: `radial-gradient(circle, ${flashColor} 0%, rgba(255, 196, 74, 0.85) 36%, rgba(255, 150, 40, 0.35) 58%, rgba(255, 110, 20, 0) 84%)`,
                filter: suitedBoom ? 'blur(6px)' : 'blur(5px)',
              }}
              initial={{ scale: 0.08, opacity: 0 }}
              animate={{ scale: [0.08, 1.25, 1.85], opacity: [0, 1, 0] }}
              transition={{ duration: suitedBoom ? 1.05 : 0.9, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute rounded-full border-[3px]"
              style={{
                width: 215 * boomScale,
                height: 145 * boomScale,
                borderColor: ringColor,
                boxShadow: `0 0 42px ${ringColor}, 0 0 86px ${ringColor}`,
              }}
              initial={{ scale: 0.35, opacity: 0 }}
              animate={{ scale: [0.35, 1.05, 1.55], opacity: [0, 1, 0] }}
              transition={{ duration: suitedBoom ? 1.2 : 1.05, ease: 'easeOut', delay: 0.03 }}
            />
            <motion.div
              className="absolute rounded-full border-2"
              style={{
                width: 255 * boomScale,
                height: 255 * boomScale,
                borderColor: 'rgba(255, 233, 176, 0.65)',
                boxShadow: '0 0 48px rgba(255, 221, 122, 0.55)',
              }}
              initial={{ scale: 0.25, opacity: 0 }}
              animate={{ scale: [0.25, 1.15, 1.7], opacity: [0, 0.95, 0] }}
              transition={{ duration: suitedBoom ? 1.15 : 1, ease: 'easeOut', delay: 0.05 }}
            />

            {Array.from({ length: sparkCount }).map((_, i) => {
              const angle = (i / sparkCount) * Math.PI * 2;
              const spread = 0.85 + (i % 3) * 0.2;
              const x = Math.cos(angle) * sparkDistance * boomScale * spread;
              const y = Math.sin(angle) * (sparkDistance * 0.62) * boomScale * spread;
              return (
                <motion.span
                  key={`spark-${i}`}
                  className="absolute rounded-full"
                  style={{
                    width: suitedBoom ? 8 : 6,
                    height: suitedBoom ? 8 : 6,
                    background: sparkColor,
                    boxShadow: `0 0 12px ${sparkColor}, 0 0 24px ${sparkColor}`,
                  }}
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0.2 }}
                  animate={{ x: [0, x], y: [0, y], opacity: [0, 1, 0], scale: [0.2, 1.15, 0.55] }}
                  transition={{
                    duration: suitedBoom ? 1.22 : 1.02,
                    ease: 'easeOut',
                    delay: i * 0.008,
                  }}
                />
              );
            })}

            <motion.div
              className="absolute -top-5 sm:-top-7 px-3 py-1 rounded-full border border-gold-light/70 bg-charcoal/75 text-gold-light text-[10px] sm:text-xs font-black tracking-[0.18em]"
              initial={{ opacity: 0, y: 6, scale: 0.88 }}
              animate={{ opacity: [0, 1, 1, 0], y: [6, 0, 0, -4], scale: [0.88, 1, 1, 0.96] }}
              transition={{ duration: suitedBoom ? 1.3 : 1.05, times: [0, 0.18, 0.72, 1] }}
            >
              {suitedBoom ? 'SUITED BLACKJACK 2:1' : 'BLACKJACK'}
            </motion.div>
          </div>
        )}
        {cards.length === 0 && !hideEmpty && (
          <div className="w-[62px] h-[90px] sm:w-[90px] sm:h-[130px] rounded-lg border-2 border-dashed border-cream/10 flex items-center justify-center">
            <span className="text-cream/20 text-xs">No cards</span>
          </div>
        )}
        {cards.length === 0 && hideEmpty && (
          <div className="w-[62px] h-[90px] sm:w-[90px] sm:h-[130px]" />
        )}
      </div>
      {showScore && cards.length > 0 && visibleCards.length > 0 && (
        <div
          className={`px-3 py-1 rounded-full text-sm font-bold
            ${isBust ? 'bg-casino-red/20 text-casino-red' : ''}
            ${isWinner ? 'bg-gold/20 text-gold' : ''}
            ${!isBust && !isWinner ? 'bg-charcoal-lighter text-cream' : ''}
          `}
        >
          {fullHand.isBust && allVisible
            ? `BUST (${displayValue})`
            : displayValue}
        </div>
      )}
    </div>
  );
}

function sameCards(a: CardType[], b: CardType[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].rank !== b[i].rank ||
      a[i].suit !== b[i].suit ||
      a[i].faceUp !== b[i].faceUp
    ) {
      return false;
    }
  }
  return true;
}

function areEqual(prev: CardHandProps, next: CardHandProps): boolean {
  return (
    prev.isWinner === next.isWinner &&
    prev.isBust === next.isBust &&
    prev.showScore === next.showScore &&
    prev.label === next.label &&
    prev.baseDelay === next.baseDelay &&
    prev.hideEmpty === next.hideEmpty &&
    prev.blackjackExplosion === next.blackjackExplosion &&
    sameCards(prev.cards, next.cards)
  );
}

export default memo(CardHand, areEqual);
