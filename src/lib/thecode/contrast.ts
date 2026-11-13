// קוד הגמדים — colour contrast for the venue's own colours (opening screen, buttons,
// "איך משחקים" brand theme). PURE: shared by the player app and the operator admin.
// WCAG relative luminance + contrast ratio; `contrastOn` picks black or white text for a fill.

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** '#RGB' / '#RRGGBB' → [r, g, b] 0–255, or null for anything else. */
export function parseHex(hex: string | undefined | null): [number, number, number] | null {
  if (!hex) return null;
  const m = HEX.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export const isHexColor = (hex: string | undefined | null): hex is string => parseHex(hex) !== null;

/** WCAG relative luminance, 0 (black) … 1 (white). Invalid input → 0. */
export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 … 21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export const TEXT_DARK = '#14142B';
export const TEXT_LIGHT = '#FFFFFF';

/** The readable text colour on a fill: dark or white, whichever contrasts more. */
export function contrastOn(fill: string): typeof TEXT_DARK | typeof TEXT_LIGHT {
  return contrastRatio(fill, TEXT_DARK) >= contrastRatio(fill, TEXT_LIGHT) ? TEXT_DARK : TEXT_LIGHT;
}

/** Large display text is readable from 3:1 (WCAG AA large). */
export const READABLE_LARGE = 3;

/** The worst contrast of `text` against every colour of a background (e.g. both ends of a gradient). */
export function worstContrast(text: string, backgrounds: string[]): number {
  const bgs = backgrounds.filter(isHexColor);
  if (!bgs.length || !isHexColor(text)) return 21;
  return Math.min(...bgs.map((b) => contrastRatio(text, b)));
}
