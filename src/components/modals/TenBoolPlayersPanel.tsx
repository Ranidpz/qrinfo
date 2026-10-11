'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Eye, EyeOff, ImageOff, Loader2, RefreshCw, Trash2, Trophy } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { formatDiff } from '@/lib/tenbool/competition';

// 10 בול phone mode, owner side: who played, who hit (with the phone for the prize), and moderation -
// hide a player or remove a photo from the big screen, or wipe everything between rounds.

interface Player {
  id: string;
  nickname: string;
  attempts: number;
  won: boolean;
  wonAttempts: number | null;
  wonAt: number | null;
  claimed: boolean;
  photoUrl: string | null;
  phone: string | null;
  verified: boolean;
  hidden: boolean;
  bestDiff: number | null;
  suspicious: number;
  onBoard: boolean;
  createdAt: number;
}

const waLink = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '')}`;
const localPhone = (phone: string) => phone.replace(/^\+972/, '0');
const RESET_WORD = 'איפוס';

// Winners by the board's order (claimed first), then everyone else by how close they got
function sortPlayers(a: Player, b: Player) {
  const wa = a.won && a.claimed ? 0 : a.won ? 1 : 2;
  const wb = b.won && b.claimed ? 0 : b.won ? 1 : 2;
  if (wa !== wb) return wa - wb;
  if (wa < 2) return (a.wonAttempts ?? 0) - (b.wonAttempts ?? 0) || (a.wonAt ?? 0) - (b.wonAt ?? 0);
  return Math.abs(a.bestDiff ?? 9999) - Math.abs(b.bestDiff ?? 9999);
}

export default function TenBoolPlayersPanel({ codeId, title }: { codeId: string; title?: string }) {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetText, setResetText] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/tenbool/admin?codeId=${encodeURIComponent(codeId)}`);
      if (!res.ok) throw new Error();
      setPlayers(((await res.json()).players as Player[]).sort(sortPlayers));
    } catch {
      setError('טעינת השחקנים נכשלה');
    }
  }, [codeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (action: 'hide' | 'unhide' | 'clearPhoto' | 'reset', playerId?: string) => {
    setBusyId(playerId ?? 'reset');
    setError(null);
    try {
      const res = await fetchWithAuth('/api/tenbool/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId, playerId, action }),
      });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setError('הפעולה נכשלה, נסו שוב');
    } finally {
      setBusyId(null);
    }
  };

  const shown = useMemo(() => {
    const q = query.trim();
    if (!players || !q) return players ?? [];
    const digits = q.replace(/\D/g, '');
    return players.filter((p) => p.nickname.includes(q) || (digits.length >= 3 && (p.phone ?? '').replace(/\D/g, '').includes(digits)));
  }, [players, query]);

  const winners = players?.filter((p) => p.won) ?? [];

  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const rows = (players ?? []).map((p, i) => ({
      '#': i + 1,
      כינוי: p.nickname,
      בול: p.won ? 'כן' : '',
      'ניסיונות עד הבול': p.wonAttempts ?? '',
      'סה״כ ניסיונות': p.attempts,
      'הכי קרוב': p.bestDiff != null ? formatDiff(p.bestDiff) : '',
      טלפון: p.phone ? localPhone(p.phone) : '',
      מאומת: p.verified ? 'כן' : '',
      'בלוח': p.onBoard ? 'כן' : '',
      מוסתר: p.hidden ? 'כן' : '',
      'שעת הבול': p.wonAt ? new Date(p.wonAt).toLocaleString('he-IL') : '',
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'שחקנים');
    XLSX.writeFile(book, `${(title || '10 בול').replace(/[\\/:*?"<>|]/g, '')} - שחקנים.xlsx`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-sm text-text-secondary">
          {players ? `${players.length} שחקנים · ${winners.length} בולים` : 'טוענים…'}
        </span>
        <button onClick={() => void load()} aria-label="רעננו" title="רעננו" className="p-2 rounded-lg text-text-secondary hover:bg-bg-hover">
          <RefreshCw className="w-4 h-4" />
        </button>
        <button
          onClick={() => void exportExcel()}
          disabled={!players?.length}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-bg-hover disabled:opacity-40"
        >
          <Download className="w-4 h-4" />
          אקסל
        </button>
      </div>

      {players && players.length > 8 && (
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש לפי כינוי או טלפון" className="input !py-2" />
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {players && players.length === 0 && (
        <p className="rounded-xl bg-bg-secondary px-3 py-4 text-center text-sm text-text-secondary">עוד אין שחקנים. הם יופיעו כאן אחרי הניסיון הראשון.</p>
      )}

      <ul className="space-y-1.5 max-h-80 overflow-y-auto">
        {shown.map((p) => (
          <li key={p.id} className={`flex items-center gap-2.5 rounded-xl bg-bg-secondary px-3 py-2 ${p.hidden ? 'opacity-50' : ''}`}>
            {p.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.photoUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
            ) : (
              <span className="w-9 h-9 rounded-full bg-bg-primary shrink-0 flex items-center justify-center text-text-secondary">
                {p.won ? <Trophy className="w-4 h-4 text-yellow-500" /> : <span className="text-xs">{p.attempts}</span>}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text-primary truncate">{p.nickname}</div>
              <div className="text-xs text-text-secondary truncate">
                {p.won
                  ? `בול בניסיון ה-${p.wonAttempts}${p.claimed ? '' : ' · עוד לא סיים הרשמה'}`
                  : `${p.attempts} ניסיונות${p.bestDiff != null ? ` · הכי קרוב ${formatDiff(p.bestDiff)}` : ''}`}
                {p.suspicious > 0 ? ' · זמן חשוד' : ''}
              </div>
              {p.phone && (
                <a href={waLink(p.phone)} target="_blank" rel="noopener noreferrer" dir="ltr" className="text-xs text-accent hover:underline">
                  {localPhone(p.phone)}
                </a>
              )}
            </div>
            {busyId === p.id ? (
              <Loader2 className="w-4 h-4 animate-spin text-text-secondary" />
            ) : (
              <div className="flex items-center">
                {p.photoUrl && (
                  <button
                    onClick={() => void act('clearPhoto', p.id)}
                    aria-label="הסירו את התמונה"
                    title="הסירו את התמונה"
                    className="p-2 rounded-lg text-text-secondary hover:bg-bg-hover hover:text-danger"
                  >
                    <ImageOff className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => void act(p.hidden ? 'unhide' : 'hide', p.id)}
                  aria-label={p.hidden ? 'החזירו ללוח' : 'הסתירו מהלוח'}
                  title={p.hidden ? 'החזירו ללוח' : 'הסתירו מהלוח'}
                  className="p-2 rounded-lg text-text-secondary hover:bg-bg-hover"
                >
                  {p.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {players && players.length > 0 && (
        <div className="rounded-xl border border-border px-3 py-2.5 space-y-2">
          {!confirmReset ? (
            <button onClick={() => setConfirmReset(true)} className="flex items-center gap-1.5 text-sm text-danger hover:underline">
              <Trash2 className="w-4 h-4" />
              איפוס המשחק — מחיקת כל השחקנים והלוח
            </button>
          ) : (
            <>
              <p className="text-sm text-text-primary">
                כל השחקנים, הניסיונות והתמונות יימחקו לצמיתות. כדי לאשר, כתבו <b>{RESET_WORD}</b>
              </p>
              <div className="flex gap-2">
                <input value={resetText} onChange={(e) => setResetText(e.target.value)} className="input !py-2 flex-1" aria-label="אישור איפוס" />
                <button
                  onClick={async () => {
                    await act('reset');
                    setConfirmReset(false);
                    setResetText('');
                  }}
                  disabled={resetText.trim() !== RESET_WORD || busyId === 'reset'}
                  className="btn !bg-danger !text-white !py-2 disabled:opacity-40"
                >
                  {busyId === 'reset' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'אפסו'}
                </button>
                <button
                  onClick={() => {
                    setConfirmReset(false);
                    setResetText('');
                  }}
                  className="px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-bg-hover"
                >
                  ביטול
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
