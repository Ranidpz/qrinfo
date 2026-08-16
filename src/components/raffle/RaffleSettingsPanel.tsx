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
  AlertTriangle,
  Trophy,
  Play,
  MessageCircle,
  Image as ImageIcon,
  Film,
  Loader2,
  Sparkles,
  Users,
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
  CODE_LOCK_MS_MIN,
  CODE_LOCK_MS_MAX,
  CODE_LOCK_MS_DEFAULT,
} from '@/lib/raffle/types';
import AnimatedNumber from './AnimatedNumber';
import RaffleImportPanel from './RaffleImportPanel';

interface RaffleSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  config: RaffleConfig;
  onConfigChange: (patch: Partial<RaffleConfig>) => void;
  participantCount: number;
  isDemoData: boolean;
  winners: RaffleWinner[];
  onLoadDemo?: () => void;
  // 'replace' wipes the current list first; 'merge' adds to it.
  onImport: (participants: RaffleParticipant[], mode: 'replace' | 'merge') => void | Promise<void>;
  onResetWinners: () => void;
  // Permanent deletion of ALL participants + winners (editor only).
  onResetAll: () => void | Promise<void>;
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
  const listType = config.listType ?? 'people';
  const isCodes = listType === 'codes';
  const soundFileRef = useRef<HTMLInputElement | null>(null);
  const imageRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);

  const [dragBg, setDragBg] = useState(false);
  // Whole-dialog file drop: the import panel registers its handler here, and
  // the dialog itself is the drop target so there is no zone to aim at.
  const importFileRef = useRef<((file: File) => void) | null>(null);
  const [dragFile, setDragFile] = useState(false);
  const dragDepth = useRef(0); // dragenter/leave fire per child — count them
  const [bgUploading, setBgUploading] = useState(false);
  // Permanent-delete confirmation (type "מחיקה" to enable).
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await Promise.resolve(onResetAll());
      setConfirmDeleteOpen(false);
      setDeleteText('');
    } finally {
      setDeleting(false);
    }
  };

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

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const ws = isCodes
      ? XLSX.utils.aoa_to_sheet([
          ['קוד', 'כמות'],
          ['ABC123456', 1],
          ['DEF789012', 1],
        ])
      : XLSX.utils.aoa_to_sheet([
          ['שם פרטי', 'שם משפחה', 'טלפון', 'כמות'],
          ['ישראל', 'ישראלי', '0501234567', 1],
        ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isCodes ? 'קודים' : 'משתתפים');
    XLSX.writeFile(wb, isCodes ? 'תבנית-קודים.xlsx' : 'תבנית-הגרלה.xlsx');
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
        onDragEnter={(e) => {
          if (!e.dataTransfer?.types?.includes('Files')) return;
          dragDepth.current += 1;
          setDragFile(true);
        }}
        onDragOver={(e) => {
          if (e.dataTransfer?.types?.includes('Files')) e.preventDefault();
        }}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragFile(false);
        }}
        onDrop={(e) => {
          if (!e.dataTransfer?.types?.includes('Files')) return;
          e.preventDefault();
          dragDepth.current = 0;
          setDragFile(false);
          const f = e.dataTransfer.files?.[0];
          // Background image/video zones handle their own drops; anything else
          // dropped on the dialog is a participant list.
          if (f && importFileRef.current) {
            setTab('participants');
            importFileRef.current(f);
          }
        }}
      >
        {/* drop affordance — only while a file is actually over the dialog */}
        {dragFile && (
          <div className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center rounded-2xl border-2 border-dashed border-emerald-400 bg-black/70">
            <div className="flex flex-col items-center gap-2 text-emerald-300">
              <Upload size={32} />
              <span className="text-base font-semibold">שחררו כאן כדי לטעון את הרשימה</span>
            </div>
          </div>
        )}

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
          {/* Type + count on one line — the type governs everything below it,
              so it reads as a heading rather than as another setting. */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex rounded-lg bg-white/5 p-1">
              {(
                [
                  { key: 'people', label: 'אנשים' },
                  { key: 'codes', label: 'קודים' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => onConfigChange({ listType: opt.key })}
                  className={`h-9 rounded-md px-4 text-sm font-medium transition ${
                    listType === opt.key ? 'bg-amber-400 text-black' : 'text-white/60 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {participantCount > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-bold text-emerald-400">
                  <AnimatedNumber value={participantCount} />
                </span>
                <span className="text-white/45">
                  {isCodes ? 'קודים ברשימה' : 'משתתפים ברשימה'}
                  {isDemoData ? ' (דמו)' : ''}
                </span>
              </div>
            )}
          </div>
          <p className="text-sm leading-relaxed text-white/45">
            {isCodes
              ? 'הרשימה מכילה קודים בלבד, והכפילות נבדקת לפי הקוד עצמו.'
              : 'הרשימה מכילה אנשים, והכפילות נבדקת לפי מספר הטלפון.'}
          </p>

          <Section icon={<Upload size={15} />} title={isCodes ? 'טעינת קודים' : 'טעינת משתתפים'}>
            <RaffleImportPanel
              listType={listType}
              participantCount={participantCount}
              onImport={onImport}
              onDownloadTemplate={downloadTemplate}
              onLoadDemo={!hideDemo && onLoadDemo ? onLoadDemo : undefined}
              fileHandlerRef={importFileRef}
            />
          </Section>

          {participantsManager && (
            <Section icon={<Users size={15} />} title={isCodes ? 'ניהול קודים' : 'ניהול משתתפים'}>
              {participantsManager}
            </Section>
          )}

          {/* The header already carries the primary "open the big screen"
              action — this section is just the shareable link. */}
          {bigScreenUrl && (
            <Section icon={<LinkIcon size={15} />} title="קישור מסך ענק">
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={bigScreenUrl}
                  dir="ltr"
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-11 min-w-0 flex-1 rounded-lg bg-white/5 px-4 text-sm text-white/70 outline-none"
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
                  className="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-white/10 px-4 text-sm font-medium text-white transition hover:bg-white/[0.16] active:scale-[0.99]"
                >
                  {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                  {copied ? 'הועתק' : 'העתיקו'}
                </button>
              </div>
              <p className="text-sm leading-relaxed text-white/45">
                פתחו את הקישור על המסך הגדול. {isCodes ? 'קודים בלבד.' : 'שמות בלבד — בלי טלפונים.'}
              </p>
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

          <Section icon={<Sparkles size={15} />} title="סגנון אנימציה">
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { key: 'wheel', label: 'גלגל מסתובב' },
                  { key: 'codeReveal', label: 'חשיפת קוד' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => onConfigChange({ animationStyle: opt.key })}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    (config.animationStyle ?? 'wheel') === opt.key
                      ? 'bg-amber-400 text-black'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {(config.animationStyle ?? 'wheel') === 'codeReveal' ? (
              <>
                <p className="text-xs leading-relaxed text-white/40">
                  התווים מתערבבים ואז ננעלים אחד-אחד משמאל לימין עד לחשיפת הקוד המלא. מתאים
                  לרשימות של קודים.
                </p>
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs text-white/40">
                    <span>קצב נעילה</span>
                    <span className="text-white/70">
                      {((config.codeLockMs ?? CODE_LOCK_MS_DEFAULT) / 1000).toFixed(1)} שנ׳ לתו
                    </span>
                  </div>
                  <input
                    type="range"
                    min={CODE_LOCK_MS_MIN}
                    max={CODE_LOCK_MS_MAX}
                    step={100}
                    value={config.codeLockMs ?? CODE_LOCK_MS_DEFAULT}
                    onChange={(e) => onConfigChange({ codeLockMs: Number(e.target.value) })}
                    className="w-full accent-amber-400"
                  />
                  <p className="text-xs leading-relaxed text-white/40">
                    הקצב מתחיל מהיר יותר ומאט בשני התווים האחרונים, לשיא מתח בסוף.
                  </p>
                </div>
              </>
            ) : (
              <p className="text-xs leading-relaxed text-white/40">
                הגלגל הקלאסי — השמות רצים אנכית ונעצרים על הזוכה.
              </p>
            )}
          </Section>

          {/* Codes have no name/phone split — nothing to choose between. */}
          <Section icon={<Eye size={15} />} title="מצב תצוגה" hidden={isCodes}>
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

            {(config.animationStyle ?? 'wheel') === 'codeReveal' && (
              <>
                <CheckRow
                  label="תיתוק ונעילת תווים"
                  checked={config.codeTickSounds !== false}
                  onChange={(v) => onConfigChange({ codeTickSounds: v })}
                />
                <p className="text-xs leading-relaxed text-white/40">
                  תיתוק בזמן שהתווים רצים ו״פוק״ בכל נעילה. צליל הזכייה נשאר זה שנבחר למטה.
                </p>
              </>
            )}

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
          </div>

          {/* Danger zone — permanent deletion of ALL raffle data. Recommended at
              the end of the event (data-retention / privacy). */}
          <div className="mt-4 space-y-2.5 rounded-xl border border-red-500/30 bg-red-500/[0.06] px-3 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-red-400">
              <AlertTriangle size={15} /> אזור מסוכן
            </div>
            <p className="text-xs leading-relaxed text-white/45">
              מחיקה לצמיתות של כל המשתתפים והזוכים מההגרלה הזו. מומלץ לבצע בסיום האירוע. לא ניתן לשחזר.
            </p>
            <button
              onClick={() => {
                setDeleteText('');
                setConfirmDeleteOpen(true);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600/90 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-600"
            >
              <Trash2 size={15} /> מחיקת כל נתוני ההגרלה
            </button>
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

      {/* Type-to-confirm permanent deletion modal */}
      {confirmDeleteOpen && (
        <div
          dir="rtl"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4"
          onClick={() => !deleting && setConfirmDeleteOpen(false)}
          style={{ fontFamily: 'var(--font-assistant), sans-serif' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-[#15151c] p-6 text-white shadow-2xl"
          >
            <div className="mb-2 flex items-center gap-2 text-lg font-bold text-red-400">
              <AlertTriangle size={20} /> מחיקת כל הנתונים
            </div>
            <p className="mb-4 text-sm leading-relaxed text-white/70">
              פעולה זו תמחק לצמיתות את כל המשתתפים
              {participantCount > 0 ? ` (${participantCount.toLocaleString('he-IL')})` : ''} ואת רשימת
              הזוכים בהגרלה זו. לא ניתן לשחזר. כדי לאשר, הקלידו{' '}
              <span className="font-bold text-white">מחיקה</span>.
            </p>
            <input
              autoFocus
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && deleteText.trim() === 'מחיקה' && !deleting) handleConfirmDelete();
              }}
              placeholder="מחיקה"
              className="mb-4 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-center text-sm outline-none focus:border-red-400"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteOpen(false)}
                disabled={deleting}
                className="flex-1 rounded-lg bg-white/5 px-4 py-2.5 text-sm font-medium transition hover:bg-white/10 disabled:opacity-40"
              >
                ביטול
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteText.trim() !== 'מחיקה' || deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                {deleting ? 'מוחק…' : 'מחק הכל'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Section({
  icon,
  title,
  children,
  hidden,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  hidden?: boolean;
}) {
  if (hidden) return null;
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
      onDragEnter={(e) => e.stopPropagation()}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDragStateChange(true);
      }}
      onDragLeave={(e) => {
        e.stopPropagation();
        onDragStateChange(false);
      }}
      // stopPropagation so a background asset isn't ALSO read as a participant
      // list by the dialog-wide drop handler.
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
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
