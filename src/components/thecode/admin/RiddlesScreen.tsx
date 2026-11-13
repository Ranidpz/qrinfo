'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BookOpen, Check, ChevronDown, ChevronLeft, Sparkles, ChevronRight, CircleAlert, CircleHelp, Lightbulb, Plus, Search, Trash2, TriangleAlert, X } from 'lucide-react';
import GnomeFigure, { describeGnome } from '@/components/thecode/GnomeFigure';
import type { TheCodeGnome, TheCodeRiddle } from '@/types/thecode';
import { alphabetFor, isAmbiguousLetter, letterOfAnswer, soundAlikes } from '@/lib/thecode/letters';
import type { RiddleStats, ScreenProps } from './model';
import { isRiddleTooHard, letterLabel } from './helpers';
import { Button, Card, EmptyState, Field, LetterTile, Pill, ScreenHeader, Segmented, Toggle, cx, Tip } from './ui';
import ImageDropZone from './ImageDropZone';
import { BankFillButton, BankFillDialog, BankPickerDialog, addFromBank } from './BankDialogs';
import { RIDDLE_TEMPLATES, TEMPLATE_BLANK } from './riddleTemplates';

/** Riddles per gnome the organizer aims for (guidance only — not stored). */
const TARGET_MIN = 2;
const TARGET_MAX = 5;

/** What is still missing before a riddle can be in the game (null = complete). */
function riddleMissing(r: TheCodeRiddle): string | null {
  const text = !!r.text.trim();
  const answer = !!letterOfAnswer(r.answerWord);
  if (!text && !answer) return 'חסרות שאלה ותשובה';
  if (!text) return 'חסרה שאלה';
  if (!answer) return 'חסרה תשובה';
  return null;
}

