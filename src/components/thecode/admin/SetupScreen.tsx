'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, MapPin, ScanLine, ShieldAlert, Wifi } from 'lucide-react';
import GnomeFigure, { describeGnome } from '@/components/thecode/GnomeFigure';
import type { ScreenProps } from './model';
import { timeAgo } from './helpers';
import { Button, Card, EmptyState, Toggle, cx } from './ui';

/**
 * Setup mode — the operator walks the venue with a phone, scans each gnome where it stands.
 * A scan proves the plate works AND that there is reception at that spot. Here the scan is
 * simulated with a button; wave 2 opens the camera and the /g/{code} route marks it.
 */
export default function SetupScreen({ state, actions, navigate, target, now }: ScreenProps) {
  const { config, gnomeStats } = state;
  const [remainingOnly, setRemainingOnly] = useState(false);
  const [scanning, setScanning] = useState<string | null>(null);
  const [justDone, setJustDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!target.gnomeId) return;
    window.setTimeout(() => document.getElementById(`setup-${target.gnomeId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
  }, [target]);

  const total = config.gnomes.length;
  const done = config.gnomes.filter((g) => g.verifiedOnSite).length;

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
                          <div className={cx('mt-0.5 flex items-center gap-1 text-sm', fresh ? 'text-green-700 dark:text-green-400' : 'text-text-secondary')}>
                            {fresh ? <Wifi size={14} aria-hidden /> : <BadgeCheck size={14} className="text-success" aria-hidden />}
                            {fresh ? 'אומת עכשיו — יש קליטה' : `אומת ${timeAgo(gnomeStats[g.id]?.verifiedAt, now)}`}
                          </div>
                        )}
                        {!g.isActive && <div className="mt-0.5 text-sm text-text-secondary">כבוי</div>}
                      </div>
                      {g.verifiedOnSite ? (
                        <Button size="sm" variant="ghost" icon={ScanLine} disabled={busy} onClick={() => scan(g.id)}>{busy ? 'סורקים…' : 'שוב'}</Button>
                      ) : (
                        <Button variant="primary" icon={ScanLine} disabled={busy || !!scanning} onClick={() => scan(g.id)}>
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
      <p className="mt-6 text-center text-sm text-text-secondary">בהדגמה הכפתור מדמה סריקה. בגרסה האמיתית המצלמה נפתחת.</p>
    </div>
  );
}
