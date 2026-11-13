'use client';

// The team's symbol on the register screen: ONE row that scrolls sideways (scroll-snap),
// so it never takes much height. Optional selfie (demo, awaiting Rani's approval):
// a camera tile first in the row → a short consent sheet → front camera → crop → the
// photo becomes the team's symbol. In the demo the photo stays in this browser's memory
// (a data: URL in React state) and is never uploaded anywhere.

import { useEffect, useRef, useState } from 'react';
import SquareImageCropper from '@/components/viewer/SquareImageCropper';
import { SELFIE_LIMITS } from '@/lib/thecode/selfie';
import { Avatar, isPhotoAvatar } from './Avatar';
import type { SelfieShot } from './types';
import { useSfx } from './ui';

export const EMOJIS = ['🦁', '🐯', '🦊', '🐼', '🦉', '🐬', '🐙', '🦄', '🐢', '🐝', '🚀', '⚡'];
const TILE = 60;

function CameraIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

interface RowProps {
  value: string;
  onChange(v: string): void;
  /** Show the camera tile first in the row. */
  selfie: boolean;
  /** The team's own photo, when it took one (kept even when an emoji is picked after it). */
  photo: string | null;
  onCamera(): void;
}

/** One sideways row of symbol tiles; the chosen one is lifted, the edges fade to show there is more. */
export function SymbolRow({ value, onChange, selfie, photo, onCamera }: RowProps) {
  const sfx = useSfx();
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = rowRef.current?.querySelector<HTMLElement>('[data-on="true"]');
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [value]);

  const tileStyle = (on: boolean): React.CSSProperties => (on
    ? { width: TILE, height: TILE, background: 'rgba(244,183,64,.22)', boxShadow: 'inset 0 0 0 3px var(--tc-brass), 0 6px 18px rgba(244,183,64,.35)', transform: 'scale(1.1)' }
    : { width: TILE, height: TILE, background: 'var(--tc-panel)', boxShadow: 'inset 0 0 0 1.5px var(--tc-line)' });

  return (
    <div className="-mx-5">
      <div ref={rowRef} dir="rtl" role="radiogroup" aria-label="הסמל שלכם"
        className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain px-5 py-2"
        style={{
          scrollPaddingInline: 20,
          WebkitMaskImage: 'linear-gradient(to left, transparent 0, #000 22px, #000 calc(100% - 34px), transparent 100%)',
          maskImage: 'linear-gradient(to left, transparent 0, #000 22px, #000 calc(100% - 34px), transparent 100%)',
        }}>
        {selfie && (
          <button type="button" role="radio" aria-checked={!!photo && value === photo} data-on={!!photo && value === photo}
            aria-label={photo ? 'הסלפי שלכם. הקישו שוב כדי לצלם מחדש' : 'צלמו סלפי כסמל'}
            onClick={() => {
              sfx('tap');
              if (photo && value !== photo) onChange(photo);
              else onCamera();
            }}
            className="relative flex shrink-0 snap-center items-center justify-center rounded-full transition-transform active:scale-90"
            style={{ ...tileStyle(!!photo && value === photo), color: 'var(--tc-brass-hi)' }}>
            {photo ? <Avatar value={photo} size={TILE - 8} /> : <CameraIcon />}
            {photo && (
              <span aria-hidden className="absolute -bottom-1 -left-1 flex h-6 w-6 items-center justify-center rounded-full text-xs"
                style={{ background: 'var(--tc-brass)', color: '#2A1600' }}>↻</span>
            )}
          </button>
        )}
        {EMOJIS.map((e) => (
          <button key={e} type="button" role="radio" aria-checked={value === e} data-on={value === e} aria-label={`סמל ${e}`}
            onClick={() => { sfx('key'); onChange(e); }}
            className="flex shrink-0 snap-center items-center justify-center rounded-2xl text-3xl transition-transform active:scale-90"
            style={tileStyle(value === e)}>
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

interface SelfieFlowProps {
  /** 'consent' = the short "your photo on the big screen" sheet. */
  step: 'consent' | null;
  /** Retention in days, quoted in the consent line (TheCodeSelfieSettings.retentionDays). */
  days: number;
  onCancel(): void;
  onPhoto(shot: SelfieShot): void;
}

/** Read a cropped blob into a data: URL (stays in memory, survives the demo's JSON state copies). */
function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Consent sheet → front camera (file input with capture) → SquareImageCropper → data URL. */
export function SelfieFlow({ step, days, onCancel, onPhoto }: SelfieFlowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState(false);

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" capture="user" className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] || null;
          e.target.value = '';
          if (f) { setError(false); setFile(f); }
        }} />

      {step === 'consent' && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-labelledby="tc-selfie-title">
          <button type="button" aria-label="סגירה" className="absolute inset-0 bg-black/60" onClick={onCancel} />
          <div className="tc-a-rise relative rounded-t-[28px] px-5 pb-8 pt-3" style={{ background: 'linear-gradient(180deg,#1E2766,#141A48)', boxShadow: '0 -10px 40px rgba(0,0,0,.5)' }}>
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/25" aria-hidden />
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'rgba(244,183,64,.18)', color: 'var(--tc-brass-hi)' }}><CameraIcon /></span>
              <h2 id="tc-selfie-title" className="tc-display text-3xl leading-tight">סלפי של הקבוצה</h2>
            </div>
            {/* Final wording is Rani's call — this is the demo draft. */}
            <ul className="mb-5 flex flex-col gap-2 text-lg leading-snug">
              <li>📺 התמונה תוצג על המסך במקום ותימחק אחרי {days === 1 ? 'יום אחד' : <><span className="tc-num">{days}</span> ימים</>}.</li>
              <li>👨‍👧 אם מצולמים ילדים, הורה מאשר.</li>
              <li>🙂 לא חובה. אפשר תמיד לבחור סמל במקום.</li>
            </ul>
            <button type="button" className="tc-btn tc-btn-primary w-full text-xl"
              onClick={() => { onCancel(); inputRef.current?.click(); }}>
              מאשרים, מצלמים סלפי
            </button>
            <button type="button" className="tc-btn tc-btn-ghost mt-3 w-full" onClick={onCancel}>בלי תמונה</button>
          </div>
        </div>
      )}

      {file && (
        <div dir="rtl">
          <SquareImageCropper
            file={file}
            outputSize={SELFIE_LIMITS.sizePx}
            quality={0.8}
            labels={{ title: 'מסדרים את הסלפי', hint: 'הזיזו והגדילו עם האצבעות. הסמל יוצג בעיגול.', confirm: 'זה הסמל שלנו', cancel: 'ביטול', processing: 'מכינים…' }}
            onCancel={() => setFile(null)}
            onConfirm={async (blob) => {
              try {
                // A data: URL (not an object URL): it survives the demo's JSON state copies
                // and never needs revoking; it is only ever shown on this phone.
                onPhoto({ blob, preview: await toDataUrl(blob) });
              } catch {
                setError(true);
              }
              setFile(null);
            }}
          />
        </div>
      )}
      {error && <p role="alert" className="sr-only">הצילום לא הצליח. נסו שוב.</p>}
    </>
  );
}

export { isPhotoAvatar };
