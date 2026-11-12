'use client';

// "סרקו גמד": the camera inside the game page + the short code printed under the QR.
// The manual code is always offered — it is also the way in when the camera is denied
// or missing. In the demo (`camera: false`) a simulated viewfinder stands in for the camera.

import { useEffect, useState } from 'react';
import GnomeScanner, { type CameraProblem } from '../live/GnomeScanner';
import { normalizeManualCode, parseGnomeQr } from '../live/gnomeCode';
import { HintCard, ScreenBody, useSfx } from './ui';
import type { ScannerView } from './types';

const NOT_OURS = 'זה לא גמד של המשחק. סרקו את הקוד שעל הגמד עצמו.';

const PROBLEM_TEXT: Record<CameraProblem, string> = {
  denied: 'אין הרשאה למצלמה. אפשר לאשר אותה בהגדרות הדפדפן, או להקליד את הקוד שמתחת לגמד.',
  missing: 'לא מצאנו מצלמה בטלפון הזה. הקלידו את הקוד שמתחת לגמד.',
  other: 'המצלמה לא נפתחה. הקלידו את הקוד שמתחת לגמד.',
};

/** Corner brackets + a moving scan line — drawn over the camera and the demo viewfinder alike. */
function Frame() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-[15%]" style={{ ['--tc-scan-h' as string]: '100%' }}>
      {[
        'right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl',
        'left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl',
        'right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl',
        'left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl',
      ].map((c) => <span key={c} className={`absolute h-10 w-10 ${c}`} style={{ borderColor: 'var(--tc-brass)' }} />)}
      <span className="tc-scanline absolute inset-x-2 top-0 h-[3px] rounded-full" style={{ background: 'var(--tc-mint)', boxShadow: '0 0 14px var(--tc-mint)' }} />
    </div>
  );
}

function SimulatedViewfinder() {
  return (
    <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-3xl"
      style={{ background: 'radial-gradient(circle at 50% 40%, #2A3366, #0A0E26)', boxShadow: 'inset 0 0 0 2px var(--tc-line)' }}>
      <p className="max-w-[60%] text-center text-base" style={{ color: 'var(--tc-soft)' }}>
        מצלמה מדומה. סרקו גמד מסרגל ההדגמה
      </p>
    </div>
  );
}

interface Props {
  scanner: ScannerView;
  onScanCode(code: string): void;
  onClose(): void;
}

export default function ScannerScreen({ scanner, onScanCode, onClose }: Props) {
  const sfx = useSfx();
  const [localError, setLocalError] = useState<string | null>(null);
  const [problem, setProblem] = useState<CameraProblem | null>(null);
  const [typing, setTyping] = useState(false);
  const [manual, setManual] = useState('');

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const showCamera = scanner.camera && !problem;
  const manualOpen = typing || !!problem;
  const error = localError || scanner.error;

  const onText = (text: string) => {
    if (scanner.busy) return;
    const code = parseGnomeQr(text);
    if (!code) {
      sfx('warn');
      setLocalError(NOT_OURS);
      return;
    }
    sfx('scan');
    setLocalError(null);
    onScanCode(code);
  };

  const submitManual = () => {
    const code = normalizeManualCode(manual);
    if (!code || scanner.busy) return;
    sfx('tap');
    setLocalError(null);
    onScanCode(code);
  };

  return (
    <ScreenBody className="items-stretch gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="tc-display text-4xl">סרקו גמד</h2>
        <button type="button" className="tc-chip min-h-[44px]" onClick={() => { sfx('tap'); onClose(); }}>חזרה</button>
      </div>
      <p className="text-lg" style={{ color: 'var(--tc-soft)' }}>כוונו את המצלמה לקוד שעל הגמד</p>

      {!problem && (
        <div className="relative">
          {showCamera ? <GnomeScanner onText={onText} paused={scanner.busy} onCameraProblem={setProblem} /> : <SimulatedViewfinder />}
          <Frame />
          {scanner.busy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl bg-[#0B1030]/75">
              <span aria-hidden className="tc-spin h-12 w-12 rounded-full border-4 border-white/20 border-t-[var(--tc-brass)]" />
              <span className="tc-display text-2xl">בודקים את הגמד…</span>
            </div>
          )}
        </div>
      )}

      <div aria-live="polite">
        {problem && <HintCard tone="brass" className="text-lg">{PROBLEM_TEXT[problem]}</HintCard>}
        {error && <p role="alert" className="tc-a-shake mt-2 text-center text-lg font-bold" style={{ color: 'var(--tc-coral)' }}>{error}</p>}
      </div>

      {manualOpen ? (
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); submitManual(); }}>
          <label className="block">
            <span className="tc-display mb-2 block text-xl">הקוד שמתחת לגמד</span>
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value.slice(0, 20))}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              enterKeyHint="go"
              dir="ltr"
              placeholder="123"
              className="tc-num h-16 w-full rounded-2xl bg-black/30 text-center text-3xl tracking-[.2em] outline-none placeholder:text-white/25 focus:ring-4 focus:ring-[var(--tc-brass)]"
              style={{ boxShadow: 'inset 0 0 0 1.5px var(--tc-line)' }}
            />
          </label>
          <button type="submit" className="tc-btn tc-btn-primary w-full text-xl" disabled={!normalizeManualCode(manual) || scanner.busy}>
            {scanner.busy ? 'בודקים…' : 'בדקו את הגמד'}
          </button>
        </form>
      ) : (
        <button type="button" className="tc-btn tc-btn-ghost mt-auto w-full" onClick={() => { sfx('tap'); setTyping(true); }}>
          המצלמה לא עובדת? הקלידו את הקוד
        </button>
      )}
    </ScreenBody>
  );
}
