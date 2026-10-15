'use client';

// Social Wall presentational helpers. All at MODULE scope on purpose: a component declared inside
// another one gets a new identity every render, React remounts it and its entrance animation
// replays (the QBet "jumping flags" lesson).

import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export const SW_STYLE = `
@keyframes sw-fade-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes sw-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes sw-scale-in { from { opacity: 0; transform: scale(.94); } to { opacity: 1; transform: none; } }
@keyframes sw-sheet { from { transform: translateY(100%); } to { transform: none; } }
@keyframes sw-heart {
  0% { opacity: 0; transform: scale(.2); }
  15% { opacity: .96; transform: scale(1.18); }
  30% { transform: scale(.94); }
  45% { transform: scale(1); }
  80% { opacity: .96; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.08) translateY(-14px); }
}
@keyframes sw-pop { 0% { transform: scale(1); } 35% { transform: scale(1.32); } 65% { transform: scale(.92); } 100% { transform: scale(1); } }
@keyframes sw-shimmer { 0% { background-position: -460px 0; } 100% { background-position: 460px 0; } }
@keyframes sw-kenburns { from { transform: scale(1.06); } to { transform: scale(1.16) translateY(-2%); } }
@keyframes sw-progress { from { background-position: 0 0; } to { background-position: 40px 0; } }
.sw-root { -webkit-tap-highlight-color: transparent; }
.sw-enter { animation: sw-fade-up .5s cubic-bezier(.2,.8,.2,1) both; }
.sw-fade { animation: sw-fade .35s ease-out both; }
.sw-scale-in { animation: sw-scale-in .32s cubic-bezier(.2,.8,.2,1) both; }
.sw-sheet { animation: sw-sheet .38s cubic-bezier(.2,.9,.25,1) both; }
.sw-heart { animation: sw-heart .9s ease-out both; }
.sw-pop { animation: sw-pop .42s cubic-bezier(.2,.8,.2,1); }
.sw-kenburns { animation: sw-kenburns 14s ease-in-out infinite alternate; }
.sw-skeleton {
  background: linear-gradient(90deg, #eef0f4 0, #f7f8fa 60px, #eef0f4 120px);
  background-size: 920px 100%;
  animation: sw-shimmer 1.3s linear infinite;
}
.sw-progress-stripes {
  background-image: linear-gradient(45deg, rgba(255,255,255,.25) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.25) 50%, rgba(255,255,255,.25) 75%, transparent 75%);
  background-size: 40px 40px;
  animation: sw-progress .8s linear infinite;
}
.sw-scroll { -webkit-overflow-scrolling: touch; overscroll-behavior-y: contain; scrollbar-width: none; }
.sw-scroll::-webkit-scrollbar { display: none; }
.sw-chips { scrollbar-width: none; }
.sw-chips::-webkit-scrollbar { display: none; }
.sw-img { transition: opacity .45s ease; }
@media (prefers-reduced-motion: reduce) {
  .sw-root *, .sw-root *::before, .sw-root *::after {
    animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important;
  }
}
`;

const AVATAR_COLORS = ['#7c3aed', '#2563eb', '#db2777', '#ea580c', '#059669', '#0891b2', '#9333ea', '#dc2626'];

export function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const chars = parts.length === 1 ? Array.from(parts[0]).slice(0, 2) : [Array.from(parts[0])[0], Array.from(parts[parts.length - 1])[0]];
  return chars.join('').toUpperCase();
}

export function Avatar({ name, color, size = 40 }: { name: string; color?: string; size?: number }) {
  const bg = color || colorFor(name);
  return (
    <div
      className="shrink-0 rounded-full p-[2px]"
      style={{ width: size, height: size, background: `linear-gradient(135deg, var(--sw-primary), var(--sw-secondary))` }}
    >
      <div
        className="w-full h-full rounded-full border-2 border-white flex items-center justify-center text-white font-bold select-none"
        style={{ background: bg, fontSize: Math.round(size * 0.36) }}
        aria-hidden
      >
        {initials(name)}
      </div>
    </div>
  );
}

export function timeAgo(ts: number, locale: 'he' | 'en', justNow: string): string {
  const diff = Math.round((ts - Date.now()) / 1000);
  if (diff > -45) return justNow;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  const abs = Math.abs(diff);
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

export function PrimaryButton({
  children, onClick, disabled, loading, type = 'button', className = '',
}: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; loading?: boolean; type?: 'button' | 'submit'; className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`relative w-full min-h-[52px] rounded-2xl px-6 text-white text-[17px] font-bold shadow-lg shadow-black/10 active:scale-[.98] transition-transform disabled:opacity-60 disabled:active:scale-100 flex items-center justify-center gap-2 ${className}`}
      style={{ background: 'linear-gradient(135deg, var(--sw-primary), var(--sw-secondary))' }}
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, className = '' }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full min-h-[48px] rounded-2xl px-6 bg-white text-gray-900 text-base font-semibold border border-gray-200 shadow-sm active:scale-[.98] transition-transform ${className}`}
    >
      {children}
    </button>
  );
}

/** A labelled form row. `group` = the content is a set of buttons (chips): a <label> around them
 *  would forward every tap on the label text or the gaps to the FIRST button. */
export function Field({ label, children, error, group = false }: { label: string; children: ReactNode; error?: string | null; group?: boolean }) {
  const body = (
    <>
      <span className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</span>
      {children}
      {error && <span className="block text-sm text-red-600 mt-1.5 sw-fade">{error}</span>}
    </>
  );
  return group ? (
    <div role="group" aria-label={label}>{body}</div>
  ) : (
    <label className="block">{body}</label>
  );
}

export const inputClass =
  'w-full min-h-[50px] rounded-xl bg-gray-50 border border-gray-200 px-4 text-[17px] text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-[var(--sw-primary)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--sw-primary)_15%,transparent)] transition';

export function PoweredBy({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400 select-none" dir="ltr">
      <span>{label}</span>
      <span className="font-bold text-gray-600 tracking-tight">Playzone</span>
      <svg width="10" height="11" viewBox="0 0 10 11" aria-hidden>
        <path d="M0 0.8 L10 5.5 L0 10.2 Z" fill="url(#swpz)" />
        <defs>
          <linearGradient id="swpz" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2563eb" />
            <stop offset="1" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`animate-spin text-[var(--sw-primary)] ${className}`} />;
}

export function PostSkeleton() {
  return (
    <div className="bg-white">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-10 h-10 rounded-full sw-skeleton" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-28 rounded sw-skeleton" />
          <div className="h-2.5 w-16 rounded sw-skeleton" />
        </div>
      </div>
      <div className="aspect-[4/5] w-full sw-skeleton" />
      <div className="px-4 py-3 space-y-2">
        <div className="h-3 w-20 rounded sw-skeleton" />
        <div className="h-3 w-48 rounded sw-skeleton" />
      </div>
    </div>
  );
}
