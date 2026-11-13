'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { BookOpenText, GripVertical, Pencil, Plus, RotateCcw, Trash2, TriangleAlert } from 'lucide-react';
import { resolveRules } from '@/lib/thecode/engine';
import { HOW_TO_PLAY_LIMITS, defaultHowToPlay, resolveHowToPlay } from '@/lib/thecode/howToPlay';
import type { ScreenProps } from './model';
import { Button, Card, IconButton, Pill, cx } from './ui';

const { lines: MAX_LINES, line: MAX_CHARS } = HOW_TO_PLAY_LIMITS;

/** A draft line with a stable id, so React keeps each textarea (and its focus) while reordering. */
interface Line {
  id: string;
  text: string;
}
let lineSeq = 0;
const toLine = (text: string): Line => ({ id: `l${++lineSeq}`, text });

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
  const [draft, setDraft] = useState<Line[] | null>(null);

  const startEdit = () => setDraft(shown.map(toLine));
  const save = () => {
    const lines = (draft || []).map((l) => l.text.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, MAX_LINES);
    actions.updateConfig({ howToPlay: lines.length ? lines : undefined });
    setDraft(null);
  };
  const resetDefault = () => {
    actions.updateConfig({ howToPlay: undefined });
    setDraft(null);
  };
  /** Move the line at `from` to position `to` (drag or keyboard). */
  const move = (from: number, to: number) =>
    setDraft((cur) => {
      if (!cur || from === to || to < 0 || to >= cur.length) return cur;
      const next = [...cur];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
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
          <SheetPreview lines={draft ? draft.map((l) => l.text).filter((t) => t.trim()) : shown} fallback={defaultHowToPlay(rules, config.language)} />
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
  draft: Line[];
  setDraft: (fn: (cur: Line[] | null) => Line[] | null) => void;
  move: (from: number, to: number) => void;
}) {
  const setLine = (id: string, v: string) => setDraft((cur) => (cur ? cur.map((l) => (l.id === id ? { ...l, text: v.replace(/[\r\n]+/g, ' ') } : l)) : cur));
  const rows = useRef(new Map<string, HTMLLIElement>());
  const handles = useRef(new Map<string, HTMLButtonElement>());
  const [dragId, setDragId] = useState<string | null>(null);
  // Refs, not state, inside the pointer handlers: moves can arrive before React re-renders.
  const dragRef = useRef<string | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [focusId, setFocusId] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');

  // Keyboard moves re-render the list: keep the focus on the moved line's handle.
  useEffect(() => {
    if (focusId) handles.current.get(focusId)?.focus();
  }, [draft, focusId]);

  /** Index of the row under the pointer (by row midpoints), so the line follows the finger. */
  const indexAt = (y: number): number => {
    const list = draftRef.current;
    let idx = 0;
    list.forEach((l, i) => {
      const r = rows.current.get(l.id)?.getBoundingClientRect();
      if (r && y > r.top + r.height / 2) idx = i;
    });
    return idx;
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>, id: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety; the moves still arrive on the handle */
    }
    dragRef.current = id;
    setDragId(id);
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const id = dragRef.current;
    if (!id) return;
    const list = draftRef.current;
    const from = list.findIndex((l) => l.id === id);
    const to = indexAt(e.clientY);
    if (from >= 0 && to !== from) {
      move(from, to);
      // Keep the ref in step until React re-renders, so a fast drag never moves twice.
      const next = [...list];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      draftRef.current = next;
    }
  };
  const endDrag = () => {
    const id = dragRef.current;
    if (!id) return;
    const at = draftRef.current.findIndex((l) => l.id === id);
    setAnnounce(`השורה נמצאת עכשיו במקום ${at + 1}`);
    dragRef.current = null;
    setDragId(null);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number, id: string) => {
    const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : e.key === 'Home' ? 0 : e.key === 'End' ? draft.length - 1 : null;
    if (to === null || to < 0 || to >= draft.length || to === i) return;
    e.preventDefault();
    setFocusId(id);
    move(i, to);
    setAnnounce(`השורה נמצאת עכשיו במקום ${to + 1}`);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm text-text-secondary">
        <span>שורה לכל צעד. כתבו בפשטות, כך שגם ילד יבין. גררו את הידית כדי לשנות סדר.</span>
        <span className={cx('shrink-0 tabular-nums', draft.length >= MAX_LINES && 'font-medium text-amber-700 dark:text-amber-400')}>{draft.length}/{MAX_LINES} שורות</span>
      </div>
      <ol className="space-y-3">
        {draft.map((l, i) => (
          <li
            key={l.id}
            ref={(el) => {
              if (el) rows.current.set(l.id, el);
              else rows.current.delete(l.id);
            }}
            className={cx(
              'flex items-start gap-1 rounded-xl transition-shadow sm:gap-2',
              dragId === l.id && 'relative z-10 bg-bg-card shadow-lg ring-2 ring-accent/40'
            )}
          >
            <button
              type="button"
              ref={(el) => {
                if (el) handles.current.set(l.id, el);
                else handles.current.delete(l.id);
              }}
              aria-label={`שורה ${i + 1}: גררו כדי לשנות סדר, או השתמשו בחיצים למעלה ולמטה`}
              title="גררו כדי לשנות סדר"
              onPointerDown={(e) => onPointerDown(e, l.id)}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={(e) => onKeyDown(e, i, l.id)}
              onBlur={() => setFocusId((f) => (f === l.id ? null : f))}
              className={cx(
                'mt-2 flex h-11 w-8 shrink-0 touch-none select-none items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent',
                dragId === l.id ? 'cursor-grabbing text-accent' : 'cursor-grab'
              )}
            >
              <GripVertical size={18} aria-hidden />
            </button>
            <span className="mt-3 w-4 shrink-0 text-center font-semibold tabular-nums text-accent sm:w-5">{i + 1}.</span>
            <div className="min-w-0 flex-1">
              <textarea
                className="input min-h-28 resize-y sm:min-h-16"
                value={l.text}
                maxLength={MAX_CHARS}
                aria-label={`שורה ${i + 1}`}
                onChange={(e) => setLine(l.id, e.target.value)}
              />
              <span className={cx('mt-0.5 block text-end text-xs tabular-nums', l.text.length >= MAX_CHARS ? 'text-amber-700 dark:text-amber-400' : 'text-text-secondary')}>
                {l.text.length}/{MAX_CHARS}
              </span>
            </div>
            <div className="mt-2 shrink-0">
              <IconButton icon={Trash2} label="מחקו שורה" onClick={() => setDraft((cur) => (cur ? cur.filter((x) => x.id !== l.id) : cur))} />
            </div>
          </li>
        ))}
      </ol>
      <span className="sr-only" aria-live="polite">{announce}</span>
      <Button size="sm" variant="ghost" icon={Plus} className="mt-3" disabled={draft.length >= MAX_LINES} onClick={() => setDraft((cur) => (cur ? [...cur, toLine('')] : cur))}>
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
