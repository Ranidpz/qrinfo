'use client';

import { useMemo, useState } from 'react';
import { BookOpen, Lightbulb, Pencil, Plus, Sparkles, TriangleAlert } from 'lucide-react';
import GnomeFigure from '@/components/thecode/GnomeFigure';
import type { TheCodeGnome, TheCodeRiddle } from '@/types/thecode';
import {
  RIDDLE_BANK,
  RIDDLE_PLACES,
  bankLetter,
  placeOfSpotName,
  planBankFill,
  suggestFromBank,
  type BankFillPlan,
  type BankRiddle,
  type RiddlePlace,
} from '@/lib/thecode/riddleBank';
import { alphabetFor } from '@/lib/thecode/letters';
import type { AdminActions, AdminState, AdventureReport } from './model';
import { letterLabel } from './helpers';
import { Button, Dialog, LetterTile, Pill, cx } from './ui';

// הקוד admin — the ready-made riddle bank (src/lib/thecode/riddleBank.ts) for operators who
// "do not know what to write": a picker for one gnome, and a one-click fill with a preview.
// Riddles taken from the bank are ordinary riddles afterwards (editable, deletable).

/** Letters the phrases still lack (more slots than usable riddles). */
export function lackingLetters(report: AdventureReport): Set<string> {
  const out = new Set<string>();
  for (const l of report.letterStock) if (l.supply < l.demand) out.add(l.letter);
  for (const cov of Object.values(report.phrases)) for (const m of cov.missing) out.add(m.letter);
  return out;
}

/** Adds one bank riddle to a gnome as a published `find` riddle; returns its id. */
export function addFromBank(actions: AdminActions, gnomeId: string, bank: BankRiddle): string {
  const id = actions.addRiddle(gnomeId, bank.answerWord);
  actions.updateRiddle(id, { text: bank.text, hints: [...bank.hints], difficulty: bank.difficulty, type: 'find', status: 'published' });
  return id;
}

const DIFFICULTY_LABELS: Record<1 | 2 | 3, string> = { 1: 'קלה', 2: 'בינונית', 3: 'קשה' };
const BANK_DIFFICULTIES: (1 | 2 | 3)[] = [1, 2, 3];

const BANK_LETTERS = (() => {
  const have = new Set(RIDDLE_BANK.map(bankLetter));
  return alphabetFor('he').filter((l) => have.has(l));
})();

