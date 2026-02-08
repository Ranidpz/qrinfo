// ============ Q.VOTE - Digital Voting System ============

// Phase types for voting lifecycle
export type QVotePhase = 'registration' | 'preparation' | 'voting' | 'finals' | 'calculating' | 'results';

// Schedule mode for phase transitions
export type ScheduleMode = 'manual' | 'scheduled' | 'hybrid';

// Candidate registration source
export type CandidateSource = 'self' | 'producer';

// Vote round (1 = regular voting, 2 = finals)
export type VoteRound = 1 | 2;

// Language mode for viewer
export type QVoteLanguageMode = 'he' | 'en' | 'choice';

// Image position configuration for cropping/positioning
export interface ImagePositionConfig {
  mode: 'natural' | 'custom';     // 'natural' = default object-cover, 'custom' = user positioned
  x?: number;                      // -100 to 100 (percentage offset from center) - only when mode='custom'
  y?: number;                      // -100 to 100 (percentage offset from center) - only when mode='custom'
  zoom?: number;                   // 0.5 to 2.0 (1.0 = normal, <1 = see more, >1 = focus/zoom in)
}

// Default image position (natural mode)
export const DEFAULT_IMAGE_POSITION: ImagePositionConfig = {
  mode: 'natural',
};

// Form field for dynamic registration
export interface QVoteFormField {
  id: string;
  label: string;
  labelEn?: string;
  placeholder?: string;
  placeholderEn?: string;
  required: boolean;
  order: number;
}

// Category for organizing candidates
export interface QVoteCategory {
  id: string;
  name: string;
  nameEn?: string;
  headerImage?: string;  // Category header banner image
  headerImagePosition?: ImagePositionConfig;  // Position/crop config for header image
  order: number;
  isActive: boolean;
}

// Branding configuration for event customization
export interface QVoteBranding {
  // Images
  landingImage?: string;              // Full screen landing page image
  landingImageName?: string;          // Original file name
  landingImageSize?: number;          // File size in bytes
  landingImagePosition?: ImagePositionConfig;  // Position/crop config for landing image
  logoUrl?: string;                   // Logo URL for header
  logoScale?: number;                 // Logo scale factor (0.3 to 2.0, default 1.0)
  logoName?: string;                  // Original logo file name
  logoSize?: number;                  // Logo file size in bytes
  categoryImages?: Record<string, string>;  // Image per category ID
  categoryImagePositions?: Record<string, ImagePositionConfig>;  // Position config per category ID
  imageOverlayOpacity?: number;       // Overlay opacity (0-80) for landing image

  // Text content
  landingTitle?: string;
  landingTitleEn?: string;             // English version
  landingSubtitle?: string;
  landingSubtitleEn?: string;          // English version
  votingTitle?: string;                // Title shown during voting phase
  votingTitleEn?: string;              // English version
  buttonText?: string;                 // Legacy - fallback
  buttonTexts?: {                      // Button text per phase
    registration?: string;
    preparation?: string;
    voting?: string;
    finals?: string;
    calculating?: string;
  };
  buttonTextsEn?: {                    // English button texts
    registration?: string;
    preparation?: string;
    voting?: string;
    finals?: string;
    calculating?: string;
  };

  // Colors - full brand customization
  colors: {
    background: string;              // Background color
    text: string;                    // Primary text color
    buttonBackground: string;        // Button background color
    buttonText: string;              // Button text color
    accent?: string;                 // Optional accent color
  };
}

// Schedule configuration for phases
export interface QVoteSchedule {
  registration?: string | Date;
  preparation?: string | Date;
  voting?: string | Date;
  finals?: string | Date;
  calculating?: string | Date;
  results?: string | Date;
}

// Gamification settings for voters
export interface QVoteGamification {
  enabled: boolean;
  xpPerVote: number;                // XP points per vote cast
  xpForPackThreshold: number;       // XP needed for a pack opening
}

// Custom messages for different states
export interface QVoteMessages {
  registrationClosed?: string;
  votingClosed?: string;
  preparationMessage?: string;      // "Preparing the vote..."
  registrationSuccess?: string;     // "נרשמתם בהצלחה!"
  waitForApproval?: string;         // "ההרשמה שלכם תאושר בקרוב"
  alreadyRegistered?: string;       // "כבר נרשמת לתחרות"
  calculatingMessage?: string;      // "מחשבים תוצאות..."
}

