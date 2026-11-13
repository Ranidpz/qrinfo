'use client';

// The hunt loop: target → (scan) → riddle → correct, plus the scan warnings.

import { useEffect, useRef, useState } from 'react';
import { THECODE_COLORS, colorNameHe, describeGnome } from '@/components/thecode/GnomeFigure';
import { Collector, Confetti, CountUp, GnomeStage, HintCard, ScreenBody, Socket, Tile, useSfx } from './ui';
import type { CollectorView, CorrectView, PlayerGnomeView, RiddleView, TargetView } from './types';

// ------------------------------------------------ pieces

/** One colour of the gnome, with the PART in bold ("גוף" / "מצנפת") so swapped pairs don't read alike. */
function ColorChip({ color, part, name }: { color: PlayerGnomeView['bodyColor']; part: string; name: string }) {
  return (
    <span className="tc-chip text-base">
      <span aria-hidden className="h-5 w-5 rounded-full" style={{ background: THECODE_COLORS[color].hex, boxShadow: '0 0 0 2px rgba(0,0,0,.4), 0 0 0 3.5px rgba(255,244,218,.4)' }} />
      <span><span className="font-black" style={{ color: 'var(--tc-brass-hi)' }}>{part}</span> {name}</span>
    </span>
  );
}

/** "−20" with a coin — the cost of an action, shown on its button. */
function Cost({ amount }: { amount: number }) {
  if (!amount) return <span className="rounded-full bg-[var(--tc-mint)] px-2 py-0.5 text-sm font-black text-[#053320]">חינם</span>;
  return <span className="tc-num rounded-full bg-black/30 px-2 py-0.5 text-base" style={{ color: 'var(--tc-coral)' }}>−{amount}</span>;
}

function ScanIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
      <rect x="8" y="8" width="8" height="8" rx="1" />
    </svg>
  );
}

/** The one big action of the hunt: open the camera inside the game page. */
export function ScanButton({ onScan, label = 'סרקו גמד' }: { onScan(): void; label?: string }) {
  const sfx = useSfx();
  return (
    <button type="button" className="tc-btn tc-btn-primary w-full text-2xl" onClick={() => { sfx('tap'); onScan(); }}>
      <ScanIcon size={30} /> {label}
    </button>
  );
}

export function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

// ------------------------------------------------ target

export function TargetScreen({ target, collector, onHint, onScan }: { target: TargetView; collector: CollectorView | null; onHint(): void; onScan(): void }) {
  const sfx = useSfx();
  const g = target.gnome;
  const lastHint = target.hintsShown.length - 1;
  const first = target.slotNumber === 1 && !(collector?.letters.length);
  return (
    <ScreenBody className="items-center gap-3"
      footer={(
        <div className="flex flex-col gap-2.5">
          {collector && <Collector collector={collector} size={30} />}
          <ScanButton onScan={onScan} label={first ? 'מצאתם? סרקו את הגמד' : 'סרקו עכשיו'} />
        </div>
      )}>
      {/* Rani (live): after a find, the next target must read as NEW (gnome 5 yellow/blue vs gnome 1 blue/yellow looked the same) */}
      <p key={`next-${target.slotNumber}`} className="tc-a-pop tc-display rounded-full px-4 py-1 text-lg"
        style={first ? { color: 'var(--tc-soft)' } : { background: 'rgba(244,183,64,.18)', color: 'var(--tc-brass-hi)', boxShadow: 'inset 0 0 0 1.5px rgba(244,183,64,.45)' }}>
        {first ? 'הגמד הראשון שלכם' : <>היעד הבא: גמד <span className="tc-num">{target.slotNumber}</span> מתוך <span className="tc-num">{collector?.total ?? '?'}</span></>}
      </p>
      <h2 className="tc-display text-center text-[2rem] leading-tight">מצאו את הגמד</h2>
      {/* Rani (live, iPhone): the gnome is smaller so the colours + the place hint show at once */}
      <GnomeStage gnome={g} size={150} fit="min(170px, 22svh)" className="tc-a-pop" />
      <p className="tc-display text-center text-[1.6rem] leading-tight" style={{ color: 'var(--tc-brass-hi)' }}>
        {describeGnome(g.bodyColor, g.hatColor)}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <ColorChip color={g.bodyColor} part="גוף" name={colorNameHe(g.bodyColor, 'body')} />
        <ColorChip color={g.hatColor} part="מצנפת" name={colorNameHe(g.hatColor, 'hat')} />
      </div>

      <div className="flex w-full flex-col gap-2">
        {/* No location hint at all (the operator wrote none) → at least the place's name */}
        {!target.hintsShown.length && target.placeName && (
          <HintCard tone="brass" className="tc-a-rise">
            <span aria-hidden className="me-2">📍</span><span className="font-black">איפה: </span>{target.placeName}
          </HintCard>
        )}
        {target.hintsShown.map((h, i) => (
          <HintCard key={i} tone={i === lastHint ? 'brass' : 'plain'} className={i === lastHint ? 'tc-a-rise' : ''}>
            <span aria-hidden className="me-2">{i === 0 ? '📍' : '🔎'}</span>{h}
            {i === 0 && target.placeName && (
              <span className="mt-1 block text-sm" style={{ color: 'var(--tc-soft)' }}>המקום: {target.placeName}</span>
            )}
          </HintCard>
        ))}
      </div>
      {target.nextHintCost !== null ? (
        <button type="button" className="tc-btn tc-btn-ghost w-full" onClick={() => { sfx('tap'); onHint(); }}>
          רמז נוסף <Cost amount={target.nextHintCost} />
        </button>
      ) : (
        <p className="text-base" style={{ color: 'var(--tc-soft)' }}>זה הרמז האחרון. אתם ממש קרובים!</p>
      )}
    </ScreenBody>
  );
}

