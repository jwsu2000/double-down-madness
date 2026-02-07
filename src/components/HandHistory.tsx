// â”€â”€â”€ Hand History Drawer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, type HandRecord, type PlayerHandEntry, type PlayerHandEntryHand } from '../hooks/useGameState';
import type { Card } from '../engine/deck';
import { evaluateHand } from '../engine/deck';
import { nextDoubleWager } from '../engine/rules';

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const suitSymbols: Record<string, string> = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

function cardStr(c: Card): string {
  return `${c.rank}${suitSymbols[c.suit] ?? ''}`;
}

function isRed(c: Card): boolean {
  return c.suit === 'hearts' || c.suit === 'diamonds';
}

function resultColor(result: string): string {
  if (
    result === 'PLAYER_WIN' ||
    result === 'PLAYER_BLACKJACK' ||
    result === 'PLAYER_BLACKJACK_SUITED'
  )
    return 'text-casino-green';
  if (result === 'DEALER_WIN' || result === 'DEALER_BLACKJACK') return 'text-casino-red';
  return 'text-blue-300';
}

function payoutStr(payout: number): string {
  if (payout > 0) return `+$${payout.toLocaleString()}`;
  if (payout < 0) return `-$${Math.abs(payout).toLocaleString()}`;
  return '$0';
}

function timeStr(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function roundBorderColor(result: string): string {
  if (
    result === 'PLAYER_WIN' ||
    result === 'PLAYER_BLACKJACK' ||
    result === 'PLAYER_BLACKJACK_SUITED'
  )
    return 'border-casino-green/25';
  if (result === 'DEALER_WIN' || result === 'DEALER_BLACKJACK') return 'border-casino-red/25';
  return 'border-blue-400/25';
}

// â”€â”€â”€ Cards Row Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function CardsRow({ cards }: { cards: Card[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {cards.map((c, i) => (
        <span
          key={i}
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-bold ${
            isRed(c) ? 'text-red-400' : 'text-cream'
          } bg-navy/80`}
        >
          {cardStr(c)}
        </span>
      ))}
    </div>
  );
}

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function HandHistory() {
  const show = useGameStore((s) => s.showHistory);
  const toggle = useGameStore((s) => s.toggleHistory);
  const history = useGameStore((s) => s.handHistory);

  const reversed = [...history].reverse();

  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggle}
          />
          <motion.div
            className="fixed left-0 top-0 bottom-0 w-full max-w-lg bg-charcoal border-r border-charcoal-lighter z-50 overflow-y-auto"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gold/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-gold font-bold text-lg font-[Georgia]">Hand History</h2>
                    <span className="text-cream/30 text-[10px]">
                      {history.length} round{history.length !== 1 ? 's' : ''} this session
                    </span>
                  </div>
                </div>
                <button
                  onClick={toggle}
                  className="text-cream/50 hover:text-cream p-1 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Summary bar (my stats) */}
              {history.length > 0 && <SummaryBar history={history} />}

              {/* Hand list */}
              {reversed.length === 0 ? (
                <div className="mt-8 text-center">
                  <div className="text-cream/20 text-4xl mb-3">&#127183;</div>
                  <p className="text-cream/40 text-sm">No hands played yet.</p>
                  <p className="text-cream/25 text-xs mt-1">
                    Complete a round to see the history here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 mt-4">
                  {reversed.map((hand, i) => (
                    <RoundCard
                      key={`${hand.roundNumber}-${hand.timestamp}`}
                      hand={hand}
                      index={reversed.length - i}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// â”€â”€â”€ Summary Bar (my personal stats) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SummaryBar({ history }: { history: HandRecord[] }) {
  const hasPersonalHands = history.some((record) => record.players.some((p) => p.isMe));
  const modeLabel = hasPersonalHands ? 'Your Stats' : 'Table Stats';

  // Count per-hand results for accuracy across multi-hand play.
  let wins = 0;
  let losses = 0;
  let pushes = 0;
  let push22s = 0;
  let totalHands = 0;
  let totalPayout = 0;

  for (const record of history) {
    const sources = hasPersonalHands ? record.players.filter((p) => p.isMe) : record.players;
    for (const entry of sources) {
      totalPayout += entry.totalPayout;
      for (const hand of entry.hands) {
        totalHands++;
        if (
          hand.result === 'PLAYER_WIN' ||
          hand.result === 'PLAYER_BLACKJACK' ||
          hand.result === 'PLAYER_BLACKJACK_SUITED'
        ) {
          wins++;
        } else if (hand.result === 'DEALER_WIN' || hand.result === 'DEALER_BLACKJACK') {
          losses++;
        } else if (hand.result === 'PUSH_22') {
          push22s++;
        } else {
          pushes++;
        }
      }
    }
  }

  return (
    <div className="mb-4">
      <div className="text-cream/25 text-[9px] uppercase tracking-wider mb-1.5">{modeLabel}</div>
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Hands" value={totalHands.toString()} />
        <MiniStat label="Wins" value={wins.toString()} color="text-casino-green" />
        <MiniStat label="Losses" value={losses.toString()} color="text-casino-red" />
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2">
        <MiniStat label="Push" value={pushes.toString()} color="text-blue-300" />
        <MiniStat label="Push 22" value={push22s.toString()} color="text-purple-300" />
        <MiniStat
          label="Net"
          value={payoutStr(totalPayout)}
          color={totalPayout >= 0 ? 'text-casino-green' : 'text-casino-red'}
        />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  color = 'text-cream',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-navy/60 rounded-lg p-2 text-center border border-navy">
      <div className="text-cream/30 text-[9px] uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-bold ${color}`}>{value}</div>
    </div>
  );
}

