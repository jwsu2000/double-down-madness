// ─── Room Lobby: Waiting Room Before the Game Starts ──────────────────────────

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, selectChipDenominations } from '../hooks/useGameState';
import CasinoChip from './CasinoChip';

// Common chip values the host can toggle
const AVAILABLE_DENOMS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000];

export default function RoomLobby() {
  const tableState = useGameStore((s) => s.tableState);
  const myPlayerId = useGameStore((s) => s.myPlayerId);
  const startRound = useGameStore((s) => s.startRound);
  const leaveRoom = useGameStore((s) => s.leaveRoom);
  const toggleRules = useGameStore((s) => s.toggleRules);
  const toggleStrategy = useGameStore((s) => s.toggleStrategy);
  const toggleChat = useGameStore((s) => s.toggleChat);
  const unreadChatCount = useGameStore((s) => s.unreadChatCount);
  const chipDenominations = useGameStore(selectChipDenominations);
  const setChipDenoms = useGameStore((s) => s.setChipDenoms);

  const [showChipSettings, setShowChipSettings] = useState(false);

  if (!tableState) return null;

  const isHost = myPlayerId === tableState.hostId;
  const players = tableState.players.filter((p) => p.connected);

  // Build the set of active denominations (from server state)
  const activeSet = new Set(chipDenominations);

  const handleToggleDenom = (value: number) => {
    const newDenoms = activeSet.has(value)
      ? chipDenominations.filter((d) => d !== value)
      : [...chipDenominations, value].sort((a, b) => a - b);

    // Must have at least 1 denomination
    if (newDenoms.length < 1) return;
    setChipDenoms(newDenoms);
  };

  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center p-4">
      {/* Title */}
      <motion.div
        className="text-center mb-8"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <h1 className="text-gold font-bold text-3xl font-[Georgia]">Double Down Madness</h1>
        <p className="text-cream/30 text-xs mt-1 uppercase tracking-widest">Waiting Room</p>
      </motion.div>

      {/* Room Card */}
      <motion.div
        className="w-full max-w-md bg-charcoal rounded-2xl border border-charcoal-lighter shadow-2xl overflow-hidden"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        {/* Room Code Banner */}
        <div className="bg-gradient-to-b from-gold/10 to-transparent border-b border-charcoal-lighter px-6 py-4 flex items-center justify-between">
          <div>
            <span className="text-cream/40 text-xs uppercase tracking-wider">Room Code</span>
            <div className="text-gold font-mono text-3xl font-bold tracking-[0.2em]">
              {tableState.roomCode}
            </div>
          </div>
          <div className="text-right">
            <span className="text-cream/40 text-xs uppercase tracking-wider">Players</span>
            <div className="text-cream text-lg font-bold">{players.length}/5</div>
          </div>
        </div>

        {/* Player List */}
        <div className="p-6">
          <h3 className="text-cream/50 text-xs uppercase tracking-wider mb-3">At the Table</h3>
          <div className="space-y-2">
            {tableState.players.map((player) => (
              <motion.div
                key={player.id}
                className={`flex items-center justify-between px-4 py-3 rounded-lg
                  ${player.id === myPlayerId
                    ? 'bg-gold/10 border border-gold/30'
                    : 'bg-charcoal-light border border-charcoal-lighter'
                  }
                  ${!player.connected ? 'opacity-40' : ''}
                `}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: player.connected ? 1 : 0.4 }}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar Circle */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                      ${player.id === myPlayerId ? 'bg-gold text-charcoal' : 'bg-charcoal-lighter text-cream/60'}
                    `}
                  >
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className={`text-sm font-medium ${player.id === myPlayerId ? 'text-gold' : 'text-cream'}`}>
                      {player.name}
                    </span>
                    {player.id === tableState.hostId && (
                      <span className="text-gold/60 text-[10px] ml-2 uppercase">Host</span>
                    )}
                    {player.id === tableState.buttonPlayerId && (
                      <span className="inline-flex items-center gap-0.5 ml-2">
                        <span className="w-3.5 h-3.5 rounded-full bg-gold text-charcoal text-[7px] font-black flex items-center justify-center">D</span>
                        <span className="text-gold/60 text-[10px] uppercase">Dealer</span>
                      </span>
                    )}
                    {player.id === myPlayerId && (
                      <span className="text-cream/30 text-[10px] ml-2">(You)</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-cream/30 text-xs font-mono">${player.buyIn.toLocaleString()}</span>
                  <div className={`text-xs ${
                    !player.connected ? 'text-cream/30' :
                    player.isAway ? 'text-amber-400' :
                    'text-casino-green'
                  }`}>
                    {!player.connected ? 'Disconnected' : player.isAway ? 'Away' : 'Ready'}
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Empty Seats */}
            {Array.from({ length: 5 - tableState.players.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center justify-center px-4 py-3 rounded-lg border border-dashed border-charcoal-lighter/50"
              >
                <span className="text-cream/15 text-xs">Empty Seat</span>
              </div>
            ))}
          </div>

          {/* Share Instructions */}
          <div className="mt-4 text-center">
            <p className="text-cream/30 text-xs">
              Share the room code <span className="text-gold font-mono font-bold">{tableState.roomCode}</span> with friends to join
            </p>
          </div>

          {/* Chip Denomination Settings (Host Only) */}
          {isHost && (
            <div className="mt-4">
              <button
                onClick={() => setShowChipSettings((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg
                  bg-charcoal-light/50 border border-charcoal-lighter hover:border-gold/30
                  transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gold/60 group-hover:text-gold transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-cream/50 text-xs uppercase tracking-wider font-medium group-hover:text-cream/70 transition-colors">
                    Chip Denominations
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-cream/30 text-[10px]">
                    {chipDenominations.length} active
                  </span>
                  <motion.svg
                    className="w-4 h-4 text-cream/30"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    animate={{ rotate: showChipSettings ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </motion.svg>
                </div>
              </button>

              <AnimatePresence>
                {showChipSettings && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3 px-1">
                      <div className="flex flex-wrap gap-2 justify-center">
                        {AVAILABLE_DENOMS.map((value) => {
                          const isActive = activeSet.has(value);
                          return (
                            <motion.button
                              key={value}
                              onClick={() => handleToggleDenom(value)}
                              className="relative"
                              whileTap={{ scale: 0.9 }}
                              title={isActive ? `Remove $${value} chip` : `Add $${value} chip`}
                            >
                              <div className={`transition-all duration-150 ${
                                isActive ? 'opacity-100' : 'opacity-25 grayscale'
                              }`}>
                                <CasinoChip value={value} size={44} />
                              </div>
                              {isActive && (
                                <motion.div
                                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-casino-green
                                    flex items-center justify-center"
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  exit={{ scale: 0 }}
                                >
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </motion.div>
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                      <p className="text-cream/20 text-[10px] text-center mt-2">
                        Tap to toggle. At least 1 denomination required.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Non-host chip info */}
          {!isHost && (
            <div className="mt-4 flex items-center gap-2 justify-center">
              <span className="text-cream/30 text-[10px] uppercase tracking-wider">Chips:</span>
              <div className="flex gap-1">
                {chipDenominations.map((d) => (
                  <span key={d} className="text-cream/50 text-xs font-mono bg-charcoal-lighter/50 px-1.5 py-0.5 rounded">
                    ${d >= 1000 ? `${d / 1000}k` : d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 mt-6">
            <motion.button
              onClick={leaveRoom}
              className="flex-1 py-3 rounded-lg font-bold text-sm uppercase tracking-wider
                bg-charcoal-lighter text-cream/60 hover:text-cream hover:bg-charcoal-light cursor-pointer transition-colors"
              whileTap={{ scale: 0.98 }}
            >
              Leave
            </motion.button>

            <motion.button
              onClick={toggleRules}
              className="py-3 px-4 rounded-lg text-sm uppercase tracking-wider
                bg-charcoal-lighter text-cream/60 hover:text-cream hover:bg-charcoal-light cursor-pointer transition-colors"
              whileTap={{ scale: 0.98 }}
            >
              Rules
            </motion.button>

            <motion.button
              onClick={toggleStrategy}
              className="py-3 px-4 rounded-lg text-sm uppercase tracking-wider
                bg-charcoal-lighter text-cream/60 hover:text-cream hover:bg-charcoal-light cursor-pointer transition-colors"
              whileTap={{ scale: 0.98 }}
            >
              Strategy
            </motion.button>

            <motion.button
              onClick={toggleChat}
              className="relative py-3 px-4 rounded-lg text-sm uppercase tracking-wider
                bg-charcoal-lighter text-cream/60 hover:text-cream hover:bg-charcoal-light cursor-pointer transition-colors"
              whileTap={{ scale: 0.98 }}
            >
              Chat
              {unreadChatCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-casino-red text-cream text-[10px] font-bold rounded-full leading-none px-1">
                  {unreadChatCount > 9 ? '9+' : unreadChatCount}
                </span>
              )}
            </motion.button>

            {isHost && (
              <motion.button
                onClick={startRound}
                disabled={players.length < 1}
                className={`flex-1 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all
                  ${players.length >= 1
                    ? 'bg-gradient-to-b from-gold to-gold-dark text-charcoal hover:from-gold-light cursor-pointer shadow-lg'
                    : 'bg-charcoal-lighter text-cream/30 cursor-not-allowed'
                  }`}
                whileHover={players.length >= 1 ? { scale: 1.02 } : {}}
                whileTap={players.length >= 1 ? { scale: 0.98 } : {}}
              >
                Start Game
              </motion.button>
            )}

            {!isHost && (
              <div className="flex-1 py-3 rounded-lg text-sm text-center text-cream/40">
                Waiting for host to start...
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Rules Drawer */}
      {/* Rendered globally in App, but toggle works here via the button */}
    </div>
  );
}
