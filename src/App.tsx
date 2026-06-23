import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Play, Users, Trophy, Settings, HelpCircle, 
  Sparkles, ShieldAlert, ChevronRight, Check, 
  Volume2, VolumeX, LogOut, ArrowRight, Share2, 
  Crown, ArrowLeft, RefreshCw, Send, Lock, Compass, Smile
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Custom type imports
import { Card, Player, Room, GameState, Message, RankName } from './types';
import { CardItem, getSuitSymbol, getSuitColor, cardBackStyles } from './components/CardItem';
import { PlayerSeat } from './components/PlayerSeat';
import { ChatBoard } from './components/ChatBoard';
import { ScoreBoard } from './components/ScoreBoard';

// Synth audio manager for retro game sound effects using native Web Audio API
class SoundFX {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  constructor() {
    this.enabled = localStorage.getItem('ht10_sfx_enabled') !== 'false';
  }

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  playTick() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  playShuffle() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120 + i * 80, now + i * 0.05);
      gain.gain.setValueAtTime(0.04, now + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.04);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.04);
    }
  }

  playCardPlay() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(450, this.ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  playReveal() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc1.frequency.setValueAtTime(440, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.25);
    osc2.frequency.setValueAtTime(554, now);
    osc2.frequency.exponentialRampToValueAtTime(1109, now + 0.25);
    
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc1.start();
    osc2.start();
    osc1.stop(now + 0.3);
    osc2.stop(now + 0.3);
  }

  playWin() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C major chord
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.12);
      gain.gain.setValueAtTime(0.07, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.4);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.4);
    });
  }

  playLose() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = [293.66, 277.18, 261.63, 220.00]; // Melancholic downward
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.15);
      gain.gain.setValueAtTime(0.08, now + idx * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.15);
      osc.stop(now + idx * 0.15 + 0.4);
    });
  }
}

const sfx = new SoundFX();

// Standard Table Skin Styles
const tableSkins: { [key: string]: { name: string; class: string; border: string; circle: string } } = {
  green_felt: { name: "Green Felt Classic", class: "felt-green", border: "border-emerald-600/30", circle: "bg-emerald-950/25" },
  midnight_blue: { name: "Midnight Felt", class: "felt-blue", border: "border-blue-600/30", circle: "bg-blue-950/25" },
  charcoal_wood: { name: "Charcoal Obsidian", class: "felt-wood", border: "border-neutral-600/30", circle: "bg-neutral-950/25" },
  royal_red: { name: "Imperial Ruby", class: "felt-red", border: "border-rose-600/30", circle: "bg-rose-950/25" }
};

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) || 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000' 
    : window.location.origin);

