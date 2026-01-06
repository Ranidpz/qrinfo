// ============ Q.HUNT - Real-Time Code Hunting Game ============
// Competitive code scanning game with leaderboards and team support

// Game phases
export type QHuntPhase = 'registration' | 'countdown' | 'playing' | 'finished' | 'results';

// Game mode
export type QHuntMode = 'individual' | 'teams';

// Code type for type-based hunting (anti-cheat feature)
export type QHuntCodeType = 'blue' | 'red' | 'green' | 'yellow' | 'purple' | 'orange';

// Avatar type for players
export type QHuntAvatarType = 'emoji' | 'selfie';

// Scan method
export type QHuntScanMethod = 'qr' | 'manual';

// =============================================================
// Code Definition - What players hunt for
// =============================================================
export interface QHuntCode {
  id: string;
  codeValue: string;              // QR content or alphanumeric text
  codeType: QHuntCodeType;        // Color/type for type-based hunting
  points: number;                 // Points awarded for scanning
  label?: string;                 // Display name (e.g., "Station 1")
  isActive: boolean;
  createdAt: number;
}

// =============================================================
// Team Definition
// =============================================================
export interface QHuntTeam {
  id: string;
  name: string;
  color: string;                  // Hex color for team display
  emoji?: string;                 // Team emoji/icon
  order: number;
}

// =============================================================
// Player Registration
// =============================================================
export interface QHuntPlayer {
  id: string;                     // visitorId from localStorage
  name: string;                   // Player display name
  avatarType: QHuntAvatarType;
  avatarValue: string;            // Emoji or selfie URL
  teamId?: string;                // Team ID if mode is 'teams'
  registeredAt: number;
  // Game state
  assignedCodeType?: QHuntCodeType; // Type player must find (anti-cheat)
  gameStartedAt?: number;         // When this player clicked "Start"
  gameEndedAt?: number;           // When player finished (all codes or time up)
  currentScore: number;
  scansCount: number;
  isFinished: boolean;
}

// =============================================================
// Scan Record - Each code scan
// =============================================================
export interface QHuntScan {
  id: string;
  playerId: string;
  codeId: string;
  codeValue: string;
  points: number;
  isValid: boolean;               // True if correct type
  scanMethod: QHuntScanMethod;
  scannedAt: number;
  scanDuration?: number;          // Milliseconds from previous scan
}

// =============================================================
// Session Statistics
// =============================================================
export interface QHuntStats {
  totalPlayers: number;
  playersPlaying: number;
  playersFinished: number;
  totalScans: number;
  avgScore: number;
  topScore: number;
  lastUpdated: number;
}

// =============================================================
// Branding Configuration
// =============================================================
export interface QHuntBranding {
  gameTitle?: string;
  gameTitleEn?: string;
  backgroundImage?: string;
  backgroundColor: string;
  primaryColor: string;           // Interface accent color (electric cyan)
  secondaryColor: string;         // Alerts/highlights (hot pink)
  successColor: string;           // Successful scans (neon green)
  warningColor: string;           // Wrong type alerts (amber)
  eventLogo?: string;
}

// =============================================================
// Sound Configuration
// =============================================================
export interface QHuntSoundConfig {
  enabled: boolean;
  scanSuccess: boolean;           // Play on successful scan
  scanError: boolean;             // Play on wrong type
  gameComplete: boolean;          // Play when player finishes
  milestone: boolean;             // Play every N codes (e.g., every 5)
  milestoneInterval: number;      // How many codes between milestone sounds
}

// =============================================================
// Main QHunt Configuration (stored in MediaItem.qhuntConfig)
// =============================================================
export interface QHuntConfig {
  // Phase control
  currentPhase: QHuntPhase;

  // Game settings
  mode: QHuntMode;
  gameDurationSeconds: number;    // 0 = unlimited, or specific (e.g., 600 = 10 min)
  targetCodeCount: number;        // How many codes to find (e.g., 10)
  countdownSeconds: number;       // Pre-game countdown (default 3)

