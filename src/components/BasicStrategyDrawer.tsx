// ─── Basic Strategy Drawer ─────────────────────────────────────────────────────

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, selectMyPlayer, selectIsMyTurn, selectDealerCards } from '../hooks/useGameState';
import { evaluateHand } from '../engine/deck';
import type { Card, Rank } from '../engine/deck';

// ─── Strategy Data ───────────────────────────────────────────────────────────

type Action = 'H' | 'S' | 'D';

const DEALER_COLS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'] as const;

// Hard totals — rows keyed by player total string
const HARD_ROWS: { label: string; actions: Action[] }[] = [
  { label: '2',   actions: ['H','H','H','H','D','D','H','H','H','H'] },
  { label: '3',   actions: ['H','H','H','H','D','H','H','H','H','H'] },
  { label: '4',   actions: ['H','H','H','H','H','H','H','H','H','H'] },
  { label: '5',   actions: ['H','H','H','H','H','H','H','H','H','H'] },
  { label: '6',   actions: ['H','H','H','H','H','H','H','H','H','H'] },
  { label: '7',   actions: ['H','H','H','H','H','H','H','H','H','H'] },
  { label: '8',   actions: ['H','H','H','D','D','D','H','H','H','H'] },
  { label: '9',   actions: ['H','D','D','D','D','D','D','H','H','H'] },
  { label: '10',  actions: ['D','D','D','D','D','D','D','D','H','H'] },
  { label: '11',  actions: ['D','D','D','D','D','D','D','D','D','D'] },
  { label: '12',  actions: ['H','H','H','S','S','H','H','H','H','H'] },
  { label: '13',  actions: ['H','S','S','S','S','H','H','H','H','H'] },
  { label: '14',  actions: ['S','S','S','S','S','H','H','H','H','H'] },
  { label: '15',  actions: ['S','S','S','S','S','H','H','H','H','H'] },
  { label: '16',  actions: ['S','S','S','S','S','H','H','H','H','H'] },
  { label: '17+', actions: ['S','S','S','S','S','S','S','S','S','S'] },
];

// Soft totals (hand includes an Ace counted as 11)
const SOFT_ROWS: { label: string; actions: Action[] }[] = [
  { label: '12',  actions: ['H','D','D','D','D','D','D','H','H','H'] },
  { label: '13',  actions: ['H','H','D','D','D','D','H','H','H','H'] },
  { label: '14',  actions: ['H','H','D','D','D','H','H','H','H','H'] },
  { label: '15',  actions: ['H','H','H','H','D','H','H','H','H','H'] },
  { label: '16',  actions: ['H','H','H','H','H','H','H','H','H','H'] },
  { label: '17',  actions: ['H','H','H','D','D','D','H','H','H','H'] },
  { label: '18',  actions: ['S','S','S','D','D','S','H','H','H','H'] },
  { label: '19+', actions: ['S','S','S','S','S','S','S','S','S','S'] },
];

// ─── Cell Color Helpers ──────────────────────────────────────────────────────

function cellBg(action: Action): string {
  switch (action) {
    case 'H': return 'bg-rose-500/80';
    case 'D': return 'bg-blue-500/80';
    case 'S': return 'bg-amber-400/80';
  }
}

function cellText(action: Action): string {
  switch (action) {
    case 'H': return 'text-white font-bold';
    case 'D': return 'text-white font-bold';
    case 'S': return 'text-charcoal font-bold';
  }
}

// ─── Helpers: Map hand state → chart coordinates ────────────────────────────

function dealerRankToColIndex(rank: Rank): number {
  // DEALER_COLS: ['2','3','4','5','6','7','8','9','10','A']
  if (rank === 'A') return 9;
  if (rank === 'K' || rank === 'Q' || rank === 'J') return 8; // 10-value
  return parseInt(rank, 10) - 2; // '2'→0, '3'→1, etc.
}

function findHardRowIndex(total: number): number {
  // HARD_ROWS labels: '2'..'16', '17+'
  if (total >= 17) return HARD_ROWS.length - 1; // '17+'
  for (let i = 0; i < HARD_ROWS.length; i++) {
    if (HARD_ROWS[i].label === String(total)) return i;
  }
  return -1;
}

function findSoftRowIndex(total: number): number {
  // SOFT_ROWS labels: '12'..'18', '19+'
  if (total >= 19) return SOFT_ROWS.length - 1; // '19+'
  for (let i = 0; i < SOFT_ROWS.length; i++) {
    if (SOFT_ROWS[i].label === String(total)) return i;
  }
  return -1;
}

// ─── Strategy Table Component ────────────────────────────────────────────────

