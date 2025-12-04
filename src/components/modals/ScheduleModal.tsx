'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Clock } from 'lucide-react';
import { MediaSchedule } from '@/types';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (schedule: MediaSchedule | undefined) => void;
  currentSchedule?: MediaSchedule;
}

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
      <div className="relative bg-bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-text-primary">תזמון מדיה</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-bg-secondary transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Enable toggle */}
        <div className="flex items-center justify-between mb-6 p-4 bg-bg-secondary rounded-xl">
          <span className="text-text-primary font-medium">הפעל תזמון</span>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              enabled ? 'bg-accent' : 'bg-border'
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                enabled ? 'right-1' : 'right-7'
              }`}
            />
          </button>
        </div>

        {enabled && (
          <div className="space-y-4">
            {/* Date range */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-text-secondary">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">טווח תאריכים</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">מתאריך</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">עד תאריך</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input w-full text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Time range */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-text-secondary">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">טווח שעות (יומי)</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">משעה</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="input w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">עד שעה</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="input w-full text-sm"
                  />
                </div>
              </div>
            </div>

            <p className="text-xs text-text-secondary">
              המדיה תוצג רק בטווח התאריכים והשעות שנבחרו
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleClear}
            className="btn bg-bg-secondary text-text-primary hover:bg-bg-hover flex-1"
          >
            נקה
          </button>
          <button
            onClick={handleSave}
            className="btn btn-primary flex-1"
          >
            שמור
          </button>
        </div>
      </div>
    </div>
  );
}
