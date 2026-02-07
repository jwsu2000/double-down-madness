// â”€â”€â”€ Player Action Buttons - Multiplayer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { motion } from 'framer-motion';
import { useGameStore, selectPhase, selectIsMyTurn, selectMyActions, selectMyNextDouble, selectMyIsSpectator } from '../hooks/useGameState';
import { useDealAnimationContext } from '../hooks/useDealAnimation';
import { useSound } from '../hooks/useSound';

export default function ActionButtons() {
  const phase = useGameStore(selectPhase);
  const isMyTurn = useGameStore(selectIsMyTurn);
  const myActions = useGameStore(selectMyActions);
  const nextDouble = useGameStore(selectMyNextDouble);
  const tableState = useGameStore((s) => s.tableState);
  const myPlayerId = useGameStore((s) => s.myPlayerId);
  const hit = useGameStore((s) => s.hit);
  const stand = useGameStore((s) => s.stand);
  const doDouble = useGameStore((s) => s.doDouble);
  const insurance = useGameStore((s) => s.insurance);
  const isSpectator = useGameStore(selectMyIsSpectator);
  const { play } = useSound();
  const { isDealing } = useDealAnimationContext();

  // While the deal animation is running, show "Dealing..." instead of action buttons
  if (isDealing) {
    return (
      <div className="flex items-center justify-center gap-2 py-3">
        <motion.div
          className="flex items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-gold"
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: 0 }}
          />
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-gold"
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}
          />
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-gold"
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }}
          />
          <span className="text-gold/60 text-sm uppercase tracking-widest font-medium ml-1">
            Dealing
          </span>
        </motion.div>
      </div>
    );
  }

  if (isSpectator) {
    if (phase === 'PLAYER_TURN') {
      const activePlayer = tableState?.players.find((p) => p.id === tableState.activePlayerId);
      return (
        <div className="flex flex-col items-center gap-1 py-3">
          <span className="text-cream/45 text-xs uppercase tracking-wider">Spectating</span>
          <span className="text-cream/55 text-sm">
            {activePlayer ? `${activePlayer.name}'s turn` : 'Watching hand'}
          </span>
        </div>
      );
    }
    if (phase === 'INSURANCE_OFFERED') {
      return (
        <div className="flex flex-col items-center gap-1 py-3">
          <span className="text-cream/45 text-xs uppercase tracking-wider">Spectating</span>
          <span className="text-cream/55 text-sm">Players are deciding insurance...</span>
        </div>
      );
    }
    return null;
  }

  // Insurance phase
  if (phase === 'INSURANCE_OFFERED') {
    const myPlayer = tableState?.players.find((p) => p.id === myPlayerId);
    const alreadyDecided = myPlayer && (myPlayer.hands.length === 0 || tableState?.phase !== 'INSURANCE_OFFERED');

    // Check if I already decided (via the insuranceDecided flag - not in protocol, but hasBet is)
    // For simplicity, once I click, the server will update and the phase may change
    return (
      <div className="flex gap-3 justify-center py-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3"
        >
          <p className="text-gold text-sm font-medium">Insurance? (Dealer shows Ace)</p>
          {!alreadyDecided ? (
            <div className="flex gap-3">
              <ActionButton
                label="Take Insurance"
                onClick={() => { insurance(true); play('chip'); }}
                color="gold"
              />
              <ActionButton
                label="No Insurance"
                onClick={() => { insurance(false); play('chip'); }}
                color="default"
              />
            </div>
          ) : (
            <p className="text-cream/40 text-sm">Waiting for others...</p>
          )}
        </motion.div>
      </div>
    );
  }

  if (phase !== 'PLAYER_TURN') return null;

  // Whose turn is it?
  const activePlayer = tableState?.players.find((p) => p.id === tableState.activePlayerId);
  const activePlayerName = activePlayer?.name ?? 'Unknown';

  // Not my turn - show waiting message
  if (!isMyTurn) {
    return (
      <div className="flex flex-col items-center gap-1 py-3">
        <div className="flex items-center gap-2">
          <motion.div
            className="w-2 h-2 rounded-full bg-gold"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span className="text-cream/50 text-sm">
            Waiting for <span className="text-gold font-medium">{activePlayerName}</span>...
          </span>
        </div>
      </div>
    );
  }

  // My turn - show action buttons
  const myPlayerData = tableState?.players.find((p) => p.id === myPlayerId);
  const activeHandIdx = tableState?.activeHandIndex ?? 0;
  const totalHands = myPlayerData?.hands.length ?? 1;
  const isMultiHand = totalHands > 1;

  return (
    <motion.div
      className="flex flex-col items-center gap-2 py-3"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-gold/70 text-xs font-medium text-center px-2">
        Your Turn{isMultiHand ? ` - Hand ${activeHandIdx + 1}/${totalHands}` : ''}
      </div>
      <div className="flex gap-2 sm:gap-3 justify-center flex-wrap">
        <ActionButton
          label="Hit (H)"
          onClick={() => { hit(); play('deal'); }}
          disabled={!myActions.hit}
          color="green"
        />
        <ActionButton
          label="Stand (S)"
          onClick={() => { stand(); play('chip'); }}
          disabled={!myActions.stand}
          color="red"
        />
        <ActionButton
          label={`Double $${nextDouble} (D)`}
          onClick={() => { doDouble(); play('chip'); }}
          disabled={!myActions.double}
          color="gold"
        />
      </div>
    </motion.div>
  );
}

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  color?: 'green' | 'red' | 'gold' | 'default';
}

function ActionButton({ label, onClick, disabled, color = 'default' }: ActionButtonProps) {
  const colorClasses = {
    green: 'from-casino-green to-emerald-700 text-white hover:from-emerald-400 hover:to-emerald-600',
    red: 'from-casino-red to-red-800 text-white hover:from-red-500 hover:to-red-700',
    gold: 'from-gold to-gold-dark text-charcoal hover:from-gold-light hover:to-gold',
    default: 'from-charcoal-lighter to-charcoal-light text-cream hover:from-charcoal-light hover:to-charcoal-lighter',
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={`
        px-3.5 py-2.5 sm:px-6 sm:py-3 rounded-lg font-bold text-[11px] sm:text-sm uppercase tracking-wider
        bg-gradient-to-b shadow-lg transition-all duration-150
        ${disabled ? 'opacity-30 cursor-not-allowed from-charcoal-lighter to-charcoal text-cream/40' : `cursor-pointer ${colorClasses[color]}`}
      `}
      whileHover={!disabled ? { scale: 1.05, y: -2 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
    >
      {label}
    </motion.button>
  );
}

