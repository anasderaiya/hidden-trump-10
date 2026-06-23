export type Suit = 'H' | 'D' | 'C' | 'S';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  id: string; // unique card code, e.g. "AH", "10D"
  suit: Suit;
  rank: Rank;
  value: number; // 2 to 14
}

export type RankName = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Master';

export interface Player {
  id: string;
  username: string;
  avatar: string; // avatar key, e.g., "avatar_1"
  cardBack: string; // e.g., "classic_blue"
  tableSkin: string; // e.g., "green_felt"
  coins: number;
  mmr: number;
  rankName: RankName;
  isBot: boolean;
  team?: 'A' | 'B'; // Team A (Pos 0, 2), Team B (Pos 1, 3)
  position?: number; // 0, 1, 2, 3
  isReady: boolean;
  connected: boolean;
}

export interface GameState {
  currentTurnPos: number; // 0, 1, 2, 3
  hiderId: string; // ID of player who hid the card
  isTrumpRevealed: boolean;
  trumpSuit: Suit | null; // Null until revealed
  leadSuit: Suit | null;
  currentTrick: {
    playerId: string;
    card: Card;
    position: number;
    username: string;
  }[];
  tricksWon: {
    A: number;
    B: number;
  };
  tensCaptured: {
    A: number;
    B: number;
  };
  capturedTensHistory: {
    suit: Suit;
    winningPlayerId: string;
    team: 'A' | 'B';
  }[];
  status: 'HIDING' | 'PLAYING' | 'FINISHED';
  winner: 'A' | 'B' | null;
  winReason: string | null;
  trickCount: number; // 0 to 13
  turnTimer: number; // seconds left for current turn
}

export interface Room {
  id: string;
  name: string;
  isPrivate: boolean;
  players: Player[];
  status: 'WAITING' | 'HIDING' | 'PLAYING' | 'FINISHED';
  gameState: GameState | null;
  spectators: { id: string; username: string }[];
}

export interface Message {
  id: string;
  senderName: string;
  senderId: string;
  text: string;
  isEmote?: boolean;
  timestamp: number;
}
