import React from 'react';
import { Card as CardType, Suit } from '../types';
import { motion } from 'motion/react';

interface CardItemProps {
  card: CardType;
  faceUp?: boolean;
  playable?: boolean;
  cardBack?: string;
  onClick?: () => void;
  className?: string;
  index?: number;
}

export const cardBackStyles: { [key: string]: string } = {
  classic_blue: "from-blue-700 via-blue-800 to-indigo-900 border-yellow-400 bg-radial",
  classic_red: "from-red-700 via-red-800 to-rose-950 border-yellow-400 bg-radial",
  dragon_black: "from-zinc-900 via-neutral-900 to-black border-red-600",
  solar_gold: "from-amber-500 via-yellow-600 to-orange-600 border-white",
};

export function getSuitSymbol(suit: Suit): string {
  switch (suit) {
    case 'H': return '♥';
    case 'D': return '♦';
    case 'C': return '♣';
    case 'S': return '♠';
  }
}

export function getSuitColor(suit: Suit): string {
  return suit === 'H' || suit === 'D' ? 'text-red-500' : 'text-neutral-800';
}

export const CardItem: React.FC<CardItemProps> = ({
  card,
  faceUp = true,
  playable = false,
  cardBack = 'classic_blue',
  onClick,
  className = '',
  index = 0
}) => {
  const isRed = card.suit === 'H' || card.suit === 'D';

  if (!faceUp) {
    const selectedBackStyle = cardBackStyles[cardBack] || cardBackStyles.classic_blue;
    // Elegant back design
    return (
      <motion.div
        layoutId={`card-back-${card.id}`}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ delay: index * 0.02, type: 'spring', damping: 15 }}
        className={`relative w-14 h-20 sm:w-16 sm:h-24 md:w-20 md:h-28 rounded-xl border-2 flex flex-col justify-between p-1 select-none shadow-md bg-gradient-to-br ${selectedBackStyle} cursor-not-allowed ${className}`}
      >
        <div className="absolute inset-1.5 border border-dashed border-white/20 rounded-lg flex items-center justify-center">
          {/* Symmetrical logo/symbol */}
          <span className="text-white/40 font-serif text-lg sm:text-xl font-bold">10</span>
        </div>
      </motion.div>
    );
  }

  // Face Up Design
  const suitSymbol = getSuitSymbol(card.suit);

  return (
    <motion.button
      id={`btn-card-${card.id}`}
      layoutId={`card-front-${card.id}`}
      whileHover={playable ? { y: -12, scale: 1.05 } : {}}
      whileTap={playable ? { scale: 0.95 } : {}}
      disabled={!playable}
      onClick={onClick}
      className={`relative w-14 h-20 sm:w-16 sm:h-24 md:w-20 md:h-28 rounded-xl bg-white border-2 flex flex-col justify-between p-1.5 select-none shadow-md cursor-pointer transition-shadow duration-200
        ${playable ? 'border-yellow-400 shadow-lg shadow-yellow-100 ring-2 ring-yellow-400/30' : 'border-neutral-200'}
        ${!playable && onClick ? 'opacity-60 saturate-50' : 'opacity-100'} 
        ${className}`}
    >
      {/* Top Left */}
      <div className="flex flex-col items-center leading-none">
        <span className={`text-xs sm:text-sm md:text-base font-bold ${getSuitColor(card.suit)}`}>
          {card.rank}
        </span>
        <span className={`text-xxs sm:text-xs ${getSuitColor(card.suit)}`}>
          {suitSymbol}
        </span>
      </div>

      {/* Symmetrical Center Symbol */}
      <div className="flex items-center justify-center self-center scale-110 sm:scale-125 md:scale-150">
        <span className={`text-lg sm:text-xl md:text-3xl filter drop-shadow-sm font-sans ${getSuitColor(card.suit)}`}>
          {suitSymbol}
        </span>
      </div>

      {/* Bottom Right (Inverted) */}
      <div className="flex flex-col items-center leading-none rotate-180 self-end">
        <span className={`text-xs sm:text-sm md:text-base font-bold ${getSuitColor(card.suit)}`}>
          {card.rank}
        </span>
        <span className={`text-xxs sm:text-xs ${getSuitColor(card.suit)}`}>
          {suitSymbol}
        </span>
      </div>
    </motion.button>
  );
};
