import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, selectMyIsAway, selectMyIsSpectator, useDisplayBalance } from '../hooks/useGameState';

export default function Header() {
  const balance = useDisplayBalance();
  const soundEnabled = useGameStore((s) => s.soundEnabled);
  const toggleSound = useGameStore((s) => s.toggleSound);
  const toggleStats = useGameStore((s) => s.toggleStats);
  const toggleRules = useGameStore((s) => s.toggleRules);
  const toggleStrategy = useGameStore((s) => s.toggleStrategy);
  const toggleProvablyFair = useGameStore((s) => s.toggleProvablyFair);
  const toggleHistory = useGameStore((s) => s.toggleHistory);
  const toggleLedger = useGameStore((s) => s.toggleLedger);
  const toggleChat = useGameStore((s) => s.toggleChat);
  const unreadChatCount = useGameStore((s) => s.unreadChatCount);
  const leaveRoom = useGameStore((s) => s.leaveRoom);
  const toggleAway = useGameStore((s) => s.toggleAway);
  const isAway = useGameStore(selectMyIsAway);
  const isSpectator = useGameStore(selectMyIsSpectator);
  const tableState = useGameStore((s) => s.tableState);
  const errorMessage = useGameStore((s) => s.errorMessage);

  const roomCode = tableState?.roomCode ?? '';
  const connectedPlayers = tableState?.players.filter((p) => p.connected).length ?? 0;
  const connectedSpectators = tableState?.spectators?.filter((s) => s.connected).length ?? 0;

  return (
    <header
      className="bg-charcoal/90 backdrop-blur-sm border-b border-charcoal-lighter px-3 sm:px-4 pb-2 sm:pb-3"
      style={{ paddingTop: 'calc(0.5rem + var(--safe-top))' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="text-gold font-bold text-base sm:text-xl font-[Georgia] tracking-tight shrink-0">
            DDM
          </div>
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 bg-charcoal-lighter/60 rounded-lg px-2.5 py-1">
              <span className="text-cream/40 text-[10px] uppercase">Room</span>
              <span className="text-gold font-mono font-bold text-xs sm:text-sm tracking-wider">{roomCode}</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-casino-green shrink-0" />
              <span className="text-cream/45 text-[11px] sm:text-xs">
                {connectedPlayers} player{connectedPlayers !== 1 ? 's' : ''}
                {connectedSpectators > 0
                  ? ` + ${connectedSpectators} spectator${connectedSpectators !== 1 ? 's' : ''}`
                  : ''}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end shrink-0">
          <span className="text-cream/40 text-[10px] uppercase tracking-wider">
            {isSpectator ? 'Mode' : 'Balance'}
          </span>
          {isSpectator ? (
            <span className="text-cream/70 font-semibold text-sm sm:text-base">Spectating</span>
          ) : (
            <AnimatePresence mode="wait">
              <motion.span
                key={balance}
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 10, opacity: 0 }}
                className="text-gold font-bold text-base sm:text-xl"
              >
                ${balance.toLocaleString()}
              </motion.span>
            </AnimatePresence>
          )}
        </div>
      </div>

      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-2 text-xs text-casino-red bg-casino-red/10 px-2.5 py-1.5 rounded"
          >
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-2 overflow-x-auto pb-1 no-scrollbar">
        <div className="flex items-center gap-1.5 min-w-max pr-1">
          <HeaderBtn onClick={toggleHistory} title="Hand History">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </HeaderBtn>
          <HeaderBtn onClick={toggleLedger} title="Ledger">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
          </HeaderBtn>
          <HeaderBtn onClick={toggleRules} title="Rules">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </HeaderBtn>
          <HeaderBtn onClick={toggleStrategy} title="Basic Strategy">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </HeaderBtn>
          <HeaderBtn onClick={toggleProvablyFair} title="Provably Fair">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </HeaderBtn>
          <HeaderBtn onClick={toggleStats} title="Stats">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </HeaderBtn>

          <div className="relative lg:hidden">
            <HeaderBtn onClick={toggleChat} title="Chat">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </HeaderBtn>
            {unreadChatCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-casino-red text-cream text-[10px] font-bold rounded-full leading-none px-1">
                {unreadChatCount > 9 ? '9+' : unreadChatCount}
              </span>
            )}
          </div>

          <HeaderBtn onClick={toggleSound} title={soundEnabled ? 'Mute' : 'Unmute'}>
            {soundEnabled ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            )}
          </HeaderBtn>

          {!isSpectator && (
            <button
              onClick={toggleAway}
              title={isAway ? 'Back to Table' : 'Go Away'}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 whitespace-nowrap
                ${isAway
                  ? 'bg-gold/20 text-gold border border-gold/30 hover:bg-gold/30'
                  : 'text-cream/60 hover:text-gold hover:bg-charcoal-lighter border border-transparent'
                }`}
            >
              {isAway ? 'Back' : 'Away'}
            </button>
          )}

          <HeaderBtn onClick={leaveRoom} title="Leave">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </HeaderBtn>
        </div>
      </div>
    </header>
  );
}

function HeaderBtn({ onClick, title, children }: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-2 rounded-lg text-cream/60 hover:text-gold hover:bg-charcoal-lighter transition-all duration-150 shrink-0"
    >
      {children}
    </button>
  );
}
