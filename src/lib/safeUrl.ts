/**
 * Link media URLs are user-controlled and the viewer navigates to them, so only plain
 * web / contact schemes are allowed — never `javascript:`, `data:`, `vbscript:` etc.
 */
const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'tel:', 'mailto:', 'sms:', 'whatsapp:']);

export function isSafeLinkUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    return SAFE_LINK_PROTOCOLS.has(new URL(trimmed).protocol);
  } catch {
    return false;
  }
}
