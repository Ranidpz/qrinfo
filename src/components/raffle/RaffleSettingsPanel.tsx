'use client';

import { useRef, useState } from 'react';
import {
  X,
  Upload,
  Palette,
  Type,
  Eye,
  Repeat,
  Volume2,
  Download,
  Trash2,
  RotateCcw,
  Trophy,
  Play,
  MessageCircle,
  Image as ImageIcon,
  Film,
  Loader2,
  Link as LinkIcon,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import type {
  RaffleConfig,
  RaffleParticipant,
  RaffleWinner,
  RaffleWinSound,
} from '@/lib/raffle/types';
import {
  fullName,
  resolveWinSoundUrl,
  RAFFLE_WIN_SOUND_PRESETS,
} from '@/lib/raffle/types';
import AnimatedNumber from './AnimatedNumber';

interface RaffleSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  config: RaffleConfig;
  onConfigChange: (patch: Partial<RaffleConfig>) => void;
  participantCount: number;
  isDemoData: boolean;
  winners: RaffleWinner[];
  onLoadDemo?: () => void;
  onImport: (participants: RaffleParticipant[]) => void;
  onResetWinners: () => void;
  onResetAll: () => void;
  // Production: upload an asset to the owner's R2 folder and return its URL.
  // Demo: omitted → falls back to a local object URL.
  uploadAsset?: (file: File, kind: 'image' | 'video') => Promise<string>;
  // Editor mode: hide the demo loader, show the shareable big-screen link.
  hideDemo?: boolean;
  bigScreenUrl?: string;
  // 'drawer' (default) = right-side panel for the live big-screen; 'modal' =
  // centered dialog for the editor (consistent with the other experiences).
  variant?: 'drawer' | 'modal';
  // Editor: a participant management table (edit/delete/add) under the import.
  participantsManager?: React.ReactNode;
}

function normalizePhone(raw: string | number): string {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('972')) digits = '0' + digits.slice(3);
  if (digits.length === 9) digits = '0' + digits; // lost leading zero in Excel
  return digits;
}

