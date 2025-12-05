'use client';

import { clsx } from 'clsx';
import { Calendar } from 'lucide-react';
import { DateRangePreset } from '@/types';

interface DateRangePickerProps {
  preset: DateRangePreset;
  customStart?: Date;
  customEnd?: Date;
  onPresetChange: (preset: DateRangePreset) => void;
  onCustomRangeChange: (start: Date, end: Date) => void;
}

const presetOptions: { value: DateRangePreset; label: string }[] = [
  { value: 'today', label: 'היום' },
  { value: 'week', label: 'שבוע' },
  { value: 'month', label: 'חודש' },
  { value: 'year', label: 'שנה' },
  { value: 'custom', label: 'מותאם' },
];

export default function DateRangePicker({
  preset,
  customStart,
  customEnd,
  onPresetChange,
  onCustomRangeChange,
}: DateRangePickerProps) {
  const formatDateForInput = (date: Date | undefined): string => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = new Date(e.target.value);
    const end = customEnd || new Date();
    onCustomRangeChange(newStart, end);
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = new Date(e.target.value);
    const start = customStart || new Date();
    onCustomRangeChange(start, newEnd);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Preset Buttons */}
      <div className="flex rounded-lg border border-border overflow-hidden overflow-x-auto">
        {presetOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => onPresetChange(option.value)}
            className={clsx(
              'px-3 sm:px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap flex-1 sm:flex-none',
              preset === option.value
                ? 'bg-accent text-white'
                : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover hover:text-text-primary'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Custom Date Inputs - stacked on mobile, inline on desktop */}
      {preset === 'custom' && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-text-secondary text-sm w-12 sm:hidden">מתאריך</span>
            <div className="relative flex-1">
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
              <input
                type="date"
                value={formatDateForInput(customStart)}
                onChange={handleStartChange}
                max={formatDateForInput(customEnd) || formatDateForInput(new Date())}
                className="w-full pr-10 pl-4 py-2 rounded-lg bg-bg-secondary border border-border text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>
          <span className="text-text-secondary hidden sm:inline">עד</span>
          <div className="flex items-center gap-2">
            <span className="text-text-secondary text-sm w-12 sm:hidden">עד תאריך</span>
            <div className="relative flex-1">
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
              <input
                type="date"
                value={formatDateForInput(customEnd)}
                onChange={handleEndChange}
                min={formatDateForInput(customStart)}
                max={formatDateForInput(new Date())}
                className="w-full pr-10 pl-4 py-2 rounded-lg bg-bg-secondary border border-border text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