// Flipbook settings for results view
export interface QVoteFlipbookSettings {
  pageMode: 'single' | 'double';    // Single or double page spread
  direction: 'ltr' | 'rtl';         // Page direction
  effect3D: boolean;                // 3D flip effect vs 2D swipe
  soundEnabled: boolean;            // Page flip sound
  flipDuration: number;             // Animation duration (300-1200ms)
  autoPlay: boolean;                // Auto advance
  autoPlayInterval: number;         // Interval between auto-advances (2000-10000ms)
  showControls: boolean;            // Show navigation controls
  showCounter: boolean;             // Show page counter
  startFromLast: boolean;           // Start from last place (countdown reveal)
}

// Default flipbook settings
export const DEFAULT_FLIPBOOK_SETTINGS: QVoteFlipbookSettings = {
  pageMode: 'single',
  direction: 'rtl',
  effect3D: true,
  soundEnabled: false,
  flipDuration: 600,
  autoPlay: false,
  autoPlayInterval: 3000,
  showControls: true,
  showCounter: true,
  startFromLast: false,
};

// Tablet/Kiosk mode settings for continuous voting
export interface QVoteTabletModeConfig {
  enabled: boolean;
  resetDelaySeconds: number;  // Seconds before auto-reset (default: 5)
}

// Default tablet mode settings
export const DEFAULT_TABLET_MODE_CONFIG: QVoteTabletModeConfig = {
  enabled: false,
  resetDelaySeconds: 5,
};

// Statistics for the voting session
export interface QVoteStats {
  totalCandidates: number;          // How many registered
  approvedCandidates: number;       // How many approved
  totalVoters: number;              // Unique voters
  totalVotes: number;               // Total votes cast
  finalsVoters?: number;            // Voters in finals
  finalsVotes?: number;             // Votes in finals
  lastUpdated: Date;
}

// Main Q.Vote configuration (stored in MediaItem.qvoteConfig)
export interface QVoteConfig {
  // Registration form fields
  formFields: QVoteFormField[];

  // Categories (empty = single category)
  categories: QVoteCategory[];

  // Phase control
  currentPhase: QVotePhase;
  enableFinals: boolean;            // Whether finals stage is enabled

  // Scheduling
  schedule: QVoteSchedule;
  scheduleMode: ScheduleMode;

  // Voting settings
  minSelectionsPerVoter?: number;   // Minimum candidates to select (1 = can submit after selecting 1)
  maxSelectionsPerVoter: number;    // 1-3 candidates per voter
  showVoteCount: boolean;           // Show/hide vote counts publicly
  showNames: boolean;               // Show/hide candidate names
  enableCropping: boolean;          // Allow image cropping on upload
  allowSelfRegistration: boolean;   // Allow self-registration or producer-only
  hideResultsFromParticipants?: boolean; // Hide results page from participants (show "calculating" instead)
  maxVoteChanges?: number;           // Max times a voter can change their vote (0 = no changes, undefined = no changes)
  languageMode?: QVoteLanguageMode;  // 'he' = Hebrew only, 'en' = English only, 'choice' = user selects
  shuffleCandidates?: boolean;       // Shuffle candidates order for each viewer (default: true)

  // Phone verification for voters
  verification?: import('./verification').QVoteVerificationConfig;

  // Tablet/Kiosk mode for continuous voting on shared devices
  tabletMode?: QVoteTabletModeConfig;

  // Gamification for voters
  gamification: QVoteGamification;

  // Branding
  branding: QVoteBranding;

  // Custom messages
  messages: QVoteMessages;

  // Flipbook settings for results view
  flipbookSettings?: QVoteFlipbookSettings;

  // Statistics (denormalized for performance)
  stats?: QVoteStats;
}

// Candidate photo
export interface CandidatePhoto {
  id: string;
  url: string;
  thumbnailUrl: string;             // Smaller image for gallery
  order: number;
  uploadedAt: Date;
  size?: number;                    // File size in bytes (after compression)
  position?: ImagePositionConfig;   // Position/crop config for this photo
}