  // Type-based hunting (anti-cheat)
  enableTypeBasedHunting: boolean;
  availableCodeTypes: QHuntCodeType[];

  // Manual code entry
  enableManualEntry: boolean;

  // Teams
  teams: QHuntTeam[];

  // Codes to hunt
  codes: QHuntCode[];

  // Branding
  branding: QHuntBranding;

  // Sound
  sound: QHuntSoundConfig;

  // Points
  defaultPointsPerCode: number;
  bonusForFirst: number;          // Extra points for first finder
  timeBonus: boolean;             // Award bonus for faster completion

  // Avatar settings
  emojiPalette: string[];
  allowSelfie: boolean;

  // Language
  language: 'he' | 'en' | 'auto';

  // Display settings
  showLeaderboardToPlayers: boolean;  // If false, players only see personal score

  // Sound settings (simplified)
  enableSound: boolean;

  // Game rules
  allowSameCodeMultipleTimes: boolean;  // Can player scan same code twice
  requireAllCodesToFinish: boolean;     // Must find all codes to finish
  minCodesToFinish: number;             // Minimum codes to enable "finish" button

  // Stats (denormalized)
  stats: QHuntStats;

  // Session tracking
  gameStartedAt?: number;
  gameEndedAt?: number;
  lastResetAt?: number;
}

// =============================================================
// Live Data for Firebase Realtime Database
// Path: /qhunt/{codeId}
// =============================================================
export interface QHuntLiveData {
  status: QHuntPhase;
  countdownStartedAt?: number;
  gameStartedAt?: number;

  // Pre-calculated aggregates
  stats: QHuntStats;

  // Leaderboard (top players, updated frequently)
  leaderboard: Record<string, QHuntLeaderboardEntry>;

  // Team scores (if team mode)
  teamScores?: Record<string, QHuntTeamScore>;

  // Recent scans for live feed
  recentScans: Record<string, QHuntRecentScan>;

  lastUpdated: number;
}

// =============================================================
// Leaderboard Entry
// =============================================================
export interface QHuntLeaderboardEntry {
  playerId: string;
  playerName: string;
  avatarType: QHuntAvatarType;
  avatarValue: string;
  teamId?: string;
  teamColor?: string;
  score: number;
  scansCount: number;
  gameTime?: number;              // Total game time in ms (if finished)
  isFinished: boolean;
  rank: number;
}

// =============================================================
// Team Score
// =============================================================
export interface QHuntTeamScore {
  teamId: string;
  teamName: string;
  teamColor: string;
  score: number;
  players: number;
  rank: number;
}

// =============================================================
// Recent Scan (for live feed on display)
// =============================================================
export interface QHuntRecentScan {
  id: string;
  playerId: string;
  playerName: string;
  avatarValue: string;
  codeLabel?: string;
  points: number;
  scannedAt: number;
}

// =============================================================
// API Submission Types
// =============================================================

// Scan submission
export interface QHuntScanSubmission {
  codeId: string;
  playerId: string;
  codeValue: string;              // Scanned value or manual entry
  scanMethod: QHuntScanMethod;
}

// Scan result
export interface QHuntScanResult {
  success: boolean;
  error?: string;
  scan?: QHuntScan;
  message?: string;               // e.g., "Look for BLUE codes!"
  newScore?: number;
  isGameComplete?: boolean;
  correctType?: QHuntCodeType;    // Show what type they should find
}

// Player registration
export interface QHuntPlayerRegistration {
  codeId: string;
  name: string;
  avatarType: QHuntAvatarType;
  avatarValue: string;
  teamId?: string;
}

// Registration result
export interface QHuntRegistrationResult {
  success: boolean;
  player?: QHuntPlayer;
  assignedCodeType?: QHuntCodeType;
  error?: string;
}

