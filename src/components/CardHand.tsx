// ─── Row of Cards (Player or Dealer Hand) ─────────────────────────────────────

import Card from './Card';
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

export default function CardHand({
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
  const boomScale = suitedBoom ? 1.45 : 1;
  const flashColor = suitedBoom ? 'rgba(255, 220, 120, 0.95)' : 'rgba(255, 205, 95, 0.9)';
  const ringColor = suitedBoom ? 'rgba(255, 215, 90, 0.75)' : 'rgba(255, 194, 66, 0.65)';
  const sparkColor = suitedBoom ? 'rgba(255, 239, 183, 1)' : 'rgba(255, 224, 160, 0.95)';
  const sparkCount = suitedBoom ? 20 : 14;
  const sparkDistance = suitedBoom ? 135 : 98;

  return (
    <div className="flex flex-col items-center gap-2">
      {label && (
        <span className="text-cream/50 text-xs uppercase tracking-widest">{label}</span>
      )}
      <div className="relative flex items-center justify-center min-h-[130px] px-4">
        {showExplosion && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <motion.div
              className="absolute rounded-full"
              style={{
                width: 110 * boomScale,
                height: 110 * boomScale,
                background: `radial-gradient(circle, ${flashColor} 0%, rgba(255, 190, 70, 0.65) 42%, rgba(255, 160, 40, 0) 75%)`,
                filter: suitedBoom ? 'blur(5px)' : 'blur(4px)',
              }}
              initial={{ scale: 0.2, opacity: 0 }}
              animate={{ scale: [0.2, 1.25, 1.65], opacity: [0, 0.85, 0] }}
              transition={{ duration: suitedBoom ? 0.95 : 0.75, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute rounded-full border"
              style={{
                width: 145 * boomScale,
                height: 95 * boomScale,
                borderColor: ringColor,
                boxShadow: `0 0 28px ${ringColor}`,
              }}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: [0.5, 1.1, 1.35], opacity: [0, 1, 0] }}
              transition={{ duration: suitedBoom ? 1.05 : 0.85, ease: 'easeOut' }}
            />

            {Array.from({ length: sparkCount }).map((_, i) => {
              const angle = (i / sparkCount) * Math.PI * 2;
              const x = Math.cos(angle) * sparkDistance * boomScale;
              const y = Math.sin(angle) * (sparkDistance * 0.6) * boomScale;
              return (
                <motion.span
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    width: suitedBoom ? 7 : 5,
                    height: suitedBoom ? 7 : 5,
                    background: sparkColor,
                    boxShadow: `0 0 10px ${sparkColor}`,
                  }}
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                  animate={{ x: [0, x], y: [0, y], opacity: [0, 1, 0], scale: [0.4, 1, 0.7] }}
                  transition={{
                    duration: suitedBoom ? 1.1 : 0.85,
                    ease: 'easeOut',
                    delay: i * 0.01,
                  }}
                />
              );
            })}
          </div>
        )}
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
        {cards.length === 0 && !hideEmpty && (
          <div className="w-[90px] h-[130px] rounded-lg border-2 border-dashed border-cream/10 flex items-center justify-center">
            <span className="text-cream/20 text-xs">No cards</span>
          </div>
        )}
        {cards.length === 0 && hideEmpty && (
          <div className="w-[90px] h-[130px]" />
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
