'use client';

// Social Wall moderation — shared by the owner (code page modal, Firebase auth via fetchWithAuth)
// and the on-site staff link (/v/{shortId}#mod=<token>, x-sw-mod header). The caller passes
// `request`, which adds the right credentials; everything here goes through
// /api/socialwall/moderate|control|members. Refreshes itself on the RTDB rev pulse.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { ref as rtdbRef, onValue } from 'firebase/database';
import {
  Ban, Check, Clock3, Download, Eye, EyeOff, Heart, Loader2, RefreshCw, ShieldCheck, Trash2, Upload, UserCheck, Users,
} from 'lucide-react';
import { realtimeDb } from '@/lib/firebase';
import type { SocialWallGroup } from '@/types/socialwall';

export type SwRequest = (path: string, init?: RequestInit) => Promise<Response>;

interface ModPost {
  id: string;
  memberId: string;
  authorName: string;
  groupId: string | null;
  caption: string;
  cardUrl: string;
  fullUrl: string;
  likeCount: number;
  status: 'visible' | 'pending' | 'hidden';
  createdAt: number;
}

interface Member {
  id: string;
  name: string;
  groupId: string | null;
  status: 'active' | 'blocked';
  phone: string | null;
  postCount: number;
  likesGiven: number;
  createdAt: number;
}

type Filter = 'all' | 'pending' | 'hidden';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'הכל' },
  { key: 'pending', label: 'ממתינים לאישור' },
  { key: 'hidden', label: 'מוסתרים' },
];

