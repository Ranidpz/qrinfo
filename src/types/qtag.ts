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

  // WhatsApp
  sendQrViaWhatsApp: boolean;          // Send QR link via WhatsApp after registration

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

// Skin presets
export interface QTagSkin {
  id: string;
  colors: QTagBranding['colors'];
  imageOverlayOpacity: number;
}

export const QTAG_SKIN_DARK: QTagSkin = {
  id: 'dark',
  colors: {
    background: '#1a1a2e',
    text: '#ffffff',
    buttonBackground: '#3b82f6',
    buttonText: '#ffffff',
    accent: '#2d1b69',
  },
  imageOverlayOpacity: 40,
};

export const QTAG_SKIN_LIGHT: QTagSkin = {
  id: 'light',
  colors: {
    background: '#faf9f6',
    text: '#1e1e2e',
    buttonBackground: '#1e1e2e',
    buttonText: '#ffffff',
    accent: '#e8e4ef',
  },
  imageOverlayOpacity: 20,
};

export const QTAG_SKINS = [QTAG_SKIN_DARK, QTAG_SKIN_LIGHT] as const;

// Default branding
export const DEFAULT_QTAG_BRANDING: QTagBranding = {
  imageOverlayOpacity: QTAG_SKIN_DARK.imageOverlayOpacity,
  logoScale: 1.0,
  colors: { ...QTAG_SKIN_DARK.colors },
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
  sendQrViaWhatsApp: true,
  scannerEnabled: true,
  branding: DEFAULT_QTAG_BRANDING,
};
