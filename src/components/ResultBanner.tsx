import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, selectPhase, selectMyBalance, selectMyBuyIn, useSettlementReady } from '../hooks/useGameState';
import { useSound } from '../hooks/useSound';
import { useEffect, useRef } from 'react';

type OutcomeKind = 'blackjack' | 'win' | 'loss' | 'push';
type BannerParticle = { x: number; y: number; size: number; delay: number; duration: number };

function formatSignedMoney(value: number): string {
  if (value > 0) return `+$${value.toLocaleString()}`;
  if (value < 0) return `-$${Math.abs(value).toLocaleString()}`;
  return '$0';
}

function getOutcomeKind(result: string, payout: number): OutcomeKind {
  if (result.includes('BLACKJACK') && result !== 'DEALER_BLACKJACK') return 'blackjack';
  if (result === 'PLAYER_WIN') return 'win';
  if (result === 'DEALER_WIN' || result === 'DEALER_BLACKJACK') return 'loss';
  if (result === 'PUSH' || result === 'PUSH_22') return 'push';

  if (payout > 0) return 'win';
  if (payout < 0) return 'loss';
  return 'push';
}

function getOutcomeTheme(kind: OutcomeKind) {
  switch (kind) {
    case 'blackjack':
      return {
        panelBg: 'from-amber-200/15 via-amber-500/10 to-amber-700/20',
        panelBorder: 'border-amber-200/90',
        heading: 'text-amber-100',
        payout: 'text-amber-100',
        badgeBg: 'bg-amber-300',
        badgeText: 'text-charcoal',
        badgeBorder: 'border-amber-100',
        badgeCode: 'BJ',
        badgeLabel: 'BLACKJACK',
      };
    case 'win':
      return {
        panelBg: 'from-cyan-200/15 via-cyan-500/10 to-blue-600/20',
        panelBorder: 'border-cyan-200/90',
        heading: 'text-cyan-100',
        payout: 'text-cyan-100',
        badgeBg: 'bg-cyan-200',
        badgeText: 'text-charcoal',
        badgeBorder: 'border-cyan-100',
        badgeCode: 'W',
        badgeLabel: 'WIN',
      };
    case 'loss':
      return {
        panelBg: 'from-orange-200/15 via-orange-500/10 to-rose-700/20',
        panelBorder: 'border-orange-200/90',
        heading: 'text-orange-100',
        payout: 'text-orange-100',
        badgeBg: 'bg-orange-200',
        badgeText: 'text-charcoal',
        badgeBorder: 'border-orange-100',
        badgeCode: 'L',
        badgeLabel: 'LOSS',
      };
    case 'push':
      return {
        panelBg: 'from-slate-200/15 via-blue-200/10 to-slate-500/20',
        panelBorder: 'border-slate-200/90',
        heading: 'text-slate-100',
        payout: 'text-slate-100',
        badgeBg: 'bg-slate-200',
        badgeText: 'text-charcoal',
        badgeBorder: 'border-slate-100',
        badgeCode: '=',
        badgeLabel: 'PUSH',
      };
  }
}

function getHandPillStyle(kind: OutcomeKind): string {
  switch (kind) {
    case 'blackjack':
      return 'border-amber-200 bg-amber-300/20';
    case 'win':
      return 'border-cyan-200 bg-cyan-300/15';
    case 'loss':
      return 'border-orange-200 border-dashed bg-orange-300/15';
    case 'push':
      return 'border-slate-200 border-dotted bg-slate-300/15';
  }
}

function getOutcomeParticleColor(kind: OutcomeKind): string {
  switch (kind) {
    case 'blackjack':
      return 'rgba(255, 233, 153, 0.92)';
    case 'win':
      return 'rgba(167, 243, 255, 0.9)';
    case 'loss':
      return 'rgba(255, 180, 142, 0.88)';
    case 'push':
      return 'rgba(196, 210, 236, 0.82)';
  }
}

function getOutcomeBackdrop(kind: OutcomeKind): string {
  switch (kind) {
    case 'blackjack':
      return 'radial-gradient(circle at 50% 45%, rgba(255, 210, 96, 0.28), rgba(255, 150, 48, 0.09) 42%, rgba(0, 0, 0, 0) 74%)';
    case 'win':
      return 'radial-gradient(circle at 50% 45%, rgba(120, 244, 255, 0.24), rgba(57, 144, 255, 0.08) 42%, rgba(0, 0, 0, 0) 74%)';
    case 'loss':
      return 'radial-gradient(circle at 50% 45%, rgba(255, 153, 122, 0.22), rgba(255, 102, 102, 0.09) 44%, rgba(0, 0, 0, 0) 75%)';
    case 'push':
      return 'radial-gradient(circle at 50% 45%, rgba(176, 195, 225, 0.2), rgba(130, 149, 178, 0.08) 44%, rgba(0, 0, 0, 0) 75%)';
  }
}

