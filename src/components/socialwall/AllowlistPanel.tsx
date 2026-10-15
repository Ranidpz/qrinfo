'use client';

// HR list import for the allowlist access modes. The sheet is parsed in the browser (Excel or
// CSV — CSV is read as TEXT, an ArrayBuffer turns Hebrew headers into mojibake), shown as a
// preview, and only then sent to /api/socialwall/allowlist (owner only), which re-validates
// every phone. Department names are matched to the event's groups by label.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { AlertTriangle, Download, FileSpreadsheet, Loader2, Plus, Upload, Users } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import type { SocialWallGroup } from '@/types/socialwall';

interface Row {
  phone: string;
  name: string;
  group: string;
}

const PHONE_KEYS = ['טלפון', 'נייד', 'פלאפון', 'מספר', 'phone', 'mobile', 'cell', 'tel'];
const NAME_KEYS = ['שם', 'name', 'full name', 'שם מלא', 'עובד'];
const GROUP_KEYS = ['מחלקה', 'צוות', 'יחידה', 'אגף', 'department', 'dept', 'team', 'group'];

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();
const findCol = (headers: string[], keys: string[]) => headers.findIndex((h) => keys.some((k) => norm(h).includes(k)));
const looksLikeMobile = (raw: string) => /^(?:\+?972|0)?5\d{8}$/.test(raw.replace(/[\s\-()]/g, ''));

function parseMatrix(matrix: unknown[][]): Row[] {
  if (!matrix.length) return [];
  const headers = matrix[0].map((h) => String(h ?? ''));
  let phoneCol = findCol(headers, PHONE_KEYS);
  const hasHeader = phoneCol >= 0 || findCol(headers, NAME_KEYS) >= 0;
  const body = hasHeader ? matrix.slice(1) : matrix;
  if (phoneCol < 0) {
    // No header: the phone column is the one whose cells look like mobiles
    const width = Math.max(...body.slice(0, 50).map((r) => r.length), 0);
    let best = -1;
    let bestHits = 0;
    for (let c = 0; c < width; c++) {
      const hits = body.slice(0, 50).filter((r) => looksLikeMobile(String(r[c] ?? ''))).length;
      if (hits > bestHits) {
        best = c;
        bestHits = hits;
      }
    }
    phoneCol = best;
  }
  const nameCol = hasHeader ? findCol(headers, NAME_KEYS) : -1;
  const groupCol = hasHeader ? findCol(headers, GROUP_KEYS) : -1;
  if (phoneCol < 0) return [];
  return body
    .map((r) => ({
      phone: String(r[phoneCol] ?? '').trim(),
      name: nameCol >= 0 ? String(r[nameCol] ?? '').trim() : '',
      group: groupCol >= 0 ? String(r[groupCol] ?? '').trim() : '',
    }))
    .filter((r) => r.phone || r.name);
}

