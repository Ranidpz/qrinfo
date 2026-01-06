// ============ Q.TREASURE - Treasure Hunt Game ============
// Sequential treasure hunt with stations, hints, and time tracking

// Game phases
export type QTreasurePhase = 'registration' | 'playing' | 'completed';

// Avatar type for players
export type QTreasureAvatarType = 'emoji' | 'selfie';

// =============================================================
// Station Definition - Each treasure hunt checkpoint
// =============================================================
export interface QTreasureStation {
  id: string;
  order: number;                    // Sequential order (1, 2, 3...)

  // Station QR linking
  stationShortId?: string;          // Short ID of station QR for direct scanning

  // Station content
  title: string;
  titleEn?: string;
  content?: string;                 // Text/instructions at this station
  contentEn?: string;
  videoUrl?: string;                // Optional YouTube video to show at station
  imageUrls?: string[];             // Optional images at station

  // Hint to next station
  hintText?: string;                // Text hint for next location
  hintTextEn?: string;
  hintImageUrl?: string;            // Image showing next location

  // XP/Points
  xpReward: number;                 // XP earned for reaching this station

  // Status
  isActive: boolean;
  createdAt: number;
}

// =============================================================
// Player Registration & Progress
// =============================================================
export interface QTreasurePlayer {
  id: string;                       // visitorId from localStorage
  nickname: string;
  avatarType: QTreasureAvatarType;
  avatarValue: string;              // Emoji or selfie URL
  consent: boolean;                 // Consent to show on leaderboard
  registeredAt: number;

  // Game progress
  currentStationIndex: number;      // Which station they're on (0-indexed)
  completedStations: string[];      // Array of completed station IDs
  stationTimes: Record<string, number>; // Station ID -> time in ms
  totalXP: number;
  startedAt?: number;               // When player started the hunt
  completedAt?: number;             // When player finished all stations
  totalTimeMs?: number;             // Total completion time

  // Out-of-order tracking
  outOfOrderScans: number;          // Count of out-of-order scans
}

// =============================================================
// Station Scan Record
// =============================================================
export interface QTreasureScan {
  id: string;
  playerId: string;
  stationId: string;
  stationOrder: number;
  isInOrder: boolean;               // Was this scanned in correct order?
  xpEarned: number;
  scannedAt: number;
  timeFromPrevious?: number;        // Milliseconds since previous station
}

// =============================================================
// Timer Configuration
// =============================================================
export interface QTreasureTimerConfig {
  enabled: boolean;
  showToPlayer: boolean;            // Show timer on player's screen
  maxTimeSeconds: number;           // Time limit in seconds (0 = unlimited)
}

// =============================================================
// Registration Configuration
// =============================================================
export interface QTreasureRegistrationConfig {
  requireConsent: boolean;          // Photo consent for leaderboard
  emojiPalette: string[];
  allowSelfie: boolean;
}

// =============================================================
// Completion Screen Configuration
// =============================================================
export interface QTreasureCompletionConfig {
  customMessage?: string;
  customMessageEn?: string;
  showTotalTime: boolean;
  showStationTimes: boolean;
  showLeaderboard: boolean;
  showConfetti: boolean;
}

// =============================================================
// Branding Configuration
// =============================================================
export interface QTreasureBranding {
  gameTitle?: string;
  gameTitleEn?: string;
  backgroundImage?: string;
  backgroundColor: string;
  primaryColor: string;
  accentColor: string;
  successColor: string;
  warningColor: string;             // For out-of-order warnings
  eventLogo?: string;
}

// =============================================================
// Statistics
// =============================================================
export interface QTreasureStats {
  totalPlayers: number;
  playersPlaying: number;
  playersCompleted: number;
  avgCompletionTimeMs: number;
  fastestTimeMs: number;
  lastUpdated: number;
}

// =============================================================
// Main QTreasure Configuration (stored in MediaItem.qtreasureConfig)
// =============================================================
export interface QTreasureConfig {
  // Phase control
  currentPhase: QTreasurePhase;

  // Stations
  stations: QTreasureStation[];

  // Timer
  timer: QTreasureTimerConfig;

  // Registration
  registration: QTreasureRegistrationConfig;

  // XP Integration
  xpPerStation: number;             // Default XP per station
  completionBonusXP: number;        // Bonus for completing all stations
  routeId?: string;                 // Link to folder/route for XP system

