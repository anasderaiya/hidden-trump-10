import React from 'react';
import { Player } from '../types';
import { motion } from 'motion/react';
import { User, Wifi, WifiOff } from 'lucide-react';

interface PlayerSeatProps {
  player: Player;
  isCurrentTurn: boolean;
  isActiveUser: boolean;
  handSize: number;
  timer: number;
  talkingBubble?: string | null;
  className?: string;
}

export const avatarColors: { [key: string]: string } = {
  avatar_1: "bg-teal-500 border-teal-300",
  avatar_2: "bg-indigo-500 border-indigo-300",
  avatar_3: "bg-rose-500 border-rose-300",
  avatar_4: "bg-amber-500 border-amber-300",
  avatar_5: "bg-purple-500 border-purple-300",
  avatar_6: "bg-pink-500 border-pink-300",
};

export const PlayerSeat: React.FC<PlayerSeatProps> = ({
  player,
  isCurrentTurn,
  isActiveUser,
  handSize,
  timer,
  talkingBubble = null,
  className = ""
}) => {
  const avatarClass = avatarColors[player.avatar] || avatarColors.avatar_1;

  // Render RankBadge
  const getRankBadgeClass = (rank: string) => {
    switch (rank) {
      case 'Master': return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'Diamond': return 'bg-cyan-100 text-cyan-700 border-cyan-300';
      case 'Platinum': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'Gold': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'Silver': return 'bg-slate-100 text-slate-700 border-slate-300';
      default: return 'bg-orange-100 text-orange-700 border-orange-300';
    }
  };

  return (
    <div id={`player-seat-${player.id}`} className={`relative flex flex-col items-center p-3 rounded-2xl transition-all duration-300 ${className} ${isCurrentTurn ? 'scale-105' : 'scale-100'}`}>
      
      {/* Turn Timer circular spinner / boundary glow */}
      {isCurrentTurn && (
        <span className="absolute inset-0 rounded-2xl border-2 border-yellow-400 animate-pulse ring-4 ring-yellow-400/20" />
      )}

      {/* Profile Avatar Card */}
      <div className="relative">
        <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center border-4 text-white font-bold text-xl relative shadow-md ${avatarClass}`}>
          {player.isBot ? "🤖" : player.username.substring(0, 2).toUpperCase()}
          
          {/* Connection status dot wrapper */}
          {!player.isBot && (
            <span className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center shadow-sm ${player.connected ? 'bg-green-500' : 'bg-red-500'}`}>
              {player.connected ? <Wifi size={8} className="text-white" /> : <WifiOff size={8} className="text-white" />}
            </span>
          )}
        </div>

        {/* Dynamic active status or Timer Badge */}
        {isCurrentTurn && (
          <div className="absolute -top-2 -right-2 bg-yellow-400 text-neutral-900 border border-yellow-500 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold animate-bounce shadow">
            {timer}
          </div>
        )}
      </div>

      {/* Username / Teammate Tag */}
      <div className="mt-2 text-center flex flex-col items-center">
        <div className="flex items-center gap-1">
          <span className="text-xs sm:text-sm font-semibold text-white drop-shadow max-w-[120px] truncate">
            {player.username}
          </span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold shadow-xs ${player.team === 'A' ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
            T-{player.team}
          </span>
        </div>

        {/* Small rank tag & card count */}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`text-[9px] font-bold px-1 rounded border ${getRankBadgeClass(player.rankName)}`}>
            {player.mmr} MMR
          </span>
          <span className="text-[10px] text-white/80 font-mono">
            🎴 {handSize} cards
          </span>
        </div>
      </div>

      {/* Speech Chat Bubble popup */}
      {talkingBubble && (
        <motion.div
          initial={{ opacity: 0, scale: 0.7, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: -20 }}
          exit={{ opacity: 0, scale: 0.7 }}
          className="absolute -top-16 bg-white text-neutral-900 px-3.5 py-1.5 rounded-2xl shadow-xl text-xs font-medium z-40 max-w-[180px] text-center border border-neutral-100 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-8 after:border-transparent after:border-t-white"
        >
          {talkingBubble}
        </motion.div>
      )}
    </div>
  );
};
