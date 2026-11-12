'use client';

import { useCallback, useDeferredValue, useMemo, type ReactNode, type RefObject } from 'react';
import { CircleAlert, CloudOff, Loader2, RefreshCw, Check } from 'lucide-react';
import AdminShell from '@/components/thecode/admin/AdminShell';
import type { AdminLinks } from '@/components/thecode/admin/model';
import { cx } from '@/components/thecode/admin/ui';
import { buildAdventureReport, phraseCoverage } from './report';
import type { TheCodeAdminTransport } from './transport';
import { useTheCodeAdmin, type SaveState, type UseTheCodeAdmin } from './useTheCodeAdmin';
import type { LoadError } from './transport';

/**
 * The operator's admin on the real API (or any injected transport). Renders the same
 * AdminShell screens as the demo; adds the save state, notices, links and refresh.
 */
export default function TheCodeLiveAdmin({
  codeId,
  transport,
  links,
  scrollRef,
  extraBadge,
  errorAction,
}: {
  codeId: string;
  transport?: TheCodeAdminTransport;
  links?: AdminLinks;
  scrollRef?: RefObject<HTMLElement | null>;
  /** Extra header content next to the save state (e.g. "back to the code" link). */
  extraBadge?: ReactNode;
  /** Shown under a load error (e.g. a link back to the dashboard). */
  errorAction?: ReactNode;
}) {
  const live = useTheCodeAdmin(codeId, { transport });
  const { state } = live;
  // Typing stays instant; the engine report (it simulates whole runs) may lag a frame behind.
  const deferred = useDeferredValue(state);
  const report = useMemo(() => (deferred ? buildAdventureReport(deferred) : null), [deferred]);
  const coverageOf = useCallback((text: string) => phraseCoverage(text, state!.config, state!.riddles), [state]);

  if (live.phase.kind === 'loading' || !state || !report) {
    if (live.phase.kind === 'error') return <LoadErrorScreen error={live.phase.error} onRetry={live.reload} action={errorAction} />;
    return (
      <div dir="rtl" className="flex min-h-dvh items-center justify-center gap-3 bg-bg-primary text-text-secondary">
        <Loader2 className="animate-spin" size={22} aria-hidden /> טוענים את ההרפתקה…
      </div>
    );
  }

  return (
    <AdminShell
      state={state}
      report={report}
      actions={live.actions}
      coverageOf={coverageOf}
      uploadImage={live.uploadImage}
      links={links}
      refresh={{ run: live.refresh, busy: live.refreshing, at: live.refreshedAt ?? undefined }}
      notice={live.notice}
      scrollRef={scrollRef}
      badge={
        <span className="flex min-w-0 items-center gap-2">
          <SaveIndicator live={live} />
          {extraBadge}
        </span>
      }
    />
  );
}

const SAVE_VIEW: Record<SaveState, { text: string; tone: 'ok' | 'busy' | 'bad' }> = {
  saved: { text: 'נשמר', tone: 'ok' },
  pending: { text: 'שומר…', tone: 'busy' },
  saving: { text: 'שומר…', tone: 'busy' },
  retrying: { text: 'השמירה נכשלה — מנסים שוב', tone: 'bad' },
  offline: { text: 'אין חיבור — נשמור כשיחזור', tone: 'bad' },
  failed: { text: 'השמירה נכשלה — נסו שוב', tone: 'bad' },
  conflict: { text: 'לא נשמר — טענו מחדש', tone: 'bad' },
};

/** Always visible in the sticky header. */
export function SaveIndicator({ live }: { live: Pick<UseTheCodeAdmin, 'saveState' | 'retry' | 'reload'> }) {
  const v = SAVE_VIEW[live.saveState];
  const Icon = v.tone === 'ok' ? Check : v.tone === 'busy' ? Loader2 : live.saveState === 'offline' ? CloudOff : CircleAlert;
  const canAct = live.saveState === 'retrying' || live.saveState === 'failed' || live.saveState === 'conflict';
  const content = (
    <>
      <Icon size={14} className={cx('shrink-0', v.tone === 'busy' && 'animate-spin')} aria-hidden />
      <span className="truncate">{v.text}</span>
    </>
  );
  const cls = cx(
    'inline-flex min-h-8 min-w-0 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium',
    v.tone === 'ok' && 'text-success',
    v.tone === 'busy' && 'text-text-secondary',
    v.tone === 'bad' && 'bg-danger/10 text-red-700 dark:text-red-400'
  );
  return (
    <span role="status" aria-live="polite" className="min-w-0">
      {canAct ? (
        <button type="button" className={cx(cls, 'hover:bg-danger/20')} onClick={live.saveState === 'conflict' ? live.reload : live.retry}>
          {content}
        </button>
      ) : (
        <span className={cls}>{content}</span>
      )}
    </span>
  );
}

const LOAD_ERRORS: Record<LoadError, { title: string; text: string; retry: boolean }> = {
  unauthorized: { title: 'צריך להתחבר', text: 'התחברו לחשבון שיצר את ההרפתקה, ואז רעננו את הדף.', retry: true },
  forbidden: { title: 'ההרפתקה הזו שייכת לחשבון אחר', text: 'רק מי שיצר את הקוד יכול לנהל אותו. אם צריך גישה, בקשו מהבעלים להעביר לכם את הקוד.', retry: false },
  notFound: { title: 'לא מצאנו את ההרפתקה', text: 'ייתכן שהקוד נמחק, או שזה לא קוד של "הקוד".', retry: false },
  network: { title: 'אין חיבור', text: 'בדקו את האינטרנט ונסו שוב.', retry: true },
  server: { title: 'משהו השתבש', text: 'לא הצלחנו לטעון את ההרפתקה. נסו שוב בעוד רגע.', retry: true },
};

export function LoadErrorScreen({ error, onRetry, action }: { error: LoadError; onRetry?: () => void; action?: ReactNode }) {
  const e = LOAD_ERRORS[error];
  return <MessageScreen title={e.title} text={e.text} onRetry={e.retry ? onRetry : undefined} action={action} />;
}

export function MessageScreen({ title, text, onRetry, action }: { title: string; text: string; onRetry?: () => void; action?: ReactNode }) {
  return (
    <div dir="rtl" className="flex min-h-dvh items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-md rounded-2xl bg-bg-card p-8 text-center shadow-sm ring-1 ring-border">
        <CircleAlert size={36} className="mx-auto text-text-secondary" aria-hidden />
        <h1 className="mt-4 text-xl font-bold text-text-title">{title}</h1>
        <p className="mt-2 text-text-secondary">{text}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {onRetry && (
            <button type="button" onClick={onRetry} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-5 font-medium text-white hover:bg-accent/90">
              <RefreshCw size={16} aria-hidden /> נסו שוב
            </button>
          )}
          {action}
        </div>
      </div>
    </div>
  );
}