  // Out-of-order handling
  allowOutOfOrder: boolean;         // Allow scanning in any order
  outOfOrderWarning: string;        // Warning message (Hebrew)
  outOfOrderWarningEn: string;      // Warning message (English)

  // Completion
  completion: QTreasureCompletionConfig;

  // Branding
  branding: QTreasureBranding;

  // Language
  language: 'he' | 'en' | 'auto';

  // Stats (denormalized)
  stats: QTreasureStats;

  // Session tracking
  gameStartedAt?: number;
  lastResetAt?: number;
}

// =============================================================
// Live Data for Firebase Realtime Database
// Path: /qtreasure/{codeId}
// =============================================================
export interface QTreasureLiveData {
  status: QTreasurePhase;
  stats: QTreasureStats;

  // Leaderboard (by completion time)
  leaderboard: Record<string, QTreasureLeaderboardEntry>;

  // Recent completions for live feed
  recentCompletions: Record<string, QTreasureRecentCompletion>;

  lastUpdated: number;
}

// =============================================================
// Leaderboard Entry (sorted by completion time)
// =============================================================
export interface QTreasureLeaderboardEntry {
  playerId: string;
  playerName: string;
  avatarType: QTreasureAvatarType;
  avatarValue: string;
  completionTimeMs: number;
  stationsCompleted: number;
  totalXP: number;
  completedAt: number;
  rank: number;
}

// =============================================================
// Recent Completion (for display)
// =============================================================
export interface QTreasureRecentCompletion {
  id: string;
  playerId: string;
  playerName: string;
  avatarType: QTreasureAvatarType;
  avatarValue: string;
  completionTimeMs: number;
  completedAt: number;
}

// =============================================================
// API Types
// =============================================================

export interface QTreasureScanSubmission {
  masterCodeId: string;             // Master QR code ID
  stationShortId: string;           // Station QR short ID
  playerId: string;
}

export interface QTreasureScanResult {
  success: boolean;
  error?: string;

  // Success data
  station?: QTreasureStation;
  xpEarned?: number;
  isInOrder?: boolean;
  isComplete?: boolean;             // Player finished all stations
  nextStation?: QTreasureStation;   // Next station to find

  // Out-of-order warning
  outOfOrderMessage?: string;
  expectedStationOrder?: number;

  // Time tracking
  timeFromPrevious?: number;
  totalTimeMs?: number;
}

export interface QTreasurePlayerRegistration {
  codeId: string;
  nickname: string;
  avatarType: QTreasureAvatarType;
  avatarValue: string;
  consent: boolean;
}

export interface QTreasureRegistrationResult {
  success: boolean;
  player?: QTreasurePlayer;
  firstStation?: QTreasureStation;
  error?: string;
}

// =============================================================
// Default Configuration
// =============================================================
export const DEFAULT_QTREASURE_EMOJI_PALETTE = [
  '🏃', '🎯', '⭐', '🔥', '💪', '🚀',
  '🗺️', '🧭', '🏆', '💎', '🌟', '⚡',
  '🦊', '🐺', '🦁', '🐯', '🦅', '🐉'
];

export const DEFAULT_QTREASURE_CONFIG: QTreasureConfig = {
  currentPhase: 'registration',
  stations: [],
  timer: {
    enabled: true,
    showToPlayer: true,
    maxTimeSeconds: 0,              // Unlimited
  },
  registration: {
    requireConsent: true,
    emojiPalette: DEFAULT_QTREASURE_EMOJI_PALETTE,
    allowSelfie: true,
  },
  xpPerStation: 10,
  completionBonusXP: 50,
  allowOutOfOrder: true,
  outOfOrderWarning: 'זו לא התחנה הבאה! חפשו את התחנה הנכונה.',
  outOfOrderWarningEn: 'This is not the next station! Look for the correct one.',
  completion: {
    showTotalTime: true,
    showStationTimes: true,
    showLeaderboard: true,
    showConfetti: true,
  },
  branding: {
    backgroundColor: '#0a0f1a',
    primaryColor: '#00d4ff',
    accentColor: '#ff00aa',
    successColor: '#00ff88',
    warningColor: '#ffaa00',
  },
  language: 'auto',
  stats: {
    totalPlayers: 0,
    playersPlaying: 0,
    playersCompleted: 0,
    avgCompletionTimeMs: 0,
    fastestTimeMs: 0,
    lastUpdated: Date.now(),
  },
};

