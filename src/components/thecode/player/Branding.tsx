'use client';

// The venue's brand on the OPENING screen only (register / recover / loading in front of it):
// a full-bleed photo with a scrim strong enough for white text on any photo, the venue logo,
// and a quiet "Powered by The Q". Once the group is in, the game keeps its own look.
// Plain <img> (R2 URLs); every image may still be loading or may fail — the screen never
// waits for it and falls back to the game's night background.

import { useState, type CSSProperties } from 'react';
import type { TheCodeBranding } from '@/types/thecode';
import { LOGO_BOX } from '@/lib/thecode/brandingLayout';
import { READABLE_LARGE, contrastOn, isHexColor, luminance, worstContrast } from '@/lib/thecode/contrast';

export { LAYOUT, LOGO_BOX, brandingLayout, isLogoPlaced, openingTextPanel, resolveLayout } from '@/lib/thecode/brandingLayout';

/** The game's own night colour — what the scrim over a photo / video amounts to for contrast. */
const NIGHT = '#0B1030';

export interface OpeningLook {
  kind: 'none' | 'image' | 'color' | 'gradient' | 'video';
  imageUrl?: string;
  videoUrl?: string;
  color?: string;
  from?: string;
  to?: string;
  /** The background is light → the screen's own chrome (labels, inputs, ghost buttons) goes dark. */
  chromeDark: boolean;
  /** Title + welcome line, when the venue chose a text colour (with a readability shadow if needed). */
  text?: CSSProperties;
  /** Main button, when the venue chose a button colour (text colour picked for contrast). */
  button?: CSSProperties;
}

/**
 * What the opening screen looks like for a venue (Rani 13.11.2026: colour, gradient, image or
 * video behind; own text + button colours). Absent `backgroundType` → 'image' when there is a
 * photo, else the game's default — so existing adventures look exactly as before.
 */
export function openingLook(b?: TheCodeBranding | null): OpeningLook {
  if (!b) return { kind: 'none', chromeDark: false };
  const type = b.backgroundType ?? (b.backgroundUrl ? 'image' : undefined);
  let look: OpeningLook = { kind: 'none', chromeDark: false };
  let bgs: string[] = [NIGHT];
  if (type === 'color' && isHexColor(b.backgroundColor)) {
    look = { kind: 'color', color: b.backgroundColor, chromeDark: luminance(b.backgroundColor) > 0.45 };
    bgs = [b.backgroundColor];
  } else if (type === 'gradient' && isHexColor(b.gradientFrom) && isHexColor(b.gradientTo)) {
    const avg = (luminance(b.gradientFrom) + luminance(b.gradientTo)) / 2;
    look = { kind: 'gradient', from: b.gradientFrom, to: b.gradientTo, chromeDark: avg > 0.45 };
    bgs = [b.gradientFrom, b.gradientTo];
  } else if (type === 'video' && b.backgroundVideoUrl) {
    look = { kind: 'video', videoUrl: b.backgroundVideoUrl, imageUrl: b.backgroundUrl, chromeDark: false };
  } else if ((type === 'image' || type === undefined) && b.backgroundUrl) {
    look = { kind: 'image', imageUrl: b.backgroundUrl, chromeDark: false };
  }
  if (isHexColor(b.textColor)) {
    // Too little contrast against the background (yellow on white…) → a soft outline keeps it readable.
    const weak = worstContrast(b.textColor, bgs) < READABLE_LARGE;
    const halo = contrastOn(b.textColor) === '#FFFFFF' ? 'rgba(255,255,255,.85)' : 'rgba(6,9,30,.85)';
    look.text = { color: b.textColor, textShadow: weak ? `0 0 1px ${halo}, 0 1px 3px ${halo}, 0 0 14px ${halo}` : '0 1px 8px rgba(0,0,0,.35)' };
  }
  if (isHexColor(b.buttonColor)) {
    look.button = { background: b.buttonColor, color: contrastOn(b.buttonColor), boxShadow: '0 6px 18px rgba(0,0,0,.28)' };
  }
  return look;
}

/** CSS vars that turn the opening screen's own chrome dark on a light venue background. */
export const DARK_CHROME: CSSProperties = {
  ['--tc-cream' as string]: '#14142B',
  ['--tc-soft' as string]: 'rgba(20,20,43,.72)',
  ['--tc-line' as string]: 'rgba(20,20,43,.22)',
  ['--tc-panel' as string]: 'rgba(255,255,255,.55)',
  color: 'var(--tc-cream)',
};

