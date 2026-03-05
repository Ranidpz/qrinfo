// ============ Q.GAMES - Mini Games Platform ============
// Real-time casual games where venue visitors play against each other

// =============================================================
// Core Types
// =============================================================

/** Available mini-game types */
export type QGameType = 'rps' | 'tictactoe' | 'memory' | 'oddoneout';

/** Game lifecycle phases (admin-controlled) */
export type QGamesPhase = 'active' | 'paused' | 'finished';

/** Match lifecycle status */
export type MatchStatus = 'countdown' | 'playing' | 'finished' | 'abandoned';

/** Queue entry status */
export type QueueStatus = 'waiting' | 'matched';

/** Player avatar type */
export type QGamesAvatarType = 'emoji' | 'selfie';

/** Rock-Paper-Scissors choice */
export type RPSChoice = 'rock' | 'paper' | 'scissors';

/** RPS round result */
export type RPSRoundResult = 'player1' | 'player2' | 'draw';

/** Odd One Out choice (משלוש יוצא אחד) */
export type OOOChoice = 'palm' | 'fist';

/** OOO round result - who is the odd one out */
export type OOORoundResult = 'player1' | 'player2' | 'player3' | 'draw';

/** Tic-Tac-Toe cell value */
export type TTTCell = 'X' | 'O' | null;

/** Tic-Tac-Toe marker */
export type TTTMarker = 'X' | 'O';

// =============================================================
// RPS Game Logic
// =============================================================

/** RPS outcome: returns 'player1', 'player2', or 'draw' */
export function resolveRPS(p1: RPSChoice, p2: RPSChoice): RPSRoundResult {
  if (p1 === p2) return 'draw';
  if (
    (p1 === 'rock' && p2 === 'scissors') ||
    (p1 === 'scissors' && p2 === 'paper') ||
    (p1 === 'paper' && p2 === 'rock')
  ) return 'player1';
  return 'player2';
}

/** RPS emoji mapping */
export const RPS_EMOJI: Record<RPSChoice, string> = {
  rock: '👊',
  paper: '🖐',
  scissors: '✌️',
};

/** RPS choice label keys (for i18n) */
export const RPS_LABEL_KEY: Record<RPSChoice, string> = {
  rock: 'rock',
  paper: 'paper',
  scissors: 'scissors',
};

// =============================================================
// TTT Game Logic
// =============================================================

/** All winning line indices for 3x3 board */
export const TTT_WIN_LINES: [number, number, number][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diagonals
];

/** Check if board has a winner. Returns marker or null. */
export function checkTTTWinner(board: (TTTCell)[]): TTTMarker | null {
  for (const [a, b, c] of TTT_WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as TTTMarker;
    }
  }
  return null;
}

/** Check if board is full (draw) */
export function isTTTDraw(board: (TTTCell)[]): boolean {
  return board.every(cell => cell !== null) && checkTTTWinner(board) === null;
}

/** Get the winning line indices, or null */
export function getWinLine(board: (TTTCell)[]): number[] | null {
  for (const line of TTT_WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return [a, b, c];
    }
  }
  return null;
}

/** Parse board string to TTTCell array */
export function parseTTTBoard(board: string): (TTTCell)[] {
  return board.split('').map(c => c === '_' ? null : c as TTTCell);
}

// =============================================================
// OOO Game Logic (משלוש יוצא אחד - Odd One Out)
// =============================================================

/** OOO outcome: returns who is the odd one out, or 'draw' if all same */
export function resolveOOO(p1: OOOChoice, p2: OOOChoice, p3: OOOChoice): OOORoundResult {
  if (p1 === p2 && p2 === p3) return 'draw';
  if (p1 !== p2 && p1 !== p3) return 'player1';
  if (p2 !== p1 && p2 !== p3) return 'player2';
  return 'player3';
}

/** OOO emoji mapping */
export const OOO_EMOJI: Record<OOOChoice, string> = {
  palm: '🖐️',
  fist: '✊',
};

