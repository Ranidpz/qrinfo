'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { BadgeCheck, Camera, CircleAlert, MapPin, ScanLine, ShieldAlert, Wifi, X } from 'lucide-react';
import GnomeFigure, { describeGnome } from '@/components/thecode/GnomeFigure';
import type { TheCodeGnome } from '@/types/thecode';
import type { CameraProblem } from '@/components/thecode/live/GnomeScanner';
import { normalizeManualCode, parseGnomeQr } from '@/components/thecode/live/gnomeCode';
import type { ScreenProps } from './model';
import { timeAgo } from './helpers';
import { Button, Card, EmptyState, Field, Toggle, cx, Tip } from './ui';
import { TIPS } from './GnomesScreen';

// The camera is only pulled in when the operator opens it (html5-qrcode is heavy).
const GnomeScanner = dynamic(() => import('@/components/thecode/live/GnomeScanner'), { ssr: false });

/** How long a result stays on screen before the camera looks again. */
const SCAN_PAUSE_MS = 1500;

/**
 * Setup mode — the operator walks the venue with a phone, scans each gnome where it stands.
 * A scan proves the plate works AND that there is reception at that spot. Here the scan is
 * simulated with a button; wave 2 opens the camera and the /g/{code} route marks it.
 */
export default function SetupScreen({ state, actions, navigate, target, now, links }: ScreenProps) {
  const { config, gnomeStats } = state;
  const [remainingOnly, setRemainingOnly] = useState(false);
  const [scanning, setScanning] = useState<string | null>(null);
  const [justDone, setJustDone] = useState<Set<string>>(new Set());
  // The demo has no printed plates to scan, so there the button keeps simulating a scan.
  const demo = !links;
  const [camera, setCamera] = useState<{ expectId: string | null } | null>(null);

  useEffect(() => {
    if (!target.gnomeId) return;
    window.setTimeout(() => document.getElementById(`setup-${target.gnomeId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
  }, [target]);

  const total = config.gnomes.length;
  const done = config.gnomes.filter((g) => g.verifiedOnSite).length;

  /** A scanned QR or a typed code → the gnome it belongs to, or null. */
  const gnomeOfCode = useCallback((text: string): TheCodeGnome | null => {
    const fromQr = parseGnomeQr(text);
    const typed = normalizeManualCode(text);
    const candidates = [fromQr, typed].filter((c): c is string => !!c);
    for (const c of candidates) {
      const hit = config.gnomes.find((g) => g.code === c || g.manualCode.toLowerCase() === c.toLowerCase());
      if (hit) return hit;
    }
    return null;
  }, [config.gnomes]);

  const markVerified = useCallback((id: string) => {
    actions.verifyGnome(id);
    setJustDone((s) => new Set(s).add(id));
  }, [actions]);

  const scan = (id: string) => {
    setScanning(id);
    window.setTimeout(() => {
      actions.verifyGnome(id);
      setScanning(null);
      setJustDone((s) => new Set(s).add(id));
    }, 700);
  };

  if (!total) {
    return (
      <div className="mx-auto max-w-md">
        <EmptyState icon={ScanLine} title="אין גמדים להתקנה" text="הפיקו גמדים והדפיסו להם לוחיות, ואז חזרו לכאן כדי לסרוק כל גמד במקום שלו." action={<Button variant="primary" onClick={() => navigate({ tab: 'gnomes' })}>לגמדים</Button>} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-title">מצב התקנה</h1>
        <p className="mt-1 text-text-secondary">עברו בין המקומות, וסרקו כל גמד במקום שבו הוא עומד.</p>
      </div>

      <Card className="mb-6 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-3xl font-bold tabular-nums" dir="ltr">{done}/{total}</span>
          <span className="text-text-secondary">{done === total ? 'כל הגמדים אומתו' : `נשארו ${total - done}`}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-hover">
          <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(done / total) * 100}%` }} />
        </div>
        <label className="mt-4 flex items-center justify-between gap-4">
          <span className="text-sm">הציגו רק מה שנשאר</span>
          <Toggle checked={remainingOnly} onChange={setRemainingOnly} label="הציגו רק מה שנשאר" size="sm" />
        </label>
        {!demo && done < total && (
          <Button variant="primary" icon={Camera} className="mt-4 w-full" onClick={() => setCamera({ expectId: null })}>
            פתחו מצלמה וסרקו
          </Button>
        )}
      </Card>

      <div className="space-y-6">
        {config.spots.map((spot) => {
          const here = config.gnomes
            .filter((g) => g.spotId === spot.id)
            .filter((g) => !remainingOnly || !g.verifiedOnSite || justDone.has(g.id));
          if (!here.length) return null;
          const exact = [...spot.hints].reverse().find((h) => h.trim());
          return (
            <section key={spot.id}>
              <div className="mb-2 px-1">
                <h2 className="flex items-center gap-2 font-semibold">
                  <MapPin size={16} className="text-text-secondary" aria-hidden />
                  {spot.name}
                </h2>
                {exact && <p className="text-sm text-text-secondary">{exact}</p>}
                {spot.safetyNote && (
                  <p className="mt-1 flex items-center gap-1 text-sm text-amber-700 dark:text-amber-400">
                    <ShieldAlert size={14} aria-hidden />
                    {spot.safetyNote}
                  </p>
                )}
              </div>
              <Card className="divide-y divide-border">
                {here.map((g) => {
                  const fresh = justDone.has(g.id);
                  const busy = scanning === g.id;
                  return (
                    <div
                      key={g.id}
                      id={`setup-${g.id}`}
                      className={cx('flex scroll-mt-32 items-center gap-3 p-3', target.gnomeId === g.id && !g.verifiedOnSite && 'bg-accent/5')}
                    >
                      <GnomeFigure bodyColor={g.bodyColor} hatColor={g.hatColor} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">גמד {g.number}</div>
                        <div className="truncate text-sm text-text-secondary">{describeGnome(g.bodyColor, g.hatColor)}</div>
                        {g.verifiedOnSite && (
                          <Tip text={TIPS.verified}>
                            <span className={cx('mt-0.5 flex items-center gap-1 text-sm', fresh ? 'text-green-700 dark:text-green-400' : 'text-text-secondary')}>
                              {fresh ? <Wifi size={14} aria-hidden /> : <BadgeCheck size={14} className="text-success" aria-hidden />}
                              {fresh ? 'אומת עכשיו — יש קליטה' : `אומת ${timeAgo(gnomeStats[g.id]?.verifiedAt, now)}`}
                            </span>
                          </Tip>
                        )}
                        {!g.verifiedOnSite && (
                          <Tip text={TIPS.notVerified}>
                            <span className="mt-0.5 text-sm text-text-secondary">לא אומת</span>
                          </Tip>
                        )}
                        {!g.isActive && (
                          <Tip text={TIPS.toggle}>
                            <span className="mt-0.5 block text-sm text-text-secondary">כבוי</span>
                          </Tip>
                        )}
                      </div>
                      {g.verifiedOnSite ? (
                        <Button size="sm" variant="ghost" icon={ScanLine} disabled={busy}
                          onClick={() => (demo ? scan(g.id) : setCamera({ expectId: g.id }))}>{busy ? 'סורקים…' : 'שוב'}</Button>
                      ) : (
                        <Button variant="primary" icon={ScanLine} disabled={busy || !!scanning}
                          onClick={() => (demo ? scan(g.id) : setCamera({ expectId: g.id }))}>
                          {busy ? 'סורקים…' : 'סרקו'}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </Card>
            </section>
          );
        })}
      </div>
      <p className="mt-6 text-center text-sm text-text-secondary">
        {demo
          ? 'בהדגמה הכפתור מדמה סריקה. במערכת האמיתית נפתחת המצלמה וסורקים את הלוחית עצמה.'
          : 'הסריקה מוכיחה שהלוחית עובדת, שיש קליטה בנקודה, ושהגמד עומד במקום שרשמתם.'}
      </p>

      {camera && (
        <ScanSheet
          expect={config.gnomes.find((g) => g.id === camera.expectId) || null}
          gnomeOfCode={gnomeOfCode}
          onVerified={markVerified}
          onClose={() => setCamera(null)}
        />
      )}
    </div>
  );
}

/** The camera, open until the operator closes it: every plate scanned is verified on the spot. */
function ScanSheet({
  expect, gnomeOfCode, onVerified, onClose,
}: {
  expect: TheCodeGnome | null;
  gnomeOfCode: (text: string) => TheCodeGnome | null;
  onVerified: (id: string) => void;
  onClose: () => void;
}) {
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [problem, setProblem] = useState<CameraProblem | null>(null);
  const [typed, setTyped] = useState('');
  const [count, setCount] = useState(0);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);

  const handle = useCallback((text: string) => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    setPaused(true);
    const g = gnomeOfCode(text);
    if (!g) {
      setResult({ ok: false, text: 'הקוד הזה לא שייך להרפתקה הזו.' });
    } else {
      onVerified(g.id);
      setCount((c) => c + 1);
      setResult({
        ok: true,
        text: expect && expect.id !== g.id
          ? `סרקתם את גמד ${g.number}, לא את גמד ${expect.number}. אימתנו את גמד ${g.number}.`
          : `גמד ${g.number} אומת.`,
      });
    }
    window.setTimeout(() => { pausedRef.current = false; setPaused(false); }, SCAN_PAUSE_MS);
  }, [expect, gnomeOfCode, onVerified]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label="סריקת גמד">
      <div className="flex items-center justify-between gap-3 p-4 text-white">
        <div className="min-w-0">
          <p className="font-semibold">{expect ? `סרקו את גמד ${expect.number}` : 'סרקו גמד'}</p>
          <p className="text-sm text-white/70">{count ? `אומתו ${count} בסריקה הזו` : 'כוונו את המצלמה אל הלוחית'}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="סגירה"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
          <X size={20} aria-hidden />
        </button>
      </div>

      <div className="relative mx-auto w-full max-w-md flex-1 overflow-hidden px-4">
        {!problem && <GnomeScanner onText={handle} paused={paused} onCameraProblem={setProblem} />}
        {problem && (
          <p className="flex items-start gap-2 rounded-xl bg-white/10 p-3 text-sm text-white">
            <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
            {problem === 'denied'
              ? 'הדפדפן חוסם את המצלמה. אשרו גישה למצלמה, או הקלידו את הקוד שמתחת ל-QR.'
              : 'לא מצאנו מצלמה במכשיר. הקלידו את הקוד שמתחת ל-QR.'}
          </p>
        )}
      </div>

      <div className="mx-auto w-full max-w-md space-y-3 p-4">
        {result && (
          <p className={cx('rounded-xl px-3 py-2 text-center font-semibold', result.ok ? 'bg-success/20 text-green-200' : 'bg-danger/20 text-red-200')}>
            {result.text}
          </p>
        )}
        <Field label="או הקלידו את הקוד שמתחת ל-QR">
          <div className="flex gap-2">
            <input className="input flex-1" value={typed} onChange={(e) => setTyped(e.target.value)} dir="ltr"
              onKeyDown={(e) => { if (e.key === 'Enter' && typed.trim()) { handle(typed); setTyped(''); } }} />
            <Button variant="primary" disabled={!typed.trim()} onClick={() => { handle(typed); setTyped(''); }}>בדקו</Button>
          </div>
        </Field>
      </div>
    </div>
  );
}
