// ============ Q.GAMES - Mini Games Platform ============
// Real-time casual games where venue visitors play against each other

// =============================================================
// Core Types
// =============================================================

/** Available mini-game types */
export type QGameType = 'rps' | 'tictactoe' | 'memory' | 'oddoneout' | 'connect4';

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

/** Connect 4 cell value */
export type C4Cell = 'R' | 'W' | null;

/** Connect 4 marker (piece color) */
export type C4Marker = 'R' | 'W';

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
// Connect 4 Game Logic (ארבע בשורה - 4 in a Row)
// =============================================================

/** Board dimensions */
export const C4_COLS = 7;
export const C4_ROWS = 6;
export const C4_CELLS = 42; // 7 * 6

/** Generate all winning line indices for 7x6 board */
function generateC4WinLines(): [number, number, number, number][] {
  const lines: [number, number, number, number][] = [];

  // Horizontal (24 lines: 6 rows * 4 positions)
  for (let row = 0; row < C4_ROWS; row++) {
    for (let col = 0; col <= C4_COLS - 4; col++) {
      const base = row * C4_COLS + col;
      lines.push([base, base + 1, base + 2, base + 3]);
    }
  }

  // Vertical (21 lines: 7 cols * 3 positions)
  for (let col = 0; col < C4_COLS; col++) {
    for (let row = 0; row <= C4_ROWS - 4; row++) {
      const base = row * C4_COLS + col;
      lines.push([base, base + C4_COLS, base + 2 * C4_COLS, base + 3 * C4_COLS]);
    }
  }

  // Diagonal down-right (12 lines)
  for (let row = 0; row <= C4_ROWS - 4; row++) {
    for (let col = 0; col <= C4_COLS - 4; col++) {
      const base = row * C4_COLS + col;
      lines.push([base, base + C4_COLS + 1, base + 2 * (C4_COLS + 1), base + 3 * (C4_COLS + 1)]);
    }
  }

  // Diagonal down-left (12 lines)
  for (let row = 0; row <= C4_ROWS - 4; row++) {
    for (let col = 3; col < C4_COLS; col++) {
      const base = row * C4_COLS + col;
      lines.push([base, base + C4_COLS - 1, base + 2 * (C4_COLS - 1), base + 3 * (C4_COLS - 1)]);
    }
  }

  return lines;
}

/** All winning line indices for 7x6 board (69 total) */
export const C4_WIN_LINES: [number, number, number, number][] = generateC4WinLines();

/** Parse board string to C4Cell array */
export function parseC4Board(board: string): (C4Cell)[] {
  return board.split('').map(c => c === '_' ? null : c as C4Cell);
}

/** Check if board has a winner. Returns marker or null. */
export function checkC4Winner(board: (C4Cell)[]): C4Marker | null {
  for (const [a, b, c, d] of C4_WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c] && board[a] === board[d]) {
      return board[a] as C4Marker;
    }
  }
  return null;
}

/** Check if board is full (draw) */
export function isC4Draw(board: (C4Cell)[]): boolean {
  return board.every(cell => cell !== null) && checkC4Winner(board) === null;
}

/** Get the winning line indices, or null */
export function getC4WinLine(board: (C4Cell)[]): number[] | null {
  for (const line of C4_WIN_LINES) {
    const [a, b, c, d] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c] && board[a] === board[d]) {
      return [a, b, c, d];
    }
  }
  return null;
}

/**
 * Find the lowest empty row in a column (gravity).
 * Returns the row index (0=top, 5=bottom), or -1 if column is full.
 */
