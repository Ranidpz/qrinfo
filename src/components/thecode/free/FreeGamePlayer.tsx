'use client';

// קוד הגמדים — the "free game" phone app (stage 1: DEMO only, driven by demo/freeDemo.ts).
// Same look and pieces as the guided player (styles, header chips, gnome stage, letter tiles,
// confetti, sounds); only the flow is new: a board of 16 gnomes, any awake one may be scanned,
// a solved / failed gnome sleeps for this group until it wakes with its next riddle.
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
import MagicianCall from './MagicianCall';
import { JOIN_FLY_MS, JOIN_SHOW_MS } from './JoinCelebration';
import RegisterScreen from '@/components/thecode/player/RegisterScreen';
import ScannerScreen from '@/components/thecode/player/ScannerScreen';
import { Avatar } from '@/components/thecode/player/Avatar';
import type { PlayerGnomeView } from '@/components/thecode/player/types';
import {
  ATTEMPTS_PER_RIDDLE, FREE_ALPHABET, FREE_GNOMES, FREE_VENUE_NAME, HINT_COST, SCREEN_HINT, HOT_STREAK_AT, SECOND_ATTEMPT_FACTOR,
  currentRiddle, demoNow, isAsleep, isHot, wakeLabel,
  type FreeDemoState, type FreeGnome, type FreeGnomeProgress,
} from '@/components/thecode/demo/freeDemo';

/** Cliostro's clips. Absent / empty = a drawn placeholder ("משבצת וידאו"). */
export interface FreeGameVideos {
  /** The explanation call right after registering. */
  intro?: string | null;
  /** The "כל הכבוד" call when every gnome sleeps. */
  wellDone?: string | null;
}

export interface FreeGameCallbacks {
  onRegister(name: string, emoji: string): void;
  onOpenGnome(gnomeId: string): void;
  /** The real app opens the camera here; the demo "scans" the gnome at once. */
  onScanGnome(gnomeId: string): void;
  onOpenScanner(): void;
  onScanCode(code: string): void;
  onBuyHint(gnomeId: string): void;
  onPickLetter(letter: string): void;
  onSubmitLetter(): void;
  /** Leave a result screen: to the board, or to the finish when all gnomes sleep. */
  onContinue(): void;
  /** Back to the board without an answer (leaving a riddle costs nothing). */
  onBoard(): void;
  onToggleMute(): void;
  /** "?" in the header / the intro's button: show or leave the explanation screen. */
  onShowIntro(): void;
  /** The "you are on the big screen" moment is over → the magician calls. */
  onJoinedDone(): void;
  /** The magician's video call ended (hung up, clip over, "אחר כך"). */
  onEndCall(): void;
  /** Call the magician again from the rules / finish screen. */
  onCallMagician(call: 'intro' | 'wellDone'): void;
  /** Demo only: the on-screen "continue as if registered" button. */
  onDemoRegistered?(): void;
}

const view = (g: FreeGnome): PlayerGnomeView => ({ id: g.id, number: g.number, bodyColor: g.bodyColor, hatColor: g.hatColor });
const gnomeOf = (id: string) => FREE_GNOMES.find((g) => g.id === id)!;

// ------------------------------------------------ small pieces

function Cost({ amount }: { amount: number }) {
  return <span className="tc-num rounded-full bg-black/30 px-2 py-0.5 text-base" style={{ color: 'var(--tc-coral)' }}>−{amount}</span>;
}

