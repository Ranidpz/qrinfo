'use client';

import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import {
  Download,
  ClipboardPaste,
  FileSpreadsheet,
  AlertTriangle,
  Check,
  X,
  Loader2,
  Replace,
  Plus,
} from 'lucide-react';
import type { RaffleListType, RaffleParticipant } from '@/lib/raffle/types';
import { parseMatrix, parseText, type ImportReport } from '@/lib/raffle/import';

interface Props {
  listType: RaffleListType;
  participantCount: number;
  // Commit the parsed rows. 'replace' wipes the current list first.
  onImport: (participants: RaffleParticipant[], mode: 'replace' | 'merge') => void | Promise<void>;
  onDownloadTemplate: () => void;
  onLoadDemo?: () => void;
  // The parent owns the modal element, so it hosts the drop target for the
  // whole dialog and hands the file down through this ref.
  fileHandlerRef?: MutableRefObject<((file: File) => void) | null>;
}

// Import area for the raffle participant list. Two compact entry points — pick
// a file or paste a list — and nothing is ever written straight from either:
// both land in the same preview (counts + the column mapping the parser chose +
// the first rows) so a mis-read column is caught on screen instead of after
// 3,000 bad rows are already saved.
export default function RaffleImportPanel({
  listType,
  participantCount,
  onImport,
  onDownloadTemplate,
  onLoadDemo,
  fileHandlerRef,
}: Props) {
  const isCodes = listType === 'codes';
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ rows: RaffleParticipant[]; report: ImportReport } | null>(null);
  const [committing, setCommitting] = useState<'replace' | 'merge' | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const reset = () => {
    setPreview(null);
    setError(null);
    setFileName(null);
    setDone(null);
  };

  const handleFile = async (file: File) => {
    reset();
    setPasteOpen(false);
    setParsing(true);
    setFileName(file.name);
    try {
      const XLSX = await import('xlsx');
      // A CSV read as bytes is decoded as binary, which turns Hebrew headers
      // into mojibake. Hand it over as a UTF-8 string instead; .xlsx stays
      // binary. (xlsx still does the CSV quoting/escaping.)
      const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
      const wb = isCsv
        ? XLSX.read(await file.text(), { type: 'string' })
        : XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' });
      const result = parseMatrix(rows, listType);
      if (result.report.loaded === 0) setError('לא נמצאו שורות תקינות בקובץ.');
      else setPreview({ rows: result.participants, report: result.report });
    } catch {
      setError('לא הצלחנו לקרוא את הקובץ. ודאו שזהו קובץ Excel או CSV תקין.');
    } finally {
      setParsing(false);
    }
  };

  // Expose the handler so a file dropped anywhere on the dialog lands here.
  useEffect(() => {
    if (!fileHandlerRef) return;
    fileHandlerRef.current = (f: File) => void handleFile(f);
    return () => {
      fileHandlerRef.current = null;
    };
  });

  const handlePaste = () => {
    reset();
    if (!pasteText.trim()) {
      setError('הדביקו רשימה בתיבה למעלה.');
      return;
    }
    const result = parseText(pasteText, listType);
    if (result.report.loaded === 0) {
      setError('לא נמצאו שורות תקינות בטקסט שהודבק.');
      return;
    }
    setPreview({ rows: result.participants, report: result.report });
  };

  const commit = async (mode: 'replace' | 'merge') => {
    if (!preview) return;
    setCommitting(mode);
    try {
      await Promise.resolve(onImport(preview.rows, mode));
      setDone(
        mode === 'replace'
          ? `הרשימה הוחלפה — ${preview.report.loaded.toLocaleString('he-IL')} שורות`
          : `נוספו ${preview.report.loaded.toLocaleString('he-IL')} שורות לרשימה`
      );
      setPreview(null);
      setPasteText('');
      setPasteOpen(false);
      setFileName(null);
    } finally {
      setCommitting(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* two entry points, one row, 44px targets */}
      <div className="flex gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={parsing}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-white/10 px-4 text-sm font-medium text-white transition hover:bg-white/[0.16] active:scale-[0.99] disabled:opacity-50"
        >
          {parsing ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
          {parsing ? 'קורא…' : 'בחרו קובץ'}
        </button>
        <button
          onClick={() => {
            setPasteOpen((v) => !v);
            reset();
          }}
          className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition active:scale-[0.99] ${
            pasteOpen ? 'bg-amber-400 text-black hover:bg-amber-300' : 'bg-white/10 text-white hover:bg-white/[0.16]'
          }`}
        >
          <ClipboardPaste size={16} />
          הדביקו רשימה
        </button>
      </div>

      <p className="text-sm leading-relaxed text-white/45">
        לחצו לבחירת קובץ, או גררו אותו לכל מקום בחלון הזה.{' '}
        {isCodes ? 'עמודה אחת של קודים.' : 'עמודות: שם, טלפון, כמות.'}
        {fileName && !parsing && <span className="text-white/70"> · {fileName}</span>}
      </p>

      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />

      {pasteOpen && (
        <div className="space-y-2">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            dir={isCodes ? 'ltr' : 'rtl'}
            rows={5}
            autoFocus
            placeholder={isCodes ? 'ABC123456\nDEF789012\nGHI345678' : 'ישראל ישראלי\t0501234567'}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-mono text-sm text-white outline-none transition placeholder:text-white/25 focus:border-amber-400/60"
          />
          <div className="flex gap-2">
            <button
              onClick={handlePaste}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-white/10 px-4 text-sm font-medium text-white transition hover:bg-white/[0.16] active:scale-[0.99]"
            >
              <Check size={16} /> בדקו את הרשימה
            </button>
            <button
              onClick={() => {
                setPasteText('');
                setPasteOpen(false);
                reset();
              }}
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/5 text-white/60 transition hover:bg-white/10"
              aria-label="סגרו"
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-sm text-white/40">
            העתיקו עמודה מאקסל והדביקו כאן. אפשר גם כמה עמודות יחד — נזהה לבד את
            {isCodes ? ' עמודת הקודים.' : ' העמודות.'}
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm leading-relaxed text-red-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {done && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300">
          <Check size={16} className="shrink-0" />
          {done}
        </div>
      )}

      {preview && (
        <div className="space-y-4 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-4">
          <div className="text-sm font-semibold text-amber-300">תצוגה מקדימה — עדיין לא נשמר</div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label={isCodes ? 'קודים' : 'שורות'} value={preview.report.loaded} tone="good" />
            <Stat label="כפולים" value={preview.report.duplicates} tone="warn" />
            <Stat label="דולגו" value={preview.report.skipped} tone="warn" />
          </div>

          <div className="space-y-1 rounded-lg bg-black/30 px-4 py-2 text-sm text-white/60">
            <div>
              <span className="text-white/40">זיהינו: </span>
              {preview.report.mapping}
            </div>
            <div className="text-white/40">
              {preview.report.headerDetected
                ? 'שורת הכותרת זוהתה ולא נספרה.'
                : 'לא נמצאה שורת כותרת — כל השורות נטענו כנתונים.'}
            </div>
            {!isCodes && preview.report.noPhone > 0 && (
              <div className="text-amber-300/80">
                {preview.report.noPhone.toLocaleString('he-IL')} שורות ללא טלפון — לא נבדקה להן כפילות.
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-lg bg-black/30">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2 text-xs text-white/40">
              <span className="flex-1">{isCodes ? 'קוד' : 'שם'}</span>
              {!isCodes && <span className="w-28">טלפון</span>}
              <span className="w-12 text-center">כמות</span>
            </div>
            {preview.rows.slice(0, 5).map((p, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-2 text-sm text-white/80">
                <span className={`min-w-0 flex-1 truncate ${isCodes ? 'font-mono' : ''}`} dir={isCodes ? 'ltr' : 'rtl'}>
                  {`${p.firstName} ${p.lastName}`.trim() || '—'}
                </span>
                {!isCodes && (
                  <span className="w-28 truncate text-white/55" dir="ltr">
                    {p.phone || '—'}
                  </span>
                )}
                <span className="w-12 text-center text-white/55">{p.quantity}</span>
              </div>
            ))}
            {preview.rows.length > 5 && (
              <div className="px-4 py-2 text-xs text-white/35">
                ועוד {(preview.rows.length - 5).toLocaleString('he-IL')} שורות…
              </div>
            )}
          </div>

          {preview.report.dupSamples.length > 0 && (
            <p className="text-xs leading-relaxed text-amber-300/70">
              כפולים שאוחדו: {preview.report.dupSamples.join(' · ')}
              {preview.report.duplicates > preview.report.dupSamples.length ? ' ועוד…' : ''}
            </p>
          )}

          <div className="space-y-2">
            <button
              onClick={() => commit('replace')}
              disabled={committing !== null}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 text-sm font-bold text-black shadow-sm transition hover:bg-amber-300 active:scale-[0.99] disabled:opacity-50"
            >
              {committing === 'replace' ? <Loader2 size={16} className="animate-spin" /> : <Replace size={16} />}
              החליפו את כל הרשימה
              {participantCount > 0 && ` (${participantCount.toLocaleString('he-IL')} יימחקו)`}
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => commit('merge')}
                disabled={committing !== null}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-white/10 px-4 text-sm font-medium text-white transition hover:bg-white/[0.16] active:scale-[0.99] disabled:opacity-50"
              >
                {committing === 'merge' ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                הוסיפו לרשימה
              </button>
              <button
                onClick={reset}
                disabled={committing !== null}
                className="h-11 rounded-lg bg-white/5 px-4 text-sm text-white/60 transition hover:bg-white/10 disabled:opacity-50"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 text-sm">
        <button
          onClick={onDownloadTemplate}
          className="flex items-center gap-2 text-white/45 transition hover:text-white/80"
        >
          <Download size={16} /> הורידו תבנית
        </button>
        {onLoadDemo && (
          <button onClick={onLoadDemo} className="text-white/45 transition hover:text-white/80">
            טענו דמו
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'good' | 'warn' }) {
  return (
    <div className="rounded-lg bg-black/30 px-2 py-2">
      <div
        className={`text-xl font-bold ${
          tone === 'good' ? 'text-emerald-400' : value > 0 ? 'text-amber-400' : 'text-white/30'
        }`}
      >
        {value.toLocaleString('he-IL')}
      </div>
      <div className="text-xs text-white/45">{label}</div>
    </div>
  );
}
