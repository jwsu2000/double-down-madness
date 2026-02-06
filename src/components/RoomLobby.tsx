// ─── Room Lobby: Waiting Room Before the Game Starts ──────────────────────────

import { motion } from 'framer-motion';
import { useGameStore } from '../hooks/useGameState';

export default function RoomLobby() {
  const tableState = useGameStore((s) => s.tableState);
  const myPlayerId = useGameStore((s) => s.myPlayerId);
  const startRound = useGameStore((s) => s.startRound);
  const leaveRoom = useGameStore((s) => s.leaveRoom);
  const toggleRules = useGameStore((s) => s.toggleRules);
  const toggleStrategy = useGameStore((s) => s.toggleStrategy);
  const toggleChat = useGameStore((s) => s.toggleChat);
  const unreadChatCount = useGameStore((s) => s.unreadChatCount);

  if (!tableState) return null;

  const isHost = myPlayerId === tableState.hostId;
  const players = tableState.players.filter((p) => p.connected);

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
                    {player.id === myPlayerId && (
                      <span className="text-cream/30 text-[10px] ml-2">(You)</span>
                    )}
                  </div>
                </div>
                <div className={`text-xs ${
                  !player.connected ? 'text-cream/30' :
                  player.isAway ? 'text-amber-400' :
                  'text-casino-green'
                }`}>
                  {!player.connected ? 'Disconnected' : player.isAway ? 'Away' : 'Ready'}
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