/** OOO choice label keys (for i18n) */
export const OOO_LABEL_KEY: Record<OOOChoice, string> = {
  palm: 'palm',
  fist: 'fist',
};

// =============================================================
// Player Profile
// Firestore: codes/{codeId}/qgames_players/{visitorId}
// =============================================================
export interface QGamesPlayer {
  id: string;                     // visitorId from localStorage
  codeId: string;
  nickname: string;
  avatarType: QGamesAvatarType;
  avatarValue: string;            // emoji or selfie URL

  // Aggregate stats
  totalGamesPlayed: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  score: number;                  // Win=3pts, Draw=1pt, Loss=0

  // Per-game stats
  rpsPlayed: number;
  rpsWins: number;
  tictactoePlayed: number;
  tictactoeWins: number;
  memoryPlayed: number;
  memoryWins: number;
  oddoneoutPlayed: number;
  oddoneoutWins: number;

  registeredAt: number;
  lastPlayedAt: number;
}

// =============================================================
// Match Record
// Firestore: codes/{codeId}/qgames_matches/{matchId}
// =============================================================
export interface QGamesMatch {
  id: string;
  codeId: string;
  gameType: QGameType;

  player1Id: string;
  player1Nickname: string;
  player1AvatarType: QGamesAvatarType;
  player1AvatarValue: string;

  player2Id: string;
  player2Nickname: string;
  player2AvatarType: QGamesAvatarType;
  player2AvatarValue: string;

  // Optional player3 for 3-player games (OOO)
  player3Id?: string;
  player3Nickname?: string;
  player3AvatarType?: QGamesAvatarType;
  player3AvatarValue?: string;

  player1Score: number;
  player2Score: number;
  player3Score?: number;
  winnerId: string | null;        // null = draw (for 2-player games)
  winnerIds?: string[];            // OOO: the 2 surviving players
  loserId?: string | null;         // OOO: the eliminated player

  // Memory game: all player results (2-6 players)
  memoryResults?: {
    id: string;
    nickname: string;
    avatarType: QGamesAvatarType;
    avatarValue: string;
    score: number;
    strikes: number;
    eliminated: boolean;
  }[];

  status: MatchStatus;
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
}

// =============================================================
// Queue Entry (RTDB)
// =============================================================
export interface QGamesQueueEntry {
  id: string;                     // visitorId
  nickname: string;
  avatarType: QGamesAvatarType;
  avatarValue: string;
  gameType: QGameType;
  joinedAt: number;
  status: QueueStatus;
  matchId: string | null;
  inBotMatch?: boolean;           // true = player is in bot match, invisible to matchmaking
  preferredOpponentId?: string;   // who invited this player (from ?invite= URL param)
}

// =============================================================
// RTDB Match State
// =============================================================
export interface RTDBMatch {
  id: string;
  gameType: QGameType;

  player1Id: string;
  player1Nickname: string;
  player1AvatarType: QGamesAvatarType;
  player1AvatarValue: string;

  player2Id: string;
  player2Nickname: string;
  player2AvatarType: QGamesAvatarType;
  player2AvatarValue: string;

  // Optional player3 for 3-player games (OOO)
  player3Id?: string;
  player3Nickname?: string;
  player3AvatarType?: QGamesAvatarType;
  player3AvatarValue?: string;

  status: MatchStatus;
  startedAt: number;
  finishedAt: number | null;
  lastUpdated: number;
}

/** RPS round state in RTDB */
export interface RTDBRPSRound {
  player1Choice: RPSChoice | null;
  player2Choice: RPSChoice | null;
  winner: RPSRoundResult | null;
  timerStartedAt: number;
  timerDuration: number;          // seconds
  revealed: boolean;
  player1TimedOut?: boolean;
  player2TimedOut?: boolean;
}