// =============================================================
// Translations
// =============================================================
export const QTREASURE_TRANSLATIONS = {
  he: {
    // General
    gameTitle: 'ציד אוצרות',
    startHunt: 'התחילו את הציד!',
    scanNextStation: 'סרקו את התחנה הבאה',
    station: 'תחנה',
    stationOf: 'מתוך',
    nextHint: 'רמז לתחנה הבאה',
    outOfOrder: 'לא בסדר הנכון!',
    congratulations: 'כל הכבוד!',
    completed: 'סיימתם את הציד!',
    totalTime: 'זמן כולל',
    yourRank: 'הדירוג שלכם',
    leaderboard: 'טבלת מובילים',

    // Registration
    registration: 'הרשמה',
    enterNickname: 'הכניסו כינוי',
    chooseAvatar: 'בחרו אווטאר',
    takeSelfie: 'צלמו סלפי',
    consent: 'אני מסכים/ה להצגת התמונה בטבלת המובילים',

    // Timer
    timeRemaining: 'זמן נותר',
    timeElapsed: 'זמן שעבר',
    timesUp: 'הזמן נגמר!',

    // Station
    currentStation: 'תחנה נוכחית',
    stationsCompleted: 'תחנות שהושלמו',
    scanToVerify: 'סרקו את הקוד כדי לאמת',

    // Errors
    stationNotFound: 'התחנה לא נמצאה',
    alreadyCompleted: 'כבר השלמתם תחנה זו',
    notRegistered: 'עליכם להירשם קודם',
    gameNotActive: 'המשחק לא פעיל',
  },
  en: {
    // General
    gameTitle: 'Treasure Hunt',
    startHunt: 'Start the Hunt!',
    scanNextStation: 'Scan the next station',
    station: 'Station',
    stationOf: 'of',
    nextHint: 'Hint for next station',
    outOfOrder: 'Wrong order!',
    congratulations: 'Congratulations!',
    completed: 'Hunt complete!',
    totalTime: 'Total time',
    yourRank: 'Your rank',
    leaderboard: 'Leaderboard',

    // Registration
    registration: 'Registration',
    enterNickname: 'Enter nickname',
    chooseAvatar: 'Choose avatar',
    takeSelfie: 'Take selfie',
    consent: 'I agree to show my photo on the leaderboard',

    // Timer
    timeRemaining: 'Time remaining',
    timeElapsed: 'Time elapsed',
    timesUp: 'Time\'s up!',

    // Station
    currentStation: 'Current station',
    stationsCompleted: 'Stations completed',
    scanToVerify: 'Scan the code to verify',

    // Errors
    stationNotFound: 'Station not found',
    alreadyCompleted: 'You already completed this station',
    notRegistered: 'You must register first',
    gameNotActive: 'Game is not active',
  },
};

// =============================================================
// Helper function to get translation
// =============================================================
export function getQTreasureTranslation(
  key: keyof typeof QTREASURE_TRANSLATIONS.he,
  language: 'he' | 'en' | 'auto',
  browserLanguage?: string
): string {
  const lang = language === 'auto'
    ? (browserLanguage?.startsWith('he') ? 'he' : 'en')
    : language;
  return QTREASURE_TRANSLATIONS[lang][key] || QTREASURE_TRANSLATIONS.en[key];
}

// =============================================================
// Helper function to format time (mm:ss)
// =============================================================
export function formatTreasureTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// =============================================================
// Helper function to format milliseconds to readable time
// =============================================================
export function formatTreasureDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

// =============================================================
// Helper to create a new station
// =============================================================
export function createNewStation(order: number): QTreasureStation {
  return {
    id: `station_${Date.now()}_${order}`,
    order,
    title: `תחנה ${order}`,
    titleEn: `Station ${order}`,
    content: '',
    xpReward: 10,
    isActive: true,
    createdAt: Date.now(),
  };
}

// =============================================================
// Helper to calculate leaderboard rank
// =============================================================
export function calculateRank(
  entries: QTreasureLeaderboardEntry[]
): QTreasureLeaderboardEntry[] {
  return [...entries]
    .sort((a, b) => a.completionTimeMs - b.completionTimeMs)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}
