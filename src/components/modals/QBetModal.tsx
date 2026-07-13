'use client';

// QBet ("הימור") settings modal — owner side.
// Save-and-stay-open (like SelfiebeamModal): the parent handleSaveQBet uploads
// the landing image + persists the config, returns the saved config, and the
// modal adopts it (so a second Save never re-uploads the image).
// The registrants tab reads the qbetEntries subcollection via /api/qbet/entries
// (owner-only) and exports Excel CLIENT-SIDE (XLSX.writeFile — never server-side).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Check,
  ChevronDown,
  Clock,
  Dices,
  Download,
  Gift,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Trophy,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { compressImage } from '@/lib/imageCompression';
import { formatPhoneForDisplay } from '@/lib/phone-utils';
import { SELFIEBEAM_COUNTRIES, type SelfiebeamCountry } from '@/lib/selfiebeam/countries';
import {
  DEFAULT_QBET_CONFIG,
  DEFAULT_QBET_GRADIENT,
  bettingCloseTime,
  isWinningPrediction,
  type QBetConfig,
  type QBetEntry,
  type QBetTeam,
} from '@/lib/qbet/types';

interface QBetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    config: QBetConfig,
    bgImageFile?: File | null,
    logoFile?: File | null
  ) => Promise<QBetConfig | void> | QBetConfig | void;
  // Creates a SEPARATE raffle code seeded with the winners (Fattal engine as-is).
  onCreateWinnersRaffle?: (
    winners: { fullName: string; phone: string }[]
  ) => Promise<void> | void;
  initialConfig?: QBetConfig;
  codeId: string;
  shortId: string;
}

function countryToTeam(c: SelfiebeamCountry): QBetTeam {
  return { code: c.code, name: c.nameHe, flag: c.flag };
}

// Compact "13.7 · 20:45" stamp for when a prediction was submitted
function formatPickTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })} · ${d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
}

