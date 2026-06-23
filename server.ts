import 'dotenv/config';
import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { Card, Suit, Rank, Player, GameState, Room, RankName, Message } from "./src/types";

// Setup server and express
const app = express();

// CORS middleware for API endpoints
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Supabase client — service-role key bypasses RLS for server-only access
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment");
}
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

console.log("[DB] Connected to Supabase:", process.env.SUPABASE_URL);

// Map camelCase Player object → snake_case Supabase row
function playerToRow(player: Player) {
  return {
    id: player.id,
    username: player.username,
    avatar: player.avatar,
    card_back: player.cardBack,
    table_skin: player.tableSkin,
    coins: player.coins,
    mmr: player.mmr,
    rank_name: player.rankName,
    is_bot: player.isBot,
    connected: player.connected,
  };
}

// Map snake_case Supabase row → camelCase Player object
function rowToPlayer(row: any): Player {
  return {
    id: row.id,
    username: row.username,
    avatar: row.avatar,
    cardBack: row.card_back,
    tableSkin: row.table_skin,
    coins: row.coins,
    mmr: row.mmr,
    rankName: row.rank_name as RankName,
    isBot: row.is_bot,
    isReady: false,
    connected: row.connected,
  };
}

// Core Utilities
function getRankName(mmr: number): RankName {
  if (mmr >= 2200) return "Master";
  if (mmr >= 1800) return "Diamond";
  if (mmr >= 1500) return "Platinum";
  if (mmr >= 1200) return "Gold";
  if (mmr >= 900) return "Silver";
  return "Bronze";
}

function createDefaultPlayer(id: string, username: string, avatar: string): Player {
  return {
    id,
    username,
    avatar: avatar || "avatar_1",
    cardBack: "classic_blue",
    tableSkin: "green_felt",
    coins: 500,
    mmr: 1000,
    rankName: "Bronze",
    isBot: false,
    isReady: false,
    connected: true
  };
}

function createBot(position: number): Player {
  const botNames = [
    "AlphaCard", "TrumpMaster", "TricksterBot", "AcePlayer", 
    "SlyDiamond", "HeartThrob", "ClubKing", "SpadeSpy"
  ];
  const avatars = ["avatar_2", "avatar_3", "avatar_4", "avatar_5"];
  const name = botNames[Math.floor(Math.random() * botNames.length)] + ` (Bot)`;
  const avatar = avatars[Math.floor(Math.random() * avatars.length)];
  return {
    id: `bot_${position}_${Math.random().toString(36).substr(2, 5)}`,
    username: name,
    avatar,
    cardBack: "classic_red",
    tableSkin: "royal_blue",
    coins: 1000,
    mmr: 1100,
    rankName: "Silver",
    isBot: true,
    isReady: true,
    connected: true,
    team: position % 2 === 0 ? "A" : "B",
    position
  };
}

// Active Match Rooms in memory
const rooms: { [id: string]: Room } = {};
// Real hands mapped by roomId -> playerId -> Card[]
const roomHands: { [roomId: string]: { [playerId: string]: Card[] } } = {};
// Hidden card mapped by roomId -> Card
const roomHiddenCard: { [roomId: string]: Card } = {};

// Express REST API
app.use(express.json());

// API: Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", port: PORT });
});

