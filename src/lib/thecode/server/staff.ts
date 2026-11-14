/**
 * קוד הגמדים — venue staff (the staff screen). Pure: no Firestore, no crypto.
 *
 * The staff list lives in the locked adventure doc (`config.staff`). A staff member logs in
 * with a WhatsApp code to their own phone; the session is then re-checked against this list
 * on EVERY request, so removing someone or switching them off cuts them off at once.
 */

import type { TheCodeStaffMember } from '@/types/thecode';
import type { TheCodeStaffLogEntry } from '@/types/thecode-api';
import { isValidIsraeliMobile, normalizePhoneNumber } from '@/lib/phone-utils';

export const STAFF_LIMITS = { members: 30, name: 30 } as const;
/** A device stays signed in for a week. */
export const STAFF_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
export const STAFF_SESSIONS_PER_MEMBER = 5;
export const STAFF_LOG_MAX = 300;

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const CONTROL = new RegExp('[\\p{Cc}\\p{Cf}<>]', 'gu');

function name(v: unknown): string {
  return typeof v === 'string' ? v.replace(CONTROL, '').replace(/\s+/g, ' ').trim().slice(0, STAFF_LIMITS.name) : '';
}

/** An Israeli mobile as E.164, or null. */
export function staffPhone(v: unknown): string | null {
  if (typeof v !== 'string' || !/^[\d\s()+-]{9,20}$/.test(v.trim())) return null;
  return isValidIsraeliMobile(v) ? normalizePhoneNumber(v) : null;
}

/**
 * Whatever the admin UI sent → a clean list. Entries without a valid id / phone / first name
 * are dropped (never guessed); a phone appears once; at most STAFF_LIMITS.members.
 */
export function normalizeStaff(v: unknown, now: number): TheCodeStaffMember[] {
  if (!Array.isArray(v)) return [];
  const out: TheCodeStaffMember[] = [];
  const ids = new Set<string>();
  const phones = new Set<string>();
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id : '';
    const phone = staffPhone(r.phone);
    const firstName = name(r.firstName);
    if (!ID.test(id) || !phone || !firstName || ids.has(id) || phones.has(phone)) continue;
    ids.add(id);
    phones.add(phone);
    const addedAt = typeof r.addedAt === 'number' && Number.isFinite(r.addedAt) && r.addedAt > 0 && r.addedAt <= now ? Math.round(r.addedAt) : now;
    out.push({ id, firstName, lastName: name(r.lastName), phone, active: r.active !== false, addedAt });
    if (out.length >= STAFF_LIMITS.members) break;
  }
  return out;
}

/** The ACTIVE member with this (already normalized) phone. */
export function staffByPhone(staff: TheCodeStaffMember[] | undefined, phone: string): TheCodeStaffMember | null {
  return (staff || []).find((s) => s.active && s.phone === phone) || null;
}

/** The ACTIVE member with this id. */
export function staffById(staff: TheCodeStaffMember[] | undefined, id: unknown): TheCodeStaffMember | null {
  return (staff || []).find((s) => s.active && s.id === id) || null;
}

export function staffDisplayName(s: Pick<TheCodeStaffMember, 'firstName' | 'lastName'>): string {
  return `${s.firstName} ${s.lastName}`.trim();
}

/** The stored log as a list (oldest first); junk is dropped. */
export function readStaffLog(stored: unknown): TheCodeStaffLogEntry[] {
  return Array.isArray(stored) ? (stored.filter((e) => e && typeof e === 'object' && typeof e.at === 'number') as TheCodeStaffLogEntry[]) : [];
}

/** Append to the log, keeping only the newest STAFF_LOG_MAX. */
export function appendStaffLog(stored: unknown, entry: TheCodeStaffLogEntry): TheCodeStaffLogEntry[] {
  return [...readStaffLog(stored), entry].slice(-STAFF_LOG_MAX);
}

/** The login-code identity of a staff phone: its own namespace, so a staff code can never be
 *  used on the platform login (and the other way round). */
export function staffCodeIdentity(codeId: string, phone: string): { kind: 'phone'; value: string } {
  return { kind: 'phone', value: `thecode-staff|${codeId}|${phone}` };
}

/** Is a stored session still good at `now`? */
export function sessionAlive(session: { staffId?: unknown; expiresAtMs?: unknown } | undefined, now: number): session is { staffId: string; expiresAtMs: number } {
  return !!session && typeof session.staffId === 'string' && typeof session.expiresAtMs === 'number' && session.expiresAtMs > now;
}