// ISO ⇄ <input type="datetime-local"> value (local wall-clock, no timezone).
function isoToLocalInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function localInputToIso(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

// Searchable country/flag picker (reuses the Selfie Beam flag assets).
function TeamPicker({
  label,
  team,
  onPick,
}: {
  label: string;
  team: QBetTeam;
  onPick: (team: QBetTeam) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = SELFIEBEAM_COUNTRIES.filter((c) => !c.custom);
    if (!q) return list;
    return list.filter(
      (c) =>
        c.nameHe.includes(query.trim()) ||
        c.nameEn.toLowerCase().includes(q) ||
        (c.aliases || []).some((a) => a.toLowerCase().includes(q))
    );
  }, [query]);

  return (
    <div className="flex-1 space-y-1.5" ref={boxRef}>
      <label className="block text-xs font-medium text-text-secondary">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 h-11 rounded-xl bg-bg-secondary border border-border hover:border-accent/50 transition-colors"
        >
          <span className="flex items-center gap-2 min-w-0">
            <img src={team.flag} alt="" className="w-7 h-5 object-cover rounded shadow shrink-0" />
            <span className="text-sm font-medium text-text-primary truncate">{team.name}</span>
          </span>
          <ChevronDown className="w-4 h-4 text-text-secondary shrink-0" />
        </button>
        {open && (
          <div className="absolute z-20 mt-1 w-full rounded-xl bg-bg-primary border border-border shadow-xl overflow-hidden">
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="w-4 h-4 text-text-secondary absolute top-1/2 -translate-y-1/2 start-2.5" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="חיפוש מדינה..."
                  autoFocus
                  className="w-full h-9 ps-8 pe-3 rounded-lg bg-bg-secondary text-sm text-text-primary outline-none"
                />
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto">
              {filtered.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    onPick(countryToTeam(c));
                    setOpen(false);
                    setQuery('');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-bg-hover transition-colors text-start"
                >
                  <img src={c.flag} alt="" className="w-7 h-5 object-cover rounded shadow shrink-0" />
                  <span className="text-sm text-text-primary">{c.nameHe}</span>
                  <span className="text-xs text-text-secondary ms-auto">{c.nameEn}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-3 py-4 text-sm text-text-secondary text-center">אין תוצאות</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function QBetModal({
  isOpen,
  onClose,
  onSave,
  onCreateWinnersRaffle,
  initialConfig,
  codeId,
  shortId,
}: QBetModalProps) {
  const [activeTab, setActiveTab] = useState<'settings' | 'entries'>('settings');
  const [config, setConfig] = useState<QBetConfig>({
    ...DEFAULT_QBET_CONFIG,
    ...(initialConfig || {}),
  });

  // Landing image + logo (deferred upload — the parent uploads on Save)
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [processingImage, setProcessingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [processingLogo, setProcessingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [dragTarget, setDragTarget] = useState<'bg' | 'logo' | null>(null);

  // Winners raffle bridge
  const [confirmRaffle, setConfirmRaffle] = useState(false);
  const [creatingRaffle, setCreatingRaffle] = useState(false);
  const [raffleError, setRaffleError] = useState<string | null>(null);

  // Final result draft (strings so the inputs can be cleared while typing)
  const [resultHome, setResultHome] = useState('');
  const [resultAway, setResultAway] = useState('');

  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // Entries tab
  const [entries, setEntries] = useState<QBetEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Re-sync when (re)opening. Spread defaults FIRST so configs saved before a
  // field existed (e.g. disclaimerText / allowChangePrediction) pick up the
  // default; owner-cleared values ('' / false) still win.
  useEffect(() => {
    if (!isOpen) return;
    const cfg = { ...DEFAULT_QBET_CONFIG, ...(initialConfig || {}) };
    setConfig(cfg);
    setResultHome(cfg.finalResult ? String(cfg.finalResult.home) : '');
    setResultAway(cfg.finalResult ? String(cfg.finalResult.away) : '');
    setBgFile(null);
    setBgPreview(null);
    setLogoFile(null);
    setLogoPreview(null);
    setActiveTab('settings');
    setSaveError(false);
    setConfirmDeleteId(null);
    setConfirmRaffle(false);
    setRaffleError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Revoke the local preview object URLs on change/unmount
  useEffect(() => {
    return () => {
      if (bgPreview) URL.revokeObjectURL(bgPreview);
    };
  }, [bgPreview]);
  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const update = (patch: Partial<QBetConfig>) => setConfig((prev) => ({ ...prev, ...patch }));

  const handleImagePick = async (file: File) => {
    setProcessingImage(true);
    try {
      // Portrait poster shown full-screen on phones — keep generous dimensions.
      const result = await compressImage(file, {
        maxWidth: 1440,
        maxHeight: 2560,
        maxSizeKB: 900,
        quality: 0.85,
      });
      const compressed = new File([result.blob], 'qbet-bg.webp', { type: result.blob.type });
      setBgFile(compressed);
      setBgPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(compressed);
      });
    } catch (error) {
      console.error('QBet image processing failed:', error);
    } finally {
      setProcessingImage(false);
    }
  };

  // Transparent PNG logo — compress client-side with alpha preserved (the
  // proven Q.Games pattern; /api/upload does NOT convert unless asked).
  const handleLogoPick = async (file: File) => {
    setProcessingLogo(true);
    try {
      const result = await compressImage(file, {
        maxSizeKB: 1024,
        maxWidth: 800,
        maxHeight: 800,
        preserveAlpha: true,
      });
      const compressed = new File([result.blob], 'qbet-logo.png', { type: result.blob.type });
      setLogoFile(compressed);
      setLogoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(compressed);
      });
    } catch (error) {
      console.error('QBet logo processing failed:', error);
    } finally {
      setProcessingLogo(false);
    }
  };

  // Apply the result-draft inputs onto the config draft (both empty = clear).
  const applyResultDraft = (cfg: QBetConfig): QBetConfig => {
    const home = parseInt(resultHome, 10);
    const away = parseInt(resultAway, 10);
    if (Number.isInteger(home) && Number.isInteger(away) && home >= 0 && away >= 0) {
      return { ...cfg, finalResult: { home, away } };
    }
    return { ...cfg, finalResult: null };
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(false);
    try {
      const toSave = applyResultDraft(config);
      const saved = await Promise.resolve(onSave(toSave, bgFile, logoFile));
      const finalCfg = saved || toSave;
      setConfig(finalCfg);
      setResultHome(finalCfg.finalResult ? String(finalCfg.finalResult.home) : '');
      setResultAway(finalCfg.finalResult ? String(finalCfg.finalResult.away) : '');
      // Images now live at their persisted URLs — drop the pending files.
      setBgFile(null);
      setBgPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setLogoFile(null);
      setLogoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (error) {
      console.error('QBet save failed:', error);
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  const loadEntries = useCallback(async () => {
    setLoadingEntries(true);
    setEntriesError(null);
    try {
      const res = await fetchWithAuth(`/api/qbet/entries?codeId=${encodeURIComponent(codeId)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEntriesError('טעינת הנרשמים נכשלה');
        return;
      }
      setEntries(data.entries || []);
    } catch {
      setEntriesError('טעינת הנרשמים נכשלה');
    } finally {
      setLoadingEntries(false);
    }
  }, [codeId]);

  useEffect(() => {
    if (isOpen && activeTab === 'entries') void loadEntries();
  }, [isOpen, activeTab, loadEntries]);

  const handleDeleteEntry = async (entryId: string) => {
    try {
      await fetchWithAuth(
        `/api/qbet/entries?codeId=${encodeURIComponent(codeId)}&entryId=${encodeURIComponent(entryId)}`,
        { method: 'DELETE' }
      );
      setConfirmDeleteId(null);
      await loadEntries();
    } catch {
      /* keep list as-is */
    }
  };

  const draftResult = applyResultDraft(config).finalResult;
  const predictedCount = entries.filter((e) => e.predictionHome != null).length;
  const winners = draftResult
    ? entries.filter(
        (e) =>
          e.verified &&
          isWinningPrediction({ home: e.predictionHome, away: e.predictionAway }, draftResult)
      )
    : [];

  // Kick the winners into a fresh raffle code (the parent creates the code and
  // navigates to it — this modal unmounts on success).
  const handleWinnersRaffle = async () => {
    if (!onCreateWinnersRaffle || winners.length === 0) return;
    setCreatingRaffle(true);
    setRaffleError(null);
    try {
      await Promise.resolve(
        onCreateWinnersRaffle(winners.map((w) => ({ fullName: w.fullName, phone: w.phone })))
      );
    } catch (error) {
      console.error('QBet winners raffle failed:', error);
      setRaffleError('יצירת ההגרלה נכשלה — נסו שוב');
      setCreatingRaffle(false);
    }
  };

  const gradient =
    config.buttonGradient && config.buttonGradient.length >= 2
      ? config.buttonGradient
      : DEFAULT_QBET_GRADIENT;

  const handleExport = () => {
    const rows = entries.map((e) => {
      const hasPick = e.predictionHome != null && e.predictionAway != null;
      return {
        'שם מלא': e.fullName,
        'טלפון': formatPhoneForDisplay(e.phone),
        [`ניחוש ${config.teamHome.name}`]: hasPick ? e.predictionHome : '',
        [`ניחוש ${config.teamAway.name}`]: hasPick ? e.predictionAway : '',
        'ניחוש': hasPick ? `${e.predictionHome}-${e.predictionAway}` : '',
        'אומת': e.verified ? 'כן' : 'לא',
        'זכייה': draftResult
          ? e.verified &&
            isWinningPrediction({ home: e.predictionHome, away: e.predictionAway }, draftResult)
            ? 'זכה'
            : ''
          : '',
        'שעת ניחוש': e.predictedAt ? new Date(e.predictedAt).toLocaleString('he-IL') : '',
        'תאריך הרשמה': e.createdAt ? new Date(e.createdAt).toLocaleString('he-IL') : '',
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 22 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 8 },
      { wch: 6 },
      { wch: 8 },
      { wch: 18 },
      { wch: 18 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Entries');
    XLSX.writeFile(workbook, `qbet-export-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // AVIF/HEIC often arrive with an empty MIME type on drop — accept by
  // extension too. compressImage decodes them client-side (canvas) before upload.
  const isImageFile = (file: File) =>
    file.type.startsWith('image/') ||
    /\.(avif|heic|heif|png|jpe?g|webp|gif|bmp|tiff?)$/i.test(file.name);

  const makeDropHandlers = (target: 'bg' | 'logo', pick: (f: File) => void) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (dragTarget !== target) setDragTarget(target);
    },
    onDragLeave: (e: React.DragEvent) => {
      e.preventDefault();
      setDragTarget((t) => (t === target ? null : t));
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragTarget(null);
      const file = e.dataTransfer.files?.[0];
      if (file && isImageFile(file)) void pick(file);
    },
  });

  if (!isOpen) return null;

  const bgImageShown = bgPreview || config.backgroundImageUrl || null;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-bg-primary border border-border rounded-2xl w-full max-w-2xl max-h-[94dvh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 via-indigo-600 to-red-500 flex items-center justify-center">
              <Dices className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-text-primary leading-tight">הימור</h2>
              <p className="text-xs text-text-secondary" dir="ltr">
                {origin}/v/{shortId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary"
            aria-label="סגירה"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3">
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              activeTab === 'settings'
                ? 'bg-bg-secondary text-text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            הגדרות
          </button>
          <button
            onClick={() => setActiveTab('entries')}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'entries'
                ? 'bg-bg-secondary text-text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Users className="w-4 h-4" />
            נרשמים
            {entries.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-accent/20 text-accent text-xs font-bold">
                {entries.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4">
          {activeTab === 'settings' ? (
            <div className="space-y-6">
              {/* Landing image */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-primary">
                  תמונת דף הנחיתה
                </label>
                <p className="text-xs text-text-secondary">
                  התמונה מכסה את כל המסך — לחיצה עליה מובילה להרשמה. מומלץ פורמט אנכי (9:16)
                  עם כפתור קריאה לפעולה בתוך העיצוב.
                </p>
                <div className="flex items-start gap-3">
                  <div
                    onClick={() => !processingImage && fileInputRef.current?.click()}
                    {...makeDropHandlers('bg', handleImagePick)}
                    className={`w-28 h-48 rounded-xl overflow-hidden flex items-center justify-center shrink-0 cursor-pointer border-2 transition-colors ${
                      dragTarget === 'bg'
                        ? 'border-accent border-dashed bg-accent/10'
                        : 'bg-bg-secondary border-border hover:border-accent/50'
                    }`}
                  >
                    {processingImage ? (
                      <Loader2 className="w-5 h-5 animate-spin text-text-secondary" />
                    ) : bgImageShown ? (
                      <img src={bgImageShown} alt="" className="w-full h-full object-cover pointer-events-none" />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-text-secondary px-2 text-center pointer-events-none">
                        <Upload className="w-6 h-6" />
                        <span className="text-[10px] leading-tight">גררו לכאן או לחצו</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.avif,.heic,.heif"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleImagePick(file);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={processingImage}
                      className="btn btn-primary text-sm disabled:opacity-50"
                    >
                      {bgImageShown ? 'החלפת תמונה' : 'העלאת תמונה'}
                    </button>
                    {bgImageShown && (
                      <button
                        type="button"
                        onClick={() => {
                          setBgFile(null);
                          setBgPreview((prev) => {
                            if (prev) URL.revokeObjectURL(prev);
                            return null;
                          });
                          update({ backgroundImageUrl: '', backgroundImageSize: 0 });
                        }}
                        className="block text-xs text-danger hover:underline"
                      >
                        הסרת התמונה
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Logo (transparent PNG) */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-primary">
                  לוגו (PNG עם רקע שקוף)
                </label>
                <p className="text-xs text-text-secondary">
                  מוצג במרכז החלק העליון של דף הנחיתה, מעל התמונה.
                </p>
                <div className="flex items-center gap-3">
                  <div
                    onClick={() => !processingLogo && logoInputRef.current?.click()}
                    {...makeDropHandlers('logo', handleLogoPick)}
                    className={`w-28 h-16 rounded-xl overflow-hidden flex items-center justify-center shrink-0 p-1.5 cursor-pointer border-2 transition-colors ${
                      dragTarget === 'logo'
                        ? 'border-accent border-dashed bg-accent/10'
                        : 'bg-bg-secondary border-border hover:border-accent/50'
                    }`}
                  >
                    {processingLogo ? (
                      <Loader2 className="w-5 h-5 animate-spin text-text-secondary" />
                    ) : logoPreview || config.logoUrl ? (
                      <img
                        src={logoPreview || config.logoUrl}
                        alt=""
                        className="max-w-full max-h-full object-contain pointer-events-none"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-text-secondary text-center pointer-events-none">
                        <Upload className="w-5 h-5" />
                        <span className="text-[10px] leading-tight">גררו או לחצו</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*,.avif,.heic,.heif"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleLogoPick(file);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={processingLogo}
                      className="btn btn-primary text-sm disabled:opacity-50"
                    >
                      {logoPreview || config.logoUrl ? 'החלפת לוגו' : 'העלאת לוגו'}
                    </button>
                    {(logoPreview || config.logoUrl) && (
                      <button
                        type="button"
                        onClick={() => {
                          setLogoFile(null);
                          setLogoPreview((prev) => {
                            if (prev) URL.revokeObjectURL(prev);
                            return null;
                          });
                          update({ logoUrl: '', logoSize: 0 });
                        }}
                        className="block text-xs text-danger hover:underline"
                      >
                        הסרת הלוגו
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-text-secondary">כותרת</label>
                <input
                  type="text"
                  value={config.title}
                  onChange={(e) => update({ title: e.target.value })}
                  maxLength={60}
                  className="input w-full text-sm"
                />
              </div>

              {/* Landing title overlay */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-text-secondary">
                  כותרת על הפוסטר (אופציונלי)
                </label>
                <input
                  type="text"
                  value={config.landingTitle || ''}
                  onChange={(e) => update({ landingTitle: e.target.value })}
                  placeholder="למשל: שידור המונדיאל — השאירו ריק אם הכיתוב כבר בתוך התמונה"
                  maxLength={40}
                  className="input w-full text-sm"
                />
              </div>

              {/* Teams */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-primary">המשחק</label>
                <div className="flex items-end gap-3">
                  <TeamPicker
                    label="קבוצת בית"
                    team={config.teamHome}
                    onPick={(team) => update({ teamHome: team })}
                  />
                  <span className="pb-3 text-xs font-bold text-text-secondary">VS</span>
                  <TeamPicker
                    label="קבוצת חוץ"
                    team={config.teamAway}
                    onPick={(team) => update({ teamAway: team })}
                  />
                </div>
              </div>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-text-secondary">צבע רקע</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={config.backgroundColor}
                      onChange={(e) => update({ backgroundColor: e.target.value })}
                      className="w-10 h-10 rounded-lg border border-border bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={config.backgroundColor}
                      onChange={(e) => update({ backgroundColor: e.target.value })}
                      dir="ltr"
                      className="input flex-1 text-sm text-center"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-text-secondary">צבע טקסט</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={config.fontColor}
                      onChange={(e) => update({ fontColor: e.target.value })}
                      className="w-10 h-10 rounded-lg border border-border bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={config.fontColor}
                      onChange={(e) => update({ fontColor: e.target.value })}
                      dir="ltr"
                      className="input flex-1 text-sm text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Landing CTA button */}
              <div className="rounded-xl bg-bg-secondary border border-border p-4 space-y-3">
                <label className="block text-sm font-medium text-text-primary">
                  כפתור ההרשמה בדף הנחיתה
                </label>
                <style>{`@keyframes qbetFlow{0%{background-position:0% 50%}100%{background-position:300% 50%}}@keyframes qbetShine{0%{transform:translateX(-160%) skewX(-18deg)}55%,100%{transform:translateX(320%) skewX(-18deg)}}`}</style>
                <div className="rounded-xl p-4" style={{ background: config.backgroundColor || '#0b0f1a' }}>
                  <span
                    className="relative block rounded-full p-[3px] mx-auto max-w-64"
                    style={{
                      backgroundImage: `linear-gradient(90deg, ${[...gradient, gradient[0]].join(', ')})`,
                      backgroundSize: '300% 100%',
                      animation: 'qbetFlow 5s linear infinite',
                      boxShadow: `0 0 20px ${gradient[0]}66`,
                    }}
                  >
                    <span className="relative block overflow-hidden rounded-full">
                      <span
                        className="flex items-center justify-center h-11 px-5 rounded-full text-sm font-bold whitespace-nowrap"
                        style={{ background: 'rgba(6,9,18,0.72)', color: config.buttonTextColor || '#ffffff' }}
                      >
                        {config.buttonText || 'הירשמו עכשיו ובחרו תוצאה'}
                      </span>
                      <span
                        className="absolute top-0 bottom-0 left-0 w-[45%] pointer-events-none"
                        style={{
                          background: 'linear-gradient(105deg,transparent,rgba(255,255,255,.35),transparent)',
                          animation: 'qbetShine 3.2s ease-in-out infinite',
                        }}
                        aria-hidden="true"
                      />
                    </span>
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-text-secondary">טקסט הכפתור</label>
                    <input
                      type="text"
                      value={config.buttonText ?? ''}
                      onChange={(e) => update({ buttonText: e.target.value })}
                      maxLength={40}
                      className="input w-full text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-text-secondary">צבע טקסט הכפתור</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={config.buttonTextColor || '#ffffff'}
                        onChange={(e) => update({ buttonTextColor: e.target.value })}
                        className="w-10 h-10 rounded-lg border border-border bg-transparent cursor-pointer"
                      />
                      <input
                        type="text"
                        value={config.buttonTextColor || '#ffffff'}
                        onChange={(e) => update({ buttonTextColor: e.target.value })}
                        dir="ltr"
                        className="input flex-1 text-sm text-center"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-text-secondary">
                    צבעי הגרדיאנט של המסגרת (2–4)
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {gradient.map((color, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <input
                          type="color"
                          value={color}
                          onChange={(e) =>
                            update({
                              buttonGradient: gradient.map((c, idx) => (idx === i ? e.target.value : c)),
                            })
                          }
                          className="w-10 h-10 rounded-lg border border-border bg-transparent cursor-pointer"
                        />
                        {gradient.length > 2 && (
                          <button
                            type="button"
                            onClick={() => update({ buttonGradient: gradient.filter((_, idx) => idx !== i) })}
                            className="p-1 rounded text-text-secondary hover:text-danger"
                            aria-label="הסרת צבע"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    {gradient.length < 4 && (
                      <button
                        type="button"
                        onClick={() => update({ buttonGradient: [...gradient, '#22d3ee'] })}
                        className="w-10 h-10 rounded-lg border border-dashed border-border text-text-secondary hover:text-accent hover:border-accent flex items-center justify-center"
                        aria-label="הוספת צבע"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Participant consent line */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-primary">
                  טקסט אישור התנאים
                </label>
                <p className="text-xs text-text-secondary">
                  מוצג מתחת לכפתור ההרשמה — ההרשמה מהווה אישור. אפשר לנסח מחדש, או להשאיר
                  ריק כדי להסתיר את השורה.
                </p>
                <textarea
                  value={config.disclaimerText ?? ''}
                  onChange={(e) => update({ disclaimerText: e.target.value })}
                  rows={3}
                  maxLength={300}
                  className="input w-full text-sm leading-relaxed resize-none"
                />
              </div>

              {/* Match status */}
              <div className="rounded-xl bg-bg-secondary border border-border p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">נעילת הימורים</p>
                    <p className="text-xs text-text-secondary">
                      נועלים כשהמשחק מתחיל — נרשמים חדשים ושינויי ניחוש ייחסמו
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!!config.locked}
                    onClick={() => update({ locked: !config.locked })}
                    className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
                      config.locked ? 'bg-accent' : 'bg-border'
                    }`}
                  >
                    <span
                      className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                      style={{ insetInlineStart: config.locked ? '26px' : '2px' }}
                    />
                  </button>
                </div>

                {/* Auto-lock by kickoff time */}
                <div className="border-t border-border pt-4 space-y-2">
                  <p className="text-sm font-medium text-text-primary">נעילה אוטומטית לפי שעת המשחק</p>
                  <p className="text-xs text-text-secondary">
                    ההימורים ייסגרו אוטומטית מספר דקות אחרי שריקת הפתיחה — בלי צורך לנעול ידנית.
                    השאירו ריק כדי לנעול רק ידנית.
                  </p>
                  <div className="flex items-end gap-3 flex-wrap">
                    <div className="space-y-1 flex-1 min-w-[180px]">
                      <label className="block text-xs text-text-secondary">שעת תחילת המשחק</label>
                      <input
                        type="datetime-local"
                        value={isoToLocalInput(config.kickoffAt)}
                        onChange={(e) => update({ kickoffAt: localInputToIso(e.target.value) })}
                        className="input w-full text-sm"
                      />
                    </div>
                    <div className="space-y-1 w-28">
                      <label className="block text-xs text-text-secondary">דקות עד נעילה</label>
                      <input
                        type="number"
                        min={0}
                        max={180}
                        value={config.autoLockMinutes ?? ''}
                        placeholder="0"
                        disabled={!config.kickoffAt}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10);
                          update({ autoLockMinutes: Number.isFinite(n) && n >= 0 ? n : undefined });
                        }}
                        className="input w-full text-sm text-center disabled:opacity-50"
                      />
                    </div>
                  </div>
                  {(() => {
                    const closeAt = bettingCloseTime(config);
                    if (!closeAt) return null;
                    return (
                      <p className="text-xs text-accent">
                        ההימור ייסגר ב-
                        {new Date(closeAt).toLocaleString('he-IL', {
                          day: 'numeric',
                          month: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    );
                  })()}
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                  <div>
                    <p className="text-sm font-medium text-text-primary">שינוי הימור</p>
                    <p className="text-xs text-text-secondary">
                      כשפעיל — משתתפים יכולים לעדכן את הניחוש עד הנעילה. כשכבוי — ניחוש אחד בלבד
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={config.allowChangePrediction !== false}
                    onClick={() =>
                      update({ allowChangePrediction: config.allowChangePrediction === false })
                    }
                    className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
                      config.allowChangePrediction !== false ? 'bg-accent' : 'bg-border'
                    }`}
                  >
                    <span
                      className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                      style={{
                        insetInlineStart:
                          config.allowChangePrediction !== false ? '26px' : '2px',
                      }}
                    />
                  </button>
                </div>

                <div className="border-t border-border pt-4 space-y-2">
                  <p className="text-sm font-medium text-text-primary">התוצאה הסופית</p>
                  <p className="text-xs text-text-secondary">
                    מזינים את התוצאה בסוף המשחק ולוחצים שמירה — הזוכים יסומנו ברשימת הנרשמים
                    ובאקסל, והמשתתפים יראו אם צדקו. פרסום תוצאה נועל את ההימורים.
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-1" dir="ltr">
                    <div className="flex flex-col items-center gap-1">
                      <img src={config.teamHome.flag} alt="" className="w-8 h-5 object-cover rounded shadow" />
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={resultHome}
                        onChange={(e) => setResultHome(e.target.value)}
                        placeholder="-"
                        className="input w-16 text-center text-lg font-bold"
                      />
                    </div>
                    <span className="text-xl font-bold text-text-secondary">:</span>
                    <div className="flex flex-col items-center gap-1">
                      <img src={config.teamAway.flag} alt="" className="w-8 h-5 object-cover rounded shadow" />
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={resultAway}
                        onChange={(e) => setResultAway(e.target.value)}
                        placeholder="-"
                        className="input w-16 text-center text-lg font-bold"
                      />
                    </div>
                  </div>
                  {(resultHome !== '' || resultAway !== '') && (
                    <button
                      type="button"
                      onClick={() => {
                        setResultHome('');
                        setResultAway('');
                      }}
                      className="block mx-auto text-xs text-danger hover:underline"
                    >
                      ניקוי התוצאה
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-bg-secondary p-3 text-center">
                  <p className="text-xl font-bold text-text-primary">{entries.length}</p>
                  <p className="text-xs text-text-secondary">נרשמים</p>
                </div>
                <div className="rounded-xl bg-bg-secondary p-3 text-center">
                  <p className="text-xl font-bold text-text-primary">{predictedCount}</p>
                  <p className="text-xs text-text-secondary">הימרו</p>
                </div>
                <div className="rounded-xl bg-bg-secondary p-3 text-center">
                  <p className="text-xl font-bold text-accent">
                    {draftResult ? winners.length : '—'}
                  </p>
                  <p className="text-xs text-text-secondary">זוכים</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExport}
                  disabled={entries.length === 0}
                  className="btn btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  ייצוא לאקסל
                </button>
                <button
                  onClick={() => void loadEntries()}
                  disabled={loadingEntries}
                  className="p-2 rounded-lg bg-bg-secondary text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
                  aria-label="רענון"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingEntries ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Winners → raffle bridge (Fattal engine, separate code) */}
              {draftResult && winners.length > 0 && onCreateWinnersRaffle && (
                <div className="rounded-xl bg-bg-secondary border border-border p-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm text-text-primary flex items-center gap-2">
                    <Gift className="w-4 h-4 text-amber-400" />
                    הגרלה בין {winners.length} הזוכים על מסך ענק
                  </div>
                  {confirmRaffle ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void handleWinnersRaffle()}
                        disabled={creatingRaffle}
                        className="btn btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {creatingRaffle && <Loader2 className="w-4 h-4 animate-spin" />}
                        {creatingRaffle ? 'יוצרים...' : 'אישור — ייווצר קוד הגרלה חדש'}
                      </button>
                      <button
                        onClick={() => setConfirmRaffle(false)}
                        disabled={creatingRaffle}
                        className="text-xs text-text-secondary hover:underline"
                      >
                        ביטול
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRaffle(true)}
                      className="btn btn-primary text-sm flex items-center gap-1.5"
                    >
                      <Gift className="w-4 h-4" />
                      יצירת הגרלת זוכים
                    </button>
                  )}
                  {raffleError && <p className="w-full text-xs text-danger">{raffleError}</p>}
                </div>
              )}

              {entriesError && <p className="text-sm text-danger">{entriesError}</p>}

              {/* List */}
              {loadingEntries && entries.length === 0 ? (
                <div className="py-10 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
                </div>
              ) : entries.length === 0 && !entriesError ? (
                <p className="py-10 text-center text-sm text-text-secondary">
                  עדיין אין נרשמים — שתפו את הקוד ותנו לקהל להמר
                </p>
              ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                  {entries.map((entry, idx) => {
                    const hasPick = entry.predictionHome != null && entry.predictionAway != null;
                    const isWinner =
                      !!draftResult &&
                      entry.verified &&
                      isWinningPrediction(
                        { home: entry.predictionHome, away: entry.predictionAway },
                        draftResult
                      );
                    return (
                      <div
                        key={entry.id}
                        className={`px-3 py-2.5 ${idx > 0 ? 'border-t border-border' : ''} ${
                          isWinner ? 'bg-accent/10' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <p className="min-w-0 flex-1 text-sm font-medium text-text-primary truncate flex items-center gap-1.5">
                            {isWinner && <Trophy className="w-4 h-4 text-amber-400 shrink-0" />}
                            {entry.fullName}
                          </p>
                          {hasPick ? (
                            <span
                              className="px-2 py-0.5 rounded-lg bg-bg-secondary text-sm font-bold text-text-primary tabular-nums shrink-0"
                              dir="ltr"
                            >
                              {entry.predictionHome} : {entry.predictionAway}
                            </span>
                          ) : (
                            <span className="text-xs text-text-secondary shrink-0">ללא ניחוש</span>
                          )}
                          {confirmDeleteId === entry.id ? (
                            <button
                              onClick={() => void handleDeleteEntry(entry.id)}
                              className="px-2 py-1 rounded-lg bg-danger/20 text-danger text-xs font-medium shrink-0"
                            >
                              לאשר מחיקה?
                            </button>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(entry.id)}
                              className="p-1.5 rounded-lg text-text-secondary hover:text-danger transition-colors shrink-0"
                              aria-label="מחיקה"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                          <a
                            href={`https://wa.me/${entry.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs font-medium text-emerald-400 hover:underline"
                            dir="ltr"
                            aria-label="שליחת וואטסאפ"
                          >
                            <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                            {formatPhoneForDisplay(entry.phone)}
                          </a>
                          {entry.predictedAt && (
                            <span className="flex items-center gap-1 text-[11px] text-text-secondary">
                              <Clock className="w-3 h-3 shrink-0" />
                              {formatPickTime(entry.predictedAt)}
                            </span>
                          )}
                          {!entry.verified && (
                            <span className="text-[10px] text-amber-400">לא אומת</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'settings' && (
          <div className="px-5 py-4 border-t border-border flex items-center justify-between gap-3">
            <p className="text-xs text-danger">{saveError ? 'השמירה נכשלה — נסו שוב' : ''}</p>
            <button
              onClick={() => void handleSave()}
              disabled={saving || processingImage}
              className="btn btn-primary min-w-32 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : savedFlash ? (
                <Check className="w-4 h-4" />
              ) : null}
              {savedFlash ? 'נשמר' : 'שמירה'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
