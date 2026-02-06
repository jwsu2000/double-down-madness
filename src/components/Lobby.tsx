// ─── Lobby: Create or Join a Room ─────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../hooks/useGameState';
import { STARTING_BALANCE } from '../engine/rules';

export default function Lobby() {
  const connected = useGameStore((s) => s.connected);
  const connecting = useGameStore((s) => s.connecting);
  const connect = useGameStore((s) => s.connect);
  const createRoom = useGameStore((s) => s.createRoom);
  const joinRoom = useGameStore((s) => s.joinRoom);
  const errorMessage = useGameStore((s) => s.errorMessage);

  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [buyIn, setBuyIn] = useState(STARTING_BALANCE);
  const [mode, setMode] = useState<'menu' | 'join'>('menu');

  // Auto-connect on mount
  useEffect(() => {
    connect();
  }, [connect]);

  const canCreate = connected && name.trim().length > 0 && buyIn > 0;
  const canJoin = connected && name.trim().length > 0 && roomCode.trim().length === 4 && buyIn > 0;

  const handleCreate = () => {
    if (canCreate) createRoom(name.trim(), buyIn);
  };

  const handleJoin = () => {
    if (canJoin) joinRoom(roomCode.trim(), name.trim(), buyIn);
  };

  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center p-4">
      {/* Title */}
      <motion.div
        className="text-center mb-10"
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-gold font-bold text-4xl sm:text-5xl font-[Georgia] tracking-tight">
          Double Down
        </h1>
        <p className="text-cream/60 text-lg mt-1">Madness</p>
        <p className="text-cream/30 text-xs mt-3 uppercase tracking-widest">
          Multiplayer Blackjack
        </p>
      </motion.div>

      {/* Connection Status */}
      <div className="flex items-center gap-2 mb-6">
        <div
          className={`w-2 h-2 rounded-full ${
            connected ? 'bg-casino-green' : connecting ? 'bg-gold animate-pulse' : 'bg-casino-red'
          }`}
        />
        <span className="text-cream/40 text-xs">
          {connected ? 'Connected' : connecting ? 'Connecting...' : 'Disconnected'}
        </span>
      </div>

      {/* Main Card */}
      <motion.div
        className="w-full max-w-sm bg-charcoal rounded-2xl border border-charcoal-lighter shadow-2xl overflow-hidden"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="p-6">
          {/* Name Input */}
          <div className="mb-5">
            <label className="block text-cream/50 text-xs uppercase tracking-wider mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 12))}
              placeholder="Enter your name..."
              className="w-full bg-navy/80 text-cream text-sm px-4 py-3 rounded-lg border border-charcoal-lighter
                focus:border-gold/50 focus:outline-none transition-colors placeholder-cream/20"
              maxLength={12}
              autoFocus
            />
          </div>

          {/* Buy-In Input */}
          <div className="mb-5">
            <label className="block text-cream/50 text-xs uppercase tracking-wider mb-2">
              Buy-In
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gold font-bold text-sm pointer-events-none">$</span>
              <input
                type="number"
                value={buyIn || ''}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setBuyIn(isNaN(val) ? 0 : Math.max(0, val));
                }}
                placeholder="1000"
                min={1}
                className="w-full bg-navy/80 text-cream text-sm pl-8 pr-4 py-3 rounded-lg border border-charcoal-lighter
                  focus:border-gold/50 focus:outline-none transition-colors placeholder-cream/20
                  [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            {buyIn > 0 && buyIn < 10 && (
              <p className="text-gold/50 text-[10px] mt-1">Minimum recommended: $10</p>
            )}
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {errorMessage && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mb-4 bg-casino-red/20 border border-casino-red/40 rounded-lg px-3 py-2 text-casino-red text-sm"
              >
                {errorMessage}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Menu Mode */}
          {mode === 'menu' && (
            <div className="space-y-3">
              <motion.button
                onClick={handleCreate}
                disabled={!canCreate}
                className={`w-full py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all
                  ${canCreate
                    ? 'bg-gradient-to-b from-gold to-gold-dark text-charcoal hover:from-gold-light hover:to-gold cursor-pointer shadow-lg'
                    : 'bg-charcoal-lighter text-cream/30 cursor-not-allowed'
                  }`}
                whileHover={canCreate ? { scale: 1.02 } : {}}
                whileTap={canCreate ? { scale: 0.98 } : {}}
              >
                Create Table
              </motion.button>

              <motion.button
                onClick={() => setMode('join')}
                disabled={!connected || !name.trim()}
                className={`w-full py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all
                  ${connected && name.trim()
                    ? 'bg-charcoal-lighter text-cream/80 hover:bg-charcoal-light cursor-pointer border border-charcoal-lighter'
                    : 'bg-charcoal-lighter/50 text-cream/20 cursor-not-allowed'
                  }`}
                whileHover={connected && name.trim() ? { scale: 1.02 } : {}}
                whileTap={connected && name.trim() ? { scale: 0.98 } : {}}
              >
                Join Table
              </motion.button>
            </div>
          )}

          {/* Join Mode */}
          {mode === 'join' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-3"
            >
              <label className="block text-cream/50 text-xs uppercase tracking-wider mb-2">
                Room Code
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
                placeholder="ABCD"
                className="w-full bg-navy/80 text-cream text-2xl font-mono text-center px-4 py-3 rounded-lg border border-charcoal-lighter
                  focus:border-gold/50 focus:outline-none transition-colors placeholder-cream/10 tracking-[0.3em]"
                maxLength={4}
                autoFocus
              />

              <div className="flex gap-2">
                <motion.button
                  onClick={() => { setMode('menu'); setRoomCode(''); }}
                  className="flex-1 py-3 rounded-lg font-bold text-sm uppercase tracking-wider
                    bg-charcoal-lighter text-cream/60 hover:text-cream cursor-pointer transition-colors"
                  whileTap={{ scale: 0.98 }}
                >
                  Back
                </motion.button>
                <motion.button
                  onClick={handleJoin}
                  disabled={!canJoin}
                  className={`flex-1 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all
                    ${canJoin
                      ? 'bg-gradient-to-b from-gold to-gold-dark text-charcoal hover:from-gold-light cursor-pointer shadow-lg'
                      : 'bg-charcoal-lighter text-cream/30 cursor-not-allowed'
                    }`}
                  whileHover={canJoin ? { scale: 1.02 } : {}}
                  whileTap={canJoin ? { scale: 0.98 } : {}}
                >
                  Join
                </motion.button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Footer */}
      <p className="text-cream/15 text-xs mt-8 text-center">
        Provably fair blackjack with friends
      </p>
    </div>
  );
}
