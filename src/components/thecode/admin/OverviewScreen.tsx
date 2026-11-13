'use client';

import { useState } from 'react';
import type { AdminTab } from './nav';
import { Check, ChevronLeft, Image as ImageIcon, CircleAlert, CircleCheck, Copy, ExternalLink, Luggage, Pause, Play, RefreshCw, TriangleAlert } from 'lucide-react';
import type { TheCodeIssue } from '@/types/thecode';
import type { ScreenProps } from './model';
import { fixLabel, targetForIssue } from './nav';
import { isProbablyMissing, isRiddleTooHard, timeAgo } from './helpers';
import { Button, Card, Pill, cx, Tip } from './ui';
import { BankFillButton } from './BankDialogs';
import { hasBranding } from './BrandingCard';

const STATUS_TIP: Record<string, string> = {
  published: 'ההרפתקה פתוחה: קבוצות שסורקות גמד משחקות.',
  paused: 'ההרפתקה בהפסקה: קבוצות רואות "המשחק בהפסקה", וההתקדמות שלהן נשמרת.',
  draft: 'ההרפתקה עוד לא פורסמה, ואף קבוצה לא יכולה לשחק בה.',
};

const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  published: { label: 'פעילה', tone: 'success' },
  paused: { label: 'בהפסקה', tone: 'warning' },
  draft: { label: 'עוד לא פורסמה', tone: 'neutral' },
};

