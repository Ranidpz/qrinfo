'use client';

// The payoff: arrange the letters → open the suitcase → summary (album + weekly board).

import { useEffect, useRef, useState } from 'react';
import GnomeFigure from '@/components/thecode/GnomeFigure';
import { displayPhrase } from '@/lib/thecode/letters';
import { Avatar } from './Avatar';
import { Confetti, CountUp, HintCard, ScreenBody, Socket, StarCoin, Tile, useSfx } from './ui';
import { avatarOf } from './types';
import type { ArrangeView, LeaderRowView, PlayerProfileView, SuitcaseView, SummaryView } from './types';

// ------------------------------------------------ arrange

/** Each cell's character, with the final form at the end of every completed word. */
function cellChars(a: ArrangeView): (string | null)[] {
  const out: (string | null)[] = [];
  let i = 0;
  for (const len of a.wordLengths) {
    const letters = a.placed.slice(i, i + len).map((p) => (p === null ? null : a.pool[p]));
    if (letters.every((l) => l !== null)) out.push(...[...displayPhrase(letters as string[], [len])]);
    else out.push(...letters);
    i += len;
  }
  return out;
}

interface ArrangeProps {
  arrange: ArrangeView;
  onPlace(poolIndex: number): void;
  onRemove(cellIndex: number): void;
  onHelp(): void;
  onOpen(): void;
}

export function ArrangeScreen({ arrange: a, onPlace, onRemove, onHelp, onOpen }: ArrangeProps) {
  const sfx = useSfx();
  const chars = cellChars(a);
  const full = a.placed.every((x) => x !== null);
  const lastTick = useRef(a.wrongTick);
  useEffect(() => {
    if (a.wrongTick !== lastTick.current) {
      lastTick.current = a.wrongTick;
      sfx('wrong');
    }
  }, [a.wrongTick, sfx]);
  useEffect(() => {
    if (a.solved) sfx('unlock');
  }, [a.solved, sfx]);

  const longest = Math.max(...a.wordLengths);
  const cell = Math.min(56, Math.floor(320 / Math.max(longest, 5)));
  let offset = 0;

  return (
    <ScreenBody className="items-center gap-5 text-center">
      <h2 className="tc-display mt-2 text-4xl leading-tight">{a.solved ? 'הקוד נפתח!' : 'פצחו את הקוד'}</h2>
      <p className="text-lg" style={{ color: 'var(--tc-soft)' }}>
        {a.solved ? 'זה הצירוף הסודי של המזוודה' : 'סדרו את האותיות לצירוף הסודי. הקישו על אות כדי להזיז אותה.'}
      </p>

      <div key={a.wrongTick} className={`flex flex-col items-center gap-4 rounded-3xl px-4 py-5 ${a.wrongTick && !a.solved ? 'tc-a-shake' : ''}`}
        style={{ background: 'rgba(0,0,0,.25)', boxShadow: a.solved ? 'inset 0 0 0 2px var(--tc-mint), 0 0 40px rgba(54,227,154,.25)' : 'inset 0 0 0 1.5px var(--tc-line)' }}>
        {a.wordLengths.map((len, w) => {
          const start = offset;
          offset += len;
          return (
            <div key={w} className="flex gap-2" aria-label={`מילה ${w + 1}`}>
              {Array.from({ length: len }, (_, k) => {
                const idx = start + k;
                const ch = chars[idx];
                return ch ? (
                  <button key={`f${idx}-${a.placed[idx]}`} type="button" disabled={a.locked[idx] || a.solved}
                    onClick={() => { sfx('unplace'); onRemove(idx); }} aria-label={`האות ${ch}, הקישו להחזרה`}>
                    <Tile letter={ch} size={cell} className={a.solved ? 'tc-a-pop' : 'tc-a-drop'}
                      style={a.locked[idx] && !a.solved ? { outline: '3px solid var(--tc-mint)', outlineOffset: 2 } : a.solved ? { animationDelay: `${idx * 70}ms` } : undefined} />
                  </button>
                ) : (
                  <Socket key={`e${idx}`} size={cell} />
                );
              })}
            </div>
          );
        })}
      </div>

      {a.solved ? (
        <button type="button" className="tc-btn tc-btn-primary tc-a-pop mt-auto w-full text-2xl" onClick={() => { sfx('tap'); onOpen(); }}>
          <span aria-hidden>🧳</span> פתחו את המזוודה!
        </button>
      ) : (
        <>
          <div aria-live="polite" className="min-h-[1.75rem] text-lg font-bold" style={{ color: 'var(--tc-coral)' }}>
            {full ? 'המזוודה לא נפתחה. החזירו אות ונסו סדר אחר' : ''}
          </div>
          <div className="flex flex-wrap justify-center gap-2.5" role="group" aria-label="האותיות שאספתם">
            {a.pool.map((l, i) => {
              const used = a.placed.includes(i);
              return used ? (
                <Socket key={i} size={52} />
              ) : (
                <button key={i} type="button" onClick={() => { sfx('place'); onPlace(i); }} aria-label={`הניחו את ${l}`}>
                  <Tile letter={l} size={52} />
                </button>
              );
            })}
          </div>
          <button type="button" className="tc-btn tc-btn-ghost mt-auto w-full" onClick={() => { sfx('tap'); onHelp(); }}>
            מקמו לנו אות <span className="tc-num rounded-full bg-black/30 px-2 py-0.5 text-base" style={{ color: 'var(--tc-coral)' }}>−{a.helpCost}</span>
          </button>
        </>
      )}
    </ScreenBody>
  );
}

