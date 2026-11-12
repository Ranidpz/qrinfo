'use client';

// The venue's brand on the OPENING screen only (register / recover / loading in front of it):
// a full-bleed photo with a scrim strong enough for white text on any photo, the venue logo,
// and a quiet "Powered by Playzone". Once the family is in, the game keeps its own look.
// Plain <img> (R2 URLs); every image may still be loading or may fail — the screen never
// waits for it and falls back to the game's night background.

import { useState } from 'react';

/** Full-bleed venue photo + scrim, absolutely filling the nearest positioned parent. */
export function BrandBackdrop({ url }: { url?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!url || failed === url) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" decoding="async" onError={() => setFailed(url)}
        className="tc-a-fade absolute inset-0 h-full w-full object-cover object-center" />
      <div className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(6,9,30,.6) 0%, rgba(6,9,30,.45) 18%, rgba(6,9,30,.8) 40%, rgba(6,9,30,.93) 65%, rgba(6,9,30,.97) 100%)' }} />
    </div>
  );
}

/** The venue logo, centred; hides itself when the image is broken. */
export function BrandLogo({ url, name }: { url?: string; name: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!url || failed === url) return null;
  return (
    <div className="flex justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={name} decoding="async" onError={() => setFailed(url)}
        className="tc-a-pop block max-h-24 max-w-[45%] object-contain"
        style={{ filter: 'drop-shadow(0 0 1px rgba(255,255,255,.9)) drop-shadow(0 0 8px rgba(255,255,255,.45)) drop-shadow(0 4px 14px rgba(0,0,0,.55))' }} />
    </div>
  );
}

/** "Powered by Playzone" — small and quiet, opening screen only. */
export function PoweredBy() {
  return (
    <a href="/" target="_blank" rel="noopener" dir="ltr"
      className="mx-auto flex min-h-[32px] select-none items-center justify-center gap-1.5 text-[11px] transition-opacity hover:opacity-100"
      style={{ color: 'var(--tc-soft)', opacity: 0.75 }}>
      <span>Powered by</span>
      <span className="font-bold tracking-tight" style={{ color: 'var(--tc-cream)' }}>Playzone</span>
      <svg width="10" height="11" viewBox="0 0 10 11" aria-hidden>
        <path d="M0 0.8 L10 5.5 L0 10.2 Z" fill="var(--tc-brass)" />
      </svg>
    </a>
  );
}
