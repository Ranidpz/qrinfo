'use client';

import { useState, useCallback, useEffect } from 'react';
import { X, RotateCcw, BookOpen, Volume2, Zap, MousePointer2, Download, Play, Layers, Move } from 'lucide-react';
import { PDFFlipbookSettings } from '@/types';

// Re-export for convenience
export type { PDFFlipbookSettings };

// Default settings
export const DEFAULT_PDF_SETTINGS: PDFFlipbookSettings = {
  pagemode: '2',
  direction: '2',
  webgl: true,
  soundenable: true,
  duration: 800,
  zoomratio: 1.5,
  autoplay: false,
  controls: 'auto',
  scrollwheel: true,
  hard: 'cover',
  enabledownload: false,
};

interface PDFSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PDFFlipbookSettings;
  onSave: (settings: PDFFlipbookSettings) => void;
}

// Custom Toggle Switch Component
const ToggleSwitch = ({
  checked,
  onChange,
  label,
  icon: Icon
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  icon?: React.ElementType;
}) => (
  <label className="group flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] transition-all duration-200 cursor-pointer">
    <div className="flex items-center gap-3">
      {Icon && (
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
          <Icon className="w-4 h-4 text-white/60" />
        </div>
      )}
      <span className="text-white/80 text-sm font-medium">{label}</span>
    </div>
    <div
      className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
        checked
          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/25'
          : 'bg-white/10'
      }`}
      onClick={() => onChange(!checked)}
    >
      <div
        className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-300 ${
          checked ? 'right-1' : 'left-1'
        }`}
      />
    </div>
  </label>
);

// Custom Slider Component
const Slider = ({
  value,
  onChange,
  min,
  max,
  step,
  label,
  icon: Icon,
  suffix = ''
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  label: string;
  icon?: React.ElementType;
  suffix?: string;
}) => {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="py-3 px-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
              <Icon className="w-4 h-4 text-white/60" />
            </div>
          )}
          <span className="text-white/80 text-sm font-medium">{label}</span>
        </div>
        <span className="text-white font-mono text-sm bg-white/10 px-2 py-0.5 rounded-md">
          {value}{suffix}
        </span>
      </div>
      <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-150"
          style={{ width: `${percentage}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
      <div className="flex justify-between mt-1.5 text-[10px] text-white/30 font-mono">
        <span>{min}{suffix}</span>
        <span>{max}{suffix}</span>
      </div>
    </div>
  );
};

// Custom Select Component
const Select = ({
  value,
  onChange,
  options,
  label,
  icon: Icon
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
  icon?: React.ElementType;
}) => (
  <div className="py-3 px-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
    <div className="flex items-center gap-3 mb-3">
      {Icon && (
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
          <Icon className="w-4 h-4 text-white/60" />
        </div>
      )}
      <span className="text-white/80 text-sm font-medium">{label}</span>
    </div>
    <div className="flex gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
            value === option.value
              ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-white border border-blue-500/40'
              : 'bg-white/5 text-white/50 border border-transparent hover:bg-white/10 hover:text-white/70'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>
);

export default function PDFSettingsModal({
  isOpen,
  onClose,
  settings,
  onSave,
}: PDFSettingsModalProps) {
  const [localSettings, setLocalSettings] = useState<PDFFlipbookSettings>(settings);

  // Sync local state when settings prop changes (e.g., when modal opens)
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const updateSetting = useCallback(<K extends keyof PDFFlipbookSettings>(
    key: K,
    value: PDFFlipbookSettings[K]
  ) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleReset = useCallback(() => {
    setLocalSettings(DEFAULT_PDF_SETTINGS);
  }, []);

  const handleSave = useCallback(() => {
    console.log('[PDFSettingsModal] Saving settings:', localSettings);
    onSave(localSettings);
    onClose();
  }, [localSettings, onSave, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      dir="rtl"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-hidden rounded-2xl bg-gradient-to-b from-gray-800 to-gray-900 border border-white/10 shadow-2xl shadow-black/50">
        {/* Decorative gradient */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-blue-500/10 to-transparent pointer-events-none" />

        {/* Header */}
        <div className="relative flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">הגדרות חוברת דיגיטלית</h2>
              <p className="text-xs text-white/40">התאם אישית את תצוגת ה-PDF</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* Content */}
        <div className="relative p-5 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {/* Display Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider px-1">תצוגה</h3>

            <Select
              value={localSettings.pagemode}
              onChange={(v) => updateSetting('pagemode', v as '1' | '2')}
              options={[
                { value: '2', label: 'שני עמודים' },
                { value: '1', label: 'עמוד בודד' },
              ]}
              label="מצב תצוגה"
              icon={Layers}
            />

            <Select
              value={localSettings.direction}
              onChange={(v) => updateSetting('direction', v as '1' | '2')}
              options={[
                { value: '2', label: 'ימין לשמאל (RTL)' },
                { value: '1', label: 'שמאל לימין (LTR)' },
              ]}
              label="כיוון קריאה"
              icon={Move}
            />

            <Select
              value={localSettings.hard}
              onChange={(v) => updateSetting('hard', v as 'cover' | 'none')}
              options={[
                { value: 'cover', label: 'כריכה קשה' },
                { value: 'none', label: 'ללא כריכה' },
              ]}
              label="סוג כריכה"
              icon={BookOpen}
            />
          </div>

          {/* Effects Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider px-1">אפקטים</h3>

            <ToggleSwitch
              checked={localSettings.webgl}
              onChange={(v) => updateSetting('webgl', v)}
              label="אפקט תלת-מימדי (WebGL)"
              icon={Zap}
            />

            <ToggleSwitch
              checked={localSettings.soundenable}
              onChange={(v) => updateSetting('soundenable', v)}
              label="צליל דפדוף"
              icon={Volume2}
            />

            <Slider
              value={localSettings.duration}
              onChange={(v) => updateSetting('duration', v)}
              min={300}
              max={1200}
              step={100}
              label="מהירות דפדוף"
              suffix="ms"
            />
          </div>

          {/* Interaction Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider px-1">אינטראקציה</h3>

            <Slider
              value={localSettings.zoomratio}
              onChange={(v) => updateSetting('zoomratio', v)}
              min={1}
              max={3}
              step={0.5}
              label="יחס זום מקסימלי"
              suffix="x"
            />

            <ToggleSwitch
              checked={localSettings.scrollwheel}
              onChange={(v) => updateSetting('scrollwheel', v)}
              label="ניווט עם גלגלת העכבר"
              icon={MousePointer2}
            />

            <Select
              value={localSettings.controls}
              onChange={(v) => updateSetting('controls', v as 'auto' | 'true' | 'false')}
              options={[
                { value: 'auto', label: 'אוטומטי' },
                { value: 'true', label: 'תמיד' },
                { value: 'false', label: 'לעולם לא' },
              ]}
              label="הצגת פקדים"
            />
          </div>

          {/* Playback Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider px-1">ניגון</h3>

            <ToggleSwitch
              checked={localSettings.autoplay}
              onChange={(v) => updateSetting('autoplay', v)}
              label="ניגון אוטומטי"
              icon={Play}
            />

            <ToggleSwitch
              checked={localSettings.enabledownload}
              onChange={(v) => updateSetting('enabledownload', v)}
              label="אפשר הורדה"
              icon={Download}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="relative p-5 border-t border-white/10 bg-black/20">
          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 text-sm font-medium transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>איפוס</span>
            </button>

            <div className="flex-1" />

            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-sm font-medium transition-all"
            >
              ביטול
            </button>

            <button
              onClick={handleSave}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-sm font-semibold shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40"
            >
              שמור הגדרות
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
