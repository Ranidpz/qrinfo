'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, CircleAlert, CircleCheck, Info, KeyRound, Luggage, Plus, Trash2 } from 'lucide-react';
import type { TheCodePhrase } from '@/types/thecode';
import type { MissingLetter, PhraseCoverage, ScreenProps } from './model';
import type { Navigate } from './nav';
import { letterLabel } from './helpers';
import { Button, Card, EmptyState, IconButton, LetterTile, Pill, ScreenHeader, Toggle, cx } from './ui';
import { BankFillButton } from './BankDialogs';

export default function PhrasesScreen({ state, report, actions, navigate, target, coverageOf }: ScreenProps) {
  const { phrases } = state.config;
  const [draft, setDraft] = useState('');
  const [highlight, setHighlight] = useState<string | null>(target.phraseId ?? null);
  const draftCoverage = draft.trim() ? coverageOf(draft) : null;
  const duplicate = phrases.some((p) => p.text.trim() === draft.trim());

  useEffect(() => {
    if (!target.phraseId) return;
    setHighlight(target.phraseId);
    window.setTimeout(() => document.getElementById(`phrase-${target.phraseId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
  }, [target]);

  const add = () => {
    if (!draft.trim() || duplicate) return;
    const id = actions.addPhrase(draft);
    setDraft('');
    setHighlight(id);
  };

  const short = report.letterStock.filter((l) => l.supply < l.demand * 2);

  return (
    <div className="mx-auto max-w-3xl">
      <ScreenHeader
        title="משפטים סודיים"
        summary={
          <span className="inline-flex items-center gap-2">
            <Luggage size={16} aria-hidden />
            {report.freshSuitcases === 0
              ? 'עוד אין מזוודה שאפשר לפתוח.'
              : report.freshSuitcases === 1
              ? 'משפחה יכולה לפתוח מזוודה חדשה אחת.'
              : `משפחה יכולה לפתוח ${report.freshSuitcases} מזוודות חדשות, בלי לפתור חידה פעמיים.`}
          </span>
        }
        actions={
          phrases.some((p) => p.isActive && (report.phrases[p.id]?.missing.length ?? 0) > 0) ? (
            <BankFillButton onClick={() => navigate({ tab: 'riddles', fill: true })} />
          ) : undefined
        }
      />

      {/* Add a phrase — the board answers while typing */}
      <Card className="p-6">
        <label htmlFor="new-phrase" className="mb-1.5 block font-medium">משפט חדש</label>
        <div className="flex gap-2">
          <input
            id="new-phrase"
            className="input text-lg"
            placeholder="למשל: שלום כנרת"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <Button variant="primary" icon={Plus} onClick={add} disabled={!draft.trim() || duplicate}>הוסיפו</Button>
        </div>
        {duplicate && <p className="mt-2 text-sm text-danger">המשפט הזה כבר קיים.</p>}
        {draftCoverage && !duplicate && (
          <div className="mt-6">
            <Board coverage={draftCoverage} />
            <Verdict coverage={draftCoverage} navigate={navigate} isDraft />
          </div>
        )}
        {!draft && (
          <p className="mt-2 text-sm text-text-secondary">כתבו משפט, ונראה לכם מיד אם יש מספיק גמדים לכל האותיות שלו.</p>
        )}
      </Card>

      <div className="mt-8 space-y-4">
        {phrases.length === 0 && (
          <EmptyState icon={KeyRound} title="עוד אין משפטים" text="משפט סודי נועל מזוודה. משפחה אוספת את האותיות שלו מהגמדים ומסדרת אותן." />
        )}
        {phrases.map((p) => (
          <PhraseCard
            key={p.id}
            phrase={p}
            coverage={report.phrases[p.id]}
            highlighted={highlight === p.id}
            navigate={navigate}
            onToggle={(v) => actions.updatePhrase(p.id, { isActive: v })}
            onDelete={() => actions.deletePhrase(p.id)}
          />
        ))}
      </div>

      {report.letterStock.length > 0 && (
        <details className="group mt-8 rounded-xl border border-border bg-bg-card">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-6 py-3">
            <span className="font-medium">מלאי אותיות</span>
            <span className="text-sm text-text-secondary">
              {short.length ? `${short.length} אותיות עם מעט חידות` : 'לכל אות יש מספיק חידות'}
            </span>
            <ChevronLeft size={16} className="ms-auto text-text-secondary transition-transform group-open:-rotate-90" aria-hidden />
          </summary>
          <div className="border-t border-border px-6 py-5">
            <p className="mb-4 text-sm text-text-secondary">כמה פעמים כל אות מופיעה במשפטים הפעילים, מול כמה חידות מפורסמות נותנות אותה. כדי שמשפחה תחזור ותפתח עוד מזוודות, כדאי פי שניים חידות.</p>
            <div className="flex flex-wrap gap-4">
              {report.letterStock.map((l) => (
                <button
                  key={l.letter}
                  type="button"
                  onClick={() => navigate({ tab: 'riddles', letter: l.letter })}
                  className="flex flex-col items-center gap-1 rounded-lg p-1 hover:bg-bg-hover"
                  title={`הוסיפו חידה לאות ${letterLabel(l.letter)}`}
                >
                  <LetterTile letter={l.letter} size="sm" tone={l.supply < l.demand ? 'missing' : l.supply < l.demand * 2 ? 'neutral' : 'ok'} />
                  <span className="text-xs tabular-nums text-text-secondary" dir="ltr">{l.supply}/{l.demand}</span>
                </button>
              ))}
            </div>
          </div>
        </details>
      )}
    </div>
  );
}

function PhraseCard({
  phrase,
  coverage,
  highlighted,
  navigate,
  onToggle,
  onDelete,
}: {
  phrase: TheCodePhrase;
  coverage: PhraseCoverage;
  highlighted: boolean;
  navigate: Navigate;
  onToggle: (v: boolean) => void;
  onDelete: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <Card id={`phrase-${phrase.id}`} className={cx('scroll-mt-32 p-6', highlighted && 'ring-2 ring-accent/40', !phrase.isActive && 'opacity-70')}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold">{phrase.text}</h2>
        {!phrase.isActive ? <Pill>כבוי</Pill> : coverage.playable ? <Pill tone="success">מוכן</Pill> : <Pill tone="danger">לא מוכן</Pill>}
        <div className="ms-auto flex items-center gap-1">
          <Toggle checked={phrase.isActive} onChange={onToggle} label={phrase.isActive ? 'כבו משפט' : 'הפעילו משפט'} />
          {confirm ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>ביטול</Button>
              <Button size="sm" variant="danger" onClick={onDelete}>מחקו</Button>
            </>
          ) : (
            <IconButton icon={Trash2} tone="danger" label="מחקו משפט" onClick={() => setConfirm(true)} />
          )}
        </div>
      </div>
      <div className="mt-5">
        <Board coverage={coverage} />
        <Verdict coverage={coverage} navigate={navigate} />
      </div>
    </Card>
  );
}

/** The phrase as letter tiles, word by word; the badge = how many gnomes can supply the letter. */
function Board({ coverage }: { coverage: PhraseCoverage }) {
  const words: PhraseCoverage['letters'][] = [];
  for (const l of coverage.letters) (words[l.wordIndex] ||= []).push(l);
  if (!coverage.letters.length) return null;
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-4" aria-label="לוח האותיות">
      {words.map((w, i) => (
        <div key={i} className="flex flex-wrap gap-2">
          {w.map((l, j) => (
            <span key={j} title={l.have === 0 ? `אין גמד שנותן ${letterLabel(l.letter)}` : `${l.have} גמדים נותנים ${letterLabel(l.letter)}`}>
              <LetterTile letter={l.letter} tone={l.ok ? 'ok' : 'missing'} badge={l.have} />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function missingText(m: MissingLetter): string {
  const L = letterLabel(m.letter);
  const draft = m.dormant.find((d) => d.why === 'draft');
  const off = m.dormant.find((d) => d.why === 'gnomeOff' || d.why === 'spotOff');
  if (draft) return `חסרה חידה לאות ${L} — לגמד ${draft.gnomeNumber} יש חידה כזו בטיוטה.`;
  if (off) return `חסרה חידה לאות ${L} — היא אצל גמד ${off.gnomeNumber}, ש${off.why === 'gnomeOff' ? 'כבוי' : 'המקום שלו כבוי'}.`;
  if (m.shared) return `לאות ${L} אין גמד פנוי — הגמדים שנותנים אותה כבר נותנים אות אחרת במשפט.`;
  if (m.need > 1 && m.have > 0) return `${L} מופיעה ${m.need} פעמים, ורק ${m.have === 1 ? 'גמד אחד נותן' : `${m.have} גמדים נותנים`} אותה. כל אות צריכה גמד משלה.`;
  return `חסרה חידה לאות ${L} — הוסיפו חידה שהתשובה שלה מתחילה ב־${m.letter}.`;
}

function Verdict({ coverage, navigate, isDraft }: { coverage: PhraseCoverage; navigate: Navigate; isDraft?: boolean }) {
  const rows: { text: string; action?: { label: string; go: () => void } }[] = [];
  if (coverage.invalidChars.length) rows.push({ text: `יש תווים שאי אפשר לאסוף: ${coverage.invalidChars.join(' ')}. השאירו רק אותיות ורווחים.` });
  if (coverage.tooShort) rows.push({ text: 'קצר מדי — צריך לפחות 3 אותיות.' });
  for (const m of coverage.missing) {
    const draft = m.dormant.find((d) => d.why === 'draft');
    const off = m.dormant.find((d) => d.why === 'gnomeOff');
    rows.push({
      text: missingText(m),
      action: draft
        ? { label: 'פרסמו אותה', go: () => navigate({ tab: 'riddles', gnomeId: draft.gnomeId, riddleId: draft.riddleId }) }
        : off
        ? { label: `לגמד ${off.gnomeNumber}`, go: () => navigate({ tab: 'gnomes', gnomeId: off.gnomeId }) }
        : { label: `הוסיפו חידה ל־${letterLabel(m.letter)}`, go: () => navigate({ tab: 'riddles', letter: m.letter }) },
    });
  }

  return (
    <div className="mt-5 space-y-2">
      {rows.length === 0 ? (
        <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
          <CircleCheck size={18} aria-hidden />
          {isDraft ? 'אפשר להשלים את המשפט הזה — כל אות מקבלת גמד משלה.' : 'כל אות מקבלת גמד משלה.'}
        </div>
      ) : (
        rows.map((r, i) => (
          <div key={i} className="flex items-start justify-between gap-4 rounded-lg bg-danger/5 px-3 py-2">
            <span className="flex items-start gap-2 text-red-700 dark:text-red-400">
              <CircleAlert size={16} className="mt-1 shrink-0" aria-hidden />
              {r.text}
            </span>
            {r.action && (
              <button type="button" onClick={r.action.go} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-sm font-medium text-accent hover:bg-accent/10">
                {r.action.label}
                <ChevronLeft size={16} aria-hidden />
              </button>
            )}
          </div>
        ))
      )}
      {coverage.hasFinalForms && (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Info size={14} aria-hidden />
          אות סופית נאספת כמו האות הרגילה (ף = פ), ומוצגת סופית בסוף המילה.
        </div>
      )}
    </div>
  );
}
