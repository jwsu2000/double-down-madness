// ─── Player Area — All Players at the Table (Multi-Hand) ─────────────────────

import { motion, AnimatePresence } from 'framer-motion';
import CardHand from './CardHand';
import { useGameStore } from '../hooks/useGameState';
import { evaluateHand } from '../engine/deck';
import { totalWager } from '../engine/rules';

export default function PlayerArea() {
  const tableState = useGameStore((s) => s.tableState);
  const myPlayerId = useGameStore((s) => s.myPlayerId);

  if (!tableState) return null;

  const phase = tableState.phase;
  const activePlayers = tableState.players.filter((p) => p.hands.length > 0);

  if (activePlayers.length === 0) {
    return (
      <div className="flex flex-col items-center">
        <div className="flex items-center justify-center min-h-[130px] px-4">
          <div className="w-[90px] h-[130px] rounded-lg border-2 border-dashed border-cream/10 flex items-center justify-center">
            <span className="text-cream/20 text-xs">Waiting...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-center gap-4 sm:gap-6 px-2 flex-wrap">
      {activePlayers.map((player) => {
        const isMe = player.id === myPlayerId;
        const hasMultiHands = player.hands.length > 1;

        return (
          <div key={player.id} className="flex flex-col items-center">
            {/* Player name */}
            <div className="flex items-center gap-1 mb-1">
              <span
                className={`text-[10px] uppercase tracking-wider font-bold
                  ${isMe ? 'text-cream/60' : 'text-cream/30'}
                `}
              >
                {player.name}{isMe ? ' (You)' : ''}
              </span>
              {hasMultiHands && (
                <span className="text-[9px] text-gold/50 ml-1">
                  ×{player.hands.length}
                </span>
              )}
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
                const isWinner =
                  handResult &&
                  (handResult.result === 'PLAYER_WIN' ||
                    handResult.result === 'PLAYER_BLACKJACK' ||
                    handResult.result === 'PLAYER_BLACKJACK_SUITED');
                const isBust = handEval.isBust;

                return (
                  <div
                    key={handIdx}
                    className={`flex flex-col items-center transition-all duration-300
                      ${isActiveHand ? 'scale-105' : isDone && !isWinner && phase === 'SETTLEMENT' ? 'opacity-70' : ''}
                    `}
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
                        ${isActiveHand ? 'ring-2 ring-gold/50 bg-gold/5' : ''}
                        ${isMe && !isActiveHand && activePlayers.length > 1 ? 'ring-1 ring-cream/10' : ''}
                      `}
                    >
                      <CardHand
                        cards={hand.cards}
                        isWinner={!!isWinner && phase === 'SETTLEMENT'}
                        isBust={isBust}
                        showScore={hand.cards.length > 0}
                        baseDelay={0}
                      />
                    </div>

                    {/* Per-hand result badge */}
                    <AnimatePresence>
                      {phase === 'SETTLEMENT' && handResult && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`text-xs font-bold mt-1 px-2 py-0.5 rounded-full
                            ${isWinner ? 'bg-casino-green/20 text-casino-green' :
                              isBust || handResult.result === 'DEALER_WIN' || handResult.result === 'DEALER_BLACKJACK'
                                ? 'bg-casino-red/20 text-casino-red'
                                : 'bg-blue-500/20 text-blue-300'
                            }
                          `}
                        >
                          {handResult.message}
                          {handResult.payout !== 0 && (
                            <span className="ml-1">
                              {handResult.payout > 0 ? '+' : ''}${handResult.payout}
                            </span>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Wager display */}
                    <AnimatePresence>
                      {hand.originalBet > 0 && phase !== 'BETTING' && (
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
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