/** RPS match state in RTDB */
export interface RTDBRPSState {
  currentRound: number;
  player1Score: number;
  player2Score: number;
  firstTo: number;
  rounds: Record<string, RTDBRPSRound>;
  consecutiveMutualTimeouts?: number;
}

/** TTT match state in RTDB */
export interface RTDBTTTState {
  board: string;                  // 9-char: "X_O______" (_ = empty)
  currentTurn: string;            // player1Id or player2Id
  xPlayerId: string;
  oPlayerId: string;
  winner: string | null;          // round winner playerId or null
  isDraw: boolean;
  moveCount: number;
  // Multi-round match fields
  currentRound: number;
  player1Score: number;
  player2Score: number;
  firstTo: number;                // first to N round wins
  timerStartedAt: number;         // when current turn timer started
  timerDuration: number;          // seconds per turn
  winLine: number[] | null;       // winning line indices [0,1,2] or null
  roundFinished: boolean;         // true when round has a winner or draw
}

// =============================================================
// Memory Game (זיכרון) - Emoji sequence memory challenge
// =============================================================

/** Memory room status */
export type MemoryRoomStatus = 'lobby' | 'playing' | 'finished';

/** Memory game phase (within a round) */
export type MemoryPhase = 'countdown' | 'memorize' | 'recall' | 'results';

/** Memory player in RTDB */
export interface RTDBMemoryPlayer {
  nickname: string;
  avatarType: QGamesAvatarType;
  avatarValue: string;
  score: number;
  strikes: number;
  eliminated: boolean;
  joinedAt: number;
  roundResult: {
    selections: string[];
    correctCount: number;
    failed: boolean;
    submittedAt: number;
  } | null;
}

/** Memory room state in RTDB */
export interface RTDBMemoryState {
  hostId: string;
  status: MemoryRoomStatus;
  maxStrikes: number;
  maxPlayers: number;
  createdAt: number;

  // Current round data (set by host each round)
  currentRound: number;
  difficulty: number;               // emojis to remember (3, 4, 5)
  targetEmojis: string[];           // ordered sequence to remember
  options: string[];                // 9 shuffled emoji options
  phase: MemoryPhase;
  phaseStartedAt: number;           // timestamp for timer sync
  countdownDuration: number;        // ms (default 3000)
  memorizeDuration: number;         // ms (default 3000)
  recallDuration: number;           // ms (default 10000)

  // Players (dynamic, keyed by visitorId)
  players: Record<string, RTDBMemoryPlayer>;
}

/** OOO round state in RTDB */
export interface RTDBOOORound {
  player1Choice: OOOChoice | null;
  player2Choice: OOOChoice | null;
  player3Choice: OOOChoice | null;
  loser: OOORoundResult | null;   // who is the odd one out
  timerStartedAt: number;
  timerDuration: number;          // seconds
  revealed: boolean;
  player1TimedOut?: boolean;
  player2TimedOut?: boolean;
  player3TimedOut?: boolean;
}

/** OOO match state in RTDB */
export interface RTDBOOOState {
  currentRound: number;
  player1Strikes: number;
  player2Strikes: number;
  player3Strikes: number;
  maxStrikes: number;             // first to N strikes loses
  rounds: Record<string, RTDBOOORound>;
}

// =============================================================
// Leaderboard Entry (RTDB)
// =============================================================
export interface QGamesLeaderboardEntry {
  id: string;
  nickname: string;
  avatarType: QGamesAvatarType;
  avatarValue: string;
  score: number;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  rank: number;
  lastPlayedAt: number;

  // Per-game stats (for filtering / per-game leaderboard)
  rpsPlayed?: number;
  rpsWins?: number;
  oddoneoutPlayed?: number;
  oddoneoutWins?: number;
  tictactoePlayed?: number;
  tictactoeWins?: number;
  memoryPlayed?: number;
  memoryWins?: number;
}

