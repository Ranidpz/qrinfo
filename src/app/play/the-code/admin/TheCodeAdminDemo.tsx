'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/thecode/admin/AdminShell';
import type { AdminState } from '@/components/thecode/admin/model';
import { createDemoActions, createDemoState, phraseCoverage, validateAdventure } from '@/components/thecode/demo/adminDemo';

export default function TheCodeAdminDemo() {
  // Built after mount: the sample data is stamped with Date.now() (relative "last scan" times),
  // which would differ between the server render and the browser.
  const [state, setState] = useState<AdminState | null>(null);
  useEffect(() => setState(createDemoState()), []);

  const actions = useMemo(() => createDemoActions((fn) => setState((s) => (s ? fn(s) : s))), []);
  const report = useMemo(() => (state ? validateAdventure(state) : null), [state]);
  const coverageOf = useCallback((text: string) => phraseCoverage(text, state!.config, state!.riddles), [state]);

  if (!state || !report) return <div className="min-h-dvh bg-bg-primary" />;
  return (
    <AdminShell
      state={state}
      report={report}
      actions={actions}
      coverageOf={coverageOf}
      badge={<span className="hidden rounded-full bg-warning/15 px-2.5 py-0.5 text-sm font-medium text-amber-700 sm:inline dark:text-amber-400">הדגמה — שום דבר לא נשמר</span>}
    />
  );
}
