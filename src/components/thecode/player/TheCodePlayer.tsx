'use client';

// הקוד — the family's phone app. Pure UI: PlayerState in, PlayerCallbacks out.
// The parent decides where state comes from (the demo fake now, the real API later).
// The root fills its parent (absolute screens inside), so it works full-screen on a
// phone and inside a phone-shaped frame on a desktop preview.

import { useCallback, useEffect, useRef, useState } from 'react';
import { gameSfx, type SfxName } from './sfx';
import { THECODE_STYLE } from './styles';
import { HotBadge, ScoreCounter, SfxContext } from './ui';
import RegisterScreen from './RegisterScreen';
import ProfileSheet from './ProfileSheet';
import { AlreadySolvedScreen, CorrectScreen, GnomeAsleepScreen, RiddleScreen, TargetScreen, WrongGnomeScreen } from './HuntScreens';
import { ArrangeScreen, SuitcaseScreen, SummaryScreen } from './FinaleScreens';
import { AllDoneScreen, InAppBrowserScreen, NetworkErrorScreen, PausedScreen } from './StatusScreens';
import type { PlayerCallbacks, PlayerScreen, PlayerState } from './types';

const HOT_STREAK_AT = 3;
const NO_HEADER: PlayerScreen['kind'][] = ['register', 'inAppBrowser', 'networkError', 'paused'];

function screenKey(s: PlayerScreen): string {
  if (s.kind === 'wrongGnome') return `wrong-${s.gnome.id}-${s.penalty}`;
  if (s.kind === 'register') return `register-${s.mode}`;
  return s.kind;
}

/** The sound a screen makes when it appears. */
function enterSound(state: PlayerState): SfxName | null {
  const s = state.screen;
  switch (s.kind) {
    case 'riddle': return 'scan';
    case 'correct': return state.correct?.becameHot ? 'hot' : 'correct';
    case 'wrongGnome': return s.penalty ? 'penalty' : 'warn';
    case 'alreadySolved':
    case 'gnomeAsleep':
    case 'networkError': return 'warn';
    default: return null;
  }
}

function MuteIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
      {muted ? <path d="m16 9 5 6M21 9l-5 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
    </svg>
  );
}

function Header({ state, onProfiles, onMute }: { state: PlayerState; onProfiles(): void; onMute(): void }) {
  const p = state.profile!;
  return (
    <header className="relative z-20 flex items-center gap-2 px-4 pb-2 pt-3">
      <button type="button" className="tc-chip min-w-0 max-w-[40%] shrink" onClick={onProfiles} aria-label={`המשפחה: ${p.familyName}. החלפת משפחה וקוד שחזור`}>
        <span className="text-xl" aria-hidden>{p.emoji}</span>
        <span className="truncate">{p.familyName}</span>
        {state.profiles.length > 1 && <span aria-hidden className="text-xs opacity-70">▾</span>}
      </button>
      <div className="flex min-w-0 flex-1 justify-center">
        <HotBadge hot={p.hot} streak={Math.min(p.streak, HOT_STREAK_AT)} target={HOT_STREAK_AT} compact />
      </div>
      <ScoreCounter points={p.points} />
      <button type="button" className="tc-chip w-11 justify-center !px-0" onClick={onMute} aria-label={state.muted ? 'הפעלת צלילים' : 'השתקת צלילים'} aria-pressed={state.muted}>
        <MuteIcon muted={state.muted} />
      </button>
    </header>
  );
}