// =============================================================
// Stats (RTDB)
// =============================================================
export interface QGamesStats {
  totalPlayers: number;
  playersOnline: number;
  totalMatches: number;
  matchesInProgress: number;
  lastUpdated: number;
}

// =============================================================
// Themes
// =============================================================

/** Predefined theme identifiers */
export type QGamesThemeId = 'dark-gaming' | 'light-clean' | 'kids-colorful' | 'corporate';

/** Full theme color palette */
export interface QGamesTheme {
  id: QGamesThemeId;
  nameHe: string;
  nameEn: string;
  emoji: string;
  backgroundColor: string;
  primaryColor: string;
  accentColor: string;
  textColor: string;
  textSecondary: string;
  surfaceColor: string;
  surfaceHover: string;
  borderColor: string;
  gradientFrom: string;
  gradientTo: string;
}

export const QGAMES_THEMES: Record<QGamesThemeId, QGamesTheme> = {
  'dark-gaming': {
    id: 'dark-gaming',
    nameHe: 'גיימינג',
    nameEn: 'Dark Gaming',
    emoji: '🎮',
    backgroundColor: '#0a0f1a',
    primaryColor: '#8b5cf6',
    accentColor: '#10b981',
    textColor: '#ffffff',
    textSecondary: 'rgba(255,255,255,0.4)',
    surfaceColor: 'rgba(255,255,255,0.04)',
    surfaceHover: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.08)',
    gradientFrom: '#8b5cf6',
    gradientTo: '#6d28d9',
  },
  'light-clean': {
    id: 'light-clean',
    nameHe: 'בהיר ונקי',
    nameEn: 'Light & Clean',
    emoji: '✨',
    backgroundColor: '#f8fafc',
    primaryColor: '#6366f1',
    accentColor: '#0ea5e9',
    textColor: '#1e293b',
    textSecondary: '#64748b',
    surfaceColor: '#ffffff',
    surfaceHover: '#f1f5f9',
    borderColor: '#e2e8f0',
    gradientFrom: '#6366f1',
    gradientTo: '#4f46e5',
  },
  'kids-colorful': {
    id: 'kids-colorful',
    nameHe: 'מסיבה צבעונית',
    nameEn: 'Kids Party',
    emoji: '🎉',
    backgroundColor: '#1a0a2e',
    primaryColor: '#f59e0b',
    accentColor: '#ec4899',
    textColor: '#ffffff',
    textSecondary: 'rgba(255,255,255,0.5)',
    surfaceColor: 'rgba(255,255,255,0.06)',
    surfaceHover: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.1)',
    gradientFrom: '#f59e0b',
    gradientTo: '#d97706',
  },
  'corporate': {
    id: 'corporate',
    nameHe: 'אירוע חברה',
    nameEn: 'Corporate',
    emoji: '💼',
    backgroundColor: '#111827',
    primaryColor: '#3b82f6',
    accentColor: '#14b8a6',
    textColor: '#f9fafb',
    textSecondary: '#9ca3af',
    surfaceColor: 'rgba(255,255,255,0.05)',
    surfaceHover: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.10)',
    gradientFrom: '#3b82f6',
    gradientTo: '#2563eb',
  },
};

/** Resolve full theme from branding config */
export function resolveTheme(branding: QGamesBranding): QGamesTheme {
  const themeId = branding.theme || 'dark-gaming';
  return QGAMES_THEMES[themeId] || QGAMES_THEMES['dark-gaming'];
}

// =============================================================
// Branding
// =============================================================
export interface QGamesBranding {
  theme?: QGamesThemeId;
  title?: string;
  titleEn?: string;
  description?: string;
  descriptionEn?: string;
  backgroundColor: string;
  primaryColor: string;
  accentColor: string;
  eventLogo?: string;
  backgroundImage?: string;
}

// =============================================================
// Main Config (stored in MediaItem.qgamesConfig)
// =============================================================
export interface QGamesConfig {
  phase: QGamesPhase;
  enabledGames: QGameType[];

