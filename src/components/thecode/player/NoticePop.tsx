'use client';

// קוד הגמדים — a message that must be READ (a wrong scan, a name that's taken) floats over the
// screen near the top instead of sitting under the camera / form, where it was below the fold on a
// phone (Rani 24.11.2026). Closed by "הבנתי", the ✕ or a tap outside. `fixed`, so the page's
// scroll position never hides it.

import { useEffect, useRef } from 'react';

interface Props {
  /** null / '' = closed */
  text: string | null | undefined;
  onClose(): void;
  title?: string;
  icon?: string;
}

export default function NoticePop({ text, onClose, title = 'רגע…', icon = '🧐' }: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    if (!text) return;
    btnRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [text]);
  if (!text) return null;
  return (
    <div dir="rtl" className="fixed inset-0 z-50 flex justify-center px-4" role="alertdialog" aria-modal="true" aria-label={title}
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + var(--pwa-banner-h, 0px) + 18px)' }}>
      <button type="button" aria-label="סגירה" tabIndex={-1} className="tc-a-fade absolute inset-0 bg-black/55" onClick={() => closeRef.current()} />
      <div key={text} className="tc-a-drop relative h-fit w-full max-w-[440px] rounded-3xl p-5 text-center"
        style={{ background: 'linear-gradient(180deg, #232C70, #151B4C)', boxShadow: '0 18px 50px rgba(0,0,0,.55), inset 0 0 0 2px var(--tc-coral)' }}>
        <button type="button" aria-label="סגירה" onClick={() => closeRef.current()}
          className="absolute end-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-xl" style={{ color: 'var(--tc-soft)' }}>✕</button>
        <div aria-hidden className="text-4xl">{icon}</div>
        <p className="tc-display mt-1 text-2xl">{title}</p>
        <p className="mt-2 text-lg font-bold leading-snug" style={{ color: 'var(--tc-cream)' }}>{text}</p>
        <button ref={btnRef} type="button" className="tc-btn tc-btn-primary mt-4 w-full text-xl" onClick={() => closeRef.current()}>הבנתי</button>
      </div>
    </div>
  );
}
