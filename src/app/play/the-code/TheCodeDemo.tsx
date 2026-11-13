'use client';

// Wires the player UI to the local demo fake + a demo control bar (simulated camera and
// shortcuts to every state) for screen-recording. On a desktop the phone sits in a frame
// with the bar beside it; on a phone the app is full-screen and the bar is a pull-up sheet.

import { useMemo, useState, type ReactNode } from 'react';
import TheCodePlayer from '@/components/thecode/player/TheCodePlayer';
import { defaultHowToPlay } from '@/lib/thecode/howToPlay';
import type { PlayerCallbacks } from '@/components/thecode/player/types';
import {
  createDemoState, demoAddProfile, demoAnswerRight, demoAnswerWrong, demoArrangeHelp, demoArrangePlace,
  demoArrangeRemove, demoCaption, demoSetPhoto, demoUpdateProfile, demoCloseScanner, demoOpenScanner, demoScanCode, demoContinue, demoJump, demoLocationHint, demoNewSuitcase, demoOpenSuitcase,
  demoPickLetter, demoRecover, demoRegister, demoRegisterMode, demoRiddleHint, demoScanSleeping, demoScanSolved,
  demoScanTarget, demoScanWrong, demoSetOverlay, demoShowSummary, demoSubmitLetter, demoSwitchProfile,
  demoToggleMute, demoView, DEMO_BRANDINGS, DEMO_CONFIG, type DemoJump, type DemoState,
} from '@/components/thecode/demo/playerDemo';

const JUMPS: { to: DemoJump; label: string }[] = [
  { to: 'register', label: 'הרשמה' },
  { to: 'recover', label: 'יש לנו קוד' },
  { to: 'target', label: 'מסך מטרה' },
  { to: 'scanner', label: 'סורק גמדים' },
  { to: 'riddle', label: 'חידה' },
  { to: 'correct', label: 'תשובה נכונה' },
  { to: 'soundAlike', label: 'כמעט (אות דומה)' },
  { to: 'hot', label: 'שחקן חם' },
  { to: 'wrongLetters', label: '3 טעויות והמתנה' },
  { to: 'wrongGnomeFree', label: 'נא נא (בחינם)' },
  { to: 'wrongGnomePenalty', label: 'נא נא (הורדה)' },
  { to: 'alreadySolved', label: 'כבר פתרתם' },
  { to: 'gnomeAsleep', label: 'גמד ישן' },
  { to: 'arrange', label: 'סידור הקוד' },
  { to: 'suitcase', label: 'פתיחת מזוודה' },
  { to: 'summary', label: 'סיכום וטבלה' },
  { to: 'allDone', label: 'כל המזוודות נפתחו' },
  { to: 'paused', label: 'המשחק בהפסקה' },
  { to: 'inAppBrowser', label: 'דפדפן של וואטסאפ' },
  { to: 'networkError', label: 'אין חיבור' },
];

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="mb-2 text-sm font-bold text-slate-500">{title}</h3>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </section>
  );
}