// API: Sync Profile
app.post("/api/auth/sync", async (req, res) => {
  const { id, username, avatar } = req.body;
  if (!id || !username) {
    return res.status(400).json({ error: "Missing identity credentials" });
  }

  try {
    const { data: existing } = await supabase
      .from("players")
      .select("*")
      .eq("id", id)
      .single();

    let player: Player;
    if (!existing) {
      player = createDefaultPlayer(id, username, avatar);
      await supabase.from("players").insert(playerToRow(player));
    } else {
      const rankName = getRankName(existing.mmr);
      await supabase.from("players")
        .update({ username, avatar, rank_name: rankName })
        .eq("id", id);
      player = rowToPlayer({ ...existing, username, avatar, rank_name: rankName });
    }

    res.json({ player });
  } catch (err) {
    console.error("[API] /auth/sync error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// API: Leaderboard
app.get("/api/leaderboard", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("leaderboard")
      .select("id, username, mmr, rank_name");

    if (error) throw error;

    // Map rank_name → rankName to match frontend Player type
    const entries = (data || []).map(row => ({
      id: row.id,
      username: row.username,
      mmr: row.mmr,
      rankName: row.rank_name
    }));

    res.json({ entries });
  } catch (err) {
    console.error("[API] /leaderboard error:", err);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// App routing fallback for React Vite client SPA
// Setup Vite middleware for active development, Express static build files for production
if (process.env.NODE_ENV !== "production") {
  import("vite").then(async (viteModule) => {
    const vite = await viteModule.createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  });
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// GAME ENGINE CORE RULES & HELPER FUNCTIONS
function createDeck(): Card[] {
  const suits: Suit[] = ["H", "D", "C", "S"];
  const ranks: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const values: { [r in Rank]: number } = {
    "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
    "10": 10, "J": 11, "Q": 12, "K": 13, "A": 14
  };

  const deck: Card[] = [];
  suits.forEach(suit => {
    ranks.forEach(rank => {
      deck.push({
        id: `${rank}${suit}`,
        suit,
        rank,
        value: values[rank]
      });
    });
  });
  return deck;
}

function shuffle(deck: Card[]): Card[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// Initialize Game State
function initGame(room: Room) {
  const deck = shuffle(createDeck());
  const hands: { [playerId: string]: Card[] } = {};

  // Assign players to positions if they don't have them
  room.players.forEach((p, idx) => {
    p.position = idx;
    p.team = idx % 2 === 0 ? "A" : "B";
    hands[p.id] = deck.slice(idx * 13, (idx + 1) * 13);
  });

  roomHands[room.id] = hands;

  // Randomly select hider position (0 to 3)
  const hiderPos = Math.floor(Math.random() * 4);
  const hider = room.players.find(p => p.position === hiderPos)!;

  room.gameState = {
    currentTurnPos: hiderPos,
    hiderId: hider.id,
    isTrumpRevealed: false,
    trumpSuit: null,
    leadSuit: null,
    currentTrick: [],
    tricksWon: { A: 0, B: 0 },
    tensCaptured: { A: 0, B: 0 },
    capturedTensHistory: [],
    status: "HIDING",
    winner: null,
    winReason: null,
    trickCount: 0,
    turnTimer: 20
  };

  room.status = "HIDING";
}

// Play Card Validation
function isValidPlay(
  card: Card,
  playerHand: Card[],
  leadSuit: Suit | null,
  isTrumpRevealed: boolean,
  trumpSuit: Suit | null
): { valid: boolean; reason?: string } {
  // Card must exist in player's current hand
  if (!playerHand.some(c => c.id === card.id)) {
    return { valid: false, reason: "Card not in hand" };
  }

  // If leading the trick, any card is valid
  if (!leadSuit) {
    return { valid: true };
  }

  // Must follow lead suit if possible
  const hasLeadSuit = playerHand.some(c => c.suit === leadSuit);
  if (hasLeadSuit) {
    if (card.suit !== leadSuit) {
      return { valid: false, reason: `Must follow leading suit (${getSuitSymbol(leadSuit)})` };
    }
    return { valid: true };
  }

  // If unable to follow lead suit:
  // If trump is revealed: player MUST play a trump card if they have one
  if (isTrumpRevealed && trumpSuit) {
    const hasTrump = playerHand.some(c => c.suit === trumpSuit);
    if (hasTrump) {
      if (card.suit !== trumpSuit) {
        return { valid: false, reason: `Must play trump card (${getSuitSymbol(trumpSuit)}) since you cannot follow lead suit` };
      }
    }
  }

  // Otherwise, play any card
  return { valid: true };
}

function getSuitSymbol(suit: Suit): string {
  const symbols = { H: "♥", D: "♦", C: "♣", S: "♠" };
  return symbols[suit] || suit;
}

// Evaluate Trick Winner
function evaluateTrick(
  trick: { playerId: string; card: Card; position: number; username: string }[],
  leadSuit: Suit,
  isTrumpRevealed: boolean,
  trumpSuit: Suit | null
): { winnerPos: number; winnerId: string; winnerName: string } {
  let winningPlay = trick[0];

  for (let i = 1; i < trick.length; i++) {
    const candidate = trick[i];
    const candCard = candidate.card;
    const currentBestCard = winningPlay.card;

    if (isTrumpRevealed && trumpSuit) {
      // If current best is a trump, candidate must be higher trump to beat it
      if (currentBestCard.suit === trumpSuit) {
        if (candCard.suit === trumpSuit && candCard.value > currentBestCard.value) {
          winningPlay = candidate;
        }
      } else {
        // If current best is NOT trump, candidate beats it if candidate is trump OR if candidate is same leadSuit with higher value
        if (candCard.suit === trumpSuit) {
          winningPlay = candidate;
        } else if (candCard.suit === leadSuit && candCard.value > currentBestCard.value) {
          winningPlay = candidate;
        }
      }
    } else {
      // Trump not revealed: only same leadSuit cards can win, highest value wins
      if (candCard.suit === leadSuit && candCard.value > currentBestCard.value) {
        winningPlay = candidate;
      }
    }
  }

  return {
    winnerPos: winningPlay.position,
    winnerId: winningPlay.playerId,
    winnerName: winningPlay.username
  };
}

// Check Victory Conditions
function checkVictory(gameState: GameState): { winner: "A" | "B" | null; reason: string | null } {
  // Immediate win: Capture any 3 of the 4 tens
  if (gameState.tensCaptured.A >= 3) {
    return { winner: "A", reason: "Captured 3 of the 4 Tens (Immediate win)" };
  }
  if (gameState.tensCaptured.B >= 3) {
    return { winner: "B", reason: "Captured 3 of the 4 Tens (Immediate win)" };
  }

  // Immediate win: Capture 2 tens AND win at least 6 tricks
  if (gameState.tensCaptured.A >= 2 && gameState.tricksWon.A >= 6) {
    return { winner: "A", reason: "Captured 2 Tens and won 6 Tricks (Immediate win)" };
  }
  if (gameState.tensCaptured.B >= 2 && gameState.tricksWon.B >= 6) {
    return { winner: "B", reason: "Captured 2 Tens and won 6 Tricks (Immediate win)" };
  }

  // End of game (13 tricks played)
  if (gameState.trickCount >= 13) {
    if (gameState.tensCaptured.A !== gameState.tensCaptured.B) {
      const winner = gameState.tensCaptured.A > gameState.tensCaptured.B ? "A" : "B";
      return { winner, reason: `Captured more Ten cards (${gameState.tensCaptured[winner]} vs ${gameState.tensCaptured[winner === "A" ? "B" : "A"]})` };
    }
    // Tied Tens: Check tricks won
    if (gameState.tricksWon.A !== gameState.tricksWon.B) {
      const winner = gameState.tricksWon.A > gameState.tricksWon.B ? "A" : "B";
      return { winner, reason: `Tied Tens, won more total Tricks (${gameState.tricksWon[winner]} vs ${gameState.tricksWon[winner === "A" ? "B" : "A"]})` };
    }
    // Perfectly tied: Decided by last trick or draw
    return { winner: "A", reason: "Game draw broken by Team A starting advantage" };
  }

  return { winner: null, reason: null };
}

// Client Hand Filter (Ensuring player can't inspect opponents cards in websocket payloads)
function getSanitizedRoomForPlayer(roomId: string, playerId: string): any {
  const room = rooms[roomId];
  if (!room) return null;

  const hands = roomHands[roomId] || {};
  const actualHands: { [pId: string]: number | Card[] } = {};

  room.players.forEach(p => {
    const playerHand = hands[p.id] || [];
    if (p.id === playerId) {
      // Player sees their own actual cards
      actualHands[p.id] = playerHand;
    } else {
      // Others only see the card counts to prevent cheating!
      actualHands[p.id] = playerHand.map((_, i) => ({
        id: `back_${i}`,
        suit: "H" as Suit,
        rank: "2" as Rank,
        value: 0
      })); // dummy backs
    }
  });

  // Hide hidden card unless it matches hider or is revealed
  let clientHiddenCard: Card | null = null;
  if (room.gameState) {
    const hCard = roomHiddenCard[room.id];
    if (room.gameState.isTrumpRevealed || room.gameState.hiderId === playerId) {
      clientHiddenCard = hCard || null;
    }
  }

  return {
    ...room,
    hands: actualHands,
    hiddenCard: clientHiddenCard
  };
}

// Emit Game state updates safely
function broadcastRoomUpdate(roomId: string) {
  const room = rooms[roomId];
  if (!room) return;

  room.players.forEach(p => {
    if (!p.isBot && p.connected) {
      io.to(p.id).emit("room:updated", {
        room: getSanitizedRoomForPlayer(roomId, p.id)
      });
    }
  });

  // Spectators get the revealed view (or only counts)
  room.spectators.forEach(spec => {
    io.to(spec.id).emit("room:updated", {
      room: getSanitizedRoomForPlayer(roomId, spec.id)
    });
  });
}

// Server side timer ticking for room matches
setInterval(() => {
  Object.keys(rooms).forEach(roomId => {
    const room = rooms[roomId];
    if (!room || room.status !== "PLAYING" && room.status !== "HIDING" || !room.gameState) return;

    if (room.gameState.turnTimer > 0) {
      room.gameState.turnTimer--;
      // Broadcast timer updates
      room.players.forEach(p => {
        if (!p.isBot && p.connected) {
          io.to(p.id).emit("room:timer-tick", { turnTimer: room.gameState!.turnTimer });
        }
      });
    } else {
      // Timer Expired! Triggers automatic play/hiding to prevent AFK players from locking the room
      handleAFKPlay(room);
    }
  });
}, 1000);

function handleAFKPlay(room: Room) {
  if (!room.gameState) return;
  const turnPos = room.gameState.currentTurnPos;
  const activePlayer = room.players.find(p => p.position === turnPos);
  if (!activePlayer) return;

  if (room.gameState.status === "HIDING") {
    // Hidden choice timeout - auto-pick the first card
    const hand = roomHands[room.id]?.[activePlayer.id] || [];
    if (hand.length > 0) {
      executeHideCard(room.id, activePlayer.id, hand[0].id);
    }
  } else if (room.gameState.status === "PLAYING") {
    // Current turn player timeout - auto-play a random valid card
    const hand = roomHands[room.id]?.[activePlayer.id] || [];
    if (hand.length > 0) {
      // Find a legal play card
      const legalCards = hand.filter(card => {
        const check = isValidPlay(
          card,
          hand,
          room.gameState!.leadSuit,
          room.gameState!.isTrumpRevealed,
          room.gameState!.trumpSuit
        );
        return check.valid;
      });

      const selectedCard = legalCards.length > 0 ? legalCards[0] : hand[0];
      executePlayCard(room.id, activePlayer.id, selectedCard.id);
    }
  }
}

// Global active matchmaking queue
const matchmakingQueue: string[] = [];

// Handle Bot Turn Play Logic
function triggerBotTurn(room: Room) {
  if (room.status !== "PLAYING" && room.status !== "HIDING" || !room.gameState) return;

  const currentTurnIdx = room.gameState.currentTurnPos;
  const botPlayer = room.players.find(p => p.position === currentTurnIdx);

  if (!botPlayer || !botPlayer.isBot) return;

  // Simulate thinking time (800ms to 1800ms) for lifelike interactions
  const thinkDelay = 1000 + Math.random() * 800;

  setTimeout(() => {
    // Verify it is still bot's turn and room didn't change
    if (!room.gameState || room.gameState.currentTurnPos !== currentTurnIdx) return;

    const botId = botPlayer.id;
    const botHand = roomHands[room.id]?.[botId] || [];

    if (room.gameState.status === "HIDING") {
      // Bot is hider: analyze hand, pick the suit with the most cards to be trump! Highly intelligent bot AI.
      const suitCounts: { [s in Suit]: number } = { H: 0, D: 0, C: 0, S: 0 };
      botHand.forEach(c => suitCounts[c.suit]++);
      
      let bestSuit: Suit = "H";
      let highestCount = 0;
      Object.keys(suitCounts).forEach(s => {
        if (suitCounts[s as Suit] > highestCount) {
          highestCount = suitCounts[s as Suit];
          bestSuit = s as Suit;
        }
      });

      // Find the lowest card of this best suit to hide (so it keeps its highest cards of that suit to win tricks!)
      const suitCards = botHand.filter(c => c.suit === bestSuit).sort((a,b) => a.value - b.value);
      const chosenCard = suitCards.length > 0 ? suitCards[0] : botHand[0];

      executeHideCard(room.id, botId, chosenCard.id);
    } else {
      // Playing turn:
      // Can bot request to reveal trump card?
      // "request to open hidden card: turn of player, cannot follow lead suit, is not hider, trump not revealed"
      if (!room.gameState.isTrumpRevealed && 
          room.gameState.leadSuit && 
          botId !== room.gameState.hiderId) {
        
        const hasLeadSuit = botHand.some(c => c.suit === room.gameState!.leadSuit);
        if (!hasLeadSuit) {
          // Can legally reveal. Let's do it 90% of the time, so they can play trump if available!
          if (Math.random() < 0.90) {
            executeRevealTrump(room.id, botId);
            // After reveal, bot hand context shifts. Trigger bot play recalculation inside timeout
            setTimeout(() => {
              botPlayCardAI(room, botId, botHand);
            }, 300);
            return;
          }
        }
      }

      botPlayCardAI(room, botId, botHand);
    }
  }, thinkDelay);
}

function botPlayCardAI(room: Room, botId: string, botHand: Card[]) {
  if (!room.gameState) return;
  
  // Filter only valid plays
  const legalCards = botHand.filter(card => {
    const check = isValidPlay(
      card,
      botHand,
      room.gameState!.leadSuit,
      room.gameState!.isTrumpRevealed,
      room.gameState!.trumpSuit
    );
    return check.valid;
  });

  const cardsToSelect = legalCards.length > 0 ? legalCards : botHand;

  // Strategic selection:
  // Rule: If teammate is already winning the trick, throw points (a 10 card if legal, or a non-point low card)
  // Let's analyze who is currently winning the trick
  let selected = cardsToSelect[0];
  
  if (room.gameState.currentTrick.length > 0 && room.gameState.leadSuit) {
    const currentStatus = evaluateTrick(
      room.gameState.currentTrick,
      room.gameState.leadSuit,
      room.gameState.isTrumpRevealed,
      room.gameState.trumpSuit
    );
    
    const botPlayer = room.players.find(p => p.id === botId)!;
    const teammatePos = (botPlayer.position! + 2) % 4;
    const isTeammateWinning = currentStatus.winnerPos === teammatePos;

    if (isTeammateWinning) {
      // teammate is winning: try throwing a "10" card if valid, to capture it!
      const tensInOptions = cardsToSelect.filter(c => c.rank === "10");
      if (tensInOptions.length > 0) {
        selected = tensInOptions[0]; // Throw 10! Awesome teamwork!
      } else {
        // Just discard lowest card of some non-trump/non-lead suit
        selected = cardsToSelect.sort((a,b) => a.value - b.value)[0];
      }
    } else {
      // Teammate not winning: try to win the trick if possible, or play a low garbage card
      // Can we win?
      const highestPlayed = room.gameState.currentTrick.sort((a,b) => b.card.value - a.card.value)[0].card;
      const winningCards = cardsToSelect.filter(c => {
        // If trump is revealed and trump is active
        if (room.gameState!.isTrumpRevealed && room.gameState!.trumpSuit) {
          if (highestPlayed.suit === room.gameState!.trumpSuit) {
            return c.suit === room.gameState!.trumpSuit && c.value > highestPlayed.value;
          } else {
            return c.suit === room.gameState!.trumpSuit || (c.suit === room.gameState!.leadSuit && c.value > highestPlayed.value);
          }
        } else {
          return c.suit === room.gameState!.leadSuit && c.value > highestPlayed.value;
        }
      });

      if (winningCards.length > 0) {
        // Win with the lowest winning card to conserve high cards
        selected = winningCards.sort((a,b) => a.value - b.value)[0];
      } else {
        // Can't win: dump the lowest value card
        selected = cardsToSelect.filter(c => c.rank !== "10").sort((a,b) => a.value - b.value)[0] || cardsToSelect[0];
      }
    }
  } else {
    // Leading trick: play high card of any suit, except maybe don't lead a "10" blindly unless it's an Ace
    const validSansTens = cardsToSelect.filter(c => c.rank !== "10");
    const pool = validSansTens.length > 0 ? validSansTens : cardsToSelect;
    selected = pool.sort((a,b) => b.value - a.value)[0]; // highest card
  }

  if (selected) {
    executePlayCard(room.id, botId, selected.id);
  }
}

// Logic: Execute Hide Card
function executeHideCard(roomId: string, playerId: string, cardId: string) {
  const room = rooms[roomId];
  if (!room || !room.gameState || room.gameState.status !== "HIDING" || room.gameState.hiderId !== playerId) return;

  const playerHand = roomHands[roomId]?.[playerId] || [];
  const cardIdx = playerHand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) return;

  // Selected card is set as secret hiddenCard
  const card = playerHand[cardIdx];
  roomHiddenCard[roomId] = card;

  // Remove card from player hand
  playerHand.splice(cardIdx, 1);

  // Set the Trump suit secretly (Only the suit matters)
  room.gameState.trumpSuit = card.suit;
  room.gameState.status = "PLAYING";
  room.gameState.turnTimer = 20;

  // Notify players about hide completion
  io.to(roomId).emit("game:card-hidden-anim", { hiderId: playerId });
  io.to(roomId).emit("chat:message", {
    id: Math.random().toString(),
    senderName: "Dealer Bot",
    senderId: "system",
    text: `${room.players.find(p => p.id === playerId)?.username} has set the hidden Trump card face down! First trick begins.`,
    timestamp: Date.now()
  });

  broadcastRoomUpdate(roomId);

  // If first play turn belongs to Bot, play!
  triggerBotTurn(room);
}

// Logic: Execute Play Card
function executePlayCard(roomId: string, playerId: string, cardId: string) {
  const room = rooms[roomId];
  if (!room || !room.gameState || room.gameState.status !== "PLAYING") return;

  const currentTurnIdx = room.gameState.currentTurnPos;
  const player = room.players.find(p => p.position === currentTurnIdx);
  if (!player || player.id !== playerId) return;

  const hand = roomHands[roomId]?.[playerId] || [];
  const cardIdx = hand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) return;

  const card = hand[cardIdx];

  // Validate the play
  const valResult = isValidPlay(
    card,
    hand,
    room.gameState.leadSuit,
    room.gameState.isTrumpRevealed,
    room.gameState.trumpSuit
  );

  if (!valResult.valid) {
    // Send local error to client if it was human player
    if (!player.isBot) {
      io.to(playerId).emit("game:error", { message: valResult.reason });
    }
    return;
  }

  // Valid card! Remove from hand and push to trick
  hand.splice(cardIdx, 1);
  if (!room.gameState.leadSuit) {
    room.gameState.leadSuit = card.suit;
  }

  room.gameState.currentTrick.push({
    playerId: player.id,
    card,
    position: player.position!,
    username: player.username
  });

  // Reset timer
  room.gameState.turnTimer = 20;

  // Broadcast played card animation
  io.to(roomId).emit("game:card-played-anim", {
    playerId,
    card,
    position: player.position!
  });

  // Advance clockwise
  if (room.gameState.currentTrick.length < 4) {
    room.gameState.currentTurnPos = (currentTurnIdx + 1) % 4;
    broadcastRoomUpdate(roomId);
    triggerBotTurn(room);
  } else {
    // Trick complete: evaluate winner after brief delay for players to see the plays!
    room.gameState.currentTurnPos = -1; // disable plays temporarily
    broadcastRoomUpdate(roomId);

    setTimeout(() => {
      processTrickCompletion(room);
    }, 1800);
  }
}

function processTrickCompletion(room: Room) {
  if (!room.gameState) return;

  const trick = room.gameState.currentTrick;
  const leadSuit = room.gameState.leadSuit!;
  const trumpSuit = room.gameState.trumpSuit;
  const isTrumpRevealed = room.gameState.isTrumpRevealed;

  const evaluate = evaluateTrick(trick, leadSuit, isTrumpRevealed, trumpSuit);
  const winnerPos = evaluate.winnerPos;
  const winnerId = evaluate.winnerId;
  const winnerTeam = winnerPos % 2 === 0 ? "A" : "B";

  // Capture total tricks won
  room.gameState.tricksWon[winnerTeam]++;

  // Capture any Tens (10♥, 10♦, 10♣, 10♠)
  const capturedTens: Card[] = [];
  trick.forEach(play => {
    if (play.card.rank === "10") {
      capturedTens.push(play.card);
      room.gameState!.tensCaptured[winnerTeam]++;
      room.gameState!.capturedTensHistory.push({
        suit: play.card.suit,
        winningPlayerId: winnerId,
        team: winnerTeam
      });
    }
  });

  // Prepare a gorgeous chat message log for visual thrill
  let logText = `${evaluate.winnerName} wins the trick! (${getSuitSymbol(leadSuit)} lead)`;
  if (capturedTens.length > 0) {
    const symbolsText = capturedTens.map(c => `[10${getSuitSymbol(c.suit)}]`).join(" and ");
    logText += ` ⭐ Team ${winnerTeam} captured ${symbolsText}!`;
  }

  room.gameState.trickCount++;

  // Record history snapshot
  room.gameState.currentTrick = [];
  room.gameState.leadSuit = null;

  // Broadcast trick winner animation details
  io.to(room.id).emit("game:trick-winner-anim", {
    winningPlayerId: winnerId,
    team: winnerTeam,
    capturedTens: capturedTens,
    logMessage: logText
  });

  io.to(room.id).emit("chat:message", {
    id: Math.random().toString(),
    senderName: "Referee Bot",
    senderId: "system",
    text: logText,
    timestamp: Date.now()
  });

  // Check victory conditions
  const victoryCheck = checkVictory(room.gameState);
  if (victoryCheck.winner) {
    handleRoomGameOver(room, victoryCheck.winner, victoryCheck.reason!).catch(err =>
      console.error("[Game] handleRoomGameOver error:", err)
    );
  } else {
    // Determine next play starter position
    room.gameState.currentTurnPos = winnerPos;
    room.gameState.turnTimer = 20;
    broadcastRoomUpdate(room.id);
    triggerBotTurn(room);
  }
}

async function handleRoomGameOver(room: Room, winningTeam: "A" | "B", reason: string) {
  if (!room.gameState) return;

  room.gameState.status = "FINISHED";
  room.gameState.winner = winningTeam;
  room.gameState.winReason = reason;
  room.status = "FINISHED";

  const coinReward = 150;
  const mmrDelta = 25;

  // Update each human player's MMR and coins in Supabase
  const updatePromises = room.players
    .filter(p => !p.isBot)
    .map(async (p) => {
      const isWinner = p.team === winningTeam;

      // Fetch current player data from Supabase
      const { data: dbPlayer } = await supabase
        .from("players")
        .select("coins, mmr")
        .eq("id", p.id)
        .single();

      if (!dbPlayer) return;

      const newCoins = dbPlayer.coins + (isWinner ? coinReward : 25);
      const newMmr = isWinner
        ? dbPlayer.mmr + mmrDelta
        : Math.max(100, dbPlayer.mmr - mmrDelta);
      const newRankName = getRankName(newMmr);

      await supabase
        .from("players")
        .update({ coins: newCoins, mmr: newMmr, rank_name: newRankName })
        .eq("id", p.id);

      // Reflect updated values in the in-memory room object for the result screen
      p.coins = newCoins;
      p.mmr = newMmr;
      p.rankName = newRankName;

      io.to(p.id).emit("user:rewards", {
        isWinner,
        coinsEarned: isWinner ? coinReward : 25,
        mmrDeltaValue: isWinner ? mmrDelta : -mmrDelta
      });
    });

  // Wait for all DB writes before broadcasting final result
  await Promise.all(updatePromises).catch(err =>
    console.error("[DB] Error updating MMR/coins after game:", err)
  );

  io.to(room.id).emit("game:over", {
    winner: winningTeam,
    reason: reason,
    room: room
  });

  broadcastRoomUpdate(room.id);
}

// Logic: Execute Reveal Trump
function executeRevealTrump(roomId: string, playerId: string) {
  const room = rooms[roomId];
  if (!room || !room.gameState || room.gameState.isTrumpRevealed) return;

  // Conditions to open:
  // 1. It is their turn
  const turnPos = room.gameState.currentTurnPos;
  const player = room.players.find(p => p.position === turnPos);
  if (!player || player.id !== playerId) return;

  // 2. Is not the player who hid the card
  if (playerId === room.gameState.hiderId) return;

  // 3. Cannot follow the lead suit
  const leadSuit = room.gameState.leadSuit;
  if (!leadSuit) return; // Must have a leading card to prove they can't follow!
  
  const hand = roomHands[roomId]?.[playerId] || [];
  const hasLeadSuit = hand.some(c => c.suit === leadSuit);
  if (hasLeadSuit) return; // Cheat attempt: can follow suit, cannot open trump!

  // Reveal!
  const hiddenCard = roomHiddenCard[roomId];
  room.gameState.isTrumpRevealed = true;

  // Add the hidden card back into the hider's hand visually or log it
  const hider = room.players.find(p => p.id === room.gameState!.hiderId)!;
  
  // Actually, under standard rules, the hider kept this card face down. It is now revealed to everyone.
  // The card joins the hider's active hand. Let's make sure it is in their Hand array!
  const hiderHand = roomHands[roomId]?.[hider.id] || [];
  // Verify it isn't already there to prevent double adding
  if (!hiderHand.some(c => c.id === hiddenCard.id)) {
    hiderHand.push(hiddenCard);
  }

  const logText = `${player.username} could not follow lead suit ${getSuitSymbol(leadSuit)} and requested to OPEN the hidden Card! Revealed [${hiddenCard.rank}${getSuitSymbol(hiddenCard.suit)}]. Trump Suit is ${getSuitSymbol(hiddenCard.suit)}!`;

  io.to(roomId).emit("game:trump-revealed-anim", {
    revealedBy: player.username,
    card: hiddenCard,
    trumpSuit: hiddenCard.suit,
    logMessage: logText
  });

  io.to(roomId).emit("chat:message", {
    id: Math.random().toString(),
    senderName: "Referee Bot",
    senderId: "system",
    text: logText,
    timestamp: Date.now()
  });

  broadcastRoomUpdate(roomId);
}

// Socket.io handlers
io.on("connection", (socket: Socket) => {
  let activePlayerId: string | null = null;
  let activeRoomId: string | null = null;

  console.log("Socket connected:", socket.id);

  // Authenticate & Bind Player
  socket.on("user:login", async ({ id, username, avatar }) => {
    activePlayerId = id;
    socket.join(id); // Custom room for target emits

    try {
      const { data: existing } = await supabase
        .from("players")
        .select("*")
        .eq("id", id)
        .single();

      let player: Player;
      if (!existing) {
        // First time — create default profile
        player = createDefaultPlayer(id, username, avatar);
        await supabase.from("players").insert(playerToRow(player));
      } else {
        // Returning player — update username/avatar + mark connected
        await supabase.from("players")
          .update({ username, avatar, connected: true })
          .eq("id", id);
        player = rowToPlayer({ ...existing, username, avatar, connected: true });
      }

      socket.emit("user:profile-synced", { player });
    } catch (err) {
      console.error("[Socket] user:login error:", err);
      // Fallback: create a local player object so game still works
      const fallback = createDefaultPlayer(id, username, avatar);
      socket.emit("user:profile-synced", { player: fallback });
    }
  });

  // Create Custom Room
  socket.on("room:create", ({ name, isPrivate, playerProfile }) => {
    if (!activePlayerId) return;

    const roomId = Math.random().toString(36).substr(2, 4).toUpperCase();
    
    // Assign position 0 to creator
    const creator: Player = {
      ...playerProfile,
      id: activePlayerId,
      position: 0,
      team: "A",
      isReady: false,
      connected: true,
      isBot: false
    };

    rooms[roomId] = {
      id: roomId,
      name: name || `Room ${roomId}`,
      isPrivate: !!isPrivate,
      players: [creator],
      status: "WAITING",
      gameState: null,
      spectators: []
    };

    activeRoomId = roomId;
    socket.join(roomId);

    socket.emit("room:created", { roomId });
    broadcastRoomUpdate(roomId);
  });

  // Join Existing Room
  socket.on("room:join", ({ roomId, playerProfile }) => {
    if (!activePlayerId) return;

    const rId = roomId.toUpperCase();
    const room = rooms[rId];

    if (!room) {
      socket.emit("room:error", { message: "Room not found or expired" });
      return;
    }

    // Handle Reconnection
    const existingPlayer = room.players.find(p => p.id === activePlayerId);
    if (existingPlayer) {
      existingPlayer.connected = true;
      activeRoomId = rId;
      socket.join(rId);
      socket.emit("room:joined", { roomId: rId });
      broadcastRoomUpdate(rId);
      return;
    }

    if (room.players.length >= 4) {
      // Join as spectator
      const spec = { id: activePlayerId, username: playerProfile.username };
      room.spectators.push(spec);
      activeRoomId = rId;
      socket.join(rId);
      socket.emit("room:joined", { roomId: rId, isSpectator: true });
      broadcastRoomUpdate(rId);
      return;
    }

    // Join room normally
    const pos = room.players.length;
    const newPlayer: Player = {
      ...playerProfile,
      id: activePlayerId,
      position: pos,
      team: pos % 2 === 0 ? "A" : "B",
      isReady: false,
      connected: true,
      isBot: false
    };

    room.players.push(newPlayer);
    activeRoomId = rId;
    socket.join(rId);

    socket.emit("room:joined", { roomId: rId });
    broadcastRoomUpdate(rId);

    io.to(rId).emit("chat:message", {
      id: Math.random().toString(),
      senderName: "Lobby Bot",
      senderId: "system",
      text: `${newPlayer.username} joined the table as Seat ${pos + 1}.`,
      timestamp: Date.now()
    });
  });

  // Quick Match Matchmaking
  socket.on("room:quick-match", ({ playerProfile }) => {
    if (!activePlayerId) return;

    // Find any public waiting room
    let targetRoom = Object.values(rooms).find(room => !room.isPrivate && room.status === "WAITING" && room.players.length < 4);

    if (!targetRoom) {
      // Create one
      const rId = Math.random().toString(36).substr(2, 4).toUpperCase();
      const creator: Player = {
        ...playerProfile,
        id: activePlayerId,
        position: 0,
        team: "A",
        isReady: false,
        connected: true,
        isBot: false
      };

      rooms[rId] = {
        id: rId,
        name: `Quick Match ${rId}`,
        isPrivate: false,
        players: [creator],
        status: "WAITING",
        gameState: null,
        spectators: []
      };
      targetRoom = rooms[rId];
    } else {
      // Join
      const pos = targetRoom.players.length;
      const newPlayer: Player = {
        ...playerProfile,
        id: activePlayerId,
        position: pos,
        team: pos % 2 === 0 ? "A" : "B",
        isReady: false,
        connected: true,
        isBot: false
      };
      targetRoom.players.push(newPlayer);
    }

    activeRoomId = targetRoom.id;
    socket.join(targetRoom.id);
    socket.emit("room:joined", { roomId: targetRoom.id });
    broadcastRoomUpdate(targetRoom.id);

    // Auto-fill countdown: if waiting gets slow, fill up with Bots
    const rId = targetRoom.id;
    setTimeout(() => {
      const currentRoom = rooms[rId];
      if (currentRoom && currentRoom.status === "WAITING" && currentRoom.players.length < 4) {
        fillLobbyWithBots(currentRoom);
      }
    }, 4500); // 4.5s threshold
  });

  // Manual Trigger: Fill Lobby with Bots to start immediately!
  socket.on("room:fill-bots", () => {
    if (!activeRoomId) return;
    const room = rooms[activeRoomId];
    if (room && room.status === "WAITING") {
      fillLobbyWithBots(room);
    }
  });

  function fillLobbyWithBots(room: Room) {
    while (room.players.length < 4) {
      const botPos = room.players.length;
      const bot = createBot(botPos);
      room.players.push(bot);
      
      io.to(room.id).emit("chat:message", {
        id: Math.random().toString(),
        senderName: "Lobby Bot",
        senderId: "system",
        text: `${bot.username} joined the table as Seat ${botPos + 1}.`,
        timestamp: Date.now()
      });
    }

    broadcastRoomUpdate(room.id);
    // Automatic game start once bots are full!
    tryStartMatch(room.id);
  }

  // Toggle ready status
  socket.on("room:toggle-ready", () => {
    if (!activeRoomId || !activePlayerId) return;
    const room = rooms[activeRoomId];
    if (!room || room.status !== "WAITING") return;

    const p = room.players.find(x => x.id === activePlayerId);
    if (p) {
      p.isReady = !p.isReady;
      broadcastRoomUpdate(activeRoomId);
      
      // If everyone is ready, start the match!
      const allReady = room.players.every(p => p.isReady || p.isBot);
      if (allReady && room.players.length === 4) {
        tryStartMatch(activeRoomId);
      }
    }
  });

  function tryStartMatch(rId: string) {
    const room = rooms[rId];
    if (!room) return;

    initGame(room);

    // Trigger deck deal animation to client with custom delay
    io.to(rId).emit("game:deal-animation", {
      hiderId: room.gameState!.hiderId,
      delay: 1500
    });

    broadcastRoomUpdate(rId);

    // If hider is bot, let it pick the hidden card!
    triggerBotTurn(room);
  }

  // Game Action: Choose secret Trump card
  socket.on("game:hide-card", ({ cardId }) => {
    if (!activeRoomId || !activePlayerId) return;
    executeHideCard(activeRoomId, activePlayerId, cardId);
  });

  // Game Action: Play card from hand
  socket.on("game:play-card", ({ cardId }) => {
    if (!activeRoomId || !activePlayerId) return;
    executePlayCard(activeRoomId, activePlayerId, cardId);
  });

  // Game Action: Open Face-Down Trump
  socket.on("game:reveal-trump", () => {
    if (!activeRoomId || !activePlayerId) return;
    executeRevealTrump(activeRoomId, activePlayerId);
  });

  // Room Cosmetics customize
  socket.on("user:update-cosmetics", async ({ cardBack, tableSkin }) => {
    if (!activePlayerId) return;
    try {
      const updates: Record<string, string> = {};
      if (cardBack) updates.card_back = cardBack;
      if (tableSkin) updates.table_skin = tableSkin;

      const { data } = await supabase
        .from("players")
        .update(updates)
        .eq("id", activePlayerId)
        .select("*")
        .single();

      if (data) {
        socket.emit("user:profile-synced", { player: rowToPlayer(data) });
      }
    } catch (err) {
      console.error("[Socket] user:update-cosmetics error:", err);
    }
  });

  // Text message / Emotes
  socket.on("chat:send", ({ text, isEmote }) => {
    if (!activeRoomId || !activePlayerId) return;
    const room = rooms[activeRoomId];
    if (!room) return;

    const player = room.players.find(p => p.id === activePlayerId);
    if (!player) return;

    const message: Message = {
      id: Math.random().toString(),
      senderName: player.username,
      senderId: activePlayerId,
      text: text,
      isEmote: !!isEmote,
      timestamp: Date.now()
    };

    io.to(activeRoomId).emit("chat:message", message);
  });

  // Leave room
  socket.on("room:leave", () => {
    leaveCurrentRoom();
  });

  function leaveCurrentRoom() {
    if (!activeRoomId || !activePlayerId) return;
    const room = rooms[activeRoomId];
    if (!room) return;

    // Remove player
    room.players = room.players.filter(p => p.id !== activePlayerId);
    room.spectators = room.spectators.filter(p => p.id !== activePlayerId);
    socket.leave(activeRoomId);

    io.to(activeRoomId).emit("chat:message", {
      id: Math.random().toString(),
      senderName: "Lobby Bot",
      senderId: "system",
      text: `A player has left the table.`,
      timestamp: Date.now()
    });

    if (room.players.filter(p => !p.isBot).length === 0) {
      // Room empty of human players, clean it up!
      delete rooms[activeRoomId];
      delete roomHands[activeRoomId];
      delete roomHiddenCard[activeRoomId];
    } else {
      // If game was playing, abort or replace player with bot!
      if (room.status === "PLAYING" || room.status === "HIDING") {
        room.status = "FINISHED";
        if (room.gameState) {
          room.gameState.status = "FINISHED";
          room.gameState.winner = null;
          room.gameState.winReason = "Match aborted: player left mid-game.";
        }
      }
      broadcastRoomUpdate(activeRoomId);
    }

    activeRoomId = null;
  }

  // Disconnection
  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
    if (activeRoomId && activePlayerId) {
      const room = rooms[activeRoomId];
      if (room) {
        const p = room.players.find(x => x.id === activePlayerId);
        if (p) {
          p.connected = false;
          broadcastRoomUpdate(activeRoomId);
          
          // Auto-clean room after 90 seconds if offline player doesn't reconnect
          const rId = activeRoomId;
          const pId = activePlayerId;
          setTimeout(() => {
            const checkR = rooms[rId];
            if (checkR) {
              const checkP = checkR.players.find(x => x.id === pId);
              if (checkP && !checkP.connected) {
                // replace with BOT or clean room
                checkR.players = checkR.players.filter(x => x.id !== pId);
                if (checkR.players.filter(x => !x.isBot).length === 0) {
                  delete rooms[rId];
                } else {
                  broadcastRoomUpdate(rId);
                }
              }
            }
          }, 90000);
        }
      }
    }
  });
});

// Bind server
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Hidden Trump 10 server listening on Port ${PORT}`);
});