function StrategyTable({
  title,
  rows,
  activeRow,
  activeCol,
}: {
  title: string;
  rows: { label: string; actions: Action[] }[];
  activeRow: number; // -1 if none
  activeCol: number; // -1 if none
}) {
  return (
    <div>
      <h3 className="text-gold font-bold text-sm uppercase tracking-wider mb-2 font-[Georgia]">
        {title}
      </h3>
      <div className="overflow-x-auto rounded-lg border border-charcoal-lighter">
        <table className="w-full border-collapse text-[11px] sm:text-xs">
          <thead>
            <tr>
              <th className="bg-charcoal-lighter text-cream/60 px-2 py-1.5 text-left font-bold border-b border-charcoal-lighter sticky left-0 z-10 min-w-[36px]">
                {title.includes('Hard') ? 'Hard' : 'Soft'}
              </th>
              {DEALER_COLS.map((col, ci) => (
                <th
                  key={col}
                  className={`px-1.5 py-1.5 text-center font-bold border-b border-charcoal-lighter min-w-[28px] transition-colors duration-200
                    ${activeCol === ci && activeRow >= 0
                      ? 'bg-gold/30 text-gold'
                      : 'bg-charcoal-lighter text-cream/60'
                    }`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const isActiveRow = ri === activeRow;
              return (
                <tr key={row.label}>
                  <td className={`px-2 py-1 font-bold border-b border-charcoal-lighter/50 sticky left-0 z-10 transition-colors duration-200
                    ${isActiveRow && activeCol >= 0
                      ? 'bg-gold/30 text-gold'
                      : 'bg-charcoal-lighter/80 text-cream/80'
                    }`}>
                    {row.label}
                  </td>
                  {row.actions.map((action, ci) => {
                    const isHighlighted = isActiveRow && ci === activeCol;
                    return (
                      <td
                        key={ci}
                        className={`px-1.5 py-1 text-center border-b border-charcoal-lighter/30 transition-all duration-200
                          ${cellBg(action)} ${cellText(action)}
                          ${isHighlighted ? 'ring-2 ring-gold ring-inset scale-110 z-20 relative shadow-[0_0_12px_rgba(212,168,67,0.6)]' : ''}
                        `}
                      >
                        {action}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function BasicStrategyDrawer() {
  const show = useGameStore((s) => s.showStrategy);
  const toggle = useGameStore((s) => s.toggleStrategy);
  const isMyTurn = useGameStore(selectIsMyTurn);
  const myPlayer = useGameStore(selectMyPlayer);
  const dealerCards = useGameStore(selectDealerCards);
  const tableState = useGameStore((s) => s.tableState);

  // Determine the active chart cell based on current hand state
  const highlight = useMemo(() => {
    if (!isMyTurn || !myPlayer || !dealerCards.length || !tableState) {
      return { hardRow: -1, hardCol: -1, softRow: -1, softCol: -1 };
    }

    const activeHandIdx = tableState.activeHandIndex ?? 0;
    const hand = myPlayer.hands[activeHandIdx];
    if (!hand || hand.cards.length === 0) {
      return { hardRow: -1, hardCol: -1, softRow: -1, softCol: -1 };
    }

    // Evaluate the player's current hand
    const handVal = evaluateHand(hand.cards);

    // Find dealer upcard (first face-up card)
    const dealerUpcard = dealerCards.find((c: Card) => c.faceUp);
    if (!dealerUpcard) {
      return { hardRow: -1, hardCol: -1, softRow: -1, softCol: -1 };
    }

    const colIdx = dealerRankToColIndex(dealerUpcard.rank);

    if (handVal.isSoft) {
      // Soft hand — highlight in soft table
      const softIdx = findSoftRowIndex(handVal.best);
      return { hardRow: -1, hardCol: -1, softRow: softIdx, softCol: colIdx };
    } else {
      // Hard hand — highlight in hard table
      const hardIdx = findHardRowIndex(handVal.best);
      return { hardRow: hardIdx, hardCol: colIdx, softRow: -1, softCol: -1 };
    }
  }, [isMyTurn, myPlayer, dealerCards, tableState]);

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggle}
          />

          {/* Drawer Panel */}
          <motion.div
            className="fixed right-0 top-0 h-full w-full sm:w-[440px] bg-charcoal border-l border-charcoal-lighter z-50 flex flex-col shadow-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-charcoal-lighter shrink-0">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <h2 className="text-gold font-bold text-lg font-[Georgia]">Basic Strategy</h2>
              </div>
              <button
                onClick={toggle}
                className="text-cream/40 hover:text-cream transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Active hand indicator */}
              {isMyTurn && (highlight.hardRow >= 0 || highlight.softRow >= 0) && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 bg-gold/10 border border-gold/30 rounded-lg px-3 py-2"
                >
                  <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
                  <span className="text-gold text-xs font-medium">
                    Your current hand is highlighted below
                  </span>
                </motion.div>
              )}

              {/* Explanation */}
              <div className="text-cream/50 text-xs leading-relaxed">
                <p className="mb-2">
                  Optimal play for <span className="text-gold font-bold">Double Down Madness</span> based
                  on your hand total vs. the dealer's upcard.
                </p>
                <p>
                  In DDM, the player starts with <span className="text-cream/80">1 card</span> and the
                  dealer starts with <span className="text-cream/80">2 cards</span>. The player can
                  re-double unlimited times.
                </p>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-rose-500/80 flex items-center justify-center text-white text-[10px] font-bold">H</div>
                  <span className="text-cream/50 text-[11px]">Hit</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-amber-400/80 flex items-center justify-center text-charcoal text-[10px] font-bold">S</div>
                  <span className="text-cream/50 text-[11px]">Stand</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-blue-500/80 flex items-center justify-center text-white text-[10px] font-bold">D</div>
                  <span className="text-cream/50 text-[11px]">Double</span>
                </div>
              </div>

              {/* Hard Totals Table */}
              <StrategyTable
                title="Hard Totals"
                rows={HARD_ROWS}
                activeRow={highlight.hardRow}
                activeCol={highlight.hardCol}
              />

              {/* Soft Totals Table */}
              <StrategyTable
                title="Soft Totals"
                rows={SOFT_ROWS}
                activeRow={highlight.softRow}
                activeCol={highlight.softCol}
              />

              {/* Footer Note */}
              <div className="text-cream/30 text-[10px] leading-relaxed border-t border-charcoal-lighter pt-4">
                <p className="mb-1">
                  <span className="text-cream/50 font-bold">Note:</span> This strategy accounts for DDM-specific rules
                  including Push 22, dealer hits soft 17, and unlimited re-doubling.
                </p>
                <p>
                  Row labels indicate your current hand total. Column headers indicate the dealer's face-up card.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
