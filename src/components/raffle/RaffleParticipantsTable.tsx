'use client';

import { useMemo, useState } from 'react';
import { Trash2, Pencil, Check, X, Plus, Search, MessageCircle, Copy, Loader2 } from 'lucide-react';
import AnimatedNumber from './AnimatedNumber';

export interface ParticipantRow {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  quantity: number;
}

interface Props {
  participants: ParticipantRow[];
  loading?: boolean;
  onUpdate: (id: string, fields: { firstName: string; lastName: string; phone: string; quantity: number }) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  onAdd: (fields: { firstName: string; lastName: string; phone: string; quantity: number }) => Promise<void> | void;
}

const EMPTY = { firstName: '', lastName: '', phone: '', quantity: 1 };
type Filter = 'all' | 'nophone' | 'dupname';

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
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  w?: string;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded bg-white/10 px-2 py-1 text-sm text-white outline-none ${w || 'w-full'}`}
    />
  );
}

export default function RaffleParticipantsTable({ participants, loading, onUpdate, onDelete, onAdd }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY);
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState(EMPTY);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const noPhone = useMemo(() => participants.filter((p) => !p.phone), [participants]);
  const dupNameIds = useMemo(() => {
    const counts = new Map<string, number>();
    participants.forEach((p) => {
      const k = nameKey(p);
      if (k) counts.set(k, (counts.get(k) || 0) + 1);
    });
    return new Set(participants.filter((p) => (counts.get(nameKey(p)) || 0) > 1).map((p) => p.id));
  }, [participants]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = participants;
    if (filter === 'nophone') list = list.filter((p) => !p.phone);
    else if (filter === 'dupname') list = list.filter((p) => dupNameIds.has(p.id));
    if (q) list = list.filter((p) => `${p.firstName} ${p.lastName} ${p.phone}`.toLowerCase().includes(q));
    return list;
  }, [participants, query, filter, dupNameIds]);

  const startEdit = (p: ParticipantRow) => {
    setEditingId(p.id);
    setDraft({ firstName: p.firstName, lastName: p.lastName, phone: p.phone, quantity: p.quantity });
  };
  const saveEdit = async (id: string) => {
    await onUpdate(id, draft);
    setEditingId(null);
  };
  const copyPhone = async (id: string, phone: string) => {
    try {
      await navigator.clipboard.writeText(displayPhone(phone));
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1200);
    } catch {
      /* ignore */
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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-white/60">
        משתתפים שנטענו (<AnimatedNumber value={participants.length} />)
        {loading && <Loader2 size={14} className="animate-spin text-amber-400" />}
      </div>

      {/* filter chips — make "who has no phone / duplicate names" obvious */}
      <div className="flex flex-wrap gap-1.5">
        {chip('all', 'הכל', participants.length)}
        {chip('nophone', 'ללא טלפון', noPhone.length, true)}
        {chip('dupname', 'שם כפול', dupNameIds.size, true)}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש לפי שם או טלפון…"
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
          <Plus size={14} /> הוסף
        </button>
      </div>

      {adding && (
        <div className="flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/5 p-2">
          <Field value={addDraft.firstName} onChange={(v) => setAddDraft((d) => ({ ...d, firstName: v }))} placeholder="שם פרטי" />
          <Field value={addDraft.lastName} onChange={(v) => setAddDraft((d) => ({ ...d, lastName: v }))} placeholder="שם משפחה" />
          <Field value={addDraft.phone} onChange={(v) => setAddDraft((d) => ({ ...d, phone: v }))} placeholder="טלפון" w="w-28" />
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

      <div className="flex items-center gap-2 border-b border-white/10 px-2 pb-1.5 text-xs text-white/40">
        <span className="flex-1">שם</span>
        <span className="w-48">טלפון</span>
        <span className="w-12 text-center">כמות</span>
        <span className="w-14 text-center">פעולות</span>
      </div>

      <div className="max-h-72 space-y-1 overflow-y-auto pr-0.5">
        {loading && participants.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-white/50">
            <Loader2 size={22} className="animate-spin text-amber-400" />
            <span className="text-xs">טוען משתתפים…</span>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-4 text-center text-xs text-white/40">אין תוצאות.</p>
        ) : (
          filtered.map((p) =>
            editingId === p.id ? (
              <div key={p.id} className="flex items-center gap-1.5 rounded-lg bg-white/10 p-1.5">
                <Field value={draft.firstName} onChange={(v) => setDraft((d) => ({ ...d, firstName: v }))} placeholder="שם פרטי" />
                <Field value={draft.lastName} onChange={(v) => setDraft((d) => ({ ...d, lastName: v }))} placeholder="שם משפחה" />
                <Field value={draft.phone} onChange={(v) => setDraft((d) => ({ ...d, phone: v }))} placeholder="טלפון" w="w-28" />
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
                  p.phone ? 'bg-white/5' : 'bg-amber-400/10'
                } ${dupNameIds.has(p.id) ? 'ring-1 ring-amber-400/30' : ''}`}
              >
                <span className="min-w-0 flex-1 truncate">{`${p.firstName} ${p.lastName}`.trim() || '—'}</span>

                {/* phone + WhatsApp + copy */}
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
                        title="שלח וואטסאפ"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/90 text-white hover:bg-emerald-500"
                      >
                        <MessageCircle size={13} />
                      </a>
                      <button
                        onClick={() => copyPhone(p.id, p.phone)}
                        title="העתק מספר"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/20"
                      >
                        {copiedId === p.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      </button>
                    </>
                  ) : (
                    <span className="text-xs font-medium text-amber-400">ללא טלפון</span>
                  )}
                </div>

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
      </div>

      <p className="text-xs leading-relaxed text-white/35">
        <b className="text-white/50">ללא טלפון</b> = שורות שאין בהן מספר (כמו בקובץ) — לא נבדקת להן כפילות (כפילות מזוהה לפי טלפון).{' '}
        <b className="text-white/50">שם כפול</b> = אותו שם מופיע יותר מפעם אחת (יכולים להיות אנשים שונים). אפשר לסנן, לערוך או למחוק כל אחד.
      </p>
    </div>
  );
}
