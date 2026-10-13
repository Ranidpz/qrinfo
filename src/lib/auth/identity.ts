// One login field for everyone: an email address or an Israeli mobile number.
// Shared by the login page and the OTP API routes so both sides agree on what
// the field means and on the normalized value the code is bound to.

import { isValidIsraeliMobile, normalizePhoneNumber } from '@/lib/phone-utils';

export type LoginIdentityKind = 'email' | 'phone';

export interface LoginIdentity {
  kind: LoginIdentityKind;
  /** Lowercased email, or E.164 phone (+9725XXXXXXXX). */
  value: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function parseLoginIdentity(raw: unknown): LoginIdentity | null {
  if (typeof raw !== 'string') return null;
  const input = raw.trim();
  if (!input || input.length > 254) return null;

  if (input.includes('@')) {
    const email = input.toLowerCase();
    return EMAIL_RE.test(email) ? { kind: 'email', value: email } : null;
  }

  // WhatsApp login is limited to Israeli mobiles for now (keeps paid-message abuse down).
  if (!/^[\d\s()+-]{9,20}$/.test(input)) return null;
  if (!isValidIsraeliMobile(input)) return null;
  return { kind: 'phone', value: normalizePhoneNumber(input) };
}

/** Last identity the user got a code for — the ONLY auth value kept in localStorage. */
export const LAST_IDENTITY_KEY = 'theq.gate.last-identity';