function ColorChip({ color, part, name }: { color: FreeGnome['bodyColor']; part: string; name: string }) {
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

function Header({ s, onBoard, onToggleMute, onHome, onHowTo }: { s: FreeDemoState; onBoard?(): void; onToggleMute(): void; onHome: boolean; onHowTo(): void }) {
  const g = s.group!;
  return (
    <header className="relative z-20 flex items-center gap-2 px-4 pb-2 pt-3">
      <span className="tc-chip w-12 shrink-0 justify-center !px-0" title={g.name} aria-label={`הקבוצה: ${g.name}`}>
        <Avatar value={g.emoji} size={28} />
      </span>
      <div className="flex min-w-0 flex-1 justify-center">
        <HotBadge hot={isHot(s)} streak={Math.min(s.streak, HOT_STREAK_AT)} target={HOT_STREAK_AT} fit="compact" />
      </div>
      <ScoreCounter points={s.points} />
      <button type="button" className="tc-chip tc-display w-11 shrink-0 justify-center !px-0 text-xl" onClick={onHowTo} aria-label="איך משחקים">?</button>
      <button type="button" className="tc-chip w-11 shrink-0 justify-center !px-0" onClick={onToggleMute} aria-label={s.muted ? 'הפעלת צלילים' : 'השתקת צלילים'}>
        <SoundIcon muted={s.muted} />
      </button>
      <button type="button" className="tc-chip w-11 shrink-0 justify-center !px-0" onClick={onBoard} disabled={!onBoard}
        aria-label={onHome ? 'אתם בלוח הגמדים' : 'ללוח הגמדים'} aria-current={onHome ? 'page' : undefined}
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

function GnomeCard({ g, p, now, onOpen }: { g: FreeGnome; p: FreeGnomeProgress; now: number; onOpen(): void }) {
  const asleep = isAsleep(p, now);
  const label = asleep
    ? `גמד ${g.number}, ישן. מתעורר ${wakeLabel(p.asleepUntil!, now)}`
    : `גמד ${g.number}, ${describeGnome(g.bodyColor, g.hatColor)}, ער`;
  return (
    <button type="button" onClick={onOpen} aria-label={label}
      className="relative flex w-full flex-col items-center rounded-2xl px-1 pb-1.5 pt-1 transition-transform active:scale-95"
      style={asleep
        ? { background: 'rgba(0,0,0,.22)', boxShadow: 'inset 0 0 0 1.5px rgba(255,244,218,.06)' }
        : { background: 'linear-gradient(180deg, rgba(255,244,218,.12), rgba(255,244,218,.04))', boxShadow: p.hintBought ? 'inset 0 0 0 2px rgba(244,183,64,.7)' : 'inset 0 0 0 1.5px var(--tc-line)' }}>
      <div style={asleep ? { opacity: 0.5, filter: 'saturate(.45)' } : undefined} className={asleep ? '' : 'tc-a-bob'}>
        <GnomeFigure bodyColor={g.bodyColor} hatColor={g.hatColor} number={g.number} size={44} sleeping={asleep} />
      </div>
      {asleep ? (
        <span className="mt-0.5 flex items-center gap-1 whitespace-nowrap text-[13px] font-bold leading-none" style={{ color: 'var(--tc-soft)' }}>
          {p.last === 'failed'
            ? <span aria-hidden style={{ color: 'var(--tc-coral)' }}>✕</span>
            : p.last ? <span aria-hidden style={{ color: 'var(--tc-mint)' }}>✓</span> : null}
          <span aria-hidden>💤</span><span className="tc-num">{shortWake(p.asleepUntil!, now)}</span>
        </span>
      ) : (
        <span className="mt-0.5 text-[13px] font-bold leading-tight" style={{ color: p.hintBought ? 'var(--tc-brass-hi)' : 'var(--tc-mint)' }}>
          {p.hintBought ? '📍 ער' : 'ער'}
        </span>
      )}
    </button>
  );
}

/** What Cliostro says in each call — the "i" button shows it in writing during the call. */
const INTRO_LINES = [
  'מצאו גמד ער במקום וסרקו את הקוד שלו.',
  'פתרו את החידה שלו: הקישו את האות הראשונה של התשובה.',
  'אחרי החידה הגמד נרדם, ויתעורר אחר כך עם חידה חדשה.',
  'כל חידה מוסיפה נקודות. בדקו איפה אתם על המסך הגדול!',
];
const WELL_DONE_LINES = [
  'כל הכבוד! פתרתם את כל החידות שהגמדים שאלו היום.',
  'גשו לקבלה, מחכה לכם שם פרס.',
  'הגמדים יתעוררו בקרוב עם חידות חדשות.',
];

// ------------------------------------------------ screens

/**
 * Right after registering: the big screen is celebrating THIS group (JoinCelebration), so the
 * phone says so — look up! When the screen's moment ends, Cliostro calls.
 */
function JoinedScreen({ s, onDone }: { s: FreeDemoState; onDone(): void }) {
  const fit = useFit();
  useEffect(() => {
    const t = setTimeout(onDone, JOIN_SHOW_MS + JOIN_FLY_MS);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <ScreenBody className="items-center justify-center gap-5 text-center">
      <Confetti burstKey="joined" />
      <span className="tc-a-pop flex items-center justify-center rounded-full"
        style={{ width: fit(120, 160), height: fit(120, 160), background: 'radial-gradient(circle, #3E2C74, #141a48)', boxShadow: '0 0 0 6px var(--tc-brass), 0 20px 50px rgba(0,0,0,.45)' }}>
        <Avatar value={s.group?.emoji || '🍄'} size={fit(80, 110)} />
      </span>
      <h2 className="tc-display text-[2.3rem] leading-tight" style={{ color: 'var(--tc-brass-hi)' }}>אתם על המסך הגדול!</h2>
      <p className="text-xl leading-snug">הרימו את הראש <span aria-hidden>📺</span><br />{s.group?.name} הצטרפו למשחק</p>
    </ScreenBody>
  );
}

/** After registering: Cliostro explains (video slot), the rules in three short lines, then go. */
function IntroScreen({ onDone, onCall }: { onDone(): void; onCall(): void }) {
  const sfx = useSfx();
  return (
    <ScreenBody className="items-center gap-4 text-center"
      footer={<button type="button" className="tc-btn tc-btn-primary w-full text-xl" onClick={() => { sfx('tap'); onDone(); }}>יוצאים לחפש גמדים</button>}>
      <h2 className="tc-display text-[1.9rem] leading-tight" style={{ color: 'var(--tc-brass-hi)' }}>ככה משחקים</h2>
      <button type="button" className="tc-btn tc-btn-ghost w-full" onClick={() => { sfx('tap'); onCall(); }}>
        <span aria-hidden>🧙‍♂️</span> לשוחח שוב עם הקוסם
      </button>
      <ol className="flex w-full flex-col gap-2 text-start text-lg leading-snug">
        <li className="flex gap-3"><span aria-hidden>🔍</span><span>מצאו גמד ער במקום וסרקו את הקוד שלו</span></li>
        <li className="flex gap-3"><span aria-hidden>🔤</span><span>פתרו את החידה: הקישו את <b>האות הראשונה</b> של התשובה</span></li>
        <li className="flex gap-3"><span aria-hidden>💤</span><span>הגמד נרדם, ויתעורר אחר כך עם חידה חדשה</span></li>
        <li className="flex gap-3"><span aria-hidden>⭐</span><span>כל חידה מוסיפה נקודות. בדקו איפה אתם על המסך הגדול</span></li>
      </ol>
    </ScreenBody>
  );
}

/** "Can't find the screen?" — reveals the venue's hint for where the big screen stands (free). */
function ScreenHint() {
  const sfx = useSfx();
  const [open, setOpen] = useState(false);
  return open ? (
    <HintCard tone="brass" className="tc-a-rise w-full text-start">
      <span aria-hidden className="me-2">📍</span><span className="font-black">המסך נמצא </span>{SCREEN_HINT}
    </HintCard>
  ) : (
    <button type="button" className="tc-btn tc-btn-ghost w-full" onClick={() => { sfx('tap'); setOpen(true); }}>
      לא מצאתם את המסך? רמז
    </button>
  );
}

function StartAtScreenScreen({ gnome, onDemoRegistered }: { gnome: FreeGnome | null; onDemoRegistered?(): void }) {
  const fit = useFit();
  return (
    <ScreenBody className="items-center justify-center gap-4 text-center"
      footer={onDemoRegistered && (
        <button type="button" onClick={onDemoRegistered}
          className="min-h-[52px] w-full rounded-2xl border-2 border-dashed border-amber-300/70 bg-amber-300/10 px-3 text-base font-bold text-amber-200">
          הדגמה בלבד: המשיכו כאילו נרשמתם
        </button>
      )}>
      {gnome && <GnomeStage gnome={view(gnome)} size={fit(84, 120)} className="tc-a-pop" />}
      <h2 className="tc-display text-[2.1rem] leading-tight" style={{ color: 'var(--tc-brass-hi)' }}>מצאתם גמד!</h2>
      <p className="tc-display text-2xl leading-snug">אבל המשחק מתחיל במסך של הגמדים</p>
      <HintCard tone="brass" className="w-full text-start">
        <ol className="flex flex-col gap-2">
          <li><span aria-hidden className="me-2">📺</span>חפשו את המסך הגדול של הגמדים במקום</li>
          <li><span aria-hidden className="me-2">📷</span>סרקו את הקוד שעל המסך והירשמו כקבוצה</li>
          <li><span aria-hidden className="me-2">🍄</span>חזרו לגמדים. כל גמד ער מחכה לכם עם חידה</li>
        </ol>
      </HintCard>
      <ScreenHint />
    </ScreenBody>
  );
}

function BoardScreen({ s, now, cb }: { s: FreeDemoState; now: number; cb: FreeGameCallbacks }) {
  const awake = FREE_GNOMES.filter((g) => !isAsleep(s.gnomes[g.id], now)).length;
  return (
    <ScreenBody className="gap-3"
      footer={<ScanButton onScan={cb.onOpenScanner} label="סרקו גמד" />}>
      <div className="flex items-end justify-between gap-2">
        <h2 className="tc-display text-[1.75rem] leading-none">הגמדים שלכם</h2>
        <p className="text-base font-bold" style={{ color: 'var(--tc-soft)' }}>
          <span style={{ color: 'var(--tc-mint)' }}><span className="tc-num">{awake}</span> ערים</span>
          {awake < FREE_GNOMES.length && <>, <span className="tc-num">{FREE_GNOMES.length - awake}</span> ישנים</>}
        </p>
      </div>
      <p className="-mt-1 text-base leading-snug" style={{ color: 'var(--tc-soft)' }}>
        מצאו גמד ער, סרקו ופתרו את החידה שלו. הקישו על גמד בשביל רמז למקום שלו.
      </p>
      <div className="grid grid-cols-4 gap-2" role="list" aria-label="לוח הגמדים">
        {FREE_GNOMES.map((g) => (
          <div role="listitem" key={g.id}><GnomeCard g={g} p={s.gnomes[g.id]} now={now} onOpen={() => cb.onOpenGnome(g.id)} /></div>
        ))}
      </div>
    </ScreenBody>
  );
}

function GnomeScreen({ s, gnomeId, now, cb }: { s: FreeDemoState; gnomeId: string; now: number; cb: FreeGameCallbacks }) {
  const sfx = useSfx();
  const fit = useFit();
  const g = gnomeOf(gnomeId);
  const p = s.gnomes[gnomeId];
  const asleep = isAsleep(p, now);
  const canPay = s.points >= HINT_COST;
  return (
    <ScreenBody className="items-center gap-3 text-center"
      footer={(
        <div className="flex flex-col gap-2">
          {asleep ? (
            <button type="button" className="tc-btn tc-btn-primary w-full text-xl" onClick={cb.onBoard}>חזרה ללוח</button>
          ) : (
            <>
              <button type="button" className="tc-btn tc-btn-primary w-full text-xl" onClick={() => { sfx('tap'); cb.onScanGnome(gnomeId); }}>מצאנו! סרקו אותו</button>
              <button type="button" className="tc-btn tc-btn-ghost w-full" onClick={cb.onBoard}>חזרה ללוח</button>
            </>
          )}
        </div>
      )}>
      <p className="tc-display rounded-full px-4 py-1 text-lg" style={{ background: 'rgba(244,183,64,.18)', color: 'var(--tc-brass-hi)' }}>
        גמד <span className="tc-num">{g.number}</span>
      </p>
      <GnomeStage gnome={view(g)} size={140} fit={`clamp(100px, 20svh, ${fit(130, 170)}px)`} sleeping={asleep} className="tc-a-pop" />
      <p className="tc-display text-[1.5rem] leading-tight" style={{ color: 'var(--tc-brass-hi)' }}>{describeGnome(g.bodyColor, g.hatColor)}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <ColorChip color={g.bodyColor} part="גוף" name={colorNameHe(g.bodyColor, 'body')} />
        <ColorChip color={g.hatColor} part="מצנפת" name={colorNameHe(g.hatColor, 'hat')} />
      </div>
      {asleep ? (
        <HintCard className="w-full text-lg">
          <span aria-hidden className="me-2">💤</span>הגמד ישן. הוא יתעורר {wakeLabel(p.asleepUntil!, now)} עם חידה חדשה.
        </HintCard>
      ) : p.hintBought ? (
        <HintCard tone="brass" className="tc-a-rise w-full text-lg">
          <span aria-hidden className="me-2">📍</span><span className="font-black">איפה: </span>{g.hint}
        </HintCard>
      ) : (
        <div className="flex w-full flex-col gap-1.5">
          <button type="button" className="tc-btn tc-btn-ghost w-full" disabled={!canPay} onClick={() => { sfx('tap'); cb.onBuyHint(gnomeId); }}>
            איפה הוא? רמז למקום <Cost amount={HINT_COST} />
          </button>
          {!canPay && <p className="text-base" style={{ color: 'var(--tc-soft)' }}>רמז עולה {HINT_COST} נקודות. פתרו חידה ותוכלו לקנות.</p>}
        </div>
      )}
    </ScreenBody>
  );
}

function LetterPad({ picked, disabled, onPick }: { picked: string | null; disabled: boolean; onPick(l: string): void }) {
  return (
    <div className="grid w-full grid-cols-6 gap-1.5" role="group" aria-label="לוח אותיות">
      {FREE_ALPHABET.map((l) => (
        <button key={l} type="button" className="tc-key tc-display" aria-pressed={picked === l} disabled={disabled} onClick={() => onPick(l)}>
          {l}
        </button>
      ))}
    </div>
  );
}

function RiddleScreen({ s, gnomeId, cb }: { s: FreeDemoState; gnomeId: string; cb: FreeGameCallbacks }) {
  const sfx = useSfx();
  const g = gnomeOf(gnomeId);
  const p = s.gnomes[gnomeId];
  const riddle = currentRiddle(s, gnomeId)!;
  const lastTick = useRef(s.wrongTick);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (s.wrongTick === lastTick.current) return;
    lastTick.current = s.wrongTick;
    sfx('wrong');
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 900);
    return () => clearTimeout(t);
  }, [s.wrongTick, sfx]);
  const [fresh] = useState(() => p.wrongs === 0);
  useEffect(() => { if (fresh) sfx('correct'); }, [fresh, sfx]);
  const left = ATTEMPTS_PER_RIDDLE - p.wrongs;
  const half = Math.round(SECOND_ATTEMPT_FACTOR * 100);
  return (
    <ScreenBody className="items-stretch gap-4"
      footer={(
        <div className="flex flex-col gap-2.5">
          <div key={s.wrongTick} className={`flex min-h-[2.75rem] items-center justify-between gap-3 ${s.wrongTick && p.wrongs ? 'tc-a-shake' : ''}`}>
            {p.wrongs > 0 && left > 0 ? (
              <p role="alert" className="text-base font-bold leading-snug" style={{ color: 'var(--tc-coral)' }}>
                לא זו האות. יש לכם עוד ניסיון אחד, על {half === 50 ? 'חצי מהנקודות' : `${half}% מהנקודות`}
              </p>
            ) : (
              <>
                <p className="text-base leading-snug">הקישו את <b>האות הראשונה</b> של התשובה</p>
                <span className="shrink-0 rounded-full px-2.5 py-1 text-sm font-bold" style={{ background: 'rgba(255,244,218,.08)', color: 'var(--tc-soft)' }}>
                  {ATTEMPTS_PER_RIDDLE} ניסיונות
                </span>
              </>
            )}
          </div>
          <LetterPad picked={s.pendingLetter} disabled={false} onPick={(l) => { sfx('key'); cb.onPickLetter(l); }} />
          <div className="flex items-center gap-3">
            {s.pendingLetter ? <Tile letter={s.pendingLetter} size={46} className="tc-a-pop shrink-0" /> : <Socket size={46} className="shrink-0">{flash ? '✕' : '?'}</Socket>}
            <button type="button" className="tc-btn tc-btn-primary flex-1 text-xl" disabled={!s.pendingLetter} onClick={() => { sfx('tap'); cb.onSubmitLetter(); }}>
              בדקו
            </button>
          </div>
        </div>
      )}>
      <div className="flex items-center gap-3">
        <div className={fresh ? 'tc-a-hop' : ''}><GnomeStage gnome={view(g)} size={58} /></div>
        <div className="min-w-0 flex-1">
          <p className={`tc-display text-[1.9rem] leading-none ${fresh ? 'tc-a-bounce-in' : ''}`} style={{ color: 'var(--tc-mint)' }}>הגמד ער!</p>
          <p className="mt-1 text-base" style={{ color: 'var(--tc-soft)' }}>גמד <span className="tc-num">{g.number}</span> שואל אתכם</p>
        </div>
        <button type="button" className="tc-chip min-h-[44px] shrink-0" onClick={cb.onBoard}>ללוח</button>
      </div>
      <div className="tc-a-rise rounded-3xl px-5 py-5" style={{ background: 'linear-gradient(180deg, rgba(255,244,218,.1), rgba(255,244,218,.04))', boxShadow: 'inset 0 0 0 1.5px var(--tc-line)' }}>
        <p className="tc-display text-[1.6rem] leading-snug">{riddle.text}</p>
      </div>
    </ScreenBody>
  );
}

function CorrectScreen({ s, now, cb }: { s: FreeDemoState; now: number; cb: FreeGameCallbacks }) {
  const fit = useFit();
  const c = s.correct!;
  const p = s.gnomes[c.gnomeId];
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
              <p className="text-base font-bold leading-snug">שלוש ברצף! מעכשיו כל חידה שווה <span className="whitespace-nowrap">פי 2</span></p>
            </div>
          ) : c.hot ? (
            <p className="tc-display text-center text-xl" style={{ color: 'var(--tc-flame)' }}>🔥 עדיין חמים, פי 2!</p>
          ) : null}
          <button type="button" className="tc-btn tc-btn-primary w-full text-xl" onClick={cb.onContinue}>
            {c.allAsleep ? 'כל הגמדים נרדמו! מה עכשיו?' : 'ללוח הגמדים'}
          </button>
        </div>
      )}>
      <Confetti burstKey={`${c.gnomeId}-${s.solved}`} />
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
      {c.half && <p className="text-lg font-bold" style={{ color: 'var(--tc-brass-hi)' }}>בניסיון השני: חצי מהנקודות</p>}
      {c.spellingTip && (
        <HintCard tone="brass" className="w-full text-lg"><span aria-hidden className="me-2">✏️</span>{c.spellingTip}</HintCard>
      )}
      <p className="text-lg leading-snug" style={{ color: 'var(--tc-soft)' }}>
        <span aria-hidden>💤 </span>הגמד הלך לישון. הוא יתעורר {wakeLabel(p.asleepUntil!, now)} עם חידה חדשה.
      </p>
    </ScreenBody>
  );
}

