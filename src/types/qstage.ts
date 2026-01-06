// ============ Q.STAGE - Live Voting System ============
// Real-time audience voting for talent shows, debates, and live events

// Phase states for the live voting lifecycle
export type QStagePhase = 'standby' | 'countdown' | 'voting' | 'results';

// Vote type (binary voting system)
export type QStageVoteType = 'like' | 'dislike';

// Background type for display
export type QStageBackgroundType = 'color' | 'image' | 'video';

// Avatar type for voters
export type QStageAvatarType = 'emoji' | 'selfie';

// Bar position options
export type QStageBarPosition = 'left' | 'right';

// Grid position options
export type QStageGridPosition = 'left' | 'right' | 'hidden';

// Threshold configuration for color changes
export interface QStageThreshold {
  percentage: number;        // 0-100
  color: string;            // Hex color
  glowColor?: string;       // Optional glow color (defaults to same as color)
  label?: string;           // Optional label (e.g., "Pass", "Success")
}

// Default thresholds (TV show style)
export const DEFAULT_QSTAGE_THRESHOLDS: QStageThreshold[] = [
  { percentage: 0, color: '#ff3355', glowColor: '#ff335580', label: 'Low' },
  { percentage: 35, color: '#f59e0b', glowColor: '#f59e0b80', label: 'Building' },
  { percentage: 50, color: '#eab308', glowColor: '#eab30880', label: 'Halfway' },
  { percentage: 65, color: '#00ff88', glowColor: '#00ff8880', label: 'Success!' },
  { percentage: 85, color: '#10b981', glowColor: '#10b98180', label: 'Amazing!' },
];

// Voter record for display grid
export interface QStageVoter {
  visitorId: string;
  avatarType: QStageAvatarType;
  avatarValue: string;       // Emoji character or selfie URL
  voteType: QStageVoteType;
  votedAt: number;           // Timestamp for ordering
  isJudge: boolean;
  weight: number;            // Vote weight (1 for regular, higher for judges)
}

// Judge configuration
export interface QStageJudge {
  id: string;
  name: string;
  voteWeight: number;        // Multiplier (e.g., 5x = counts as 5 votes)
  accessToken: string;       // Unique access token for judge URL
  hasVoted: boolean;
  votedAt?: number;
}

// Display configuration
export interface QStageDisplayConfig {
  // Background
  backgroundType: QStageBackgroundType;
  backgroundColor: string;
  backgroundImageUrl?: string;
  backgroundVideoUrl?: string;
  backgroundOverlayOpacity: number; // 0-80%

  // Bar settings
  barPosition: QStageBarPosition;
  barWidth: number;          // Pixels (80-200)
  showPercentageText: boolean;
  barGlowEnabled: boolean;

  // Voter grid
  gridPosition: QStageGridPosition;
  maxVisibleVoters: number;  // Performance limit (default 100)

  // Stats display
  showVoterCount: boolean;
  showLikeDislikeCount: boolean;
}

// Branding configuration
export interface QStageBranding {
  eventName?: string;
  eventNameEn?: string;
  eventLogo?: string;
  primaryColor: string;      // Main accent color
  successColor: string;      // Color for success threshold
}

// Sound effects configuration
export interface QStageSoundConfig {
  enabled: boolean;
  countdownSound: boolean;
  voteSound: boolean;
  thresholdSound: boolean;
  successSound: boolean;
}

// Emoji palette for avatar selection
export const DEFAULT_EMOJI_PALETTE = [
  '😊', '🎉', '⭐', '❤️', '🔥', '👏',
  '🎵', '🌟', '💫', '🎭', '🎤', '🎸',
  '✨', '💪', '🙌', '🤩', '😎', '🥳'
];

// Session statistics (denormalized for fast access)
export interface QStageStats {
  totalVoters: number;
  totalLikes: number;
  totalDislikes: number;
  likePercent: number;       // Pre-calculated (0-100)
  judgeVotes: number;
  lastUpdated: number;       // Timestamp
}

// Main QStage configuration (stored in MediaItem.qstageConfig)
export interface QStageConfig {
  // Phase
  currentPhase: QStagePhase;

  // Timing
  votingDurationSeconds: number;    // 0 = unlimited, or specific duration
  countdownDurationSeconds: number; // Default 3

  // Success threshold
  successThreshold: number;         // Default 65 (percentage to trigger success)

  // Thresholds for bar colors
  thresholds: QStageThreshold[];

  // Display settings
  display: QStageDisplayConfig;

  // Branding
  branding: QStageBranding;

  // Judges
  judges: QStageJudge[];
  judgeVotingEnabled: boolean;
  judgesCanVoteAfterAudience: boolean;

  // Sound
  sound: QStageSoundConfig;

