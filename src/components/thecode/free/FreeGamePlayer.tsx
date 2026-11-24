'use client';

// קוד הגמדים — the "free game" phone app. Pure UI: FreeGameView in (./types.ts), FreeGameCallbacks
// out. The demo (/play/the-code/free) and the live game (/v/{shortId} of a free adventure) both
// render it. Same look and pieces as the guided player (styles, header chips, gnome stage, tiles,
// confetti, sounds); the flow: a board of gnomes, any awake one may be scanned, a solved / failed
// gnome sleeps for this group until it wakes with its next riddle; Cliostro "calls" by video.
// All presentational helpers live at MODULE scope (inline components remount and replay animations).

import { useCallback, useEffect, useRef, useState } from 'react';
import GnomeFigure, { THECODE_COLORS, colorNameHe, describeGnome } from '@/components/thecode/GnomeFigure';
import { THECODE_STYLE } from '@/components/thecode/player/styles';
import { gameSfx, type SfxName } from '@/components/thecode/player/sfx';
import {
  Confetti, CountUp, GnomeStage, HintCard, HotBadge, ScoreCounter, ScreenBody, SfxContext, Socket, StarCoin, Tile,
  useFit, useSfx,
} from '@/components/thecode/player/ui';
import { ScanButton } from '@/components/thecode/player/HuntScreens';
import RegisterScreen from '@/components/thecode/player/RegisterScreen';
import ScannerScreen from '@/components/thecode/player/ScannerScreen';
import { LoadingScreen, NetworkErrorScreen, NotFoundScreen, PausedScreen } from '@/components/thecode/player/StatusScreens';
import { Avatar } from '@/components/thecode/player/Avatar';
import type { PlayerGnomeView } from '@/components/thecode/player/types';
import { alphabetFor } from '@/lib/thecode/letters';
import { PoweredBy } from '@/components/thecode/player/Branding';
import ProfileSheet from '@/components/thecode/player/ProfileSheet';
import MagicianCall from './MagicianCall';
import WakeCountdown from './WakeCountdown';
import { JOIN_FLY_MS, JOIN_SHOW_MS } from './JoinCelebration';
import { wakeLabel, type FreeGameCallbacks, type FreeGameView, type FreeGnomeView } from './types';
import type { InstallPlatform } from './install';

export type { FreeGameCallbacks, FreeGameView } from './types';

const ALPHABET = alphabetFor('he');
const view = (g: FreeGnomeView | PlayerGnomeView): PlayerGnomeView => ({ id: g.id, number: g.number, bodyColor: g.bodyColor, hatColor: g.hatColor });
const gnomeIn = (v: FreeGameView, id: string) => v.gnomes.find((g) => g.id === id);

// ------------------------------------------------ small pieces

function Cost({ amount }: { amount: number }) {
  return <span className="tc-num rounded-full bg-black/30 px-2 py-0.5 text-base" style={{ color: 'var(--tc-coral)' }}>−{amount}</span>;
}

function ColorChip({ color, part, name }: { color: FreeGnomeView['bodyColor']; part: string; name: string }) {
  return (
    <span className="tc-chip text-base">
      <span aria-hidden className="h-5 w-5 rounded-full" style={{ background: THECODE_COLORS[color].hex, boxShadow: '0 0 0 2px rgba(0,0,0,.4), 0 0 0 3.5px rgba(255,244,218,.4)' }} />
      <span><span className="font-black" style={{ color: 'var(--tc-brass-hi)' }}>{part}</span> {name}</span>
    </span>
  );
}

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      {muted ? <path d="M16 9.5l5 5M21 9.5l-5 5" /> : <path d="M16 9a4.5 4.5 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />}
    </svg>
  );
}

/**
 * The streak / hot chip between the group and the points. It measures its own room and steps
 * down full → compact → flame only, so it never covers the group's photo or the points
 * (Rani's iPhone, 23.11.2026: "🔥2" sat on the selfie with a four-digit score).
 */
