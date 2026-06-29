'use client';

import { useEffect, useRef, useState } from 'react';
import {
  X, RotateCcw, GripHorizontal, Trash2, Loader2,
  ImageIcon, Play, Shuffle, MonitorCog,
} from 'lucide-react';
import { GallerySettings, GalleryDisplayMode } from '@/types';
import { galleryTranslations } from '@/lib/publicTranslations';

type GalleryT = (typeof galleryTranslations)['he'];

// The GallerySettings fields the beam actually renders. Mirrors the editor.
export interface BeamPanelValues {
  displayMode: GalleryDisplayMode;
  displayLimit: number;
  gridColumns: number;
  headerHidden: boolean;
  showNames: boolean;
  fadeEffect: boolean;
  borderRadius: number;
  nameSize: number;
  flagSize: number;
  showNewBadge: boolean;
  displaySpeed: number;
  featureNewPhotos: boolean;
  minPinnedOnScreen: number;
  swapBatch: number;
}

interface Props {
  t: GalleryT;
  dir: 'rtl' | 'ltr';
  codeId: string;
  values: BeamPanelValues;
  onChange: (patch: Partial<GallerySettings>) => void;
  hasOverrides: boolean;
  onReset: () => void;
  onClose: () => void;
  isOwner: boolean;
  imageCount: number;
  deletingAll: boolean;
  onDeleteAll: () => void;
}

const posKey = (codeId: string) => `beam-panel-pos-${codeId}`;
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