// =============================================================
// Default Configuration
// =============================================================
export const DEFAULT_QHUNT_EMOJI_PALETTE = [
  '🏃', '🎯', '⭐', '🔥', '💪', '🚀',
  '🎮', '🏆', '👑', '💎', '🌟', '⚡',
  '🦊', '🐺', '🦁', '🐯', '🦅', '🐉'
];

export const DEFAULT_QHUNT_CONFIG: QHuntConfig = {
  currentPhase: 'registration',
  mode: 'individual',
  gameDurationSeconds: 600,       // 10 minutes
  targetCodeCount: 10,
  countdownSeconds: 3,
  enableTypeBasedHunting: true,
  availableCodeTypes: ['blue', 'red', 'green', 'yellow'],
  enableManualEntry: true,
  teams: [],
  codes: [],
  branding: {
    backgroundColor: '#0a0f1a',
    primaryColor: '#00d4ff',
    secondaryColor: '#ff00aa',
    successColor: '#00ff88',
    warningColor: '#ffaa00',
  },
  sound: {
    enabled: true,
    scanSuccess: true,
    scanError: true,
    gameComplete: true,
    milestone: true,
    milestoneInterval: 5,
  },
  defaultPointsPerCode: 100,
  bonusForFirst: 50,
  timeBonus: true,
  emojiPalette: DEFAULT_QHUNT_EMOJI_PALETTE,
  allowSelfie: true,
  language: 'auto',
  showLeaderboardToPlayers: false,
  enableSound: true,
  allowSameCodeMultipleTimes: false,
  requireAllCodesToFinish: false,
  minCodesToFinish: 0,
  stats: {
    totalPlayers: 0,
    playersPlaying: 0,
    playersFinished: 0,
    totalScans: 0,
    avgScore: 0,
    topScore: 0,
    lastUpdated: Date.now(),
  },
};

// =============================================================
// Code Type Configuration (Neon colors for each type)
// =============================================================
export const CODE_TYPE_CONFIG: Record<QHuntCodeType, {
  color: string;
  bgColor: string;
  glowColor: string;
  name: string;
  nameEn: string;
  emoji: string;
  labelHe: string;
  labelEn: string;
}> = {
  blue: {
    color: '#00d4ff',
    bgColor: '#00d4ff20',
    glowColor: '#00d4ff60',
    name: 'כחול',
    nameEn: 'Blue',
    emoji: '🔵',
    labelHe: 'כחול',
    labelEn: 'Blue',
  },
  red: {
    color: '#ff3355',
    bgColor: '#ff335520',
    glowColor: '#ff335560',
    name: 'אדום',
    nameEn: 'Red',
    emoji: '🔴',
    labelHe: 'אדום',
    labelEn: 'Red',
  },
  green: {
    color: '#00ff88',
    bgColor: '#00ff8820',
    glowColor: '#00ff8860',
    name: 'ירוק',
    nameEn: 'Green',
    emoji: '🟢',
    labelHe: 'ירוק',
    labelEn: 'Green',
  },
  yellow: {
    color: '#ffdd00',
    bgColor: '#ffdd0020',
    glowColor: '#ffdd0060',
    name: 'צהוב',
    nameEn: 'Yellow',
    emoji: '🟡',
    labelHe: 'צהוב',
    labelEn: 'Yellow',
  },
  purple: {
    color: '#aa55ff',
    bgColor: '#aa55ff20',
    glowColor: '#aa55ff60',
    name: 'סגול',
    nameEn: 'Purple',
    emoji: '🟣',
    labelHe: 'סגול',
    labelEn: 'Purple',
  },
  orange: {
    color: '#ff8800',
    bgColor: '#ff880020',
    glowColor: '#ff880060',
    name: 'כתום',
    nameEn: 'Orange',
    emoji: '🟠',
    labelHe: 'כתום',
    labelEn: 'Orange',
  },
};

