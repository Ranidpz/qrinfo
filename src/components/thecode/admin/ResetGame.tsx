'use client';

// "Start a new round" from the admin — the same reset the staff screen has: every group back to
// zero, names / emoji / selfies / entry codes stay. Typing the word is the guard against a stray
// tap; the server checks the word again.

import { useState } from 'react';
import { Check, RotateCcw, TriangleAlert } from 'lucide-react';
import { THECODE_RESET_WORD } from '@/types/thecode-api';
import type { AdminActions, AdminState } from './model';
import { Button, Card, Dialog } from './ui';

const FAILED: Record<string, string> = {
  network: 'אין חיבור כרגע. בדקו את האינטרנט ונסו שוב. שום דבר לא השתנה.',
  forbidden: 'אין לכם הרשאה לאפס את ההרפתקה הזו.',
  badRequest: `הקלידו בדיוק את המילה ${THECODE_RESET_WORD}.`,
  server: 'האיפוס נכשל. נסו שוב בעוד רגע.',
};

export default function ResetGame({ state, actions, variant }: { state: AdminState; actions: AdminActions; variant: 'inline' | 'card' }) {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState('');
  const [done, setDone] = useState<number | null>(null);
  const count = state.players.length;

  const start = () => {
    setWord('');
    setFailed('');
    setDone(null);
    setOpen(true);
  };
  const close = () => {
    if (!busy) setOpen(false);
  };
  const run = async () => {
    setBusy(true);
    setFailed('');
    const res = await actions.resetGame(word);
    setBusy(false);
    if (!res.ok) {
      setFailed(FAILED[res.error] ?? FAILED.server);
      return;
    }
    setDone(res.groups || count);
    setOpen(false);
  };

  const ready = word.trim() === THECODE_RESET_WORD;
  const doneLine = done !== null && (
    <p role="status" className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
      <Check size={16} aria-hidden /> התחיל סבב חדש. {done === 1 ? 'קבוצה אחת חזרה' : `${done} קבוצות חזרו`} לאפס נקודות.
    </p>
  );

  const dialog = (
    <Dialog
      open={open}
      onClose={close}
      title="להתחיל סבב חדש?"
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={busy}>ביטול</Button>
          <Button
            icon={RotateCcw}
            disabled={!ready || busy}
            onClick={() => void run()}
            className="border-0 bg-danger text-white hover:bg-danger/90 disabled:hover:bg-danger"
          >
            {busy ? 'מאפסים…' : 'אפסו את המשחק'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-3 rounded-lg bg-danger/5 p-3 text-sm">
          <TriangleAlert size={20} className="mt-0.5 shrink-0 text-danger" aria-hidden />
          <div className="space-y-1">
            <p>
              {count === 1 ? 'הקבוצה תחזור' : `כל ${count} הקבוצות יחזרו`} לאפס נקודות. הגמדים שנמצאו, האלבום והפרסים שחולקו יימחקו,
              ולוח התוצאות במסך הגדול יתחיל מחדש.
            </p>
            <p>השמות, הסלפי וקודי הכניסה נשארים, וכל קבוצה יכולה להמשיך לשחק מההתחלה.</p>
            <p className="font-semibold">אי אפשר לבטל את זה.</p>
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">הקלידו את המילה {THECODE_RESET_WORD} כדי לאשר</span>
          <input
            className="input text-lg"
            value={word}
            autoFocus
            aria-label={`הקלידו ${THECODE_RESET_WORD}`}
            onChange={(e) => {
              setWord(e.target.value);
              setFailed('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && ready && !busy) void run();
            }}
          />
        </label>
        {failed && <p role="alert" className="text-sm text-danger">{failed}</p>}
      </div>
    </Dialog>
  );

  if (variant === 'inline') {
    return (
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {doneLine || <span />}
        <Button variant="danger" size="sm" icon={RotateCcw} onClick={start} disabled={!count}>
          התחילו סבב חדש
        </Button>
        {dialog}
      </div>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="mb-1 text-lg font-semibold">סבב חדש</h2>
      <p className="text-sm text-text-secondary">
        מאפס את הנקודות וההתקדמות של כל הקבוצות, למשל לפני יום פעילות חדש או אחרי בדיקות. ההגדרות, הגמדים והחידות לא משתנים.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="danger" icon={RotateCcw} onClick={start} disabled={!count} className="border border-danger/30">
          התחילו סבב חדש
        </Button>
        {!count && <span className="text-sm text-text-secondary">עוד אף קבוצה לא שיחקה.</span>}
        {doneLine}
      </div>
      {dialog}
    </Card>
  );
}