// ------------------------------------------------ riddle + letter pad

function LetterPad({ alphabet, picked, disabled, onPick }: { alphabet: string[]; picked: string | null; disabled: boolean; onPick(l: string): void }) {
  return (
    <div className="grid w-full grid-cols-6 gap-1.5" role="group" aria-label="לוח אותיות">
      {alphabet.map((l) => (
        <button key={l} type="button" className="tc-key tc-display" aria-pressed={picked === l} disabled={disabled} onClick={() => onPick(l)}>
          {l}
        </button>
      ))}
    </div>
  );
}

interface RiddleProps {
  riddle: RiddleView;
  alphabet: string[];
  onPick(l: string): void;
  onSubmit(): void;
  onHint(): void;
}

export function RiddleScreen({ riddle, alphabet, onPick, onSubmit, onHint }: RiddleProps) {
  const sfx = useSfx();
  const now = useNow(riddle.cooldownUntil !== null);
  const coolLeft = riddle.cooldownUntil ? Math.max(0, Math.ceil((riddle.cooldownUntil - now) / 1000)) : 0;
  const cooling = coolLeft > 0;
  const lastTick = useRef(riddle.wrongTick);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (riddle.wrongTick === lastTick.current) return;
    lastTick.current = riddle.wrongTick;
    sfx(riddle.cooldownUntil ? 'penalty' : 'wrong');
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 900);
    return () => clearTimeout(t);
  }, [riddle.wrongTick, riddle.cooldownUntil, sfx]);

  const freeLeft = riddle.freeWrongAnswers - riddle.wrongCount;
  const g = riddle.gnome;
  // Just found (nothing tried on this riddle yet): celebrate once per screen opening.
  const [fresh] = useState(() => riddle.wrongCount === 0 && riddle.hintsShown.length === 0 && !riddle.pendingLetter);
  useEffect(() => { if (fresh) sfx('correct'); }, [fresh, sfx]);
  return (
    <ScreenBody className="items-stretch gap-4"
      footer={(
      <div className="flex gap-3">
        <button type="button" className="tc-btn tc-btn-primary flex-1 text-xl" disabled={!riddle.pendingLetter || cooling || riddle.submitting}
          onClick={() => { sfx('tap'); onSubmit(); }}>
          {riddle.submitting ? 'בודקים…' : 'בדקו'}
        </button>
        {riddle.nextHintCost !== null && (
          <button type="button" className={`tc-btn tc-btn-ghost ${cooling || riddle.wrongCount > 0 ? 'tc-a-pop' : ''}`} onClick={() => { sfx('tap'); onHint(); }}>
            רמז <Cost amount={riddle.nextHintCost} />
          </button>
        )}
      </div>
      )}>
      {/* Rani (live): finding the gnome is a moment — foil confetti, a bouncing title, a hop. */}
      {fresh && <Confetti burstKey={`found-${g.id}`} />}
      <div className="flex items-center gap-3">
        <div className={fresh ? 'tc-a-hop' : ''}><GnomeStage gnome={g} size={58} /></div>
        <div>
          <p className={`tc-display text-[2rem] leading-none ${fresh ? 'tc-a-bounce-in' : ''}`} style={{ color: 'var(--tc-mint)' }}>זה הגמד שלכם!</p>
          <p className="mt-1 text-base" style={{ color: 'var(--tc-soft)' }}>הנה החידה שלו</p>
        </div>
      </div>

      <div className="tc-a-rise rounded-3xl px-5 py-5" style={{ background: 'linear-gradient(180deg, rgba(255,244,218,.1), rgba(255,244,218,.04))', boxShadow: 'inset 0 0 0 1.5px var(--tc-line)' }}>
        {riddle.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={riddle.imageUrl} alt="" className="mb-4 max-h-44 w-full rounded-2xl object-cover" />
        )}
        <p className="tc-display text-[1.65rem] leading-snug">{riddle.text}</p>
        {riddle.hintsShown.map((h, i) => (
          <p key={i} className="tc-a-rise mt-3 text-lg" style={{ color: 'var(--tc-brass-hi)' }}>
            <span aria-hidden className="me-1">💡</span>{h}
          </p>
        ))}
      </div>

      <div key={riddle.wrongTick} className={`flex items-center justify-between gap-3 ${riddle.wrongTick ? 'tc-a-shake' : ''}`}>
        <p className="text-lg leading-snug">הקישו את <b>האות הראשונה</b> של התשובה</p>
        {riddle.pendingLetter ? (
          <Tile letter={riddle.pendingLetter} size={58} className="tc-a-pop shrink-0" />
        ) : (
          <Socket size={58} className="shrink-0">{flash ? '✕' : '?'}</Socket>
        )}
      </div>

      <div aria-live="polite" className="min-h-[1.75rem] text-center text-lg font-bold">
        {cooling ? (
          <span style={{ color: 'var(--tc-coral)' }}>רגע, נושמים עמוק… עוד <span className="tc-num">{coolLeft}</span> שניות</span>
        ) : flash ? (
          <span style={{ color: 'var(--tc-coral)' }}>
            {freeLeft > 0 ? `לא זו האות. עוד ${freeLeft === 1 ? 'ניסיון אחד' : `${freeLeft} ניסיונות`} בלי הורדת נקודות` : 'לא זו האות. נסו שוב'}
          </span>
        ) : null}
      </div>

      <div className="relative">
        <LetterPad alphabet={alphabet} picked={riddle.pendingLetter} disabled={cooling || riddle.submitting}
          onPick={(l) => { sfx('key'); onPick(l); }} />
        {cooling && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[#0B1030]/75">
            <span className="tc-num tc-a-pop text-7xl" style={{ color: 'var(--tc-coral)' }}>{coolLeft}</span>
          </div>
        )}
      </div>

    </ScreenBody>
  );
}

