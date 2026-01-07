// ============ Q.CHALLENGE - Trivia Quiz Game ============
// Competitive trivia quiz with real-time leaderboards for organizations

// =============================================================
// Scoring Modes - Admin Choice
// =============================================================
export type QChallengeScoringMode =
  | 'time_and_streak'  // Full: speed + consecutive correct bonus
  | 'time_only'        // Speed bonus only (faster = more points)
  | 'streak_only'      // Consecutive correct bonus only
  | 'simple';          // Fixed points per correct answer

// Game phases
export type QChallengePhase = 'registration' | 'countdown' | 'playing' | 'finished' | 'results';

// Game mode
export type QChallengeMode = 'async' | 'live';

// Avatar type for players
export type QChallengeAvatarType = 'emoji' | 'selfie';

// =============================================================
// Question & Answer Structures
// =============================================================
export interface QChallengeAnswer {
  id: string;
  text: string;
  textEn?: string;
  isCorrect: boolean;
  order: number;
}

export interface QChallengeQuestion {
  id: string;
  text: string;
  textEn?: string;
  imageUrl?: string;                // Optional image for question
  youtubeUrl?: string;              // Optional YouTube video (Phase 2)
  answers: QChallengeAnswer[];      // 2-6 answers
  timeLimitSeconds: number;         // Per-question time limit (10-120)
  points: number;                   // Base points for this question (default: 100)
  order: number;
  isActive: boolean;
  createdAt: number;
}

// =============================================================
// Branch/Group Configuration (Phase 2)
// =============================================================
export interface QChallengeBranch {
  id: string;
  name: string;
  nameEn?: string;
  urlSlug: string;                  // Unique slug for URL: /v/{shortId}?branch={urlSlug}
  color: string;                    // Branch color for display
  emoji?: string;                   // Optional emoji
  isActive: boolean;
  order: number;
  createdAt: number;
}

// =============================================================
// Scoring Configuration
// =============================================================
export interface QChallengeScoringConfig {
  mode: QChallengeScoringMode;
  basePoints: number;               // Default: 100
  timeBonusMax: number;             // Max time bonus points (default: 50)
  streakMultipliers: number[];      // [1, 1.2, 1.5, 2, 2.5, 3] for streaks 1-6+
}

// Default scoring configuration
export const DEFAULT_SCORING_CONFIG: QChallengeScoringConfig = {
  mode: 'time_and_streak',
  basePoints: 100,
  timeBonusMax: 50,
  streakMultipliers: [1, 1.2, 1.5, 2, 2.5, 3],
};

// Streak multiplier lookup
export const STREAK_MULTIPLIERS: Record<number, number> = {
  1: 1.0,
  2: 1.2,
  3: 1.5,
  4: 2.0,
  5: 2.5,
  6: 3.0,  // Max streak (6+ all get 3x)
};

// =============================================================
// Player Document
// Firestore: codes/{codeId}/qchallenge_players/{visitorId}
// =============================================================
export interface QChallengePlayer {
  id: string;                       // visitorId from localStorage
  codeId: string;
  branchId?: string;                // Which branch this player belongs to

  // Registration data
  nickname: string;
  avatarType: QChallengeAvatarType;
  avatarValue: string;              // Emoji or selfie URL
  phone?: string;                   // If verification enabled (normalized)
  consent: boolean;

  // Game state
  status: 'registered' | 'playing' | 'finished';
  currentQuestionIndex: number;

  // Answer tracking
  answers: QChallengePlayerAnswer[];

  // Scoring
  currentScore: number;
  currentStreak: number;
  maxStreak: number;
  correctAnswers: number;
  wrongAnswers: number;

  // Timing
  registeredAt: number;
  startedAt?: number;
  finishedAt?: number;
  totalTimeMs: number;

  // Duplicate prevention
  hasCompleted: boolean;            // True after completion
  playCount: number;                // How many times played
}

