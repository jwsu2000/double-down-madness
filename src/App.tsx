// ─── Double Down Madness — Multiplayer App ────────────────────────────────────

import { useCallback, useEffect, useRef } from 'react';
import { useGameStore, selectPhase, selectIsMyTurn, selectMyActions, useSettlementReady } from './hooks/useGameState';
import { useDealAnimation, DealAnimationProvider } from './hooks/useDealAnimation';
import { useSound } from './hooks/useSound';
import Lobby from './components/Lobby';
import Header from './components/Header';
import DealerArea from './components/DealerArea';
import PlayerArea from './components/PlayerArea';
import ActionButtons from './components/ActionButtons';
import BetArea from './components/BetArea';
import ResultBanner from './components/ResultBanner';
import RulesDrawer from './components/RulesDrawer';
import StatsPanel from './components/StatsPanel';
import WinChipsAnimation from './components/WinChipsAnimation';
import RoomLobby from './components/RoomLobby';
import ProvablyFairDrawer from './components/ProvablyFairDrawer';
import HandHistory from './components/HandHistory';
import LedgerDrawer from './components/LedgerDrawer';
import ChatDrawer from './components/ChatDrawer';
import BasicStrategyDrawer from './components/BasicStrategyDrawer';
import DiceRollOverlay from './components/DiceRollOverlay';

export default function App() {
  const tableState = useGameStore((s) => s.tableState);
  const phase = useGameStore(selectPhase);
  const isMyTurn = useGameStore(selectIsMyTurn);
  const myActions = useGameStore(selectMyActions);
  const hit = useGameStore((s) => s.hit);
  const stand = useGameStore((s) => s.stand);
  const doDouble = useGameStore((s) => s.doDouble);
  const placeBet = useGameStore((s) => s.placeBet);
  const readyForNext = useGameStore((s) => s.readyForNext);
  const betInput = useGameStore((s) => s.betInput);
  const settlementReady = useSettlementReady();
  const dealAnimation = useDealAnimation();
  const { play } = useSound();
  const prevDealtRef = useRef(0);

  // Play deal sound for each card dealt during deal animation
  useEffect(() => {
    if (dealAnimation.totalDealt > prevDealtRef.current) {
      play('deal');
    }
    prevDealtRef.current = dealAnimation.totalDealt;
  }, [dealAnimation.totalDealt, play]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (dealAnimation.isDealing) return; // Block input during deal animation
      const key = e.key.toLowerCase();

      if (phase === 'PLAYER_TURN' && isMyTurn) {
        if (key === 'h' && myActions.hit) hit();
        if (key === 's' && myActions.stand) stand();
        if (key === 'd' && myActions.double) doDouble();
      }

      if (phase === 'BETTING' && key === ' ' && betInput > 0) {
        e.preventDefault();
        placeBet();
      }

      if (phase === 'SETTLEMENT' && settlementReady) {
        if (key === ' ' || key === 'enter') {
          e.preventDefault();
          readyForNext();
        }
      }
    },
    [phase, isMyTurn, settlementReady, myActions, hit, stand, doDouble, placeBet, readyForNext, betInput, dealAnimation.isDealing],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Not connected to a room yet — show Lobby
  if (!tableState) {
    return <Lobby />;
  }

  // In the room lobby — show player list + start button
  if (tableState.phase === 'LOBBY') {
    return (
      <>
        <RoomLobby />
        <RulesDrawer />
        <ProvablyFairDrawer />
        <BasicStrategyDrawer />
        <ChatDrawer />
        <DiceRollOverlay />
      </>
    );
  }

  // Game in progress
  return (
    <DealAnimationProvider value={dealAnimation}>
    <div className="min-h-screen flex flex-col bg-navy">
      <Header />

      <main className="flex-1 felt-bg relative flex flex-col">
        {/* Dealer Section */}
        <div className="flex-1 flex items-end justify-center pb-2 min-h-[160px] sm:min-h-[200px]">
          <DealerArea />
        </div>

        {/* Felt Divider */}
        <div className="w-full flex items-center px-8 py-1">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
          <div className="px-4 text-gold/30 text-[10px] uppercase tracking-[0.3em] font-[Georgia]">
            Double Down Madness
          </div>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
        </div>

        {/* Player Section */}
        <div className="flex-1 flex items-start justify-center pt-2 min-h-[160px] sm:min-h-[200px]">
          <PlayerArea />
        </div>

        <ResultBanner />
      </main>

      {/* Action Buttons */}
      <div className="bg-charcoal/80 backdrop-blur-sm border-t border-charcoal-lighter">
        <ActionButtons />
      </div>

      {/* Bet Area */}
      <div className="bg-charcoal border-t border-charcoal-lighter">
        <BetArea />
      </div>

      {/* Keyboard hints */}
      {phase === 'BETTING' && (
        <div className="bg-charcoal text-center py-1">
          <span className="text-cream/20 text-[10px]">
            Press SPACE to place bet &bull; H = Hit &bull; S = Stand &bull; D = Double
          </span>
        </div>
      )}

      <WinChipsAnimation />
      <HandHistory />
      <LedgerDrawer />
      <RulesDrawer />
      <ProvablyFairDrawer />
      <StatsPanel />
      <BasicStrategyDrawer />
      <ChatDrawer />
    </div>
    </DealAnimationProvider>
  );
}