// ------------------------------------------------ suitcase

const TREASURE = [
  { x: -78, delay: '1.25s' }, { x: -26, delay: '1.4s' }, { x: 26, delay: '1.32s' }, { x: 78, delay: '1.5s' },
];

/** The suitcase: latches flip, the lid swings back, light and coins pour out. */
function Suitcase() {
  return (
    <div className="relative mx-auto h-[170px] w-[250px]" style={{ perspective: 600 }} aria-hidden>
      {/* glow from inside */}
      <div className="tc-glow absolute -top-28 left-1/2 z-[5] h-72 w-72 -translate-x-1/2 rounded-full mix-blend-screen"
        style={{ background: 'radial-gradient(closest-side, rgba(255,226,140,.95), rgba(255,170,60,.35) 55%, rgba(255,170,60,0))' }} />
      {/* box */}
      <div className="absolute inset-x-0 bottom-0 top-[40px] z-10 rounded-b-3xl rounded-t-lg"
        style={{ background: 'linear-gradient(180deg,#B5541E,#8A3A12)', boxShadow: 'inset 0 -8px 0 rgba(0,0,0,.25), 0 16px 30px rgba(0,0,0,.45)' }}>
        <div className="absolute inset-x-3 top-0 h-5 rounded-b-lg" style={{ background: 'linear-gradient(180deg,#FFE39A,#F4B740)' }} />
        <div className="absolute inset-y-0 left-10 w-5" style={{ background: 'rgba(60,24,6,.45)' }} />
        <div className="absolute inset-y-0 right-10 w-5" style={{ background: 'rgba(60,24,6,.45)' }} />
      </div>
      {/* coins rising out of it */}
      {TREASURE.map((t, i) => (
        <span key={i} className="tc-float-plus absolute left-1/2 top-[30px] z-20"
          style={{ marginLeft: t.x - 16, animationDelay: t.delay, animationDuration: '1.8s' }}>
          <StarCoin size={32} />
        </span>
      ))}
      {/* the open lid's inside, standing up behind the box */}
      <div className="tc-lid-open absolute inset-x-2 bottom-[128px] h-[120px] rounded-t-3xl"
        style={{ background: 'linear-gradient(180deg,#4A1E08,#6B2C0E)', boxShadow: 'inset 0 0 0 6px #A84A18' }}>
        <div className="absolute inset-4 rounded-2xl" style={{ background: 'repeating-linear-gradient(135deg,#7A2E14 0 10px,#6A2610 10px 20px)', opacity: .8 }} />
      </div>
      {/* the closed lid, which flips away */}
      <div className="tc-lid absolute inset-x-0 top-0 z-10 h-[44px] rounded-t-3xl"
        style={{ background: 'linear-gradient(180deg,#D06A2A,#A84A18)', boxShadow: 'inset 0 6px 0 rgba(255,255,255,.18)' }}>
        <div className="absolute -top-6 left-1/2 h-8 w-20 -translate-x-1/2 rounded-t-2xl border-[7px] border-b-0 border-[#5A2E10]" />
        <div className="absolute inset-y-0 left-10 w-5" style={{ background: 'rgba(60,24,6,.45)' }} />
        <div className="absolute inset-y-0 right-10 w-5" style={{ background: 'rgba(60,24,6,.45)' }} />
      </div>
      {/* latches */}
      <div className="tc-latch absolute z-10 left-[50px] top-[30px] h-6 w-8 rounded-md" style={{ background: 'linear-gradient(180deg,#FFD978,#C98A22)' }} />
      <div className="tc-latch absolute z-10 right-[50px] top-[30px] h-6 w-8 rounded-md" style={{ background: 'linear-gradient(180deg,#FFD978,#C98A22)' }} />
    </div>
  );
}

