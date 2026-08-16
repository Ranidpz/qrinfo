'use client';

import { useEffect, useMemo, useState } from 'react';
import { Trash2, Pencil, Check, X, Plus, Search, MessageCircle, Copy, Loader2 } from 'lucide-react';
import type { RaffleListType } from '@/lib/raffle/types';
import AnimatedNumber from './AnimatedNumber';

export interface ParticipantRow {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  quantity: number;
}

type Fields = { firstName: string; lastName: string; phone: string; quantity: number };

interface Props {
  participants: ParticipantRow[];
  loading?: boolean;
  listType?: RaffleListType;
  onUpdate: (id: string, fields: Fields) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  onAdd: (fields: Fields) => Promise<void> | void;
  // Bulk removal. onDeleteAll wipes the whole participant list.
  onDeleteMany?: (ids: string[]) => Promise<void> | void;
  onDeleteAll?: () => Promise<void> | void;
}

const EMPTY: Fields = { firstName: '', lastName: '', phone: '', quantity: 1 };
type Filter = 'all' | 'nophone' | 'dupname' | 'dupcode';

// Only this many rows are put in the DOM at once. A code list runs to
// thousands of rows, and rendering them all makes every checkbox click
// re-render the whole table. Selection and deletion still operate on the full
// filtered set — only the drawing is capped.
const RENDER_LIMIT = 200;

// Israeli display format: ensure a leading 0 (Excel often drops it).
function displayPhone(raw: string): string {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('972')) d = '0' + d.slice(3);
  if (d.length === 9) d = '0' + d; // 5XXXXXXXX → 05XXXXXXXX
  return d;
}

// wa.me international format (no +): 0XXXXXXXXX → 972XXXXXXXXX.
// No prefilled text — just opens a chat with the number.
function waLink(raw: string): string {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '972' + d.slice(1);
  else if (d.length === 9) d = '972' + d;
  return `https://wa.me/${d}`;
}

function nameKey(p: { firstName: string; lastName: string }) {
  return `${p.firstName} ${p.lastName}`.trim().toLowerCase();
}

