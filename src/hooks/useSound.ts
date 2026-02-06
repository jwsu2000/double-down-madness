// ─── Sound Effects Hook ───────────────────────────────────────────────────────
// Uses Web Audio API to generate simple synth sounds (no external files needed)

import { useCallback, useRef } from 'react';
import { useGameStore } from './useGameState';

type SoundType = 'deal' | 'chip' | 'win' | 'lose' | 'push' | 'blackjack' | 'flip';

export function useSound() {
  const soundEnabled = useGameStore((s) => s.soundEnabled);
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }, []);

  const play = useCallback(
    (type: SoundType) => {
      if (!soundEnabled) return;
      const ctx = getCtx();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      switch (type) {
        case 'deal': {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(800, now);
          osc.frequency.exponentialRampToValueAtTime(400, now + 0.08);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          osc.start(now);
          osc.stop(now + 0.1);
          break;
        }
        case 'chip': {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(2000, now);
          osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
          gain.gain.setValueAtTime(0.06, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
          osc.start(now);
          osc.stop(now + 0.08);
          break;
        }
        case 'flip': {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(1200, now + 0.06);
          gain.gain.setValueAtTime(0.05, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
          osc.start(now);
          osc.stop(now + 0.08);
          break;
        }
        case 'win': {
          // Happy ascending arpeggio
          [523, 659, 784].forEach((freq, i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g);
            g.connect(ctx.destination);
            o.type = 'sine';
            o.frequency.setValueAtTime(freq, now + i * 0.1);
            g.gain.setValueAtTime(0.08, now + i * 0.1);
            g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.2);
            o.start(now + i * 0.1);
            o.stop(now + i * 0.1 + 0.2);
          });
          return; // Don't start/stop the initial osc
        }
        case 'blackjack': {
          // Fanfare
          [523, 659, 784, 1047].forEach((freq, i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g);
            g.connect(ctx.destination);
            o.type = 'square';
            o.frequency.setValueAtTime(freq, now + i * 0.12);
            g.gain.setValueAtTime(0.06, now + i * 0.12);
            g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.25);
            o.start(now + i * 0.12);
            o.stop(now + i * 0.12 + 0.25);
          });
          return;
        }
        case 'lose': {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(300, now);
          osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
          gain.gain.setValueAtTime(0.06, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
          osc.start(now);
          osc.stop(now + 0.4);
          break;
        }
        case 'push': {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, now);
          gain.gain.setValueAtTime(0.05, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          osc.start(now);
          osc.stop(now + 0.2);
          break;
        }
      }
    },
    [soundEnabled, getCtx]
  );

  return { play };
}
