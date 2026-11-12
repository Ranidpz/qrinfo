'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/thecode/admin/AdminShell';
import type { AdminState } from '@/components/thecode/admin/model';
import { createDemoActions, createDemoState, demoUploadImage, phraseCoverage, validateAdventure } from '@/components/thecode/demo/adminDemo';
import TheCodeLiveAdmin from '@/components/thecode/adminLive/TheCodeLiveAdmin';
import { createMemoryTransport, type MemoryServerControls } from '@/components/thecode/adminLive/memoryTransport';
import { DEFAULT_THECODE_RULES } from '@/lib/thecode/engine';
import { gameUrl, lobbyUrl } from '@/components/thecode/admin/helpers';
import type { TheCodeAdminLoadResponse } from '@/types/thecode-api';

/**
 * `/play/the-code/admin`            — the approved demo: sample venue, in memory.
 * `/play/the-code/admin?mock=1`     — the LIVE admin (save state, merge, conflicts) on a fake
 *                                     in-memory server seeded with the sample venue.
 * `/play/the-code/admin?mock=new`   — same, starting from a brand-new adventure (version 0).
 */
export default function TheCodeAdminDemo() {
  const [mode, setMode] = useState<'demo' | 'mock' | 'new' | null>(null);
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get('mock');
    setMode(m === 'new' ? 'new' : m ? 'mock' : 'demo');
  }, []);
  if (!mode) return <div className="min-h-dvh bg-bg-primary" />;
  return mode === 'demo' ? <Demo /> : <MockLive fresh={mode === 'new'} />;
}

function Demo() {
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
      uploadImage={demoUploadImage}
      resetLabel="התחילו מחדש עם נתוני הדוגמה"
      badge={<span className="hidden rounded-full bg-warning/15 px-2.5 py-0.5 text-sm font-medium text-amber-700 sm:inline dark:text-amber-400">הדגמה — שום דבר לא נשמר</span>}
    />
  );
}

function seed(fresh: boolean): TheCodeAdminLoadResponse {
  if (fresh) {
    return {
      ok: true,
      version: 0,
      config: {
        status: 'draft', title: 'הרפתקה חדשה', language: 'he', spots: [], gnomes: [], phrases: [],
        rules: { ...DEFAULT_THECODE_RULES }, requirePhoneVerification: false, retentionDays: 30,
      },
      riddles: [], gnomeStats: {}, riddleStats: {}, players: [],
    };
  }
  const s = createDemoState();
  return { ok: true, version: 3, config: s.config, riddles: s.riddles, gnomeStats: s.gnomeStats, riddleStats: s.riddleStats, players: s.players };
}

function MockLive({ fresh }: { fresh: boolean }) {
  const [{ transport, controls }] = useState(() => createMemoryTransport(seed(fresh)));
  return (
    <>
      <TheCodeLiveAdmin
        codeId="mock"
        transport={transport}
        links={{ game: gameUrl('DEMO12'), lobby: lobbyUrl('DEMO12') }}
        extraBadge={<span className="hidden rounded-full bg-warning/15 px-2.5 py-0.5 text-sm font-medium text-amber-700 sm:inline dark:text-amber-400">שרת מדומה</span>}
      />
      <MockControls controls={controls} />
    </>
  );
}

function MockControls({ controls }: { controls: MemoryServerControls }) {
  const [msg, setMsg] = useState('');
  const say = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(''), 2500);
  };
  return (
    <div dir="rtl" className="fixed bottom-4 start-4 z-40 flex flex-wrap items-center gap-2 rounded-xl bg-bg-card p-2 text-sm shadow-lg ring-1 ring-border print:hidden">
      <span className="px-1 font-medium text-text-secondary">שרת מדומה:</span>
      <button type="button" className="rounded-lg px-2 py-1 hover:bg-bg-hover" onClick={() => { controls.failNext(2); say('שתי השמירות הבאות ייכשלו'); }}>הכשילו שמירה</button>
      <button type="button" className="rounded-lg px-2 py-1 hover:bg-bg-hover" onClick={() => { controls.bumpVersion(); say('לשונית אחרת שמרה'); }}>שמירה מלשונית אחרת</button>
      {msg && <span className="px-1 text-accent">{msg}</span>}
    </div>
  );
}
