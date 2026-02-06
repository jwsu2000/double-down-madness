// ─── Chip-Flying Win Animation — Multiplayer ──────────────────────────────────

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, selectPhase } from '../hooks/useGameState';
import CasinoChip from './CasinoChip';
import type { ChipValue } from '../engine/rules';

interface FlyingChip {
  id: number;
  x: number;
  delay: number;
  value: ChipValue;
  size: number;
}

const CHIP_VALUES: ChipValue[] = [1, 5, 25, 100, 500];

export default function WinChipsAnimation() {
  const phase = useGameStore(selectPhase);
  const tableState = useGameStore((s) => s.tableState);
  const myPlayerId = useGameStore((s) => s.myPlayerId);
  const [chips, setChips] = useState<FlyingChip[]>([]);

  const mySettlement = tableState?.settlement?.find((s) => s.playerId === myPlayerId);
  const isWin = phase === 'SETTLEMENT' && mySettlement && mySettlement.payout > 0;

  useEffect(() => {
    if (isWin && mySettlement) {
      const isBJ = mySettlement.result.includes('BLACKJACK') && mySettlement.result !== 'DEALER_BLACKJACK';
      const chipCount = isBJ ? 16 : 8;
      const newChips: FlyingChip[] = Array.from({ length: chipCount }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 280,
        delay: Math.random() * 0.35,
        value: CHIP_VALUES[Math.floor(Math.random() * CHIP_VALUES.length)],
        size: 28 + Math.random() * 16,
      }));
      setChips(newChips);
    } else {
      setChips([]);
    }
  }, [isWin, mySettlement]);

  return (
    <AnimatePresence>
      {isWin && chips.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-[55] overflow-hidden">
          {chips.map((chip) => (
            <motion.div
              key={chip.id}
              className="absolute"
              style={{ left: '50%', top: '55%' }}
              initial={{ x: 0, y: 0, scale: 0.3, opacity: 0, rotate: 0 }}
              animate={{
                x: chip.x,
                y: -window.innerHeight * 0.55,
                scale: [0.3, 1.1, 0.7],
                opacity: [0, 1, 1, 0],
                rotate: Math.random() > 0.5 ? 360 : -360,
              }}
              transition={{
                duration: 1.2,
                delay: chip.delay,
                ease: [0.22, 1, 0.36, 1],
                opacity: { duration: 1.2, times: [0, 0.1, 0.7, 1] },
                scale: { duration: 1.2, times: [0, 0.3, 1] },
              }}
            >
              <CasinoChip value={chip.value} size={Math.round(chip.size)} />
            </motion.div>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