// ------------------------------------------------ correct

export function CorrectScreen({ correct, collector, onContinue }: { correct: CorrectView; collector: CollectorView | null; onContinue(): void }) {
  const [shownPoints, setShownPoints] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setShownPoints(correct.points), 350);
    return () => clearTimeout(t);
  }, [correct.points]);
  return (
    <ScreenBody className="items-center justify-center gap-5 text-center"
      footer={<button type="button" className="tc-btn tc-btn-primary w-full text-xl" onClick={onContinue}>
        {correct.lastLetter ? 'יש לכם את כל האותיות! לפיצוח הקוד' : 'לגמד הבא'}
      </button>}>
      {(correct.becameHot || correct.lastLetter) && <Confetti burstKey={`${correct.letter}${correct.points}`} />}
      <p className="tc-display tc-a-rise text-4xl" style={{ color: 'var(--tc-mint)' }}>נכון!</p>
      <div className="relative">
        <div aria-hidden className="tc-rays absolute -inset-16 opacity-40"
          style={{ background: 'repeating-conic-gradient(from 0deg, rgba(255,217,120,.35) 0 10deg, transparent 10deg 30deg)', borderRadius: '50%', maskImage: 'radial-gradient(closest-side, #000 40%, transparent)' }} />
        <Tile letter={correct.letter} size={128} className="tc-a-pop" />
      </div>
      <p className="tc-num tc-a-pop tc-delay-3 text-7xl font-black" style={{ color: 'var(--tc-mint)', textShadow: '0 6px 30px rgba(54,227,154,.45)' }}>
        +<CountUp value={shownPoints} duration={700} />
      </p>
      {correct.becameHot ? (
        <div className="tc-a-stamp rounded-3xl px-5 py-3 text-[#2A0E00]" style={{ background: 'linear-gradient(180deg,#FFC24B,#FF8A2B)' }}>
          <p className="tc-display text-3xl"><span className="tc-a-flicker">🔥</span> שחקנים חמים!</p>
          <p className="text-lg font-bold">שלוש ברצף! מעכשיו כל אות שווה <span className="whitespace-nowrap">פי 2</span></p>
        </div>
      ) : correct.hot ? (
        <p className="tc-display text-2xl" style={{ color: 'var(--tc-flame)' }}>🔥 עדיין חמים, פי 2!</p>
      ) : null}
      {correct.spellingTip && (
        <HintCard tone="brass" className="tc-a-rise tc-delay-4 w-full text-xl">
          <span aria-hidden className="me-2">✏️</span>{correct.spellingTip}
        </HintCard>
      )}
      <p className="text-lg" style={{ color: 'var(--tc-soft)' }}>האות {correct.letter}׳ נכנסה לשק שלכם</p>
      {collector && <Collector collector={collector} size={40} />}
    </ScreenBody>
  );
}

