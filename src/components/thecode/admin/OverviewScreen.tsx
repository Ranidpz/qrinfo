'use client';

import { useState } from 'react';
import { ChevronLeft, CircleAlert, CircleCheck, Luggage, Pause, Play, RefreshCw, TriangleAlert } from 'lucide-react';
import type { TheCodeIssue } from '@/types/thecode';
import type { ScreenProps } from './model';
import { fixLabel, targetForIssue } from './nav';
import { isProbablyMissing, isRiddleTooHard, timeAgo } from './helpers';
import { Button, Card, Pill, cx } from './ui';

const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  published: { label: 'פעילה', tone: 'success' },
  paused: { label: 'בהפסקה', tone: 'warning' },
  draft: { label: 'טיוטה', tone: 'neutral' },
};

/** Warnings that repeat per gnome are folded into one line. */
function foldWarnings(issues: TheCodeIssue[], gnomeNo: (id?: string) => number | undefined) {
  const out: { key: string; message: string; issue: TheCodeIssue }[] = [];
  const fold: Partial<Record<TheCodeIssue['code'], (nums: string) => string>> = {
    GNOME_NOT_VERIFIED: (n) => `גמדים ${n} עוד לא נסרקו במקום.`,
    GNOME_WITHOUT_RIDDLE: (n) => `לגמדים ${n} אין חידה מפורסמת, ולכן אף משפחה לא תגיע אליהם.`,
  };
  const groups = new Map<string, TheCodeIssue[]>();
  for (const i of issues) {
    if (fold[i.code]) groups.set(i.code, [...(groups.get(i.code) || []), i]);
    else out.push({ key: `${i.code}-${out.length}`, message: i.message, issue: i });
  }
  for (const [code, list] of groups) {
    const f = fold[code as TheCodeIssue['code']]!;
    out.push({
      key: code,
      message: list.length === 1 ? list[0].message : f(list.map((i) => gnomeNo(i.gnomeId)).join(', ')),
      issue: list[0],
    });
  }
  return out;
}

