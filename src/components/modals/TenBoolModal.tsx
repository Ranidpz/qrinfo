'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, ImagePlus, Loader2, Play, RotateCcw, Square, Timer, Trash2, Upload, X } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import {
  TENBOOL_DEFAULTS,
  TENBOOL_FONTS,
  TENBOOL_LOGO_SIZE,
  TENBOOL_SOUND_LIBRARY,
  resolveTenBoolSoundUrl,
  tenboolFont,
  tenboolFontStylesheet,
  tenboolEffects,
  tenboolPlaybackRate,
  tenboolSoundSetting,
  type TenBoolConfig,
  type TenBoolFontId,
  type TenBoolSoundChoice,
  type TenBoolSoundSlot,
} from '@/types/tenbool';

// Settings for "10 בול": look (font, colours, background image) + the four game sounds.
// Layout follows the product-first rule: a live preview of the big screen on top,
// then the controls, then one primary Save.

const SLOTS: { slot: TenBoolSoundSlot; label: string; hint: string }[] = [
  { slot: 'start', label: 'פתיחה', hint: 'כשהטיימר מתחיל' },
  { slot: 'beep', label: 'צפצוף', hint: 'בשניות 7, 8 ו-9' },
  { slot: 'ten', label: 'צפצוף 10', hint: 'בדיוק על 10.00' },
  { slot: 'success', label: 'הצלחה', hint: 'עצירה בדיוק על 10.00' },
  { slot: 'fail', label: 'כישלון', hint: 'כל עצירה אחרת' },
];

const MAX_UPLOAD = 4 * 1024 * 1024; // matches the upload route

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: TenBoolConfig) => Promise<TenBoolConfig | void>;
  initialConfig?: TenBoolConfig;
  codeId: string;
  shortId: string;
  title?: string;
}

function useFontStylesheet(family: string, id: string) {
  useEffect(() => {
    if (id === 'assistant') return;
    const href = tenboolFontStylesheet(family);
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }, [family, id]);
}

