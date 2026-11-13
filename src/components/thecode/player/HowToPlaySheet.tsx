'use client';

// "איך משחקים" — the short rules, as a bottom sheet inside the phone column.
// Pure overlay: opening / closing it never touches the game state. The lines come from
// the server (the operator's own, or the default built from the real rules) — shown as is.

import Link from 'next/link';
import { useEffect } from 'react';
import { useSfx } from './ui';
import { contrastOn, isHexColor, luminance } from '@/lib/thecode/contrast';

export type HowToPlayTheme = 'night' | 'light' | 'brand';

interface SheetLook { panel: string; text: string; soft: string; badgeBg: string; badgeFg: string; badgeRing: string; link: string; handle: string }

/**
 * Ready themes of the sheet (Rani 13.11.2026): 'night' = the game's look; 'light' = a light
 * card with dark text; 'brand' = the venue's button colour with contrasting text (no colour →
 * 'night'). Every theme keeps text, numbers and the guide link readable.
 */
export function howToPlayLook(theme: HowToPlayTheme | undefined, brandColor?: string): SheetLook {
  if (theme === 'light') {
    return { panel: 'linear-gradient(180deg,#FFF9EE,#F4EADA)', text: '#1B1B33', soft: 'rgba(27,27,51,.7)',
      badgeBg: '#F4B740', badgeFg: '#2A1600', badgeRing: 'rgba(122,71,16,.35)', link: '#8A4B00', handle: 'rgba(27,27,51,.2)' };
  }
  if (theme === 'brand' && isHexColor(brandColor)) {
    const fg = contrastOn(brandColor);
    const dark = fg !== '#FFFFFF';
    return { panel: brandColor, text: fg, soft: dark ? 'rgba(20,20,43,.75)' : 'rgba(255,255,255,.82)',
      badgeBg: dark ? 'rgba(20,20,43,.12)' : 'rgba(255,255,255,.2)', badgeFg: fg, badgeRing: dark ? 'rgba(20,20,43,.35)' : 'rgba(255,255,255,.55)',
      link: fg, handle: dark ? 'rgba(20,20,43,.25)' : 'rgba(255,255,255,.35)' };
  }
  return { panel: 'linear-gradient(180deg,#1E2766,#141A48)', text: 'var(--tc-cream)', soft: 'var(--tc-soft)',
    badgeBg: 'rgba(244,183,64,.18)', badgeFg: 'var(--tc-brass-hi)', badgeRing: 'rgba(244,183,64,.45)', link: 'var(--tc-brass-hi)', handle: 'rgba(255,255,255,.25)' };
}

/** A very light brand colour would make the brand sheet vanish into the page — keep a visible edge. */
const edgeFor = (theme: HowToPlayTheme | undefined, brandColor?: string) =>
  theme === 'brand' && isHexColor(brandColor) && luminance(brandColor) > 0.8 ? 'inset 0 0 0 1.5px rgba(20,20,43,.18), ' : '';

/** The public guide page (src/app/play/the-code/guide). */
const GUIDE_URL = '/play/the-code/guide';

interface Props {
  open: boolean;
  lines: string[];
  /** On the opening screen the family is about to start; inside the game they go back to it. */
  closeLabel: string;
  onClose(): void;
  theme?: HowToPlayTheme;
  /** The venue's button colour (TheCodeBranding.buttonColor) for the 'brand' theme. */
  brandColor?: string;
}

export function HowToPlayButton({ onClick, compact }: { onClick(): void; compact?: boolean }) {
  const sfx = useSfx();
  return (
    <button type="button" onClick={() => { sfx('tap'); onClick(); }}
      className={`tc-chip min-h-[44px] ${compact ? 'w-11 justify-center !px-0' : ''}`}
      aria-label="איך משחקים?">
      <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full text-sm font-black"
        style={{ background: 'var(--tc-brass)', color: '#2A1600' }}>?</span>
      {!compact && <span>איך משחקים?</span>}
    </button>
  );
}

export default function HowToPlaySheet({ open, lines, closeLabel, onClose, theme, brandColor }: Props) {
  const t = howToPlayLook(theme, brandColor);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-labelledby="tc-howto-title">
      <button type="button" aria-label="סגירה" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="tc-a-rise relative flex max-h-[88%] flex-col rounded-t-[28px] pt-3"
        style={{ background: t.panel, color: t.text, boxShadow: `${edgeFor(theme, brandColor)}0 -10px 40px rgba(0,0,0,.5)` }}>
        <div className="mx-auto mb-3 h-1.5 w-12 shrink-0 rounded-full" style={{ background: t.handle }} aria-hidden />
        <h2 id="tc-howto-title" className="tc-display mb-3 shrink-0 px-5 text-3xl">איך משחקים</h2>
        <ol className="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain px-5 pb-2">
          {lines.map((line, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="tc-num flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg"
                style={{ background: t.badgeBg, color: t.badgeFg, boxShadow: `inset 0 0 0 1.5px ${t.badgeRing}` }}>
                {i + 1}
              </span>
              <p className="pt-0.5 text-lg leading-snug">{line}</p>
            </li>
          ))}
        </ol>
        <div className="flex shrink-0 flex-col gap-2 px-5 pb-7 pt-3">
          {/* Full guide in a new tab, so the game screen stays where it was. */}
          <Link href={GUIDE_URL} target="_blank" rel="noopener"
            className="flex min-h-[44px] items-center justify-center gap-1.5 text-base font-bold underline-offset-4 hover:underline"
            style={{ color: t.link }}>
            למדריך המלא
            <span aria-hidden>←</span>
          </Link>
          <button type="button" className="tc-btn tc-btn-primary w-full text-xl" onClick={onClose}>{closeLabel}</button>
        </div>
      </div>
    </div>
  );
}
