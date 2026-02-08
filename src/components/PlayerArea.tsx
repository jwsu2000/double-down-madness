// Player area for all players at the table (multi-hand support).
import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CardHand from './CardHand';
import { useGameStore, SETTLEMENT_TIMING } from '../hooks/useGameState';
import { useDealAnimationContext } from '../hooks/useDealAnimation';
import { evaluateHand, isBlackjack, isSuitedBlackjack } from '../engine/deck';
import { totalWager } from '../engine/rules';

// Use shared timing constants
const RESULT_REVEAL_DELAY = SETTLEMENT_TIMING.RESULT_REVEAL_BASE;
const RESULT_STAGGER = SETTLEMENT_TIMING.RESULT_STAGGER_PER;

type HandTone = 'blackjack' | 'win' | 'loss' | 'push';

function getHandTone(result: string): HandTone {
  if (result === 'PLAYER_BLACKJACK' || result === 'PLAYER_BLACKJACK_SUITED') return 'blackjack';
  if (result === 'PLAYER_WIN') return 'win';
  if (result === 'DEALER_WIN' || result === 'DEALER_BLACKJACK') return 'loss';
  return 'push';
}

function getHandGlowClasses(tone: HandTone): string {
  switch (tone) {
    case 'blackjack':
      return 'bg-amber-300/35 border-amber-100/80';
    case 'win':
      return 'bg-cyan-300/30 border-cyan-100/75';
    case 'loss':
      return 'bg-orange-300/28 border-orange-100/80';
    case 'push':
      return 'bg-slate-300/20 border-slate-100/65';
  }
}

function getHandBadgeClasses(tone: HandTone): string {
  switch (tone) {
    case 'blackjack':
      return 'bg-amber-300/28 text-amber-100 border border-amber-100/75 shadow-[0_0_20px_rgba(255,211,120,0.35)]';
    case 'win':
      return 'bg-cyan-300/25 text-cyan-100 border border-cyan-100/70 shadow-[0_0_20px_rgba(120,244,255,0.35)]';
    case 'loss':
      return 'bg-orange-300/28 text-orange-100 border border-orange-100/75 shadow-[0_0_20px_rgba(255,163,120,0.35)]';
    case 'push':
      return 'bg-slate-300/20 text-slate-100 border border-slate-100/65 shadow-[0_0_12px_rgba(182,198,225,0.2)]';
  }
}