const SCRIM = 'linear-gradient(180deg, rgba(6,9,30,.6) 0%, rgba(6,9,30,.45) 18%, rgba(6,9,30,.8) 40%, rgba(6,9,30,.93) 65%, rgba(6,9,30,.97) 100%)';

/** Whatever fills the opening screen: colour, gradient, photo (+scrim) or a muted looping video (+scrim). */
export function OpeningBackdrop({ look, mediaStyle }: { look: OpeningLook; mediaStyle?: CSSProperties }) {
  const [videoFailed, setVideoFailed] = useState<string | null>(null);
  if (look.kind === 'color') return <div aria-hidden className="pointer-events-none absolute inset-0 z-0" style={{ background: look.color }} />;
  if (look.kind === 'gradient') return <div aria-hidden className="pointer-events-none absolute inset-0 z-0" style={{ background: `linear-gradient(180deg, ${look.from}, ${look.to})` }} />;
  if (look.kind === 'video' && look.videoUrl && videoFailed !== look.videoUrl) {
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <video src={look.videoUrl} autoPlay muted loop playsInline preload="auto" onError={() => setVideoFailed(look.videoUrl!)}
          className="tc-a-fade absolute inset-0 h-full w-full object-cover" style={mediaStyle} />
        <div className="absolute inset-0" style={{ background: SCRIM }} />
      </div>
    );
  }
  // a video that failed falls back to the photo when there is one, else the night sky
  const photo = look.kind === 'image' ? look.imageUrl : look.kind === 'video' ? look.imageUrl : undefined;
  return <BrandBackdrop url={photo} mediaStyle={mediaStyle} />;
}

/** Full-bleed venue photo + scrim, absolutely filling the nearest positioned parent. */
export function BrandBackdrop({ url, mediaStyle }: { url?: string; mediaStyle?: CSSProperties }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!url || failed === url) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" decoding="async" onError={() => setFailed(url)}
        className="tc-a-fade absolute inset-0 h-full w-full object-cover object-center" style={mediaStyle} />
      <div className="absolute inset-0"
        style={{ background: SCRIM }} />
    </div>
  );
}

const LOGO_GLOW = 'drop-shadow(0 0 1px rgba(255,255,255,.9)) drop-shadow(0 0 8px rgba(255,255,255,.45)) drop-shadow(0 4px 14px rgba(0,0,0,.55))';

/** The venue logo, centred in the page flow; hides itself when the image is broken. */
export function BrandLogo({ url, name }: { url?: string; name: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!url || failed === url) return null;
  return (
    <div className="flex justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={name} decoding="async" onError={() => setFailed(url)}
        className="tc-a-pop block max-h-24 max-w-[45%] object-contain" style={{ filter: LOGO_GLOW }} />
    </div>
  );
}

/**
 * The logo where the venue placed it (`brandingLayout(b).logo`), floating over the screen:
 * a LOGO_BOX centred on the point and scaled — the same box the operator's preview drags.
 */
export function PlacedBrandLogo({ url, name, style }: { url?: string; name: string; style: CSSProperties }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!url || failed === url) return null;
  return (
    <div className="pointer-events-none z-20 flex items-center justify-center" style={{ ...LOGO_BOX, ...style }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={name} decoding="async" onError={() => setFailed(url)}
        className="tc-a-fade block h-full w-full object-contain" style={{ filter: LOGO_GLOW }} />
    </div>
  );
}

/** "Powered by The Q" → the site's home page in a new tab. Small and quiet, opening screen only. */
export function PoweredBy() {
  return (
    <a href="https://qr.playzones.app" target="_blank" rel="noopener" dir="ltr"
      className="mx-auto flex min-h-[32px] select-none items-center justify-center gap-1.5 text-[11px] transition-opacity hover:opacity-100"
      style={{ color: 'var(--tc-soft)', opacity: 0.75 }}>
      <span>Powered by</span>
      <span className="font-bold tracking-tight" style={{ color: 'var(--tc-cream)' }}>The Q</span>
      <svg width="10" height="11" viewBox="0 0 10 11" aria-hidden>
        <path d="M0 0.8 L10 5.5 L0 10.2 Z" fill="var(--tc-brass)" />
      </svg>
    </a>
  );
}