export function getC4DropRow(board: (C4Cell)[], col: number): number {
  for (let row = C4_ROWS - 1; row >= 0; row--) {
    if (board[row * C4_COLS + col] === null) {
      return row;
    }
  }
  return -1;
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
  connect4Played: number;
  connect4Wins: number;

  registeredAt: number;
  lastPlayedAt: number;

  // Rewards & Progression
  rankId?: string;
  totalPacksEarned?: number;
  unopenedPacks?: number;
  inventory?: QGamesInventoryItem[];
  equippedTitle?: string | null;
  equippedBorder?: string | null;
  equippedCelebration?: string | null;
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

/** Lightweight match info for live matches display on selector */
export interface LiveMatchInfo {
  matchId: string;
  gameType: QGameType;
  player1Id: string;
  player1Nickname: string;
  player1AvatarType: QGamesAvatarType;
  player1AvatarValue: string;
  player2Id: string;
  player2Nickname: string;
  player2AvatarType: QGamesAvatarType;
  player2AvatarValue: string;
  player3Id?: string;
  player3Nickname?: string;
  player3AvatarType?: QGamesAvatarType;
  player3AvatarValue?: string;
  startedAt: number;
}

/** Viewer presence data stored in RTDB */
export interface ViewerPresenceData {
  joinedAt: number;
  nickname: string;
  avatarType: QGamesAvatarType;
  avatarValue: string;
}

/** Viewer info for the online players modal (enriched with status) */
export interface OnlineViewerInfo {
  visitorId: string;
  nickname: string;
  avatarType: QGamesAvatarType;
  avatarValue: string;
  joinedAt: number;
  status: 'idle' | 'playing';
  playingGame?: QGameType;
  playingVs?: string;
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

/** Connect 4 match state in RTDB */
export interface RTDBC4State {
  board: string;                  // 42-char: "R_W______..." (_ = empty, R = red, W = white)
  currentTurn: string;            // player1Id or player2Id
  redPlayerId: string;            // who plays RED
  whitePlayerId: string;          // who plays WHITE
  winner: string | null;          // round winner playerId or null
  isDraw: boolean;
  moveCount: number;
  lastCol: number;                // last column played (-1 initially) for drop animation
  // Multi-round match fields
  currentRound: number;
  player1Score: number;
  player2Score: number;
  firstTo: number;                // first to N round wins
  timerStartedAt: number;         // when current turn timer started
  timerDuration: number;          // seconds per turn
  winLine: number[] | null;       // winning line indices [idx1,idx2,idx3,idx4] or null
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
  connect4Played?: number;
  connect4Wins?: number;

  // Rewards (display only)
  rankId?: string;
  equippedTitle?: string | null;
  equippedBorder?: string | null;
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

/** Resolve full theme from branding config, merging custom color overrides */
export function resolveTheme(branding: QGamesBranding): QGamesTheme {
  const themeId = branding.theme || 'dark-gaming';
  const base = QGAMES_THEMES[themeId] || QGAMES_THEMES['dark-gaming'];

  // Check if user customized any of the 3 editable colors
  const customBg = branding.backgroundColor && branding.backgroundColor !== base.backgroundColor;
  const customPrimary = branding.primaryColor && branding.primaryColor !== base.primaryColor;
  const customAccent = branding.accentColor && branding.accentColor !== base.accentColor;

  if (!customBg && !customPrimary && !customAccent) return base;

  return {
    ...base,
    ...(customBg && { backgroundColor: branding.backgroundColor }),
    ...(customPrimary && {
      primaryColor: branding.primaryColor,
      gradientFrom: branding.primaryColor,
      gradientTo: branding.primaryColor,
    }),
    ...(customAccent && { accentColor: branding.accentColor }),
  };
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
  // Logo
  eventLogo?: string;
  eventLogoName?: string;
  eventLogoSize?: number;
  logoScale?: number; // 0.3-4.0, default 1
  // Background image
  backgroundImage?: string;
  backgroundImageName?: string;
  backgroundImageSize?: number;
  imageOverlayOpacity?: number; // 0-80, default 40
  backgroundBlur?: number; // 0-20, default 0
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

  // Connect 4 settings (4 in a Row)
  c4FirstTo: number;              // First to N round wins (default: 3)
  c4TurnTimer: number;            // Seconds per turn (default: 15)

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

  // Chat
  chatEnabled: boolean;
  chatPhrases: QGamesChatPhrase[];
  chatBubbleColor?: string;           // Default bubble color (hex)

  // Stats (denormalized from RTDB)
  stats: QGamesStats;

  // Auto-reset schedule
  autoReset?: QGamesAutoReset;

  // Rewards & Packs
  rewards?: QGamesRewardsConfig;

  createdAt?: number;
  lastResetAt?: number;
}

// =============================================================
// Auto-Reset Schedule
// =============================================================

/** A single auto-reset time slot */
export interface QGamesScheduleSlot {
  dayOfWeek: number;  // 0=Sun..6=Sat, -1=daily
  hour: number;       // 0-23 (Israel time)
  minute: number;     // 0-59
}

/** Auto-reset schedule configuration */
export interface QGamesAutoReset {
  enabled: boolean;
  slots: QGamesScheduleSlot[];
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
// Ranks & Rewards
// =============================================================

/** Default points needed to earn one pack */
export const DEFAULT_POINTS_PER_PACK = 15;

/** Player rank tier definition */
export interface QGamesRankTier {
  id: string;
  nameEn: string;
  nameHe: string;
  icon: string;
  minScore: number;
  color: string;
}

/** All rank tiers, ordered from lowest to highest */
export const RANK_TIERS: QGamesRankTier[] = [
  { id: 'rookie',    nameEn: 'Rookie',     nameHe: 'טירון',    icon: '🌱', minScore: 0,   color: '#6B7280' },
  { id: 'contender', nameEn: 'Contender',  nameHe: 'מתמודד',   icon: '⚔️', minScore: 15,  color: '#C0C0C0' },
  { id: 'warrior',   nameEn: 'Warrior',    nameHe: 'לוחם',     icon: '🛡️', minScore: 45,  color: '#F59E0B' },
  { id: 'champion',  nameEn: 'Champion',   nameHe: 'אלוף',     icon: '🏆', minScore: 100, color: '#3B82F6' },
  { id: 'legend',    nameEn: 'Legend',      nameHe: 'אגדה',     icon: '💎', minScore: 200, color: '#8B5CF6' },
  { id: 'mythic',    nameEn: 'Mythic',      nameHe: 'מיתוס',    icon: '👑', minScore: 400, color: '#F59E0B' },
];

/** Get the rank tier for a given score */
export function getRankForScore(score: number): QGamesRankTier {
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (score >= RANK_TIERS[i].minScore) return RANK_TIERS[i];
  }
  return RANK_TIERS[0];
}

/** Get the next rank tier (or null if already max) */
export function getNextRank(score: number): QGamesRankTier | null {
  const current = getRankForScore(score);
  const idx = RANK_TIERS.findIndex(t => t.id === current.id);
  return idx < RANK_TIERS.length - 1 ? RANK_TIERS[idx + 1] : null;
}

/** Prize rarity levels */
export type QGamesPrizeRarity = 'common' | 'rare' | 'epic' | 'legendary';

/** Prize types */
export type QGamesPrizeType = 'avatar_border' | 'title' | 'celebration';

/** Static prize definition (cosmetic catalog) */
export interface QGamesPrize {
  id: string;
  type: QGamesPrizeType;
  rarity: QGamesPrizeRarity;
  value: string;
  nameEn: string;
  nameHe: string;
}

/** Rarity drop rates (must sum to 100) */
export const RARITY_DROP_RATES: Record<QGamesPrizeRarity, number> = {
  common: 50,
  rare: 30,
  epic: 15,
  legendary: 5,
};

/** Rarity display config */
export const RARITY_CONFIG: Record<QGamesPrizeRarity, {
  color: string;
  nameEn: string;
  nameHe: string;
  emoji: string;
}> = {
  common:    { color: '#6B7280', nameEn: 'Common',    nameHe: 'רגיל',  emoji: '⚪' },
  rare:      { color: '#3B82F6', nameEn: 'Rare',      nameHe: 'נדיר',  emoji: '🔵' },
  epic:      { color: '#8B5CF6', nameEn: 'Epic',      nameHe: 'אפי',   emoji: '🟣' },
  legendary: { color: '#F59E0B', nameEn: 'Legendary', nameHe: 'אגדי',  emoji: '🟡' },
};

/** Static cosmetic prize catalog */
export const QGAMES_PRIZE_CATALOG: QGamesPrize[] = [
  // === Common Borders ===
  { id: 'border_white',  type: 'avatar_border', rarity: 'common', value: '#FFFFFF', nameEn: 'White Ring',   nameHe: 'טבעת לבנה' },
  { id: 'border_green',  type: 'avatar_border', rarity: 'common', value: '#10B981', nameEn: 'Green Ring',   nameHe: 'טבעת ירוקה' },
  { id: 'border_blue',   type: 'avatar_border', rarity: 'common', value: '#3B82F6', nameEn: 'Blue Ring',    nameHe: 'טבעת כחולה' },
  // === Common Titles ===
  { id: 'title_player',  type: 'title', rarity: 'common', value: 'player',  nameEn: 'Player',  nameHe: 'שחקן' },
  { id: 'title_gamer',   type: 'title', rarity: 'common', value: 'gamer',   nameEn: 'Gamer',   nameHe: 'גיימר' },
  // === Common Celebrations ===
  { id: 'celeb_stars',   type: 'celebration', rarity: 'common', value: 'stars', nameEn: 'Stars Burst', nameHe: 'פיצוץ כוכבים' },
  // === Rare Borders ===
  { id: 'border_purple_gradient', type: 'avatar_border', rarity: 'rare', value: 'linear-gradient(135deg, #8B5CF6, #EC4899)', nameEn: 'Purple Gradient', nameHe: 'סגול גרדיאנט' },
  { id: 'border_orange_gradient', type: 'avatar_border', rarity: 'rare', value: 'linear-gradient(135deg, #F59E0B, #EF4444)', nameEn: 'Orange Gradient', nameHe: 'כתום גרדיאנט' },
  // === Rare Titles ===
  { id: 'title_strategist', type: 'title', rarity: 'rare', value: 'strategist', nameEn: 'Strategist', nameHe: 'אסטרטג' },
  { id: 'title_fighter',    type: 'title', rarity: 'rare', value: 'fighter',    nameEn: 'Fighter',    nameHe: 'לוחם' },
  // === Rare Celebrations ===
  { id: 'celeb_fireworks', type: 'celebration', rarity: 'rare', value: 'fireworks', nameEn: 'Fireworks', nameHe: 'זיקוקים' },
  // === Epic Borders ===
  { id: 'border_gold_pulse',    type: 'avatar_border', rarity: 'epic', value: 'gold_pulse',    nameEn: 'Gold Pulse',    nameHe: 'זהב פועם' },
  { id: 'border_rainbow_shift', type: 'avatar_border', rarity: 'epic', value: 'rainbow_shift', nameEn: 'Rainbow Shift', nameHe: 'קשת מתחלפת' },
  // === Epic Titles ===
  { id: 'title_master',      type: 'title', rarity: 'epic', value: 'master',      nameEn: 'Master',      nameHe: 'מאסטר' },
  { id: 'title_unstoppable', type: 'title', rarity: 'epic', value: 'unstoppable', nameEn: 'Unstoppable', nameHe: 'בלתי ניתן לעצירה' },
  // === Epic Celebrations ===
  { id: 'celeb_golden_confetti', type: 'celebration', rarity: 'epic', value: 'golden_confetti', nameEn: 'Golden Confetti', nameHe: 'קונפטי זהב' },
  // === Legendary Borders ===
  { id: 'border_prismatic', type: 'avatar_border', rarity: 'legendary', value: 'prismatic', nameEn: 'Prismatic Glow', nameHe: 'זוהר פריזמטי' },
  // === Legendary Titles ===
  { id: 'title_living_legend', type: 'title', rarity: 'legendary', value: 'living_legend', nameEn: 'Living Legend', nameHe: 'אגדה חיה' },
  // === Legendary Celebrations ===
  { id: 'celeb_epic_explosion', type: 'celebration', rarity: 'legendary', value: 'epic_explosion', nameEn: 'Epic Explosion', nameHe: 'פיצוץ אפי' },
];

/** Item in a player's inventory */
export interface QGamesInventoryItem {
  prizeId: string;
  type: QGamesPrizeType;
  rarity: QGamesPrizeRarity;
  nameEn: string;
  nameHe: string;
  value: string;
  earnedAt: number;
  isCustomPrize?: boolean;
}

/** Admin-defined real prize (per event, limited stock) */
export interface QGamesCustomPrize {
  id: string;
  name: string;
  description?: string;
  totalStock: number;
  claimed: number;
  dropChance: number;
  image?: string;
}

/** Rewards configuration (part of QGamesConfig) */
export interface QGamesRewardsConfig {
  enablePacks: boolean;
  pointsPerPack: number;
  customPrizes: QGamesCustomPrize[];
}

export const DEFAULT_REWARDS_CONFIG: QGamesRewardsConfig = {
  enablePacks: true,
  pointsPerPack: DEFAULT_POINTS_PER_PACK,
  customPrizes: [],
};

/** Rewards info returned by finish API */
export interface QGamesRewardsResult {
  previousRankId: string;
  newRankId: string;
  rankChanged: boolean;
  packsEarned: number;
  unopenedPacks: number;
}

// =============================================================
// Lobby Chat
// =============================================================

/** Chat phrase type */
export type ChatPhraseType = 'text' | 'emoji';

/** Admin-configurable chat phrase (bubble) */
export interface QGamesChatPhrase {
  id: string;
  text: string;           // Hebrew text or emoji-only
  textEn?: string;        // English text (optional)
  emoji?: string;         // Emoji prefix for text phrases
  color?: string;         // Custom bubble color (hex), overrides default
  type: ChatPhraseType;   // 'text' = text bubble, 'emoji' = large emoji reaction
}

/** Default chat phrases - positive, fun, gender-neutral plural */
export const DEFAULT_CHAT_PHRASES: QGamesChatPhrase[] = [
  // Game invites
  { id: 'inv1', text: 'בואו לאיקס עיגול!', emoji: '⭕', type: 'text' },
  { id: 'inv2', text: 'מי בא לאבן נייר ומספריים?', emoji: '✊', type: 'text' },
  { id: 'inv3', text: 'מי מצטרפים?', emoji: '🎮', type: 'text' },
  { id: 'inv4', text: 'בואו לזיכרון!', emoji: '🧠', type: 'text' },
  { id: 'inv5', text: 'בואו לארבע בשורה!', emoji: '🔴', type: 'text' },
  // Hype
  { id: 'hyp1', text: 'יאללה!', emoji: '🔥', type: 'text' },
  { id: 'hyp2', text: 'מדהימים!', emoji: '🤩', type: 'text' },
  { id: 'hyp3', text: 'פגז!', emoji: '💥', type: 'text' },
  { id: 'hyp4', text: 'אלופים!', emoji: '🏆', type: 'text' },
  { id: 'hyp5', text: 'שיחקתם אותה!', emoji: '🎯', type: 'text' },
  // Positive reactions
  { id: 'pos1', text: 'יפה!', emoji: '👏', type: 'text' },
  { id: 'pos2', text: 'מצויינים!', emoji: '⭐', type: 'text' },
  { id: 'pos3', text: 'וואו!', emoji: '😮', type: 'text' },
  { id: 'pos4', text: 'GG', emoji: '🤝', type: 'text' },
  // Trendy / slang
  { id: 'trn1', text: 'נו באמת', emoji: '😏', type: 'text' },
  { id: 'trn2', text: 'שווה!', emoji: '🙌', type: 'text' },
  { id: 'trn3', text: 'סבבה', emoji: '👌', type: 'text' },
  { id: 'trn4', text: 'לגמרי!', emoji: '💯', type: 'text' },
  // Fun & competition
  { id: 'fun1', text: 'מי מעזים?', emoji: '💪', type: 'text' },
  { id: 'fun2', text: 'בהצלחה לכולם!', emoji: '🍀', type: 'text' },
  { id: 'fun3', text: 'בטוח!', emoji: '👍', type: 'text' },
  { id: 'fun4', text: 'אנחנו הכי טובים!', emoji: '😎', type: 'text' },
  // Game reactions
  { id: 'gam1', text: 'אוף', emoji: '😩', type: 'text' },
  { id: 'gam2', text: 'באו שוב!', emoji: '🔄', type: 'text' },
  { id: 'gam3', text: 'עוד סיבוב!', emoji: '🎲', type: 'text' },
  { id: 'gam4', text: 'קרוב!', emoji: '😬', type: 'text' },
  // Inspiration
  { id: 'ins1', text: 'אפשר הכל!', emoji: '✨', type: 'text' },
  { id: 'ins2', text: 'לא עוצרים!', emoji: '🚀', type: 'text' },
  { id: 'fun1', text: 'נא נה בננה', emoji: '🍌', type: 'text' },
  // Emoji-only reactions
  { id: 'emo1', text: '❤️', type: 'emoji' },
  { id: 'emo2', text: '👍', type: 'emoji' },
  { id: 'emo3', text: '🔥', type: 'emoji' },
  { id: 'emo4', text: '🚀', type: 'emoji' },
  { id: 'emo5', text: '💯', type: 'emoji' },
  { id: 'emo6', text: '😂', type: 'emoji' },
  { id: 'emo7', text: '🎉', type: 'emoji' },
  { id: 'emo8', text: '💪', type: 'emoji' },
  { id: 'emo9', text: '👏', type: 'emoji' },
  { id: 'emo10', text: '😍', type: 'emoji' },
];

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

  c4FirstTo: 1,
  c4TurnTimer: 15,

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

  chatEnabled: true,
  chatPhrases: [...DEFAULT_CHAT_PHRASES],

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
  connect4: {
    emoji: '🔴',
    labelKey: 'connect4',
    descriptionKey: 'connect4Description',
  },
};

/** Fixed display order for game selector (canonical order) */
export const GAME_DISPLAY_ORDER: QGameType[] = ['rps', 'oddoneout', 'tictactoe', 'connect4', 'memory'];

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
// Chat Messages & Bans (RTDB)
// =============================================================

/** Chat message stored in RTDB */
export interface QGamesChatMessage {
  id: string;                        // RTDB push key
  senderId: string;                  // visitorId
  senderNickname: string;
  senderAvatarType: QGamesAvatarType;
  senderAvatarValue: string;
  phraseId: string;                  // references QGamesChatPhrase.id
  text: string;                      // denormalized phrase text
  emoji?: string;                    // denormalized emoji
  color?: string;                    // bubble color
  phraseType: ChatPhraseType;        // 'text' or 'emoji'
  mentionId?: string;                // tagged player visitorId
  mentionNickname?: string;          // tagged player name
  sentAt: number;                    // timestamp
}

/** Chat ban entry in RTDB */
export interface QGamesChatBan {
  visitorId: string;
  bannedAt: number;
}

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
  c4State: (codeId: string, matchId: string) => `qgames/${codeId}/matches/${matchId}/c4`,
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
  chat: (codeId: string) => `qgames/${codeId}/chat`,
  chatMessage: (codeId: string, messageId: string) => `qgames/${codeId}/chat/${messageId}`,
  chatBans: (codeId: string) => `qgames/${codeId}/chatBans`,
  chatBan: (codeId: string, visitorId: string) => `qgames/${codeId}/chatBans/${visitorId}`,
};