// Individual answer record
export interface QChallengePlayerAnswer {
  questionId: string;
  questionIndex: number;
  answerId: string;
  isCorrect: boolean;
  responseTimeMs: number;           // Time taken to answer
  basePoints: number;
  timeBonus: number;
  streakMultiplier: number;
  totalPoints: number;              // Points for this answer (with bonuses)
  streakAtAnswer: number;           // Streak count when answered
  answeredAt: number;
}

// =============================================================
// Session Statistics
// =============================================================
export interface QChallengeStats {
  totalPlayers: number;
  playersPlaying: number;
  playersFinished: number;
  totalAnswers: number;
  avgScore: number;
  topScore: number;
  avgAccuracy: number;              // percentage
  avgTimeMs: number;
  lastUpdated: number;
}

// =============================================================
// Branding Configuration
// =============================================================
export interface QChallengeBranding {
  quizTitle?: string;
  quizTitleEn?: string;
  quizDescription?: string;
  quizDescriptionEn?: string;
  backgroundImage?: string;
  backgroundColor: string;
  primaryColor: string;             // Interface accent color
  secondaryColor: string;           // Highlights
  successColor: string;             // Correct answers
  errorColor: string;               // Wrong answers
  eventLogo?: string;
}

// =============================================================
// Live Mode Configuration (Phase 2)
// =============================================================
export interface QChallengeLiveModeConfig {
  countdownSeconds: number;         // Pre-game countdown (default: 3)
  questionRevealDelay: number;      // Delay before revealing next question (ms)
  showAnswerDuration: number;       // How long to show correct answer (ms)
  autoAdvance: boolean;             // Automatically advance to next question
}

// =============================================================
// Verification Configuration (Phase 2)
// =============================================================
export interface QChallengeVerificationConfig {
  enabled: boolean;
  method: 'whatsapp' | 'sms' | 'both';
  allowMultiplePlays: boolean;      // If verified, can same phone play again?
}

// =============================================================
// Main QChallenge Configuration (stored in MediaItem.qchallengeConfig)
// =============================================================
export interface QChallengeConfig {
  // Phase control
  currentPhase: QChallengePhase;
  mode: QChallengeMode;

  // Questions
  questions: QChallengeQuestion[];
  defaultTimeLimitSeconds: number;  // Default timer per question (30)
  shuffleQuestions: boolean;        // Randomize question order per player
  shuffleAnswers: boolean;          // Randomize answer order per question

  // Branches/Groups (Phase 2)
  branches: QChallengeBranch[];
  branchesEnabled: boolean;
  defaultBranchId?: string;         // If no branch in URL, use this one

  // Scoring
  scoring: QChallengeScoringConfig;

  // Registration
  requireName: boolean;

  // Verification (Phase 2)
  verification?: QChallengeVerificationConfig;

  // Live mode settings (Phase 2)
  liveMode: QChallengeLiveModeConfig;

  // Branding
  branding: QChallengeBranding;

  // Avatar settings
  emojiPalette: string[];
  allowSelfie: boolean;

  // Language
  language: 'he' | 'en' | 'auto';

  // Sound
  enableSound: boolean;

  // Results display
  showLeaderboard: boolean;
  showBranchLeaderboard: boolean;
  showCorrectAnswers: boolean;      // Reveal correct answers after each question
  maxLeaderboardEntries: number;    // Top N players to show

  // Stats (denormalized)
  stats: QChallengeStats;

  // Session tracking
  gameStartedAt?: number;
  gameEndedAt?: number;
  lastResetAt?: number;
}

// =============================================================
// Live Data for Firebase Realtime Database
// Path: /qchallenge/{codeId}
// =============================================================
export interface QChallengeLiveData {
  status: QChallengePhase;
  gameStartedAt?: number;

  // Live mode state (Phase 2)
  liveState?: {
    currentQuestionIndex: number;
    questionStartedAt: number;
    questionEndsAt: number;
    isAcceptingAnswers: boolean;
    showingResults: boolean;
  };

  // Pre-calculated aggregates
  stats: QChallengeStats;

  // Leaderboard (indexed by visitorId)
  leaderboard: Record<string, QChallengeLeaderboardEntry>;

  // Branch leaderboards (Phase 2)
  branchLeaderboards?: Record<string, Record<string, QChallengeLeaderboardEntry>>;

