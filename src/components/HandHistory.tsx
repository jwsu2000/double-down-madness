// ─── Hand History Drawer ───────────────────────────────────────────────────────

import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, type HandRecord, type PlayerHandEntry, type PlayerHandEntryHand } from '../hooks/useGameState';
import type { Card } from '../engine/deck';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Cards Row Component ──────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

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

// ─── Summary Bar (my personal stats) ──────────────────────────────────────────

function SummaryBar({ history }: { history: HandRecord[] }) {
  const totalPayout = history.reduce((sum, h) => sum + h.myPayout, 0);
  const wins = history.filter(
    (h) =>
      h.myResult === 'PLAYER_WIN' ||
      h.myResult === 'PLAYER_BLACKJACK' ||
      h.myResult === 'PLAYER_BLACKJACK_SUITED',
  ).length;
  const losses = history.filter(
    (h) => h.myResult === 'DEALER_WIN' || h.myResult === 'DEALER_BLACKJACK',
  ).length;
  const pushes = history.length - wins - losses;

  return (
    <div className="mb-4">
      <div className="text-cream/25 text-[9px] uppercase tracking-wider mb-1.5">Your Stats</div>
      <div className="grid grid-cols-4 gap-2">
        <MiniStat label="Rounds" value={history.length.toString()} />
        <MiniStat label="Wins" value={wins.toString()} color="text-casino-green" />
        <MiniStat label="Losses" value={losses.toString()} color="text-casino-red" />
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

// ─── Round Card (shows dealer + all players) ──────────────────────────────────

function RoundCard({ hand, index }: { hand: HandRecord; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border bg-charcoal-light/50 overflow-hidden ${roundBorderColor(hand.myResult)}`}
    >
      {/* Round header */}
      <div className="flex items-center justify-between px-3 py-2 bg-navy/40 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-cream/40 text-[10px] font-mono font-bold">Round #{index}</span>
          <span className="text-cream/20 text-[10px]">{timeStr(hand.timestamp)}</span>
        </div>
        <span className={`text-[10px] font-bold ${resultColor(hand.myResult)}`}>
          You: {payoutStr(hand.myPayout)}
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

// ─── Player Row (supports multi-hand) ─────────────────────────────────────────

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
              ×{player.hands.length}
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

// ─── Single Hand Row ──────────────────────────────────────────────────────────

function HandRow({ hand, index, showLabel }: { hand: PlayerHandEntryHand; index: number; showLabel: boolean }) {
  return (
    <div className="mb-1">
      {showLabel && (
        <div className="text-[8px] text-cream/25 uppercase tracking-wider mb-0.5">
          Hand {index + 1}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <CardsRow cards={hand.cards} />
        <span className={`text-[10px] font-bold uppercase tracking-wider shrink-0 ${resultColor(hand.result)}`}>
          {hand.resultLabel}
        </span>
      </div>
      <div className="flex items-center justify-between text-[10px] mt-0.5">
        <span className="text-cream/35">
          Bet: <span className="text-cream/60">${hand.bet}</span>
          {hand.totalWager > hand.bet && (
            <span className="text-cream/30 ml-1">(total: ${hand.totalWager})</span>
          )}
        </span>
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
