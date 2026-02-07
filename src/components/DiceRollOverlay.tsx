// ─── Dice Roll Overlay — Dealer Selection Animation ───────────────────────────

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../hooks/useGameState';
import { useSound } from '../hooks/useSound';

// ─── Dice Face SVG ───────────────────────────────────────────────────────────

const DOT_POSITIONS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
};

function DiceFace({ value, size = 80 }: { value: number; size?: number }) {
  const dots = DOT_POSITIONS[value] || [];
  return (
    <div
      className="rounded-xl bg-white shadow-2xl border-2 border-cream/20 flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" width={size * 0.8} height={size * 0.8}>
        {dots.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={9} fill="#1a1a2e" />
        ))}
      </svg>
    </div>
  );
}

// ─── Timing Constants ────────────────────────────────────────────────────────

const TUMBLE_DURATION = 1800;    // How long dice tumble (ms)
const TUMBLE_INTERVAL = 80;      // How often dice faces change during tumble
const RESULT_PAUSE = 800;        // Pause after dice land before showing result
const HIGHLIGHT_DURATION = 1800; // How long the selected player glows

// ─── Component ───────────────────────────────────────────────────────────────

export default function DiceRollOverlay() {
  const diceRoll = useGameStore((s) => s.diceRoll);
  const myPlayerId = useGameStore((s) => s.myPlayerId);
  const { play } = useSound();

  const [phase, setPhase] = useState<'idle' | 'tumbling' | 'landed' | 'result' | 'done'>('idle');
  const [tumbleFaces, setTumbleFaces] = useState<[number, number]>([1, 1]);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number[]>([]);

  // Cleanup
  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    timeoutRef.current.forEach(clearTimeout);
  }, []);

  // Start animation when diceRoll data arrives
  useEffect(() => {
    if (!diceRoll) return;

    // Start tumbling on next tick to satisfy strict hook lint rules.
    const t0 = window.setTimeout(() => {
      setPhase('tumbling');
    }, 0);
    timeoutRef.current.push(t0);

    // Rapidly change dice faces
    intervalRef.current = window.setInterval(() => {
      play('flip');
      setTumbleFaces([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ]);
    }, TUMBLE_INTERVAL);

    // After tumble duration, land on the real values
    const t1 = window.setTimeout(() => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      play('chip');
      setTumbleFaces(diceRoll.dice);
      setPhase('landed');
    }, TUMBLE_DURATION);
    timeoutRef.current.push(t1);

    // Show result after a pause
    const t2 = window.setTimeout(() => {
      play('win');
      setPhase('result');
    }, TUMBLE_DURATION + RESULT_PAUSE);
    timeoutRef.current.push(t2);

    // Mark done and clear
    const t3 = window.setTimeout(() => {
      setPhase('done');
      useGameStore.setState({ diceRoll: null });
    }, TUMBLE_DURATION + RESULT_PAUSE + HIGHLIGHT_DURATION);
    timeoutRef.current.push(t3);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      timeoutRef.current.forEach(clearTimeout);
      timeoutRef.current = [];
    };
  }, [diceRoll, play]);

  const isVisible = phase !== 'idle' && phase !== 'done';

  return (
    <AnimatePresence>
      {isVisible && diceRoll && (
        <motion.div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center gap-6">
            {/* Title */}
            <motion.h2
              className="text-gold font-bold text-xl font-[Georgia] uppercase tracking-widest"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              Rolling for Dealer
            </motion.h2>

            {/* Players Row */}
            <motion.div
              className="flex items-center gap-3 flex-wrap justify-center px-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {diceRoll.playerIds.map((pid, i) => {
                const isSelected = phase === 'result' && pid === diceRoll.selectedPlayerId;
                const isMe = pid === myPlayerId;
                return (
                  <motion.div
                    key={pid}
                    className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border-2 transition-all duration-300
                      ${isSelected
                        ? 'border-gold bg-gold/15 shadow-[0_0_30px_rgba(212,168,67,0.4)] scale-110'
                        : 'border-charcoal-lighter bg-charcoal/80'
                      }
                    `}
                    animate={isSelected ? { scale: [1, 1.12, 1.08] } : {}}
                    transition={isSelected ? { duration: 0.5, ease: 'easeOut' } : {}}
                  >
                    {/* Number badge */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                      ${isSelected ? 'bg-gold text-charcoal' : 'bg-charcoal-lighter text-cream/50'}
                    `}>
                      {i + 1}
                    </div>
                    <span className={`text-sm font-medium truncate max-w-[80px]
                      ${isSelected ? 'text-gold' : isMe ? 'text-cream' : 'text-cream/60'}
                    `}>
                      {diceRoll.playerNames[i]}
                    </span>
                    {isMe && <span className="text-cream/30 text-[9px]">(You)</span>}
                    {isSelected && (
                      <motion.span
                        className="text-gold text-[10px] font-bold uppercase tracking-wider"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                      >
                        Dealer
                      </motion.span>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Dice */}
            <div className="flex items-center gap-5 my-2">
              {[0, 1].map((dieIdx) => {
                const face = tumbleFaces[dieIdx];
                return (
                  <motion.div
                    key={dieIdx}
                    animate={
                      phase === 'tumbling'
                        ? {
                            rotate: [0, 360, 720, 1080],
                            scale: [1, 1.1, 0.95, 1.05, 1],
                          }
                        : phase === 'landed' || phase === 'result'
                          ? { rotate: 0, scale: 1 }
                          : {}
                    }
                    transition={
                      phase === 'tumbling'
                        ? { duration: TUMBLE_DURATION / 1000, ease: 'easeInOut', repeat: Infinity }
                        : { type: 'spring', stiffness: 400, damping: 15 }
                    }
                  >
                    <DiceFace value={face} size={80} />
                  </motion.div>
                );
              })}
            </div>

            {/* Total */}
            <AnimatePresence>
              {(phase === 'landed' || phase === 'result') && (
                <motion.div
                  className="flex flex-col items-center gap-1"
                  initial={{ opacity: 0, y: 10, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <span className="text-cream/40 text-xs uppercase tracking-wider">Total</span>
                  <span className="text-gold font-bold text-3xl font-[Georgia]">
                    {diceRoll.dice[0] + diceRoll.dice[1]}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Result Announcement */}
            <AnimatePresence>
              {phase === 'result' && (
                <motion.div
                  className="flex flex-col items-center gap-1 mt-2"
                  initial={{ opacity: 0, y: 15, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 250, damping: 20, delay: 0.1 }}
                >
                  <span className="text-gold font-bold text-lg font-[Georgia]">
                    {diceRoll.selectedPlayerName} is the Dealer!
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