  // RPS settings
  rpsFirstTo: number;             // First to N (default: 3)
  rpsFirstRoundTimer: number;     // Seconds (default: 5)
  rpsSubsequentTimer: number;     // Seconds (default: 3)

  // OOO settings (Odd One Out)
  oooMaxStrikes: number;          // First to N strikes loses (default: 3)
  oooFirstRoundTimer: number;     // Seconds (default: 5)
  oooSubsequentTimer: number;     // Seconds (default: 3)

  // TTT settings (Tic-Tac-Toe)
  tttFirstTo: number;             // First to N round wins (default: 3)
  tttTurnTimer: number;           // Seconds per turn (default: 10)

  // Memory settings
  memoryMaxStrikes: number;       // Strikes before elimination (default: 3)
  memoryRecallTimer: number;      // Seconds for recall phase (default: 10)
  memoryMemorizeTimer: number;    // Seconds to show emojis (default: 3)

  // Branding
  branding: QGamesBranding;

  // Avatar
  emojiPalette: string[];
  allowSelfie: boolean;

  // Language
  language: 'he' | 'en' | 'auto';

  // Sound
  enableSound: boolean;

  // Leaderboard
  showLeaderboard: boolean;

  // WhatsApp invite
  enableWhatsAppInvite: boolean;

  // Stats (denormalized from RTDB)
  stats: QGamesStats;

  createdAt?: number;
  lastResetAt?: number;
}

/** Check if a game type requires 3 players */
export function is3PlayerGame(gameType: QGameType): boolean {
  return gameType === 'oddoneout';
}

/** Check if a game type uses lobby-based matchmaking (2-6 players) */
export function isLobbyGame(gameType: QGameType): boolean {
  return gameType === 'memory';
}

// =============================================================
// Scoring Constants
// =============================================================
export const MATCH_POINTS = {
  WIN: 3,
  DRAW: 1,
  LOSS: 0,
} as const;

// =============================================================
// Defaults
// =============================================================

export const DEFAULT_QGAMES_EMOJI_PALETTE = [
  '😎', '🤠', '🥷', '🧙', '🦸', '🧛',
  '🤩', '🥳', '😈', '🤖', '👽', '🎃',
  '🦁', '🐯', '🦊', '🐺', '🦄', '🐉',
  '🔥', '💪', '👑', '💎', '⚡', '🚀',
];

export const DEFAULT_QGAMES_BRANDING: QGamesBranding = {
  theme: 'dark-gaming',
  backgroundColor: '#0a0f1a',
  primaryColor: '#8b5cf6',
  accentColor: '#10b981',
};

export const DEFAULT_QGAMES_CONFIG: QGamesConfig = {
  phase: 'active',
  enabledGames: ['rps'],

  rpsFirstTo: 3,
  rpsFirstRoundTimer: 5,
  rpsSubsequentTimer: 3,

  oooMaxStrikes: 3,
  oooFirstRoundTimer: 5,
  oooSubsequentTimer: 3,

  tttFirstTo: 3,
  tttTurnTimer: 10,

  memoryMaxStrikes: 3,
  memoryRecallTimer: 10,
  memoryMemorizeTimer: 3,

  branding: { ...DEFAULT_QGAMES_BRANDING },

  emojiPalette: [...DEFAULT_QGAMES_EMOJI_PALETTE],
  allowSelfie: true,
  language: 'auto',
  enableSound: true,
  showLeaderboard: true,
  enableWhatsAppInvite: true,

  stats: {
    totalPlayers: 0,
    playersOnline: 0,
    totalMatches: 0,
    matchesInProgress: 0,
    lastUpdated: 0,
  },
};

