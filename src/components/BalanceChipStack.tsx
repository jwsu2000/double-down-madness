// ─── Visual Chip Stack — Multiplayer ──────────────────────────────────────────

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChipDisc } from './CasinoChip';
import type { ChipValue } from '../engine/rules';
import { useGameStore, selectMyPlayer, selectPhase, selectChipDenominations, useDisplayBalance } from '../hooks/useGameState';

function balanceToChipStack(balance: number, denominations: number[]): ChipValue[] {
  if (balance <= 0 || denominations.length === 0) return [];

  let remaining = balance;
  const MAX_CHIPS = 30;

  // Sort denominations descending for greedy decomposition
  const sorted = [...denominations].sort((a, b) => b - a);

  const groups: [number, number][] = sorted.map((d) => [d, 0]);

  for (const g of groups) {
    g[1] = Math.floor(remaining / g[0]);
    remaining -= g[1] * g[0];
  }

  const totalChips = () => groups.reduce((s, g) => s + g[1], 0);

  // Break larger denominations into smaller ones to fill up the visual stack (up to MAX_CHIPS)
  for (let i = 0; i < groups.length - 1; i++) {
    const nextDenom = groups[i + 1][0];
    const ratio = Math.floor(groups[i][0] / nextDenom);
    if (ratio < 2) continue;
    while (groups[i][1] > 0 && totalChips() - 1 + ratio <= MAX_CHIPS) {
      groups[i][1]--;
      groups[i + 1][1] += ratio;
    }
  }

  const chips: ChipValue[] = [];
  for (const [value, count] of groups) {
    for (let j = 0; j < count; j++) chips.push(value);
  }

  return chips;
}

export default function BalanceChipStack() {
  const myPlayer = useGameStore(selectMyPlayer);
  const phase = useGameStore(selectPhase);
  const betInput = useGameStore((s) => s.betInput);
  const chipDenominations = useGameStore(selectChipDenominations);

  const balance = useDisplayBalance();
  const hasBet = myPlayer?.hasBet ?? false;
  const displayBalance = phase === 'BETTING' && !hasBet ? balance - betInput : balance;

  const chips = useMemo(
    () => balanceToChipStack(Math.max(0, displayBalance), chipDenominations),
    [displayBalance, chipDenominations],
  );

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