/** Warnings that repeat per gnome are folded into one line. */
function foldWarnings(issues: TheCodeIssue[], gnomeNo: (id?: string) => number | undefined) {
  const out: { key: string; message: string; issue: TheCodeIssue }[] = [];
  const fold: Partial<Record<TheCodeIssue['code'], (nums: string) => string>> = {
    GNOME_NOT_VERIFIED: (n) => `גמדים ${n} עוד לא נסרקו במקום.`,
    GNOME_WITHOUT_RIDDLE: (n) => `לגמדים ${n} אין חידה במשחק, ולכן אף קבוצה לא תגיע אליהם.`,
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
  state, report, actions, navigate, now, checked, onChecked, links, refresh,
}: ScreenProps & { checked: boolean; onChecked: () => void }) {
  const { config, riddles, gnomeStats, riddleStats, players } = state;
  const [checking, setChecking] = useState(false);
  const [confirmPause, setConfirmPause] = useState(false);
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

  // Spots without a location hint: always visible here (groups only see the spot's name).
  const field: { key: string; text: string; go: () => void; label?: string }[] = [
    ...report.issues
      .filter((i) => i.code === 'SPOT_WITHOUT_HINT')
      .map((i) => ({ key: `hint-${i.spotId}`, text: i.message, go: () => navigate(targetForIssue(i)), label: 'הוסיפו רמז' })),
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
              <Tip text={STATUS_TIP[config.status]}>
                <Pill tone={status.tone}>{status.label}</Pill>
              </Tip>
            </div>
            <div className="mt-1 text-text-secondary">
              {config.status === 'published'
                ? 'קבוצות יכולות לשחק עכשיו.'
                : config.status === 'paused'
                ? 'קבוצות שסורקות גמד רואות "המשחק בהפסקה". ההתקדמות שלהן נשמרת.'
                : 'ההרפתקה עוד לא פתוחה לקבוצות.'}
            </div>
          </div>
          {config.status === 'published' ? (
            <Button icon={Pause} onClick={() => setConfirmPause(true)} disabled={confirmPause}>השהו</Button>
          ) : (
            <Button variant="primary" size="lg" icon={Play} disabled={!canPublish} onClick={() => actions.setStatus('published')}>
              {config.status === 'paused' ? 'חדשו משחק' : 'פרסמו'}
            </Button>
          )}
        </div>
        {config.status === 'published' && confirmPause && (
          <div className="mt-4 rounded-lg bg-warning/10 px-4 py-3 text-sm">
            <p className="text-amber-800 dark:text-amber-300">
              להשהות את המשחק? קבוצות שבאמצע מזוודה יראו &quot;המשחק בהפסקה&quot; כשיסרקו גמד. כל ההתקדמות שלהן נשמרת, והן ימשיכו מאותה נקודה כשתחדשו.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setConfirmPause(false)}>ביטול</Button>
              <Button
                size="sm"
                icon={Pause}
                onClick={() => {
                  actions.setStatus('paused');
                  setConfirmPause(false);
                }}
              >
                כן, השהו
              </Button>
            </div>
          </div>
        )}
        {config.status !== 'published' && !canPublish && (
          <div className="mt-4 flex items-center gap-2 text-sm text-danger">
            <CircleAlert size={16} aria-hidden />
            {report.errors === 1 ? 'תקנו שגיאה אחת כדי לפרסם.' : `תקנו ${report.errors} שגיאות כדי לפרסם.`}
          </div>
        )}
        {config.status === 'published' && !canPublish && (
          <div className="mt-4 flex items-center gap-2 text-sm text-danger">
            <CircleAlert size={16} aria-hidden />
            יש שגיאות בתוכן. קבוצות ימשיכו לשחק רק במשפטים התקינים.
          </div>
        )}
      </Card>

      <GettingStarted state={state} report={report} navigate={navigate} />

      {!hasBranding(config.branding) && (
        <button
          type="button"
          onClick={() => navigate({ tab: 'settings' })}
          className="flex w-full items-center gap-4 rounded-xl border border-dashed border-accent/40 bg-accent/5 px-5 py-4 text-start hover:bg-accent/10"
        >
          <ImageIcon size={22} className="shrink-0 text-accent" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">הוסיפו תמונה ולוגו שלכם למסך הפתיחה</span>
            <span className="block text-sm text-text-secondary">קבוצות רואות אותו מיד אחרי הסריקה הראשונה.</span>
          </span>
          <ChevronLeft size={16} className="shrink-0 text-accent" aria-hidden />
        </button>
      )}

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
                {errors.some((i) => i.code === 'PHRASE_LETTER_MISSING') && (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <BankFillButton onClick={() => navigate({ tab: 'riddles', fill: true })} />
                    <span className="text-sm text-text-secondary">נשלים את האותיות החסרות בחידות מוכנות — תראו אותן לפני שהן נכנסות.</span>
                  </div>
                )}
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
          label="מזוודות חדשות לקבוצה"
          tone={report.freshSuitcases < 2 ? 'warning' : undefined}
          onClick={() => navigate({ tab: 'phrases' })}
        />
        <Stat value={`${playable}/${activePhrases}`} label="משפטים מוכנים" onClick={() => navigate({ tab: 'phrases' })} />
        <Stat value={`${activeGnomes}/${config.gnomes.length}`} label="גמדים פעילים" onClick={() => navigate({ tab: 'gnomes' })} />
        <Stat value={published} label="חידות במשחק" onClick={() => navigate({ tab: 'riddles' })} />
      </div>

      {/* Field alerts — things the venue team should go and look at */}
      <Card className="p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">בשטח</h2>
          <span className="ms-auto text-sm text-text-secondary">{weekFamilies} קבוצות שיחקו השבוע</span>
          {refresh && (
            <button
              type="button"
              onClick={refresh.run}
              disabled={refresh.busy}
              aria-label="רעננו נתונים"
              title={refresh.at ? `עודכן ${timeAgo(refresh.at, now)}` : undefined}
              className="inline-flex size-9 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover disabled:opacity-50"
            >
              <RefreshCw size={16} className={refresh.busy ? 'animate-spin' : ''} aria-hidden />
            </button>
          )}
        </div>
        {field.length === 0 ? (
          <p className="mt-2 text-text-secondary">כל הגמדים נסרקים ואין חידות קשות מדי.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {field.map((f) => (
              <IssueRow key={f.key} message={f.text} tone="warning" label={f.label || 'להצגה'} onFix={f.go} />
            ))}
          </ul>
        )}
      </Card>

      {links && <LinksCard links={links} />}
    </div>
  );
}

