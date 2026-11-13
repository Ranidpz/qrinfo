// קוד הגמדים — where the background and the logo sit on the opening screen. PURE.
// ONE source for the player's opening screen and the operator's phone preview, so both draw
// exactly the same numbers (Rani 13.11.2026: drag + zoom the photo, move + resize the logo).
//
// Contract (TheCodeBranding): backgroundFocus {x,y} 0–100 (% of the image kept in view, CSS
// object-position), backgroundZoom 1–3 (1 = cover), logoPosition {x,y} 0–100 (centre of the logo,
// % of the screen; default 50/12), logoScale 0.5–2.5 (relative to the default logo size).
//
// Background = object-position at the focus + scale(zoom) growing from that same point.
// Logo = a box centred on left/top % of the screen, translate(-50%,-50%) scale(logoScale).

import type { CSSProperties } from 'react';
import type { TheCodeBranding } from '@/types/thecode';

export const LAYOUT = {
  focus: { x: 50, y: 50 },
  zoom: { min: 1, max: 3, default: 1 },
  logo: { x: 50, y: 12 },
  logoScale: { min: 0.5, max: 2.5, default: 1 },
} as const;

/**
 * The logo's box at scale 1, as a share of the screen (the image is `object-contain` inside it).
 * Relative, so a 220px editor preview and a real phone frame the logo the same way.
 */
export const LOGO_BOX: CSSProperties = { width: '72%', height: '12%' };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

export interface ResolvedLayout {
  focus: { x: number; y: number };
  zoom: number;
  logo: { x: number; y: number };
  logoScale: number;
}

export function resolveLayout(b?: TheCodeBranding | null): ResolvedLayout {
  return {
    focus: { x: clamp(num(b?.backgroundFocus?.x, LAYOUT.focus.x), 0, 100), y: clamp(num(b?.backgroundFocus?.y, LAYOUT.focus.y), 0, 100) },
    zoom: clamp(num(b?.backgroundZoom, LAYOUT.zoom.default), LAYOUT.zoom.min, LAYOUT.zoom.max),
    logo: { x: clamp(num(b?.logoPosition?.x, LAYOUT.logo.x), 0, 100), y: clamp(num(b?.logoPosition?.y, LAYOUT.logo.y), 0, 100) },
    logoScale: clamp(num(b?.logoScale, LAYOUT.logoScale.default), LAYOUT.logoScale.min, LAYOUT.logoScale.max),
  };
}

/** Styles for the background <img>/<video> (object-fit: cover) and for the logo box. */
export function brandingLayout(b?: TheCodeBranding | null): { background: CSSProperties; logo: CSSProperties } {
  const l = resolveLayout(b);
  return {
    background: {
      objectFit: 'cover',
      objectPosition: `${l.focus.x}% ${l.focus.y}%`,
      transform: l.zoom !== 1 ? `scale(${l.zoom})` : undefined,
      transformOrigin: `${l.focus.x}% ${l.focus.y}%`,
    },
    logo: {
      position: 'absolute',
      left: `${l.logo.x}%`,
      top: `${l.logo.y}%`,
      transform: `translate(-50%, -50%) scale(${l.logoScale})`,
    },
  };
}

/**
 * Did the venue place / resize its logo? Until it does, the player keeps the logo in the page
 * flow at the top (the look every adventure had before placement existed).
 */
export const isLogoPlaced = (b?: TheCodeBranding | null): boolean =>
  !!b?.logoUrl && (!!b.logoPosition || b.logoScale !== undefined);

/**
 * The glass panel behind the opening title + welcome line (Rani 13.11.2026: "תשים מתחת לטקסט
 * איזה גלוסי" — white text was lost in a bright photo). Only over a photo or a video; on a flat
 * colour / gradient there is nothing to fight, so no panel. It adds a backdrop only, never
 * changes the organiser's textColor. Without backdrop-filter the dark tint alone does the job.
 * The admin's phone preview uses the same function, so both draw the same panel.
 */
export function openingTextPanel(b?: TheCodeBranding | null): CSSProperties | null {
  const type = b?.backgroundType ?? (b?.backgroundUrl ? 'image' : undefined);
  const media = (type === 'image' && !!b?.backgroundUrl) || (type === 'video' && !!(b?.backgroundVideoUrl || b?.backgroundUrl));
  if (!media) return null;
  return {
    background: 'linear-gradient(180deg, rgba(8,11,32,.46), rgba(8,11,32,.58))',
    backdropFilter: 'blur(10px) saturate(1.1)',
    WebkitBackdropFilter: 'blur(10px) saturate(1.1)',
    border: '1px solid rgba(255,255,255,.2)',
    borderRadius: 24,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.14), 0 8px 24px rgba(0,0,0,.22)',
    padding: '14px 16px 16px',
  };
}

/** Round to one decimal so saved numbers stay tidy. */
export const tidy = (v: number) => Math.round(v * 10) / 10;
export { clamp };
