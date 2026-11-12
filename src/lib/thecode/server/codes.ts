/**
 * הקוד — code formats. Pure: the random BYTES come from the caller
 * (`crypto.randomBytes` on the server), so this file runs in tests and anywhere.
 *
 * - QR slug (`/g/{slug}`): 12 base62 chars ≈ 71 bits. Case-sensitive.
 * - Manual code under the QR: 6 chars from an unambiguous upper-case alphabet
 *   (no I/O/0/1). Typed by people → matched case-insensitively.
 * - Recovery code: same alphabet, 6 chars, unique within one adventure.
 * Slugs (12) and manual codes (6) never have the same length, so the two kinds can
 * share one index collection (`thecodeGnomeCodes/{code}`) without colliding.
 */

export const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const UNAMBIGUOUS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const QR_SLUG_LENGTH = 12;
export const MANUAL_CODE_LENGTH = 6;
export const RECOVERY_CODE_LENGTH = 6;

/**
 * Turn random bytes into `length` chars of `alphabet` without modulo bias
 * (bytes ≥ the largest multiple of the alphabet size are skipped). Returns null
 * when the bytes ran out — the caller draws more.
 */
export function codeFromBytes(bytes: Uint8Array, alphabet: string, length: number): string | null {
  const n = alphabet.length;
  const limit = Math.floor(256 / n) * n;
  let out = '';
  for (let i = 0; i < bytes.length && out.length < length; i++) {
    if (bytes[i] < limit) out += alphabet[bytes[i] % n];
  }
  return out.length === length ? out : null;
}

/** Draw a code with a byte source (e.g. `(n) => crypto.randomBytes(n)`). */
export function drawCode(randomBytes: (n: number) => Uint8Array, alphabet: string, length: number): string {
  for (;;) {
    const code = codeFromBytes(randomBytes(length * 2 + 8), alphabet, length);
    if (code) return code;
  }
}

/** A scanned / typed gnome code, cleaned, or null when it cannot be a code at all. */
export function cleanScanCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let s = raw.trim();
  // A full URL pasted / scanned by another reader: keep the last path segment.
  const m = /\/g\/([A-Za-z0-9]+)\/?(?:[?#].*)?$/.exec(s);
  if (m) s = m[1];
  s = s.replace(/[\s-]/g, '');
  return /^[A-Za-z0-9]{4,32}$/.test(s) ? s : null;
}

/** A typed recovery code, upper-cased, or null when it cannot be one. */
export function cleanRecoveryCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.replace(/[\s-]/g, '').toUpperCase();
  if (s.length !== RECOVERY_CODE_LENGTH) return null;
  for (const ch of s) if (!UNAMBIGUOUS.includes(ch)) return null;
  return s;
}