// =============================================================
// Translations
// =============================================================
export const QHUNT_TRANSLATIONS = {
  he: {
    // General
    gameTitle: 'ציד קודים',
    joinGame: 'הצטרפו למשחק',
    startHunting: 'התחילו לצוד!',
    waitingForGame: 'ממתינים לתחילת המשחק',
    gameInProgress: 'משחק מתנהל',
    gameEnded: 'המשחק הסתיים',

    // Registration
    enterName: 'הכניסו שם',
    chooseAvatar: 'בחרו אווטאר',
    chooseTeam: 'בחרו קבוצה',
    takeSelfie: 'צלמו סלפי',

    // Gameplay
    scanCode: 'סרקו קוד',
    enterCode: 'הכניסו קוד ידנית',
    codesFound: 'קודים שנמצאו',
    timeRemaining: 'זמן נותר',
    yourScore: 'הנקודות שלך',
    yourMission: 'המשימה שלך',
    findCodes: 'מצאו קודים',

    // Feedback
    correctCode: 'מצוין!',
    wrongType: 'סוג קוד שגוי!',
    lookFor: 'חפשו קודים',
    alreadyScanned: 'הקוד הזה כבר נסרק',
    codeNotFound: 'קוד לא נמצא',
    gameComplete: 'סיימתם!',
    timeUp: 'הזמן נגמר!',

    // Leaderboard
    leaderboard: 'טבלת מובילים',
    teamScores: 'תוצאות קבוצות',
    rank: 'דירוג',
    totalTime: 'זמן כולל',
    players: 'שחקנים',
    activePlayers: 'משחקים',
    finished: 'סיימו',

    // Phases
    registration: 'הרשמה',
    countdown: 'ספירה לאחור',
    playing: 'משחק פעיל',
    results: 'תוצאות',
  },
  en: {
    // General
    gameTitle: 'Code Hunt',
    joinGame: 'Join Game',
    startHunting: 'Start Hunting!',
    waitingForGame: 'Waiting for game to start',
    gameInProgress: 'Game in progress',
    gameEnded: 'Game ended',

    // Registration
    enterName: 'Enter your name',
    chooseAvatar: 'Choose avatar',
    chooseTeam: 'Choose team',
    takeSelfie: 'Take selfie',

    // Gameplay
    scanCode: 'Scan Code',
    enterCode: 'Enter code manually',
    codesFound: 'Codes Found',
    timeRemaining: 'Time Remaining',
    yourScore: 'Your Score',
    yourMission: 'Your Mission',
    findCodes: 'Find codes',

    // Feedback
    correctCode: 'Great!',
    wrongType: 'Wrong code type!',
    lookFor: 'Look for',
    alreadyScanned: 'Code already scanned',
    codeNotFound: 'Code not found',
    gameComplete: 'Complete!',
    timeUp: 'Time\'s up!',

    // Leaderboard
    leaderboard: 'Leaderboard',
    teamScores: 'Team Scores',
    rank: 'Rank',
    totalTime: 'Total Time',
    players: 'Players',
    activePlayers: 'Playing',
    finished: 'Finished',

    // Phases
    registration: 'Registration',
    countdown: 'Countdown',
    playing: 'Playing',
    results: 'Results',
  },
};

// =============================================================
// Helper function to get translation
// =============================================================
export function getQHuntTranslation(
  key: keyof typeof QHUNT_TRANSLATIONS.he,
  language: 'he' | 'en' | 'auto',
  browserLanguage?: string
): string {
  const lang = language === 'auto'
    ? (browserLanguage?.startsWith('he') ? 'he' : 'en')
    : language;
  return QHUNT_TRANSLATIONS[lang][key] || QHUNT_TRANSLATIONS.en[key];
}

// =============================================================
// Helper function to format time
// =============================================================
export function formatGameTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// =============================================================
// Helper function to format milliseconds to readable time
// =============================================================
export function formatGameDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}