export default function AllowlistPanel({
  codeId, groups, onAddGroups,
}: {
  codeId: string;
  groups: SocialWallGroup[];
  /** Adds departments found in the sheet to the event (parent saves the config). */
  onAddGroups: (labels: string[]) => void;
}) {
  const [current, setCurrent] = useState<number | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [replace, setReplace] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadCount = useCallback(async () => {
    const res = await fetchWithAuth(`/api/socialwall/allowlist?codeId=${encodeURIComponent(codeId)}`).catch(() => null);
    if (res?.ok) setCurrent(((await res.json()).entries || []).length);
  }, [codeId]);
  useEffect(() => {
    void loadCount();
  }, [loadCount]);

  const groupByLabel = useMemo(() => new Map(groups.map((g) => [norm(g.label), g.id])), [groups]);
  const stats = useMemo(() => {
    if (!rows) return null;
    const valid = rows.filter((r) => looksLikeMobile(r.phone)).length;
    const unknownGroups = [...new Set(rows.map((r) => r.group).filter((g) => g && !groupByLabel.has(norm(g))))];
    return { valid, invalid: rows.length - valid, unknownGroups };
  }, [rows, groupByLabel]);

  const onFile = async (file: File) => {
    setMessage(null);
    try {
      const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
      const wb = isCsv ? XLSX.read(await file.text(), { type: 'string' }) : XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' });
      const parsed = parseMatrix(matrix);
      if (!parsed.length) setMessage({ ok: false, text: 'לא מצאנו עמודת טלפון בקובץ' });
      setRows(parsed);
    } catch {
      setMessage({ ok: false, text: 'לא הצלחנו לקרוא את הקובץ' });
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['שם', 'טלפון', 'מחלקה'],
      ['ישראל ישראלי', '050-1234567', groups[0]?.label || 'שיווק'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'עובדים');
    XLSX.writeFile(wb, 'רשימת-עובדים.xlsx');
  };

  const save = async () => {
    if (!rows) return;
    setSaving(true);
    setMessage(null);
    try {
      const payload = rows.map((r) => ({ phone: r.phone, name: r.name, groupId: groupByLabel.get(norm(r.group)) }));
      const res = await fetchWithAuth('/api/socialwall/allowlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId, rows: payload, replace }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error();
      setMessage({ ok: true, text: `נשמרו ${data.saved} עובדים${data.rejected ? ` · ${data.rejected} שורות עם טלפון לא תקין דולגו` : ''}` });
      setRows(null);
      void loadCount();
    } catch {
      setMessage({ ok: false, text: 'השמירה נכשלה, נסו שוב' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-bg-secondary">
        <div className="flex items-center gap-2 text-text-primary">
          <Users className="w-5 h-5 text-accent" />
          <span className="font-semibold">{current === null ? 'טוען…' : `${current} עובדים ברשימה`}</span>
        </div>
        <button onClick={downloadTemplate} className="text-sm text-accent font-medium flex items-center gap-1.5">
          <Download className="w-4 h-4" />
          קובץ לדוגמה
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void onFile(f);
        }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full rounded-xl border-2 border-dashed border-border hover:border-accent/60 p-6 flex flex-col items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
      >
        <FileSpreadsheet className="w-8 h-8" />
        <span className="font-semibold">העלאת קובץ אקסל או CSV</span>
        <span className="text-xs">עמודות: שם, טלפון, מחלקה. רק הטלפון חובה.</span>
      </button>

      {rows && stats && (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="text-emerald-600 font-semibold">{stats.valid} טלפונים תקינים</span>
            {stats.invalid > 0 && <span className="text-danger font-semibold">{stats.invalid} לא תקינים (ידולגו)</span>}
          </div>
          {stats.unknownGroups.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-text-primary">מחלקות שלא מוגדרות באירוע: {stats.unknownGroups.join(', ')}</div>
                <button onClick={() => onAddGroups(stats.unknownGroups)} className="mt-1.5 text-accent font-semibold flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  הוספתן לרשימת המחלקות
                </button>
              </div>
            </div>
          )}
          <div className="max-h-56 overflow-y-auto rounded-lg border border-border text-sm">
            <table className="w-full">
              <thead className="bg-bg-secondary sticky top-0">
                <tr className="text-text-secondary text-xs">
                  <th className="text-start px-3 py-2">שם</th>
                  <th className="text-start px-3 py-2">טלפון</th>
                  <th className="text-start px-3 py-2">מחלקה</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-1.5 text-text-primary">{r.name}</td>
                    <td className={`px-3 py-1.5 ${looksLikeMobile(r.phone) ? 'text-text-primary' : 'text-danger'}`} dir="ltr">{r.phone}</td>
                    <td className="px-3 py-1.5 text-text-secondary">{r.group}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 200 && <p className="text-xs text-text-secondary">מוצגות 200 שורות מתוך {rows.length}</p>}
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            להחליף את הרשימה הקיימת (אחרת יתווספו לה)
          </label>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving || !stats.valid} className="btn btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              שמירת {stats.valid} עובדים
            </button>
            <button onClick={() => setRows(null)} className="px-4 rounded-lg bg-bg-secondary text-text-primary text-sm">ביטול</button>
          </div>
        </div>
      )}

      {message && <p className={`text-sm ${message.ok ? 'text-emerald-600' : 'text-danger'}`}>{message.text}</p>}
    </div>
  );
}