/** "חידה מהמאגר" for one gnome. */
export function BankPickerDialog({
  gnome,
  spotName,
  riddles,
  report,
  initialLetter,
  onAdd,
  onWriteOwn,
  onClose,
}: {
  gnome: TheCodeGnome;
  spotName: string;
  riddles: TheCodeRiddle[];
  report: AdventureReport;
  initialLetter?: string | null;
  onAdd: (bank: BankRiddle) => void;
  onWriteOwn: () => void;
  onClose: () => void;
}) {
  const [letter, setLetter] = useState<string | null>(initialLetter ?? null);
  const [place, setPlace] = useState<RiddlePlace>(() => placeOfSpotName(spotName));
  const [difficulty, setDifficulty] = useState<1 | 2 | 3 | null>(null);
  const lacking = useMemo(() => lackingLetters(report), [report]);
  const list = useMemo(() => suggestFromBank({ letter, place, difficulty, riddles }), [letter, place, difficulty, riddles]);

  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title={`חידה מהמאגר — גמד ${gnome.number}`}
      footer={
        <>
          <Button variant="ghost" icon={Pencil} className="me-auto" onClick={onWriteOwn}>כתבו חידה בעצמכם</Button>
          <Button variant="ghost" onClick={onClose}>סגרו</Button>
        </>
      }
    >
      <p className="text-sm text-text-secondary">בחרו חידה מוכנה. אחרי ההוספה אפשר לשנות בה כל מילה.</p>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-2 text-sm font-medium">
          <span>אות</span>
          {lacking.size > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-normal text-amber-700 dark:text-amber-400">
              <span className="size-2 rounded-full bg-warning" aria-hidden /> חסרה במשפטים
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="אות">
          <Chip active={letter === null} onClick={() => setLetter(null)}>כל האותיות</Chip>
          {BANK_LETTERS.map((l) => (
            <Chip key={l} active={letter === l} onClick={() => setLetter(l)} flagged={lacking.has(l)}>
              {l}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-sm font-medium">רמת קושי</div>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="רמת קושי">
          <Chip active={difficulty === null} onClick={() => setDifficulty(null)}>כל הרמות</Chip>
          {BANK_DIFFICULTIES.map((d) => (
            <Chip key={d} active={difficulty === d} onClick={() => setDifficulty(d)}>
              <span className="px-1 text-sm font-medium">{DIFFICULTY_LABELS[d]}</span>
            </Chip>
          ))}
        </div>
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-medium">מתאים למקום</span>
        <select className="input select-input" value={place} onChange={(e) => setPlace(e.target.value as RiddlePlace)}>
          {RIDDLE_PLACES.map((p) => (
            <option key={p.id} value={p.id}>{p.he}</option>
          ))}
        </select>
      </label>

      <div className="mt-4">
        {list.length === 0 ? (
          <div className="rounded-xl bg-bg-secondary px-4 py-6 text-center text-text-secondary">
            {difficulty
              ? `במאגר לא נשארו חידות ברמה ${DIFFICULTY_LABELS[difficulty]}${letter ? ` לאות ${letterLabel(letter)}` : ''}. נסו רמה אחרת, או כתבו חידה בעצמכם.`
              : letter
                ? `במאגר לא נשארו חידות לאות ${letterLabel(letter)}. כתבו חידה בעצמכם — על משהו שרואים ליד הגמד.`
                : 'לא נשארו חידות במאגר. כתבו חידה בעצמכם.'}
          </div>
        ) : (
          <ul className="space-y-2">
            {list.slice(0, 40).map((b) => (
              <li key={b.id} className="flex items-start gap-3 rounded-xl border border-border px-3 py-3">
                <LetterTile letter={bankLetter(b)} size="sm" tone={lacking.has(bankLetter(b)) ? 'missing' : 'neutral'} />
                <div className="min-w-0 flex-1">
                  <p>{b.text}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
                    <span>תשובה: <b className="text-text-primary">{b.answerWord}</b></span>
                    <span className="inline-flex items-center gap-1"><Lightbulb size={14} aria-hidden />{b.hints.length === 1 ? 'רמז אחד' : `${b.hints.length} רמזים`}</span>
                    <span>{DIFFICULTY_LABELS[b.difficulty]}</span>
                    {b.place !== 'any' && <span>{RIDDLE_PLACES.find((p) => p.id === b.place)?.he}</span>}
                  </div>
                </div>
                <Button size="sm" variant="primary" icon={Plus} onClick={() => onAdd(b)}>הוסיפו</Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}

function Chip({ active, flagged, onClick, children }: { active: boolean; flagged?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cx(
        'relative inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border px-2.5 text-base font-semibold transition-colors',
        active ? 'border-accent bg-accent text-white' : flagged ? 'border-warning/70 bg-warning/10 hover:bg-warning/20' : 'border-border hover:bg-bg-hover'
      )}
    >
      {children}
      {flagged && !active && <span className="absolute -end-1 -top-1 size-2.5 rounded-full bg-warning ring-2 ring-bg-card" aria-label="חסרה במשפטים" />}
    </button>
  );
}

/** One-click fill: shows the plan, writes nothing until the operator confirms. */
export function BankFillDialog({
  state,
  onApply,
  onClose,
}: {
  state: AdminState;
  onApply: (plan: BankFillPlan) => void;
  onClose: () => void;
}) {
  const plan = useMemo(() => planBankFill(state.config, state.riddles), [state.config, state.riddles]);
  const { config } = state;
  const gnome = (id: string) => config.gnomes.find((g) => g.id === id);
  const spotName = (g?: TheCodeGnome) => config.spots.find((s) => s.id === g?.spotId)?.name || '';
  const phraseText = (id?: string) => config.phrases.find((p) => p.id === id)?.text;
  const usable = config.gnomes.filter((g) => g.isActive && config.spots.find((s) => s.id === g.spotId)?.isActive).length;
  const nothing = plan.add.length === 0;

  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title="השלמת חידות מהמאגר"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{nothing ? 'סגרו' : 'ביטול'}</Button>
          {!nothing && (
            <Button variant="primary" icon={Sparkles} onClick={() => onApply(plan)}>
              {plan.add.length === 1 ? 'הוסיפו חידה אחת' : `הוסיפו ${plan.add.length} חידות`}
            </Button>
          )}
        </>
      }
    >
      {nothing ? (
        <div className="rounded-xl bg-success/10 px-4 py-5 text-center">
          <div className="font-semibold text-green-700 dark:text-green-400">{config.phrases.some((p) => p.isActive) ? 'לכל המשפטים כבר יש חידות' : 'אין עדיין משפט סודי פעיל'}</div>
          <p className="mt-1 text-sm text-text-secondary">
            {config.phrases.some((p) => p.isActive) ? 'וגם לכל גמד פעיל יש לפחות חידה אחת. אין מה להוסיף.' : 'הוסיפו משפט סודי, ואז נשלים לו חידות מהמאגר.'}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-text-secondary">
            אלה החידות שנוסיף, כך שכל אות במשפטים תגיע מגמד אחר. הן ייכנסו ישר למשחק, ואפשר לערוך או למחוק כל אחת אחר כך.
          </p>
          <ul className="mt-4 space-y-2">
            {plan.add.map((item, i) => {
              const g = gnome(item.gnomeId);
              const phrase = phraseText(item.phraseId);
              return (
                <li key={i} className="flex items-start gap-3 rounded-xl border border-border px-3 py-3">
                  <div className="flex w-14 shrink-0 flex-col items-center">
                    {g && <GnomeFigure bodyColor={g.bodyColor} hatColor={g.hatColor} size={32} />}
                    <span className="mt-1 text-sm font-semibold">#{g?.number}</span>
                  </div>
                  <LetterTile letter={item.letter} size="sm" tone="ok" />
                  <div className="min-w-0 flex-1">
                    <p>{item.bank.text}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-text-secondary">
                      <span>תשובה: <b className="text-text-primary">{item.bank.answerWord}</b></span>
                      <span className="truncate">{spotName(g)}</span>
                    </div>
                    <div className="mt-1.5">
                      {phrase ? <Pill tone="neutral">בשביל &quot;{phrase}&quot;</Pill> : <Pill tone="neutral">כדי שלגמד תהיה חידה</Pill>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {plan.unfilled.length > 0 && (
        <div className="mt-4 rounded-xl bg-warning/10 px-4 py-3">
          <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
            <TriangleAlert size={16} aria-hidden /> מה המאגר לא יכול להשלים
          </div>
          <ul className="mt-2 space-y-1 text-sm text-amber-800 dark:text-amber-300">
            {plan.unfilled.map((u, i) => (
              <li key={i}>
                {u.why === 'notEnoughGnomes'
                  ? `במשפט "${phraseText(u.phraseId)}" יש יותר אותיות מגמדים פעילים (${usable}). הוסיפו גמדים או קצרו את המשפט.`
                  : `במאגר לא נשארו חידות לאות ${letterLabel(u.letter)} (בשביל "${phraseText(u.phraseId)}"). כתבו חידה כזו בעצמכם.`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Dialog>
  );
}

/** The prominent button that opens the fill dialog. */
export function BankFillButton({ onClick, size }: { onClick: () => void; size?: 'sm' }) {
  return (
    <Button variant="secondary" size={size} icon={BookOpen} onClick={onClick}>
      השלימו חידות מהמאגר
    </Button>
  );
}
