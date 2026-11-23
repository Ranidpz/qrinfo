'use client';

// Wires the free-game phone UI to the local demo fake + a demo bar (simulated camera, time
// travel, reset) that is NOT part of the game. Same frame as /play/the-code: on a desktop the
// phone sits in a frame with the bar beside it; on a phone the bar is a pull-up sheet (🎬).

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import FreeGamePlayer, { type FreeGameCallbacks, type FreeGameVideos } from '@/components/thecode/free/FreeGamePlayer';
import {
  ATTEMPTS_PER_RIDDLE, FREE_GNOMES, HINT_COST, POINTS_PER_RIDDLE, REFRESH, SECOND_ATTEMPT_FACTOR,
  createFreeDemoState, demoNow, freeBuyHint, freeDemoCaption, freeDemoGoRegister, freeDemoJump, freeDemoSolveAllBut,
  freeOpenGnome, freeOpenScanner, freeShowIntro, freeEndCall, freeCallMagician, freeJoinedDone, freePickLetter, freeRegister, freeScan, freeScanCode, freeShowBoard, freeSubmitLetter,
  freeToBoard, freeToggleMute, isAsleep, msToNextWake, type FreeDemoState,
} from '@/components/thecode/demo/freeDemo';
import GnomeFigure from '@/components/thecode/GnomeFigure';

const MIN = 60_000;

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="mb-2 text-sm font-bold text-slate-500">{title}</h3>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </section>
  );
}

function DemoButton({ onClick, children, strong, disabled }: { onClick(): void; children: ReactNode; strong?: boolean; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`min-h-[40px] rounded-xl px-3 text-sm font-semibold transition-colors active:scale-95 disabled:opacity-40 ${strong ? 'bg-slate-900 text-white hover:bg-slate-700' : 'bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-100'}`}>
      {children}
    </button>
  );
}

const refreshText = REFRESH.kind === 'minutes' ? `${REFRESH.minutes} דקות אחרי שנרדם` : `כל יום בשעה ${REFRESH.hour}:00`;

function ControlPanel({ s, realNow, set }: { s: FreeDemoState; realNow: number; set(fn: (x: FreeDemoState) => FreeDemoState): void }) {
  const now = demoNow(s, realNow);
  const next = msToNextWake(s, realNow);
  return (
    <div dir="rtl" className="text-slate-900">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-black">סרגל הדגמה</h2>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">לא חלק מהמשחק</span>
      </div>
      <p className="mb-3 rounded-lg bg-slate-100 px-3 py-2 text-sm">{freeDemoCaption(s)}</p>

      <Group title="קפיצה בזמן (הגמדים הישנים מתעוררים עם החידה הבאה)">
        <DemoButton strong disabled={next === null} onClick={() => set((x) => freeDemoJump(x, (msToNextWake(x, Date.now()) ?? 0) + 1000, Date.now()))}>
          עד שהגמד הבא מתעורר
        </DemoButton>
        <DemoButton onClick={() => set((x) => freeDemoJump(x, 15 * MIN, Date.now()))}>+15 דקות</DemoButton>
        <DemoButton onClick={() => set((x) => freeDemoJump(x, 60 * MIN, Date.now()))}>+שעה</DemoButton>
        <DemoButton onClick={() => set((x) => freeDemoJump(x, 24 * 60 * MIN, Date.now()))}>+יום</DemoButton>
      </Group>

      <Group title="מצלמה מדומה: סריקת גמד">
        {FREE_GNOMES.map((g) => (
          <button key={g.id} type="button" onClick={() => set((x) => freeScan(x, g.id, Date.now()))}
            aria-label={`סריקת גמד ${g.number}`}
            className={`flex h-14 w-11 items-end justify-center rounded-xl bg-white ring-1 ring-slate-300 hover:bg-slate-100 ${isAsleep(s.gnomes[g.id], now) ? 'opacity-40' : ''}`}>
            <GnomeFigure bodyColor={g.bodyColor} hatColor={g.hatColor} number={g.number} size={40} />
          </button>
        ))}
      </Group>

      <Group title="קיצורים">
        <DemoButton onClick={() => set((x) => ({ ...x, group: null, screen: { kind: 'startAtScreen', gnomeId: FREE_GNOMES[4].id } }))}>קבוצה לא רשומה סורקת</DemoButton>
        <DemoButton onClick={() => set(freeDemoGoRegister)}>נרשמנו במסך</DemoButton>
        <DemoButton onClick={() => set((x) => freeDemoSolveAllBut(x, 1, Date.now()))}>להשאיר גמד ער אחד</DemoButton>
      </Group>

      <Group title="הכללים בהדגמה">
        <ul className="w-full list-disc ps-5 text-sm leading-relaxed text-slate-700">
          <li>{FREE_GNOMES.length} גמדים, כל אחד עם {FREE_GNOMES[0].riddles.length} חידות</li>
          <li>חידה נכונה: {POINTS_PER_RIDDLE} נקודות</li>
          <li>{ATTEMPTS_PER_RIDDLE} ניסיונות, השני שווה {SECOND_ATTEMPT_FACTOR * 100}%</li>
          <li>רמז למקום: {HINT_COST} נקודות</li>
          <li>גמד מתעורר {refreshText}</li>
        </ul>
      </Group>

      <DemoButton strong onClick={() => set((x) => ({ ...createFreeDemoState(), muted: x.muted }))}>התחלה מחדש</DemoButton>
    </div>
  );
}