function HotSlot({ hot, streak, target }: { hot: boolean; streak: number; target: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<'full' | 'compact' | 'icon'>('icon');
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const check = () => {
      const room = el.clientWidth;
      setFit(room >= 96 ? 'full' : room >= 60 ? 'compact' : 'icon');
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="flex min-w-0 flex-1 justify-center overflow-hidden">
      <HotBadge hot={hot} streak={streak} target={target} fit={fit} />
    </div>
  );
}

function Header({ v, onBoard, onToggleMute, onHome, onHowTo, onGroup }: { v: FreeGameView; onBoard(): void; onToggleMute(): void; onHome: boolean; onHowTo(): void; onGroup?(): void }) {
  const g = v.group!;
  return (
    <header className="relative z-20 flex items-center gap-2 px-4 pb-2 pt-3">
      {/* the group's symbol opens its sheet: name, symbol, selfie, recovery code (Rani 24.11.2026) */}
      <button type="button" className="tc-chip w-12 shrink-0 justify-center !px-0" title={g.name} aria-label={`הקבוצה ${g.name}: עריכה וקוד שחזור`}
        onClick={onGroup} disabled={!onGroup}>
        <Avatar value={g.avatar} size={28} />
      </button>
      <HotSlot hot={v.hot} streak={Math.min(v.streak, v.hotStreakAt)} target={v.hotStreakAt} />
      <ScoreCounter points={v.points} />
      <button type="button" className="tc-chip tc-display w-11 shrink-0 justify-center !px-0 text-xl" onClick={onHowTo} aria-label="איך משחקים">?</button>
      <button type="button" className="tc-chip w-11 shrink-0 justify-center !px-0" onClick={onToggleMute} aria-label={v.muted ? 'הפעלת צלילים' : 'השתקת צלילים'}>
        <SoundIcon muted={v.muted} />
      </button>
      <button type="button" className="tc-chip w-11 shrink-0 justify-center !px-0" onClick={onBoard}
        aria-label={onHome ? 'לראש לוח הגמדים' : 'ללוח הגמדים'} aria-current={onHome ? 'page' : undefined}
        style={onHome ? { background: 'rgba(244,183,64,.18)', boxShadow: 'inset 0 0 0 1.5px rgba(244,183,64,.5)', color: 'var(--tc-brass-hi)' } : undefined}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /><path d="M10 19.5v-5h4v5" />
        </svg>
      </button>
    </header>
  );
}

/** "42 ד׳" / "3 ש׳" / "מחר 08:00" — fits under a small gnome on the board (no colons in a duration: they flip in RTL). */
function shortWake(until: number, now: number): string {
  const min = Math.max(1, Math.round((until - now) / 60_000));
  if (min <= 90) return `${min} ד׳`;
  if (min < 12 * 60) return `${Math.round(min / 60)} ש׳`;
  const d = new Date(until);
  return `${d.getDate() === new Date(now).getDate() ? '' : 'מחר '}${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function GnomeCard({ g, now, onOpen }: { g: FreeGnomeView; now: number; onOpen(): void }) {
  const asleep = g.status === 'asleep' && g.wakesAt !== undefined && g.wakesAt > now;
  const done = g.status === 'noRiddles';
  const hinted = g.hints.length > 0;
  const label = asleep
    ? `גמד ${g.number}, ישן. מתעורר ${wakeLabel(g.wakesAt!, now)}`
    : done ? `גמד ${g.number}, סיים את החידות שלו` : `גמד ${g.number}, ${describeGnome(g.bodyColor, g.hatColor)}, ער`;
  return (
    <button type="button" onClick={onOpen} aria-label={label}
      className="relative flex w-full flex-col items-center rounded-2xl px-1 pb-1.5 pt-1 transition-transform active:scale-95"
      style={asleep || done
        ? { background: 'rgba(0,0,0,.22)', boxShadow: 'inset 0 0 0 1.5px rgba(255,244,218,.06)' }
        : { background: 'linear-gradient(180deg, rgba(255,244,218,.12), rgba(255,244,218,.04))', boxShadow: hinted ? 'inset 0 0 0 2px rgba(244,183,64,.7)' : 'inset 0 0 0 1.5px var(--tc-line)' }}>
      <div style={asleep || done ? { opacity: 0.5, filter: 'saturate(.45)' } : undefined} className={asleep || done ? '' : 'tc-a-bob'}>
        <GnomeFigure bodyColor={g.bodyColor} hatColor={g.hatColor} number={g.number} size={44} sleeping={asleep || done} />
      </div>
      {asleep ? (
        <span className="mt-0.5 flex items-center gap-1 whitespace-nowrap text-[13px] font-bold leading-none" style={{ color: 'var(--tc-soft)' }}>
          {g.last === 'failed'
            ? <span aria-hidden style={{ color: 'var(--tc-coral)' }}>✕</span>
            : g.last ? <span aria-hidden style={{ color: 'var(--tc-mint)' }}>✓</span> : null}
          <span aria-hidden>💤</span><span className="tc-num">{shortWake(g.wakesAt!, now)}</span>
        </span>
      ) : done ? (
        <span className="mt-0.5 text-[13px] font-bold leading-tight" style={{ color: 'var(--tc-soft)' }}>✓ סיים</span>
      ) : (
        <span className="mt-0.5 text-[13px] font-bold leading-tight" style={{ color: hinted ? 'var(--tc-brass-hi)' : 'var(--tc-mint)' }}>
          {hinted ? '📍 ער' : 'ער'}
        </span>
      )}
    </button>
  );
}

// ------------------------------------------------ screens

/**
 * Right after registering: the big screen is celebrating THIS group (JoinCelebration), so the
 * phone says so — look up! When the screen's moment ends, Cliostro calls.
 */
function JoinedScreen({ v, onDone }: { v: FreeGameView; onDone(): void }) {
  const fit = useFit();
  // The live game re-renders every second (its clock) and hands a new `onDone` each time — keep the
  // latest in a ref so the timer runs ONCE from mount (keyed on onDone it restarted forever: stuck).
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; });
  useEffect(() => {
    const t = setTimeout(() => doneRef.current(), JOIN_SHOW_MS + JOIN_FLY_MS);
    return () => clearTimeout(t);
  }, []);
  return (
    <ScreenBody className="items-center justify-center gap-5 text-center">
      <Confetti burstKey="joined" />
      <span className="tc-a-pop flex items-center justify-center overflow-hidden rounded-full"
        style={{ width: fit(120, 160), height: fit(120, 160), background: 'radial-gradient(circle, #3E2C74, #141a48)', boxShadow: '0 0 0 6px var(--tc-brass), 0 20px 50px rgba(0,0,0,.45)' }}>
        <Avatar value={v.group?.avatar || '🍄'} size={fit(80, 110)} />
      </span>
      <h2 className="tc-display text-[2.3rem] leading-tight" style={{ color: 'var(--tc-brass-hi)' }}>אתם על המסך הגדול!</h2>
      <p className="text-xl leading-snug">{v.group?.name} הצטרפו למשחק<br />ליד המסך? הרימו את הראש <span aria-hidden>📺</span></p>
    </ScreenBody>
  );
}

/** The rules after Cliostro's call (and from "?" in the header). */
function IntroScreen({ onDone, onCall, canCall }: { onDone(): void; onCall(): void; canCall: boolean }) {
  const sfx = useSfx();
  return (
    <ScreenBody className="items-center gap-4 text-center"
      footer={<button type="button" className="tc-btn tc-btn-primary w-full text-xl" onClick={() => { sfx('tap'); onDone(); }}>יוצאים לחפש גמדים</button>}>
      <h2 className="tc-display text-[1.9rem] leading-tight" style={{ color: 'var(--tc-brass-hi)' }}>ככה משחקים</h2>
      {canCall && (
        <button type="button" className="tc-btn tc-btn-ghost w-full" onClick={() => { sfx('tap'); onCall(); }}>
          <span aria-hidden>🧙‍♂️</span> לשוחח שוב עם הקוסם
        </button>
      )}
      <ol className="flex w-full flex-col gap-2 text-start text-lg leading-snug">
        <li className="flex gap-3"><span aria-hidden>🔍</span><span>מצאו גמד ער במקום וסרקו אותו בכפתור <b>&quot;סרקו גמד&quot;</b> שבתוך המשחק</span></li>
        <li className="flex gap-3"><span aria-hidden>🔤</span><span>פתרו את החידה: הקישו את <b>האות הראשונה</b> של התשובה</span></li>
        <li className="flex gap-3"><span aria-hidden>💤</span><span>הגמד נרדם, ויתעורר אחר כך עם חידה חדשה</span></li>
        <li className="flex gap-3"><span aria-hidden>⭐</span><span>כל חידה מוסיפה נקודות. בדקו איפה אתם על המסך הגדול</span></li>
      </ol>
    </ScreenBody>
  );
}

/** "Can't find the screen?" — reveals the venue's hint for where the big screen stands (free). */
function ScreenHint({ hint }: { hint: string }) {
  const sfx = useSfx();
  const [open, setOpen] = useState(false);
  return open ? (
    <HintCard tone="brass" className="tc-a-rise w-full text-start">
      <span aria-hidden className="me-2">📍</span><span className="font-black">המסך נמצא </span>{hint}
    </HintCard>
  ) : (
    <button type="button" className="tc-btn tc-btn-ghost w-full" onClick={() => { sfx('tap'); setOpen(true); }}>
      לא מצאתם את המסך? רמז
    </button>
  );
}

// ------------------------------------------------ install to the home screen

function ShareIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12M8 7l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  );
}
function AddIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}
function DotsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
    </svg>
  );
}

function Step({ n, icon, children }: { n: number; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-start" style={{ background: 'var(--tc-panel)', boxShadow: 'inset 0 0 0 1.5px var(--tc-line)' }}>
      <span className="tc-num flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg" style={{ background: 'var(--tc-brass)', color: '#2A1600' }}>{n}</span>
      <span className="min-w-0 flex-1 text-lg leading-snug">{children}</span>
      {icon && <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,.1)', color: 'var(--tc-cream)' }}>{icon}</span>}
    </li>
  );
}

const HOLD_SKIP_MS = 5000;

/** "המשיכו בלי להתקין" must be HELD (Rani 23.11.2026: a tap was too easy, nobody installed): it
 *  fills over 5 seconds and continues only when full; letting go early empties it. */
function HoldToSkip({ onDone }: { onDone(): void }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; });
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  const start = () => {
    if (timer.current) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      try { navigator.vibrate?.(30); } catch { /* not supported */ }
      doneRef.current();
    }, HOLD_SKIP_MS);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <button type="button"
      className="tc-btn tc-btn-ghost relative w-full flex-col overflow-hidden select-none"
      style={{ touchAction: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', gap: 2, padding: '10px 1.4rem' }}
      onPointerDown={(e) => { e.preventDefault(); start(); }}
      onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); start(); } }}
      onKeyUp={(e) => { if (e.key === 'Enter' || e.key === ' ') stop(); }}
      onBlur={stop}>
      <span aria-hidden className="pointer-events-none absolute inset-y-0 start-0"
        style={{
          width: holding ? '100%' : '0%',
          background: 'linear-gradient(90deg, rgba(244,183,64,.45), rgba(244,183,64,.25))',
          transition: holding ? `width ${HOLD_SKIP_MS}ms linear` : 'width .25s ease-out',
        }} />
      <span className="relative">המשיכו בלי להתקין</span>
      <span className="relative text-sm font-normal" style={{ color: 'var(--tc-soft)' }}>
        {holding ? 'המשיכו להחזיק…' : 'החזיקו את הכפתור 5 שניות'}
      </span>
    </button>
  );
}

/** Before registering: add the game to the home screen, instructions per phone (Rani 23.11.2026). */
function InstallScreen({ platform, canPrompt, installed, cb }: { platform: InstallPlatform; canPrompt: boolean; installed: boolean; cb: FreeGameCallbacks }) {
  const sfx = useSfx();
  const fit = useFit();
  const skip = <HoldToSkip onDone={() => { sfx('tap'); cb.onSkipInstall?.(); }} />;
  let body: React.ReactNode;
  let primary: React.ReactNode = null;
  if (installed) {
    body = (
      <HintCard tone="brass" className="w-full text-lg">
        <span aria-hidden className="me-2">🎉</span>המשחק מותקן! סגרו את הדפדפן ופתחו את <b>קוד הגמדים</b> ממסך הבית. שם נרשמים ומתחילים.
      </HintCard>
    );
  } else if (platform === 'inapp') {
    body = (
      <p className="text-lg leading-snug" style={{ color: 'var(--tc-soft)' }}>
        פתחתם את הקישור מתוך וואטסאפ או אינסטגרם. משם אי אפשר להתקין, אז קודם פותחים בדפדפן.
      </p>
    );
    primary = <button type="button" className="tc-btn tc-btn-primary w-full text-xl" onClick={() => { sfx('tap'); cb.onOpenInBrowser?.(); }}>פתחו בדפדפן</button>;
  } else if (platform === 'android' && canPrompt) {
    body = <p className="text-lg leading-snug" style={{ color: 'var(--tc-soft)' }}>לחיצה אחת, והמשחק יופיע במסך הבית שלכם.</p>;
    primary = <button type="button" className="tc-btn tc-btn-primary w-full text-xl" onClick={() => { sfx('tap'); cb.onInstall?.(); }}>התקינו את המשחק</button>;
  } else if (platform === 'android') {
    body = (
      <ol className="flex w-full flex-col gap-2">
        <Step n={1} icon={<DotsIcon />}>לחצו על שלוש הנקודות למעלה</Step>
        <Step n={2} icon={<AddIcon />}>בחרו &quot;התקנת אפליקציה&quot; או &quot;הוספה למסך הבית&quot;</Step>
        <Step n={3}>פתחו את <b>קוד הגמדים</b> ממסך הבית</Step>
      </ol>
    );
  } else {
    // iPhone (Safari, or Chrome / Edge on iOS: the share button sits in the address bar).
    // A link opened from WhatsApp shows in an in-app Safari view whose user agent does not say so
    // (no reliable signal) — the first line tells them to open it in Safari first.
    body = (
      <ol className="flex w-full flex-col gap-2">
        {platform === 'ios-safari' && (
          <li className="rounded-2xl px-3 py-2 text-start text-base leading-snug" style={{ background: 'rgba(244,183,64,.12)', boxShadow: 'inset 0 0 0 1.5px rgba(244,183,64,.4)' }}>
            פתחתם מתוך וואטסאפ? קודם לחצו על <b>סמל המצפן</b> למטה (פתיחה בספארי), ואז:
          </li>
        )}
        <Step n={1} icon={<ShareIcon />}>{platform === 'ios-safari' ? 'לחצו על כפתור השיתוף בשורת הכתובת (או ⋯ ואז שיתוף)' : 'לחצו על כפתור השיתוף בשורת הכתובת'}</Step>
        <Step n={2} icon={<AddIcon />}>גללו ובחרו &quot;הוספה למסך הבית&quot;</Step>
        <Step n={3}>לחצו &quot;הוסף&quot;, ופתחו את <b>קוד הגמדים</b> ממסך הבית</Step>
      </ol>
    );
  }
  return (
    <ScreenBody className="items-center gap-4 text-center"
      footer={(
        <div className="flex flex-col gap-2">
          {primary}{!installed && skip}
          {cb.onDemoRegistered && (
            <button type="button" onClick={cb.onDemoRegistered}
              className="min-h-[48px] w-full rounded-2xl border-2 border-dashed border-amber-300/70 bg-amber-300/10 px-3 text-base font-bold text-amber-200">
              הדגמה בלבד: התקנו ופתחנו ממסך הבית
            </button>
          )}
          <PoweredBy />
        </div>
      )}>
      <span className="tc-a-pop flex items-center justify-center rounded-[28%]"
        style={{ width: fit(86, 110), height: fit(86, 110), background: 'linear-gradient(160deg, #3E2C74, #141a48)', boxShadow: '0 0 0 3px var(--tc-brass), 0 14px 40px rgba(0,0,0,.45)' }}>
        <GnomeFigure bodyColor="green" hatColor="red" size={fit(60, 78)} />
      </span>
      <h2 className="tc-display text-[2rem] leading-tight" style={{ color: 'var(--tc-brass-hi)' }}>התקינו את המשחק</h2>
      <p className="-mt-2 text-lg leading-snug">משחקים במסך מלא, כמו אפליקציה. בלי חנות ובלי הורדה.</p>
      {body}
      {!installed && platform !== 'inapp' && (
        <p className="text-base leading-snug" style={{ color: 'var(--tc-soft)' }}>
          כבר התקנתם? פתחו את <b>קוד הגמדים</b> ממסך הבית, ומשם סורקים גמדים בכפתור &quot;סרקו גמד&quot;.
        </p>
      )}
    </ScreenBody>
  );
}

/** Installed / in the browser, not registered yet: to the big screen — scan the gnome on it to register. */
export function StartAtScreenScreen({ gnome, screenHint, onScanScreen, onDemoRegistered }: { gnome: PlayerGnomeView | null; screenHint?: string; onScanScreen?(): void; onDemoRegistered?(): void }) {
  const fit = useFit();
  const sfx = useSfx();
  return (
    <ScreenBody className="items-center justify-center gap-4 text-center"
      footer={(
        <div className="flex flex-col gap-2">
          {onScanScreen && <ScanButton onScan={() => { sfx('tap'); onScanScreen(); }} label="סרקו את הגמד שעל המסך" />}
          {onDemoRegistered && (
            <button type="button" onClick={onDemoRegistered}
              className="min-h-[48px] w-full rounded-2xl border-2 border-dashed border-amber-300/70 bg-amber-300/10 px-3 text-base font-bold text-amber-200">
              הדגמה בלבד: סרקנו את הגמד שעל המסך
            </button>
          )}
          <PoweredBy />
        </div>
      )}>
      {gnome ? <GnomeStage gnome={gnome} size={fit(76, 110)} className="tc-a-pop" /> : <div className="tc-a-pop text-7xl leading-none" aria-hidden>📺</div>}
      <h2 className="tc-display text-[2.1rem] leading-tight" style={{ color: 'var(--tc-brass-hi)' }}>{gnome ? 'מצאתם גמד!' : 'עכשיו למסך הגדול!'}</h2>
      <p className="tc-display text-2xl leading-snug">{gnome ? 'אבל המשחק מתחיל במסך של הגמדים' : 'שם נרשמים ומתחילים לשחק'}</p>
      <HintCard tone="brass" className="w-full text-start">
        <ol className="flex flex-col gap-2">
          <li><span aria-hidden className="me-2">📺</span>חפשו את המסך הגדול של הגמדים במקום</li>
          <li><span aria-hidden className="me-2">📷</span>סרקו את הגמד שעל המסך בכפתור למטה</li>
          <li><span aria-hidden className="me-2">🍄</span>בחרו שם לקבוצה, והופיעו על המסך!</li>
        </ol>
      </HintCard>
      {screenHint && <ScreenHint hint={screenHint} />}
    </ScreenBody>
  );
}

function BoardScreen({ v, cb }: { v: FreeGameView; cb: FreeGameCallbacks }) {
  const awake = v.gnomes.filter((g) => g.status === 'awake' || (g.status === 'asleep' && (g.wakesAt ?? 0) <= v.now)).length;
  return (
    <ScreenBody className="gap-3"
      footer={<ScanButton onScan={cb.onOpenScanner} label="סרקו גמד" />}>
      <div className="flex items-end justify-between gap-2">
        <h2 className="tc-display text-[1.75rem] leading-none">הגמדים שלכם</h2>
        <p className="text-base font-bold" style={{ color: 'var(--tc-soft)' }}>
          <span style={{ color: 'var(--tc-mint)' }}><span className="tc-num">{awake}</span> ערים</span>
          {awake < v.gnomes.length && <>, <span className="tc-num">{v.gnomes.length - awake}</span> ישנים</>}
        </p>
      </div>
      <p className="-mt-1 text-base leading-snug" style={{ color: 'var(--tc-soft)' }}>
        מצאו גמד ער, סרקו ופתרו את החידה שלו. הקישו על גמד בשביל רמז למקום שלו.
      </p>
      <div className="grid grid-cols-4 gap-2" role="list" aria-label="לוח הגמדים">
        {v.gnomes.map((g) => (
          <div role="listitem" key={g.id}><GnomeCard g={g} now={v.now} onOpen={() => cb.onOpenGnome(g.id)} /></div>
        ))}
      </div>
    </ScreenBody>
  );
}

function GnomeScreen({ v, gnomeId, cb }: { v: FreeGameView; gnomeId: string; cb: FreeGameCallbacks }) {
  const sfx = useSfx();
  const fit = useFit();
  const g = gnomeIn(v, gnomeId);
  if (!g) return null;
  const asleep = g.status === 'asleep' && (g.wakesAt ?? 0) > v.now;
  const done = g.status === 'noRiddles';
  const cost = g.nextHintCost;
  const canPay = cost !== null && v.points >= cost;
  const scan = () => { sfx('tap'); if (cb.onScanGnome) cb.onScanGnome(gnomeId); else cb.onOpenScanner(); };
  return (
    <ScreenBody className="items-center gap-3 text-center"
      footer={(
        <div className="flex flex-col gap-2">
          {asleep || done ? (
            <button type="button" className="tc-btn tc-btn-primary w-full text-xl" onClick={cb.onBoard}>חזרה ללוח</button>
          ) : (
            <>
              <button type="button" className="tc-btn tc-btn-primary w-full text-xl" onClick={scan}>מצאנו! סרקו אותו</button>
              <button type="button" className="tc-btn tc-btn-ghost w-full" onClick={cb.onBoard}>חזרה ללוח</button>
            </>
          )}
        </div>
      )}>
      <p className="tc-display rounded-full px-4 py-1 text-lg" style={{ background: 'rgba(244,183,64,.18)', color: 'var(--tc-brass-hi)' }}>
        גמד <span className="tc-num">{g.number}</span>
      </p>
      <GnomeStage gnome={view(g)} size={140} fit={`clamp(100px, 20svh, ${fit(130, 170)}px)`} sleeping={asleep || done} className="tc-a-pop" />
      <p className="tc-display text-[1.5rem] leading-tight" style={{ color: 'var(--tc-brass-hi)' }}>{describeGnome(g.bodyColor, g.hatColor)}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <ColorChip color={g.bodyColor} part="גוף" name={colorNameHe(g.bodyColor, 'body')} />
        <ColorChip color={g.hatColor} part="מצנפת" name={colorNameHe(g.hatColor, 'hat')} />
      </div>
      {asleep ? (
        <WakeCountdown until={g.wakesAt!} now={v.now} caption="הגמד ישן. הוא יתעורר עם חידה חדשה בעוד" />
      ) : done ? (
        <HintCard className="w-full text-lg">הגמד הזה ענה איתכם על כל החידות שלו. כל הכבוד!</HintCard>
      ) : (
        <>
          {g.hints.map((h, i) => (
            <HintCard key={i} tone="brass" className={`w-full text-lg ${i === g.hints.length - 1 ? 'tc-a-rise' : ''}`}>
              <span aria-hidden className="me-2">📍</span><span className="font-black">איפה: </span>{h}
            </HintCard>
          ))}
          {cost !== null && (
            <div className="flex w-full flex-col gap-1.5">
              <button type="button" className="tc-btn tc-btn-ghost w-full" disabled={!canPay} onClick={() => { sfx('tap'); cb.onBuyHint(gnomeId); }}>
                {g.hints.length ? 'עוד רמז למקום' : 'איפה הוא? רמז למקום'} <Cost amount={cost} />
              </button>
              {!canPay && <p className="text-base" style={{ color: 'var(--tc-soft)' }}>רמז עולה {cost} נקודות. פתרו חידה ותוכלו לקנות.</p>}
            </div>
          )}
        </>
      )}
    </ScreenBody>
  );
}

function LetterPad({ picked, disabled, onPick }: { picked: string | null; disabled: boolean; onPick(l: string): void }) {
  return (
    <div className="grid w-full grid-cols-6 gap-1.5" role="group" aria-label="לוח אותיות">
      {ALPHABET.map((l) => (
        <button key={l} type="button" className="tc-key tc-display" aria-pressed={picked === l} disabled={disabled} onClick={() => onPick(l)}>
          {l}
        </button>
      ))}
    </div>
  );
}

function RiddleScreen({ v, cb }: { v: FreeGameView; cb: FreeGameCallbacks }) {
  const sfx = useSfx();
  const r = v.riddle!;
  const g = gnomeIn(v, r.gnomeId);
  const lastTick = useRef(v.wrongTick);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (v.wrongTick === lastTick.current) return;
    lastTick.current = v.wrongTick;
    sfx('wrong');
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 900);
    return () => clearTimeout(t);
  }, [v.wrongTick, sfx]);
  const [fresh] = useState(() => r.wrongs === 0);
  useEffect(() => { if (fresh) sfx('correct'); }, [fresh, sfx]);
  const left = r.attempts - r.wrongs;
  const half = Math.round(v.secondAttemptFactor * 100);
  // Rani (iPhone, 23.11.2026): the riddle comes first — the letter pad starts folded at the
  // bottom and opens on a tap; open, the riddle stays above it in a compact card.
  const [open, setOpen] = useState(false);
  const wrongLine = r.wrongs > 0 && left > 0 && (
    <p role="alert" className="text-base font-bold leading-snug" style={{ color: 'var(--tc-coral)' }}>
      {left === 1 ? 'לא זו האות. יש לכם עוד ניסיון אחד' : `לא זו האות. יש לכם עוד ${left} ניסיונות`}, על {half === 50 ? 'חצי מהנקודות' : `${half}% מהנקודות`}
    </p>
  );
  const footer = open ? (
    <div className="flex flex-col gap-2.5">
      <div key={v.wrongTick} className={`flex min-h-[2.75rem] items-center justify-between gap-3 ${v.wrongTick && r.wrongs ? 'tc-a-shake' : ''}`}>
        {wrongLine || <p className="text-base leading-snug">הקישו את <b>האות הראשונה</b> של התשובה</p>}
        <button type="button" className="tc-chip min-h-[40px] shrink-0" onClick={() => { sfx('tap'); setOpen(false); }} aria-label="קיפול לוח האותיות">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
          לחידה
        </button>
      </div>
      <LetterPad picked={v.pendingLetter} disabled={v.submitting} onPick={(l) => { sfx('key'); cb.onPickLetter(l); }} />
      <div className="flex items-center gap-3">
        {v.pendingLetter ? <Tile letter={v.pendingLetter} size={46} className="tc-a-pop shrink-0" /> : <Socket size={46} className="shrink-0">{flash ? '✕' : '?'}</Socket>}
        <button type="button" className="tc-btn tc-btn-primary flex-1 text-xl" disabled={!v.pendingLetter || v.submitting} onClick={() => { sfx('tap'); cb.onSubmitLetter(); }}>
          {v.submitting ? 'בודקים…' : 'בדקו'}
        </button>
      </div>
    </div>
  ) : (
    <div key={v.wrongTick} className={`flex flex-col gap-2.5 ${v.wrongTick && r.wrongs ? 'tc-a-shake' : ''}`}>
      {wrongLine}
      <button type="button" className="tc-btn tc-btn-primary w-full text-xl" onClick={() => { sfx('tap'); setOpen(true); }}>
        <span aria-hidden className="tc-display">אבג</span> פתרתם? בחרו את האות
      </button>
    </div>
  );
  return (
    <ScreenBody className={`items-stretch ${open ? 'gap-2' : 'gap-4'}`} footer={footer}>
      {!open && (
        <div className="flex items-center gap-3">
          {g && <div className={fresh ? 'tc-a-hop' : ''}><GnomeStage gnome={view(g)} size={58} /></div>}
          <div className="min-w-0 flex-1">
            <p className={`tc-display text-[1.9rem] leading-none ${fresh ? 'tc-a-bounce-in' : ''}`} style={{ color: 'var(--tc-mint)' }}>הגמד ער!</p>
            {g && <p className="mt-1 text-base" style={{ color: 'var(--tc-soft)' }}>גמד <span className="tc-num">{g.number}</span> שואל אתכם</p>}
          </div>
          <button type="button" className="tc-chip min-h-[44px] shrink-0" onClick={cb.onBoard}>ללוח</button>
        </div>
      )}
      <div className={`tc-a-rise rounded-3xl ${open ? 'px-4 py-3' : 'px-5 py-5'}`} style={{ background: 'linear-gradient(180deg, rgba(255,244,218,.1), rgba(255,244,218,.04))', boxShadow: 'inset 0 0 0 1.5px var(--tc-line)' }}>
        {r.imageUrl && !open && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.imageUrl} alt="" className="mb-4 max-h-44 w-full rounded-2xl object-cover" />
        )}
        <p className={`tc-display leading-snug ${open ? 'text-xl' : 'text-[1.6rem]'}`}>{r.text}</p>
      </div>
    </ScreenBody>
  );
}

function CorrectScreen({ v, cb }: { v: FreeGameView; cb: FreeGameCallbacks }) {
  const fit = useFit();
  const c = v.correct!;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setShown(c.points), 350);
    return () => clearTimeout(t);
  }, [c.points]);
  return (
    <ScreenBody className="items-center justify-center gap-2.5 text-center"
      footer={(
        <div className="flex flex-col gap-2.5">
          {c.becameHot ? (
            <div className="tc-a-pop rounded-2xl px-4 py-2 text-center text-[#2A0E00]" style={{ background: 'linear-gradient(180deg,#FFC24B,#FF8A2B)' }}>
              <p className="tc-display text-2xl leading-tight"><span className="tc-a-flicker">🔥</span> שחקנים חמים!</p>
              <p className="text-base font-bold leading-snug">{v.hotStreakAt} ברצף! מעכשיו כל חידה שווה <span className="whitespace-nowrap">פי 2</span></p>
            </div>
          ) : c.hot ? (
            <p className="tc-display text-center text-xl" style={{ color: 'var(--tc-flame)' }}>🔥 עדיין חמים, פי 2!</p>
          ) : null}
          <button type="button" className="tc-btn tc-btn-primary w-full text-xl" onClick={cb.onContinue}>
            {c.allAsleep ? 'כל הגמדים נרדמו! מה עכשיו?' : 'ללוח הגמדים'}
          </button>
        </div>
      )}>
      <Confetti burstKey={`${c.gnomeId}-${v.solved}`} />
      <p className="tc-display tc-a-rise text-[2rem] leading-none" style={{ color: 'var(--tc-mint)' }}>נכון!</p>
      <div className="relative">
        <div aria-hidden className="tc-rays absolute -inset-16 opacity-40"
          style={{ background: 'repeating-conic-gradient(from 0deg, rgba(255,217,120,.35) 0 10deg, transparent 10deg 30deg)', borderRadius: '50%', maskImage: 'radial-gradient(closest-side, #000 40%, transparent)' }} />
        <Tile letter={c.letter} size={fit(64, 100)} className="tc-a-pop" />
      </div>
      <p className="tc-display tc-a-rise -mt-1 text-2xl leading-tight">
        <span style={{ color: 'var(--tc-soft)' }}>התשובה: </span>
        <span style={{ color: 'var(--tc-brass-hi)' }}>{c.answerWord}</span>
      </p>
      <p className="tc-num tc-a-pop tc-delay-3 text-5xl font-black" style={{ color: 'var(--tc-mint)', textShadow: '0 6px 30px rgba(54,227,154,.45)' }}>
        +<CountUp value={shown} duration={700} />
      </p>
      {c.secondTry && <p className="text-lg font-bold" style={{ color: 'var(--tc-brass-hi)' }}>בניסיון השני: {v.secondAttemptFactor === 0.5 ? 'חצי מהנקודות' : 'חלק מהנקודות'}</p>}
      {c.spellingTip && (
        <HintCard tone="brass" className="w-full text-lg"><span aria-hidden className="me-2">✏️</span>{c.spellingTip}</HintCard>
      )}
      <p className="text-lg leading-snug" style={{ color: 'var(--tc-soft)' }}>
        <span aria-hidden>💤 </span>הגמד הלך לישון. הוא יתעורר {wakeLabel(c.wakesAt, v.now)} עם חידה חדשה.
      </p>
    </ScreenBody>
  );
}

function FailedScreen({ v, gnomeId, wakesAt, allSleep, cb }: { v: FreeGameView; gnomeId: string; wakesAt: number; allSleep: boolean; cb: FreeGameCallbacks }) {
  const fit = useFit();
  const g = gnomeIn(v, gnomeId);
  return (
    <ScreenBody className="items-center justify-center gap-4 text-center"
      footer={<button type="button" className="tc-btn tc-btn-primary w-full text-xl" onClick={cb.onContinue}>{allSleep ? 'כל הגמדים נרדמו! מה עכשיו?' : 'לגמד ער אחר'}</button>}>
      {g && <GnomeStage gnome={view(g)} size={fit(90, 130)} sleeping />}
      <h2 className="tc-display text-4xl leading-tight">לא הפעם</h2>
      <p className="text-xl leading-snug">הגמד התעייף והלך לישון.</p>
      <p className="text-lg leading-snug" style={{ color: 'var(--tc-brass-hi)' }}>לא ירדו לכם נקודות. כשהוא יתעורר תקבלו חידה חדשה.</p>
      <WakeCountdown until={wakesAt} now={v.now} />
    </ScreenBody>
  );
}

function AsleepScreen({ v, gnomeId, wakesAt, last, cb }: { v: FreeGameView; gnomeId: string; wakesAt: number; last?: string; cb: FreeGameCallbacks }) {
  const fit = useFit();
  const g = gnomeIn(v, gnomeId);
  return (
    <ScreenBody className="items-center justify-center gap-4 text-center"
      footer={<button type="button" className="tc-btn tc-btn-primary w-full text-xl" onClick={cb.onBoard}>לגמד ער אחר</button>}>
      {g && <GnomeStage gnome={view(g)} size={fit(90, 130)} sleeping />}
      <h2 className="tc-display text-4xl leading-tight">ששש… הגמד ישן</h2>
      <p className="text-xl leading-snug" style={{ color: 'var(--tc-soft)' }}>
        {last === 'failed' ? 'הוא עוד עייף מהחידה הקודמת.' : 'כבר פתרתם את החידה שלו.'}
        {' '}הוא יתעורר עם חידה חדשה בעוד:
      </p>
      <WakeCountdown until={wakesAt} now={v.now} />
      <p className="text-lg" style={{ color: 'var(--tc-brass-hi)' }}>בינתיים יש עוד גמדים ערים במקום</p>
    </ScreenBody>
  );
}

function NoRiddlesScreen({ v, gnomeId, cb }: { v: FreeGameView; gnomeId: string; cb: FreeGameCallbacks }) {
  const fit = useFit();
  const g = gnomeIn(v, gnomeId);
  return (
    <ScreenBody className="items-center justify-center gap-4 text-center"
      footer={<button type="button" className="tc-btn tc-btn-primary w-full text-xl" onClick={cb.onBoard}>לגמד אחר</button>}>
      {g && <GnomeStage gnome={view(g)} size={fit(90, 130)} />}
      <h2 className="tc-display text-4xl leading-tight">כל החידות נפתרו</h2>
      <p className="text-xl leading-snug" style={{ color: 'var(--tc-soft)' }}>לגמד הזה אין עוד חידות בשבילכם. חפשו גמד אחר!</p>
    </ScreenBody>
  );
}

function FinishedScreen({ v, onCall }: { v: FreeGameView; onCall?(): void }) {
  const wakes = v.gnomes.map((g) => g.wakesAt ?? 0).filter((t) => t > v.now);
  const first = wakes.length ? Math.min(...wakes) : null;
  return (
    <ScreenBody className="items-center justify-center gap-4 text-center">
      <Confetti burstKey={`done-${v.solved}`} />
      <div className="tc-a-pop text-8xl leading-none" aria-hidden>🎁</div>
      <h2 className="tc-display text-[2.4rem] leading-tight" style={{ color: 'var(--tc-brass-hi)' }}>סיימתם להיום!</h2>
      <p className="text-xl leading-snug">כל הגמדים ישנים. גשו לקבלה, מחכה לכם שם פרס.</p>
      <div className="flex items-center gap-2 text-4xl"><StarCoin size={34} /><CountUp value={v.points} /></div>
      <p className="text-lg" style={{ color: 'var(--tc-soft)' }}>פתרתם <span className="tc-num">{v.solved}</span> חידות</p>
      {first && (
        <p className="text-base" style={{ color: 'var(--tc-soft)' }}>הגמד הראשון יתעורר {wakeLabel(first, v.now)} עם חידה חדשה.</p>
      )}
      {onCall && (
        <button type="button" className="tc-btn tc-btn-ghost w-full" onClick={onCall}>
          <span aria-hidden>🧙‍♂️</span> הברכה של הקוסם
        </button>
      )}
    </ScreenBody>
  );
}

const WELCOME = 'הגמדים מסתתרים בכל המקום, וכל אחד מחכה עם חידה. בחרו כינוי לקבוצה ויוצאים לדרך!';

function Screen({ v, cb }: { v: FreeGameView; cb: FreeGameCallbacks }) {
  const sc = v.screen;
  // The magician always calls (a black screen stands in until his clip is uploaded).
  const hasWellDone = true;
  const hasIntro = true;
  switch (sc.kind) {
    case 'loading':
      return <LoadingScreen branding={v.branding} venueName={v.venueName} />;
    case 'notFound':
      return <NotFoundScreen title="המשחק לא נמצא" text="ייתכן שהקישור ישן. סרקו שוב את הקוד שעל המסך הגדול." />;
    case 'paused':
      return <PausedScreen />;
    case 'network':
      return <NetworkErrorScreen onRetry={cb.onRetry || (() => {})} problem={sc.problem} retryInSeconds={sc.retryInSeconds} />;
    case 'install':
      return <InstallScreen platform={sc.platform} canPrompt={sc.canPrompt} installed={sc.installed} cb={cb} />;
    case 'startAtScreen':
      return <StartAtScreenScreen gnome={sc.gnome} screenHint={v.screenHint} onScanScreen={cb.onScanScreen} />;
    case 'register':
      return (
        <RegisterScreen venueName={v.venueName} mode={sc.mode} addingProfile={false} selfie={v.selfie}
          branding={{ ...(v.branding || {}), welcomeText: v.branding?.welcomeText?.trim() || WELCOME }}
          nameError={sc.nameError} recoverError={sc.recoverError}
          onRegister={cb.onRegister} onRecover={cb.onRecover || (() => {})} onMode={cb.onRegisterMode || (() => {})} />
      );
    case 'board':
      return <BoardScreen v={v} cb={cb} />;
    case 'scanner':
      return sc.target === 'screen' ? (
        <ScannerScreen scanner={{ camera: sc.camera, error: sc.error, busy: sc.busy }} onScanCode={cb.onScanCode} onClose={cb.onBoard}
          onOtherText={cb.onScreenText} title="סרקו את המסך" prompt="כוונו את המצלמה לקוד שהגמד מחזיק על המסך הגדול" noManual />
      ) : (
        <ScannerScreen scanner={{ camera: sc.camera, error: sc.error, busy: sc.busy }} onScanCode={cb.onScanCode} onClose={cb.onBoard} />
      );
    case 'gnome':
      return <GnomeScreen v={v} gnomeId={sc.gnomeId} cb={cb} />;
    case 'riddle':
      return v.riddle ? <RiddleScreen v={v} cb={cb} /> : null;
    case 'correct':
      return v.correct ? <CorrectScreen v={v} cb={cb} /> : null;
    case 'failed':
      return <FailedScreen v={v} gnomeId={sc.gnomeId} wakesAt={sc.wakesAt} allSleep={sc.allAsleep} cb={cb} />;
    case 'asleep':
      return <AsleepScreen v={v} gnomeId={sc.gnomeId} wakesAt={sc.wakesAt} last={sc.last} cb={cb} />;
    case 'noRiddles':
      return <NoRiddlesScreen v={v} gnomeId={sc.gnomeId} cb={cb} />;
    case 'finished':
      return <FinishedScreen v={v} onCall={hasWellDone ? () => cb.onCallMagician('wellDone') : undefined} />;
    case 'joined':
      return <JoinedScreen v={v} onDone={cb.onJoinedDone} />;
    case 'intro':
      return <IntroScreen onDone={cb.onBoard} onCall={() => cb.onCallMagician('intro')} canCall={hasIntro} />;
  }
}

function screenKey(v: FreeGameView): string {
  const sc = v.screen;
  if (sc.kind === 'gnome' || sc.kind === 'asleep' || sc.kind === 'failed' || sc.kind === 'noRiddles') return `${sc.kind}-${sc.gnomeId}`;
  if (sc.kind === 'riddle') return `riddle-${v.riddle?.gnomeId}`;
  if (sc.kind === 'register') return `register-${sc.mode}`;
  return sc.kind;
}

function enterSound(v: FreeGameView): SfxName | null {
  switch (v.screen.kind) {
    case 'correct': return v.correct?.becameHot ? 'hot' : 'correct';
    case 'failed':
    case 'asleep':
    case 'noRiddles':
    case 'startAtScreen': return 'warn';
    case 'finished': return 'fanfare';
    case 'joined': return 'hot';
    default: return null;
  }
}

const NO_HEADER: FreeGameView['screen']['kind'][] = ['install', 'startAtScreen', 'register', 'joined', 'loading', 'notFound', 'paused', 'network'];

export default function FreeGamePlayer({ view: v, callbacks }: { view: FreeGameView; callbacks: FreeGameCallbacks }) {
  const mutedRef = useRef(v.muted);
  useEffect(() => { mutedRef.current = v.muted; }, [v.muted]);
  const play = useCallback((name: SfxName) => { if (!mutedRef.current) gameSfx().play(name); }, []);

  const key = screenKey(v);
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    if (lastKey.current === key) return;
    const first = lastKey.current === null;
    lastKey.current = key;
    if (first) return;
    const snd = enterSound(v);
    if (snd) play(snd);
  }, [key, v, play]);

  const showHeader = !!v.group && !NO_HEADER.includes(v.screen.kind);
  const [sheetOpen, setSheetOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const onBoardScreen = v.screen.kind === 'board';
  const callUrl = v.call === 'intro' ? v.videos.intro : v.call === 'wellDone' ? v.videos.wellDone : null;

  return (
    <SfxContext.Provider value={play}>
      <div className="tc-frame">
        <style>{THECODE_STYLE}</style>
        <div dir="rtl" lang="he" className="tc-root flex flex-col" onPointerDown={() => gameSfx().unlock()}>
          <div className="tc-stars" aria-hidden />
          {showHeader && (
            <Header v={v} onToggleMute={callbacks.onToggleMute} onHome={onBoardScreen} onHowTo={() => { play('tap'); callbacks.onShowIntro(); }}
              onGroup={v.profile && callbacks.onUpdateProfile ? () => { play('tap'); setSheetOpen(true); } : undefined}
              onBoard={() => {
                play('tap');
                // Already on the board: back to its top (a tap that did nothing felt broken).
                if (onBoardScreen) mainRef.current?.querySelectorAll<HTMLElement>('*').forEach((el) => { if (el.scrollTop > 0) el.scrollTo({ top: 0, behavior: 'smooth' }); });
                else callbacks.onBoard();
              }} />
          )}
          <main ref={mainRef} className="relative flex-1">
            <div key={key} className="tc-a-rise absolute inset-0">
              <Screen v={v} cb={callbacks} />
            </div>
          </main>
          <ProfileSheet open={sheetOpen && showHeader} profile={v.profile ?? null} profiles={v.profile ? [v.profile] : []}
            selfie={v.selfie} photoBusy={v.photoBusy} onSetPhoto={callbacks.onSetPhoto} onRemovePhoto={callbacks.onRemovePhoto}
            onUpdateProfile={callbacks.onUpdateProfile} muted={v.muted} onToggleMute={callbacks.onToggleMute}
            onClose={() => setSheetOpen(false)} onSwitch={() => setSheetOpen(false)} />
          {!!v.startBurst && !v.call && (
            <div aria-hidden className="pointer-events-none absolute inset-0 z-30"><Confetti burstKey={`start-${v.startBurst}`} /></div>
          )}
          {v.call && (
            <MagicianCall key={v.call} url={callUrl}
              topic={v.call === 'intro' ? 'הקוסם מסביר לקבוצה מה עושים' : 'כל הכבוד! הקוסם מברך את הקבוצה'} onEnd={callbacks.onEndCall} />
          )}
        </div>
      </div>
    </SfxContext.Provider>
  );
}
