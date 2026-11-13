// קוד הגמדים admin — colour helpers for the branding settings. PURE.
// `contrastRatio` / `readableOn` are an INTERNAL stand-in for the player's `contrastOn`
// (not exported yet when this was written) — unify them once it exists.

const HEX = /^#[0-9A-F]{6}$/;

/** '#RRGGBB' (upper case) or undefined — the only colour form the server keeps. */
export function normalizeHex(v: string | undefined | null): string | undefined {
  const s = (v || '').trim().toUpperCase();
  return HEX.test(s) ? s : undefined;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const chan = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * chan((n >> 16) & 255) + 0.7152 * chan((n >> 8) & 255) + 0.0722 * chan(n & 255);
}

/** WCAG contrast ratio between two '#RRGGBB' colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Black or white text, whichever reads better on `bg`. */
export function readableOn(bg: string): '#000000' | '#FFFFFF' {
  return contrastRatio(bg, '#000000') >= contrastRatio(bg, '#FFFFFF') ? '#000000' : '#FFFFFF';
}

/** Large text (the title) needs 3:1 — below that we warn. */
export const MIN_TEXT_CONTRAST = 3;
