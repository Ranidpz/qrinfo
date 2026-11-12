'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, BookOpenText, Pencil, Plus, RotateCcw, Trash2, TriangleAlert } from 'lucide-react';
import { resolveRules } from '@/lib/thecode/engine';
import { HOW_TO_PLAY_LIMITS, defaultHowToPlay, resolveHowToPlay } from '@/lib/thecode/howToPlay';
import type { ScreenProps } from './model';
import { Button, Card, IconButton, Pill, cx } from './ui';

const { lines: MAX_LINES, line: MAX_CHARS } = HOW_TO_PLAY_LIMITS;

/**
 * "איך משחקים": the short rules families can open from any screen. Until the operator writes
 * their own, families see the default built from the adventure's real rules (numbers follow the
 * rules by themselves). Editing works on a local draft and is stored only on "שמרו", so a
 * half-typed empty line is never sent (the server drops empty lines).
 */
export default function HowToPlayCard({ state, actions }: Pick<ScreenProps, 'state' | 'actions'>) {
  const { config } = state;
  const rules = resolveRules(config.rules);
  const own = (config.howToPlay || []).some((l) => l.trim());
  const shown = resolveHowToPlay(config, rules);
  const [draft, setDraft] = useState<string[] | null>(null);

  const startEdit = () => setDraft([...shown]);
  const save = () => {
    const lines = (draft || []).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, MAX_LINES);
    actions.updateConfig({ howToPlay: lines.length ? lines : undefined });
    setDraft(null);
  };
  const resetDefault = () => {
    actions.updateConfig({ howToPlay: undefined });
    setDraft(null);
  };
  const move = (i: number, d: -1 | 1) =>
    setDraft((cur) => {
      if (!cur) return cur;
      const next = [...cur];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BookOpenText size={20} className="text-accent" aria-hidden /> איך משחקים
          </h2>
          <p className="mt-1 text-text-secondary">ההסבר הקצר שקבוצות פותחות מכל מסך במשחק.</p>
        </div>
        {!draft && (
          <div className="flex flex-wrap gap-2">
            {own && <Button size="sm" variant="ghost" icon={RotateCcw} onClick={resetDefault}>חזרה לברירת המחדל</Button>}
            <Button size="sm" icon={Pencil} onClick={startEdit}>ערכו</Button>
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          {draft ? (
            <Editor draft={draft} setDraft={setDraft} move={move} />
          ) : (
            <>
              <div className="mb-3">
                {own ? <Pill tone="neutral">טקסט שלכם</Pill> : <Pill tone="success">ברירת מחדל — מתעדכנת לבד לפי החוקים</Pill>}
              </div>
              <ol className="space-y-2">
                {shown.map((l, i) => (
                  <li key={i} className="flex gap-3 rounded-lg bg-bg-secondary px-3 py-2">
                    <span className="font-semibold tabular-nums text-accent">{i + 1}.</span>
                    <span>{l}</span>
                  </li>
                ))}
              </ol>
            </>
          )}

          {own && (
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
              זה הטקסט שלכם: אם תשנו את הנקודות בחוקים, המספרים כאן לא יתעדכנו מעצמם. עדכנו אותם כאן, או חזרו לברירת המחדל.
            </p>
          )}

          {draft && (
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Button variant="primary" onClick={save}>שמרו</Button>
              <Button variant="ghost" onClick={() => setDraft(null)}>ביטול</Button>
              <button type="button" onClick={resetDefault} className="ms-auto text-sm font-medium text-accent hover:underline">
                חזרה לברירת המחדל
              </button>
              <span className="basis-full text-sm text-text-secondary">ברירת המחדל משתמשת בנקודות שקבעתם בחוקים, ומתעדכנת כשתשנו אותן.</span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center">
          <span className="mb-2 text-sm font-medium text-text-secondary">כך זה נראה בטלפון</span>
          <SheetPreview lines={draft ? draft.filter((l) => l.trim()) : shown} fallback={defaultHowToPlay(rules, config.language)} />
        </div>
      </div>
    </Card>
  );
}

function Editor({
  draft,
  setDraft,
  move,
}: {
  draft: string[];
  setDraft: (fn: (cur: string[] | null) => string[] | null) => void;
  move: (i: number, d: -1 | 1) => void;
}) {
  const setLine = (i: number, v: string) => setDraft((cur) => (cur ? cur.map((l, j) => (j === i ? v.replace(/[\r\n]+/g, ' ') : l)) : cur));
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm text-text-secondary">
        <span>שורה לכל צעד. כתבו בפשטות, כך שגם ילד יבין.</span>
        <span className={cx('tabular-nums', draft.length >= MAX_LINES && 'font-medium text-amber-700 dark:text-amber-400')}>{draft.length}/{MAX_LINES} שורות</span>
      </div>
      <ol className="space-y-3">
        {draft.map((l, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-3 w-5 shrink-0 text-center font-semibold tabular-nums text-accent">{i + 1}.</span>
            <div className="min-w-0 flex-1">
              <textarea
                className="input min-h-16 resize-y"
                value={l}
                maxLength={MAX_CHARS}
                aria-label={`שורה ${i + 1}`}
                onChange={(e) => setLine(i, e.target.value)}
              />
              <span className={cx('mt-0.5 block text-end text-xs tabular-nums', l.length >= MAX_CHARS ? 'text-amber-700 dark:text-amber-400' : 'text-text-secondary')}>
                {l.length}/{MAX_CHARS}
              </span>
            </div>
            <div className="flex shrink-0 flex-col">
              <IconButton icon={ArrowUp} label="הזיזו למעלה" disabled={i === 0} onClick={() => move(i, -1)} />
              <IconButton icon={ArrowDown} label="הזיזו למטה" disabled={i === draft.length - 1} onClick={() => move(i, 1)} />
              <IconButton icon={Trash2} label="מחקו שורה" onClick={() => setDraft((cur) => (cur ? cur.filter((_, j) => j !== i) : cur))} />
            </div>
          </li>
        ))}
      </ol>
      <Button size="sm" variant="ghost" icon={Plus} className="mt-3" disabled={draft.length >= MAX_LINES} onClick={() => setDraft((cur) => (cur ? [...cur, ''] : cur))}>
        הוסיפו שורה
      </Button>
    </div>
  );
}

function SheetPreview({ lines, fallback }: { lines: string[]; fallback: string[] }) {
  const list = lines.length ? lines : fallback;
  return (
    <div dir="rtl" className="relative h-[400px] w-[200px] overflow-hidden rounded-[1.8rem] border-[6px] border-zinc-800 bg-zinc-700 shadow-xl" aria-label="תצוגה מקדימה של איך משחקים">
      <div className="absolute inset-x-0 top-2 mx-auto h-3.5 w-16 rounded-full bg-black/70" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 top-14 overflow-hidden rounded-t-2xl bg-white px-3 pt-3 text-zinc-900">
        <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-zinc-300" aria-hidden />
        <div className="mb-2 text-center text-sm font-bold">איך משחקים</div>
        <ol className="space-y-1.5 text-[10.5px] leading-snug">
          {list.map((l, i) => (
            <li key={i} className="flex gap-1.5">
              <span className="font-bold text-emerald-600">{i + 1}.</span>
              <span>{l}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
