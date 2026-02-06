// ─── Chip Denomination Picker — Multiplayer ───────────────────────────────────

import { motion } from 'framer-motion';
import { CHIP_DENOMINATIONS, type ChipValue } from '../engine/rules';
import { useGameStore, selectMyPlayer, selectPhase } from '../hooks/useGameState';
import { useSound } from '../hooks/useSound';
import CasinoChip from './CasinoChip';

export default function ChipSelector() {
  const addToBetInput = useGameStore((s) => s.addToBetInput);
  const myPlayer = useGameStore(selectMyPlayer);
  const betInput = useGameStore((s) => s.betInput);
  const numHands = useGameStore((s) => s.numHandsInput);
  const sideBetInput = useGameStore((s) => s.sideBetInput);
  const phase = useGameStore(selectPhase);
  const { play } = useSound();

  const balance = myPlayer?.balance ?? 0;
  const disabled = phase !== 'BETTING' || (myPlayer?.hasBet ?? false);

  return (
    <div className="flex gap-3 sm:gap-4 justify-center items-end flex-wrap">
      {CHIP_DENOMINATIONS.map((value) => {
        // Check if adding this chip would exceed balance when accounting for all hands
        const newPerHand = betInput + value;
        const canAfford = newPerHand * numHands + sideBetInput <= balance;
        const isDisabled = disabled || !canAfford;

        return (
          <motion.div
            key={value}
            whileHover={!isDisabled ? { y: -6, scale: 1.08 } : {}}
            whileTap={!isDisabled ? { scale: 0.92 } : {}}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <CasinoChip
              value={value as ChipValue}
              size={56}
              interactive
              disabled={isDisabled}
              onClick={() => {
                if (!isDisabled) {
                  addToBetInput(value);
                  play('chip');
                }
              }}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
