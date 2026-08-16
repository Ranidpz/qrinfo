'use client';

import { useRef, useState } from 'react';
import {
  Upload,
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
}

type Source = 'file' | 'paste';

// Import area for the raffle participant list. Nothing is ever written straight
// from a file: every path lands in the same preview (counts + the column mapping
// the parser chose + the first rows) so a mis-read column is caught on screen
// instead of after 3,000 bad rows are already saved.
export default function RaffleImportPanel({
  listType,
  participantCount,
  onImport,
  onDownloadTemplate,
  onLoadDemo,
}: Props) {
  const isCodes = listType === 'codes';
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [source, setSource] = useState<Source>('file');
  const [dragging, setDragging] = useState(false);
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
    setParsing(true);
    setFileName(file.name);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' });
      const result = parseMatrix(rows, listType);
      if (result.report.loaded === 0) {
        setError('לא נמצאו שורות תקינות בקובץ.');
      } else {
        setPreview({ rows: result.participants, report: result.report });
      }
    } catch {
      setError('לא הצלחנו לקרוא את הקובץ. ודאו שזהו קובץ Excel או CSV תקין.');
    } finally {
      setParsing(false);
    }
  };

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
      setFileName(null);
    } finally {
      setCommitting(null);
    }
  };

  const srcBtn = (key: Source, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => {
        setSource(key);
        reset();
      }}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
        source === key ? 'bg-amber-400 text-black' : 'bg-white/5 text-white/70 hover:bg-white/10'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {srcBtn('file', 'קובץ אקסל', <FileSpreadsheet size={15} />)}
        {srcBtn('paste', 'הדבקת רשימה', <ClipboardPaste size={15} />)}
      </div>

      {source === 'file' ? (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            onClick={() => fileRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
              dragging ? 'border-emerald-400 bg-emerald-400/10' : 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10'
            }`}
          >
            {parsing ? (
              <Loader2 size={22} className="animate-spin text-emerald-400" />
            ) : (
              <Upload size={22} className="text-emerald-400" />
            )}
            <span className="text-sm text-white/80">
              {parsing ? 'קורא את הקובץ…' : 'גררו לכאן או לחצו לבחירת קובץ Excel'}
            </span>
            <span className="text-xs text-white/40">
              {isCodes ? 'עמודה אחת של קודים (אפשר גם עמודת כמות)' : 'עמודות: שם, טלפון, כמות'}
            </span>
            {fileName && !parsing && <span className="text-xs text-emerald-300/80">{fileName}</span>}
          </div>
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
        </>
      ) : (
        <div className="space-y-2">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            dir={isCodes ? 'ltr' : 'rtl'}
            rows={6}
            placeholder={isCodes ? 'ABC123456\nDEF789012\nGHI345678' : 'ישראל ישראלי\t0501234567'}
            className="w-full rounded-lg bg-white/5 px-3 py-2 font-mono text-sm text-white outline-none placeholder:text-white/25"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handlePaste}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
            >
              <Check size={15} /> בדקו את הרשימה
            </button>
            {pasteText && (
              <button
                onClick={() => {
                  setPasteText('');
                  reset();
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-white/60 hover:bg-white/10"
                aria-label="נקו"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <p className="text-xs leading-relaxed text-white/40">
            העתיקו עמודה מאקסל והדביקו כאן. אפשר גם להדביק כמה עמודות יחד — נזהה לבד את
            {isCodes ? ' עמודת הקודים.' : ' העמודות.'}
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs leading-relaxed text-red-300">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {done && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs font-medium text-emerald-300">
          <Check size={14} className="shrink-0" />
          {done}
        </div>
      )}

      {preview && (
        <div className="space-y-2.5 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-3">
          <div className="text-sm font-semibold text-amber-300">תצוגה מקדימה — עדיין לא נשמר</div>

          <div className="grid grid-cols-3 gap-1.5 text-center">
            <Stat label={isCodes ? 'קודים' : 'שורות'} value={preview.report.loaded} tone="good" />
            <Stat label={isCodes ? 'כפולים' : 'כפולים (טלפון)'} value={preview.report.duplicates} tone="warn" />
            <Stat label="דולגו" value={preview.report.skipped} tone="warn" />
          </div>

          <div className="rounded-lg bg-black/30 px-2.5 py-2 text-xs text-white/60">
            <div>
              <span className="text-white/40">זיהינו: </span>
              {preview.report.mapping}
            </div>
            <div className="text-white/40">
              {preview.report.headerDetected ? 'שורת הכותרת זוהתה ולא נספרה.' : 'לא נמצאה שורת כותרת — כל השורות נטענו כנתונים.'}
            </div>
            {!isCodes && preview.report.noPhone > 0 && (
              <div className="text-amber-300/80">
                {preview.report.noPhone.toLocaleString('he-IL')} שורות ללא טלפון — לא נבדקה להן כפילות.
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-lg bg-black/30">
            <div className="flex items-center gap-2 border-b border-white/10 px-2.5 py-1.5 text-[11px] text-white/40">
              <span className="flex-1">{isCodes ? 'קוד' : 'שם'}</span>
              {!isCodes && <span className="w-28">טלפון</span>}
              <span className="w-12 text-center">כמות</span>
            </div>
            {preview.rows.slice(0, 6).map((p, i) => (
              <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-white/80">
                <span className="min-w-0 flex-1 truncate" dir={isCodes ? 'ltr' : 'rtl'} style={isCodes ? { fontFamily: 'var(--font-mono, monospace)' } : undefined}>
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
            {preview.rows.length > 6 && (
              <div className="px-2.5 py-1.5 text-[11px] text-white/35">
                ועוד {(preview.rows.length - 6).toLocaleString('he-IL')} שורות…
              </div>
            )}
          </div>

          {preview.report.dupSamples.length > 0 && (
            <p className="text-[11px] leading-relaxed text-amber-300/70">
              כפולים שאוחדו: {preview.report.dupSamples.join(' · ')}
              {preview.report.duplicates > preview.report.dupSamples.length ? ' ועוד…' : ''}
            </p>
          )}

          <div className="flex flex-col gap-1.5 pt-0.5">
            <button
              onClick={() => commit('replace')}
              disabled={committing !== null}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-amber-300 disabled:opacity-50"
            >
              {committing === 'replace' ? <Loader2 size={15} className="animate-spin" /> : <Replace size={15} />}
              החליפו את כל הרשימה
              {participantCount > 0 && ` (${participantCount.toLocaleString('he-IL')} יימחקו)`}
            </button>
            <div className="flex gap-1.5">
              <button
                onClick={() => commit('merge')}
                disabled={committing !== null}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15 disabled:opacity-50"
              >
                {committing === 'merge' ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                הוסיפו לרשימה
              </button>
              <button
                onClick={reset}
                disabled={committing !== null}
                className="rounded-lg bg-white/5 px-4 py-2 text-sm text-white/60 hover:bg-white/10 disabled:opacity-50"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-1.5">
        <button
          onClick={onDownloadTemplate}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/60 hover:bg-white/10"
        >
          <Download size={13} /> הורידו תבנית
        </button>
        {onLoadDemo && (
          <button
            onClick={onLoadDemo}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/60 hover:bg-white/10"
          >
            טענו דמו
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'good' | 'warn' }) {
  const strong = value > 0;
  return (
    <div className="rounded-lg bg-black/30 px-2 py-1.5">
      <div
        className={`text-lg font-bold ${
          tone === 'good' ? 'text-emerald-400' : strong ? 'text-amber-400' : 'text-white/30'
        }`}
      >
        {value.toLocaleString('he-IL')}
      </div>
      <div className="text-[11px] text-white/45">{label}</div>
    </div>
  );
}