export default function RiddlesScreen({ state, report, actions, navigate, target, uploadImage }: ScreenProps) {
  const { config, riddles, riddleStats } = state;
  const sorted = [...config.gnomes].sort((a, b) => a.number - b.number);
  const [gnomeId, setGnomeId] = useState<string | null>(target.gnomeId ?? null);
  const [openRiddle, setOpenRiddle] = useState<string | null>(target.riddleId ?? null);
  const [wantLetter, setWantLetter] = useState<string | null>(target.letter ?? null);
  const [query, setQuery] = useState('');
  /** Bank picker for one gnome (with an optional preselected letter). */
  const [picking, setPicking] = useState<{ gnomeId: string; letter: string | null } | null>(null);
  const [filling, setFilling] = useState(!!target.fill);
  const [filled, setFilled] = useState<number | null>(null);

  useEffect(() => {
    if (target.gnomeId) setGnomeId(target.gnomeId);
    if (target.riddleId) setOpenRiddle(target.riddleId);
    setWantLetter(target.letter ?? null);
    if (target.fill) setFilling(true);
  }, [target]);

  const gnome = config.gnomes.find((g) => g.id === gnomeId) || null;
  const bank = riddles.filter((r) => r.gnomeId === gnomeId);
  const spotName = (g: TheCodeGnome) => config.spots.find((s) => s.id === g.spotId)?.name || 'בלי מקום';

  const q = query.trim();
  const listed = q
    ? sorted.filter((g) => String(g.number) === q || riddles.some((r) => r.gnomeId === g.id && (r.answerWord.includes(q) || r.text.includes(q))))
    : sorted;

  const addRiddle = (gid: string) => {
    const id = actions.addRiddle(gid);
    setGnomeId(gid);
    setOpenRiddle(id);
  };

  const pickGnome = picking ? config.gnomes.find((g) => g.id === picking.gnomeId) : null;
  const dialogs = (
    <>
      {pickGnome && (
        <BankPickerDialog
          gnome={pickGnome}
          spotName={spotName(pickGnome)}
          riddles={riddles}
          report={report}
          initialLetter={picking!.letter}
          onAdd={(b) => {
            const id = addFromBank(actions, pickGnome.id, b);
            setGnomeId(pickGnome.id);
            setOpenRiddle(id);
            setPicking(null);
            setWantLetter(null);
          }}
          onWriteOwn={() => {
            addRiddle(pickGnome.id);
            setPicking(null);
            setWantLetter(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}
      {filling && (
        <BankFillDialog
          state={state}
          onClose={() => setFilling(false)}
          onApply={(plan) => {
            for (const item of plan.add) addFromBank(actions, item.gnomeId, item.bank);
            setFilled(plan.add.length);
            setFilling(false);
          }}
        />
      )}
    </>
  );

  if (!config.gnomes.length) {
    return (
      <div className="mx-auto max-w-3xl">
        <ScreenHeader title="חידות" />
        <EmptyState icon={CircleHelp} title="אין עדיין גמדים" text="חידה תמיד שייכת לגמד. הפיקו גמדים ואז כתבו להם חידות." action={<Button variant="primary" onClick={() => navigate({ tab: 'gnomes' })}>לגמדים</Button>} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <style>{`@keyframes thecode-reveal { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }`}</style>
      <ScreenHeader
        title="חידות"
        summary={`הסתובבו במקום שבו עומד הגמד וכתבו לו ${TARGET_MIN} עד ${TARGET_MAX} חידות על מה שרואים סביבו. אפשר גם שאלות ידע. האות הראשונה של התשובה נכנסת לאוסף.`}
        actions={<BankFillButton onClick={() => setFilling(true)} />}
      />
      {dialogs}

      {filled !== null && (
        <div className="mb-6 flex items-center gap-3 rounded-xl bg-success/10 px-4 py-3">
          <Check size={20} className="text-success" aria-hidden />
          <span className="flex-1 font-medium">{filled === 1 ? 'נוספה חידה אחת מהמאגר.' : `נוספו ${filled} חידות מהמאגר.`} אפשר לפתוח כל אחת ולשנות אותה.</span>
          <button type="button" aria-label="סגירה" onClick={() => setFilled(null)} className="inline-flex size-9 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover">
            <X size={16} aria-hidden />
          </button>
        </div>
      )}

      {wantLetter && (
        <LetterFinder
          letter={wantLetter}
          gnomes={sorted.filter((g) => g.isActive)}
          riddles={riddles}
          spotName={spotName}
          onPick={(gid) => setPicking({ gnomeId: gid, letter: wantLetter })}
          onClose={() => setWantLetter(null)}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        {/* Gnome picker */}
        <div className={cx('self-start', gnome && 'hidden lg:block')}>
          <div className="relative mb-3">
            <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-text-secondary" aria-hidden />
            <input className="input ps-9" placeholder="חפשו מספר גמד או תשובה" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Card className="max-h-[70dvh] divide-y divide-border overflow-y-auto">
            {listed.map((g) => {
              const mine = riddles.filter((r) => r.gnomeId === g.id);
              const pub = mine.filter((r) => r.status === 'published');
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setGnomeId(g.id);
                    setOpenRiddle(null);
                  }}
                  className={cx('flex w-full items-center gap-3 px-3 py-2.5 text-start hover:bg-bg-hover', g.id === gnomeId && 'bg-accent/5', !g.isActive && 'opacity-60')}
                >
                  <GnomeFigure bodyColor={g.bodyColor} hatColor={g.hatColor} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">#{g.number}</div>
                    <div className="truncate text-sm text-text-secondary">{spotName(g)}</div>
                    <RiddleCount n={pub.length} waiting={mine.length - pub.length} active={g.isActive} letters={[...new Set(pub.map((r) => r.letter))]} />
                  </div>
                </button>
              );
            })}
            {listed.length === 0 && <div className="p-4 text-sm text-text-secondary">לא נמצא גמד.</div>}
          </Card>
        </div>

        {/* Riddle bank */}
        {gnome ? (
          <div className="min-w-0">
            <button type="button" onClick={() => setGnomeId(null)} className="-ms-2 mb-3 inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm text-text-secondary hover:bg-bg-hover lg:hidden">
              <ChevronRight size={16} aria-hidden /> כל הגמדים
            </button>
            <div className="mb-4 flex flex-wrap items-center gap-4">
              <GnomeFigure bodyColor={gnome.bodyColor} hatColor={gnome.hatColor} size={48} number={gnome.number} />
              <div className="min-w-[9rem] flex-1">
                <div className="text-lg font-semibold">גמד {gnome.number}</div>
                <div className="truncate text-sm text-text-secondary">{describeGnome(gnome.bodyColor, gnome.hatColor)} — {spotName(gnome)}</div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button icon={BookOpen} onClick={() => setPicking({ gnomeId: gnome.id, letter: wantLetter })}>חידה מהמאגר</Button>
                <Button variant="primary" icon={Plus} onClick={() => addRiddle(gnome.id)}>הוסיפו חידה</Button>
              </div>
            </div>
            <TargetLine n={bank.filter((r) => r.status === 'published').length} />
            {!gnome.isActive && (
              <div className="mb-4 rounded-lg bg-bg-hover px-3 py-2 text-sm text-text-secondary">הגמד כבוי, ולכן החידות שלו לא משתתפות כרגע במשחק.</div>
            )}

            {bank.length === 0 ? (
              <EmptyState icon={CircleHelp} title="לגמד הזה אין חידה" text="חידה אחת מספיקה כדי להתחיל. שאלו על משהו שרואים מהמקום שבו הגמד עומד." action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="primary" icon={BookOpen} onClick={() => setPicking({ gnomeId: gnome.id, letter: wantLetter })}>חידה מהמאגר</Button>
                    <Button icon={Plus} onClick={() => addRiddle(gnome.id)}>כתבו חידה</Button>
                  </div>
                } />
            ) : (
              <div className="space-y-3">
                {bank.map((r) => (
                  <RiddleCard
                    key={r.id}
                    riddle={r}
                    stats={riddleStats[r.id]}
                    language={config.language}
                    open={openRiddle === r.id}
                    onToggle={() => setOpenRiddle(openRiddle === r.id ? null : r.id)}
                    onChange={(patch) => actions.updateRiddle(r.id, patch)}
                    onDelete={() => actions.deleteRiddle(r.id)}
                    uploadImage={uploadImage}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="hidden items-center justify-center rounded-xl border border-dashed border-border p-12 text-text-secondary lg:flex">
            בחרו גמד כדי לראות את החידות שלו.
          </div>
        )}
      </div>
    </div>
  );
}

/** "Find me a source for ס׳": gnomes that do not yet give this letter, with a one-tap add. */
function LetterFinder({
  letter,
  gnomes,
  riddles,
  spotName,
  onPick,
  onClose,
}: {
  letter: string;
  gnomes: TheCodeGnome[];
  riddles: TheCodeRiddle[];
  spotName: (g: TheCodeGnome) => string;
  onPick: (gnomeId: string) => void;
  onClose: () => void;
}) {
  // Suggest the gnomes with the thinnest riddle bank — they gain the most from a new riddle.
  const count = (id: string) => riddles.filter((r) => r.gnomeId === id && r.status === 'published').length;
  const free = gnomes
    .filter((g) => !riddles.some((r) => r.gnomeId === g.id && r.letter === letter && r.status === 'published'))
    .sort((a, b) => count(a.id) - count(b.id) || a.number - b.number)
    .slice(0, 6);
  return (
    <Card className="mb-6 border-accent/40 p-4">
      <div className="flex items-start gap-3">
        <LetterTile letter={letter} tone="missing" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">מחפשים חידה לאות {letterLabel(letter)}</div>
          <p className="text-sm text-text-secondary">בחרו גמד, ונציע לו חידות מוכנות מהמאגר שהתשובה שלהן מתחילה ב־{letter}. אפשר גם לכתוב בעצמכם. הצענו גמדים שיש להם מעט חידות.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="סגירה" className="inline-flex size-9 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover">
          <X size={16} aria-hidden />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {free.map((g) => (
          <button key={g.id} type="button" onClick={() => onPick(g.id)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm hover:bg-bg-hover">
            <GnomeFigure bodyColor={g.bodyColor} hatColor={g.hatColor} size={18} />
            <span className="font-semibold">#{g.number}</span>
            <span className="text-text-secondary">{spotName(g)}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

function RiddleCard({
  riddle: r,
  stats,
  language,
  open,
  onToggle,
  onChange,
  onDelete,
  uploadImage,
}: {
  uploadImage: ScreenProps['uploadImage'];
  riddle: TheCodeRiddle;
  stats?: RiddleStats;
  language: 'he' | 'en';
  open: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<TheCodeRiddle>) => void;
  onDelete: () => void;
}) {
  const hard = isRiddleTooHard(stats);
  const letter = letterOfAnswer(r.answerWord);
  const firstChar = r.answerWord.trim().charAt(0);
  const wrongAlphabet = !!letter && !alphabetFor(language).includes(letter);
  const noLetter = !!r.answerWord.trim() && !letter;
  const ambiguous = !!letter && isAmbiguousLetter(letter);
  const hints = [0, 1, 2].map((i) => r.hints[i] || '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const missing = riddleMissing(r);
  // Step-by-step form (Rani): question first, then the answer, then everything else. A riddle
  // that already has both opens complete; a revealed step never folds away again while open.
  const hasQuestion = r.text.trim().length >= 2;
  const hasAnswer = !!letter && !wrongAlphabet;
  const stepNow = hasQuestion && hasAnswer ? 3 : hasQuestion ? 2 : 1;
  const [step, setStep] = useState<1 | 2 | 3>(stepNow);
  useEffect(() => {
    if (stepNow > step) setStep(stepNow);
  }, [stepNow, step]);

  return (
    <Card className={cx(open && 'ring-2 ring-accent/30')}>
      <div className="flex min-h-14 w-full flex-wrap items-center gap-x-2 pe-2">
      <button type="button" onClick={onToggle} className="flex min-w-[14rem] flex-1 items-center gap-3 py-3 ps-4 text-start">
        <LetterTile letter={letter || '?'} size="sm" tone={letter ? 'ok' : 'missing'} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{r.answerWord || 'חידה חדשה'}</div>
          {!open && <div className="truncate text-sm text-text-secondary">{r.text || 'עוד אין שאלה'}</div>}
        </div>
        {hard && <Pill tone="warning" className="hidden sm:inline-flex">חידה קשה מדי</Pill>}
        {stats && (
          <span className="hidden items-center gap-2 text-sm text-text-secondary tabular-nums sm:flex">
            <span className="inline-flex items-center gap-0.5"><Check size={14} className="text-success" aria-label="נכון" />{stats.correct}</span>
            <span className="inline-flex items-center gap-0.5"><X size={14} className="text-danger" aria-label="שגוי" />{stats.wrong}</span>
          </span>
        )}
        {missing ? (
          <Pill tone="warning">{missing}</Pill>
        ) : r.status === 'published' ? (
          <Pill tone="success">במשחק</Pill>
        ) : (
          <Pill tone="neutral">לא במשחק</Pill>
        )}
        <ChevronDown size={16} className={cx('shrink-0 text-text-secondary transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {!missing && r.status !== 'published' && (
        <Button size="sm" variant="primary" icon={Plus} className="mb-3 ms-auto sm:mb-0" onClick={() => onChange({ status: 'published' })}>הוסיפו למשחק</Button>
      )}
      </div>

      {open && (
        <div className="space-y-6 border-t border-border px-4 py-5">
          {step === 1 && <StepGuide>מתחילים בשאלה: מה הקבוצה צריכה למצוא או לראות ליד הגמד?</StepGuide>}
          <Field label="השאלה">
            <textarea
              ref={textRef}
              className="input min-h-24 resize-y"
              value={r.text}
              placeholder="למשל: מה תלוי על הקיר מעל הדלפק ומראה לכם מתי ארוחת הבוקר?"
              onChange={(e) => onChange({ text: e.target.value })}
            />
          </Field>
          <TemplateIdeas
            onPick={(text) => {
              onChange({ text });
              // Put the cursor on the first blank so the organizer types the real detail straight away.
              window.setTimeout(() => {
                const el = textRef.current;
                if (!el) return;
                const at = text.indexOf(TEMPLATE_BLANK);
                el.focus();
                if (at >= 0) el.setSelectionRange(at, at + TEMPLATE_BLANK.length);
              }, 0);
            }}
          />

          {step >= 2 && (
          <Reveal>
          {step === 2 && !hasAnswer && <StepGuide>עכשיו כתבו את התשובה — מילה אחת. האות הראשונה שלה היא האות שהקבוצה אוספת.</StepGuide>}
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
            <Field label="התשובה" hint="מילה אחת. רק האות הראשונה שלה נאספת.">
              <input className="input text-lg" value={r.answerWord} placeholder="למשל: שעון" onChange={(e) => onChange({ answerWord: e.target.value })} />
            </Field>
            <div className="flex items-center gap-3 sm:flex-col sm:items-center sm:pt-6">
              <LetterTile letter={letter || '?'} tone={letter && !wrongAlphabet ? 'ok' : 'missing'} />
              <span className="text-sm text-text-secondary">{letter ? `האות שתיאסף: ${letterLabel(letter)}` : 'אין עדיין אות'}</span>
            </div>
          </div>

          {(noLetter || wrongAlphabet) && (
            <div className="flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
              <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
              {noLetter ? `התשובה מתחילה ב־"${firstChar}", וזו לא אות. התחילו את התשובה באות.` : 'התשובה לא בשפת ההרפתקה, ואין את האות הזו על לוח המקשים של הקבוצה.'}
            </div>
          )}
          </Reveal>
          )}

          {step >= 3 && (
          <Reveal>
          {stepNow === 3 && r.status === 'published' && !r.imageUrl && !r.hints.length && (
            <StepGuide tone="done">החידה במשחק. אם תרצו, הוסיפו רמזים או תמונה — זה לא חובה.</StepGuide>
          )}

          {ambiguous && (
            <div className={cx('rounded-lg px-3 py-3 text-sm', r.acceptSoundAlike ? 'bg-bg-secondary' : 'bg-warning/10')}>
              <div className={cx('flex items-start gap-2', r.acceptSoundAlike ? 'text-text-secondary' : 'text-amber-700 dark:text-amber-400')}>
                <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
                <span>
                  ילדים עלולים ללחוץ {soundAlikes(letter).map(letterLabel).join(' או ')} במקום {letterLabel(letter)}. אם אפשר, בחרו חפץ שמתחיל באות אחרת.
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-4">
                <span className="text-text-primary">לקבל גם אות שנשמעת אותו דבר, עם טיפ איות</span>
                <Toggle checked={r.acceptSoundAlike} onChange={(v) => onChange({ acceptSoundAlike: v })} label="לקבל אות דומה בצליל" />
              </div>
            </div>
          )}

          <ImageDropZone
            label="תמונה לחידה (לא חובה)"
            emptyText="קבוצות יראו אותה מעל החידה, למשל תקריב של החפץ."
            aspect="aspect-[16/9] max-w-md"
            value={r.imageUrl}
            upload={uploadImage}
            onChange={(url) => onChange({ imageUrl: url })}
          />

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Lightbulb size={16} className="text-text-secondary" aria-hidden /> רמזים לפתרון (עד 3, מהכללי למדויק)
            </div>
            {hints.map((h, i) => (
              <input
                key={i}
                className="input"
                value={h}
                placeholder={`רמז ${i + 1}`}
                aria-label={`רמז ${i + 1}`}
                onChange={(e) => {
                  const next = [...hints];
                  next[i] = e.target.value;
                  while (next.length && !next[next.length - 1].trim()) next.pop();
                  onChange({ hints: next });
                }}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-6">
            <Field label="רמת קושי">
              <Segmented label="רמת קושי" value={r.difficulty} onChange={(d) => onChange({ difficulty: d })} options={[{ value: 1, label: 'קלה' }, { value: 2, label: 'בינונית' }, { value: 3, label: 'קשה' }]} />
            </Field>
            <Field label="במשחק" hint={missing ? `${missing} — אחרי שתשלימו, החידה תיכנס למשחק.` : r.status === 'published' ? 'קבוצות יכולות לקבל את החידה.' : 'החידה שמורה, אבל קבוצות לא יקבלו אותה.'}>
              <div className="flex items-center gap-3">
                <Toggle
                  checked={r.status === 'published'}
                  onChange={(v) => onChange({ status: v ? 'published' : 'draft' })}
                  label="החידה במשחק"
                />
                <span className="text-sm">{r.status === 'published' ? 'במשחק' : 'לא במשחק'}</span>
              </div>
            </Field>
          </div>
          {r.status === 'published' && (!r.text.trim() || !letter || wrongAlphabet) && (
            <p className="text-sm text-danger">חידה במשחק צריכה שאלה ותשובה שמתחילה באות.</p>
          )}

          {stats && (
            <div className="rounded-lg bg-bg-secondary px-4 py-3">
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span><b className="tabular-nums">{stats.correct}</b> פתרו נכון</span>
                <span><b className="tabular-nums">{stats.wrong}</b> טעו</span>
                <span><b className="tabular-nums">{stats.hints}</b> ביקשו רמז</span>
              </div>
              {hard && <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">הרבה קבוצות נתקעות כאן. נסו ניסוח פשוט יותר או רמז ראשון ברור יותר.</p>}
            </div>
          )}
          </Reveal>
          )}

          <div className="flex justify-end">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-danger">
                  {r.status === 'published' ? 'למחוק את החידה? קבוצות שבאמצע מזוודה יקבלו את האות שלה מגמד אחר.' : 'למחוק את החידה?'}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>ביטול</Button>
                <Button size="sm" variant="danger" icon={Trash2} onClick={onDelete}>מחקו</Button>
              </div>
            ) : (
              <Button size="sm" variant="danger" icon={Trash2} onClick={() => setConfirmDelete(true)}>מחקו חידה</Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

/** In-game riddles of a gnome in words, against the 2–5 target, plus the letters it gives. */
function RiddleCount({ n, waiting, active, letters }: { n: number; waiting: number; active: boolean; letters: string[] }) {
  const low = active && n < TARGET_MIN;
  const count = n === 0 ? 'אין חידות במשחק' : n === 1 ? 'חידה אחת' : `${n} חידות`;
  const title = `${n === 1 ? 'חידה אחת' : `${n} חידות`} במשחק לגמד הזה. כדאי ${TARGET_MIN} עד ${TARGET_MAX}, כדי שקבוצות שונות יקבלו שאלות שונות.${letters.length ? ` הגמד נותן את ${letters.length === 1 ? 'האות' : 'האותיות'} ${letters.join(', ')}.` : ''}${waiting > 0 ? ` עוד ${waiting} לא במשחק.` : ''}`;
  return (
    <Tip text={title} interactive className="mt-0.5">
    <div className="flex flex-wrap items-center gap-x-2 text-xs">
      <span className={low ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-text-secondary'}>
        {count}
        {low && ` · כדאי ${TARGET_MIN} עד ${TARGET_MAX}`}
      </span>
      {letters.length > 0 && <span className="text-text-secondary">אותיות: <b className="text-text-primary">{letters.join(', ')}</b></span>}
      {waiting > 0 && <span className="text-text-secondary">· {waiting === 1 ? 'אחת לא במשחק' : `${waiting} לא במשחק`}</span>}
    </div>
    </Tip>
  );
}

function TargetLine({ n }: { n: number }) {
  const low = n < TARGET_MIN;
  return (
    <div className={cx('-mt-2 mb-4 text-sm', low ? 'text-amber-700 dark:text-amber-400' : 'text-text-secondary')}>
      {n === 0 ? 'אין עדיין חידה במשחק' : n === 1 ? 'חידה אחת במשחק' : `${n} חידות במשחק`} · כדאי {TARGET_MIN} עד {TARGET_MAX}
      {low && ' — כדאי להוסיף'}
    </div>
  );
}

/** "רעיונות לחידה": observation templates; a tap fills the riddle text, the organizer completes it. */
function TemplateIdeas({ onPick }: { onPick: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="-mt-3">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-accent hover:bg-accent/10">
        <Sparkles size={16} aria-hidden /> רעיונות לחידה
        <ChevronDown size={14} className={cx('transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div className="mt-2 rounded-xl bg-bg-secondary p-3">
          <p className="mb-2 text-sm text-text-secondary">בחרו רעיון, השלימו את ה־{TEMPLATE_BLANK} במשהו שבאמת נמצא שם, וכתבו למטה את התשובה.</p>
          <div className="flex flex-wrap gap-2">
            {RIDDLE_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onPick(t.text);
                  setOpen(false);
                }}
                className="min-h-10 rounded-lg border border-border bg-bg-card px-3 py-2 text-start text-sm hover:border-accent/50 hover:bg-accent/5"
              >
                {t.text}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** A short line that tells the organizer what to do next. */
function StepGuide({ children, tone = 'next' }: { children: ReactNode; tone?: 'next' | 'done' }) {
  return (
    <p className={cx('flex items-start gap-2 rounded-lg px-3 py-2 text-sm font-medium', tone === 'done' ? 'bg-success/10 text-green-700 dark:text-green-400' : 'bg-accent/10 text-accent')}>
      {tone === 'done' ? <Check size={16} className="mt-0.5 shrink-0" aria-hidden /> : <ChevronLeft size={16} className="mt-0.5 shrink-0" aria-hidden />}
      {children}
    </p>
  );
}

/** Fades the next step in (no layout jump; nothing moves when reduced motion is on). */
function Reveal({ children }: { children: ReactNode }) {
  return <div className="space-y-6 motion-safe:animate-[thecode-reveal_220ms_ease-out]">{children}</div>;
}