function FailedScreen({ s, gnomeId, allSleep, now, cb }: { s: FreeDemoState; gnomeId: string; allSleep: boolean; now: number; cb: FreeGameCallbacks }) {
  const fit = useFit();
  const g = gnomeOf(gnomeId);
  const p = s.gnomes[gnomeId];
  return (
    <ScreenBody className="items-center justify-center gap-4 text-center"
      footer={<button type="button" className="tc-btn tc-btn-primary w-full text-xl" onClick={cb.onContinue}>{allSleep ? 'כל הגמדים נרדמו! מה עכשיו?' : 'לגמד ער אחר'}</button>}>
      <GnomeStage gnome={view(g)} size={fit(90, 130)} sleeping />
      <h2 className="tc-display text-4xl leading-tight">לא הפעם</h2>
      <p className="text-xl leading-snug">הגמד התעייף והלך לישון.</p>
      <HintCard tone="brass" className="w-full text-lg">
        לא ירדו לכם נקודות. הגמד יתעורר {wakeLabel(p.asleepUntil!, now)} עם חידה חדשה, ואז אפשר לנסות שוב.
      </HintCard>
    </ScreenBody>
  );
}

function AsleepScreen({ s, gnomeId, now, cb }: { s: FreeDemoState; gnomeId: string; now: number; cb: FreeGameCallbacks }) {
  const fit = useFit();
  const g = gnomeOf(gnomeId);
  const p = s.gnomes[gnomeId];
  return (
    <ScreenBody className="items-center justify-center gap-4 text-center"
      footer={<button type="button" className="tc-btn tc-btn-primary w-full text-xl" onClick={cb.onBoard}>לגמד ער אחר</button>}>
      <GnomeStage gnome={view(g)} size={fit(90, 130)} sleeping />
      <h2 className="tc-display text-4xl leading-tight">ששש… הגמד ישן</h2>
      <p className="text-xl leading-snug" style={{ color: 'var(--tc-soft)' }}>
        {p.last === 'failed' ? 'הוא עוד עייף מהחידה הקודמת.' : 'כבר פתרתם את החידה שלו.'}
        {' '}הוא יתעורר {wakeLabel(p.asleepUntil!, now)} עם חידה חדשה.
      </p>
      <p className="text-lg" style={{ color: 'var(--tc-brass-hi)' }}>בינתיים יש עוד גמדים ערים במקום</p>
    </ScreenBody>
  );
}

