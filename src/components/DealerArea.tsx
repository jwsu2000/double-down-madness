// ─── Dealer Area — Multiplayer ─────────────────────────────────────────────────

import CardHand from './CardHand';
import { useGameStore, selectPhase, selectDealerCards } from '../hooks/useGameState';
import { evaluateHand } from '../engine/deck';

export default function DealerArea() {
  const dealerCards = useGameStore(selectDealerCards);
  const phase = useGameStore(selectPhase);
  const tableState = useGameStore((s) => s.tableState);

  const allRevealed = dealerCards.every((c) => c.faceUp);
  const hand = evaluateHand(allRevealed ? dealerCards : dealerCards.filter((c) => c.faceUp));

  // Dealer wins if all players lost
  const isWinner =
    phase === 'SETTLEMENT' &&
    tableState?.settlement !== null &&
    tableState?.settlement !== undefined &&
    tableState.settlement.every(
      (r) => r.result === 'DEALER_WIN' || r.result === 'DEALER_BLACKJACK',
    );
  const isBust = allRevealed && hand.isBust;

  return (
    <div className="flex flex-col items-center">
      <CardHand
        cards={dealerCards}
        isWinner={isWinner && phase === 'SETTLEMENT'}
        isBust={isBust && phase === 'SETTLEMENT'}
        showScore={dealerCards.length > 0}
        label="Dealer"
        baseDelay={0.15}
      />
    </div>
  );
}