  // Avatar settings
  emojiPalette: string[];
  allowSelfie: boolean;

  // Custom vote labels (optional)
  likeLabel?: string;
  likeLabelEn?: string;
  dislikeLabel?: string;
  dislikeLabelEn?: string;

  // Custom vote icons (emoji)
  likeIcon?: string;         // Default: 👍
  dislikeIcon?: string;      // Default: 👎

  // Stats (denormalized for fast reads)
  stats: QStageStats;

  // Session tracking
  sessionStartedAt?: number;
  sessionEndedAt?: number;
  lastResetAt?: number;

  // Language
  language: 'he' | 'en' | 'auto';

  // Background convenience fields (synced with display.backgroundImageUrl/backgroundVideoUrl)
  backgroundImage?: string;
  backgroundVideo?: string;
}

// Individual vote document (stored in codes/{codeId}/qstage_votes/{visitorId})
export interface QStageVote {
  visitorId: string;
  voteType: QStageVoteType;
  avatarType: QStageAvatarType;
  avatarValue: string;
  isJudge: boolean;
  judgeId?: string;          // If judge, reference to judge config
  weight: number;            // 1 for regular, higher for judges
  votedAt: number;           // Timestamp
}

// Live data structure for Firebase Realtime Database
// Path: /qstage/{codeId}
export interface QStageLiveData {
  status: QStagePhase;
  countdownStartedAt?: number;
  votingStartedAt?: number;

  // Pre-calculated aggregates (updated by server every ~100ms)
  stats: QStageStats;

  // Recent voters for grid display (last N voters)
  recentVoters: Record<string, QStageVoter>;

  // Triggered events for animations
  events: {
    successTriggered?: boolean;
    successTriggeredAt?: number;
    lastThresholdCrossed?: number;
  };

  lastUpdated: number;
}

// Default configuration
export const DEFAULT_QSTAGE_CONFIG: QStageConfig = {
  currentPhase: 'standby',
  votingDurationSeconds: 0,        // Unlimited
  countdownDurationSeconds: 3,
  successThreshold: 65,
  thresholds: DEFAULT_QSTAGE_THRESHOLDS,
  display: {
    backgroundType: 'color',
    backgroundColor: '#0a0f1a',
    backgroundOverlayOpacity: 40,
    barPosition: 'right',
    barWidth: 120,
    showPercentageText: true,
    barGlowEnabled: true,
    gridPosition: 'left',
    maxVisibleVoters: 100,
    showVoterCount: true,
    showLikeDislikeCount: false,
  },
  branding: {
    primaryColor: '#00d4ff',
    successColor: '#00ff88',
  },
  judges: [],
  judgeVotingEnabled: false,
  judgesCanVoteAfterAudience: true,
  sound: {
    enabled: true,
    countdownSound: true,
    voteSound: false,          // Can be noisy with many voters
    thresholdSound: true,
    successSound: true,
  },
  emojiPalette: DEFAULT_EMOJI_PALETTE,
  allowSelfie: true,
  likeIcon: '👍',
  dislikeIcon: '👎',
  stats: {
    totalVoters: 0,
    totalLikes: 0,
    totalDislikes: 0,
    likePercent: 0,
    judgeVotes: 0,
    lastUpdated: Date.now(),
  },
  language: 'auto',
};

// Translations for QStage UI
export const QSTAGE_TRANSLATIONS = {
  he: {
    joinVoting: 'הצטרפו להצבעה',
    selectAvatar: 'בחרו אווטאר',
    takeSelfie: 'צלמו סלפי',
    vote: 'הצביעו',
    like: 'אהבתי',
    dislike: 'לא אהבתי',
    voteCounted: 'ההצבעה נספרה!',
    thankYou: 'תודה על ההשתתפות',
    waitingForVoting: 'ממתינים להצבעה...',
    votingEnded: 'ההצבעה הסתיימה',
    liveVoters: 'משתתפים',
    success: 'הצלחה!',
    judgePanelTitle: 'פאנל שופטים',
    yourVoteWeight: 'משקל ההצבעה שלך',
    swipeToVote: 'החליקו להצבעה',
  },
  en: {
    joinVoting: 'Join the Vote',
    selectAvatar: 'Select Avatar',
    takeSelfie: 'Take Selfie',
    vote: 'Vote',
    like: 'Like',
    dislike: 'Dislike',
    voteCounted: 'Vote Counted!',
    thankYou: 'Thank you for participating',
    waitingForVoting: 'Waiting for voting...',
    votingEnded: 'Voting ended',
    liveVoters: 'Live voters',
    success: 'Success!',
    judgePanelTitle: 'Judge Panel',
    yourVoteWeight: 'Your vote weight',
    swipeToVote: 'Swipe to vote',
  },
};
