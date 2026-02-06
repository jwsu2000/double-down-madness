// ─── Result Banner Overlay — Multiplayer ──────────────────────────────────────

import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, selectPhase } from '../hooks/useGameState';
import { useSound } from '../hooks/useSound';
import { useEffect, useRef } from 'react';

export default function ResultBanner() {
  const phase = useGameStore(selectPhase);
  const tableState = useGameStore((s) => s.tableState);
  const myPlayerId = useGameStore((s) => s.myPlayerId);
  const readyForNext = useGameStore((s) => s.readyForNext);
  const { play } = useSound();
  const soundPlayed = useRef(false);

  const isVisible = phase === 'SETTLEMENT' && tableState?.settlement !== null;
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

  const getColors = () => {
    if (!mySettlement) return { bg: '', text: '', border: '' };
    const p = mySettlement.payout;
    if (p > 0) {
      if (mySettlement.result.includes('BLACKJACK') && mySettlement.result !== 'DEALER_BLACKJACK') {
        return { bg: 'from-gold/20 to-amber-600/20', text: 'text-gold-light', border: 'border-gold' };
      }
      return { bg: 'from-casino-green/20 to-emerald-700/20', text: 'text-casino-green', border: 'border-casino-green' };
    }
    if (p === 0) return { bg: 'from-blue-500/20 to-blue-700/20', text: 'text-blue-300', border: 'border-blue-400' };
    return { bg: 'from-casino-red/20 to-red-800/20', text: 'text-casino-red', border: 'border-casino-red' };
  };

  const colors = getColors();

  // Check if I already clicked ready
  const myPlayer = tableState?.players.find((p) => p.id === myPlayerId);
  const amReady = myPlayer?.isReady ?? false;

  return (
    <AnimatePresence>
      {isVisible && mySettlement && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center z-50 pointer-events-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => { if (!amReady) readyForNext(); }}
        >
          <motion.div
            className={`
              bg-gradient-to-b ${colors.bg}
              backdrop-blur-md border ${colors.border}
              rounded-2xl px-8 py-6 sm:px-12 sm:py-8
              flex flex-col items-center gap-3
              shadow-2xl cursor-pointer max-w-sm w-[90%]
            `}
            initial={{ scale: 0.5, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <div className={`text-2xl sm:text-3xl font-bold ${colors.text} font-[Georgia] text-center`}>
              {mySettlement.message}
            </div>

            {mySettlement.payout !== 0 && (
              <div className={`text-lg sm:text-xl font-bold
                ${mySettlement.payout > 0 ? 'text-casino-green' : 'text-casino-red'}`}
              >
                {mySettlement.payout > 0 ? '+' : ''}${mySettlement.payout}
              </div>
            )}

            {/* Per-hand breakdown for multi-hand */}
            {mySettlement.handResults && mySettlement.handResults.length > 1 && (
              <div className="flex gap-2 flex-wrap justify-center mt-1">
                {mySettlement.handResults.map((hr) => {
                  const isWin =
                    hr.result === 'PLAYER_WIN' ||
                    hr.result === 'PLAYER_BLACKJACK' ||
                    hr.result === 'PLAYER_BLACKJACK_SUITED';
                  const isLoss =
                    hr.result === 'DEALER_WIN' || hr.result === 'DEALER_BLACKJACK';
                  return (
                    <div
                      key={hr.handIndex}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold
                        ${isWin ? 'bg-casino-green/20 text-casino-green' :
                          isLoss ? 'bg-casino-red/20 text-casino-red' :
                          'bg-blue-500/20 text-blue-300'}
                      `}
                    >
                      H{hr.handIndex + 1}: {hr.message}
                      {hr.payout !== 0 && (
                        <span className="ml-0.5">
                          {hr.payout > 0 ? '+' : ''}${hr.payout}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {mySettlement.sideBetPayout !== 0 && (
              <div className={`text-sm ${mySettlement.sideBetPayout > 0 ? 'text-gold-light' : 'text-cream/50'}`}>
                Side Bet: {mySettlement.sideBetPayout > 0 ? `+$${mySettlement.sideBetPayout}` : `-$${Math.abs(mySettlement.sideBetPayout)}`}
              </div>
            )}

            {amReady ? (
              <div className="text-cream/40 text-xs mt-2">Waiting for others...</div>
            ) : (
              <div className="text-cream/40 text-xs mt-2">Click anywhere to continue</div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