export function SuitcaseScreen({ suitcase, onNext }: { suitcase: SuitcaseView; onNext(): void }) {
  const sfx = useSfx();
  const [bonus, setBonus] = useState(0);
  useEffect(() => {
    sfx('unlock');
    const a = setTimeout(() => sfx('fanfare'), 650);
    const b = setTimeout(() => setBonus(suitcase.bonus), 1300);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [suitcase.bonus, sfx]);
  return (
    <ScreenBody className="items-center justify-center gap-5 text-center">
      <Confetti burstKey={suitcase.suitcaseNumber} />
      <p className="tc-display tc-a-rise text-2xl" style={{ color: 'var(--tc-soft)' }}>מזוודה מספר <span className="tc-num">{suitcase.suitcaseNumber}</span></p>
      <div className="mt-16"><Suitcase /></div>
      <p className="tc-display tc-a-pop text-5xl leading-tight" style={{ color: 'var(--tc-brass-hi)', animationDelay: '1.1s' }}>{suitcase.phraseText}</p>
      <p className="tc-num text-7xl font-black" style={{ color: 'var(--tc-mint)', textShadow: '0 6px 30px rgba(54,227,154,.45)' }}>
        +<CountUp value={bonus} duration={1100} />
      </p>
      <div className="tc-a-stamp rounded-2xl border-4 px-5 py-2" style={{ borderColor: 'var(--tc-mint)', color: 'var(--tc-mint)', animationDelay: '2.2s' }}>
        <p className="tc-display text-2xl">✓ הזכייה נרשמה</p>
      </div>
      <button type="button" className="tc-btn tc-btn-primary mt-2 w-full text-xl" onClick={onNext}>לטבלת הקבוצות</button>
    </ScreenBody>
  );
}

// ------------------------------------------------ summary

const ROW_H = 58;

/** Weekly board: rows start at their old rank and slide to the new one. */
function Leaderboard({ rows, meOutside }: { rows: LeaderRowView[]; meOutside?: { rank: number; points: number } }) {
  const [settled, setSettled] = useState(false);
  const boardRef = useRef<HTMLOListElement>(null);
  // The rank change plays when the board scrolls into view, not while it is off-screen.
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        t = setTimeout(() => setSettled(true), 350);
        io.disconnect();
      }
    }, { threshold: 0.6 });
    io.observe(el);
    return () => { io.disconnect(); if (t) clearTimeout(t); };
  }, []);
  const shown = rows.slice(0, 8);
  const me = rows.findIndex((r) => r.isMe);
  return (
    <div>
      <ol ref={boardRef} className="relative" style={{ height: shown.length * ROW_H }} aria-label="הטבלה של השבוע">
        {shown.map((r, i) => {
          const from = Math.min(r.prevRank, shown.length);
          const climbed = r.prevRank > i;
          return (
            <li key={r.id} className="tc-row-move absolute inset-x-0 flex items-center gap-3 rounded-2xl px-3"
              style={{
                top: i * ROW_H,
                height: ROW_H - 6,
                transform: settled ? 'translateY(0)' : `translateY(${(from - i) * ROW_H}px)`,
                background: r.isMe ? 'linear-gradient(90deg, rgba(244,183,64,.28), rgba(244,183,64,.1))' : 'var(--tc-panel)',
                boxShadow: r.isMe ? 'inset 0 0 0 2px var(--tc-brass)' : 'inset 0 0 0 1px var(--tc-line)',
                zIndex: r.isMe ? 2 : 1,
              }}>
              <span className="tc-num w-7 text-center text-xl" style={{ color: i < 3 ? 'var(--tc-brass)' : 'var(--tc-soft)' }}>{i + 1}</span>
              <Avatar value={avatarOf(r)} size={32} />
              <span className="flex-1 truncate text-start text-lg font-bold">{r.familyName}</span>
              {r.isMe && climbed && settled && <span className="tc-a-pop text-sm font-black" style={{ color: 'var(--tc-mint)' }}>▲ {r.prevRank - i}</span>}
              <span className="tc-num text-lg">{r.points.toLocaleString('en-US')}</span>
            </li>
          );
        })}
      </ol>
      {me >= shown.length ? (
        <p className="mt-2 text-center" style={{ color: 'var(--tc-soft)' }}>אתם במקום {me + 1}</p>
      ) : me < 0 && meOutside ? (
        <p className="mt-2 text-center" style={{ color: 'var(--tc-soft)' }}>אתם במקום <span className="tc-num">{meOutside.rank}</span></p>
      ) : null}
      {!rows.length && (
        <p className="text-center text-lg" style={{ color: 'var(--tc-soft)' }}>עוד אין קבוצות בטבלה. הנקודות הראשונות יכניסו אתכם אליה!</p>
      )}
    </div>
  );
}