export default function OverviewScreen({
  state, report, actions, navigate, now, checked, onChecked,
}: ScreenProps & { checked: boolean; onChecked: () => void }) {
  const { config, riddles, gnomeStats, riddleStats, players } = state;
  const [checking, setChecking] = useState(false);
  const status = STATUS[config.status];
  const errors = report.issues.filter((i) => i.severity === 'error');
  const gnomeNo = (id?: string) => config.gnomes.find((g) => g.id === id)?.number;
  const warnings = foldWarnings(report.issues.filter((i) => i.severity === 'warning'), gnomeNo);
  const canPublish = report.errors === 0;

  const runCheck = () => {
    setChecking(true);
    window.setTimeout(() => {
      setChecking(false);
      onChecked();
    }, 550);
  };

  const activeGnomes = config.gnomes.filter((g) => g.isActive).length;
  const playable = config.phrases.filter((p) => p.isActive && report.phrases[p.id]?.playable).length;
  const activePhrases = config.phrases.filter((p) => p.isActive).length;
  const published = riddles.filter((r) => r.status === 'published').length;
  const weekFamilies = players.filter((p) => p.weekPoints > 0).length;

  const field = [
    ...config.gnomes
      .filter((g) => isProbablyMissing(g, gnomeStats[g.id], config.status, now))
      .map((g) => ({
        key: g.id,
        text: `גמד ${g.number} לא נסרק ${timeAgo(gnomeStats[g.id]?.lastScanAt, now).replace('לפני ', '')} — כנראה נעלם`,
        go: () => navigate({ tab: 'gnomes', gnomeId: g.id }),
      })),
    ...riddles
      .filter((r) => r.status === 'published' && isRiddleTooHard(riddleStats[r.id]))
      .map((r) => ({
        key: r.id,
        text: `החידה "${r.answerWord}" (גמד ${gnomeNo(r.gnomeId)}) קשה מדי — שקלו לנסח אותה מחדש`,
        go: () => navigate({ tab: 'riddles', gnomeId: r.gnomeId, riddleId: r.id }),
      })),
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Status + the one decision on this screen */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-2xl font-bold text-text-title">{config.title}</h1>
              <Pill tone={status.tone}>{status.label}</Pill>
            </div>
            <div className="mt-1 text-text-secondary">
              {config.status === 'published'
                ? 'משפחות יכולות לשחק עכשיו.'
                : config.status === 'paused'
                ? 'משפחות שסורקות גמד רואות "המשחק בהפסקה". ההתקדמות שלהן נשמרת.'
                : 'ההרפתקה עוד לא פתוחה למשפחות.'}
            </div>
          </div>
          {config.status === 'published' ? (
            <Button icon={Pause} onClick={() => actions.setStatus('paused')}>השהו</Button>
          ) : (
            <Button variant="primary" size="lg" icon={Play} disabled={!canPublish} onClick={() => actions.setStatus('published')}>
              {config.status === 'paused' ? 'חדשו משחק' : 'פרסמו'}
            </Button>
          )}
        </div>
        {config.status !== 'published' && !canPublish && (
          <div className="mt-4 flex items-center gap-2 text-sm text-danger">
            <CircleAlert size={16} aria-hidden />
            {report.errors === 1 ? 'תקנו שגיאה אחת כדי לפרסם.' : `תקנו ${report.errors} שגיאות כדי לפרסם.`}
          </div>
        )}
        {config.status === 'published' && !canPublish && (
          <div className="mt-4 flex items-center gap-2 text-sm text-danger">
            <CircleAlert size={16} aria-hidden />
            יש שגיאות בתוכן. משפחות ימשיכו לשחק רק במשפטים התקינים.
          </div>
        )}
      </Card>

      {/* Readiness check */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">בדיקת מוכנות</h2>
            <p className="text-text-secondary">בודקת שכל משפט סודי אפשר להשלים, ושכל גמד אפשר למצוא.</p>
          </div>
          <Button variant={checked ? 'secondary' : 'primary'} icon={RefreshCw} onClick={runCheck} disabled={checking} className={checking ? '[&_svg]:animate-spin' : ''}>
            {checking ? 'בודקים…' : checked ? 'בדקו שוב' : 'בדקו הרפתקה'}
          </Button>
        </div>

        {checked && !checking && (
          <div className="border-t border-border">
            {errors.length === 0 ? (
              <div className="flex items-center gap-4 bg-success/10 px-6 py-5">
                <CircleCheck size={32} className="shrink-0 text-success" aria-hidden />
                <div>
                  <div className="text-lg font-semibold text-green-700 dark:text-green-400">מוכן לפרסום</div>
                  <div className="text-text-secondary">
                    {warnings.length ? `אין שגיאות. יש ${warnings.length === 1 ? 'אזהרה אחת' : `${warnings.length} אזהרות`} שכדאי לעבור עליהן.` : 'אין שגיאות ואין אזהרות.'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-danger/5 px-6 py-5">
                <div className="mb-3 flex items-center gap-2 font-semibold text-red-700 dark:text-red-400">
                  <CircleAlert size={20} aria-hidden />
                  {errors.length === 1 ? 'דבר אחד חוסם פרסום' : `${errors.length} דברים חוסמים פרסום`}
                </div>
                <ul className="space-y-2">
                  {errors.map((i, n) => (
                    <IssueRow key={n} message={i.message} tone="danger" label={fixLabel(i)} onFix={() => navigate(targetForIssue(i))} />
                  ))}
                </ul>
              </div>
            )}

            {warnings.length > 0 && (
              <details className="group border-t border-border">
                <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-6 py-3 text-text-secondary hover:bg-bg-hover">
                  <TriangleAlert size={16} className="text-warning" aria-hidden />
                  <span className="font-medium">{warnings.length} אזהרות</span>
                  <span>— לא חוסמות פרסום</span>
                  <ChevronLeft size={16} className="ms-auto transition-transform group-open:-rotate-90" aria-hidden />
                </summary>
                <ul className="space-y-2 px-6 pb-5">
                  {warnings.map((w) => (
                    <IssueRow key={w.key} message={w.message} tone="warning" label={fixLabel(w.issue)} onFix={() => navigate(targetForIssue(w.issue))} />
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </Card>

      {/* Numbers */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat
          big
          icon={Luggage}
          value={report.freshSuitcases}
          label="מזוודות חדשות למשפחה"
          tone={report.freshSuitcases < 2 ? 'warning' : undefined}
          onClick={() => navigate({ tab: 'phrases' })}
        />
        <Stat value={`${playable}/${activePhrases}`} label="משפטים מוכנים" onClick={() => navigate({ tab: 'phrases' })} />
        <Stat value={`${activeGnomes}/${config.gnomes.length}`} label="גמדים פעילים" onClick={() => navigate({ tab: 'gnomes' })} />
        <Stat value={published} label="חידות מפורסמות" onClick={() => navigate({ tab: 'riddles' })} />
      </div>

      {/* Field alerts — things the venue team should go and look at */}
      <Card className="p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">בשטח</h2>
          <span className="text-sm text-text-secondary">{weekFamilies} משפחות שיחקו השבוע</span>
        </div>
        {field.length === 0 ? (
          <p className="mt-2 text-text-secondary">כל הגמדים נסרקים ואין חידות קשות מדי.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {field.map((f) => (
              <IssueRow key={f.key} message={f.text} tone="warning" label="להצגה" onFix={f.go} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function IssueRow({ message, tone, label, onFix }: { message: string; tone: 'danger' | 'warning'; label: string; onFix: () => void }) {
  return (
    <li className="flex items-start justify-between gap-4 rounded-lg bg-bg-card px-4 py-3 ring-1 ring-border">
      <span className="flex min-w-0 items-start gap-2">
        <span className={cx('mt-2 size-2 shrink-0 rounded-full', tone === 'danger' ? 'bg-danger' : 'bg-warning')} aria-hidden />
        <span>{message}</span>
      </span>
      <button type="button" onClick={onFix} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-sm font-medium text-accent hover:bg-accent/10">
        {label}
        <ChevronLeft size={16} aria-hidden />
      </button>
    </li>
  );
}

function Stat({
  value,
  label,
  onClick,
  icon: Icon,
  big,
  tone,
}: {
  value: number | string;
  label: string;
  onClick: () => void;
  icon?: typeof Luggage;
  big?: boolean;
  tone?: 'warning';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'rounded-xl border bg-bg-card p-4 text-start transition-colors hover:bg-bg-hover',
        tone === 'warning' ? 'border-warning/50' : 'border-border',
        big && 'col-span-2 sm:col-span-1'
      )}
    >
      <div className="flex items-center gap-2">
        {Icon && <Icon size={20} className={tone === 'warning' ? 'text-warning' : 'text-accent'} aria-hidden />}
        <span className="text-3xl font-bold tabular-nums" dir="ltr">{value}</span>
      </div>
      <div className="mt-1 text-sm text-text-secondary">{label}</div>
    </button>
  );
}