// Build a wa.me link with a correctly formatted international number (no +).
// Israeli 05XXXXXXXX → 9725XXXXXXX.
function whatsappLink(phone: string): string {
  let d = String(phone ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '972' + d.slice(1);
  else if (d.length === 9) d = '972' + d; // lost leading zero
  return `https://wa.me/${d}`; // no prefilled text — just open a chat
}

export default function RaffleSettingsPanel({
  open,
  onClose,
  config,
  onConfigChange,
  participantCount,
  isDemoData,
  winners,
  onLoadDemo,
  onImport,
  onResetWinners,
  onResetAll,
  uploadAsset,
  hideDemo,
  bigScreenUrl,
  variant = 'drawer',
  participantsManager,
}: RaffleSettingsPanelProps) {
  const [copied, setCopied] = useState(false);
  const isModal = variant === 'modal';
  const fileRef = useRef<HTMLInputElement | null>(null);
  const soundFileRef = useRef<HTMLInputElement | null>(null);
  const imageRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);

  const [importReport, setImportReport] = useState<{
    loaded: number;
    duplicates: number;
    noPhone: number;
    dupNames: string[];
  } | null>(null);
  const [dragExcel, setDragExcel] = useState(false);
  const [dragBg, setDragBg] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);

  const playPreview = (url: string) => {
    if (typeof Audio === 'undefined') return;
    if (!previewRef.current) previewRef.current = new Audio();
    const a = previewRef.current;
    a.src = url;
    a.currentTime = 0;
    a.play().catch(() => {});
  };

  const handleSoundFile = (file: File) => {
    const url = URL.createObjectURL(file);
    onConfigChange({ winSound: 'custom', customWinSoundUrl: url });
    playPreview(url);
  };

  // Upload (or locally stage) a background asset, then apply it.
  const handleBgFile = async (file: File) => {
    const kind: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image';
    setBgUploading(true);
    try {
      const url = uploadAsset
        ? await uploadAsset(file, kind)
        : URL.createObjectURL(file);
      if (kind === 'video') {
        onConfigChange({ backgroundType: 'video', backgroundVideoUrl: url });
      } else {
        onConfigChange({ backgroundType: 'image', backgroundImageUrl: url });
      }
    } catch {
      // swallow — demo keeps working with whatever is set
    } finally {
      setBgUploading(false);
    }
  };

  const handleFile = async (file: File) => {
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, {
      header: 1,
      defval: '',
    });
    if (rows.length === 0) return;

    // Locate header columns (Hebrew or English), else fall back to positions.
    const header = rows[0].map((c) => String(c).trim().toLowerCase());
    const find = (...keys: string[]) =>
      header.findIndex((h) => keys.some((k) => h.includes(k)));
    let iFirst = find('first name', 'שם פרטי', 'שם');
    let iLast = find('last name', 'שם משפחה', 'משפחה');
    let iPhone = find('phone', 'טלפון', 'נייד');
    let iQty = find('quantity', 'כמות');
    const hasHeader = iFirst >= 0 || iPhone >= 0;
    if (!hasHeader) {
      iFirst = 0;
      iLast = 1;
      iPhone = 2;
      iQty = 3;
    }

    const seen = new Map<string, RaffleParticipant>();
    const start = hasHeader ? 1 : 0;
    let duplicates = 0;
    let noPhone = 0;
    const dupNames: string[] = [];
    for (let r = start; r < rows.length; r++) {
      const row = rows[r];
      const firstName = String(row[iFirst] ?? '').trim();
      const lastName = iLast >= 0 ? String(row[iLast] ?? '').trim() : '';
      const phone = normalizePhone(row[iPhone] as string | number);
      if (!firstName && !lastName && !phone) continue; // skip empty rows
      const qty = iQty >= 0 ? parseInt(String(row[iQty]), 10) : 1;
      const quantity = Number.isFinite(qty) && qty > 0 ? qty : 1;
      if (!phone) noPhone++;
      const id = phone || `row-${r}`;
      // Dedupe by phone (the unique key). Same phone again = duplicate → merged
      // (first kept). Same name + different phone = kept (different people).
      if (phone && seen.has(id)) {
        duplicates++;
        const nm = `${firstName} ${lastName}`.trim();
        if (dupNames.length < 12 && nm) dupNames.push(nm);
        continue;
      }
      seen.set(id, { id, firstName, lastName, phone, quantity, remaining: quantity });
    }
    setImportReport({ loaded: seen.size, duplicates, noPhone, dupNames });
    onImport(Array.from(seen.values()));
  };

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([
      ['שם פרטי', 'שם משפחה', 'טלפון', 'כמות'],
      ['ישראל', 'ישראלי', '0501234567', 1],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'משתתפים');
    XLSX.writeFile(wb, 'תבנית-הגרלה.xlsx');
  };

  const exportWinners = () => {
    const head = ['מקום', 'שם פרטי', 'שם משפחה', 'טלפון', 'שעה'];
    const lines = winners.map((w) =>
      [
        w.rank,
        w.firstName,
        w.lastName,
        w.phone,
        new Date(w.wonAt).toLocaleTimeString('he-IL'),
      ].join(',')
    );
    const csv = '﻿' + [head.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'זוכים.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Modal layout: a wide, tabbed dialog. Drawer layout: a single scroll.
  const [tab, setTab] = useState<'participants' | 'design' | 'settings' | 'winners'>('participants');
  const grpCls = (
    t: 'participants' | 'design' | 'settings' | 'winners',
    layout: 'col' | 'grid'
  ) =>
    [
      !isModal || tab === t ? '' : 'hidden',
      isModal
        ? layout === 'grid'
          ? 'grid items-start gap-x-6 gap-y-6 md:grid-cols-2'
          : 'mx-auto max-w-xl space-y-6'
        : 'space-y-7',
      isModal ? '' : 'mb-7',
    ].join(' ');

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        dir="rtl"
        className={`fixed z-50 flex flex-col bg-[#0d0d12] text-white shadow-2xl ${
          isModal
            ? 'left-1/2 top-1/2 max-h-[90vh] w-[94vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10'
            : `inset-y-0 right-0 w-[380px] max-w-[88vw] transition-transform duration-300 ${
                open ? 'translate-x-0' : 'translate-x-full'
              }`
        }`}
        style={{ fontFamily: 'var(--font-assistant), sans-serif' }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <h2 className="shrink-0 text-lg font-bold">הגדרות הגרלה</h2>
          <div className="flex items-center gap-2">
            {bigScreenUrl && (
              <a
                href={bigScreenUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="צפייה והפעלת ההגרלה על המסך הגדול"
                className="flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-bold text-black transition hover:bg-amber-300"
              >
                <ExternalLink size={15} /> פתח מסך ענק
              </a>
            )}
            <button onClick={onClose} className="text-white/60 hover:text-white">
              <X size={22} />
            </button>
          </div>
        </div>

        {isModal && (
          <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 px-4 pt-2">
            {(
              [
                { k: 'participants', label: 'משתתפים' },
                { k: 'design', label: 'עיצוב' },
                { k: 'settings', label: 'הגדרות' },
                { k: 'winners', label: 'זוכים' },
              ] as const
            ).map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={`whitespace-nowrap rounded-t-lg px-4 py-2 text-sm font-medium transition ${
                  tab === t.k
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className={`flex-1 overflow-y-auto ${isModal ? 'px-6 py-6' : 'px-5 py-5 space-y-7'}`}>
          <div className={grpCls('participants', 'col')}>
          <Section icon={<Upload size={15} />} title="טעינת משתתפים">
            <button
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragExcel(true);
              }}
              onDragLeave={() => setDragExcel(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragExcel(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              className={`flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-5 text-center transition ${
                dragExcel
                  ? 'border-emerald-400 bg-emerald-500/20'
                  : 'border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10'
              }`}
            >
              <Upload size={20} className="text-emerald-400" />
              <span className="text-sm font-medium">
                {dragExcel ? 'שחררו כאן' : 'גררו לכאן או לחצו לבחירת קובץ Excel'}
              </span>
              <span className="text-xs text-white/40">עמודות: שם, טלפון, כמות</span>
            </button>
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
            {participantCount > 0 && (
              <div className="rounded-lg bg-emerald-600/90 px-3 py-2 text-center text-sm font-medium">
                נטענו <AnimatedNumber value={participantCount} /> משתתפים
                {isDemoData ? ' (דמו)' : ''}
              </div>
            )}
            {importReport && (
              <div className="space-y-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-white/60">נטענו (ייחודיים)</span>
                  <span className="font-semibold text-emerald-400">
                    {importReport.loaded.toLocaleString('he-IL')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60">כפולים אוחדו (טלפון זהה)</span>
                  <span className={`font-semibold ${importReport.duplicates ? 'text-amber-400' : 'text-white/40'}`}>
                    {importReport.duplicates.toLocaleString('he-IL')}
                  </span>
                </div>
                {importReport.noPhone > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">ללא טלפון (לא נבדקה כפילות)</span>
                    <span className="font-semibold text-amber-400">
                      {importReport.noPhone.toLocaleString('he-IL')}
                    </span>
                  </div>
                )}
                {importReport.dupNames.length > 0 && (
                  <div className="border-t border-white/10 pt-1.5 text-white/45" dir="rtl">
                    כפולים שאוחדו: {importReport.dupNames.join(' · ')}
                    {importReport.duplicates > importReport.dupNames.length ? ' ועוד…' : ''}
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={downloadTemplate}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs hover:bg-white/10"
              >
                <Download size={14} /> הורד תבנית
              </button>
              {!hideDemo && onLoadDemo && (
                <button
                  onClick={onLoadDemo}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs hover:bg-white/10"
                >
                  טען דמו (1000)
                </button>
              )}
            </div>
          </Section>

          {participantsManager && (
            <Section icon={<Upload size={15} />} title="ניהול משתתפים">
              {participantsManager}
            </Section>
          )}

          {bigScreenUrl && (
            <Section icon={<LinkIcon size={15} />} title="קישור מסך ענק">
              <p className="text-xs leading-relaxed text-white/40">
                פתחו את הקישור על המסך הגדול. שמות בלבד — בלי טלפונים.
              </p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={bigScreenUrl}
                  dir="ltr"
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/70"
                />
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(bigScreenUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    } catch {
                      /* ignore */
                    }
                  }}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-amber-400 px-3 text-xs font-medium text-black"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'הועתק' : 'העתק'}
                </button>
              </div>
              <a
                href={bigScreenUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-amber-300"
              >
                <ExternalLink size={16} /> פתח מסך ענק
              </a>
            </Section>
          )}
          </div>

          <div className={grpCls('design', 'grid')}>
          <Section icon={<Palette size={15} />} title="רקע">
            <div className="grid grid-cols-3 gap-1.5">
              {(['color', 'video', 'image'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => onConfigChange({ backgroundType: t })}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    config.backgroundType === t
                      ? 'bg-amber-400 text-black'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {t === 'color' ? 'צבע' : t === 'video' ? 'וידאו' : 'תמונה'}
                </button>
              ))}
            </div>

            {config.backgroundType === 'color' && (
              <ColorRow
                label="צבע רקע"
                value={config.backgroundColor}
                onChange={(v) => onConfigChange({ backgroundColor: v })}
              />
            )}

            {config.backgroundType === 'image' && (
              <>
                <BgDropzone
                  icon={<ImageIcon size={20} className="text-amber-400" />}
                  label="גררו תמונה או לחצו לבחירה"
                  hint="JPG · PNG · WEBP"
                  dragging={dragBg}
                  uploading={bgUploading}
                  hasValue={!!config.backgroundImageUrl}
                  onPick={() => imageRef.current?.click()}
                  onDragStateChange={setDragBg}
                  onFile={handleBgFile}
                />
                <input
                  ref={imageRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleBgFile(f);
                    e.target.value = '';
                  }}
                />
              </>
            )}

            {config.backgroundType === 'video' && (
              <>
                <BgDropzone
                  icon={<Film size={20} className="text-amber-400" />}
                  label="גררו וידאו או לחצו לבחירה"
                  hint="MP4 · WEBM"
                  dragging={dragBg}
                  uploading={bgUploading}
                  hasValue={!!config.backgroundVideoUrl}
                  onPick={() => videoRef.current?.click()}
                  onDragStateChange={setDragBg}
                  onFile={handleBgFile}
                />
                <input
                  ref={videoRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleBgFile(f);
                    e.target.value = '';
                  }}
                />
              </>
            )}
          </Section>

          <Section icon={<Type size={15} />} title="צבע פונט">
            <ColorRow
              label="צבע טקסט"
              value={config.fontColor}
              onChange={(v) => onConfigChange({ fontColor: v })}
            />
            <ColorRow
              label="צבע זוכה"
              value={config.winnerColor}
              onChange={(v) => onConfigChange({ winnerColor: v })}
            />
          </Section>

          <Section icon={<Type size={15} />} title="כותרת פתיחה">
            <input
              value={config.idleTitle ?? 'הגרלה'}
              onChange={(e) => onConfigChange({ idleTitle: e.target.value })}
              placeholder="הגרלה"
              className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
            />
            <ColorRow
              label="צבע הכותרת (הברקה)"
              value={config.idleColor || '#C9CED6'}
              onChange={(v) => onConfigChange({ idleColor: v })}
            />
            <p className="text-xs leading-relaxed text-white/40">
              הטקסט שמוצג על המסך הגדול לפני שמתחילים, עם הברקה מונפשת מסביב.
            </p>
          </Section>

          <Section icon={<Eye size={15} />} title="מצב תצוגה">
            <div className="grid grid-cols-2 gap-1.5">
              {(['names', 'phones'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => onConfigChange({ displayMode: m })}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    config.displayMode === m
                      ? 'bg-amber-400 text-black'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {m === 'names' ? 'שמות' : 'טלפונים'}
                </button>
              ))}
            </div>
          </Section>
          </div>

          <div className={grpCls('settings', 'grid')}>
          <Section icon={<Repeat size={15} />} title="בחירה חוזרת">
            <CheckRow
              label="אפשר בחירה חוזרת"
              checked={config.allowRepeat}
              onChange={(v) => onConfigChange({ allowRepeat: v })}
            />
            <p className="text-xs leading-relaxed text-white/40">
              כשמבוטל - זוכה מוסר מהמאגר. עמודת &quot;כמות&quot; קובעת כמה פעמים ניתן לזכות.
            </p>
          </Section>

          <Section icon={<Volume2 size={15} />} title="צלילים">
            <CheckRow
              label="הפעל צלילים"
              checked={config.soundsEnabled}
              onChange={(v) => onConfigChange({ soundsEnabled: v })}
            />

            <div className="space-y-2 pt-1">
              <div className="text-xs text-white/40">צליל זכייה</div>
              {(
                [
                  { key: 'win', label: 'זכייה' },
                  { key: 'buzzer', label: 'באזר' },
                ] as { key: RaffleWinSound; label: string }[]
              ).map((opt) => (
                <div key={opt.key} className="flex items-center gap-2">
                  <button
                    onClick={() => onConfigChange({ winSound: opt.key })}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      config.winSound === opt.key
                        ? 'bg-amber-400 text-black'
                        : 'bg-white/5 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                  <button
                    onClick={() =>
                      playPreview(
                        RAFFLE_WIN_SOUND_PRESETS[opt.key as 'buzzer' | 'win']
                      )
                    }
                    aria-label={`השמע ${opt.label}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-white/70 hover:bg-white/10"
                  >
                    <Play size={14} />
                  </button>
                </div>
              ))}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => soundFileRef.current?.click()}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    config.winSound === 'custom'
                      ? 'bg-amber-400 text-black'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <Upload size={14} /> העלה צליל
                </button>
                {config.winSound === 'custom' && config.customWinSoundUrl && (
                  <button
                    onClick={() => playPreview(resolveWinSoundUrl(config))}
                    aria-label="השמע צליל שהועלה"
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-white/70 hover:bg-white/10"
                  >
                    <Play size={14} />
                  </button>
                )}
              </div>
              <input
                ref={soundFileRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleSoundFile(f);
                  e.target.value = '';
                }}
              />
            </div>
          </Section>
          </div>

          <div className={grpCls('winners', 'col')}>
          <div className="space-y-2 border-t border-white/10 pt-5">
            <ActionButton icon={<Download size={15} />} onClick={exportWinners} disabled={winners.length === 0}>
              ייצוא זוכים ל-CSV
            </ActionButton>
            <ActionButton icon={<Trash2 size={15} />} onClick={onResetWinners} disabled={winners.length === 0}>
              אפס רשימת זוכים
            </ActionButton>
            <ActionButton icon={<RotateCcw size={15} />} onClick={onResetAll}>
              אפס הכל
            </ActionButton>
          </div>

          {winners.length > 0 && (
            <Section icon={<Trophy size={15} />} title={`רשימת זוכים (${winners.length})`}>
              <div className="space-y-2">
                {[...winners]
                  .sort((a, b) => b.rank - a.rank)
                  .map((w) => (
                    <div
                      key={`${w.id}-${w.rank}`}
                      className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-sm font-bold text-black">
                        {w.rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{fullName(w)}</div>
                        <div className="truncate text-xs text-white/40" dir="ltr">{w.phone}</div>
                      </div>
                      {w.phone && (
                        <a
                          href={whatsappLink(w.phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`שלח וואטסאפ ל${fullName(w)}`}
                          title="שלח הודעת וואטסאפ"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/90 text-white transition hover:bg-emerald-500"
                        >
                          <MessageCircle size={15} />
                        </a>
                      )}
                      <span className="shrink-0 text-xs text-white/40">
                        {new Date(w.wonAt).toLocaleTimeString('he-IL', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
              </div>
            </Section>
          )}
          </div>
        </div>
      </aside>
    </>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-white/60">
        <span className="text-amber-400">{icon}</span>
        {title}
      </div>
      {children}
    </section>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2.5">
      <span className="text-sm">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-12 cursor-pointer rounded border-0 bg-transparent p-0"
      />
    </label>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`flex h-6 w-6 items-center justify-center rounded-md border transition ${
          checked ? 'border-amber-400 bg-amber-400 text-black' : 'border-white/25 bg-transparent'
        }`}
      >
        {checked && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </button>
    </label>
  );
}

function BgDropzone({
  icon,
  label,
  hint,
  dragging,
  uploading,
  hasValue,
  onPick,
  onDragStateChange,
  onFile,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  dragging: boolean;
  uploading: boolean;
  hasValue: boolean;
  onPick: () => void;
  onDragStateChange: (v: boolean) => void;
  onFile: (file: File) => void;
}) {
  return (
    <button
      onClick={onPick}
      onDragOver={(e) => {
        e.preventDefault();
        onDragStateChange(true);
      }}
      onDragLeave={() => onDragStateChange(false)}
      onDrop={(e) => {
        e.preventDefault();
        onDragStateChange(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={`flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-5 text-center transition ${
        dragging
          ? 'border-amber-400 bg-amber-400/15'
          : 'border-white/20 bg-white/5 hover:bg-white/10'
      }`}
    >
      {uploading ? <Loader2 size={20} className="animate-spin text-amber-400" /> : icon}
      <span className="text-sm font-medium">
        {uploading ? 'מעלה…' : dragging ? 'שחררו כאן' : label}
      </span>
      <span className="text-xs text-white/40">
        {hasValue && !uploading ? 'נטען ✓ · ניתן להחליף' : hint}
      </span>
    </button>
  );
}

function ActionButton({
  icon,
  onClick,
  disabled,
  children,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/5 px-4 py-2.5 text-sm font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {icon}
      {children}
    </button>
  );
}
