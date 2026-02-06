// ─── Row of Cards (Player or Dealer Hand) ─────────────────────────────────────

import Card from './Card';
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
}

export default function CardHand({
  cards,
  isWinner,
  isBust,
  showScore = true,
  label,
  baseDelay = 0,
  hideEmpty = false,
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

  return (
    <div className="flex flex-col items-center gap-2">
      {label && (
        <span className="text-cream/50 text-xs uppercase tracking-widest">{label}</span>
      )}
      <div className="flex items-center justify-center min-h-[130px] px-4">
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
