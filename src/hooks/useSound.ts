import { useCallback } from 'react';
import { useGameStore } from './useGameState';

type SoundType = 'deal' | 'chip' | 'win' | 'lose' | 'push' | 'blackjack' | 'flip';

type Mix = {
  dry?: number;
  reverb?: number;
  delay?: number;
};

interface AudioEngine {
  ctx: AudioContext;
  master: GainNode;
  reverbIn: GainNode;
  delayIn: GainNode;
  noise: AudioBuffer;
  lastPlayedAt: Map<SoundType, number>;
  baseMasterLevel: number;
}

const MIN_GAIN = 0.0001;
const COOLDOWN_MS: Record<SoundType, number> = {
  deal: 18,
  chip: 28,
  flip: 48,
  win: 320,
  lose: 320,
  push: 260,
  blackjack: 520,
};

let engine: AudioEngine | null = null;

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function createNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    last = 0.96 * last + 0.04 * white;
    data[i] = last;
  }
  return buffer;
}

function createImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const t = i / Math.max(1, length - 1);
      const env = Math.pow(1 - t, decay);
      data[i] = (Math.random() * 2 - 1) * env;
    }
  }
  return impulse;
}

function ensureEngine(): AudioEngine | null {
  if (engine) return engine;

  try {
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    const baseMasterLevel = 0.9;

    const master = ctx.createGain();
    master.gain.value = baseMasterLevel;

    const tone = ctx.createBiquadFilter();
    tone.type = 'highshelf';
    tone.frequency.value = 3200;
    tone.gain.value = 1.2;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 16;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.2;

    master.connect(tone);
    tone.connect(compressor);
    compressor.connect(ctx.destination);

    const reverbIn = ctx.createGain();
    const convolver = ctx.createConvolver();
    convolver.buffer = createImpulse(ctx, 1.4, 2.8);
    const reverbOut = ctx.createGain();
    reverbOut.gain.value = 0.18;
    reverbIn.connect(convolver);
    convolver.connect(reverbOut);
    reverbOut.connect(master);

    const delayIn = ctx.createGain();
    const delay = ctx.createDelay(0.6);
    delay.delayTime.value = 0.17;
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = 0.28;
    const delayTone = ctx.createBiquadFilter();
    delayTone.type = 'lowpass';
    delayTone.frequency.value = 2500;
    delayIn.connect(delay);
    delay.connect(delayTone);
    delayTone.connect(master);
    delayTone.connect(delayFeedback);
    delayFeedback.connect(delay);

    engine = {
      ctx,
      master,
      reverbIn,
      delayIn,
      noise: createNoiseBuffer(ctx, 1.6),
      lastPlayedAt: new Map<SoundType, number>(),
      baseMasterLevel,
    };

    return engine;
  } catch {
    return null;
  }
}

function connectToMix(eng: AudioEngine, source: AudioNode, mix?: Mix) {
  const ctx = eng.ctx;
  const dryAmount = mix?.dry ?? 1;
  const reverbAmount = mix?.reverb ?? 0;
  const delayAmount = mix?.delay ?? 0;

  const dry = ctx.createGain();
  dry.gain.value = dryAmount;
  source.connect(dry);
  dry.connect(eng.master);

  if (reverbAmount > 0) {
    const send = ctx.createGain();
    send.gain.value = reverbAmount;
    source.connect(send);
    send.connect(eng.reverbIn);
  }

  if (delayAmount > 0) {
    const send = ctx.createGain();
    send.gain.value = delayAmount;
    source.connect(send);
    send.connect(eng.delayIn);
  }
}

function shapeEnvelope(
  param: AudioParam,
  start: number,
  peak: number,
  attack: number,
  hold: number,
  release: number,
): number {
  const safePeak = Math.max(peak, MIN_GAIN);
  const safeAttack = Math.max(attack, 0.001);
  const safeHold = Math.max(hold, 0.001);
  const safeRelease = Math.max(release, 0.001);
  param.setValueAtTime(MIN_GAIN, start);
  param.exponentialRampToValueAtTime(safePeak, start + safeAttack);
  param.setValueAtTime(safePeak, start + safeAttack + safeHold);
  param.exponentialRampToValueAtTime(MIN_GAIN, start + safeAttack + safeHold + safeRelease);
  return start + safeAttack + safeHold + safeRelease;
}

