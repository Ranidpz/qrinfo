// ============ Q.TAG - Event Registration & Check-in ============

import type { VerificationMethod } from './verification';

// Event phase
export type QTagPhase = 'registration' | 'closed' | 'event' | 'ended';

// Guest registration status
export type QTagGuestStatus = 'registered' | 'arrived' | 'cancelled';

// Guest gender for +1
export type GuestGender = 'male' | 'female';

// Plus-one details
export interface PlusOneDetail {
  name?: string;
  gender?: GuestGender;
}

// Branding configuration for the registration page
export interface QTagBranding {
  // Background
  backgroundImageUrl?: string;
  backgroundImageName?: string;
  backgroundImageSize?: number;
  imageOverlayOpacity?: number;        // 0-80, overlay darkness

  // Logo
  logoUrl?: string;
  logoName?: string;
  logoSize?: number;
  logoScale?: number;                  // 0.3-2.0, default 1.0

  // Content
  title?: string;                      // Event title
  subtitle?: string;                   // Slogan / details

  // Button
  registerButtonText?: string;         // Custom button text

  // Colors
  colors: {
    background: string;
    text: string;
    buttonBackground: string;
    buttonText: string;
    accent?: string;
  };
}

// Verification config for Q.Tag (simplified from Q.Vote)
export interface QTagVerificationConfig {
  enabled: boolean;
  method: VerificationMethod;
  codeLength: number;                  // Default: 4
  codeExpiryMinutes: number;           // Default: 5
  maxAttempts: number;                 // Default: 5
}

// Aggregate stats (denormalized)
export interface QTagStats {
  totalRegistered: number;             // Total registrants
  totalGuests: number;                 // Total people (registrants + their +1s)
  totalArrived: number;                // Checked-in registrants
  totalArrivedGuests: number;          // Total people who arrived (inc +1s)
  lastUpdated?: Date;
}

// Main Q.Tag configuration (stored in MediaItem.qtagConfig)
export interface QTagConfig {
  // Event details
  eventName: string;
  eventDate?: string;                  // ISO date string
  eventTime?: string;                  // HH:MM
  eventLocation?: string;

  // Phase control
  currentPhase: QTagPhase;

  // Registration settings
  maxRegistrations?: number;           // 0 = unlimited
  allowPlusOne: boolean;
  maxGuestsPerRegistration: number;    // Default: 1
  requireGuestGender: boolean;

  // Verification
  verification: QTagVerificationConfig;

  // Scanner settings
  scannerEnabled: boolean;
  scannerPin?: string;                 // Optional PIN to access scanner

  // Branding
  branding: QTagBranding;

  // Stats (denormalized for dashboard)
  stats?: QTagStats;
}

// Guest document (subcollection: codes/{codeId}/qtagGuests/{guestId})
export interface QTagGuest {
  id: string;
  codeId: string;

  // Registrant details
  name: string;
  phone: string;                       // Normalized +972 format

  // +1 guests
  plusOneCount: number;                 // 0 or more
  plusOneDetails?: PlusOneDetail[];

  // QR code
  qrToken: string;                     // Unique token for QR code

  // Verification
  isVerified: boolean;
  verifiedAt?: Date;

  // Status
  status: QTagGuestStatus;
  arrivedAt?: Date;
  arrivedMarkedBy?: string;            // 'scanner' or admin userId

  // WhatsApp delivery
  qrSentViaWhatsApp: boolean;
  qrSentAt?: Date;

  // Metadata
  registeredAt: Date;
  updatedAt?: Date;
  registeredByAdmin?: boolean;         // Admin-added vs self-registered
}

// Default branding
export const DEFAULT_QTAG_BRANDING: QTagBranding = {
  imageOverlayOpacity: 40,
  logoScale: 1.0,
  colors: {
    background: '#1a1a2e',
    text: '#ffffff',
    buttonBackground: '#3b82f6',
    buttonText: '#ffffff',
  },
};

// Default config
export const DEFAULT_QTAG_CONFIG: QTagConfig = {
  eventName: '',
  currentPhase: 'registration',
  allowPlusOne: true,
  maxGuestsPerRegistration: 1,
  requireGuestGender: false,
  verification: {
    enabled: true,
    method: 'whatsapp',
    codeLength: 4,
    codeExpiryMinutes: 5,
    maxAttempts: 5,
  },
  scannerEnabled: true,
  branding: DEFAULT_QTAG_BRANDING,
};
