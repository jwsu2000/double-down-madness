// ─── Single Card Component with Flip Animation ───────────────────────────────

import { motion } from 'framer-motion';
import type { Card as CardType } from '../engine/deck';
import { suitSymbol, isSuitRed } from '../engine/deck';

interface CardProps {
  card: CardType;
  index: number;
  isWinner?: boolean;
  isBust?: boolean;
  delay?: number;
}

export default function Card({ card, index, isWinner, isBust, delay = 0 }: CardProps) {
  const isRed = isSuitRed(card.suit);
  const symbol = suitSymbol(card.suit);

  return (
    <motion.div
      className={`relative w-[70px] h-[100px] sm:w-[80px] sm:h-[115px] md:w-[90px] md:h-[130px] rounded-lg select-none
        ${isWinner ? 'glow-gold' : ''} ${isBust ? 'bust-tint' : ''}
      `}
      style={{
        perspective: '600px',
        marginLeft: index > 0 ? '-20px' : '0',
        zIndex: index,
      }}
      initial={{ x: 200, y: -100, rotate: 15, opacity: 0 }}
      animate={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 20,
        delay: delay,
      }}
    >
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: 'preserve-3d' }}
        initial={!card.faceUp ? { rotateY: 0 } : { rotateY: 0 }}
        animate={{ rotateY: card.faceUp ? 0 : 180 }}
        transition={{ duration: 0.4 }}
      >
        {/* Front face */}
        <div
          className="absolute inset-0 rounded-lg bg-white shadow-lg border border-gray-200 p-1.5 flex flex-col justify-between"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className={`text-sm sm:text-base font-bold leading-none ${isRed ? 'text-casino-red' : 'text-gray-900'}`}>
            <div>{card.rank}</div>
            <div className="text-xs sm:text-sm">{symbol}</div>
          </div>
          <div className={`text-2xl sm:text-3xl md:text-4xl text-center ${isRed ? 'text-casino-red' : 'text-gray-900'}`}>
            {symbol}
          </div>
          <div className={`text-sm sm:text-base font-bold leading-none self-end rotate-180 ${isRed ? 'text-casino-red' : 'text-gray-900'}`}>
            <div>{card.rank}</div>
            <div className="text-xs sm:text-sm">{symbol}</div>
          </div>
        </div>

        {/* Back face */}
        <div
          className="absolute inset-0 rounded-lg shadow-lg overflow-hidden"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: 'linear-gradient(135deg, #1a3a5c 25%, #2a5a8c 50%, #1a3a5c 75%)',
          }}
        >
          <div className="w-full h-full flex items-center justify-center">
            <div
              className="w-[85%] h-[85%] rounded border-2 border-gold/40"
              style={{
                background: `repeating-linear-gradient(
                  45deg,
                  transparent,
                  transparent 4px,
                  rgba(212, 168, 67, 0.15) 4px,
                  rgba(212, 168, 67, 0.15) 8px
                )`,
              }}
            >
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-gold/60 text-lg font-bold font-[Georgia]">DDM</div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