function DemoButton({ onClick, children, strong }: { onClick(): void; children: ReactNode; strong?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[40px] rounded-xl px-3 text-sm font-semibold transition-colors active:scale-95 ${strong ? 'bg-slate-900 text-white hover:bg-slate-700' : 'bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-100'}`}
    >
      {children}
    </button>
  );
}

function ControlPanel({ s, set }: { s: DemoState; set(next: (s: DemoState) => DemoState): void }) {
  const caption = demoCaption(s);
  return (
    <div dir="rtl" className="text-slate-900">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-black">סרגל הדגמה</h2>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">לא חלק מהמשחק</span>
      </div>
      {caption && <p className="mb-3 rounded-lg bg-slate-100 px-3 py-2 text-sm">{caption}</p>}
      <Group title="מצלמה מדומה (גם כשהסורק פתוח)">
        <DemoButton strong onClick={() => set(demoScanTarget)}>סריקת הגמד הנכון</DemoButton>
        <DemoButton onClick={() => set(demoScanWrong)}>סריקת גמד לא נכון</DemoButton>
        <DemoButton onClick={() => set(demoScanSolved)}>סריקת גמד שנפתר</DemoButton>
        <DemoButton onClick={() => set(demoScanSleeping)}>סריקת גמד ישן</DemoButton>
      </Group>
      <Group title="תשובה מהירה (במסך החידה)">
        <DemoButton onClick={() => set(demoAnswerRight)}>תשובה נכונה</DemoButton>
        <DemoButton onClick={() => set(demoAnswerWrong)}>תשובה שגויה</DemoButton>
      </Group>
      <Group title="קפיצה למסך">
        {JUMPS.map((j) => (
          <DemoButton key={j.to} onClick={() => set((x) => demoJump(x, j.to))}>{j.label}</DemoButton>
        ))}
      </Group>
      <DemoButton strong onClick={() => set((x) => ({ ...createDemoState(), muted: x.muted }))}>התחלה מחדש</DemoButton>
    </div>
  );
}

// The real default text, built from the demo's own rules (the server does the same).
const DEMO_HOW_TO_PLAY = defaultHowToPlay(DEMO_CONFIG.rules);

export default function TheCodeDemo({ brand }: { brand?: keyof typeof DEMO_BRANDINGS }) {
  const [s, setS] = useState<DemoState>(createDemoState);
  const [barOpen, setBarOpen] = useState(false);
  const set = (fn: (x: DemoState) => DemoState) => setS((prev) => fn(prev));

  const callbacks = useMemo<PlayerCallbacks>(() => {
    const on = (fn: (x: DemoState) => DemoState) => () => setS((prev) => fn(prev));
    return {
      // Demo: the selfie stays on this phone (its data: URL stands in for the uploaded photo).
      onRegister: (name, emoji, photo) => setS((x) => demoRegister(x, name, photo?.preview ?? emoji)),
      onRecover: (code) => setS((x) => demoRecover(x, code)),
      onRegisterMode: (mode) => setS((x) => demoRegisterMode(x, mode)),
      onLocationHint: on(demoLocationHint),
      onRiddleHint: on(demoRiddleHint),
      onPickLetter: (l) => setS((x) => demoPickLetter(x, l)),
      onSubmitLetter: on(demoSubmitLetter),
      onContinue: on(demoContinue),
      onArrangePlace: (i) => setS((x) => demoArrangePlace(x, i)),
      onArrangeRemove: (i) => setS((x) => demoArrangeRemove(x, i)),
      onArrangeHelp: on(demoArrangeHelp),
      onOpenSuitcase: on(demoOpenSuitcase),
      onShowSummary: on(demoShowSummary),
      onNewSuitcase: on(demoNewSuitcase),
      onSwitchProfile: (id) => setS((x) => demoSwitchProfile(x, id)),
      onAddProfile: on(demoAddProfile),
      onToggleMute: on(demoToggleMute),
      onRetry: on((x) => demoSetOverlay(x, null)),
      onOpenScanner: on(demoOpenScanner),
      onCloseScanner: on(demoCloseScanner),
      onScanCode: (code) => setS((x) => demoScanCode(x, code)),
      onUpdateProfile: async (patch) => { setS((x) => demoUpdateProfile(x, patch)); return 'ok'; },
      onSetPhoto: (shot) => setS((x) => demoSetPhoto(x, shot.preview)),
      onRemovePhoto: () => setS((x) => demoSetPhoto(x, null)),
      // In the real app: openCurrentUrlInBrowser() from src/lib/inAppBrowser.ts.
      onOpenInBrowser: on((x) => demoSetOverlay(x, null)),
      onDismissInAppBrowser: on((x) => demoSetOverlay(x, null)),
    };
  }, []);

  const view = useMemo(() => ({ ...demoView(s), branding: brand ? DEMO_BRANDINGS[brand] : null, howToPlay: DEMO_HOW_TO_PLAY, selfie: { enabled: true, days: 14 } }), [s, brand]);

  return (
    <div className="min-h-[100dvh] bg-[#E9E6F2] md:flex md:items-center md:justify-center md:gap-10 md:p-5">
      {/* phone */}
      <div className="fixed inset-0 md:relative md:inset-auto md:aspect-[390/844] md:h-[min(844px,calc(100dvh-40px))] md:shrink-0 md:overflow-hidden md:rounded-[46px] md:shadow-[0_0_0_10px_#151827,0_30px_80px_rgba(20,20,60,.35)]">
        <TheCodePlayer state={view} callbacks={callbacks} />
      </div>

      {/* desktop bar */}
      <aside className="hidden max-h-[calc(100dvh-40px)] w-[360px] overflow-y-auto rounded-3xl bg-white/80 p-5 shadow-xl backdrop-blur md:block">
        <ControlPanel s={s} set={set} />
      </aside>

      {/* phone bar */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setBarOpen((o) => !o)}
          aria-expanded={barOpen}
          aria-label={barOpen ? 'סגירת סרגל ההדגמה' : 'פתיחת סרגל ההדגמה'}
          className={`fixed left-0 z-[60] flex h-12 w-9 ${barOpen ? 'bottom-[calc(62dvh+8px)]' : 'top-[38%]'} items-center justify-center rounded-r-xl bg-white/85 text-lg shadow-lg`}
        >
          {barOpen ? '✕' : '🎬'}
        </button>
        {barOpen && (
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[62dvh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-16 shadow-2xl">
            <ControlPanel s={s} set={(fn) => { set(fn); }} />
          </div>
        )}
      </div>
    </div>
  );
}