export default function PlayerArea() {
  const tableState = useGameStore((s) => s.tableState);
  const myPlayerId = useGameStore((s) => s.myPlayerId);
  const isAnimating = useGameStore((s) => s.isAnimating);

  // Deal animation context
  const { playerCards: animatedPlayerCards, isDealing } = useDealAnimationContext();

  // Track how many player result groups have been revealed
  const [revealedCount, setRevealedCount] = useState(0);
  const timeoutsRef = useRef<number[]>([]);

  const phase = tableState?.phase ?? null;
  const activePlayers = useMemo(
    () => tableState?.players.filter((p) => p.hands.length > 0) ?? [],
    [tableState],
  );

  // During the deal animation, use the staged cards from context
  // After the deal, use the full server cards
  const displayPlayers = useMemo(() => {
    if (!isDealing) return activePlayers;
    return activePlayers.map((p) => {
      const animHands = animatedPlayerCards.get(p.id);
      if (!animHands) return p;
      return {
        ...p,
        hands: p.hands.map((h, hi) => ({
          ...h,
          cards: animHands[hi] ?? h.cards,
        })),
      };
    });
  }, [isDealing, activePlayers, animatedPlayerCards]);

  // When dealer reveal finishes (isAnimating goes false during SETTLEMENT),
  // start staggering player results
  useEffect(() => {
    // Clear any old timers
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setRevealedCount(0);

    if (phase !== 'SETTLEMENT' || isAnimating) return;

    const count = activePlayers.length;
    for (let i = 0; i < count; i++) {
      const t = window.setTimeout(() => {
        setRevealedCount(i + 1);
      }, RESULT_REVEAL_DELAY + i * RESULT_STAGGER);
      timeoutsRef.current.push(t);
    }

    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, [phase, isAnimating, activePlayers]);

  // Reset on phase changes away from settlement
  useEffect(() => {
    if (phase !== 'SETTLEMENT') {
      setRevealedCount(0);
    }
  }, [phase]);

  if (!tableState) return null;

  if (activePlayers.length === 0) {
    return (
      <div className="flex flex-col items-center">
        <div className="flex items-center justify-center min-h-[100px] sm:min-h-[130px] px-4">
          <div className="w-[62px] h-[90px] sm:w-[90px] sm:h-[130px] rounded-lg border-2 border-dashed border-cream/10 flex items-center justify-center">
            <span className="text-cream/20 text-xs">Waiting...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto px-2 pb-1 no-scrollbar">
      <div className="flex items-start justify-center gap-3 sm:gap-6 min-w-max mx-auto">
        {displayPlayers.map((player, playerIdx) => {
        const isMe = player.id === myPlayerId;
        const hasMultiHands = player.hands.length > 1;
        const isButton = player.id === tableState.buttonPlayerId;
        // This player's results are revealed if their index < revealedCount
        const showResults = phase === 'SETTLEMENT' && !isAnimating && playerIdx < revealedCount;

        return (
          <div key={player.id} className="flex flex-col items-center">
            {/* Player name */}
            <div className="flex items-center gap-1 mb-1">
              {isButton && (
                <span className="w-4 h-4 rounded-full bg-gold text-charcoal text-[8px] font-black flex items-center justify-center shrink-0"
                  title="Dealer Button"
                >D</span>
              )}
              <span
                className={`text-[10px] uppercase tracking-wider font-bold
                  ${isMe ? 'text-cream/60' : 'text-cream/30'}
                `}
              >
                {player.name}{isMe ? ' (You)' : ''}
              </span>
              {hasMultiHands && (
                <span className="text-[9px] text-gold/50 ml-1">
                  x{player.hands.length}
                </span>
              )}
            </div>
            <div
              className={`mb-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono
                ${player.balance <= 0
                  ? 'bg-casino-red/15 text-casino-red border border-casino-red/25'
                  : isMe
                  ? 'bg-gold/15 text-gold border border-gold/30'
                  : 'bg-charcoal-lighter/70 text-cream/65 border border-charcoal-lighter'
                }
              `}
              title={`${player.name} stack`}
            >
              <span className="text-[9px] opacity-80 uppercase tracking-wide">Stack</span>
              <span className="font-bold">${player.balance.toLocaleString()}</span>
            </div>

            {/* Hands row */}
            <div className={`flex items-start gap-2 ${hasMultiHands ? 'sm:gap-3' : ''}`}>
              {player.hands.map((hand, handIdx) => {
                const handEval = evaluateHand(hand.cards);
                const tw = totalWager(hand.originalBet, hand.doubleCount);
                const isActiveHand =
                  phase === 'PLAYER_TURN' &&
                  player.id === tableState.activePlayerId &&
                  handIdx === tableState.activeHandIndex;
                const isDone = phase === 'DEALER_TURN' || phase === 'SETTLEMENT';

                const settlement = tableState.settlement?.find(
                  (s) => s.playerId === player.id,
                );
                const handResult = settlement?.handResults?.find(
                  (r) => r.handIndex === handIdx,
                );
                const handTone = handResult ? getHandTone(handResult.result) : null;
                const isWinner =
                  handResult &&
                  (handResult.result === 'PLAYER_WIN' ||
                    handResult.result === 'PLAYER_BLACKJACK' ||
                    handResult.result === 'PLAYER_BLACKJACK_SUITED');
                const isBust = handEval.isBust;
                const baseScale = isActiveHand ? 1.05 : 1;
                const baseOpacity = isDone && !isWinner && showResults ? 0.7 : 1;
                const hasLiveBlackjack =
                  hand.cards.length === 2 &&
                  hand.cards.every((c) => c.faceUp) &&
                  isBlackjack(hand.cards);
                const blackjackExplosion = hasLiveBlackjack
                  ? isSuitedBlackjack(hand.cards)
                    ? 'suited'
                    : 'blackjack'
                  : 'none';
                const handOutcomeAnimation =
                  showResults && handTone
                    ? handTone === 'blackjack'
                      ? {
                          scale: [baseScale, baseScale * 1.16, baseScale * 1.05, baseScale],
                          y: [0, -8, -2, 0],
                          rotate: [0, -0.8, 0.8, 0],
                          opacity: 1,
                        }
                      : handTone === 'win'
                        ? {
                            scale: [baseScale, baseScale * 1.11, baseScale * 1.03, baseScale],
                            y: [0, -6, -2, 0],
                            opacity: [baseOpacity, 1, baseOpacity],
                          }
                        : handTone === 'loss'
                          ? {
                              scale: [baseScale, baseScale * 0.96, baseScale],
                              x: [0, -8, 7, -6, 4, 0],
                              opacity: [baseOpacity, 1, baseOpacity],
                            }
                          : {
                              scale: [baseScale, baseScale * 1.03, baseScale],
                              opacity: [baseOpacity, 1, baseOpacity],
                            }
                    : { scale: baseScale, opacity: baseOpacity, x: 0, y: 0, rotate: 0 };
                const handOutcomeTransition =
                  showResults && handTone
                    ? {
                        duration: handTone === 'loss' ? 0.62 : handTone === 'blackjack' ? 0.92 : 0.76,
                        ease: 'easeOut' as const,
                        delay: handIdx * 0.06,
                      }
                    : { duration: 0.22, ease: 'easeOut' as const };

                return (
                  <motion.div
                    key={handIdx}
                    className={`flex flex-col items-center transition-all duration-300
                    `}
                    initial={false}
                    animate={handOutcomeAnimation}
                    transition={handOutcomeTransition}
                  >
                    {/* Hand number label for multi-hand */}
                    {hasMultiHands && (
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className={`text-[8px] uppercase tracking-wider
                          ${isActiveHand ? 'text-gold font-bold' : 'text-cream/20'}
                        `}>
                          Hand {handIdx + 1}
                        </span>
                        {isActiveHand && (
                          <motion.div
                            className="w-1 h-1 rounded-full bg-gold"
                            animate={{ opacity: [1, 0.3, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                          />
                        )}
                      </div>
                    )}

                    {/* Active hand glow border */}
                    <div
                      className={`rounded-xl p-1 transition-all duration-300
                        relative
                        ${isActiveHand ? 'ring-2 ring-gold/50 bg-gold/5' : ''}
                        ${isMe && !isActiveHand && activePlayers.length > 1 ? 'ring-1 ring-cream/10' : ''}
                      `}
                    >
                      <AnimatePresence>
                        {showResults && handTone && (
                          <>
                            <motion.div
                              key={`hand-glow-soft-${player.id}-${handIdx}`}
                              className={`absolute -inset-2 rounded-2xl blur-md pointer-events-none ${getHandGlowClasses(handTone)}`}
                              initial={{ opacity: 0, scale: 0.72 }}
                              animate={{ opacity: [0, 0.95, 0.35], scale: [0.72, 1.15, 1.22] }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              transition={{ duration: handTone === 'blackjack' ? 1.06 : 0.86, ease: 'easeOut' }}
                            />
                            <motion.div
                              key={`hand-glow-ring-${player.id}-${handIdx}`}
                              className={`absolute -inset-1 rounded-xl border pointer-events-none ${getHandGlowClasses(handTone)}`}
                              initial={{ opacity: 0, scale: 0.88 }}
                              animate={{ opacity: [0, 1, 0.3], scale: [0.88, 1.08, 1.12] }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              transition={{ duration: handTone === 'blackjack' ? 0.96 : 0.74, ease: 'easeOut' }}
                            />
                          </>
                        )}
                      </AnimatePresence>
                      <CardHand
                        cards={hand.cards}
                        isWinner={!!isWinner && showResults}
                        isBust={isBust}
                        showScore={hand.cards.length > 0}
                        blackjackExplosion={blackjackExplosion}
                        baseDelay={0}
                        hideEmpty={isDealing}
                      />
                    </div>

                    {/* Per-hand result badge */}
                    <AnimatePresence>
                      {showResults && handResult && (
                        <motion.div
                          initial={{ opacity: 0, y: -12, scale: 0.74 }}
                          animate={
                            handTone === 'loss'
                              ? { opacity: 1, y: [0, -2, 0], scale: [0.86, 1.04, 1], x: [0, -3, 3, -2, 0] }
                              : handTone === 'blackjack'
                                ? { opacity: 1, y: [0, -4, 0], scale: [0.8, 1.18, 1], rotate: [0, -1.6, 1.6, 0] }
                                : handTone === 'win'
                                  ? { opacity: 1, y: [0, -3, 0], scale: [0.84, 1.12, 1] }
                                  : { opacity: 1, y: [0, -2, 0], scale: [0.86, 1.04, 1] }
                          }
                          transition={{
                            duration: handTone === 'loss' ? 0.62 : handTone === 'blackjack' ? 0.84 : 0.7,
                            delay: handIdx * 0.08,
                            ease: 'easeOut',
                          }}
                          className={`text-xs font-bold mt-1 px-2.5 py-0.5 rounded-full ${getHandBadgeClasses(handTone ?? 'push')}`}
                        >
                          {handResult.message}
                          {handResult.payout !== 0 && (
                            <span className="ml-1 font-mono">
                              {handResult.payout > 0 ? '+' : ''}${handResult.payout}
                            </span>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Wager display */}
                    <AnimatePresence>
                      {hand.originalBet > 0 && phase !== 'BETTING' && !isDealing && (
                        <motion.div
                          className="flex items-center gap-1 mt-1"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          <div className="relative w-6 h-5">
                            {Array.from({ length: Math.min(hand.doubleCount + 1, 4) }).map((_, j) => (
                              <motion.div
                                key={j}
                                className="absolute w-6 h-1.5 rounded-sm bg-gradient-to-b from-gold to-gold-dark border border-gold-light/30"
                                style={{ bottom: j * 2 }}
                                initial={{ x: 20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: j * 0.1 }}
                              />
                            ))}
                          </div>
                          <span className="text-gold text-xs font-bold">${tw}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
        })}
      </div>
    </div>
  );
}