// â”€â”€â”€ Round Card (shows dealer + all players) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function RoundCard({ hand, index }: { hand: HandRecord; index: number }) {
  const myEntry = hand.players.find((p) => p.isMe);
  const tablePayout = hand.players.reduce((sum, p) => sum + p.totalPayout, 0);
  const rightLabel = myEntry ? `You: ${payoutStr(hand.myPayout)}` : `Table: ${payoutStr(tablePayout)}`;
  const borderResult = myEntry ? hand.myResult : 'TABLE_VIEW';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border bg-charcoal-light/50 overflow-hidden ${roundBorderColor(borderResult)}`}
    >
      {/* Round header */}
      <div className="flex items-center justify-between px-3 py-2 bg-navy/40 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-cream/40 text-[10px] font-mono font-bold">Round #{index}</span>
          <span className="text-cream/20 text-[10px]">{timeStr(hand.timestamp)}</span>
        </div>
        <span className={`text-[10px] font-bold ${resultColor(borderResult)}`}>
          {rightLabel}
        </span>
      </div>

      <div className="p-3 space-y-2.5">
        {/* Dealer */}
        <div className="flex items-center gap-2">
          <div className="shrink-0 w-[52px]">
            <span className="text-cream/30 text-[9px] uppercase tracking-wider font-medium">
              Dealer
            </span>
          </div>
          <CardsRow cards={hand.dealerCards} />
        </div>

        {/* Divider */}
        <div className="h-px bg-white/5" />

        {/* All Players */}
        {hand.players.map((p) => (
          <PlayerRow key={p.id} player={p} />
        ))}
      </div>
    </motion.div>
  );
}

// â”€â”€â”€ Player Row (supports multi-hand) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function PlayerRow({ player }: { player: PlayerHandEntry }) {
  const isMultiHand = player.hands.length > 1;

  return (
    <div
      className={`rounded-lg p-2 ${
        player.isMe ? 'bg-gold/5 ring-1 ring-gold/15' : ''
      }`}
    >
      {/* Name + total payout */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-cream text-[11px] font-medium truncate">
            {player.name}
          </span>
          {player.isMe && (
            <span className="text-[8px] text-gold/60 bg-gold/10 px-1 py-0.5 rounded font-medium shrink-0">
              YOU
            </span>
          )}
          {isMultiHand && (
            <span className="text-[8px] text-cream/30 shrink-0">
              x{player.hands.length}
            </span>
          )}
        </div>
        <span
          className={`text-[10px] font-bold shrink-0 ml-2 ${
            player.totalPayout > 0 ? 'text-casino-green' :
            player.totalPayout < 0 ? 'text-casino-red' : 'text-cream/40'
          }`}
        >
          {payoutStr(player.totalPayout)}
        </span>
      </div>

      {/* Hands */}
      {player.hands.map((h, hi) => (
        <HandRow key={hi} hand={h} index={hi} showLabel={isMultiHand} />
      ))}

      {/* Balance */}
      <div className="flex items-center justify-end text-[10px] mt-1">
        <span className="text-cream/25">
          Bal: <span className="text-cream/40">${player.balanceAfter.toLocaleString()}</span>
        </span>
      </div>
    </div>
  );
}

// â”€â”€â”€ Action Badge Colors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function actionBadge(type: string): { bg: string; text: string } {
  switch (type) {
    case 'DEAL': return { bg: 'bg-cream/10', text: 'text-cream/60' };
    case 'HIT':  return { bg: 'bg-blue-500/15', text: 'text-blue-300' };
    case 'DBL':  return { bg: 'bg-gold/15', text: 'text-gold' };
    case 'STAND':return { bg: 'bg-amber-400/15', text: 'text-amber-300' };
    case 'BUST': return { bg: 'bg-casino-red/15', text: 'text-casino-red' };
    case '21':   return { bg: 'bg-casino-green/15', text: 'text-casino-green' };
    case 'BJ':   return { bg: 'bg-gold/20', text: 'text-gold' };
    default:     return { bg: 'bg-cream/10', text: 'text-cream/40' };
  }
}

// â”€â”€â”€ Build Action Steps â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface ActionStep {
  label: string;        // e.g. "DEAL", "HIT", "DBL"
  card?: Card;          // the card received
  total: number;        // running hand total
  isSoft: boolean;      // whether total is soft
  isBust: boolean;      // whether this step busted
  wager?: number;       // wager for doubles
}

function buildActionSteps(hand: PlayerHandEntryHand): ActionStep[] {
  const steps: ActionStep[] = [];
  const { cards, actions, bet } = hand;

  if (cards.length === 0) return steps;

  // Step 0: initial deal
  const evalDeal = evaluateHand([cards[0]]);
  steps.push({
    label: 'DEAL',
    card: cards[0],
    total: evalDeal.best,
    isSoft: evalDeal.isSoft,
    isBust: false,
  });

  // Steps 1..n: each subsequent card, action from actions[i-1]
  let doublesSoFar = 0;
  for (let i = 1; i < cards.length; i++) {
    const cardsUpTo = cards.slice(0, i + 1);
    const evalStep = evaluateHand(cardsUpTo);
    const actionType = actions[i - 1]; // 'H' or 'D'

    const isDouble = actionType === 'D';
    let wager: number | undefined;
    if (isDouble) {
      wager = nextDoubleWager(bet, doublesSoFar);
      doublesSoFar++;
    }

    steps.push({
      label: isDouble ? 'DBL' : 'HIT',
      card: cards[i],
      total: evalStep.best,
      isSoft: evalStep.isSoft && evalStep.best <= 21,
      isBust: evalStep.isBust,
      wager,
    });
  }

  // Terminal step
  const finalEval = evaluateHand(cards);
  if (finalEval.isBust) {
    steps.push({ label: 'BUST', total: finalEval.best, isSoft: false, isBust: true });
  } else if (finalEval.best === 21 && cards.length === 2 && hand.actions.length === 0) {
    // Natural blackjack (hit to 21 with 2 cards, no doubles)
    // Already shown in the last card step
  } else if (
    !finalEval.isBust &&
    finalEval.best < 21 &&
    !(hand.cards.length === 2 && hand.cards[0].rank === 'A' && hand.actions[0] === 'D')
  ) {
    // Player stood (wasn't forced by bust/21/lone-ace-double)
    steps.push({ label: 'STAND', total: finalEval.best, isSoft: finalEval.isSoft && finalEval.best <= 21, isBust: false });
  }

  return steps;
}

// â”€â”€â”€ Single Hand Row (with action timeline) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function HandRow({ hand, index, showLabel }: { hand: PlayerHandEntryHand; index: number; showLabel: boolean }) {
  const steps = buildActionSteps(hand);

  return (
    <div className="mb-2">
      {showLabel && (
        <div className="text-[8px] text-cream/25 uppercase tracking-wider mb-0.5">
          Hand {index + 1}
        </div>
      )}

      {/* Action timeline */}
      <div className="flex flex-wrap items-center gap-1 mb-1">
        {steps.map((step, i) => {
          const badge = actionBadge(step.label);
          return (
            <div key={i} className="flex items-center gap-0.5">
              {i > 0 && <span className="text-cream/15 text-[8px] mx-0.5">&rarr;</span>}
              <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold ${badge.bg} ${badge.text}`}>
                {step.label}
                {step.wager != null && (
                  <span className="text-[8px] font-normal opacity-70">${step.wager}</span>
                )}
              </span>
              {step.card && (
                <span
                  className={`inline-flex items-center px-1 py-0.5 rounded text-[10px] font-mono font-bold ${
                    isRed(step.card) ? 'text-red-400' : 'text-cream'
                  } bg-navy/80`}
                >
                  {cardStr(step.card)}
                </span>
              )}
              {step.card && (
                <span className={`text-[9px] font-bold ${
                  step.isBust ? 'text-casino-red' :
                  step.total === 21 ? 'text-casino-green' :
                  'text-cream/40'
                }`}>
                  {step.isSoft && step.total < 21 ? `${step.total}` : step.total}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Result + payout summary */}
      <div className="flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-2">
          <span className={`font-bold uppercase tracking-wider ${resultColor(hand.result)}`}>
            {hand.resultLabel}
          </span>
          <span className="text-cream/35">
            Bet: <span className="text-cream/60">${hand.bet}</span>
            {hand.totalWager > hand.bet && (
              <span className="text-cream/30 ml-1">(total: ${hand.totalWager})</span>
            )}
          </span>
        </div>
        <span
          className={`font-bold ${
            hand.payout > 0 ? 'text-casino-green' :
            hand.payout < 0 ? 'text-casino-red' : 'text-cream/40'
          }`}
        >
          {payoutStr(hand.payout)}
        </span>
      </div>
    </div>
  );
}

