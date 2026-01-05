'use client';

import { Clock, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface PendingReplacementBadgeProps {
  scheduledAt: Date;
  onCancel?: () => void;
  locale?: 'he' | 'en';
  compact?: boolean;
}

export default function PendingReplacementBadge({
  scheduledAt,
  onCancel,
  locale = 'he',
  compact = false,
}: PendingReplacementBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const t = useTranslations('modals');

  const formatShortDate = (date: Date) => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    if (isToday) {
      return locale === 'he' ? 'היום' : 'Today';
    }
    if (isTomorrow) {
      return locale === 'he' ? 'מחר' : 'Tomorrow';
    }

    return date.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(locale === 'he' ? 'he-IL' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFullDate = (date: Date) => {
    return date.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (compact) {
    return (
      <div
        className="relative inline-flex items-center gap-1 px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-xs"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Clock className="w-3 h-3 text-purple-500" />
        <span className="text-purple-500 font-medium">
          {formatShortDate(scheduledAt)} {formatTime(scheduledAt)}
        </span>

        {onCancel && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            className="p-0.5 hover:bg-purple-500/20 rounded-full transition-colors"
          >
            <X className="w-3 h-3 text-purple-500" />
          </button>
        )}

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-bg-card border border-border rounded-lg shadow-lg whitespace-nowrap z-10">
            <p className="text-xs text-text-secondary">{t('scheduledFor')}</p>
            <p className="text-sm font-medium text-text-primary">
              {formatFullDate(scheduledAt)}
            </p>
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
              <div className="w-2 h-2 bg-bg-card border-r border-b border-border transform rotate-45" />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative flex items-center gap-2 px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-xl"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
        <Clock className="w-4 h-4 text-purple-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-purple-500 font-medium">{t('scheduledFor')}</p>
        <p className="text-sm text-text-primary font-semibold">
          {formatShortDate(scheduledAt)} • {formatTime(scheduledAt)}
        </p>
      </div>

      {onCancel && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          className="p-1.5 hover:bg-purple-500/20 rounded-lg transition-colors"
          title={t('cancelScheduledReplacement')}
        >
          <X className="w-4 h-4 text-purple-500" />
        </button>
      )}

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-bg-card border border-border rounded-lg shadow-lg whitespace-nowrap z-10">
          <p className="text-sm font-medium text-text-primary">
            {formatFullDate(scheduledAt)}
          </p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
            <div className="w-2 h-2 bg-bg-card border-r border-b border-border transform rotate-45" />
          </div>
        </div>
      )}
    </div>
  );
}
