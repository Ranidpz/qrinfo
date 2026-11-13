// קוד הגמדים admin — where the background and the logo sit on the opening screen. PURE.
// INTERNAL stand-in for the player's `brandingLayout` (not exported yet when this was written):
// the admin preview and the player screen must draw the same numbers — unify once it exists.
//
// Contract (TheCodeBranding): backgroundFocus {x,y} 0–100 (% of the image kept in view, CSS
// object-position), backgroundZoom 1–3 (1 = cover), logoPosition {x,y} 0–100 (centre of the logo,
// % of the screen; default 50/12), logoScale 0.5–2.5 (relative to the default logo size).

import type { CSSProperties } from 'react';
import type { TheCodeBranding } from '@/types/thecode';

export const LAYOUT = {
  focus: { x: 50, y: 50 },
  zoom: { min: 1, max: 3, default: 1 },
  logo: { x: 50, y: 12 },
  logoScale: { min: 0.5, max: 2.5, default: 1 },
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

export interface ResolvedLayout {
  focus: { x: number; y: number };
  zoom: number;
  logo: { x: number; y: number };
  logoScale: number;
}

export function resolveLayout(b: TheCodeBranding): ResolvedLayout {
  return {
    focus: { x: clamp(num(b.backgroundFocus?.x, LAYOUT.focus.x), 0, 100), y: clamp(num(b.backgroundFocus?.y, LAYOUT.focus.y), 0, 100) },
    zoom: clamp(num(b.backgroundZoom, LAYOUT.zoom.default), LAYOUT.zoom.min, LAYOUT.zoom.max),
    logo: { x: clamp(num(b.logoPosition?.x, LAYOUT.logo.x), 0, 100), y: clamp(num(b.logoPosition?.y, LAYOUT.logo.y), 0, 100) },
    logoScale: clamp(num(b.logoScale, LAYOUT.logoScale.default), LAYOUT.logoScale.min, LAYOUT.logoScale.max),
  };
}

/** Styles for the background <img>/<video> (object-fit: cover) and for the logo box. */
export function brandingLayout(b: TheCodeBranding): { background: CSSProperties; logo: CSSProperties } {
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

/** Round to one decimal so saved numbers stay tidy. */
export const tidy = (v: number) => Math.round(v * 10) / 10;
export { clamp };
