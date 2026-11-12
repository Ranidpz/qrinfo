// הקוד — what a scanned QR / a typed code means. Pure, no React.
//
// Our gnome QR always encodes `{origin}/g/{code}` (the production origin, even when printed
// from dev — any origin is accepted so a dev phone can scan a production plate).
// Anything else (a menu QR, Wi-Fi, a plain word) is "not a gnome of the game".

const MAX_CODE = 40;

/** The gnome code inside a camera-scanned QR, or null when it is not one of ours. */
export function parseGnomeQr(text: string): string | null {
  const raw = (text || '').trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const m = /^\/g\/([^/]+)\/?$/.exec(url.pathname);
  if (!m) return null;
  let code: string;
  try {
    code = decodeURIComponent(m[1]);
  } catch {
    return null;
  }
  code = code.trim();
  return code && code.length <= MAX_CODE ? code : null;
}

/** The short code typed by hand (printed under the QR): spaces dropped, everything else as typed (the server matches). */
export function normalizeManualCode(text: string): string | null {
  const code = (text || '').replace(/\s/g, '').slice(0, MAX_CODE);
  return code.length >= 2 ? code : null;
}
