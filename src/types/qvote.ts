// ============ Q.VOTE - Digital Voting System ============

// Phase types for voting lifecycle
export type QVotePhase = 'registration' | 'preparation' | 'voting' | 'finals' | 'results';

// Schedule mode for phase transitions
export type ScheduleMode = 'manual' | 'scheduled' | 'hybrid';

// Candidate registration source
export type CandidateSource = 'self' | 'producer';

// Vote round (1 = regular voting, 2 = finals)
export type VoteRound = 1 | 2;

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
  order: number;
  isActive: boolean;
}

// Branding configuration for event customization
export interface QVoteBranding {
  // Images
  landingImage?: string;              // Full screen landing page image
  landingImageName?: string;          // Original file name
  landingImageSize?: number;          // File size in bytes
  categoryImages?: Record<string, string>;  // Image per category ID
  imageOverlayOpacity?: number;       // Overlay opacity (0-80) for landing image

  // Text content
  landingTitle?: string;
  landingSubtitle?: string;
  buttonText?: string;                 // Legacy - fallback
  buttonTexts?: {                      // Button text per phase
    registration?: string;
    preparation?: string;
    voting?: string;
    finals?: string;
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
  registrationStart?: Date;
  registrationEnd?: Date;
  votingStart?: Date;
  votingEnd?: Date;
  finalsStart?: Date;               // Only if enableFinals=true
  finalsEnd?: Date;
  resultsStart?: Date;
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
}

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
  maxPhotosPerCandidate: number;    // 1-3
  maxSelectionsPerVoter: number;    // 1-3 candidates per voter
  showVoteCount: boolean;           // Show/hide vote counts publicly
  showNames: boolean;               // Show/hide candidate names
  enableCropping: boolean;          // Allow image cropping on upload
  allowSelfRegistration: boolean;   // Allow self-registration or producer-only

  // Gamification for voters
  gamification: QVoteGamification;

  // Branding
  branding: QVoteBranding;

  // Custom messages
  messages: QVoteMessages;

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
}

// Candidate document (subcollection: codes/{codeId}/candidates)
export interface Candidate {
  id: string;
  codeId: string;                   // Parent code ID
  categoryId?: string;              // Category (if using categories)

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
  maxPhotosPerCandidate: 3,
  maxSelectionsPerVoter: 3,
  showVoteCount: false,
  showNames: true,
  enableCropping: true,
  allowSelfRegistration: true,
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
  results: { he: 'תוצאות', en: 'Results' },
};

// Phase order for validation
export const PHASE_ORDER: QVotePhase[] = ['registration', 'preparation', 'voting', 'finals', 'results'];

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
