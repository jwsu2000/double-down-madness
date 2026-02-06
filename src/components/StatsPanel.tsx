// ─── Stats Dashboard — Multiplayer (Local Session Stats) ──────────────────────

import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, selectMyBalance, selectMyBuyIn } from '../hooks/useGameState';

export default function StatsPanel() {
  const show = useGameStore((s) => s.showStats);
  const toggle = useGameStore((s) => s.toggleStats);
  const stats = useGameStore((s) => s.localStats);
  const balance = useGameStore(selectMyBalance);
  const myBuyIn = useGameStore(selectMyBuyIn);

  const winRate = stats.totalHands > 0 ? ((stats.wins / stats.totalHands) * 100).toFixed(1) : '0.0';
  const netProfit = balance - myBuyIn;

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
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-charcoal border border-charcoal-lighter rounded-2xl z-50 overflow-hidden"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-gold font-bold text-lg font-[Georgia]">Session Stats</h2>
                <button
                  onClick={toggle}
                  className="text-cream/50 hover:text-cream p-1 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Total Hands" value={stats.totalHands.toString()} />
                <StatCard label="Win Rate" value={`${winRate}%`} />
                <StatCard label="Wins" value={stats.wins.toString()} color="text-casino-green" />
                <StatCard label="Losses" value={stats.losses.toString()} color="text-casino-red" />
                <StatCard label="Pushes" value={stats.pushes.toString()} color="text-blue-300" />
                <StatCard label="Push 22" value={stats.push22s.toString()} color="text-purple-300" />
                <StatCard label="Blackjacks" value={stats.blackjacks.toString()} color="text-gold" />
                <StatCard label="Biggest Win" value={`$${stats.biggestWin}`} color="text-gold-light" />
                <StatCard label="Total Wagered" value={`$${stats.totalWagered.toLocaleString()}`} />
                <div className="col-span-2">
                  <StatCard
                    label="Net Profit"
                    value={`${netProfit >= 0 ? '+' : ''}$${netProfit.toLocaleString()}`}
                    color={netProfit >= 0 ? 'text-casino-green' : 'text-casino-red'}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function StatCard({ label, value, color = 'text-cream' }: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-charcoal-light rounded-lg p-3 border border-charcoal-lighter">
      <div className="text-cream/40 text-xs uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}
