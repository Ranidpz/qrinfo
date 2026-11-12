'use client';

// הקוד — the in-page camera (html5-qrcode, back camera), as in Q.Hunt.
// - Reports the RAW decoded text once, then holds until `paused` turns false again.
// - Stops the camera on unmount AND while the tab is hidden (a scanner left open in a
//   background tab must not keep the camera light on); restarts when the tab is back.
// - Camera denied / missing → `onCameraProblem`, the screen keeps the manual code entry.

import { useEffect, useId, useRef, useState } from 'react';
import type { Html5Qrcode } from 'html5-qrcode';

export type CameraProblem = 'denied' | 'missing' | 'other';

interface Props {
  onText(text: string): void;
  /** True while a scan is being checked — decoded frames are ignored. */
  paused: boolean;
  onCameraProblem(p: CameraProblem): void;
}

function classify(err: unknown): CameraProblem {
  const msg = String((err as { name?: string; message?: string })?.name || '') + ' ' + String((err as { message?: string })?.message || err || '');
  if (/NotAllowed|Permission|denied/i.test(msg)) return 'denied';
  if (/NotFound|no camera|Requested device not found|OverconstrainedError|NotReadable/i.test(msg)) return 'missing';
  return 'other';
}

export default function GnomeScanner({ onText, paused, onCameraProblem }: Props) {
  const rawId = useId();
  const elId = `tc-scan-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const pausedRef = useRef(paused);
  const onTextRef = useRef(onText);
  const onProblemRef = useRef(onCameraProblem);
  const lastRef = useRef<{ text: string; at: number } | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    pausedRef.current = paused;
    onTextRef.current = onText;
    onProblemRef.current = onCameraProblem;
  }, [paused, onText, onCameraProblem]);

  useEffect(() => {
    let cancelled = false;
    let scanner: Html5Qrcode | null = null;
    let starting: Promise<void> | null = null;

    const stop = async () => {
      if (starting) {
        try { await starting; } catch { /* ignore */ }
      }
      const s = scanner;
      scanner = null;
      if (!s) return;
      try {
        if (s.isScanning) await s.stop();
      } catch { /* already stopped */ }
      try { s.clear(); } catch { /* ignore */ }
      if (!cancelled) setLive(false);
    };

    const start = async () => {
      if (scanner || cancelled) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        onProblemRef.current('missing');
        return;
      }
      const { Html5Qrcode: Ctor } = await import('html5-qrcode');
      if (cancelled || document.visibilityState === 'hidden') return;
      const s = new Ctor(elId, { verbose: false });
      scanner = s;
      starting = s.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (w: number, h: number) => {
            const side = Math.floor(Math.min(w, h) * 0.7);
            return { width: side, height: side };
          },
          aspectRatio: 1,
        },
        (text) => {
          if (pausedRef.current) return;
          const last = lastRef.current;
          const now = Date.now();
          // The same QR is decoded ~10×/s: report it once, again only after a pause.
          if (last && last.text === text && now - last.at < 3000) return;
          lastRef.current = { text, at: now };
          onTextRef.current(text);
        },
        () => { /* no QR in this frame */ },
      ).then(() => {
        if (!cancelled) setLive(true);
      }).catch((err) => {
        scanner = null;
        if (!cancelled) onProblemRef.current(classify(err));
      }).finally(() => {
        starting = null;
      });
      await starting;
    };

    const onVis = () => {
      if (document.visibilityState === 'hidden') void stop();
      else void start();
    };
    document.addEventListener('visibilitychange', onVis);
    void start();
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      void stop();
    };
  }, [elId]);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-black" style={{ boxShadow: 'inset 0 0 0 2px var(--tc-line)' }}>
      <div id={elId} className="absolute inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
      {!live && (
        <div className="absolute inset-0 flex items-center justify-center text-lg" style={{ color: 'var(--tc-soft)' }}>
          פותחים את המצלמה…
        </div>
      )}
    </div>
  );
}
