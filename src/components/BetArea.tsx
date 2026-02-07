import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, selectMyPlayer, selectPhase, selectMyIsAway, selectMyIsSpectator } from '../hooks/useGameState';
import { useSound } from '../hooks/useSound';
import { MAX_BUY_IN } from '../engine/rules';
import { DEALER_EMOTE_OPTIONS } from '../shared/protocol';
import ChipSelector from './ChipSelector';
import BalanceChipStack from './BalanceChipStack';

export default function BetArea() {
  const phase = useGameStore(selectPhase);
  const myPlayer = useGameStore(selectMyPlayer);
  const tableState = useGameStore((s) => s.tableState);
  const betInput = useGameStore((s) => s.betInput);
  const sideBetInput = useGameStore((s) => s.sideBetInput);
  const numHandsInput = useGameStore((s) => s.numHandsInput);
  const clearBet = useGameStore((s) => s.clearBet);
  const allIn = useGameStore((s) => s.allIn);
  const setSideBetInput = useGameStore((s) => s.setSideBetInput);
  const setNumHands = useGameStore((s) => s.setNumHands);
  const placeBet = useGameStore((s) => s.placeBet);
  const requestBuyIn = useGameStore((s) => s.requestBuyIn);
  const sendDealerEmote = useGameStore((s) => s.sendDealerEmote);
  const isAway = useGameStore(selectMyIsAway);
  const isSpectator = useGameStore(selectMyIsSpectator);
  const toggleAway = useGameStore((s) => s.toggleAway);
  const [buyInRequestAmount, setBuyInRequestAmount] = useState(1000);
  const { play } = useSound();

  if (!tableState) return null;
  if (isSpectator) {
    const connectedSpectators = (tableState.spectators ?? []).filter((s) => s.connected);
    return (
      <div className="flex items-center justify-center p-3 sm:p-4">
        <div className="w-full max-w-3xl rounded-xl border border-charcoal-lighter bg-charcoal-light/70 px-4 py-3 text-center">
          <p className="text-gold font-semibold text-sm uppercase tracking-wider">Spectator Mode</p>
          <p className="text-cream/50 text-xs mt-1">
            Watching live. You can chat and view table actions, but you cannot bet or play hands.
          </p>
          {connectedSpectators.length > 0 && (
            <p className="text-cream/35 text-[11px] mt-1.5">
              {connectedSpectators.length} spectator{connectedSpectators.length !== 1 ? 's' : ''} connected
            </p>
          )}
        </div>
      </div>
    );
  }
  if (!myPlayer) return null;

  const isBetting = phase === 'BETTING';
  const isDealer = myPlayer.id === tableState.buttonPlayerId;
  const isHost = myPlayer.id === tableState.hostId;
  const canUseEmotes = phase !== 'LOBBY';
  const hasBet = myPlayer.hasBet;
  const balance = myPlayer.balance;
  const totalCost = betInput * numHandsInput + sideBetInput;
  const canDeal = isBetting && !isDealer && !hasBet && betInput > 0 && totalCost <= balance && !isAway;
  const myBuyInRequest = tableState.buyInRequests.find((r) => r.playerId === myPlayer.id);
  const normalizedBuyInRequestAmount = Math.max(1, Math.min(MAX_BUY_IN, Math.trunc(buyInRequestAmount)));
  const canRequestBuyIn = isBetting && !isDealer && !isHost && !hasBet && !isAway && balance <= 0 && !myBuyInRequest;

  const bettingStatus = tableState.players.filter(
    (p) => p.connected && p.id !== tableState.buttonPlayerId,
  );

  const maxHands = betInput > 0 ? Math.min(5, Math.floor((balance - sideBetInput) / betInput)) : 1;

  if (!isBetting && !canUseEmotes) return null;

  return (
    <div className="flex items-start gap-3 sm:gap-6 p-3 sm:p-4 justify-center">
      <div className="hidden sm:flex flex-col items-center pt-1">
        <BalanceChipStack />
      </div>

      <div className="flex flex-col items-center gap-3 flex-1 w-full max-w-3xl">
        {canUseEmotes && (
          <div className="w-full rounded-xl border border-gold/25 bg-charcoal-light/72 shadow-[0_12px_24px_rgba(0,0,0,0.26)] px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.18em] text-gold/60 font-semibold text-center mb-1.5">
              Table Emotes
            </div>
            <div className="flex gap-1.5 sm:gap-2 flex-wrap justify-center">
              {DEALER_EMOTE_OPTIONS.map((option) => (
                <EmoteButton
                  key={option.kind}
                  label={`${option.glyph} ${option.label}`}
                  onClick={() => {
                    sendDealerEmote(option.kind);
                    play('chip');
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {!isBetting ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="text-cream/45 text-sm text-center">Emotes are enabled for all players during the hand.</div>
          </div>
        ) : isDealer ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="text-gold text-lg font-bold">You are the house dealer</div>
            <p className="text-cream/45 text-sm text-center max-w-xs">
              Dealers do not place bets or play hands.
            </p>
            <div className="flex gap-2 mt-2 flex-wrap justify-center">
              {bettingStatus.map((p) => (
                <BetStatusPill key={p.id} player={p} />
              ))}
            </div>
          </div>
        ) : isAway ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-400/60" />
              <span className="text-amber-400 text-lg font-bold">You are Away</span>
            </div>
            <p className="text-cream/40 text-sm text-center max-w-xs">
              You're sitting out this round. The table will continue without waiting for you.
            </p>
            <motion.button
              onClick={toggleAway}
              className="mt-1 px-6 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider
                bg-gradient-to-b from-gold to-gold-dark text-charcoal hover:from-gold-light hover:to-gold
                cursor-pointer shadow-lg transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Return to Table
            </motion.button>

            <div className="flex gap-2 mt-2">
              {bettingStatus.map((p) => (
                <BetStatusPill key={p.id} player={p} />
              ))}
            </div>
          </div>
        ) : hasBet ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="text-gold text-lg font-bold">
              Bet Placed: ${myPlayer.currentBet} × {myPlayer.hands.length} hand{myPlayer.hands.length !== 1 ? 's' : ''}
            </div>
            {myPlayer.sideBet > 0 && (
              <div className="text-cream/50 text-sm">Side Bet: ${myPlayer.sideBet}</div>
            )}
            <div className="flex items-center gap-2">
              <motion.div
                className="w-2 h-2 rounded-full bg-gold"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span className="text-cream/50 text-sm">Waiting for others to bet...</span>
            </div>

            <div className="flex gap-2 mt-2">
              {bettingStatus.map((p) => (
                <BetStatusPill key={p.id} player={p} />
              ))}
            </div>
          </div>
        ) : balance <= 0 ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="text-casino-red text-lg font-bold">Out of chips</div>
            <p className="text-cream/45 text-sm text-center max-w-xs">
              Request an additional buy-in and wait for the owner to approve it.
            </p>
            {isHost ? (
              <p className="text-cream/35 text-xs text-center max-w-xs">
                As owner, top up your stack from the ledger.
              </p>
            ) : myBuyInRequest ? (
              <div className="text-gold/80 text-sm font-medium">
                Request pending: ${myBuyInRequest.amount.toLocaleString()}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <label className="text-cream/45 text-xs uppercase tracking-wider">Amount</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gold text-xs">$</span>
                  <input
                    type="number"
                    min={1}
                    max={MAX_BUY_IN}
                    step={1}
                    value={normalizedBuyInRequestAmount || ''}
                    onChange={(e) => {
                      const next = parseInt(e.target.value, 10);
                      setBuyInRequestAmount(
                        Number.isFinite(next) ? Math.max(1, Math.min(MAX_BUY_IN, next)) : 1,
                      );
                    }}
                    className="w-28 bg-charcoal-light border border-charcoal-lighter rounded px-5 py-1.5
                      text-cream text-sm"
                  />
                </div>
                <motion.button
                  onClick={() => {
                    requestBuyIn(normalizedBuyInRequestAmount);
                    play('chip');
                  }}
                  disabled={!canRequestBuyIn}
                  className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${
                    canRequestBuyIn
                      ? 'bg-gradient-to-b from-blue-600 to-blue-800 text-white hover:from-blue-500 hover:to-blue-700 cursor-pointer'
                      : 'bg-charcoal-lighter text-cream/30 cursor-not-allowed'
                  }`}
                  whileHover={canRequestBuyIn ? { scale: 1.05 } : {}}
                  whileTap={canRequestBuyIn ? { scale: 0.95 } : {}}
                >
                  Request Buy-In
                </motion.button>
              </div>
            )}
          </div>
        ) : (
          <>
            <ChipSelector />

            <div className="flex items-center gap-3 sm:gap-6 flex-wrap justify-center">
              <div className="flex flex-col items-center">
                <span className="text-cream/50 text-xs uppercase tracking-wider mb-1">Per Hand</span>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={betInput}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="text-2xl sm:text-3xl font-bold text-gold"
                  >
                    ${betInput}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-cream/50 text-xs uppercase tracking-wider mb-1">Hands</span>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <motion.button
                      key={n}
                      onClick={() => { setNumHands(n); play('chip'); }}
                      disabled={n > maxHands}
                      className={`w-8 h-8 rounded-lg text-xs sm:text-sm font-bold transition-all duration-150
                        ${n === numHandsInput
                          ? 'bg-gold text-charcoal shadow-lg ring-2 ring-gold-light/40'
                          : n <= maxHands
                          ? 'bg-charcoal-lighter text-cream/60 hover:bg-charcoal-light hover:text-cream cursor-pointer'
                          : 'bg-charcoal-lighter/50 text-cream/15 cursor-not-allowed'
                        }
                      `}
                      whileTap={n <= maxHands ? { scale: 0.9 } : {}}
                    >
                      {n}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-cream/50 text-xs uppercase tracking-wider mb-1">Push 22 (11:1)</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setSideBetInput(Math.max(0, sideBetInput - 5)); play('chip'); }}
                    disabled={sideBetInput <= 0}
                    className="w-7 h-7 rounded-full bg-charcoal-lighter text-cream/70 text-sm font-bold
                      disabled:opacity-30 hover:bg-charcoal-light transition-colors"
                  >
                    −
                  </button>
                  <motion.span
                    key={sideBetInput}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="text-lg font-bold text-gold-light w-12 text-center"
                  >
                    ${sideBetInput}
                  </motion.span>
                  <button
                    onClick={() => { setSideBetInput(sideBetInput + 5); play('chip'); }}
                    disabled={balance - betInput * numHandsInput <= sideBetInput}
                    className="w-7 h-7 rounded-full bg-charcoal-lighter text-cream/70 text-sm font-bold
                      disabled:opacity-30 hover:bg-charcoal-light transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {numHandsInput > 1 && betInput > 0 && (
              <div className="text-cream/40 text-xs">
                Total: ${totalCost.toLocaleString()}
              </div>
            )}

            <div className="flex gap-2 sm:gap-3 flex-wrap justify-center">
              <BetButton
                onClick={() => { clearBet(); play('chip'); }}
                disabled={betInput === 0}
                variant="ghost"
              >
                Clear
              </BetButton>
              <BetButton
                onClick={() => { allIn(); play('chip'); }}
                disabled={balance <= 0}
                variant="red"
              >
                All In
              </BetButton>
              <motion.button
                onClick={() => { placeBet(); play('deal'); }}
                disabled={!canDeal}
                className={`w-full sm:w-auto max-w-[260px] px-7 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider
                  transition-all duration-200 border shadow-[0_12px_24px_rgba(0,0,0,0.3)]
                  ${canDeal
                    ? 'bg-gradient-to-b from-gold to-gold-dark border-gold-light/45 text-charcoal hover:from-gold-light hover:to-gold cursor-pointer'
                    : 'bg-charcoal-lighter border-cream/10 text-cream/30 cursor-not-allowed'
                  }`}
                whileHover={canDeal ? { scale: 1.05 } : {}}
                whileTap={canDeal ? { scale: 0.95 } : {}}
              >
                Place Bet
              </motion.button>
            </div>
          </>
        )}
      </div>

      <div className="hidden sm:block w-[48px]" />
    </div>
  );
}

function BetStatusPill({ player }: { player: { id: string; name: string; hasBet: boolean; isAway: boolean } }) {
  const label = player.isAway ? 'Away' : player.hasBet ? '✓' : '...';
  const style = player.isAway
    ? 'bg-amber-400/15 text-amber-400'
    : player.hasBet
    ? 'bg-casino-green/15 text-casino-green'
    : 'bg-charcoal-lighter text-cream/30';

  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${style}`}>
      {label} {player.name}
    </div>
  );
}

function EmoteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wide border border-gold-light/35
        bg-gradient-to-b from-gold to-gold-dark text-charcoal hover:from-gold-light hover:to-gold
        transition-all duration-200 shadow-[0_8px_18px_rgba(0,0,0,0.25)] cursor-pointer"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {label}
    </motion.button>
  );
}

function BetButton({ onClick, disabled, variant, children }: {
  onClick: () => void;
  disabled: boolean;
  variant: 'ghost' | 'red' | 'blue';
  children: React.ReactNode;
}) {
  const variantStyles = {
    ghost: 'bg-charcoal-lighter text-cream/70 hover:bg-charcoal-light',
    red: 'bg-gradient-to-b from-casino-red to-red-800 text-white hover:from-red-500 hover:to-red-700 shadow-lg',
    blue: 'bg-gradient-to-b from-blue-600 to-blue-800 text-white hover:from-blue-500 hover:to-blue-700 shadow-lg',
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg font-bold text-sm uppercase tracking-wider transition-all duration-200 border
        ${disabled
          ? 'bg-charcoal-lighter border-cream/10 text-cream/30 cursor-not-allowed opacity-50'
          : `cursor-pointer ${variantStyles[variant]}`
        }`}
      whileHover={!disabled ? { scale: 1.05 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
    >
      {children}
    </motion.button>
  );
}