export default function App() {
  // Screens navigation
  const [currentScreen, setCurrentScreen] = useState<'SPLASH' | 'LOGIN' | 'HOME' | 'LOBBY' | 'GAMEPLAY' | 'RESULTS'>('SPLASH');
  
  // Real-time connections
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // User Profile
  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState("avatar_1");
  const [cardBack, setCardBack] = useState("classic_blue");
  const [tableSkin, setTableSkin] = useState("green_felt");
  const [coins, setCoins] = useState(500);
  const [mmr, setMmr] = useState(1000);
  const [rankName, setRankName] = useState<RankName>("Bronze");

  // Multi-lobby parameters
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [hands, setHands] = useState<{ [playerId: string]: Card[] }>({});
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [announcements, setAnnouncements] = useState<string | null>(null);
  
  // Visual bubbles timers
  const [bubbleTalkState, setBubbleTalkState] = useState<{ [playerId: string]: string }>({});

  // Leaderboard data
  const [leaderboard, setLeaderboard] = useState<{ id: string; username: string; mmr: number; rankName: RankName }[]>([]);

  // Local turn configurations
  const [timerProgress, setTimerProgress] = useState(20);
  const [dealAnimationActive, setDealAnimationActive] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [sfxToggle, setSfxToggle] = useState(sfx.enabled);

  // Home view selected tab
  const [homeTab, setHomeTab] = useState<'arena' | 'rankings' | 'cosmetics' | 'howtoplay'>('arena');

  // Input fields
  const [lobbyCodeInput, setLobbyCodeInput] = useState("");
  const [customRoomName, setCustomRoomName] = useState("");
  const [customRoomPrivate, setCustomRoomPrivate] = useState(false);

  // UI modal references
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Initial State bootstrapping
  useEffect(() => {
    // Generate UUID or load saved
    let savedId = localStorage.getItem('ht10_user_id');
    if (!savedId) {
      savedId = 'usr_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('ht10_user_id', savedId);
    }
    setUserId(savedId);

    const savedName = localStorage.getItem('ht10_username') || `Guest_${Math.floor(Math.random() * 8999 + 1000)}`;
    const savedAvatar = localStorage.getItem('ht10_avatar') || `avatar_${Math.floor(Math.random() * 5 + 1)}`;
    const savedCardBack = localStorage.getItem('ht10_card_back') || 'classic_blue';
    const savedTableSkin = localStorage.getItem('ht10_table_skin') || 'green_felt';

    setUsername(savedName);
    setAvatar(savedAvatar);
    setCardBack(savedCardBack);
    setTableSkin(savedTableSkin);

    // Socket.io initialization
    const socketInstance = io(BACKEND_URL, {
      reconnectionAttempts: 5,
      timeout: 10000
    });

    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setIsConnected(true);
      // Auto register current user profile
      socketInstance.emit('user:login', { id: savedId, username: savedName, avatar: savedAvatar });
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    // Handle Profile sync results
    socketInstance.on('user:profile-synced', ({ player }: { player: Player }) => {
      setCoins(player.coins);
      setMmr(player.mmr);
      setRankName(player.rankName);
      setCardBack(player.cardBack);
      setTableSkin(player.tableSkin);
    });

    // Handle Room Lobby updates
    socketInstance.on('room:updated', ({ room: updatedRoom }: { room: any }) => {
      setRoom(updatedRoom);
      setActiveRoomId(updatedRoom.id);
      
      // Separate hands and normal profiles
      if (updatedRoom.hands) {
        setHands(updatedRoom.hands);
      }

      // Check gaming layout transition
      if (updatedRoom.status === 'HIDING' || updatedRoom.status === 'PLAYING') {
        if (currentScreen !== 'GAMEPLAY') {
          setCurrentScreen('GAMEPLAY');
          triggerAnnounce("Match Commenced! Trump state is hiding...");
        }
      } else if (updatedRoom.status === 'FINISHED') {
        setCurrentScreen('RESULTS');
      } else if (updatedRoom.status === 'WAITING') {
        setCurrentScreen('LOBBY');
      }
    });

    // Handle game countdown clocks
    socketInstance.on('room:timer-tick', ({ turnTimer }: { turnTimer: number }) => {
      setTimerProgress(turnTimer);
      if (turnTimer <= 3) {
        sfx.playTick();
      }
    });

    // Animated Dealing Sound triggers
    socketInstance.on('game:deal-animation', ({ delay }: { delay: number }) => {
      setDealAnimationActive(true);
      sfx.playShuffle();
      setTimeout(() => setDealAnimationActive(false), delay);
    });

    socketInstance.on('game:card-played-anim', ({ playerId, card }: { playerId: string, card: Card }) => {
      sfx.playCardPlay();
    });

    // Animated Trick gathered sweeps
    socketInstance.on('game:trick-winner-anim', ({ winningPlayerId, team, logMessage }: any) => {
      triggerAnnounce(logMessage);
    });

    // Reveal Trump custom flash
    socketInstance.on('game:trump-revealed-anim', ({ revealedBy, card, logMessage }: any) => {
      sfx.playReveal();
      triggerAnnounce(`🎺 TRUMP OPENED! [${card.rank}${getSuitSymbol(card.suit)}] by ${revealedBy}`);
    });

    // Game Errors alerts
    socketInstance.on('game:error', ({ message }: { message: string }) => {
      triggerToast(message);
    });

    // Interactive custom Chat streams + floating bubble triggers
    socketInstance.on('chat:message', (message: Message) => {
      setChatMessages(prev => [...prev, message].slice(-50)); // limit 50 messages
      
      // Floating bubble trigger on the seats!
      if (message.senderId !== 'system') {
        setBubbleTalkState(prev => ({
          ...prev,
          [message.senderId]: message.text
        }));

        // clear bubble in 3.5 seconds
        setTimeout(() => {
          setBubbleTalkState(prev => {
            const copy = { ...prev };
            delete copy[message.senderId];
            return copy;
          });
        }, 3500);
      }
    });

    // Rewards sound effects
    socketInstance.on('user:rewards', ({ isWinner, coinsEarned }: any) => {
      if (isWinner) {
        sfx.playWin();
      } else {
        sfx.playLose();
      }
    });

    // Fetch Leaderboard on connection
    fetchLeaderboard();

    // Fade out splash screen automatically
    const timer = setTimeout(() => {
      setCurrentScreen('LOGIN');
    }, 2500);

    return () => {
      socketInstance.disconnect();
      clearTimeout(timer);
    };
  }, []);

  // Fetch LeaderboardREST call
  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/leaderboard`);
      const data = await res.json();
      if (data && data.entries) {
        setLeaderboard(data.entries);
      }
    } catch (e) {
      console.error("Leaderboard query failed", e);
    }
  };

  // Toast controller
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Big screen announcements banner
  const triggerAnnounce = (msg: string) => {
    setAnnouncements(msg);
    setTimeout(() => setAnnouncements(null), 4500);
  };

  // SFX Controller toggle
  const toggleSfx = () => {
    const val = !sfxToggle;
    sfx.enabled = val;
    setSfxToggle(val);
    localStorage.setItem('ht10_sfx_enabled', String(val));
    sfx.playTick();
  };

  // Synchronize custom user cosmetics profile
  const handleUpdateCosmetics = (newBack: string, newSkin: string) => {
    setCardBack(newBack);
    setTableSkin(newSkin);
    localStorage.setItem('ht10_card_back', newBack);
    localStorage.setItem('ht10_table_skin', newSkin);

    if (socket && isConnected) {
      socket.emit('user:update-cosmetics', { cardBack: newBack, tableSkin: newSkin });
    }
    triggerToast("Cosmetics updated successfully!");
  };

  // Multi-lobby creations and joins
  const handleCreateRoom = () => {
    if (!socket || !isConnected) return;
    sfx.playTick();
    socket.emit('room:create', {
      name: customRoomName.trim() || `${username}'s Lounge`,
      isPrivate: customRoomPrivate,
      playerProfile: { id: userId, username, avatar, cardBack, tableSkin, coins, mmr, rankName }
    });
    setCustomRoomName("");
    setChatMessages([]);
  };

  const handleJoinRoom = (rCode: string) => {
    if (!socket || !isConnected || !rCode.trim()) return;
    sfx.playTick();
    socket.emit('room:join', {
      roomId: rCode.trim().toUpperCase(),
      playerProfile: { id: userId, username, avatar, cardBack, tableSkin, coins, mmr, rankName }
    });
    setLobbyCodeInput("");
    setChatMessages([]);
  };

  const handleQuickMatch = () => {
    if (!socket || !isConnected) return;
    sfx.playTick();
    triggerToast("Searching for a 4-player Arena table...");
    socket.emit('room:quick-match', {
      playerProfile: { id: userId, username, avatar, cardBack, tableSkin, coins, mmr, rankName }
    });
    setChatMessages([]);
  };

  const handleLeaveRoom = () => {
    if (!socket || !isConnected) return;
    sfx.playTick();
    socket.emit('room:leave');
    setRoom(null);
    setActiveRoomId(null);
    setChatMessages([]);
    setCurrentScreen('HOME');
  };

  const handleToggleReady = () => {
    if (!socket || !isConnected) return;
    sfx.playTick();
    socket.emit('room:toggle-ready');
  };

  const handleAddBots = () => {
    if (!socket || !isConnected) return;
    sfx.playTick();
    socket.emit('room:fill-bots');
  };

  // Game Action triggers: Hiding phase card selection
  const handleHideCard = (cardId: string) => {
    if (!socket || !isConnected) return;
    socket.emit('game:hide-card', { cardId });
  };

  // Game Action triggers: Card discard
  const handlePlayCard = (cardId: string) => {
    if (!socket || !isConnected) return;
    socket.emit('game:play-card', { cardId });
  };

  // Game Action triggers: reveal hidden face down card
  const handleRevealTrump = () => {
    if (!socket || !isConnected) return;
    socket.emit('game:reveal-trump');
  };

  // Chat message send
  const handleSendMessage = (text: string, isEmote?: boolean) => {
    if (!socket || !isConnected) return;
    socket.emit('chat:send', { text, isEmote });
  };

  // Handle local logins & Guest profile registration
  const handleGuestLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    
    sfx.playTick();
    localStorage.setItem('ht10_username', username.trim());
    localStorage.setItem('ht10_avatar', avatar);
    
    if (socket && isConnected) {
      socket.emit('user:login', { id: userId, username: username.trim(), avatar });
    }
    
    setCurrentScreen('HOME');
    fetchLeaderboard();
  };

  // Helper function to render avatar presets
  const renderAvatarOption = (avKey: string, emoji: string) => {
    const isSelected = avatar === avKey;
    return (
      <button
        key={avKey}
        type="button"
        onClick={() => setAvatar(avKey)}
        className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-xl transition-all cursor-pointer ${isSelected ? 'border-blue-400 bg-blue-500/20 scale-110 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'}`}
      >
        {emoji}
      </button>
    );
  };

  // Rotation math for standard 2v2 seating layout (keeps actual client at BOTTOM)
  const getRotatedPlayers = (): { seatPlayer: Player; clientSeatIndex: number }[] => {
    if (!room) return [];
    
    const rotated: { seatPlayer: Player; clientSeatIndex: number }[] = [];
    const localPlayer = room.players.find(p => p.id === userId);
    const localPos = localPlayer ? localPlayer.position || 0 : 0;

    // Build seats bottom, right, top, left (0, 1, 2, 3 positions relative to self)
    for (let offset = 0; offset < 4; offset++) {
      const targetPos = (localPos + offset) % 4;
      const targetPlayer = room.players.find(p => p.position === targetPos);
      
      if (targetPlayer) {
        rotated.push({
          seatPlayer: targetPlayer,
          clientSeatIndex: offset // 0 = Bottom (self), 1 = Right, 2 = Top (mate), 3 = Left
        });
      }
    }
    return rotated;
  };

  // Helper list of avatars mapping
  const avatarsMap: { [key: string]: string } = {
    avatar_1: "🤠", avatar_2: "🥷", avatar_3: "🧙", avatar_4: "🧛", avatar_5: "👩‍🚀", avatar_6: "🦁"
  };

  return (
    <div className="relative min-h-screen bg-slate-950/20 font-sans text-slate-100 overflow-x-hidden flex flex-col selection:bg-blue-500 selection:text-white">
      
      {/* Global Status Banner (glassmorphic heading) */}
      <header className="bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 sticky top-0 px-6 py-3.5 flex items-center justify-between z-50 shadow-lg">
        <div className="flex items-center gap-2.5">
          <Sparkles className="text-blue-400 animate-pulse w-5 h-5 sm:w-6 sm:h-6 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
          <h1 className="text-sm sm:text-lg font-black tracking-widest bg-gradient-to-r from-blue-400 via-sky-305 to-sky-500 bg-clip-text text-transparent uppercase font-sans">
            Hidden Trump 10
          </h1>
        </div>

        <div className="flex items-center gap-4">
          {/* Connection badge */}
          <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full flex items-center gap-1.5 border ${isConnected ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            {isConnected ? "MULTIPLAYER ONLINE" : "OFFLINE CONNECTING"}
          </span>

          {/* Audio controller */}
          <button
            onClick={toggleSfx}
            className="text-slate-400 hover:text-white transition-all cursor-pointer p-1.5 rounded-xl bg-slate-900/50 hover:bg-slate-800 border border-slate-800/80"
          >
            {sfxToggle ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>
      </header>

      {/* Main Container with dynamic screens */}
      <main className="flex-1 flex flex-col relative w-full max-w-7xl mx-auto px-4 py-4 sm:py-6">
        
        {/* Alerts / Error Toasts */}
        {toastMessage && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-red-600 border border-red-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-2xl z-50 animate-bounce flex items-center gap-2">
            <ShieldAlert size={14} />
            {toastMessage}
          </div>
        )}

        {/* Huge screen announcements slider */}
        {announcements && (
          <div className="fixed inset-x-0 top-1/4 flex justify-center items-center pointer-events-none z-50">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1.1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-neutral-900/95 border-2 border-yellow-400 px-6 py-4 rounded-2xl shadow-yellow-500/20 shadow-2xl text-center max-w-lg"
            >
              <p className="text-yellow-400 text-xs uppercase font-bold tracking-widest mb-1">REF BULLETIN</p>
              <h2 className="text-white text-sm sm:text-base font-black tracking-tight">{announcements}</h2>
            </motion.div>
          </div>
        )}

        <AnimatePresence mode="wait">
          
          {/* ==================== 1. SPLASH SCREEN ==================== */}
          {currentScreen === 'SPLASH' && (
            <motion.div
              key="splash"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center text-center py-16"
            >
              <div className="relative mb-6">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-blue-600 to-sky-500 flex items-center justify-center shadow-xl shadow-blue-500/20 ring-4 ring-blue-500/30 animate-pulse">
                  <span className="text-white font-black text-4xl sm:text-5xl font-mono tracking-tighter">10</span>
                </div>
                {/* floating suits background */}
                <span className="absolute -top-3 -left-3 text-rose-500 text-3xl opacity-75 transform rotate-12 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]">♥</span>
                <span className="absolute -bottom-2 -left-4 text-violet-400 text-2xl opacity-60 transform -rotate-45">♠</span>
                <span className="absolute -top-3 -right-4 text-cyan-400 text-2xl opacity-65 transform rotate-45">♣</span>
                <span className="absolute -bottom-2 -right-3 text-amber-500 text-3xl opacity-75 transform -rotate-12 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]">♦</span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-widest bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent uppercase mb-2">
                Hidden Trump 10
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 max-w-xs font-mono font-medium">
                Ultimate 2v2 Mobile Multiplayer Arena
              </p>

              <div className="w-12 h-1 rounded bg-blue-500 mt-6 animate-pulse shadow-[0_0_8px_#3b82f6]" />
            </motion.div>
          )}

          {/* ==================== 2. LOGIN / PROFILE SETUP SCREEN ==================== */}
          {currentScreen === 'LOGIN' && (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex-1 flex items-center justify-center py-4"
            >
              <div className="w-full max-w-md bg-slate-900/95 border border-slate-800 p-6 sm:p-8 rounded-3xl shadow-2xl backdrop-blur-xl relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-500 via-sky-400 to-indigo-500" />
                
                <div className="text-center mb-6">
                  <span className="text-3xl filter drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">😎</span>
                  <h3 className="text-xl font-black mt-2 text-white uppercase tracking-wider">Create Guest Identity</h3>
                  <p className="text-xs text-slate-400 mt-1">Customize your nickname and avatar to join rooms</p>
                </div>

                <form onSubmit={handleGuestLogin} className="space-y-5">
                  
                  {/* Name field */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nickname</label>
                    <input
                      id="input-username"
                      type="text"
                      maxLength={14}
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="Enter username..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-semibold font-sans"
                      required
                    />
                  </div>

                  {/* Avatar Picker list */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Choose Avatar</label>
                    <div className="flex gap-2.5 flex-wrap justify-between">
                      {Object.keys(avatarsMap).map(avKey => (
                        renderAvatarOption(avKey, avatarsMap[avKey])
                      ))}
                    </div>
                  </div>

                  {/* Submission play */}
                  <button
                    id="btn-login-submit"
                    type="submit"
                    className="w-full btn-vibrant-tactile font-black py-3.5 px-5 rounded-xl flex items-center justify-center gap-2 cursor-pointer mt-6 uppercase text-sm select-none"
                  >
                    Enter Hidden Arena <ArrowRight size={16} />
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {/* ==================== 3. HOME DASHBOARD ==================== */}
          {currentScreen === 'HOME' && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col md:flex-row gap-6 py-2"
            >
              
              {/* Left Column: Player Profile details */}
              <div className="w-full md:w-80 flex flex-col gap-5">
                
                {/* Profile card metadata details */}
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col items-center text-center relative overflow-hidden shadow-xl shadow-slate-950/40">
                  <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-500 via-sky-450 to-indigo-500" />
                  
                  {/* Avatar */}
                  <div className="w-20 h-20 rounded-full border-4 border-slate-850 flex items-center justify-center text-4xl shadow-md bg-slate-950 mb-3 animate-pulse">
                    {avatarsMap[avatar] || "🤠"}
                  </div>

                  <span className="text-lg font-black text-white leading-none mb-1 font-sans">
                    {username}
                  </span>
                  
                  {/* Rank designation */}
                  <span className="text-[10px] font-black text-blue-400 uppercase bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full inline-block mt-1 tracking-wider">
                    👑 {rankName} Player
                  </span>

                  {/* Coins & MMR */}
                  <div className="grid grid-cols-2 gap-4 w-full mt-5 border-t border-slate-800 pt-4">
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] font-black text-slate-550 uppercase tracking-widest leading-none">Gold Coins</span>
                      <span className="text-base font-black text-amber-400 mt-1">🪙 {coins}</span>
                    </div>
                    <div className="flex flex-col items-center border-l border-slate-800">
                      <span className="text-[9px] font-black text-slate-550 uppercase tracking-widest leading-none">Combat MMR</span>
                      <span className="text-base font-black text-blue-400 mt-1">⚔️ {mmr}</span>
                    </div>
                  </div>
                </div>

                {/* Vertical menu navigation */}
                <div className="bg-slate-900 border border-slate-805 p-2.5 rounded-2xl space-y-1 shadow-md">
                  <button
                    onClick={() => { setHomeTab('arena'); sfx.playTick(); }}
                    className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${homeTab === 'arena' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10' : 'text-slate-400 hover:text-white hover:bg-slate-800/80'}`}
                  >
                    <Compass size={16} /> Battle Arena
                  </button>
                  <button
                    onClick={() => { setHomeTab('rankings'); sfx.playTick(); fetchLeaderboard(); }}
                    className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${homeTab === 'rankings' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10' : 'text-slate-400 hover:text-white hover:bg-slate-800/80'}`}
                  >
                    <Trophy size={16} /> Leaderboards
                  </button>
                  <button
                    onClick={() => { setHomeTab('cosmetics'); sfx.playTick(); }}
                    className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${homeTab === 'cosmetics' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10' : 'text-slate-400 hover:text-white hover:bg-slate-800/80'}`}
                  >
                    <Settings size={16} /> Deck Cosmetics
                  </button>
                  <button
                    onClick={() => { setHomeTab('howtoplay'); sfx.playTick(); }}
                    className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${homeTab === 'howtoplay' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10' : 'text-slate-400 hover:text-white hover:bg-slate-800/80'}`}
                  >
                    <HelpCircle size={16} /> How to Play
                  </button>
                </div>
              </div>

              {/* Right Column: Dynamic content based on active tab */}
              <div className="flex-1 min-h-[350px]">
                
                {/* 3a. Battle Arena Play Options */}
                {homeTab === 'arena' && (
                  <div className="space-y-6">
                    {/* Welcome Banner */}
                    <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 p-5 rounded-3xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                      <div>
                        <h4 className="text-lg font-black text-white uppercase tracking-wider">Hidden Trump Arena</h4>
                        <p className="text-xs text-slate-400 max-w-sm mt-1">Enter direct real-time matchmaking, join by numeric code, or draft players for custom lobbies!</p>
                      </div>
                      
                      <button
                        id="btn-quick-match"
                        onClick={handleQuickMatch}
                        className="btn-vibrant-tactile font-black px-6 py-3.5 rounded-xl flex items-center gap-2 cursor-pointer uppercase text-xs select-none"
                      >
                        <Play size={14} fill="currentColor" /> Quick Match Play
                      </button>
                    </div>

                    {/* Room lobbies options split */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      
                      {/* Box 1: Create Custom Room */}
                      <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-3xl space-y-4 shadow-lg backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                          <Users className="text-blue-400 w-5 h-5 drop-shadow-[0_0_8px_#3b82f6]" />
                          <h5 className="font-extrabold text-sm uppercase text-white tracking-wider">Create Custom Table</h5>
                        </div>
                        <p className="text-xxs text-slate-400">Setup private/public rooms to invite mates directly via code coordinates.</p>

                        <div className="space-y-3 pt-1">
                          <input
                            id="input-room-name"
                            type="text"
                            value={customRoomName}
                            onChange={e => setCustomRoomName(e.target.value)}
                            placeholder="Room name (optional)..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                          />
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-slate-450 flex items-center gap-2 cursor-pointer select-none font-bold uppercase tracking-wider">
                              <input
                                id="chk-make-private"
                                type="checkbox"
                                checked={customRoomPrivate}
                                onChange={e => setCustomRoomPrivate(e.target.checked)}
                                className="accent-blue-500 w-4 h-4 rounded"
                              />
                              Make Private Room
                            </label>

                            <button
                              id="btn-create-custom-lobby"
                              onClick={handleCreateRoom}
                              className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer border border-slate-700 uppercase"
                            >
                              Create Board
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Box 2: Join Lobby by Code */}
                      <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-3xl space-y-4 flex flex-col justify-between shadow-lg backdrop-blur-sm">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Lock className="text-blue-400 w-5 h-5 drop-shadow-[0_0_8px_#3b82f6]" />
                            <h5 className="font-extrabold text-sm uppercase text-white tracking-wider">Join by Lobby Code</h5>
                          </div>
                          <p className="text-xxs text-slate-400">Enter the 4-letter alphanumeric table room coordinates displayed in lobby settings.</p>
                        </div>

                        <div className="flex gap-2.5 pt-3">
                          <input
                            id="input-lobby-join-code"
                            type="text"
                            maxLength={4}
                            value={lobbyCodeInput}
                            onChange={e => setLobbyCodeInput(e.target.value)}
                            placeholder="e.g. AX4B"
                            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold text-center uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal font-mono"
                          />
                          <button
                            id="btn-join-custom-lobby"
                            onClick={() => handleJoinRoom(lobbyCodeInput)}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold px-5 py-2 rounded-xl text-xs transition-all cursor-pointer uppercase border border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.2)]"
                          >
                            Join Table
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* 3b. Leaderboard rankings */}
                {homeTab === 'rankings' && (
                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-4 shadow-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Trophy className="text-amber-400 w-5 h-5 animate-pulse drop-shadow-[0_0_8px_#f59e0b]" />
                        <h4 className="font-extrabold text-sm uppercase text-white tracking-wider">Global Leaderboard Rankings</h4>
                      </div>
                      
                      <button 
                        onClick={fetchLeaderboard}
                        className="text-xxs text-slate-450 hover:text-white flex items-center gap-1.5 cursor-pointer font-bold uppercase transition-colors"
                      >
                        <RefreshCw size={10} /> Refresh
                      </button>
                    </div>

                    <div className="overflow-hidden border border-slate-800 rounded-xl shadow-lg">
                      <div className="max-h-[350px] overflow-y-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-950/70 text-slate-400 font-black uppercase tracking-wider border-b border-slate-800">
                              <th className="py-3 px-4 font-mono text-center w-12">Rank</th>
                              <th className="py-3 px-4">Player</th>
                              <th className="py-3 px-4 text-right">Combat MMR</th>
                              <th className="py-3 px-4 text-center w-24">Tier</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-805/75">
                            {leaderboard.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="text-center py-8 text-slate-500 font-mono font-medium">
                                  No records found. Play games to register rankings!
                                </td>
                              </tr>
                            ) : (
                              leaderboard.map((entry, idx) => {
                                const isSelf = entry.id === userId;
                                return (
                                  <tr 
                                    key={entry.id} 
                                    className={`hover:bg-slate-800/20 transition-all ${isSelf ? 'bg-blue-500/10 font-bold text-blue-400' : 'text-slate-300'}`}
                                  >
                                    <td className="py-3 px-4 text-center font-mono font-black text-slate-405">
                                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : (idx + 1)}
                                    </td>
                                    <td className="py-3 px-4 font-black truncate max-w-[120px]">
                                      {entry.username} {isSelf && "(You)"}
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-200">
                                      ⚔️ {entry.mmr}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      <span className="text-[10px] font-black bg-slate-950 px-2.5 py-0.5 rounded border border-slate-800 text-slate-300 uppercase tracking-wide">
                                        {entry.rankName}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3c. Deck Cosmetics picker */}
                {homeTab === 'cosmetics' && (
                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-6 shadow-xl">
                    <div>
                      <h4 className="font-extrabold text-sm uppercase text-white tracking-wider">Deck & Table Cosmetics</h4>
                      <p className="text-xs text-slate-450 mt-1">Style your playing deck back and felt skins instantly to matches.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
                      {/* Card backs selecting */}
                      <div className="space-y-3">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Choose Card design</label>
                        <div className="grid grid-cols-2 gap-3">
                          {Object.keys(cardBackStyles).map(bKey => {
                            const isSel = cardBack === bKey;
                            const label = bKey.replace("_", " ").toUpperCase();
                            return (
                              <button
                                key={bKey}
                                onClick={() => handleUpdateCosmetics(bKey, tableSkin)}
                                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer relative overflow-hidden bg-neutral-950
                                  ${isSel ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-500/5' : 'border-slate-800 hover:border-slate-600'}`}
                              >
                                <div className={`w-10 h-14 rounded-lg bg-gradient-to-br ${cardBackStyles[bKey]} border shadow`} />
                                <span className="text-[10px] font-bold text-slate-300 truncate w-full">{label}</span>
                                {isSel && (
                                  <span className="absolute top-1 right-1 bg-blue-500 text-white rounded-full p-[1px]">
                                    <Check size={8} strokeWidth={4} />
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Wood Felt Skins */}
                      <div className="space-y-3">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Choose Felt Table color</label>
                        <div className="grid grid-cols-2 gap-3">
                          {Object.keys(tableSkins).map(skinKey => {
                            const isSel = tableSkin === skinKey;
                            const detail = tableSkins[skinKey];
                            return (
                              <button
                                key={skinKey}
                                onClick={() => handleUpdateCosmetics(cardBack, skinKey)}
                                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer relative overflow-hidden bg-neutral-950
                                  ${isSel ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-500/5' : 'border-slate-800 hover:border-slate-600'}`}
                              >
                                <div className={`w-12 h-8 rounded-lg shadow-inner border border-white/5 ${detail.class}`} />
                                <span className="text-[10px] font-bold text-slate-300 truncate w-full">{detail.name}</span>
                                {isSel && (
                                  <span className="absolute top-1 right-1 bg-blue-500 text-white rounded-full p-[1px]">
                                    <Check size={8} strokeWidth={4} />
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3d. How to Play rule booklet */}
                {homeTab === 'howtoplay' && (
                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-4 max-h-[420px] overflow-y-auto shadow-xl scrollbar-thin scrollbar-thumb-slate-805">
                    <h4 className="font-extrabold text-sm uppercase text-white border-b border-slate-800 pb-2.5 tracking-wider">"Hidden Trump 10" Game Rules</h4>
                    
                    <div className="space-y-4 text-xs text-slate-300 leading-relaxed font-sans">
                      <section className="space-y-1">
                        <h5 className="font-black text-blue-400 uppercase tracking-wide">1. Setup & 2v2 Seating</h5>
                        <p>Played with 4 players as partners opposite to each other. Team A = Seats 1 & 3. Team B = Seats 2 & 4. Cards are distributed equally list (13 cards each).</p>
                      </section>

                      <section className="space-y-1">
                        <h5 className="font-black text-blue-400 uppercase tracking-wide">2. The Face-Down Hidden Card</h5>
                        <p>A randomly chosen player hides 1 card face down. Under the Hidden card rule, the suit of this secret card designates the active Trump suit for the game. This player leads the first trick!</p>
                      </section>

                      <section className="space-y-1">
                        <h5 className="font-black text-blue-400 uppercase tracking-wide">3. Opening the Hidden Card</h5>
                        <p>The card remains secret. However, when a player cannot follow the lead suit on their turn (and is not the original hider), they may click "Open Hidden Card" to reveal the Trump suit to everyone! The hider receives their secret card back into their hand.</p>
                      </section>

                      <section className="space-y-1">
                        <h5 className="font-black text-blue-400 uppercase tracking-wide">4. Mandatory Trump Rule</h5>
                        <p>Once Trump is revealed, if you don't have the lead suit, you MUST play a Trump card if you have one! Standard play rules apply otherwise.</p>
                      </section>

                      <section className="space-y-1">
                        <h5 className="font-black text-blue-400 uppercase tracking-wide">5. Primary Objective is the TENS (10s)</h5>
                        <p>The highest priority are the 10s: 10♥, 10♦, 10♣, 10♠. If your partner is winning the trick, you are encouraged to feed points / throw a 10 into the trick so your team captures it!</p>
                      </section>

                      <section className="space-y-1">
                        <h5 className="font-black text-blue-400 uppercase tracking-wide">6. Victory Conditions</h5>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>Instant win: capture 3 of the 4 ten cards.</li>
                          <li>Instant win: capture 2 ten cards AND win at least 6 tricks.</li>
                          <li>Otherwise, end score captures the win (Most Tens, then Tricks Won).</li>
                        </ul>
                      </section>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
                    {/* ==================== 4. GAME LOBBY ==================== */}
          {currentScreen === 'LOBBY' && room && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex-1 flex flex-col md:flex-row gap-5 py-2"
            >
              <div className="flex-1 bg-slate-900 border border-slate-800 p-6 rounded-3xl flex flex-col justify-between space-y-6 shadow-xl">
                
                {/* Lobby Info */}
                <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-800 pb-4 gap-4">
                  <div>
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block">Lobby Room table</span>
                    <h4 className="text-lg font-black text-white uppercase tracking-wider mt-0.5">{room.name}</h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-450 uppercase tracking-wide font-bold">Table Coordinates:</span>
                    <span className="font-mono text-sm bg-slate-950 font-extrabold px-3.5 py-1.5 border border-slate-800 text-blue-400 rounded-lg tracking-wider shadow-inner">
                      {room.id}
                    </span>
                  </div>
                </div>

                {/* 4 seat configurations list */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
                  {[0, 1, 2, 3].map(pos => {
                    const seated = room.players.find(p => p.position === pos);
                    return (
                      <div
                        key={pos}
                        className={`border rounded-2xl p-4 flex flex-col items-center justify-center text-center relative h-40 transition-all duration-300
                          ${seated ? 'bg-slate-950/90 border-slate-800' : 'bg-slate-900/40 border-dashed border-slate-800/80 animate-pulse'}`}
                      >
                        {seated ? (
                          <div className="space-y-2">
                            <span className="text-3xl filter drop-shadow-md">{avatarsMap[seated.avatar] || "🤖"}</span>
                            <div className="font-bold text-xs text-white truncate max-w-[110px]">{seated.username}</div>
                            <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider shadow-sm border ${seated.team === 'A' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                              Team {seated.team}
                            </span>
                            
                            <div className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-wider">
                              {seated.isBot ? "Ready Bot" : seated.isReady ? "✅ Ready" : "⏳ Waiting"}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="text-slate-600 block text-lg">🪑</span>
                            <span className="text-[10px] font-black text-slate-550 uppercase tracking-widest">Empty Seat</span>
                          </div>
                        )}

                        <span className="absolute top-1.5 left-2.5 text-[9px] text-slate-600 font-black font-mono tracking-widest">SEAT {pos + 1}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Table triggers */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-800 justify-between">
                  <button
                    onClick={handleLeaveRoom}
                    className="border border-slate-800 hover:bg-slate-850 text-slate-300 px-5 py-2.5 rounded-xl text-xs font-black uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow"
                  >
                    <ArrowLeft size={12} /> Leave table
                  </button>

                  <div className="flex gap-2.5">
                    {room.players.length < 4 && (
                      <button
                        id="btn-add-bots"
                        onClick={handleAddBots}
                        className="bg-slate-800 hover:bg-slate-705 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5 border border-slate-700 uppercase shadow"
                      >
                        ⚡ Fill with Bots
                      </button>
                    )}

                    <button
                      id="btn-ready-toggle"
                      onClick={handleToggleReady}
                      className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer uppercase flex items-center gap-1.5 shadow-md select-none border border-transparent
                        ${room.players.find(p => p.id === userId)?.isReady ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'btn-vibrant-tactile text-white'}`}
                    >
                      {room.players.find(p => p.id === userId)?.isReady ? "I'm Ready" : "Start Match / Ready"}
                    </button>
                  </div>
                </div>

              </div>

              {/* Chat Board floating alongside */}
              <div className="w-full md:w-80 h-[280px] md:h-auto">
                <ChatBoard messages={chatMessages} onSendMessage={handleSendMessage} />
              </div>
            </motion.div>
          )}

          {/* ==================== 5. GAMEPLAY DECK ==================== */}
          {currentScreen === 'GAMEPLAY' && room && room.gameState && (
            <motion.div
              key="gameplay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col gap-4 py-1"
            >
              
              {/* Score trackers bar */}
              <ScoreBoard gameState={room.gameState} localPlayerTeam={room.players.find(p => p.id === userId)?.team} />

              <div className="flex-1 flex flex-col lg:flex-row gap-4 items-stretch min-h-[460px]">
                
                {/* 5a. Interactive Card Table Area */}
                <div className={`flex-1 rounded-3xl border-2 shadow-2xl relative flex flex-col justify-between p-3 sm:p-5 overflow-hidden border-slate-800/80 ${tableSkins[tableSkin]?.class || 'felt-green'}`}>
                  
                  {/* Glass circle inner design */}
                  <div className={`absolute inset-12 rounded-full border-2 border-white/5 pointer-events-none flex items-center justify-center ${tableSkins[tableSkin]?.circle}`}>
                    <span className="text-white/2 font-black text-6xl select-none font-sans uppercase tracking-widest">HT10</span>
                  </div>

                  {/* Top bar header inside board (hidden card slot & active trump) */}
                  <div className="flex items-center justify-between bg-slate-950/70 backdrop-blur-md border border-slate-805/50 px-4 py-2 rounded-2xl z-20">
                    <div className="flex items-center gap-3">
                      {/* Face down mini slot card */}
                      <div className="relative">
                        {room.gameState.isTrumpRevealed ? (
                          // Trump card face up icon
                          <div className="w-10 h-14 bg-white border border-yellow-400 rounded-lg flex flex-col justify-between p-1 select-none shadow">
                            <span className={`text-[10px] leading-none font-bold ${getSuitColor(room.gameState.trumpSuit!)}`}>
                              {getSuitSymbol(room.gameState.trumpSuit!)}
                            </span>
                            <span className={`text-base self-center leading-none ${getSuitColor(room.gameState.trumpSuit!)}`}>
                              {getSuitSymbol(room.gameState.trumpSuit!)}
                            </span>
                            <span className="text-[10px] text-right block pr-0.5 leading-none">T</span>
                          </div>
                        ) : (
                          // Trump is secret, show card back shadow
                          <div className="w-10 h-14 bg-gradient-to-br from-indigo-950 to-neutral-950 border border-dashed border-white/20 rounded-lg flex items-center justify-center text-white/30 text-xs font-bold leading-none shadow">
                            ❓
                          </div>
                        )}
                        
                        <span className="absolute -bottom-1 -right-1 bg-yellow-400 text-neutral-950 text-[8px] font-extrabold px-1.5 py-0.2 rounded-full uppercase scale-90">
                          Trump
                        </span>
                      </div>

                      <div className="text-left leading-none">
                        <span className="text-[10px] text-white/50 block font-bold uppercase">Trump status</span>
                        <span className="text-sm font-black text-white">
                          {room.gameState.isTrumpRevealed ? `REVEALED: ${getSuitSymbol(room.gameState.trumpSuit!)}` : "SEEKING TRUMP"}
                        </span>
                      </div>
                    </div>

                    {/* Leading suit indicator */}
                    <div className="text-right flex items-center gap-1.5">
                      <span className="text-[10px] text-white/50 font-bold uppercase">Lead suit:</span>
                      <span className={`text-base font-black ${room.gameState.leadSuit ? getSuitColor(room.gameState.leadSuit) : 'text-neutral-500'}`}>
                        {room.gameState.leadSuit ? `${getSuitSymbol(room.gameState.leadSuit)} (${room.gameState.leadSuit})` : "None"}
                      </span>
                    </div>
                  </div>

                  {/* Rotated Circular seating visualizers */}
                  <div className="absolute inset-0 p-4 pointer-events-none flex flex-col justify-between z-10">
                    
                    {/* TOP USER SEAT (Teammate opposite self) */}
                    <div className="flex justify-center pointer-events-auto">
                      {getRotatedPlayers().find(x => x.clientSeatIndex === 2) && (
                        <PlayerSeat
                          player={getRotatedPlayers().find(x => x.clientSeatIndex === 2)!.seatPlayer}
                          isCurrentTurn={room.gameState.currentTurnPos === getRotatedPlayers().find(x => x.clientSeatIndex === 2)!.seatPlayer.position}
                          isActiveUser={false}
                          handSize={(hands[getRotatedPlayers().find(x => x.clientSeatIndex === 2)!.seatPlayer.id] || []).length}
                          timer={timerProgress}
                          talkingBubble={bubbleTalkState[getRotatedPlayers().find(x => x.clientSeatIndex === 2)!.seatPlayer.id]}
                        />
                      )}
                    </div>

                    {/* MID SEATS (LEFT & RIGHT) */}
                    <div className="flex justify-between items-center pointer-events-none my-auto">
                      
                      {/* LEFT SEAT */}
                      <div className="pointer-events-auto">
                        {getRotatedPlayers().find(x => x.clientSeatIndex === 3) && (
                          <PlayerSeat
                            player={getRotatedPlayers().find(x => x.clientSeatIndex === 3)!.seatPlayer}
                            isCurrentTurn={room.gameState.currentTurnPos === getRotatedPlayers().find(x => x.clientSeatIndex === 3)!.seatPlayer.position}
                            isActiveUser={false}
                            handSize={(hands[getRotatedPlayers().find(x => x.clientSeatIndex === 3)!.seatPlayer.id] || []).length}
                            timer={timerProgress}
                            talkingBubble={bubbleTalkState[getRotatedPlayers().find(x => x.clientSeatIndex === 3)!.seatPlayer.id]}
                          />
                        )}
                      </div>

                      {/* RIGHT SEAT */}
                      <div className="pointer-events-auto">
                        {getRotatedPlayers().find(x => x.clientSeatIndex === 1) && (
                          <PlayerSeat
                            player={getRotatedPlayers().find(x => x.clientSeatIndex === 1)!.seatPlayer}
                            isCurrentTurn={room.gameState.currentTurnPos === getRotatedPlayers().find(x => x.clientSeatIndex === 1)!.seatPlayer.position}
                            isActiveUser={false}
                            handSize={(hands[getRotatedPlayers().find(x => x.clientSeatIndex === 1)!.seatPlayer.id] || []).length}
                            timer={timerProgress}
                            talkingBubble={bubbleTalkState[getRotatedPlayers().find(x => x.clientSeatIndex === 1)!.seatPlayer.id]}
                          />
                        )}
                      </div>

                    </div>

                    {/* BOTTOM SEAT (Local Player) */}
                    <div className="flex justify-center pointer-events-auto">
                      {getRotatedPlayers().find(x => x.clientSeatIndex === 0) && (
                        <PlayerSeat
                          player={getRotatedPlayers().find(x => x.clientSeatIndex === 0)!.seatPlayer}
                          isCurrentTurn={room.gameState.currentTurnPos === getRotatedPlayers().find(x => x.clientSeatIndex === 0)!.seatPlayer.position}
                          isActiveUser={true}
                          handSize={(hands[userId] || []).length}
                          timer={timerProgress}
                          talkingBubble={bubbleTalkState[userId]}
                        />
                      )}
                    </div>

                  </div>

                  {/* ======================================================== */}
                  {/* CENTRAL GAMEPLAY TRICK PILE DISCARDS AREA */}
                  {/* ======================================================== */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 md:w-56 md:h-56 rounded-full border border-white/5 flex items-center justify-center bg-radial from-neutral-900/40 to-transparent pointer-events-none z-10">
                    
                    {/* Centered trick cards laid down */}
                    <AnimatePresence>
                      {room.gameState.currentTrick.map((play, index) => {
                        // Math maps positions offsets bottom, right, top, left relative to self
                        const localPlayer = room.players.find(p => p.id === userId);
                        const localPos = localPlayer ? localPlayer.position || 0 : 0;
                        const clientOffset = (play.position - localPos + 4) % 4;

                        // Position card offset styles inside central ring
                        let posStyles = "";
                        switch (clientOffset) {
                          case 0: // Bottom client card played
                            posStyles = "bottom-2.5 left-1/2 -translate-x-1/2 rotate-0";
                            break;
                          case 1: // Right opponent card played
                            posStyles = "right-2.5 top-1/2 -translate-y-1/2 -rotate-12";
                            break;
                          case 2: // Top mate card played
                            posStyles = "top-2.5 left-1/2 -translate-x-1/2 rotate-180";
                            break;
                          case 3: // Left opponent card played
                            posStyles = "left-2.5 top-1/2 -translate-y-1/2 rotate-12";
                            break;
                        }

                        return (
                          <motion.div
                            key={play.card.id}
                            initial={{ scale: 0.3, opacity: 0, y: 15 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            className={`absolute pointer-events-auto ${posStyles} z-20`}
                          >
                            <CardItem card={play.card} faceUp={true} playable={false} />
                            <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-neutral-950/80 text-[8px] font-black text-neutral-300 border border-white/5 px-1 py-0.1 rounded uppercase truncate max-w-[60px]">
                              {play.username.split(" ")[0]}
                            </span>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>

                    {/* Empty trick design if trick hasn't started */}
                    {room.gameState.currentTrick.length === 0 && !dealAnimationActive && (
                      <div className="text-center text-white/10 text-xs font-extrabold uppercase select-none tracking-widest font-serif leading-none">
                        Trick Area<br />
                        <span className="text-[9px] font-sans font-normal lowercase tracking-normal">Lead suit starts here</span>
                      </div>
                    )}

                    {/* Shuffling deals animated status placeholder */}
                    {dealAnimationActive && (
                      <div className="text-yellow-400 font-black text-xs uppercase animate-pulse select-none tracking-widest">
                        Dealt cards...
                      </div>
                    )}
                  </div>

                  {/* Operational controls bottom side (Hiding instruction and Trump opener actions) */}
                  <div className="flex justify-center z-30 pt-16">
                    {/* If in HIDING phase, and CLIENT is the chosen hider! */}
                    {room.gameState.status === 'HIDING' && room.gameState.hiderId === userId && (
                      <div className="bg-slate-950/90 border-2 border-blue-500 p-4 rounded-2xl max-w-sm text-center shadow-xl animate-pulse">
                        <span className="text-xs font-black text-blue-404 uppercase tracking-widest block mb-1">👑 SELECT TRUMP DECK CARD</span>
                        <p className="text-xxs text-slate-300 font-sans font-medium">Choose one of your 13 cards below to set face down. Its suit will govern the trump card rules for this arena!</p>
                      </div>
                    )}

                    {/* Standard round play information */}
                    {room.gameState.status === 'PLAYING' && (
                      <div className="flex flex-col items-center gap-2">
                        {/* Option: Request to open face down card */}
                        {room.gameState.currentTurnPos === room.players.find(p => p.id === userId)?.position &&
                         userId !== room.gameState.hiderId && 
                         !room.gameState.isTrumpRevealed && 
                         room.gameState.leadSuit && (
                          <motion.button
                            id="btn-reveal-trump"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleRevealTrump}
                            className="bg-gradient-to-r from-rose-600 via-violet-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-extrabold border border-indigo-400/30 px-5 py-2.5 rounded-2xl text-[10px] uppercase shadow-lg shadow-indigo-500/10 transition-all cursor-pointer animate-pulse z-40 mt-12 flex items-center gap-1.5 font-sans"
                          >
                            🎺 Cannot Follow! Open Trump Secret Card
                          </motion.button>
                        )}
                        
                        {/* Informative text pointer */}
                        <div className="bg-slate-950/90 backdrop-blur-md px-4 py-2 border border-slate-800 rounded-full text-[10px] text-slate-350 font-bold uppercase tracking-wider shadow-lg">
                          {room.gameState.currentTurnPos === room.players.find(p => p.id === userId)?.position ? (
                            <span className="text-blue-400 font-black tracking-widest animate-pulse">👉 Your turn! Play a valid card</span>
                          ) : (
                            <span className="font-sans">Waiting for Seat {room.gameState.currentTurnPos + 1} move...</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                </div>

                {/* 5b. Chat streams alongside Gameplay table */}
                <div className="w-full lg:w-80 h-[280px] lg:h-auto flex flex-col justify-between">
                  <div className="flex-1">
                    <ChatBoard messages={chatMessages} onSendMessage={handleSendMessage} />
                  </div>
                  
                  {/* Table leave manual override option */}
                  <div className="mt-3.5">
                    <button
                      onClick={handleLeaveRoom}
                      className="w-full bg-slate-900/90 hover:bg-slate-805 text-slate-400 hover:text-white border border-slate-800/85 text-xs py-2 rounded-xl transition-all cursor-pointer font-bold uppercase flex items-center justify-center gap-1.5"
                    >
                      <LogOut size={12} /> Rage Quit Table
                    </button>
                  </div>
                </div>

              </div>

              {/* Hand cards Area (Client's active row of 12-13 cards) */}
              <div className="bg-slate-900 border border-slate-800/90 p-4 sm:p-5 rounded-3xl relative overflow-hidden flex flex-col z-30 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3.5 px-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Your Cards Hand (Total: {(hands[userId] || []).length})
                  </span>
                  
                  {/* Small condition helpers indicator */}
                  <span className="text-[9px] text-slate-500 font-mono font-semibold uppercase tracking-wider">
                    Click card to play legally
                  </span>
                </div>

                {/* Horizontal list of hand cards */}
                <div className="flex gap-2.5 overflow-x-auto pb-4 pt-1 justify-start md:justify-center scrollbar-thin scrollbar-thumb-slate-800">
                  {(hands[userId] || []).length === 0 ? (
                    <div className="text-center font-mono text-xs text-neutral-500 py-4 w-full">
                      Dealing cards...
                    </div>
                  ) : (
                    (hands[userId] || []).map((card, idx) => {
                      const isTurn = room.gameState.currentTurnPos === room.players.find(p => p.id === userId)?.position;
                      const isHidingPhase = room.gameState.status === 'HIDING' && room.gameState.hiderId === userId;
                      
                      let isPlayable = false;

                      if (isHidingPhase) {
                        isPlayable = true; // hider can pick any card to hide
                      } else if (isTurn && room.gameState.status === 'PLAYING') {
                        // Check validation rule
                        const hasLeadSuit = (hands[userId] || []).some(c => c.suit === room.gameState.leadSuit);
                        
                        if (!room.gameState.leadSuit) {
                          isPlayable = true; // leading player can play any card
                        } else if (hasLeadSuit) {
                          isPlayable = card.suit === room.gameState.leadSuit;
                        } else {
                          // Unable to follow lead:
                          // If trump is revealed, MUST play trump if they have it
                          if (room.gameState.isTrumpRevealed && room.gameState.trumpSuit) {
                            const hasTrump = (hands[userId] || []).some(c => c.suit === room.gameState.trumpSuit);
                            if (hasTrump) {
                              isPlayable = card.suit === room.gameState.trumpSuit;
                            } else {
                              isPlayable = true; // has neither lead nor trump, can play any card!
                            }
                          } else {
                            // Trump not revealed and can't follow, play any card
                            isPlayable = true;
                          }
                        }
                      }

                      return (
                        <div key={card.id} className="relative transition-all">
                          <CardItem
                            card={card}
                            playable={isPlayable}
                            onClick={() => {
                              if (isHidingPhase) {
                                handleHideCard(card.id);
                              } else {
                                handlePlayCard(card.id);
                              }
                            }}
                            index={idx}
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ==================== 6. MATCH RESULT SCREEN ==================== */}
          {currentScreen === 'RESULTS' && room && room.gameState && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="flex-1 flex items-center justify-center py-4"
            >
              <div className="w-full max-w-xl bg-slate-900 border-2 border-slate-800 p-6 sm:p-8 rounded-3xl shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-2.5 bg-gradient-to-r from-blue-550 via-indigo-500 to-violet-600 animate-pulse" />
                
                {/* Visual Trophy crown on top */}
                <div className="text-center space-y-2 mb-8 pt-3 font-sans">
                  <div className="inline-flex w-16 h-16 rounded-full bg-blue-550/10 border border-blue-500/20 items-center justify-center text-4xl mb-2 animate-bounce shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                    🏆
                  </div>
                  
                  <span className="text-[10px] text-blue-400 font-black uppercase tracking-widest block">MATCH RESULTS</span>
                  
                  <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                    Team {room.gameState.winner} Victorious!
                  </h3>
                  
                  <p className="text-xs text-slate-300 max-w-sm mx-auto bg-slate-950 px-4 py-2 rounded-xl mt-1.5 border border-slate-805/60">
                    "{room.gameState.winReason}"
                  </p>
                </div>

                {/* Score Summary breakdown */}
                <div className="grid grid-cols-2 gap-4 border border-slate-800 rounded-2xl overflow-hidden mb-6 bg-slate-950/80 font-sans">
                  
                  {/* Team A stats */}
                  <div className={`p-4 text-center space-y-1.5 border-r border-slate-800 ${room.gameState.winner === 'A' ? 'bg-emerald-500/5' : ''}`}>
                    <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Team A Score</span>
                    <div className="text-3xl font-black font-mono text-white">{room.gameState.tricksWon.A} <span className="text-slate-500 text-xs font-normal capitalize">Tricks</span></div>
                    <span className="text-xxs font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full inline-block">
                      ⭐ {room.gameState.tensCaptured.A} Tens
                    </span>
                  </div>

                  {/* Team B stats */}
                  <div className={`p-4 text-center space-y-1.5 ${room.gameState.winner === 'B' ? 'bg-rose-500/5' : ''}`}>
                    <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Team B Score</span>
                    <div className="text-3xl font-black font-mono text-white">{room.gameState.tricksWon.B} <span className="text-slate-500 text-xs font-normal capitalize">Tricks</span></div>
                    <span className="text-xxs font-black text-rose-400 bg-rose-400/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full inline-block">
                      ⭐ {room.gameState.tensCaptured.B} Tens
                    </span>
                  </div>

                </div>

                {/* Combat details & Achievements listings */}
                <div className="bg-slate-950 p-4 border border-slate-800/80 rounded-xl space-y-3.5 mb-8 font-sans">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block border-b border-slate-850 pb-1.5">Captured valuable Tens history</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {room.gameState.capturedTensHistory.map((ten, index) => {
                      const suitSym = getSuitSymbol(ten.suit);
                      const sColor = getSuitColor(ten.suit);
                      return (
                        <div key={index} className="bg-slate-900 border border-slate-800 p-2 rounded-lg text-center font-mono leading-tight shadow-sm">
                          <span className={`text-sm font-black ${sColor}`}>10{suitSym}</span>
                          <span className="text-[8px] text-slate-400 block font-bold capitalize mt-0.5">Team {ten.team}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Operational actions buttons list */}
                <div className="flex gap-4 font-sans">
                  <button
                    onClick={handleLeaveRoom}
                    className="flex-1 btn-vibrant-tactile font-black text-white py-3.5 px-6 rounded-xl transition-all cursor-pointer text-center text-xs uppercase shadow-lg select-none block"
                  >
                    Return to home dashboard &nbsp; <ChevronRight size={14} className="inline-block align-middle" />
                  </button>
                </div>

              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Humble visual credit details */}
      <footer className="py-4 border-t border-slate-900 bg-slate-950/10 text-center text-[10px] text-slate-500 font-mono">
        Hidden Trump 10 Multiplayer Board • Crafted visually with React & Tailwind CSS
      </footer>
    </div>
  );
}
