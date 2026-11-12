'use client';

// הקוד — big-screen board for the hotel TV. No controls: polls every 15 s and rotates
// between "השבוע" and "כל הזמנים". Large type for across-the-lobby reading; the same
// night-vault look as the phones. Keeps the last good board when a poll fails.

import { useEffect, useRef, useState } from 'react';
import { theCodeFont } from '@/components/thecode/live/font';
import { fetchLeaderboard } from '@/components/thecode/live/api';
import GnomeFigure from '@/components/thecode/GnomeFigure';
import { THECODE_STYLE } from '@/components/thecode/player/styles';
import type { TheCodeLeaderRow } from '@/types/thecode-api';

const POLL_MS = 15000;
const ROTATE_MS = 15000;
const ROWS = 10;
const SCOPES = [{ id: 'week', label: 'השבוע' }, { id: 'all', label: 'כל הזמנים' }] as const;
type Scope = (typeof SCOPES)[number]['id'];

const MEDALS = ['🥇', '🥈', '🥉'];
const INVITE_GNOMES = [
  { b: 'green', h: 'red' }, { b: 'blue', h: 'yellow' }, { b: 'purple', h: 'white' },
] as const;

function Board({ rows }: { rows: TheCodeLeaderRow[] }) {
  if (!rows.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <p className="tc-display text-[5vh]" style={{ color: 'var(--tc-brass-hi)' }}>הטבלה עוד ריקה</p>
        <p className="text-[3vh]" style={{ color: 'var(--tc-soft)' }}>הקבוצה הראשונה שתמצא גמד תופיע כאן</p>
      </div>
    );
  }
  return (
    <ol className="flex flex-1 flex-col justify-center gap-[1.2vh]">
      {rows.slice(0, ROWS).map((r, i) => (
        <li key={r.id} className="tc-a-rise flex items-center gap-[2vw] rounded-[2vh] px-[2vw]"
          style={{
            animationDelay: `${i * 60}ms`,
            height: '7vh',
            background: i < 3 ? 'linear-gradient(90deg, rgba(244,183,64,.25), rgba(244,183,64,.06))' : 'var(--tc-panel)',
            boxShadow: i < 3 ? 'inset 0 0 0 2px rgba(244,183,64,.5)' : 'inset 0 0 0 1px var(--tc-line)',
          }}>
          <span className="tc-num w-[5vw] text-center text-[4vh]" style={{ color: i < 3 ? 'var(--tc-brass)' : 'var(--tc-soft)' }}>
            {MEDALS[i] ?? i + 1}
          </span>
          <span className="text-[4.5vh]" aria-hidden>{r.emoji}</span>
          <span className="flex-1 truncate text-[4vh] font-bold">{r.familyName}</span>
          <span className="text-[3vh]" style={{ color: 'var(--tc-soft)' }}>🧳 <span className="tc-num">{r.suitcases}</span></span>
          <span className="tc-num w-[12vw] text-end text-[4.5vh]" style={{ color: 'var(--tc-brass-hi)' }}>{r.points.toLocaleString('en-US')}</span>
        </li>
      ))}
    </ol>
  );
}

export default function TheCodeLobby({ codeId, title }: { codeId: string | null; title: string }) {
  const [boards, setBoards] = useState<Record<Scope, TheCodeLeaderRow[] | null>>({ week: null, all: null });
  const [scope, setScope] = useState<Scope>('week');
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    if (!codeId) return;
    const load = () => {
      for (const s of SCOPES) {
        void fetchLeaderboard(codeId, s.id).then((b) => {
          if (alive.current && b) setBoards((x) => ({ ...x, [s.id]: b.rows }));
        });
      }
    };
    load();
    const poll = setInterval(load, POLL_MS);
    const rotate = setInterval(() => setScope((s) => (s === 'week' ? 'all' : 'week')), ROTATE_MS);
    return () => { alive.current = false; clearInterval(poll); clearInterval(rotate); };
  }, [codeId]);

  const rows = boards[scope];
  return (
    <div className={`${theCodeFont.variable} fixed inset-0`}>
      <div dir="rtl" lang="he" className="tc-root flex flex-col px-[4vw] py-[4vh]">
        <style>{THECODE_STYLE}</style>
        <div className="tc-stars" aria-hidden />
        {!codeId ? (
          <div className="relative flex flex-1 items-center justify-center">
            <p className="tc-display text-[5vh]">המשחק הזה לא נמצא</p>
          </div>
        ) : (
          <>
            <header className="relative flex items-end justify-between gap-6">
              <div>
                <h1 className="tc-display text-[9vh] leading-none" style={{ color: 'var(--tc-brass)', textShadow: '0 4px 0 #6E400C, 0 18px 40px rgba(244,183,64,.35)' }}>הקוד</h1>
                {title && <p className="mt-[1vh] text-[3vh]" style={{ color: 'var(--tc-soft)' }}>{title}</p>}
              </div>
              <div className="flex gap-[1vw] rounded-full p-[0.6vh]" style={{ background: 'rgba(0,0,0,.3)' }}>
                {SCOPES.map((s) => (
                  <span key={s.id} className="tc-display rounded-full px-[2vw] py-[0.8vh] text-[3vh] transition-colors"
                    style={scope === s.id ? { background: 'var(--tc-brass)', color: '#2A1600' } : { color: 'var(--tc-soft)' }}>
                    {s.label}
                  </span>
                ))}
              </div>
            </header>
            <main key={scope} className="relative mt-[3vh] flex flex-1 flex-col">
              {rows ? <Board rows={rows} /> : (
                <div className="flex flex-1 items-center justify-center">
                  <span aria-hidden className="tc-spin h-[8vh] w-[8vh] rounded-full border-[0.8vh] border-white/15 border-t-[var(--tc-brass)]" />
                </div>
              )}
            </main>
            <footer className="relative mt-[3vh] flex items-center justify-center gap-[2vw] rounded-[3vh] px-[3vw] py-[2vh]"
              style={{ background: 'rgba(244,183,64,.12)', boxShadow: 'inset 0 0 0 2px rgba(244,183,64,.4)' }}>
              <div className="flex items-end gap-[0.5vw]" aria-hidden>
                {INVITE_GNOMES.map((g, i) => (
                  <span key={i} className="tc-a-bob" style={{ animationDelay: `${i * 0.4}s` }}>
                    <GnomeFigure bodyColor={g.b} hatColor={g.h} size={64} />
                  </span>
                ))}
              </div>
              <p className="tc-display text-[3.6vh] leading-tight">
                מצאו גמד, סרקו את הקוד שעליו והצטרפו למשחק!
              </p>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