export default function TheCodeFreeDemo() {
  const [s, setS] = useState<FreeDemoState>(createFreeDemoState);
  const [barOpen, setBarOpen] = useState(false);
  // One clock for the board countdowns ("מתעורר עוד 42 ד׳") and the wake-ups.
  // 0 until mounted: the demo renders in the browser only (clock + screen size differ from the server).
  const [realNow, setRealNow] = useState(0);
  // Real clips can be tried with ?intro=…&welldone=… (any https URL or a file in /public).
  const [videos, setVideos] = useState<FreeGameVideos>({});
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const ok = (v: string | null) => (v && /^(https?:\/\/|\/)/.test(v) ? v : null);
    setVideos({ intro: ok(q.get('intro')), wellDone: ok(q.get('welldone')) });
    setRealNow(Date.now());
    const t = setInterval(() => setRealNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const set = (fn: (x: FreeDemoState) => FreeDemoState) => setS((prev) => fn(prev));

  const callbacks = useMemo<FreeGameCallbacks>(() => {
    const on = (fn: (x: FreeDemoState) => FreeDemoState) => () => setS((prev) => fn(prev));
    return {
      onRegister: (name, emoji) => setS((x) => freeRegister(x, name, emoji)),
      onOpenGnome: (id) => setS((x) => freeOpenGnome(x, id)),
      onScanGnome: (id) => setS((x) => freeScan(x, id, Date.now())),
      onOpenScanner: on(freeOpenScanner),
      onScanCode: (code) => setS((x) => freeScanCode(x, code, Date.now())),
      onBuyHint: (id) => setS((x) => freeBuyHint(x, id)),
      onPickLetter: (l) => setS((x) => freePickLetter(x, l)),
      onSubmitLetter: () => setS((x) => freeSubmitLetter(x, Date.now())),
      onContinue: () => setS((x) => freeToBoard(x, Date.now())),
      onBoard: on(freeShowBoard),
      onToggleMute: on(freeToggleMute),
      onShowIntro: on(freeShowIntro),
      onEndCall: on(freeEndCall),
      onJoinedDone: on(freeJoinedDone),
      onCallMagician: (call) => setS((x) => freeCallMagician(x, call)),
      onDemoRegistered: on(freeDemoGoRegister),
    };
  }, []);

  return (
    <div className="min-h-[100dvh] bg-[#E9E6F2] md:flex md:items-center md:justify-center md:gap-10 md:p-5">
      <div className="fixed inset-0 md:relative md:inset-auto md:aspect-[390/844] md:h-[min(844px,calc(100dvh-40px))] md:shrink-0 md:overflow-hidden md:rounded-[46px] md:shadow-[0_0_0_10px_#151827,0_30px_80px_rgba(20,20,60,.35)]">
        {realNow > 0 && <FreeGamePlayer state={s} realNow={realNow} callbacks={callbacks} videos={videos} />}
      </div>

      <aside className="hidden max-h-[calc(100dvh-40px)] w-[380px] overflow-y-auto rounded-3xl bg-white/80 p-5 shadow-xl backdrop-blur md:block">
        {realNow > 0 && <ControlPanel s={s} realNow={realNow} set={set} />}
      </aside>

      <div className="md:hidden">
        <button type="button" onClick={() => setBarOpen((o) => !o)} aria-expanded={barOpen}
          aria-label={barOpen ? 'סגירת סרגל ההדגמה' : 'פתיחת סרגל ההדגמה'}
          className={`fixed left-0 z-[60] flex h-12 w-9 ${barOpen ? 'bottom-[calc(62dvh+8px)]' : 'top-[38%]'} items-center justify-center rounded-r-xl bg-white/85 text-lg shadow-lg`}>
          {barOpen ? '✕' : '🎬'}
        </button>
        {barOpen && (
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[62dvh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-16 shadow-2xl">
            <ControlPanel s={s} realNow={realNow} set={(fn) => { set(fn); setBarOpen(false); }} />
          </div>
        )}
      </div>
    </div>
  );
}
