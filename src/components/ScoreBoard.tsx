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
    <div id="game-score-board" className="bg-slate-900/90 backdrop-blur-md border border-slate-800 p-4 rounded-2xl shadow-xl flex flex-col md:flex-row items-center gap-6 justify-between">
      
      {/* Team score trackers */}
      <div className="flex items-center gap-10 w-full md:w-auto justify-around md:justify-start">
        {/* Team A */}
        <div className={`flex flex-col items-center p-3 rounded-xl border ${localPlayerTeam === 'A' ? 'border-blue-400 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'border-slate-800 bg-slate-950/40'}`}>
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
            Team A {localPlayerTeam === 'A' && "⭐"}
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-black text-white font-mono">{gameState.tricksWon.A}</span>
            <span className="text-xs text-slate-400 font-bold uppercase">Tricks</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1 text-[10px] font-extrabold text-blue-400 bg-blue-500/15 px-2.5 py-0.5 rounded-full border border-blue-500/25">
            🏆 {gameState.tensCaptured.A} / 4 Tens
          </div>
        </div>

        {/* Divider icon */}
        <div className="flex flex-col items-center">
          <Trophy size={20} className="text-amber-400 animate-pulse drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
          <span className="text-[9px] text-slate-500 uppercase font-mono mt-1 font-bold">VS</span>
        </div>

        {/* Team B */}
        <div className={`flex flex-col items-center p-3 rounded-xl border ${localPlayerTeam === 'B' ? 'border-amber-400 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'border-slate-800 bg-slate-950/40'}`}>
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
            Team B {localPlayerTeam === 'B' && "⭐"}
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-black text-white font-mono">{gameState.tricksWon.B}</span>
            <span className="text-xs text-slate-400 font-bold uppercase">Tricks</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1 text-[10px] font-extrabold text-amber-400 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/25">
            🏆 {gameState.tensCaptured.B} / 4 Tens
          </div>
        </div>
      </div>

      {/* Ten Cards Capture Status Board */}
      <div className="flex-1 w-full flex flex-col items-center md:items-start border-t md:border-t-0 md:border-l border-slate-800 pt-3.5 md:pt-0 md:pl-6">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">
          Captured TEN Trackers [10♥, 10♦, 10♣, 10♠]
        </span>
        <div className="grid grid-cols-4 gap-2 w-full max-w-sm">
          {tens.map(ten => (
            <div
              key={ten.suit}
              className={`relative border rounded-xl p-2 flex flex-col items-center justify-center font-mono overflow-hidden transition-all duration-300
                ${ten.capturedBy === 'A' ? 'bg-blue-900/20 border-blue-500/50 shadow-[inset_0_0_10px_rgba(59,130,246,0.1)]' : ''}
                ${ten.capturedBy === 'B' ? 'bg-amber-900/20 border-amber-500/50 shadow-[inset_0_0_10px_rgba(245,158,11,0.1)]' : ''}
                ${!ten.capturedBy ? 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700' : ''}`}
            >
              <span className={`text-sm sm:text-base font-extrabold ${ten.color}`}>10{ten.symbol}</span>
              <span className={`text-[8px] font-bold mt-1 text-center truncate w-full uppercase ${ten.capturedBy ? 'text-white' : 'text-slate-500'}`}>
                {ten.capturedBy ? `Team ${ten.capturedBy}` : "Active"}
              </span>
              
              {/* Colored status dot indicator */}
              <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full 
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