export default function ResultBanner() {
  const phase = useGameStore(selectPhase);
  const tableState = useGameStore((s) => s.tableState);
  const myPlayerId = useGameStore((s) => s.myPlayerId);
  const readyForNext = useGameStore((s) => s.readyForNext);
  const { play } = useSound();
  const soundPlayed = useRef(false);
  const settlementReady = useSettlementReady();

  // Don't show the banner until dealer reveal + player results cascade completes
  const isVisible = phase === 'SETTLEMENT' && tableState?.settlement !== null && settlementReady;
  const mySettlement = tableState?.settlement?.find((s) => s.playerId === myPlayerId);

  useEffect(() => {
    if (isVisible && mySettlement && !soundPlayed.current) {
      soundPlayed.current = true;
      if (mySettlement.result.includes('BLACKJACK') && mySettlement.result !== 'DEALER_BLACKJACK') {
        play('blackjack');
      } else if (
        mySettlement.result === 'PLAYER_WIN' ||
        mySettlement.result === 'PLAYER_BLACKJACK' ||
        mySettlement.result === 'PLAYER_BLACKJACK_SUITED'
      ) {
        play('win');
      } else if (mySettlement.result === 'PUSH' || mySettlement.result === 'PUSH_22') {
        play('push');
      } else {
        play('lose');
      }
    }
    if (!isVisible) {
      soundPlayed.current = false;
    }
  }, [isVisible, mySettlement, play]);

  // Check if I already clicked ready
  const myPlayer = tableState?.players.find((p) => p.id === myPlayerId);
  const amReady = myPlayer?.isReady ?? false;

  // Overall stack change (current balance vs buy-in)
  const balance = useGameStore(selectMyBalance);
  const myBuyIn = useGameStore(selectMyBuyIn);
  const overallChange = balance - myBuyIn;

  if (!isVisible || !mySettlement) {
    return <AnimatePresence />;
  }

  const outcomeKind = getOutcomeKind(mySettlement.result, mySettlement.payout);
  const theme = getOutcomeTheme(outcomeKind);
  const overallDirection = overallChange > 0 ? 'UP' : overallChange < 0 ? 'DOWN' : 'EVEN';
  const particleColor = getOutcomeParticleColor(outcomeKind);
  const particleCount =
    outcomeKind === 'blackjack' ? 32 : outcomeKind === 'win' ? 22 : outcomeKind === 'loss' ? 18 : 14;
  const particles: BannerParticle[] = Array.from({ length: particleCount }, (_, i) => {
    const angle = (i / particleCount) * Math.PI * 2;
    const spread = outcomeKind === 'blackjack' ? 220 : outcomeKind === 'win' ? 190 : 165;
    return {
      x: Math.cos(angle) * spread * (0.8 + (i % 3) * 0.2),
      y: Math.sin(angle) * spread * (0.5 + (i % 4) * 0.15),
      size: outcomeKind === 'blackjack' ? 8 + (i % 4) * 2 : 6 + (i % 3) * 2,
      delay: i * 0.012,
      duration: outcomeKind === 'loss' ? 0.9 : 1.1,
    };
  });

  const panelAnimate =
    outcomeKind === 'loss'
      ? { scale: [0.78, 1.04, 1], x: [0, -12, 10, -8, 6, -3, 0], y: [26, 0, 0] }
      : outcomeKind === 'blackjack'
        ? { scale: [0.62, 1.08, 1], y: [30, -8, 0], rotate: [0, -0.6, 0.6, 0] }
        : outcomeKind === 'win'
          ? { scale: [0.68, 1.06, 1], y: [26, -5, 0] }
          : { scale: [0.76, 1.02, 1], y: [24, 0, 0] };
  const panelTransition = {
    type: 'spring' as const,
    stiffness: outcomeKind === 'loss' ? 520 : 420,
    damping: outcomeKind === 'loss' ? 19 : 24,
    duration: outcomeKind === 'loss' ? 0.78 : 0.86,
  };

  return (
    <AnimatePresence>
      <motion.div
        className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0"
          style={{ background: getOutcomeBackdrop(outcomeKind) }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.7] }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        />
        {particles.map((particle, idx) => (
          <motion.span
            key={`settle-particle-${idx}`}
            className="absolute rounded-full pointer-events-none mix-blend-screen"
            style={{
              width: particle.size,
              height: particle.size,
              background: particleColor,
              boxShadow: `0 0 ${particle.size * 1.8}px ${particleColor}`,
            }}
            initial={{ x: 0, y: 12, scale: 0.2, opacity: 0 }}
            animate={{
              x: [0, particle.x],
              y: [12, particle.y],
              scale: [0.2, 1.08, 0.55],
              opacity: [0, 1, 0],
            }}
            transition={{ duration: particle.duration, delay: particle.delay, ease: 'easeOut' }}
          />
        ))}
        <motion.div
          role="status"
          aria-live="polite"
          className={`
            relative overflow-hidden
            bg-gradient-to-b ${theme.panelBg}
            backdrop-blur-md border ${theme.panelBorder}
            rounded-2xl px-8 py-6 sm:px-12 sm:py-8
            flex flex-col items-center gap-3
            shadow-2xl cursor-pointer max-w-[440px] w-[92%] pointer-events-auto
          `}
          initial={{ scale: 0.45, y: 40, opacity: 0 }}
          animate={{ ...panelAnimate, opacity: 1 }}
          exit={{ scale: 0.82, opacity: 0 }}
          transition={panelTransition}
          onClick={() => { if (!amReady) readyForNext(); }}
        >
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                outcomeKind === 'loss'
                  ? 'linear-gradient(130deg, rgba(255,120,96,0.16), rgba(255,120,96,0) 58%)'
                  : 'linear-gradient(130deg, rgba(255,255,255,0.16), rgba(255,255,255,0) 58%)',
            }}
            initial={{ x: '-120%', opacity: 0 }}
            animate={{ x: ['-120%', '120%'], opacity: [0, 0.95, 0] }}
            transition={{ duration: 0.82, ease: 'easeOut', delay: 0.08 }}
          />
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black tracking-widest ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder}`}>
            <span className="font-mono">{theme.badgeCode}</span>
            <span>{theme.badgeLabel}</span>
          </div>

          <motion.div
            className={`text-2xl sm:text-3xl font-bold ${theme.heading} font-[Georgia] text-center`}
            animate={
              outcomeKind === 'loss'
                ? { x: [0, -3, 3, -2, 2, 0] }
                : { scale: [1, 1.04, 1] }
            }
            transition={{ duration: outcomeKind === 'loss' ? 0.42 : 0.55, delay: 0.08 }}
          >
            {mySettlement.message}
          </motion.div>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-cream/60 uppercase tracking-wider">Net</span>
            <motion.span
              className={`text-lg sm:text-xl font-bold font-mono ${theme.payout}`}
              animate={
                outcomeKind === 'loss'
                  ? { scale: [1, 0.95, 1], opacity: [1, 0.78, 1] }
                  : { scale: [1, 1.12, 1], opacity: [1, 0.85, 1] }
              }
              transition={{ duration: 0.7, repeat: 1, ease: 'easeOut' }}
            >
              {formatSignedMoney(mySettlement.payout)}
            </motion.span>
          </div>

          {/* Per-hand breakdown for multi-hand */}
          {mySettlement.handResults && mySettlement.handResults.length > 1 && (
            <div className="flex gap-2 flex-wrap justify-center mt-1">
              {mySettlement.handResults.map((hr) => {
                const handKind = getOutcomeKind(hr.result, hr.payout);
                const handTheme = getOutcomeTheme(handKind);
                return (
                  <div
                    key={hr.handIndex}
                    className={`text-[11px] px-2.5 py-1 rounded-md border font-bold ${getHandPillStyle(handKind)}`}
                  >
                    <span className="font-mono text-cream/80 mr-1">H{hr.handIndex + 1}</span>
                    <span className={`uppercase mr-1 ${handTheme.heading}`}>{handTheme.badgeLabel}</span>
                    <span className="text-cream/80 mr-1">{hr.message}</span>
                    <span className="text-cream font-mono">{formatSignedMoney(hr.payout)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {mySettlement.sideBetPayout !== 0 && (
            <div className="text-sm text-cream/80">
              Side Bet: <span className="font-mono font-bold">{formatSignedMoney(mySettlement.sideBetPayout)}</span>
            </div>
          )}

          {/* Overall stack summary */}
          <div className="w-full mt-2 pt-2 border-t border-white/15 flex items-center justify-between text-[11px]">
            <span className="text-cream/50">
              Stack: <span className="text-cream/90 font-bold font-mono">${balance.toLocaleString()}</span>
            </span>
            <span className="font-bold text-cream/85">
              {overallDirection} <span className="font-mono ml-1">{formatSignedMoney(overallChange)}</span>
              <span className="text-cream/35 font-normal ml-1">overall</span>
            </span>
          </div>

          {amReady ? (
            <div className="text-cream/50 text-xs mt-2">Waiting for others...</div>
          ) : (
            <div className="text-cream/50 text-xs mt-2">Click banner to continue</div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