function playTone(
  eng: AudioEngine,
  {
    type,
    start,
    freq,
    endFreq,
    gain,
    attack = 0.004,
    hold = 0.03,
    release = 0.08,
    detune = 0,
    mix,
    filterType,
    filterFreq,
    filterQ,
    filterEndFreq,
  }: {
    type: OscillatorType;
    start: number;
    freq: number;
    endFreq?: number;
    gain: number;
    attack?: number;
    hold?: number;
    release?: number;
    detune?: number;
    mix?: Mix;
    filterType?: BiquadFilterType;
    filterFreq?: number;
    filterQ?: number;
    filterEndFreq?: number;
  },
) {
  const ctx = eng.ctx;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + attack + hold + release);
  }
  osc.detune.value = detune;

  let out: AudioNode = osc;
  if (filterType && filterFreq) {
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, start);
    if (filterEndFreq) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(20, filterEndFreq), start + attack + hold + release);
    }
    if (filterQ) filter.Q.value = filterQ;
    out.connect(filter);
    out = filter;
  }

  out.connect(amp);
  connectToMix(eng, amp, mix);
  const stopAt = shapeEnvelope(amp.gain, start, gain, attack, hold, release);
  osc.start(start);
  osc.stop(stopAt + 0.02);
}

function playNoise(
  eng: AudioEngine,
  {
    start,
    gain,
    attack = 0.001,
    hold = 0.02,
    release = 0.06,
    mix,
    highpass,
    highpassEnd,
    lowpass,
    lowpassEnd,
    bandpass,
    bandQ = 6,
  }: {
    start: number;
    gain: number;
    attack?: number;
    hold?: number;
    release?: number;
    mix?: Mix;
    highpass?: number;
    highpassEnd?: number;
    lowpass?: number;
    lowpassEnd?: number;
    bandpass?: number;
    bandQ?: number;
  },
) {
  const ctx = eng.ctx;
  const src = ctx.createBufferSource();
  src.buffer = eng.noise;

  let out: AudioNode = src;

  if (highpass) {
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(highpass, start);
    if (highpassEnd) {
      hp.frequency.exponentialRampToValueAtTime(Math.max(20, highpassEnd), start + attack + hold + release);
    }
    out.connect(hp);
    out = hp;
  }

  if (bandpass) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = bandpass;
    bp.Q.value = bandQ;
    out.connect(bp);
    out = bp;
  }

  if (lowpass) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(lowpass, start);
    if (lowpassEnd) {
      lp.frequency.exponentialRampToValueAtTime(Math.max(50, lowpassEnd), start + attack + hold + release);
    }
    out.connect(lp);
    out = lp;
  }

  const amp = ctx.createGain();
  out.connect(amp);
  connectToMix(eng, amp, mix);
  const stopAt = shapeEnvelope(amp.gain, start, gain, attack, hold, release);
  src.start(start);
  src.stop(stopAt + 0.02);
}

function duckMaster(eng: AudioEngine, amount: number, seconds: number) {
  const now = eng.ctx.currentTime;
  const ducked = eng.baseMasterLevel * amount;
  eng.master.gain.cancelScheduledValues(now);
  eng.master.gain.setValueAtTime(eng.master.gain.value, now);
  eng.master.gain.exponentialRampToValueAtTime(Math.max(MIN_GAIN, ducked), now + 0.01);
  eng.master.gain.exponentialRampToValueAtTime(eng.baseMasterLevel, now + Math.max(seconds, 0.08));
}

function isCoolingDown(eng: AudioEngine, type: SoundType): boolean {
  const stamp = nowMs();
  const last = eng.lastPlayedAt.get(type);
  const cooldown = COOLDOWN_MS[type];
  if (last !== undefined && stamp - last < cooldown) return true;
  eng.lastPlayedAt.set(type, stamp);
  return false;
}