function FinishedScreen({ s, now, onCall }: { s: FreeDemoState; now: number; onCall(): void }) {
  const wakes = FREE_GNOMES.map((g) => s.gnomes[g.id].asleepUntil ?? 0).filter((t) => t > now);
  const first = wakes.length ? Math.min(...wakes) : null;
  return (
    <ScreenBody className="items-center justify-center gap-4 text-center">
      <Confetti burstKey={`done-${s.solved}`} />
      <div className="tc-a-pop text-8xl leading-none" aria-hidden>🎁</div>
      <h2 className="tc-display text-[2.4rem] leading-tight" style={{ color: 'var(--tc-brass-hi)' }}>סיימתם להיום!</h2>
      <p className="text-xl leading-snug">כל הגמדים ישנים. גשו לקבלה, מחכה לכם שם פרס.</p>
      <div className="flex items-center gap-2 text-4xl"><StarCoin size={34} /><CountUp value={s.points} /></div>
      <p className="text-lg" style={{ color: 'var(--tc-soft)' }}>פתרתם <span className="tc-num">{s.solved}</span> חידות</p>
      {first && (
        <p className="text-base" style={{ color: 'var(--tc-soft)' }}>הגמד הראשון יתעורר {wakeLabel(first, now)} עם חידה חדשה.</p>
      )}
      <button type="button" className="tc-btn tc-btn-ghost w-full" onClick={onCall}>
        <span aria-hidden>🧙‍♂️</span> הברכה של הקוסם
      </button>
    </ScreenBody>
  );
}