  // Branch stats (Phase 2)
  branchStats?: Record<string, {
    players: number;
    avgScore: number;
    topScore: number;
  }>;

  // Recent completions for live feed
  recentCompletions?: Record<string, QChallengeRecentCompletion>;

  lastUpdated: number;
}

// =============================================================
// Leaderboard Entry
// =============================================================
export interface QChallengeLeaderboardEntry {
  visitorId: string;
  nickname: string;
  avatarType: QChallengeAvatarType;
  avatarValue: string;
  branchId?: string;
  branchName?: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  accuracy: number;                 // percentage
  maxStreak: number;
  totalTimeMs: number;
  isFinished: boolean;
  finishedAt?: number;
  rank: number;
}

// =============================================================
// Recent Completion (for live feed)
// =============================================================
export interface QChallengeRecentCompletion {
  id: string;
  visitorId: string;
  nickname: string;
  avatarValue: string;
  score: number;
  rank: number;
  accuracy: number;
  finishedAt: number;
}

// =============================================================
// Duplicate Prevention Document
// Firestore: qchallenge_played/{codeId}_{identifier}
// =============================================================
export interface QChallengePlayedRecord {
  id: string;                       // codeId_identifier
  codeId: string;
  visitorId: string;
  phone?: string;                   // If verification was used
  branchId?: string;
  firstPlayedAt: number;
  lastPlayedAt: number;
  playCount: number;
  bestScore: number;
  bestRank: number;
}

// =============================================================
// API Request/Response Types
// =============================================================

// Registration
export interface QChallengeRegisterRequest {
  codeId: string;
  playerId: string;                 // visitorId from localStorage
  nickname: string;
  avatarType: QChallengeAvatarType;
  avatarValue: string;
  branchId?: string;
  consent: boolean;
  phone?: string;
  sessionToken?: string;            // If phone verification required
}

export interface QChallengeRegisterResponse {
  success: boolean;
  player?: QChallengePlayer;
  questions?: QChallengeQuestion[]; // Questions with correctness removed
  error?: string;
  errorCode?: 'ALREADY_PLAYED' | 'GAME_NOT_OPEN' | 'NICKNAME_INVALID' |
              'VERIFICATION_REQUIRED' | 'INVALID_BRANCH';
}

// Answer submission
export interface QChallengeAnswerRequest {
  codeId: string;
  playerId: string;
  questionId: string;
  questionIndex: number;
  answerId: string;
  responseTimeMs: number;
}

export interface QChallengeAnswerResponse {
  success: boolean;
  isCorrect: boolean;
  correctAnswerId: string;
  basePoints: number;
  timeBonus: number;
  streakMultiplier: number;
  totalPoints: number;
  newTotalScore: number;
  newStreak: number;
  isGameComplete: boolean;
  rank?: number;
  error?: string;
  errorCode?: 'ALREADY_ANSWERED' | 'QUESTION_NOT_FOUND' | 'TIME_EXPIRED' |
              'GAME_NOT_ACTIVE' | 'PLAYER_NOT_FOUND';
}

// =============================================================
// Default Configuration
// =============================================================
export const DEFAULT_QCHALLENGE_EMOJI_PALETTE = [
  '🧠', '🎯', '⭐', '🔥', '💪', '🚀',
  '🏆', '👑', '💎', '🌟', '⚡', '🎮',
  '🦊', '🐺', '🦁', '🐯', '🦅', '🐉'
];

