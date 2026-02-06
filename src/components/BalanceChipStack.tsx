// ─── Visual Chip Stack — Multiplayer ──────────────────────────────────────────

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChipDisc } from './CasinoChip';
import type { ChipValue } from '../engine/rules';
import { useGameStore, selectMyPlayer, selectPhase } from '../hooks/useGameState';

function balanceToChipStack(balance: number): ChipValue[] {
  if (balance <= 0) return [];

  let remaining = balance;
  const MAX_CHIPS = 30;

  const groups: [ChipValue, number][] = [
    [500, 0],
    [100, 0],
    [25, 0],
    [5, 0],
    [1, 0],
  ];

  for (const g of groups) {
    g[1] = Math.floor(remaining / g[0]);
    remaining -= g[1] * g[0];
  }

  const totalChips = () => groups.reduce((s, g) => s + g[1], 0);

  while (groups[0][1] > 0 && totalChips() - 1 + 20 <= MAX_CHIPS) {
    groups[0][1]--;
    groups[2][1] += 20;
  }

  while (groups[1][1] > 0 && totalChips() - 1 + 4 <= MAX_CHIPS) {
    groups[1][1]--;
    groups[2][1] += 4;
  }

  while (groups[2][1] > 0 && totalChips() - 1 + 5 <= MAX_CHIPS) {
    groups[2][1]--;
    groups[3][1] += 5;
  }

  const chips: ChipValue[] = [];
  for (const [value, count] of groups) {
    for (let i = 0; i < count; i++) chips.push(value);
  }

  return chips;
}

export default function BalanceChipStack() {
  const myPlayer = useGameStore(selectMyPlayer);
  const phase = useGameStore(selectPhase);
  const betInput = useGameStore((s) => s.betInput);

  const balance = myPlayer?.balance ?? 0;
  const hasBet = myPlayer?.hasBet ?? false;
  const displayBalance = phase === 'BETTING' && !hasBet ? balance - betInput : balance;

  const chips = useMemo(() => balanceToChipStack(Math.max(0, displayBalance)), [displayBalance]);

  if (chips.length === 0) return null;

  const DISC_HEIGHT = 4;
  const stackHeight = chips.length * DISC_HEIGHT + 10;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative"
        style={{ width: 48, height: Math.min(stackHeight, 140), overflow: 'hidden' }}
      >
        <AnimatePresence mode="popLayout">
          {chips.map((chipValue, i) => (
            <motion.div
              key={`${i}-${chipValue}`}
              className="absolute left-0"
              style={{ bottom: i * DISC_HEIGHT, zIndex: i }}
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.15, delay: Math.min(i * 0.008, 0.2) }}
            >
              <ChipDisc value={chipValue} width={48} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <span className="text-cream/40 text-[9px] uppercase tracking-wider">
        ${displayBalance.toLocaleString()}
      </span>
    </div>
  );
}