const STEPS: { tab: AdminTab; title: string; text: string }[] = [
  { tab: 'spots', title: 'מקומות', text: 'איפה במתחם יעמדו הגמדים, עם רמזים שיובילו אליהם.' },
  { tab: 'gnomes', title: 'גמדים', text: 'כמה גמדים בכל מקום, ובאילו צבעים.' },
  { tab: 'riddles', title: 'חידות', text: 'חידה לכל גמד, על משהו שרואים ממנו.' },
  { tab: 'phrases', title: 'משפטים סודיים', text: 'המשפט שהקבוצות ירכיבו מהאותיות.' },
  { tab: 'overview', title: 'פרסום', text: 'בדקו מוכנות ופרסמו — וקבוצות יכולות לשחק.' },
];

/** Leads a brand-new operator through the order that works. Hidden once everything is done. */
function GettingStarted({ state, report, navigate }: Pick<ScreenProps, 'state' | 'report' | 'navigate'>) {
  const { config, riddles } = state;
  const done = [
    config.spots.length > 0,
    config.gnomes.length > 0,
    riddles.some((r) => r.status === 'published'),
    config.phrases.some((p) => p.isActive && report.phrases[p.id]?.playable),
    config.status === 'published',
  ];
  // Once only "publish" is left, the status card above already says it — no need to repeat.
  if (done.slice(0, 4).every(Boolean)) return null;
  const nextIdx = done.findIndex((d) => !d);
  const fresh = !config.spots.length && !config.gnomes.length;

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">{fresh ? 'בואו נבנה את ההרפתקה' : 'ממשיכים לבנות'}</h2>
      <p className="text-text-secondary">{fresh ? 'חמישה צעדים, בסדר הזה. אפשר לחזור ולשנות כל דבר בהמשך.' : 'זה מה שנשאר עד שקבוצות יוכלו לשחק.'}</p>
      <ol className="mt-4 space-y-2">
        {STEPS.map((st, i) => (
          <li key={st.title}>
            <button
              type="button"
              onClick={() => navigate({ tab: st.tab })}
              className={cx(
                'flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2 text-start transition-colors hover:bg-bg-hover',
                i === nextIdx && 'bg-accent/5 ring-1 ring-accent/30'
              )}
            >
              <span
                className={cx(
                  'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                  done[i] ? 'bg-success text-white' : i === nextIdx ? 'bg-accent text-white' : 'bg-bg-secondary text-text-secondary'
                )}
              >
                {done[i] ? <Check size={16} aria-label="בוצע" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cx('block font-medium', done[i] && 'text-text-secondary')}>{st.title}</span>
                <span className="block text-sm text-text-secondary">{st.text}</span>
              </span>
              {i === nextIdx && <ChevronLeft size={16} className="shrink-0 text-accent" aria-hidden />}
            </button>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function LinksCard({ links }: { links: NonNullable<ScreenProps['links']> }) {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">קישורים</h2>
      <p className="text-text-secondary">הכתובות הקבועות של המשחק. שתפו אותן עם הצוות שלכם.</p>
      <div className="mt-4 space-y-3">
        <LinkRow label="דף הבית של המשחק" hint="לקבוצות שרוצות להמשיך או לראות את הלוח" url={links.game} />
        <LinkRow label="לוח התוצאות למסך גדול" hint="פתחו אותו בטלוויזיה או במקרן" url={links.lobby} />
      </div>
    </Card>
  );
}

function LinkRow({ label, hint, url }: { label: string; hint: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('העתיקו את הקישור', url);
    }
  };
  return (
    <div className="rounded-lg bg-bg-secondary px-4 py-3">
      <div className="font-medium">{label}</div>
      <div className="text-sm text-text-secondary">{hint}</div>
      <div className="mt-2 flex items-center gap-2">
        <span dir="ltr" className="min-w-0 flex-1 truncate rounded-md bg-bg-card px-3 py-2 font-mono text-sm ring-1 ring-border">{url}</span>
        <button type="button" onClick={copy} aria-label={`העתיקו: ${label}`} className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-3 text-sm font-medium text-accent hover:bg-accent/10">
          {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
          {copied ? 'הועתק' : 'העתיקו'}
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`פתחו: ${label}`} className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover">
          <ExternalLink size={16} aria-hidden />
        </a>
      </div>
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