export const DEFAULT_QCHALLENGE_CONFIG: QChallengeConfig = {
  currentPhase: 'registration',
  mode: 'async',
  questions: [],
  defaultTimeLimitSeconds: 30,
  shuffleQuestions: false,
  shuffleAnswers: true,
  branches: [],
  branchesEnabled: false,
  scoring: DEFAULT_SCORING_CONFIG,
  requireName: true,
  liveMode: {
    countdownSeconds: 3,
    questionRevealDelay: 500,
    showAnswerDuration: 3000,
    autoAdvance: true,
  },
  branding: {
    backgroundColor: '#0a0f1a',
    primaryColor: '#3b82f6',
    secondaryColor: '#8b5cf6',
    successColor: '#22c55e',
    errorColor: '#ef4444',
  },
  emojiPalette: DEFAULT_QCHALLENGE_EMOJI_PALETTE,
  allowSelfie: true,
  language: 'auto',
  enableSound: true,
  showLeaderboard: true,
  showBranchLeaderboard: true,
  showCorrectAnswers: true,
  maxLeaderboardEntries: 100,
  stats: {
    totalPlayers: 0,
    playersPlaying: 0,
    playersFinished: 0,
    totalAnswers: 0,
    avgScore: 0,
    topScore: 0,
    avgAccuracy: 0,
    avgTimeMs: 0,
    lastUpdated: Date.now(),
  },
};

// =============================================================
// Scoring Mode Display Configuration
// =============================================================
export const SCORING_MODE_CONFIG: Record<QChallengeScoringMode, {
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  emoji: string;
}> = {
  time_and_streak: {
    name: 'זמן + רצף',
    nameEn: 'Time + Streak',
    description: 'בונוס על מהירות תשובה + בונוס על תשובות נכונות ברצף',
    descriptionEn: 'Bonus for speed + bonus for consecutive correct answers',
    emoji: '🚀',
  },
  time_only: {
    name: 'זמן בלבד',
    nameEn: 'Time Only',
    description: 'בונוס על מהירות תשובה - ככל שענית מהר יותר, יותר נקודות',
    descriptionEn: 'Speed bonus only - faster answers earn more points',
    emoji: '⏱️',
  },
  streak_only: {
    name: 'רצף בלבד',
    nameEn: 'Streak Only',
    description: 'בונוס על תשובות נכונות ברצף - עד x3 נקודות',
    descriptionEn: 'Consecutive correct answers bonus - up to x3 points',
    emoji: '🔥',
  },
  simple: {
    name: 'פשוט',
    nameEn: 'Simple',
    description: 'נקודות קבועות לכל תשובה נכונה, בלי בונוסים',
    descriptionEn: 'Fixed points per correct answer, no bonuses',
    emoji: '✅',
  },
};

// =============================================================
// Translations
// =============================================================
export const QCHALLENGE_TRANSLATIONS = {
  he: {
    // General
    quizTitle: 'חידון טריוויה',
    joinQuiz: 'הצטרפו לחידון',
    startQuiz: 'התחילו!',
    waitingForQuiz: 'ממתינים לתחילת החידון',
    quizInProgress: 'החידון מתנהל',
    quizEnded: 'החידון הסתיים',

    // Registration
    enterName: 'הכניסו שם',
    chooseAvatar: 'בחרו אווטאר',
    chooseBranch: 'בחרו סניף',
    takeSelfie: 'צלמו סלפי',

    // Gameplay
    question: 'שאלה',
    timeRemaining: 'זמן נותר',
    yourScore: 'הניקוד שלך',
    correct: 'נכון!',
    incorrect: 'לא נכון',
    streak: 'רצף',
    timeBonus: 'בונוס זמן',

    // Feedback
    greatJob: 'כל הכבוד!',
    keepGoing: 'המשיכו!',
    almostThere: 'כמעט שם!',
    perfectStreak: 'רצף מושלם!',

    // Results
    quizComplete: 'סיימתם!',
    yourResult: 'התוצאה שלך',
    correctAnswers: 'תשובות נכונות',
    accuracy: 'דיוק',
    totalTime: 'זמן כולל',
    bestStreak: 'הרצף הארוך ביותר',

    // Leaderboard
    leaderboard: 'טבלת מובילים',
    yourRank: 'הדירוג שלך',
    players: 'שחקנים',
    viewLeaderboard: 'צפו בטבלה',

    // Scoring modes
    scoringMode: 'מצב ניקוד',

    // Phases
    registration: 'הרשמה',
    countdown: 'ספירה לאחור',
    playing: 'משחק פעיל',
    results: 'תוצאות',

    // Errors
    alreadyPlayed: 'כבר השתתפת בחידון הזה',
    gameNotOpen: 'החידון לא פתוח כרגע',
  },
  en: {
    // General
    quizTitle: 'Trivia Quiz',
    joinQuiz: 'Join Quiz',
    startQuiz: 'Start!',
    waitingForQuiz: 'Waiting for quiz to start',
    quizInProgress: 'Quiz in progress',
    quizEnded: 'Quiz ended',

    // Registration
    enterName: 'Enter your name',
    chooseAvatar: 'Choose avatar',
    chooseBranch: 'Choose branch',
    takeSelfie: 'Take selfie',

    // Gameplay
    question: 'Question',
    timeRemaining: 'Time Remaining',
    yourScore: 'Your Score',
    correct: 'Correct!',
    incorrect: 'Incorrect',
    streak: 'Streak',
    timeBonus: 'Time Bonus',

    // Feedback
    greatJob: 'Great Job!',
    keepGoing: 'Keep Going!',
    almostThere: 'Almost There!',
    perfectStreak: 'Perfect Streak!',

    // Results
    quizComplete: 'Quiz Complete!',
    yourResult: 'Your Result',
    correctAnswers: 'Correct Answers',
    accuracy: 'Accuracy',
    totalTime: 'Total Time',
    bestStreak: 'Best Streak',

    // Leaderboard
    leaderboard: 'Leaderboard',
    yourRank: 'Your Rank',
    players: 'Players',
    viewLeaderboard: 'View Leaderboard',

    // Scoring modes
    scoringMode: 'Scoring Mode',

    // Phases
    registration: 'Registration',
    countdown: 'Countdown',
    playing: 'Playing',
    results: 'Results',

    // Errors
    alreadyPlayed: 'You have already played this quiz',
    gameNotOpen: 'Quiz is not open yet',
  },
};

