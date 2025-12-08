'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Clock } from 'lucide-react';
import { MediaSchedule } from '@/types';
import { useTranslations } from 'next-intl';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (schedule: MediaSchedule | undefined) => void;
  currentSchedule?: MediaSchedule;
}

// Helper to get current time rounded to next 5 minutes
const getCurrentTimeRounded = (): string => {
  const now = new Date();
  const minutes = Math.ceil(now.getMinutes() / 5) * 5;
  now.setMinutes(minutes);
  now.setSeconds(0);
  return now.toTimeString().slice(0, 5);
};

// Helper to get end of day time
const getEndOfDayTime = (): string => {
  return '23:59';
};

// Helper to get today's date in input format
const getTodayDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

export default function ScheduleModal({
  isOpen,
  onClose,
  onSave,
  currentSchedule,
}: ScheduleModalProps) {
  const [enabled, setEnabled] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const t = useTranslations('modals');
  const tCommon = useTranslations('common');

  useEffect(() => {
    if (currentSchedule) {
      setEnabled(currentSchedule.enabled);
      setStartDate(currentSchedule.startDate ? formatDateForInput(currentSchedule.startDate) : '');
      setEndDate(currentSchedule.endDate ? formatDateForInput(currentSchedule.endDate) : '');
      setStartTime(currentSchedule.startTime || '');
      setEndTime(currentSchedule.endTime || '');
    } else {
      setEnabled(false);
      setStartDate('');
      setEndDate('');
      setStartTime('');
      setEndTime('');
    }
  }, [currentSchedule, isOpen]);

  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // When start date is selected, auto-set end date and times
  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    if (value && !endDate) {
      // Set end date to same day
      setEndDate(value);
    }
    if (value && !startTime) {
      // Set start time to current time (rounded)
      setStartTime(getCurrentTimeRounded());
    }
    if (value && !endTime) {
      // Set end time to end of day
      setEndTime(getEndOfDayTime());
    }
  };

  const handleSave = () => {
    if (!enabled) {
      onSave(undefined);
    } else {
      const schedule: MediaSchedule = {
        enabled: true,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
      };
      onSave(schedule);
    }
    onClose();
  };

  const handleClear = () => {
    setEnabled(false);
    setStartDate('');
    setEndDate('');
    setStartTime('');
    setEndTime('');
    onSave(undefined);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-bg-card border border-border rounded-2xl p-4 sm:p-6 w-full max-w-md mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-text-primary">{t('schedule')}</h2>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-bg-secondary transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Enable toggle */}
        <div className="flex items-center justify-between mb-4 sm:mb-6 p-3 sm:p-4 bg-bg-secondary rounded-xl">
          <span className="text-sm sm:text-base text-text-primary font-medium">{t('scheduleEnable')}</span>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
              enabled ? 'bg-accent' : 'bg-border'
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                enabled ? 'end-1' : 'start-1'
              }`}
            />
          </button>
        </div>

        {enabled && (
          <div className="space-y-3 sm:space-y-4">
            {/* Date range */}
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center gap-2 text-text-secondary">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium">{t('scheduleDateRange')}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className="block text-[10px] sm:text-xs text-text-secondary mb-1">{t('scheduleFromDate')}</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    min={getTodayDate()}
                    className="input w-full text-xs sm:text-sm px-2 py-1.5 sm:px-3 sm:py-2"
                  />
                </div>
                <div>
                  <label className={`block text-[10px] sm:text-xs mb-1 ${!startDate ? 'text-text-secondary/50' : 'text-text-secondary'}`}>{t('scheduleToDate')}</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || getTodayDate()}
                    disabled={!startDate}
                    className={`input w-full text-xs sm:text-sm px-2 py-1.5 sm:px-3 sm:py-2 ${!startDate ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                </div>
              </div>
            </div>

            {/* Time range */}
            <div className="space-y-2 sm:space-y-3">
              <div className={`flex items-center gap-2 ${!startDate ? 'text-text-secondary/50' : 'text-text-secondary'}`}>
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium">{t('scheduleTimeRange')}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className={`block text-[10px] sm:text-xs mb-1 ${!startDate ? 'text-text-secondary/50' : 'text-text-secondary'}`}>{t('scheduleFromTime')}</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    disabled={!startDate}
                    className={`input w-full text-xs sm:text-sm px-2 py-1.5 sm:px-3 sm:py-2 ${!startDate ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                </div>
                <div>
                  <label className={`block text-[10px] sm:text-xs mb-1 ${!startDate ? 'text-text-secondary/50' : 'text-text-secondary'}`}>{t('scheduleToTime')}</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    disabled={!startDate}
                    className={`input w-full text-xs sm:text-sm px-2 py-1.5 sm:px-3 sm:py-2 ${!startDate ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                </div>
              </div>
            </div>

            <p className="text-[10px] sm:text-xs text-text-secondary">
              {!startDate ? t('scheduleSelectStartDate') : t('scheduleMediaWillShow')}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
          <button
            onClick={handleSave}
            className="btn btn-primary flex-1 text-sm sm:text-base py-2 sm:py-2.5"
          >
            {tCommon('save')}
          </button>
          <button
            onClick={handleClear}
            className="btn bg-bg-secondary text-text-primary hover:bg-bg-hover flex-1 text-sm sm:text-base py-2 sm:py-2.5"
          >
            {t('scheduleClear')}
          </button>
        </div>
      </div>
    </div>
  );
}
