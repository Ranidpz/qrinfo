/**
 * קוד הגמדים — check an uploaded selfie by its BYTES, not by what the browser claims. Pure.
 */

import { SELFIE_LIMITS } from '../selfie';

export type TheCodePhotoType = 'image/webp' | 'image/jpeg';

/** webp ("RIFF....WEBP") or jpeg (FF D8 FF), else null. */
export function sniffPhotoType(b: Uint8Array): TheCodePhotoType | null {
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  return null;
}

export type TheCodePhotoCheck = { ok: true; type: TheCodePhotoType } | { ok: false; error: 'tooLarge' | 'badType' | 'empty' };

export function checkPhoto(b: Uint8Array): TheCodePhotoCheck {
  if (!b.length) return { ok: false, error: 'empty' };
  if (b.length > SELFIE_LIMITS.maxBytes) return { ok: false, error: 'tooLarge' };
  const type = sniffPhotoType(b);
  return type ? { ok: true, type } : { ok: false, error: 'badType' };
}