// ------------------------------------------------ scan warnings

interface WrongProps {
  gnome: PlayerGnomeView;
  penalty: number;
  freeLeft: number;
  target: TargetView | null;
  onContinue(): void;
}

export function WrongGnomeScreen({ gnome, penalty, freeLeft, target, onContinue }: WrongProps) {
  return (
    <ScreenBody className="items-center justify-center gap-5 text-center"
      footer={<button type="button" className="tc-btn tc-btn-primary w-full text-xl" onClick={onContinue}>חזרה לחיפוש</button>}>
      <GnomeStage gnome={gnome} size={120} className="tc-a-wobble" />
      <h2 className="tc-display tc-a-pop text-5xl leading-tight" style={{ color: penalty ? '#FFD1D7' : 'var(--tc-brass-hi)' }}>נא נא!</h2>
      <p className="tc-display text-2xl">זה לא הגמד שלכם</p>
      {penalty > 0 ? (
        <div className="relative h-24 w-full">
          <span className="tc-num tc-float-minus absolute inset-x-0 top-0 text-8xl font-black" style={{ animationDuration: '2.2s' }}>−{penalty}</span>
          <p className="absolute inset-x-0 bottom-0 text-lg font-bold" style={{ color: '#FFB3BD' }}>ירדו לכם {penalty} נקודות</p>
        </div>
      ) : (
        <HintCard tone="brass" className="w-full text-lg">
          {freeLeft > 0
            ? `הפעם בחינם. נשארו עוד ${freeLeft} טעויות בלי הורדת נקודות.`
            : 'הפעם בחינם. מהטעות הבאה יורדות נקודות, אז הסתכלו טוב על הצבעים.'}
        </HintCard>
      )}
      {target && (
        <div className="flex w-full items-center gap-3 rounded-2xl px-4 py-3" style={{ background: 'rgba(0,0,0,.25)' }}>
          <GnomeStage gnome={target.gnome} size={48} />
          <div className="text-start">
            <p className="text-sm" style={{ color: 'var(--tc-soft)' }}>אתם מחפשים את</p>
            <p className="tc-display text-xl leading-tight">{describeGnome(target.gnome.bodyColor, target.gnome.hatColor)}</p>
          </div>
        </div>
      )}
    </ScreenBody>
  );
}

export function AlreadySolvedScreen({ gnome, onContinue }: { gnome: PlayerGnomeView; onContinue(): void }) {
  return (
    <ScreenBody className="items-center justify-center gap-5 text-center"
      footer={<button type="button" className="tc-btn tc-btn-primary w-full text-xl" onClick={onContinue}>חזרה לחיפוש</button>}>
      <div className="relative">
        <GnomeStage gnome={gnome} size={130} />
        <span className="tc-a-stamp absolute -left-3 top-6 flex h-14 w-14 items-center justify-center rounded-full text-3xl font-black text-[#053320]" style={{ background: 'var(--tc-mint)' }} aria-hidden>✓</span>
      </div>
      <h2 className="tc-display text-4xl">כבר פתרתם אותי!</h2>
      <p className="text-xl" style={{ color: 'var(--tc-soft)' }}>האות שלי כבר אצלכם בשק. רוצו לגמד הבא.</p>
    </ScreenBody>
  );
}

export function GnomeAsleepScreen({ gnome, onContinue }: { gnome: PlayerGnomeView; onContinue(): void }) {
  return (
    <ScreenBody className="items-center justify-center gap-5 text-center"
      footer={<button type="button" className="tc-btn tc-btn-primary w-full text-xl" onClick={onContinue}>חזרה לחיפוש</button>}>
      <GnomeStage gnome={gnome} size={130} sleeping />
      <h2 className="tc-display text-4xl">ששש… הגמד הזה ישן</h2>
      <p className="text-xl" style={{ color: 'var(--tc-soft)' }}>הוא לא משחק היום, ולא ירדו לכם נקודות. חזרו לחפש את הגמד שלכם.</p>
    </ScreenBody>
  );
}