async function readJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function timeLabel(ts: number) {
  return new Date(ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

/** Two-step confirm for the destructive actions (delete post, block member). */
function ConfirmBar({ text, onYes, onNo, busy }: { text: string; onYes: () => void; onNo: () => void; busy: boolean }) {
  return (
    <div className="absolute inset-0 z-10 bg-black/75 flex flex-col items-center justify-center gap-3 p-3 text-center rounded-xl">
      <p className="text-white text-sm font-semibold">{text}</p>
      <div className="flex gap-2">
        <button onClick={onYes} disabled={busy} className="h-9 px-4 rounded-lg bg-red-600 text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-50">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          אישור
        </button>
        <button onClick={onNo} disabled={busy} className="h-9 px-4 rounded-lg bg-white/90 text-gray-900 text-sm font-semibold">
          ביטול
        </button>
      </div>
    </div>
  );
}

function PostTile({
  post, group, onAction, busy,
}: {
  post: ModPost;
  group?: SocialWallGroup;
  onAction: (action: string, post: ModPost) => Promise<void>;
  busy: boolean;
}) {
  const [confirm, setConfirm] = useState<null | 'delete' | 'block'>(null);
  const run = async (action: string) => {
    await onAction(action, post);
    setConfirm(null);
  };
  return (
    <div className={`relative rounded-xl overflow-hidden border bg-bg-secondary ${post.status === 'hidden' ? 'border-danger/40 opacity-70' : post.status === 'pending' ? 'border-amber-400/60' : 'border-border'}`}>
      <div className="relative aspect-square bg-black/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={post.cardUrl} alt="" loading="lazy" className={`absolute inset-0 w-full h-full object-cover ${post.status === 'hidden' ? 'grayscale' : ''}`} />
        {post.status !== 'visible' && (
          <span className={`absolute top-2 start-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-white ${post.status === 'pending' ? 'bg-amber-500' : 'bg-red-600'}`}>
            {post.status === 'pending' ? <Clock3 className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {post.status === 'pending' ? 'ממתין' : 'מוסתר'}
          </span>
        )}
        <span className="absolute bottom-2 end-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-white text-[11px] font-bold">
          <Heart className="w-3 h-3 fill-white" />
          {post.likeCount}
        </span>
      </div>
      <div className="p-2.5 space-y-1">
        <div className="text-sm font-semibold text-text-primary truncate">{post.authorName}</div>
        <div className="text-[11px] text-text-secondary truncate">
          {group ? `${group.label} · ` : ''}
          {timeLabel(post.createdAt)}
        </div>
        {post.caption && <p className="text-xs text-text-secondary line-clamp-2 break-words">{post.caption}</p>}
      </div>
      <div className="grid grid-cols-3 border-t border-border">
        {post.status === 'pending' ? (
          <button onClick={() => run('approve')} disabled={busy} title="אישור" className="h-10 flex items-center justify-center text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-40">
            <Check className="w-4 h-4" />
          </button>
        ) : post.status === 'hidden' ? (
          <button onClick={() => run('show')} disabled={busy} title="החזרה לפיד" className="h-10 flex items-center justify-center text-text-primary hover:bg-bg-hover disabled:opacity-40">
            <Eye className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={() => run('hide')} disabled={busy} title="הסתרה מהפיד" className="h-10 flex items-center justify-center text-text-primary hover:bg-bg-hover disabled:opacity-40">
            <EyeOff className="w-4 h-4" />
          </button>
        )}
        <button onClick={() => setConfirm('delete')} disabled={busy} title="מחיקה" className="h-10 flex items-center justify-center text-danger hover:bg-danger/10 border-x border-border disabled:opacity-40">
          <Trash2 className="w-4 h-4" />
        </button>
        <button onClick={() => setConfirm('block')} disabled={busy} title="חסימת המשתתף" className="h-10 flex items-center justify-center text-danger hover:bg-danger/10 disabled:opacity-40">
          <Ban className="w-4 h-4" />
        </button>
      </div>
      {confirm && (
        <ConfirmBar
          text={confirm === 'delete' ? 'למחוק את התמונה לצמיתות?' : `לחסום את ${post.authorName}? כל התמונות שלו יוסתרו.`}
          onYes={() => run(confirm)}
          onNo={() => setConfirm(null)}
          busy={busy}
        />
      )}
    </div>
  );
}

export function ModerationPanel({
  codeId, groups, request, compact = false,
}: {
  codeId: string;
  groups: SocialWallGroup[];
  request: SwRequest;
  compact?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [posts, setPosts] = useState<ModPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadsOpen, setUploadsOpen] = useState(true);
  const [rev, setRev] = useState(0);
  const groupsById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const gen = useRef(0);

  const load = useCallback(async (more = false) => {
    const g = more ? gen.current : ++gen.current;
    if (!more) setLoading(true);
    try {
      const q = new URLSearchParams({ codeId, filter });
      if (more && cursor) q.set('cursor', cursor);
      const res = await request(`/api/socialwall/moderate?${q}`);
      const data = await readJson(res);
      if (g !== gen.current) return;
      if (!res.ok) throw new Error(res.status === 401 ? 'אין הרשאה' : 'הטעינה נכשלה');
      setPosts((prev) => (more ? [...prev, ...data.posts.filter((p: ModPost) => !prev.some((x) => x.id === p.id))] : data.posts));
      setCursor(data.nextCursor || null);
      setError(null);
    } catch (e) {
      if (g === gen.current) setError(e instanceof Error ? e.message : 'הטעינה נכשלה');
    } finally {
      if (g === gen.current) setLoading(false);
    }
  }, [codeId, filter, cursor, request]);

  useEffect(() => {
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on filter change only
  }, [filter, codeId]);

  // Live: the same pulse the phones use
  useEffect(() => {
    let poll: ReturnType<typeof setInterval> | null = null;
    const unsub = onValue(
      rtdbRef(realtimeDb, `socialwall/${codeId}`),
      (snap) => {
        const v = snap.val() || {};
        setRev(typeof v.rev === 'number' ? v.rev : 0);
        setUploadsOpen(v.control?.uploads !== false);
      },
      // No live pulse (rules / firewall): refresh the queue every 8s instead
      () => {
        poll = setInterval(() => setRev((n) => n + 1), 8000);
      }
    );
    return () => {
      unsub();
      if (poll) clearInterval(poll);
    };
  }, [codeId]);
  const firstRev = useRef(true);
  useEffect(() => {
    if (firstRev.current) {
      firstRev.current = false;
      return;
    }
    const id = setTimeout(() => void load(false), 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev]);

  const act = useCallback(async (action: string, post: ModPost) => {
    setBusyId(post.id);
    try {
      const body = action === 'block' ? { codeId, action, memberId: post.memberId } : { codeId, action, postId: post.id };
      const res = await request('/api/socialwall/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setPosts((prev) => {
        if (action === 'delete') return prev.filter((p) => p.id !== post.id);
        if (action === 'block') return prev.map((p) => (p.memberId === post.memberId ? { ...p, status: 'hidden' } : p));
        const status = action === 'hide' ? 'hidden' : 'visible';
        return prev.map((p) => (p.id === post.id ? { ...p, status } : p));
      });
    } catch {
      setError('הפעולה נכשלה, נסו שוב');
    } finally {
      setBusyId(null);
    }
  }, [codeId, request]);

  const toggleUploads = async () => {
    const next = !uploadsOpen;
    setUploadsOpen(next);
    const res = await request('/api/socialwall/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codeId, uploads: next }),
    }).catch(() => null);
    if (!res?.ok) {
      setUploadsOpen(!next);
      setError('לא הצלחנו לשנות את מצב ההעלאות');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={toggleUploads}
          className={`h-10 px-4 rounded-xl text-sm font-bold flex items-center gap-2 border transition-colors ${
            uploadsOpen ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400' : 'bg-danger/10 text-danger border-danger/30'
          }`}
        >
          <Upload className="w-4 h-4" />
          {uploadsOpen ? 'העלאות פתוחות' : 'העלאות סגורות'}
        </button>
        <button onClick={() => void load(false)} className="h-10 w-10 rounded-xl bg-bg-secondary text-text-secondary flex items-center justify-center hover:bg-bg-hover" title="רענון">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <div className="flex gap-1.5 ms-auto overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`h-9 px-3 rounded-full text-sm font-medium shrink-0 ${filter === f.key ? 'bg-accent text-white' : 'bg-bg-secondary text-text-secondary hover:text-text-primary'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {loading && !posts.length ? (
        <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-text-secondary" /></div>
      ) : posts.length === 0 ? (
        <div className="py-14 text-center text-text-secondary">
          <ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-50" />
          {filter === 'pending' ? 'אין תמונות שממתינות לאישור' : filter === 'hidden' ? 'אין תמונות מוסתרות' : 'עוד אין תמונות'}
        </div>
      ) : (
        <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
          {posts.map((p) => (
            <PostTile key={p.id} post={p} group={p.groupId ? groupsById.get(p.groupId) : undefined} onAction={act} busy={busyId === p.id} />
          ))}
        </div>
      )}
      {cursor && (
        <button onClick={() => void load(true)} className="w-full h-10 rounded-xl bg-bg-secondary text-sm font-medium text-text-primary hover:bg-bg-hover">
          טעינת עוד
        </button>
      )}
    </div>
  );
}

export function MembersPanel({
  codeId, groups, request, eventTitle,
}: {
  codeId: string;
  groups: SocialWallGroup[];
  request: SwRequest;
  eventTitle: string;
}) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const groupsById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  const load = useCallback(async () => {
    const res = await request(`/api/socialwall/members?codeId=${encodeURIComponent(codeId)}`).catch(() => null);
    if (!res?.ok) {
      setError('הטעינה נכשלה');
      setMembers([]);
      return;
    }
    setMembers((await readJson(res)).members || []);
  }, [codeId, request]);

  useEffect(() => {
    void load();
  }, [load]);

  const setBlocked = async (m: Member, block: boolean) => {
    setBusyId(m.id);
    const res = await request('/api/socialwall/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codeId, action: block ? 'block' : 'unblock', memberId: m.id }),
    }).catch(() => null);
    setBusyId(null);
    if (!res?.ok) return setError('הפעולה נכשלה');
    setMembers((list) => list?.map((x) => (x.id === m.id ? { ...x, status: block ? 'blocked' : 'active' } : x)) ?? list);
  };

  const exportExcel = () => {
    if (!members) return;
    const rows = members.map((m) => ({
      'שם': m.name,
      'מחלקה': m.groupId ? groupsById.get(m.groupId)?.label || '' : '',
      'טלפון': m.phone || '',
      'תמונות': m.postCount,
      'לייקים שנתן': m.likesGiven,
      'סטטוס': m.status === 'blocked' ? 'חסום' : 'פעיל',
      'הצטרף': new Date(m.createdAt).toLocaleString('he-IL'),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'משתתפים');
    XLSX.writeFile(wb, `${eventTitle || 'social-wall'} - משתתפים.xlsx`);
  };

  const filtered = (members || []).filter((m) => !query || m.name.includes(query) || (m.phone || '').includes(query));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש לפי שם או טלפון" className="input flex-1 text-sm" />
        <button onClick={exportExcel} disabled={!members?.length} className="btn btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50">
          <Download className="w-4 h-4" />
          אקסל
        </button>
      </div>
      <div className="flex items-center gap-1.5 text-sm text-text-secondary">
        <Users className="w-4 h-4" />
        {members ? `${members.length} משתתפים` : 'טוען…'}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
        {filtered.slice(0, 300).map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 bg-bg-primary">
            <div className="min-w-0 flex-1">
              <div className={`text-sm font-semibold truncate ${m.status === 'blocked' ? 'text-danger line-through' : 'text-text-primary'}`}>{m.name || '—'}</div>
              <div className="text-xs text-text-secondary truncate">
                {m.groupId ? groupsById.get(m.groupId)?.label : ''}
                {m.phone ? <span dir="ltr"> · {m.phone}</span> : null} · {m.postCount} תמונות
              </div>
            </div>
            <button
              onClick={() => setBlocked(m, m.status !== 'blocked')}
              disabled={busyId === m.id}
              className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1 ${m.status === 'blocked' ? 'bg-bg-secondary text-text-primary' : 'bg-danger/10 text-danger'} disabled:opacity-50`}
            >
              {busyId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : m.status === 'blocked' ? <UserCheck className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
              {m.status === 'blocked' ? 'שחרור' : 'חסימה'}
            </button>
          </div>
        ))}
        {members && !filtered.length && <div className="px-3 py-6 text-center text-sm text-text-secondary">אין משתתפים</div>}
      </div>
    </div>
  );
}