function playDeal(eng: AudioEngine, now: number) {
  playNoise(eng, {
    start: now,
    gain: 0.013,
    hold: 0.012,
    release: 0.032,
    highpass: 900,
    lowpass: 5600,
    mix: { dry: 1, reverb: 0.02 },
  });
  playTone(eng, {
    type: 'triangle',
    start: now,
    freq: 205 * rand(0.985, 1.015),
    endFreq: 150,
    gain: 0.028,
    attack: 0.002,
    hold: 0.018,
    release: 0.055,
    mix: { dry: 1, reverb: 0.03 },
    filterType: 'lowpass',
    filterFreq: 1800,
  });
  playTone(eng, {
    type: 'sine',
    start: now + 0.003,
    freq: 860 * rand(0.99, 1.01),
    endFreq: 620,
    gain: 0.012,
    attack: 0.0015,
    hold: 0.012,
    release: 0.038,
    mix: { dry: 1, reverb: 0.02 },
  });
}

function playChip(eng: AudioEngine, now: number) {
  playNoise(eng, {
    start: now,
    gain: 0.014,
    hold: 0.018,
    release: 0.045,
    highpass: 1800,
    lowpass: 8000,
    bandpass: 3400,
    bandQ: 5,
    mix: { dry: 1, reverb: 0.04 },
  });
  playTone(eng, {
    type: 'triangle',
    start: now,
    freq: 1950 * rand(0.985, 1.015),
    endFreq: 1300,
    gain: 0.03,
    attack: 0.001,
    hold: 0.016,
    release: 0.05,
    mix: { dry: 1, reverb: 0.05 },
  });
  playTone(eng, {
    type: 'sine',
    start: now + 0.007,
    freq: 2400 * rand(0.985, 1.015),
    endFreq: 1680,
    gain: 0.024,
    attack: 0.001,
    hold: 0.02,
    release: 0.055,
    mix: { dry: 1, reverb: 0.06, delay: 0.04 },
  });
}

function playFlip(eng: AudioEngine, now: number) {
  playNoise(eng, {
    start: now,
    gain: 0.012,
    hold: 0.05,
    release: 0.07,
    highpass: 500,
    highpassEnd: 2600,
    lowpass: 7200,
    lowpassEnd: 3200,
    mix: { dry: 1, reverb: 0.05 },
  });
  playTone(eng, {
    type: 'sine',
    start: now + 0.01,
    freq: 420 * rand(0.99, 1.01),
    endFreq: 1020,
    gain: 0.018,
    attack: 0.002,
    hold: 0.04,
    release: 0.08,
    mix: { dry: 1, reverb: 0.08, delay: 0.05 },
    filterType: 'highpass',
    filterFreq: 260,
  });
}

function playWin(eng: AudioEngine, now: number) {
  duckMaster(eng, 0.8, 0.35);
  const notes = [523.25, 659.25, 783.99, 987.77];
  notes.forEach((note, i) => {
    const t = now + i * 0.075;
    playTone(eng, {
      type: 'triangle',
      start: t,
      freq: note,
      gain: 0.048,
      attack: 0.003,
      hold: 0.05,
      release: 0.11,
      mix: { dry: 1, reverb: 0.1, delay: 0.08 },
    });
    playTone(eng, {
      type: 'sine',
      start: t + 0.012,
      freq: note * 2,
      gain: 0.015,
      attack: 0.001,
      hold: 0.028,
      release: 0.07,
      mix: { dry: 1, reverb: 0.08 },
    });
  });
  playTone(eng, {
    type: 'sine',
    start: now,
    freq: 261.63,
    endFreq: 246.94,
    gain: 0.026,
    attack: 0.004,
    hold: 0.16,
    release: 0.18,
    mix: { dry: 1, reverb: 0.1 },
    filterType: 'lowpass',
    filterFreq: 700,
  });
  playNoise(eng, {
    start: now + 0.22,
    gain: 0.005,
    hold: 0.08,
    release: 0.1,
    highpass: 3500,
    lowpass: 9800,
    mix: { dry: 1, reverb: 0.14 },
  });
}

