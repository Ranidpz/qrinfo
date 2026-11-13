// קוד הגמדים admin — colour helpers for the branding settings.
// Contrast lives in ONE place shared with the player app (src/lib/thecode/contrast.ts); this
// file only adds the admin's strict '#RRGGBB' normalizer (the only form the server keeps) and
// keeps the old names so the screens did not have to change.

export { contrastRatio, contrastOn as readableOn, READABLE_LARGE as MIN_TEXT_CONTRAST } from '@/lib/thecode/contrast';

const HEX = /^#[0-9A-F]{6}$/;

/** '#RRGGBB' (upper case) or undefined — the only colour form the server keeps. */
export function normalizeHex(v: string | undefined | null): string | undefined {
  const s = (v || '').trim().toUpperCase();
  return HEX.test(s) ? s : undefined;
}