// Candidate document (subcollection: codes/{codeId}/candidates)
export interface Candidate {
  id: string;
  codeId: string;                   // Parent code ID
  categoryId?: string;              // Category (if using categories) - legacy single
  categoryIds?: string[];           // Multiple categories (tag system)

  // Registration source
  source: CandidateSource;          // 'self' or 'producer'

  // Candidate data
  name?: string;                    // Optional - can be anonymous
  formData: Record<string, string>; // Dynamic form field values
  photos: CandidatePhoto[];

  // Vote statistics (denormalized for performance)
  voteCount: number;                // Votes in regular round
  finalsVoteCount: number;          // Votes in finals round

  // Status flags
  isApproved: boolean;              // Approved by producer for voting
  isFinalist: boolean;              // Advanced to finals
  isHidden: boolean;                // Hidden (but not deleted)
  displayOrder: number;             // Custom sort order

  // Links
  visitorId?: string;               // Visitor ID if self-registered

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Vote document (subcollection: codes/{codeId}/votes)
// Document ID = `${visitorId}_${candidateId}_${round}`
export interface Vote {
  id: string;
  codeId: string;
  categoryId?: string;
  candidateId: string;
  voterId: string;                  // Visitor ID from localStorage
  round: VoteRound;                 // 1 = regular, 2 = finals
  phone?: string | null;            // Normalized phone number if verification enabled
  createdAt: Date;
}

// Vote submission (for API)
export interface VoteSubmission {
  codeId: string;
  candidateIds: string[];           // Array of selected candidate IDs
  categoryId?: string;
  round: VoteRound;
}

// Phase transition request
export interface PhaseTransition {
  codeId: string;
  newPhase: QVotePhase;
  selectedFinalists?: string[];     // Required when transitioning to finals
}

// Export request
export interface QVoteExportRequest {
  codeId: string;
  includeImages: boolean;
  deleteAfterExport: boolean;
}

// Export response
export interface QVoteExportResponse {
  excelUrl: string;
  imagesZipUrl?: string;
}

// Bulk upload result
export interface BulkUploadResult {
  success: number;
  failed: number;
  candidates: Candidate[];
  errors: string[];
}

// Default configuration for new Q.Vote
export const DEFAULT_QVOTE_CONFIG: QVoteConfig = {
  formFields: [
    { id: 'name', label: 'שם מלא', labelEn: 'Full Name', required: true, order: 0 },
  ],
  categories: [],
  currentPhase: 'registration',
  enableFinals: false,
  schedule: {},
  scheduleMode: 'manual',
  minSelectionsPerVoter: 1,
  maxSelectionsPerVoter: 3,
  showVoteCount: false,
  showNames: true,
  enableCropping: true,
  allowSelfRegistration: true,
  languageMode: 'choice',
  gamification: {
    enabled: false,
    xpPerVote: 10,
    xpForPackThreshold: 50,
  },
  branding: {
    colors: {
      background: '#ffffff',
      text: '#1f2937',
      buttonBackground: '#3b82f6',
      buttonText: '#ffffff',
    },
  },
  messages: {},
};

// Helper to get phase display name
export const PHASE_NAMES: Record<QVotePhase, { he: string; en: string }> = {
  registration: { he: 'הרשמה', en: 'Registration' },
  preparation: { he: 'הכנה', en: 'Preparation' },
  voting: { he: 'הצבעה', en: 'Voting' },
  finals: { he: 'גמר', en: 'Finals' },
  calculating: { he: 'מחשבים תוצאות', en: 'Calculating Results' },
  results: { he: 'תוצאות', en: 'Results' },
};

// Phase order for validation
export const PHASE_ORDER: QVotePhase[] = ['registration', 'preparation', 'voting', 'finals', 'calculating', 'results'];

// Validate phase transition (can only move forward, except finals is optional)
export function isValidPhaseTransition(from: QVotePhase, to: QVotePhase, enableFinals: boolean): boolean {
  const fromIndex = PHASE_ORDER.indexOf(from);
  const toIndex = PHASE_ORDER.indexOf(to);

  // Can't go backwards
  if (toIndex <= fromIndex) return false;

  // If finals not enabled, can't transition to finals
  if (to === 'finals' && !enableFinals) return false;

  // If finals not enabled and transitioning from voting, must go to results
  if (from === 'voting' && !enableFinals && to !== 'results') return false;

  return true;
}