function playBlackjack(eng: AudioEngine, now: number) {
  duckMaster(eng, 0.72, 0.55);
  const fanfare = [523.25, 659.25, 783.99, 1046.5, 1318.51];
  fanfare.forEach((note, i) => {
    const t = now + i * 0.09;
    playTone(eng, {
      type: 'sawtooth',
      start: t,
      freq: note,
      gain: 0.05,
      attack: 0.003,
      hold: 0.06,
      release: 0.12,
      mix: { dry: 1, reverb: 0.12, delay: 0.09 },
      filterType: 'lowpass',
      filterFreq: 5200,
      filterEndFreq: 3600,
    });
    playTone(eng, {
      type: 'square',
      start: t + 0.014,
      freq: note * 2,
      gain: 0.012,
      attack: 0.001,
      hold: 0.04,
      release: 0.09,
      mix: { dry: 1, reverb: 0.08 },
      filterType: 'lowpass',
      filterFreq: 6200,
    });
  });
  playTone(eng, {
    type: 'sine',
    start: now,
    freq: 98,
    endFreq: 56,
    gain: 0.048,
    attack: 0.004,
    hold: 0.12,
    release: 0.28,
    mix: { dry: 1, reverb: 0.1 },
    filterType: 'lowpass',
    filterFreq: 280,
  });
  playNoise(eng, {
    start: now + 0.03,
    gain: 0.012,
    hold: 0.14,
    release: 0.18,
    highpass: 2200,
    lowpass: 9200,
    mix: { dry: 1, reverb: 0.2, delay: 0.04 },
  });
}

function playLose(eng: AudioEngine, now: number) {
  duckMaster(eng, 0.84, 0.42);
  playTone(eng, {
    type: 'sawtooth',
    start: now,
    freq: 290 * rand(0.99, 1.01),
    endFreq: 92,
    gain: 0.04,
    attack: 0.004,
    hold: 0.11,
    release: 0.24,
    mix: { dry: 1, reverb: 0.1 },
    filterType: 'lowpass',
    filterFreq: 3200,
    filterEndFreq: 1200,
  });
  playTone(eng, {
    type: 'sine',
    start: now + 0.015,
    freq: 120,
    endFreq: 46,
    gain: 0.05,
    attack: 0.003,
    hold: 0.08,
    release: 0.28,
    mix: { dry: 1, reverb: 0.08 },
    filterType: 'lowpass',
    filterFreq: 360,
  });
  playNoise(eng, {
    start: now + 0.01,
    gain: 0.012,
    hold: 0.06,
    release: 0.16,
    highpass: 220,
    lowpass: 1400,
    mix: { dry: 1, reverb: 0.06 },
  });
}

function playPush(eng: AudioEngine, now: number) {
  playTone(eng, {
    type: 'sine',
    start: now,
    freq: 440,
    gain: 0.026,
    attack: 0.002,
    hold: 0.04,
    release: 0.08,
    mix: { dry: 1, reverb: 0.06 },
  });
  playTone(eng, {
    type: 'sine',
    start: now + 0.1,
    freq: 392,
    gain: 0.024,
    attack: 0.002,
    hold: 0.06,
    release: 0.09,
    mix: { dry: 1, reverb: 0.07 },
  });
}

export function useSound() {
  const soundEnabled = useGameStore((s) => s.soundEnabled);

  const play = useCallback(
    (type: SoundType) => {
      if (!soundEnabled) return;
      const eng = ensureEngine();
      if (!eng) return;
      if (isCoolingDown(eng, type)) return;

      if (eng.ctx.state === 'suspended') {
        void eng.ctx.resume();
      }

      const now = eng.ctx.currentTime;
      switch (type) {
        case 'deal':
          playDeal(eng, now);
          break;
        case 'chip':
          playChip(eng, now);
          break;
        case 'flip':
          playFlip(eng, now);
          break;
        case 'win':
          playWin(eng, now);
          break;
        case 'blackjack':
          playBlackjack(eng, now);
          break;
        case 'lose':
          playLose(eng, now);
          break;
        case 'push':
          playPush(eng, now);
          break;
      }
    },
    [soundEnabled],
  );

  return { play };
}
