// ============ VERIFICATION SYSTEM ============

// Verification method options
export type VerificationMethod = 'whatsapp' | 'sms' | 'both';

// Verification code status
export type VerificationStatus = 'pending' | 'verified' | 'expired' | 'blocked';

// Message delivery status
export type MessageStatus = 'sent' | 'delivered' | 'failed';

// Authorized voter from Excel upload
export interface AuthorizedVoter {
  phone: string;           // Normalized phone number (+972...)
  name?: string;           // Optional name from Excel
  maxVotes?: number;       // Override default vote limit (optional)
}

// Verification settings for QVoteConfig
export interface QVoteVerificationConfig {
  enabled: boolean;
  method: VerificationMethod;
  codeLength: number;              // Default: 4
  codeExpiryMinutes: number;       // Default: 5
  maxAttempts: number;             // Default: 5
  blockDurationMinutes: number;    // Default: 30
  maxVotesPerPhone: number;        // Default: 1
  authorizedVotersOnly: boolean;   // Only allow phones from uploaded list
  authorizedVoters?: AuthorizedVoter[];
}

// Default verification config
export const DEFAULT_VERIFICATION_CONFIG: QVoteVerificationConfig = {
  enabled: false,
  method: 'whatsapp',
  codeLength: 4,
  codeExpiryMinutes: 5,
  maxAttempts: 5,
  blockDurationMinutes: 30,
  maxVotesPerPhone: 1,
  authorizedVotersOnly: false,
};

// Verification code document (Firestore: verificationCodes/{id})
export interface VerificationCode {
  id: string;
  codeId: string;              // Q.VOTE code ID
  phone: string;               // Normalized phone number
  codeHash: string;            // Hashed 4-digit code
  attempts: number;            // Failed verification attempts
  method: VerificationMethod;  // Method used to send
  status: VerificationStatus;
  createdAt: Date;
  expiresAt: Date;
  verifiedAt?: Date;
  blockedUntil?: Date;         // If blocked due to too many attempts
}

// Verified voter document (Firestore: verifiedVoters/{codeId_phone})
export interface VerifiedVoter {
  id: string;                  // Format: codeId_normalizedPhone
  codeId: string;
  phone: string;               // Normalized phone
  name?: string;               // From authorized list or user input
  votesUsed: number;           // Number of votes cast
  maxVotes: number;            // Max allowed (from config or authorized list)
  lastVerifiedAt: Date;
  sessionToken: string;        // For validating current session
  sessionExpiresAt: Date;      // Session token expiry
  createdAt: Date;
  updatedAt: Date;
}

// Message log document (Firestore: messageLogs/{id})
export interface MessageLog {
  id: string;
  userId: string;              // Producer/owner ID who owns the QVote
  codeId: string;              // Q.VOTE code ID
  phone: string;               // Recipient phone
  method: VerificationMethod;  // whatsapp or sms
  status: MessageStatus;
  errorMessage?: string;       // If failed
  cost?: number;               // Cost in credits/messages
  createdAt: Date;
}

// User message quota (added to User interface)
export interface MessageQuota {
  limit: number;               // Total messages allowed (default: 25)
  used: number;                // Messages used
  lastResetAt?: Date;          // When quota was last reset
}

// Default quota for new users
export const DEFAULT_MESSAGE_QUOTA: MessageQuota = {
  limit: 25,
  used: 0,
};

// API Response types
export interface SendOTPResponse {
  success: boolean;
  expiresAt?: Date;
  method?: VerificationMethod;
  error?: string;
  remainingQuota?: number;
}

export interface VerifyOTPResponse {
  success: boolean;
  sessionToken?: string;
  votesRemaining?: number;
  error?: string;
}

export interface VerificationStatusResponse {
  isVerified: boolean;
  votesUsed: number;
  votesRemaining: number;
  isBlocked: boolean;
  blockedUntil?: Date;
}

// INFORU API types
export interface INFORUSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