interface SummaryProps {
  profile: PlayerProfileView;
  summary: SummaryView;
  onNewSuitcase(): void;
  onBoardScope?(scope: 'week' | 'all'): void;
}

const SCOPES: { id: 'week' | 'all'; label: string }[] = [{ id: 'week', label: 'השבוע' }, { id: 'all', label: 'כל הזמנים' }];

export function SummaryScreen({ profile, summary, onNewSuitcase, onBoardScope }: SummaryProps) {
  const sfx = useSfx();
  const found = summary.album.filter((a) => a.found).length;
  const [pts, setPts] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setPts(profile.points), 150);
    return () => clearTimeout(t);
  }, [profile.points]);
  return (
    <ScreenBody className="items-stretch gap-6">
      <div className="mt-2 text-center">
        <div className="flex justify-center"><Avatar value={avatarOf(profile)} size={52} /></div>
        <h2 className="tc-display text-3xl">{profile.familyName}</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl px-3 py-4 text-center" style={{ background: 'rgba(244,183,64,.12)', boxShadow: 'inset 0 0 0 1.5px rgba(244,183,64,.4)' }}>
          <div className="flex items-center justify-center gap-2"><StarCoin size={30} /><CountUp value={pts} duration={1200} className="text-5xl" /></div>
          <p className="mt-1 text-base" style={{ color: 'var(--tc-soft)' }}>נקודות</p>
        </div>
        <div className="rounded-3xl px-3 py-4 text-center" style={{ background: 'var(--tc-panel)', boxShadow: 'inset 0 0 0 1.5px var(--tc-line)' }}>
          <p className="text-5xl"><span aria-hidden>🧳 </span><span className="tc-num">{profile.suitcasesOpened}</span></p>
          <p className="mt-1 text-base" style={{ color: 'var(--tc-soft)' }}>מזוודות נפתחו</p>
        </div>
      </div>

      <section>
        <h3 className="tc-display mb-1 text-2xl">אלבום הגמדים</h3>
        <p className="mb-3 text-lg" style={{ color: 'var(--tc-soft)' }}>
          מצאתם <span className="tc-num">{found}</span> מתוך <span className="tc-num">{summary.album.length}</span> גמדים
        </p>
        <div className="grid grid-cols-5 gap-2">
          {summary.album.map(({ gnome, found: f }) => (
            <div key={gnome.id} className="flex items-end justify-center rounded-2xl py-1.5"
              style={{ background: f ? 'rgba(255,244,218,.08)' : 'rgba(0,0,0,.25)' }}>
              <GnomeFigure bodyColor={gnome.bodyColor} hatColor={gnome.hatColor} number={gnome.number} size={44} silhouette={!f}
                title={f ? undefined : 'גמד שעוד לא מצאתם'} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="tc-display text-2xl">{summary.boardScope === 'all' ? 'הטבלה של כל הזמנים' : 'הטבלה של השבוע'}</h3>
          {summary.boardScope && onBoardScope && (
            <div className="flex rounded-full p-1" style={{ background: 'rgba(0,0,0,.3)' }} role="group" aria-label="איזו טבלה">
              {SCOPES.map((sc) => (
                <button key={sc.id} type="button" aria-pressed={summary.boardScope === sc.id}
                  onClick={() => { sfx('tap'); onBoardScope(sc.id); }}
                  className="min-h-[40px] rounded-full px-3 text-sm font-bold transition-colors"
                  style={summary.boardScope === sc.id ? { background: 'var(--tc-brass)', color: '#2A1600' } : { color: 'var(--tc-soft)' }}>
                  {sc.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <Leaderboard key={summary.boardScope || 'week'} rows={summary.leaderboard} meOutside={summary.meOutside} />
      </section>

      {summary.canStartNew ? (
        <button type="button" className="tc-btn tc-btn-primary w-full text-xl" onClick={onNewSuitcase}>
          <span aria-hidden>🧳</span> מזוודה חדשה
        </button>
      ) : (
        <HintCard tone="brass" className="text-center">פתחתם את כל המזוודות. כל הכבוד!</HintCard>
      )}
    </ScreenBody>
  );
}
