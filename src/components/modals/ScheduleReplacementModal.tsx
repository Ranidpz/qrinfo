'use client';

import { useState } from 'react';
import { X, Clock, Calendar, Sunrise, Timer, CalendarDays, Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

type PresetType = 'tomorrow_morning' | 'in_24_hours' | 'next_week' | 'custom';

interface ScheduleReplacementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (scheduledAt: Date) => void;
  currentFileName?: string;
  newFileName?: string;
  loading?: boolean;
}

// Helper to get tomorrow at 8:00 AM
const getTomorrowMorning = (): Date => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);
  return tomorrow;
};

// Helper to get 24 hours from now
const getIn24Hours = (): Date => {
  const date = new Date();
  date.setTime(date.getTime() + 24 * 60 * 60 * 1000);
  return date;
};

// Helper to get next week same time
const getNextWeek = (): Date => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date;
};

// Helper to get today's date in input format
const getTodayDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

// Helper to get current time rounded to next 5 minutes
const getCurrentTimeRounded = (): string => {
  const now = new Date();
  const minutes = Math.ceil(now.getMinutes() / 5) * 5;
  now.setMinutes(minutes);
  now.setSeconds(0);
  return now.toTimeString().slice(0, 5);
};

export default function ScheduleReplacementModal({
  isOpen,
  onClose,
  onSchedule,
  currentFileName,
  newFileName,
  loading,
}: ScheduleReplacementModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<PresetType | null>(null);
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);

  const t = useTranslations('modals');
  const tCommon = useTranslations('common');

  if (!isOpen) return null;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('he-IL', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handlePresetSelect = (preset: PresetType) => {
    setSelectedPreset(preset);

    if (preset === 'custom') {
      setScheduledDate(null);
      // Pre-fill with tomorrow and current time
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setCustomDate(tomorrow.toISOString().split('T')[0]);
      setCustomTime(getCurrentTimeRounded());
    } else {
      let date: Date;
      switch (preset) {
        case 'tomorrow_morning':
          date = getTomorrowMorning();
          break;
        case 'in_24_hours':
          date = getIn24Hours();
          break;
        case 'next_week':
          date = getNextWeek();
          break;
        default:
          return;
      }
      setScheduledDate(date);
      setCustomDate('');
      setCustomTime('');
    }
  };

  const handleCustomDateChange = (date: string) => {
    setCustomDate(date);
    if (date && customTime) {
      const [hours, minutes] = customTime.split(':').map(Number);
      const newDate = new Date(date);
      newDate.setHours(hours, minutes, 0, 0);
      setScheduledDate(newDate);
    }
  };

  const handleCustomTimeChange = (time: string) => {
    setCustomTime(time);
    if (customDate && time) {
      const [hours, minutes] = time.split(':').map(Number);
      const newDate = new Date(customDate);
      newDate.setHours(hours, minutes, 0, 0);
      setScheduledDate(newDate);
    }
  };

  const handleConfirm = () => {
    if (scheduledDate) {
      onSchedule(scheduledDate);
      onClose();
    }
  };

  const presets = [
    {
      id: 'tomorrow_morning' as PresetType,
      icon: Sunrise,
      label: t('scheduleTomorrowMorning'),
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      id: 'in_24_hours' as PresetType,
      icon: Timer,
      label: t('scheduleIn24Hours'),
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      id: 'next_week' as PresetType,
      icon: CalendarDays,
      label: t('scheduleNextWeek'),
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      id: 'custom' as PresetType,
      icon: Settings2,
      label: t('scheduleCustom'),
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-purple-500" />
            </div>
            <h2 className="text-lg font-bold text-text-primary">{t('scheduleReplacement')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-bg-secondary transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* File info */}
        {(currentFileName || newFileName) && (
          <div className="p-3 bg-bg-secondary rounded-xl mb-6">
            <p className="text-xs text-text-secondary mb-1">{t('replaceMediaNew')}</p>
            <p className="text-sm text-text-primary truncate font-medium" dir="ltr">
              {newFileName || currentFileName}
            </p>
          </div>
        )}

        {/* Presets grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {presets.map((preset) => {
            const Icon = preset.icon;
            const isSelected = selectedPreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handlePresetSelect(preset.id)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-accent bg-accent/5'
                    : 'border-transparent bg-bg-secondary hover:bg-bg-hover'
                }`}
              >
                <div className={`w-10 h-10 rounded-full ${preset.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${preset.color}`} />
                </div>
                <span className="text-sm font-medium text-text-primary text-center">
                  {preset.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Custom date/time picker */}
        {selectedPreset === 'custom' && (
          <div className="space-y-4 mb-6 p-4 bg-bg-secondary rounded-xl">
            <div className="flex items-center gap-2 text-text-secondary mb-2">
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-medium">{t('scheduleDateRange')}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1">{t('scheduleDate')}</label>
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => handleCustomDateChange(e.target.value)}
                  min={getTodayDate()}
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">{t('scheduleTime')}</label>
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => handleCustomTimeChange(e.target.value)}
                  className="input w-full text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* Preview */}
        {scheduledDate && (
          <div className="p-4 bg-accent/5 border border-accent/20 rounded-xl mb-6">
            <p className="text-sm text-text-primary text-center">
              {t('scheduleWillReplace')}
            </p>
            <p className="text-lg font-bold text-accent text-center mt-1">
              {formatDate(scheduledDate)}
            </p>
            <p className="text-lg font-bold text-accent text-center">
              {formatTime(scheduledDate)}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="btn bg-bg-secondary text-text-primary hover:bg-bg-hover flex-1"
            disabled={loading}
          >
            {tCommon('cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!scheduledDate || loading}
            className="btn btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              t('scheduleConfirm')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
