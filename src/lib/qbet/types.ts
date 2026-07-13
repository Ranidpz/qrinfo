// QBet ("הימור") experience — shared types.
// Flow: participant lands on a full-screen poster → taps → registers with full
// name + phone → verifies via WhatsApp OTP (INFORU) → predicts the match score
// → waits for the final result. The owner publishes the final result in the
// settings modal and exports all entries (+ winners) to Excel.
//
// Participant data (registrations, OTP state, predictions) lives in the
// FIRESTORE subcollection codes/{codeId}/qbetEntries (Admin SDK only — see
// src/lib/qbet/store.ts); this config object sits on the code's media item.

export interface QBetTeam {
  code: string; // flag asset id, e.g. 'es' (see lib/selfiebeam/countries.ts)
  name: string; // display name baked in at pick time (owner's locale)
  flag: string; // public path to the flag asset, e.g. '/flags/es.svg'
}

export interface QBetResult {
  home: number;
  away: number;
}

export interface QBetConfig {
  title: string;
  matchLabel?: string; // e.g. 'גמר המונדיאל 2026' — shown above the score picker
  backgroundImageUrl?: string; // full-screen landing poster (whole screen is the tap target)
  backgroundImageSize?: number; // bytes — storage bookkeeping for replace/delete
  // Landing composition — all optional (the poster may carry everything baked-in)
  logoUrl?: string; // transparent PNG pinned top-center above the poster
  logoSize?: number; // bytes — storage bookkeeping for replace/delete
  landingTitle?: string; // text overlay under the logo ('' = title is baked into the image)
  buttonText?: string; // CTA label on the animated landing button
  buttonTextColor?: string;
  buttonGradient?: string[]; // 2-4 colors — animated border gradient + glow
  teamHome: QBetTeam;
  teamAway: QBetTeam;
  backgroundColor: string; // form screens background
  fontColor: string; // form screens text (buttons render inverted: bg=fontColor)
  maxGoals: number; // score picker ceiling
  locked?: boolean; // owner-locked (match started) — blocks new/changed predictions
  finalResult?: QBetResult | null; // published result; publishing also locks predictions
}

// Poster-inspired default: blue → purple → red (מונדיאל vibes)
export const DEFAULT_QBET_GRADIENT = ['#2563eb', '#7c3aed', '#dc2626'];

export const DEFAULT_QBET_CONFIG: QBetConfig = {
  title: 'הימור המשחק',
  matchLabel: '',
  logoUrl: '',
  landingTitle: '',
  buttonText: 'הירשמו עכשיו ובחרו תוצאה',
  buttonTextColor: '#ffffff',
  buttonGradient: DEFAULT_QBET_GRADIENT,
  teamHome: { code: 'es', name: 'ספרד', flag: '/flags/es.svg' },
  teamAway: { code: 'fr', name: 'צרפת', flag: '/flags/fr.svg' },
  backgroundColor: '#0b0f1a',
  fontColor: '#ffffff',
  maxGoals: 15,
  locked: false,
  finalResult: null,
};

// Betting closes once the owner locks it or publishes a final result.
export function isBettingLocked(
  config: Pick<QBetConfig, 'locked' | 'finalResult'>
): boolean {
  return !!config.locked || config.finalResult != null;
}

// Winner rule: exact score match on a verified entry.
export function isWinningPrediction(
  prediction: { home: number | null; away: number | null } | null | undefined,
  finalResult: QBetResult | null | undefined
): boolean {
  if (!prediction || !finalResult) return false;
  return (
    prediction.home === finalResult.home && prediction.away === finalResult.away
  );
}

// Entry shape as exposed to CLIENTS (admin modal + participant status).
// Mirrors the qbetEntries Firestore record minus OTP internals.
export interface QBetEntry {
  id: string;
  fullName: string;
  phone: string;
  verified: boolean;
  predictionHome: number | null;
  predictionAway: number | null;
  predictedAt: string | null; // ISO
  createdAt: string; // ISO
}