// =============================================================
// Helper Functions
// =============================================================

/**
 * Get translation for Q.Challenge
 */
export function getQChallengeTranslation(
  key: keyof typeof QCHALLENGE_TRANSLATIONS.he,
  language: 'he' | 'en' | 'auto',
  browserLanguage?: string
): string {
  const lang = language === 'auto'
    ? (browserLanguage?.startsWith('he') ? 'he' : 'en')
    : language;
  return QCHALLENGE_TRANSLATIONS[lang][key] || QCHALLENGE_TRANSLATIONS.en[key];
}

/**
 * Format time in seconds to MM:SS
 */
export function formatQuizTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format milliseconds to readable time
 */
export function formatQuizDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Generate a unique question/answer ID
 */
export function generateQuestionId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateAnswerId(): string {
  return `a_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new empty question
 */
export function createEmptyQuestion(order: number): QChallengeQuestion {
  return {
    id: generateQuestionId(),
    text: '',
    answers: [
      { id: generateAnswerId(), text: '', isCorrect: true, order: 0 },
      { id: generateAnswerId(), text: '', isCorrect: false, order: 1 },
      { id: generateAnswerId(), text: '', isCorrect: false, order: 2 },
      { id: generateAnswerId(), text: '', isCorrect: false, order: 3 },
    ],
    timeLimitSeconds: 30,
    points: 100,
    order,
    isActive: true,
    createdAt: Date.now(),
  };
}

/**
 * Sanitize questions for player (remove correctness)
 */
export function sanitizeQuestionsForPlayer(
  questions: QChallengeQuestion[],
  shuffleQuestions: boolean,
  shuffleAnswers: boolean
): QChallengeQuestion[] {
  let result = questions
    .filter(q => q.isActive)
    .map(q => ({
      ...q,
      answers: q.answers.map(a => ({
        ...a,
        isCorrect: false, // Hide correct answer
      })),
    }));

  // Shuffle questions if enabled
  if (shuffleQuestions) {
    result = shuffleArray(result);
  }

  // Shuffle answers if enabled
  if (shuffleAnswers) {
    result = result.map(q => ({
      ...q,
      answers: shuffleArray(q.answers),
    }));
  }

  return result;
}

/**
 * Fisher-Yates shuffle
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