// =============================================================
// Game Metadata (for selector UI)
// =============================================================
export const GAME_META: Record<QGameType, {
  emoji: string;
  labelKey: string;
  descriptionKey: string;
}> = {
  rps: {
    emoji: '✊',
    labelKey: 'rps',
    descriptionKey: 'rpsDescription',
  },
  tictactoe: {
    emoji: '❌',
    labelKey: 'tictactoe',
    descriptionKey: 'tictactoeDescription',
  },
  memory: {
    emoji: '🃏',
    labelKey: 'memory',
    descriptionKey: 'memoryDescription',
  },
  oddoneout: {
    emoji: '🖐️',
    labelKey: 'oddoneout',
    descriptionKey: 'oddoneoutDescription',
  },
};

// =============================================================
// Memory Emoji Pool
// =============================================================
export const MEMORY_EMOJI_POOL = [
  '🍎', '🍊', '🍋', '🍇', '🍉', '🍓', '🫐', '🍑', '🥝', '🍌',
  '🌸', '🌻', '🌺', '🌷', '🌹', '🌵', '🍀', '🌿', '🌙', '⭐',
  '🐶', '🐱', '🐰', '🦊', '🐼', '🐸', '🦁', '🐯', '🐵', '🦋',
  '🚗', '✈️', '🚀', '⛵', '🚲', '🏠', '⛰️', '🌊', '🔥', '❄️',
  '⚽', '🏀', '🎾', '🎯', '🎸', '🎨', '📚', '💡', '🔔', '💎',
  '🎂', '🍕', '🍦', '🧁', '🍩', '☕', '🎁', '🎈', '🎭', '🏆',
];

// =============================================================
// RTDB Path Helpers
// =============================================================
export const QGAMES_PATHS = {
  root: (codeId: string) => `qgames/${codeId}`,
  stats: (codeId: string) => `qgames/${codeId}/stats`,
  queue: (codeId: string) => `qgames/${codeId}/queue`,
  queueEntry: (codeId: string, visitorId: string) => `qgames/${codeId}/queue/${visitorId}`,
  matches: (codeId: string) => `qgames/${codeId}/matches`,
  match: (codeId: string, matchId: string) => `qgames/${codeId}/matches/${matchId}`,
  rpsState: (codeId: string, matchId: string) => `qgames/${codeId}/matches/${matchId}/rps`,
  rpsRound: (codeId: string, matchId: string, round: number) => `qgames/${codeId}/matches/${matchId}/rps/rounds/${round}`,
  tttState: (codeId: string, matchId: string) => `qgames/${codeId}/matches/${matchId}/ttt`,
  memoryState: (codeId: string, matchId: string) => `qgames/${codeId}/matches/${matchId}/memory`,
  memoryRooms: (codeId: string) => `qgames/${codeId}/memoryRooms`,
  memoryRoom: (codeId: string, roomId: string) => `qgames/${codeId}/memoryRooms/${roomId}`,
  memoryRoomPlayers: (codeId: string, roomId: string) => `qgames/${codeId}/memoryRooms/${roomId}/players`,
  memoryRoomPlayer: (codeId: string, roomId: string, playerId: string) => `qgames/${codeId}/memoryRooms/${roomId}/players/${playerId}`,
  oooState: (codeId: string, matchId: string) => `qgames/${codeId}/matches/${matchId}/ooo`,
  oooRound: (codeId: string, matchId: string, round: number) => `qgames/${codeId}/matches/${matchId}/ooo/rounds/${round}`,
  presence: (codeId: string, matchId: string) => `qgames/${codeId}/matches/${matchId}/presence`,
  playerPresence: (codeId: string, matchId: string, playerId: string) => `qgames/${codeId}/matches/${matchId}/presence/${playerId}`,
  leaderboard: (codeId: string) => `qgames/${codeId}/leaderboard`,
  leaderboardEntry: (codeId: string, visitorId: string) => `qgames/${codeId}/leaderboard/${visitorId}`,
  viewers: (codeId: string) => `qgames/${codeId}/viewers`,
  viewer: (codeId: string, visitorId: string) => `qgames/${codeId}/viewers/${visitorId}`,
};