function Slider({
  label, value, suffix, min, max, step = 1, onChange,
}: {
  label: string; value: number; suffix?: string; min: number; max: number; step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-white/60 shrink-0">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-28 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <span className="text-sm text-white/70 w-12 text-center tabular-nums">{value}{suffix}</span>
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center justify-between gap-3 w-full"
    >
      <span className="text-sm text-white/60">{label}</span>
      <span className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${value ? 'bg-blue-500' : 'bg-white/20'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 ${value ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

/**
 * Draggable, per-screen beam control panel. Edits are LOCAL to this browser
 * (saved by the parent to localStorage); the editor's gallerySettings is the
 * default, and Reset returns to it. Its drag position is isolated here so moving
 * the panel never re-renders the heavy beam grid.
 */
export default function BeamControlPanel({
  t, dir, codeId, values, onChange, hasOverrides, onReset, onClose,
  isOwner, imageCount, deletingAll, onDeleteAll,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 16, y: 72 };
    try {
      const raw = localStorage.getItem(posKey(codeId));
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p?.x === 'number' && typeof p?.y === 'number') return p;
      }
    } catch { /* ignore */ }
    const w = window.innerWidth;
    return { x: dir === 'rtl' ? 16 : Math.max(16, w - 346), y: 72 };
  });
  const posRef = useRef(pos);
  posRef.current = pos;

  // Keep the panel inside the viewport if the window is resized smaller.
  useEffect(() => {
    const onResize = () => {
      const el = panelRef.current;
      if (!el) return;
      setPos((p) => ({
        x: clamp(p.x, 8, Math.max(8, window.innerWidth - el.offsetWidth - 8)),
        y: clamp(p.y, 8, Math.max(8, window.innerHeight - 56)),
      }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const startDrag = (e: React.PointerEvent) => {
    const startX = e.clientX;
    const startY = e.clientY;
    const origin = posRef.current;
    const el = panelRef.current;
    const maxX = el ? Math.max(8, window.innerWidth - el.offsetWidth - 8) : window.innerWidth - 340;
    const maxY = Math.max(8, window.innerHeight - 56);
    let latest = origin; // track the final position locally so persistence never lags a render
    const move = (ev: PointerEvent) => {
      latest = {
        x: clamp(origin.x + (ev.clientX - startX), 8, maxX),
        y: clamp(origin.y + (ev.clientY - startY), 8, maxY),
      };
      setPos(latest);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      try { localStorage.setItem(posKey(codeId), JSON.stringify(latest)); } catch { /* ignore */ }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const isShuffle = values.displayMode === 'shuffle';

  const modeButtons: { mode: GalleryDisplayMode; icon: typeof ImageIcon; label: string }[] = [
    { mode: 'static', icon: ImageIcon, label: t.staticView },
    { mode: 'scroll', icon: Play, label: t.autoScroll },
    { mode: 'shuffle', icon: Shuffle, label: t.shuffleMode },
  ];

  return (
    <div
      ref={panelRef}
      dir={dir}
      className="fixed z-50 w-[330px] max-w-[calc(100vw-16px)] max-h-[85vh] overflow-y-auto rounded-2xl bg-black/90 backdrop-blur-md border border-white/15 shadow-2xl text-white"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Drag handle / header */}
      <div
        onPointerDown={startDrag}
        className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10 cursor-move select-none touch-none sticky top-0 bg-black/80 backdrop-blur-md rounded-t-2xl"
      >
        <div className="flex items-center gap-2">
          <MonitorCog className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold">{t.screenSettings}</span>
          <GripHorizontal className="w-4 h-4 text-white/30" />
        </div>
        <button
          onClick={onClose}
          aria-label={t.cancel}
          className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Display mode */}
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-wide text-white/40">{t.displayModeLabel}</span>
          <div className="flex gap-1.5">
            {modeButtons.map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => onChange({ displayMode: mode })}
                title={label}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm transition-colors ${
                  values.displayMode === mode ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-white/10" />

        {/* Sliders */}
        <div className="space-y-3">
          <Slider label={t.columns} value={values.gridColumns} min={2} max={8} onChange={(v) => onChange({ gridColumns: v })} />
          {isShuffle && (
            <Slider label={t.swapSpeed} value={values.displaySpeed} suffix={t.seconds} min={2} max={10} step={0.5} onChange={(v) => onChange({ displaySpeed: v })} />
          )}
          {isShuffle && (
            <Slider label={t.photosPerSwap} value={values.swapBatch} min={1} max={4} onChange={(v) => onChange({ swapBatch: v })} />
          )}
          <Slider label={t.roundCorners} value={values.borderRadius} suffix="%" min={0} max={50} onChange={(v) => onChange({ borderRadius: v })} />
          <Slider label={t.flagSizeLabel} value={values.flagSize} suffix="%" min={25} max={400} step={5} onChange={(v) => onChange({ flagSize: v })} />
          <Slider label={t.nameTextSize} value={values.nameSize} suffix="px" min={10} max={48} onChange={(v) => onChange({ nameSize: v })} />
          {isShuffle && (
            <Slider label={t.minPinned} value={values.minPinnedOnScreen} min={0} max={5} onChange={(v) => onChange({ minPinnedOnScreen: v })} />
          )}
        </div>

        {/* Photos shown (rolling window) */}
        <div className="space-y-2">
          <span className="text-sm text-white/60">{t.imageCount}</span>
          <div className="flex flex-wrap gap-1.5">
            {[0, 50, 100, 200, 300, 400].map((limit) => (
              <button
                key={limit}
                onClick={() => onChange({ displayLimit: limit })}
                className={`px-2.5 py-1 text-sm rounded-lg transition-colors ${
                  values.displayLimit === limit ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                {limit === 0 ? t.all : limit}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-white/10" />

        {/* Toggles */}
        <div className="space-y-3">
          <Toggle label={t.showNamesOnImages} value={values.showNames} onChange={(v) => onChange({ showNames: v })} />
          <Toggle label={t.subtleMotion} value={values.fadeEffect} onChange={(v) => onChange({ fadeEffect: v })} />
          <Toggle label={t.showNewBadge} value={values.showNewBadge} onChange={(v) => onChange({ showNewBadge: v })} />
          {isShuffle && (
            <Toggle label={t.featureNew} value={values.featureNewPhotos} onChange={(v) => onChange({ featureNewPhotos: v })} />
          )}
          <Toggle label={t.hideHeader} value={values.headerHidden} onChange={(v) => onChange({ headerHidden: v })} />
        </div>

        <div className="h-px bg-white/10" />

        {/* Reset + local hint */}
        <div className="space-y-2">
          <button
            onClick={onReset}
            disabled={!hasOverrides}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
              hasOverrides ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white/5 text-white/30 cursor-default'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            {t.resetToDefault}
          </button>
          {hasOverrides && (
            <p className="text-xs text-blue-300 text-center">{t.localOverrideActive}</p>
          )}
          <p className="text-[11px] text-white/40 leading-snug text-center">{t.localScreenHint}</p>
        </div>

        {/* Owner-only: image count + delete all */}
        {isOwner && (
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
            <span className="text-xs text-white/40">{imageCount} {t.images}</span>
            {imageCount > 0 && (
              <button
                onClick={onDeleteAll}
                disabled={deletingAll}
                title={t.deleteAllImages}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs transition-colors disabled:opacity-50"
              >
                {deletingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {t.deleteAll}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