function ScreenSwitch({ state, cb }: { state: PlayerState; cb: PlayerCallbacks }) {
  const s = state.screen;
  switch (s.kind) {
    case 'register':
      return (
        <RegisterScreen venueName={state.venueName} mode={s.mode} firstGnome={s.firstGnome} recoverError={s.recoverError}
          addingProfile={!!state.profile && !s.firstGnome}
          onRegister={cb.onRegister} onRecover={cb.onRecover} onMode={cb.onRegisterMode}
          onCancel={state.profile ? () => cb.onSwitchProfile(state.profile!.id) : undefined} />
      );
    case 'target':
      return state.target ? <TargetScreen target={state.target} collector={state.collector} onHint={cb.onLocationHint} /> : null;
    case 'riddle':
      return state.riddle ? (
        <RiddleScreen riddle={state.riddle} alphabet={state.alphabet} onPick={cb.onPickLetter} onSubmit={cb.onSubmitLetter} onHint={cb.onRiddleHint} />
      ) : null;
    case 'correct':
      return state.correct ? <CorrectScreen correct={state.correct} collector={state.collector} onContinue={cb.onContinue} /> : null;
    case 'wrongGnome':
      return <WrongGnomeScreen gnome={s.gnome} penalty={s.penalty} freeLeft={s.freeLeft} target={state.target} onContinue={cb.onContinue} />;
    case 'alreadySolved':
      return <AlreadySolvedScreen gnome={s.gnome} onContinue={cb.onContinue} />;
    case 'gnomeAsleep':
      return <GnomeAsleepScreen gnome={s.gnome} onContinue={cb.onContinue} />;
    case 'arrange':
      return state.arrange ? (
        <ArrangeScreen arrange={state.arrange} onPlace={cb.onArrangePlace} onRemove={cb.onArrangeRemove} onHelp={cb.onArrangeHelp} onOpen={cb.onOpenSuitcase} />
      ) : null;
    case 'suitcase':
      return state.suitcase ? <SuitcaseScreen suitcase={state.suitcase} onNext={cb.onShowSummary} /> : null;
    case 'summary':
      return state.profile && state.summary ? <SummaryScreen profile={state.profile} summary={state.summary} onNewSuitcase={cb.onNewSuitcase} /> : null;
    case 'allDone':
      return <AllDoneScreen profile={state.profile} onSummary={cb.onShowSummary} />;
    case 'paused':
      return <PausedScreen />;
    case 'inAppBrowser':
      return <InAppBrowserScreen onOpen={cb.onOpenInBrowser} onDismiss={cb.onDismissInAppBrowser} />;
    case 'networkError':
      return <NetworkErrorScreen onRetry={cb.onRetry} />;
  }
}

export default function TheCodePlayer({ state, callbacks }: { state: PlayerState; callbacks: PlayerCallbacks }) {
  // The switcher belongs to the family that opened it: any profile change closes it.
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const sheetOpen = !!state.profile && sheetFor === state.profile.id;
  const setSheetOpen = (open: boolean) => setSheetFor(open && state.profile ? state.profile.id : null);
  const mutedRef = useRef(state.muted);
  useEffect(() => {
    mutedRef.current = state.muted;
  }, [state.muted]);
  const play = useCallback((name: SfxName) => {
    if (!mutedRef.current) gameSfx().play(name);
  }, []);

  const key = screenKey(state.screen);
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    if (lastKey.current === key) return;
    const first = lastKey.current === null;
    lastKey.current = key;
    if (first) return;
    const snd = enterSound(state);
    if (snd) play(snd);
  }, [key, state, play]);

  const showHeader = !!state.profile && !NO_HEADER.includes(state.screen.kind);
  const alarm = state.screen.kind === 'wrongGnome' && state.screen.penalty > 0;

  const cb: PlayerCallbacks = {
    ...callbacks,
    onSwitchProfile: (id) => { setSheetOpen(false); play('tap'); callbacks.onSwitchProfile(id); },
    onAddProfile: () => { setSheetOpen(false); callbacks.onAddProfile(); },
  };

  return (
    <SfxContext.Provider value={play}>
      <div dir="rtl" lang="he" className={`tc-root flex flex-col ${alarm ? 'tc-alarm' : ''}`} onPointerDown={() => gameSfx().unlock()}>
        <style>{THECODE_STYLE}</style>
        <div className="tc-stars" aria-hidden />
        {showHeader && (
          <Header state={state} onProfiles={() => { play('tap'); setSheetOpen(true); }} onMute={() => { callbacks.onToggleMute(); }} />
        )}
        <main className="relative flex-1">
          <div key={key} className="tc-a-rise absolute inset-0">
            <ScreenSwitch state={state} cb={cb} />
          </div>
        </main>
        <ProfileSheet open={sheetOpen && showHeader} profile={state.profile} profiles={state.profiles}
          onClose={() => setSheetOpen(false)} onSwitch={cb.onSwitchProfile} onAdd={cb.onAddProfile} />
      </div>
    </SfxContext.Provider>
  );
}