function Screen({ s, now, cb }: { s: FreeDemoState; now: number; cb: FreeGameCallbacks }) {
  const sc = s.screen;
  switch (sc.kind) {
    case 'startAtScreen':
      return <StartAtScreenScreen gnome={sc.gnomeId ? gnomeOf(sc.gnomeId) : null} onDemoRegistered={cb.onDemoRegistered} />;
    case 'register':
      return (
        <RegisterScreen venueName={FREE_VENUE_NAME} mode="new" addingProfile={false}
          branding={{ welcomeText: 'הגמדים מסתתרים בכל המקום, וכל אחד מחכה עם חידה. בחרו כינוי לקבוצה ויוצאים לדרך!' }}
          onRegister={(name, emoji) => cb.onRegister(name, emoji)} onRecover={() => {}} onMode={() => {}} />
      );
    case 'board':
      return <BoardScreen s={s} now={now} cb={cb} />;
    case 'scanner':
      return <ScannerScreen scanner={{ camera: false, error: sc.error, busy: false }} onScanCode={cb.onScanCode} onClose={cb.onBoard} />;
    case 'gnome':
      return <GnomeScreen s={s} gnomeId={sc.gnomeId} now={now} cb={cb} />;
    case 'riddle':
      return <RiddleScreen s={s} gnomeId={sc.gnomeId} cb={cb} />;
    case 'correct':
      return s.correct ? <CorrectScreen s={s} now={now} cb={cb} /> : null;
    case 'failed':
      return <FailedScreen s={s} gnomeId={sc.gnomeId} allSleep={sc.allAsleep} now={now} cb={cb} />;
    case 'asleep':
      return <AsleepScreen s={s} gnomeId={sc.gnomeId} now={now} cb={cb} />;
    case 'finished':
      return <FinishedScreen s={s} now={now} onCall={() => cb.onCallMagician('wellDone')} />;
    case 'joined':
      return <JoinedScreen s={s} onDone={cb.onJoinedDone} />;
    case 'intro':
      return <IntroScreen onDone={cb.onBoard} onCall={() => cb.onCallMagician('intro')} />;
  }
}