function Field({
  value,
  onChange,
  placeholder,
  w,
  ltr,
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  w?: string;
  ltr?: boolean;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      dir={ltr ? 'ltr' : undefined}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded bg-white/10 px-2 py-1 text-sm text-white outline-none ${w || 'w-full'}`}
    />
  );
}

export default function RaffleParticipantsTable({
  participants,
  loading,
  listType = 'people',
  onUpdate,
  onDelete,
  onAdd,
  onDeleteMany,
  onDeleteAll,
}: Props) {
  const isCodes = listType === 'codes';
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Fields>(EMPTY);
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState<Fields>(EMPTY);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState<'selected' | 'all' | null>(null);
  const [busy, setBusy] = useState(false);

  // Reset the filter if it no longer applies to the current list type.
  useEffect(() => {
    setFilter((f) => (isCodes ? (f === 'dupcode' ? f : 'all') : f === 'dupcode' ? 'all' : f));
  }, [isCodes]);

  const noPhone = useMemo(() => participants.filter((p) => !p.phone), [participants]);
  const dupIds = useMemo(() => {
    const counts = new Map<string, number>();
    participants.forEach((p) => {
      const k = isCodes ? p.firstName.trim().toLowerCase() : nameKey(p);
      if (k) counts.set(k, (counts.get(k) || 0) + 1);
    });
    return new Set(
      participants
        .filter((p) => (counts.get(isCodes ? p.firstName.trim().toLowerCase() : nameKey(p)) || 0) > 1)
        .map((p) => p.id)
    );
  }, [participants, isCodes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = participants;
    if (filter === 'nophone') list = list.filter((p) => !p.phone);
    else if (filter === 'dupname' || filter === 'dupcode') list = list.filter((p) => dupIds.has(p.id));
    if (q) list = list.filter((p) => `${p.firstName} ${p.lastName} ${p.phone}`.toLowerCase().includes(q));
    return list;
  }, [participants, query, filter, dupIds]);

  const visible = useMemo(() => filtered.slice(0, RENDER_LIMIT), [filtered]);
  const hiddenCount = filtered.length - visible.length;

  // Drop selections for rows that no longer exist (after a delete or reimport).
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const alive = new Set(participants.map((p) => p.id));
      const next = new Set([...prev].filter((id) => alive.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [participants]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const toggleAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filtered.forEach((p) => next.delete(p.id));
      else filtered.forEach((p) => next.add(p.id));
      return next;
    });
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startEdit = (p: ParticipantRow) => {
    setEditingId(p.id);
    setDraft({ firstName: p.firstName, lastName: p.lastName, phone: p.phone, quantity: p.quantity });
  };
  const saveEdit = async (id: string) => {
    await onUpdate(id, draft);
    setEditingId(null);
  };
  const copyValue = async (id: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1200);
    } catch {
      /* ignore */
    }
  };

  const runBulk = async () => {
    if (!confirmBulk) return;
    setBusy(true);
    try {
      if (confirmBulk === 'all') await Promise.resolve(onDeleteAll?.());
      else await Promise.resolve(onDeleteMany?.([...selected]));
      setSelected(new Set());
      setConfirmBulk(null);
    } finally {
      setBusy(false);
    }
  };

  const chip = (key: Filter, label: string, count: number, danger?: boolean) => (
    <button
      onClick={() => setFilter(key)}
      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition ${
        filter === key
          ? danger
            ? 'bg-amber-400 text-black'
            : 'bg-white/15 text-white'
          : 'bg-white/5 text-white/55 hover:bg-white/10'
      }`}
    >
      {label} ({count.toLocaleString('he-IL')})
    </button>
  );

  const canBulk = !!onDeleteMany || !!onDeleteAll;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-white/60">
        {isCodes ? 'קודים שנטענו' : 'משתתפים שנטענו'} (<AnimatedNumber value={participants.length} />)
        {loading && <Loader2 size={14} className="animate-spin text-amber-400" />}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {chip('all', 'הכל', participants.length)}
        {isCodes ? (
          chip('dupcode', 'קוד כפול', dupIds.size, true)
        ) : (
          <>
            {chip('nophone', 'ללא טלפון', noPhone.length, true)}
            {chip('dupname', 'שם כפול', dupIds.size, true)}
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isCodes ? 'חיפוש קוד…' : 'חיפוש לפי שם או טלפון…'}
            className="w-full rounded-lg bg-white/5 py-2 pr-8 pl-3 text-sm text-white/80 outline-none placeholder:text-white/30"
          />
        </div>
        <button
          onClick={() => {
            setAdding((a) => !a);
            setAddDraft(EMPTY);
          }}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-white/5 px-3 text-xs text-white/70 hover:bg-white/10"
        >
          <Plus size={14} /> הוסיפו
        </button>
      </div>

      {adding && (
        <div className="flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/5 p-2">
          {isCodes ? (
            <Field value={addDraft.firstName} onChange={(v) => setAddDraft((d) => ({ ...d, firstName: v }))} placeholder="קוד" ltr />
          ) : (
            <>
              <Field value={addDraft.firstName} onChange={(v) => setAddDraft((d) => ({ ...d, firstName: v }))} placeholder="שם פרטי" />
              <Field value={addDraft.lastName} onChange={(v) => setAddDraft((d) => ({ ...d, lastName: v }))} placeholder="שם משפחה" />
              <Field value={addDraft.phone} onChange={(v) => setAddDraft((d) => ({ ...d, phone: v }))} placeholder="טלפון" w="w-28" />
            </>
          )}
          <Field value={addDraft.quantity} onChange={(v) => setAddDraft((d) => ({ ...d, quantity: Number(v) || 1 }))} w="w-14" />
          <button
            onClick={async () => {
              if (!addDraft.firstName && !addDraft.phone) return;
              await onAdd(addDraft);
              setAdding(false);
              setAddDraft(EMPTY);
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-emerald-500 text-white"
          >
            <Check size={15} />
          </button>
          <button onClick={() => setAdding(false)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white/10 text-white/70">
            <X size={15} />
          </button>
        </div>
      )}

      {/* bulk bar — appears only once something is selected */}
      {canBulk && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
          <span className="text-xs font-medium text-white/80">נבחרו {selected.size.toLocaleString('he-IL')}</span>
          <button onClick={() => setSelected(new Set())} className="text-xs text-white/50 underline hover:text-white/80">
            נקו בחירה
          </button>
          <div className="flex-1" />
          {confirmBulk === 'selected' ? (
            <>
              <span className="text-xs text-red-300">למחוק {selected.size.toLocaleString('he-IL')} שורות?</span>
              <button
                onClick={runBulk}
                disabled={busy}
                className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} כן, מחקו
              </button>
              <button onClick={() => setConfirmBulk(null)} className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs text-white/70">
                ביטול
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmBulk('selected')}
              className="flex items-center gap-1.5 rounded-lg bg-red-600/90 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-600"
            >
              <Trash2 size={12} /> מחקו נבחרים
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-white/10 px-2 pb-1.5 text-xs text-white/40">
        {canBulk && (
          <input
            type="checkbox"
            checked={allFilteredSelected}
            onChange={toggleAllFiltered}
            disabled={filtered.length === 0}
            title="בחרו הכל"
            className="h-3.5 w-3.5 shrink-0 accent-amber-400"
          />
        )}
        <span className="flex-1">{isCodes ? 'קוד' : 'שם'}</span>
        {!isCodes && <span className="w-48">טלפון</span>}
        <span className="w-12 text-center">כמות</span>
        <span className="w-14 text-center">פעולות</span>
      </div>

      <div className="max-h-72 space-y-1 overflow-y-auto pr-0.5">
        {loading && participants.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-white/50">
            <Loader2 size={22} className="animate-spin text-amber-400" />
            <span className="text-xs">טוען…</span>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-4 text-center text-xs text-white/40">אין תוצאות.</p>
        ) : (
          visible.map((p) =>
            editingId === p.id ? (
              <div key={p.id} className="flex items-center gap-1.5 rounded-lg bg-white/10 p-1.5">
                {isCodes ? (
                  <Field value={draft.firstName} onChange={(v) => setDraft((d) => ({ ...d, firstName: v }))} placeholder="קוד" ltr />
                ) : (
                  <>
                    <Field value={draft.firstName} onChange={(v) => setDraft((d) => ({ ...d, firstName: v }))} placeholder="שם פרטי" />
                    <Field value={draft.lastName} onChange={(v) => setDraft((d) => ({ ...d, lastName: v }))} placeholder="שם משפחה" />
                    <Field value={draft.phone} onChange={(v) => setDraft((d) => ({ ...d, phone: v }))} placeholder="טלפון" w="w-28" />
                  </>
                )}
                <Field value={draft.quantity} onChange={(v) => setDraft((d) => ({ ...d, quantity: Number(v) || 1 }))} w="w-12" />
                <button onClick={() => saveEdit(p.id)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-emerald-500 text-white">
                  <Check size={15} />
                </button>
                <button onClick={() => setEditingId(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white/10 text-white/70">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div
                key={p.id}
                className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm ${
                  selected.has(p.id) ? 'bg-amber-400/15' : !isCodes && !p.phone ? 'bg-amber-400/10' : 'bg-white/5'
                } ${dupIds.has(p.id) ? 'ring-1 ring-amber-400/30' : ''}`}
              >
                {canBulk && (
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggleOne(p.id)}
                    className="h-3.5 w-3.5 shrink-0 accent-amber-400"
                  />
                )}

                {isCodes ? (
                  <>
                    <span className="min-w-0 flex-1 truncate font-mono tracking-wide" dir="ltr">
                      {p.firstName || '—'}
                    </span>
                    <button
                      onClick={() => copyValue(p.id, p.firstName)}
                      title="העתיקו קוד"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/20"
                    >
                      {copiedId === p.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate">{`${p.firstName} ${p.lastName}`.trim() || '—'}</span>
                    <div className="flex w-48 items-center gap-1">
                      {p.phone ? (
                        <>
                          <span className="min-w-0 flex-1 truncate text-xs text-white/70" dir="ltr">
                            {displayPhone(p.phone)}
                          </span>
                          <a
                            href={waLink(p.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="שלחו וואטסאפ"
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/90 text-white hover:bg-emerald-500"
                          >
                            <MessageCircle size={13} />
                          </a>
                          <button
                            onClick={() => copyValue(p.id, displayPhone(p.phone))}
                            title="העתיקו מספר"
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/20"
                          >
                            {copiedId === p.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                          </button>
                        </>
                      ) : (
                        <span className="text-xs font-medium text-amber-400">ללא טלפון</span>
                      )}
                    </div>
                  </>
                )}

                <span className="w-12 text-center text-white/70">{p.quantity}</span>
                <div className="flex w-14 shrink-0 items-center justify-center gap-0.5">
                  <button onClick={() => startEdit(p)} className="flex h-7 w-7 items-center justify-center rounded text-white/50 hover:bg-white/10 hover:text-white">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => onDelete(p.id)} className="flex h-7 w-7 items-center justify-center rounded text-white/50 hover:bg-red-500/20 hover:text-red-400">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          )
        )}
        {hiddenCount > 0 && (
          <p className="py-2 text-center text-[11px] text-white/35">
            מוצגות {visible.length.toLocaleString('he-IL')} מתוך {filtered.length.toLocaleString('he-IL')} — חפשו או סננו כדי לצמצם.
            &nbsp;״בחרו הכל״ ומחיקה חלים על כל {filtered.length.toLocaleString('he-IL')} השורות.
          </p>
        )}
      </div>

      {/* delete-everything, kept away from the per-row controls */}
      {onDeleteAll && participants.length > 0 && (
        <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-2.5">
          {confirmBulk === 'all' ? (
            <>
              <span className="text-xs text-red-300">
                למחוק את כל {participants.length.toLocaleString('he-IL')} השורות?
              </span>
              <button
                onClick={runBulk}
                disabled={busy}
                className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} כן, מחקו הכל
              </button>
              <button onClick={() => setConfirmBulk(null)} className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs text-white/70">
                ביטול
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmBulk('all')}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-red-400/80 hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 size={13} /> מחקו את כל הרשימה
            </button>
          )}
        </div>
      )}

      <p className="text-xs leading-relaxed text-white/35">
        {isCodes ? (
          <>
            <b className="text-white/50">קוד כפול</b> = אותו קוד מופיע יותר מפעם אחת. ביבוא כפילויות מאוחדות
            אוטומטית; סמנו שורות כדי למחוק כמה יחד.
          </>
        ) : (
          <>
            <b className="text-white/50">ללא טלפון</b> = שורות שאין בהן מספר — לא נבדקת להן כפילות (כפילות מזוהה
            לפי טלפון). <b className="text-white/50">שם כפול</b> = אותו שם מופיע יותר מפעם אחת (יכולים להיות
            אנשים שונים). סמנו שורות כדי למחוק כמה יחד.
          </>
        )}
      </p>
    </div>
  );
}