export default function TenBoolModal({ isOpen, onClose, onSave, initialConfig, codeId, shortId, title }: Props) {
  const [config, setConfig] = useState<TenBoolConfig>(initialConfig ?? {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<TenBoolSoundSlot | 'image' | 'logo' | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);
  const [playing, setPlaying] = useState<TenBoolSoundSlot | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const soundInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const uploadSlotRef = useRef<TenBoolSoundSlot>('start');

  // Re-seed only when the modal opens, so a save (new initialConfig ref) never resets what's on screen
  const wasOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setConfig(initialConfig ?? {});
      setSaved(false);
      setError(null);
    }
    wasOpen.current = isOpen;
  }, [isOpen, initialConfig]);

  useEffect(() => () => audioRef.current?.pause(), []);

  const font = tenboolFont(config);
  useFontStylesheet(font.family, font.id);

  if (!isOpen) return null;

  const update = (patch: Partial<TenBoolConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  };

  const setSound = (slot: TenBoolSoundSlot, patch: Partial<ReturnType<typeof tenboolSoundSetting>>) => {
    setConfig((prev) => ({
      ...prev,
      sounds: { ...prev.sounds, [slot]: { ...tenboolSoundSetting(prev, slot), ...patch } },
    }));
    setSaved(false);
  };

  const stopPreview = () => {
    audioRef.current?.pause();
    setPlaying(null);
  };

  const togglePreview = (slot: TenBoolSoundSlot) => {
    if (playing === slot) return stopPreview();
    const url = resolveTenBoolSoundUrl(config, slot);
    if (!url) return;
    audioRef.current?.pause();
    const audio = new Audio(url);
    // Same pitch as the game (the beep on 10.00 plays higher)
    audio.playbackRate = tenboolPlaybackRate(config, slot);
    audio.preservesPitch = false;
    audio.onended = () => setPlaying((p) => (p === slot ? null : p));
    audioRef.current = audio;
    setPlaying(slot);
    audio.play().catch(() => setPlaying(null));
  };

  const upload = async (file: File, kind: 'audio' | 'image') => {
    if (file.size > MAX_UPLOAD) throw new Error('הקובץ גדול מ-4MB');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('codeId', codeId);
    fd.append('kind', kind);
    fd.append('feature', 'tenbool');
    const res = await fetchWithAuth('/api/raffle/upload', { method: 'POST', body: fd });
    if (!res.ok) throw new Error(res.status === 400 ? 'סוג הקובץ אינו נתמך' : 'ההעלאה נכשלה');
    return (await res.json()).url as string;
  };

  const handleSoundFile = async (file: File) => {
    const slot = uploadSlotRef.current;
    setUploading(slot);
    setError(null);
    try {
      const url = await upload(file, 'audio');
      setSound(slot, { choice: 'custom', customUrl: url, customName: file.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ההעלאה נכשלה');
    } finally {
      setUploading(null);
    }
  };

  const handleImageFile = async (file: File) => {
    setUploading('image');
    setError(null);
    try {
      update({ backgroundImageUrl: await upload(file, 'image') });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ההעלאה נכשלה');
    } finally {
      setUploading(null);
    }
  };

  const handleLogoFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return setError('גררו קובץ תמונה (PNG עם רקע שקוף מומלץ)');
    setUploading('logo');
    setError(null);
    try {
      // Uploaded as-is (no re-encoding), so a PNG keeps its transparency
      update({ logoUrl: await upload(file, 'image') });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ההעלאה נכשלה');
    } finally {
      setUploading(null);
    }
  };

  const pickSoundFile = (slot: TenBoolSoundSlot) => {
    uploadSlotRef.current = slot;
    soundInputRef.current?.click();
  };

  const onChoice = (slot: TenBoolSoundSlot, choice: TenBoolSoundChoice) => {
    stopPreview();
    const current = tenboolSoundSetting(config, slot);
    // Nothing uploaded yet for this slot - go straight to the file picker
    if (choice === 'custom' && !current.customUrl) return pickSoundFile(slot);
    setSound(slot, { choice });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // JSON round-trip drops nested undefined values, which Firestore rejects
      const clean = JSON.parse(JSON.stringify(config)) as TenBoolConfig;
      const persisted = await onSave(clean);
      if (persisted) setConfig(persisted);
      setSaved(true);
    } catch {
      setError('השמירה נכשלה, נסו שוב');
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    stopPreview();
    onClose();
  };

  const bg = config.backgroundColor || TENBOOL_DEFAULTS.backgroundColor;
  const fg = config.textColor || TENBOOL_DEFAULTS.textColor;
  const isDefault = JSON.stringify(config) === '{}';
  const fx = tenboolEffects(config);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tenbool-modal-title"
        className="relative bg-bg-primary border border-border rounded-2xl w-full max-w-xl max-h-[94dvh] flex flex-col shadow-2xl overflow-hidden"
        onDragEnter={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return;
          e.preventDefault();
          dragDepth.current += 1;
          setDragOver(true);
        }}
        onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragDepth.current = 0;
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void handleLogoFile(f);
        }}
      >
        {dragOver && (
          <div className="pointer-events-none absolute inset-0 z-10 m-2 rounded-xl border-2 border-dashed border-accent bg-bg-primary/90 flex flex-col items-center justify-center gap-2 text-accent">
            <ImagePlus className="w-8 h-8" />
            <span className="font-semibold">שחררו כאן כדי להוסיף לוגו</span>
          </div>
        )}
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-red-500 to-rose-700 flex items-center justify-center">
              <Timer className="w-5 h-5 text-white" />
            </div>
            <h2 id="tenbool-modal-title" className="font-semibold text-text-primary truncate">
              הגדרות 10 בול
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <a
              href={`/v/${shortId}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="פתחו את המשחק"
              title="פתחו את המשחק"
              className="p-2 rounded-lg text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
            <button
              onClick={close}
              aria-label="סגרו"
              className="p-2 rounded-lg text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-6">
          {/* Live preview of the big screen */}
          <div
            className="relative aspect-video w-full rounded-xl overflow-hidden border border-border flex flex-col items-center justify-center gap-1"
            style={{
              backgroundColor: bg,
              backgroundImage: config.backgroundImageUrl ? `url("${config.backgroundImageUrl}")` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              color: fg,
              fontFamily: `'${font.family}', var(--font-assistant), system-ui, sans-serif`,
            }}
            aria-label="תצוגה מקדימה של מסך המשחק"
          >
            {config.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={config.logoUrl} alt="" className="object-contain max-w-[80%]" style={{ height: `${fx.logoSize}%` }} />
            )}
            {title && <div className="text-base sm:text-lg font-bold opacity-80">{title}</div>}
            <div dir="ltr" className="text-6xl sm:text-7xl font-black leading-none tabular-nums">
              10.00
            </div>
            <div className="text-sm sm:text-base font-black opacity-70">תנו בבאזר או געו במסך כדי להתחיל</div>
          </div>

          {/* Look */}
          <section className="space-y-3" aria-labelledby="tenbool-look">
            <h3 id="tenbool-look" className="text-sm font-semibold text-text-primary">
              מראה
            </h3>

            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-text-secondary">גופן</span>
              <select
                value={font.id}
                onChange={(e) => update({ fontId: e.target.value as TenBoolFontId })}
                className="input !w-44 !py-2"
              >
                {TENBOOL_FONTS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <ColorField label="צבע רקע" value={bg} onChange={(v) => update({ backgroundColor: v })} />
              <ColorField label="צבע טקסט" value={fg} onChange={(v) => update({ textColor: v })} />
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-text-secondary">תמונת רקע</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploading === 'image'}
                  className="btn btn-secondary !py-2 !px-3 text-sm"
                >
                  {uploading === 'image' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                  {config.backgroundImageUrl ? 'החליפו' : 'העלו תמונה'}
                </button>
                {config.backgroundImageUrl && (
                  <button
                    onClick={() => update({ backgroundImageUrl: undefined })}
                    aria-label="הסירו את תמונת הרקע"
                    title="הסירו את תמונת הרקע"
                    className="p-2 rounded-lg text-text-secondary hover:bg-bg-hover hover:text-danger"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-bg-secondary px-3 py-2.5 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-text-secondary">לוגו מעל הטיימר</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploading === 'logo'}
                    className="btn btn-secondary !py-2 !px-3 text-sm"
                  >
                    {uploading === 'logo' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                    {config.logoUrl ? 'החליפו' : 'העלו לוגו'}
                  </button>
                  {config.logoUrl && (
                    <button
                      onClick={() => update({ logoUrl: undefined })}
                      aria-label="הסירו את הלוגו"
                      title="הסירו את הלוגו"
                      className="p-2 rounded-lg text-text-secondary hover:bg-bg-hover hover:text-danger"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              {config.logoUrl ? (
                <label className="flex items-center gap-3">
                  <span className="text-xs text-text-secondary whitespace-nowrap">גודל</span>
                  <input
                    type="range"
                    min={TENBOOL_LOGO_SIZE.min}
                    max={TENBOOL_LOGO_SIZE.max}
                    step={1}
                    value={fx.logoSize}
                    onChange={(e) => update({ logoSize: Number(e.target.value) })}
                    className="flex-1 accent-[var(--accent)]"
                    aria-label="גודל הלוגו"
                  />
                </label>
              ) : (
                <p className="text-xs text-text-secondary">אפשר גם לגרור קובץ PNG לכל מקום בחלון</p>
              )}
            </div>
          </section>

          {/* End of round + countdown hints */}
          <section className="space-y-2" aria-labelledby="tenbool-fx">
            <h3 id="tenbool-fx" className="text-sm font-semibold text-text-primary">
              רמזים וסוף סיבוב
            </h3>
            <SwitchRow
              label="רמזים מהשנייה ה-7"
              hint="צפצופים, ספרות אדומות והבזק"
              checked={fx.warningCues}
              onChange={(v) => update({ warningCues: v })}
            />
            <SwitchRow label="הבהוב בהצלחה" hint="ירוק, צהוב וכחול" checked={fx.winFlash} onChange={(v) => update({ winFlash: v })} />
            <SwitchRow label="הבהוב בטעות" hint={fx.loseFlash ? "בצבע לבחירתכם" : "כבוי — הרקע נשאר כמו שהוא"} checked={fx.loseFlash} onChange={(v) => update({ loseFlash: v })}>
              {fx.loseFlash && <input
                type="color"
                value={fx.loseColor}
                onChange={(e) => update({ loseColor: e.target.value })}
                aria-label="צבע ההבהוב בטעות"
                className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent p-0"
              />}
            </SwitchRow>
          </section>

          {/* Sounds */}
          <section className="space-y-2" aria-labelledby="tenbool-sounds">
            <h3 id="tenbool-sounds" className="text-sm font-semibold text-text-primary">
              צלילים
            </h3>
            {SLOTS.map(({ slot, label, hint }) => {
              const s = tenboolSoundSetting(config, slot);
              const canPlay = !!resolveTenBoolSoundUrl(config, slot);
              const selectId = `tenbool-sound-${slot}`;
              return (
                <div key={slot} className="rounded-xl bg-bg-secondary px-3 py-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <label htmlFor={selectId} className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-text-primary">{label}</span>
                      <span className="block text-xs text-text-secondary truncate">{hint}</span>
                    </label>
                    <select
                      id={selectId}
                      value={s.choice}
                      onChange={(e) => onChoice(slot, e.target.value as TenBoolSoundChoice)}
                      className="input !w-36 sm:!w-40 !py-2 !bg-bg-primary"
                    >
                      {Object.entries(TENBOOL_SOUND_LIBRARY).map(([id, snd]) => (
                        <option key={id} value={id}>
                          {snd.label}
                        </option>
                      ))}
                      <option value="custom">צליל משלכם…</option>
                      <option value="none">ללא צליל</option>
                    </select>
                    <button
                      onClick={() => togglePreview(slot)}
                      disabled={!canPlay}
                      aria-label={playing === slot ? `עצרו את צליל ה${label}` : `השמיעו את צליל ה${label}`}
                      className="w-9 h-9 shrink-0 rounded-lg bg-bg-primary text-text-primary hover:bg-bg-hover flex items-center justify-center disabled:opacity-30"
                    >
                      {playing === slot ? <Square className="w-3.5 h-3.5" /> : <Play className="w-4 h-4" />}
                    </button>
                  </div>
                  {s.choice === 'custom' && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="flex-1 min-w-0 truncate text-text-secondary" dir="ltr">
                        {s.customName || 'קובץ שהועלה'}
                      </span>
                      <button
                        onClick={() => pickSoundFile(slot)}
                        disabled={uploading === slot}
                        className="flex items-center gap-1 text-accent hover:underline disabled:opacity-50"
                      >
                        {uploading === slot ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        החליפו קובץ
                      </button>
                    </div>
                  )}
                  {uploading === slot && s.choice !== 'custom' && (
                    <div className="flex items-center gap-1 text-xs text-text-secondary">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> מעלים…
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </div>

        {/* Decision row */}
        <div className="shrink-0 border-t border-border px-4 sm:px-5 py-3 space-y-2">
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button onClick={() => void handleSave()} disabled={saving} className="btn btn-primary flex-1 sm:flex-none sm:min-w-32">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
              {saving ? 'שומרים…' : saved ? 'נשמר' : 'שמרו'}
            </button>
            <button
              onClick={() => {
                stopPreview();
                setConfig({});
                setSaved(false);
              }}
              disabled={isDefault}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-bg-hover disabled:opacity-40"
            >
              <RotateCcw className="w-4 h-4" />
              ברירת מחדל
            </button>
          </div>
        </div>

        <input
          ref={soundInputRef}
          type="file"
          accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/aac,.mp3,.wav,.ogg,.m4a,.aac"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleSoundFile(f);
            e.target.value = '';
          }}
        />
        <input
          ref={logoInputRef}
          type="file"
          accept="image/png,image/webp,image/gif,image/jpeg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleLogoFile(f);
            e.target.value = '';
          }}
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleImageFile(f);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-xl bg-bg-secondary px-3 py-2">
      <span className="text-sm text-text-secondary whitespace-nowrap">{label}</span>
      <span className="flex items-center gap-2">
        <span className="hidden sm:inline text-xs text-text-secondary tabular-nums" dir="ltr">
          {value.toUpperCase()}
        </span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent p-0"
        />
      </span>
    </label>
  );
}

function SwitchRow({
  label,
  hint,
  checked,
  onChange,
  children,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-bg-secondary px-3 py-2.5">
      <div className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-text-primary">{label}</span>
        <span className="block text-xs text-text-secondary truncate">{hint}</span>
      </div>
      {children}
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-border'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'start-[1.375rem]' : 'start-0.5'}`}
        />
      </button>
    </div>
  );
}