function screenKey(s: FreeDemoState): string {
  const sc = s.screen;
  if (sc.kind === 'riddle' || sc.kind === 'gnome' || sc.kind === 'asleep' || sc.kind === 'failed') return `${sc.kind}-${sc.gnomeId}`;
  return sc.kind;
}

function enterSound(s: FreeDemoState): SfxName | null {
  switch (s.screen.kind) {
    case 'correct': return s.correct?.becameHot ? 'hot' : 'correct';
    case 'failed':
    case 'asleep':
    case 'startAtScreen': return 'warn';
    case 'finished': return 'fanfare';
    case 'joined': return 'hot';
    default: return null;
  }
}

const NO_HEADER: FreeDemoState['screen']['kind'][] = ['startAtScreen', 'register', 'joined'];

/** `realNow` ticks in the parent; the demo clock adds the time-travel offset. */
export default function FreeGamePlayer({ state, realNow, callbacks, videos }: { state: FreeDemoState; realNow: number; callbacks: FreeGameCallbacks; videos?: FreeGameVideos }) {
  const mutedRef = useRef(state.muted);
  useEffect(() => { mutedRef.current = state.muted; }, [state.muted]);
  const play = useCallback((name: SfxName) => { if (!mutedRef.current) gameSfx().play(name); }, []);

  const key = screenKey(state);
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    if (lastKey.current === key) return;
    const first = lastKey.current === null;
    lastKey.current = key;
    if (first) return;
    const snd = enterSound(state);
    if (snd) play(snd);
  }, [key, state, play]);

  const now = demoNow(state, realNow);
  const showHeader = !!state.group && !NO_HEADER.includes(state.screen.kind);
  const onBoardScreen = state.screen.kind === 'board';

  return (
    <SfxContext.Provider value={play}>
      <div className="tc-frame">
        <style>{THECODE_STYLE}</style>
        <div dir="rtl" lang="he" className="tc-root flex flex-col" onPointerDown={() => gameSfx().unlock()}>
          <div className="tc-stars" aria-hidden />
          {showHeader && (
            <Header s={state} onToggleMute={callbacks.onToggleMute} onHome={onBoardScreen} onHowTo={() => { play('tap'); callbacks.onShowIntro(); }}
              onBoard={onBoardScreen ? undefined : () => { play('tap'); callbacks.onBoard(); }} />
          )}
          <main className="relative flex-1">
            <div key={key} className="tc-a-rise absolute inset-0">
              <Screen s={state} now={now} cb={callbacks} />
            </div>
          </main>
          {state.call && (
            <MagicianCall key={state.call} url={state.call === 'intro' ? videos?.intro : videos?.wellDone}
              topic={state.call === 'intro' ? 'הקוסם מסביר לקבוצה מה עושים' : 'כל הכבוד! הקוסם מברך את הקבוצה'}
              lines={state.call === 'intro' ? INTRO_LINES : WELL_DONE_LINES} onEnd={callbacks.onEndCall} />
          )}
        </div>
      </div>
    </SfxContext.Provider>
  );
}
