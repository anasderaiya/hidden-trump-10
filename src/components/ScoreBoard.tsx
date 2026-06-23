import React from 'react';
import { GameState, Suit } from '../types';
import { Trophy } from 'lucide-react';

interface ScoreBoardProps {
  gameState: GameState;
  localPlayerTeam?: 'A' | 'B';
}

const SUIT_ICONS = {
  H: { symbol: '♥', color: 'text-rose-500', name: 'Hearts' },
  D: { symbol: '♦', color: 'text-amber-500', name: 'Diamonds' },
  C: { symbol: '♣', color: 'text-cyan-400', name: 'Clubs' },
  S: { symbol: '♠', color: 'text-violet-400', name: 'Spades' }
};

export const ScoreBoard: React.FC<ScoreBoardProps> = ({
  gameState,
  localPlayerTeam = 'A'
}) => {
  const tens = (['H', 'D', 'C', 'S'] as Suit[]).map(suit => {
    // Check if was captured
    const capture = gameState.capturedTensHistory.find(h => h.suit === suit);
    return {
      suit,
      capturedBy: capture ? capture.team : null,
      winnerId: capture ? capture.winningPlayerId : null,
      ...SUIT_ICONS[suit]
    };
  });

  return (
    <div id="game-score-board" className="bg-slate-900/90 backdrop-blur-md border border-slate-800 p-1.5 sm:p-4 rounded-xl sm:rounded-2xl shadow-xl flex flex-row items-center justify-between gap-2">
      
      {/* 1. Scores display */}
      <div className="flex items-center gap-2 sm:gap-10">
        
        {/* Team A */}
        <div className={`flex flex-row sm:flex-col items-center gap-1.5 sm:gap-1 p-1 sm:p-3 rounded-lg sm:rounded-xl border text-[9px] sm:text-[10px] ${localPlayerTeam === 'A' ? 'border-blue-400 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'border-slate-800 bg-slate-950/40'}`}>
          <span className="text-slate-400 font-extrabold uppercase">
            {localPlayerTeam === 'A' ? "⭐ T-A" : "T-A"}
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-sm sm:text-3xl font-black text-white font-mono">{gameState.tricksWon.A}</span>
            <span className="text-[9px] text-slate-500 font-bold uppercase hidden sm:inline">Tricks</span>
          </div>
          <div className="text-[8px] sm:text-[10px] font-extrabold text-blue-400 bg-blue-500/15 px-1.5 sm:px-2.5 py-0.5 rounded-full border border-blue-500/25">
            🏆{gameState.tensCaptured.A} <span className="hidden sm:inline">/ 4 Tens</span>
          </div>
        </div>

        {/* VS icon */}
        <div className="flex flex-col items-center justify-center">
          <Trophy size={12} className="text-amber-400 sm:w-5 sm:h-5" />
        </div>

        {/* Team B */}
        <div className={`flex flex-row sm:flex-col items-center gap-1.5 sm:gap-1 p-1 sm:p-3 rounded-lg sm:rounded-xl border text-[9px] sm:text-[10px] ${localPlayerTeam === 'B' ? 'border-amber-400 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'border-slate-800 bg-slate-950/40'}`}>
          <span className="text-slate-400 font-extrabold uppercase">
            {localPlayerTeam === 'B' ? "⭐ T-B" : "T-B"}
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-sm sm:text-3xl font-black text-white font-mono">{gameState.tricksWon.B}</span>
            <span className="text-[9px] text-slate-500 font-bold uppercase hidden sm:inline">Tricks</span>
          </div>
          <div className="text-[8px] sm:text-[10px] font-extrabold text-amber-400 bg-amber-500/15 px-1.5 sm:px-2.5 py-0.5 rounded-full border border-amber-500/25">
            🏆{gameState.tensCaptured.B} <span className="hidden sm:inline">/ 4 Tens</span>
          </div>
        </div>

      </div>

      {/* 2. Captured Tens Trackers */}
      <div className="flex flex-row items-center border-l border-slate-800 pl-2 sm:pl-6 flex-1 justify-end">
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mr-3 hidden md:block">
          Tens captured:
        </span>
        <div className="flex gap-1 sm:gap-2">
          {tens.map(ten => (
            <div
              key={ten.suit}
              className={`relative border rounded-lg sm:rounded-xl p-1 sm:p-2 flex flex-col items-center justify-center font-mono overflow-hidden transition-all duration-300 w-9 sm:w-16 h-7 sm:h-12
                ${ten.capturedBy === 'A' ? 'bg-blue-900/20 border-blue-500/50 shadow-[inset_0_0_10px_rgba(59,130,246,0.1)]' : ''}
                ${ten.capturedBy === 'B' ? 'bg-amber-900/20 border-amber-500/50 shadow-[inset_0_0_10px_rgba(245,158,11,0.1)]' : ''}
                ${!ten.capturedBy ? 'bg-slate-950/60 border-slate-800/80' : ''}`}
            >
              <span className={`text-[10px] sm:text-base font-extrabold ${ten.color}`}>10{ten.symbol}</span>
              <span className={`text-[7px] font-bold mt-0.5 text-center truncate w-full uppercase hidden sm:block ${ten.capturedBy ? 'text-white' : 'text-slate-500'}`}>
                {ten.capturedBy ? `Team ${ten.capturedBy}` : "Active"}
              </span>
              
              {/* Status dot */}
              <span className={`absolute top-0.5 right-0.5 sm:top-1 sm:right-1 w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full 
                ${ten.capturedBy === 'A' ? 'bg-blue-450 shadow-[0_0_5px_#3b82f6]' : ''}
                ${ten.capturedBy === 'B' ? 'bg-amber-450 shadow-[0_0_5px_#f59e0b]' : ''}
                ${!ten.capturedBy ? 'bg-slate-700' : ''}`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

