'use client';

import { X, RefreshCw, Clock, FileText, Image, Video, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ReplaceMediaOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReplaceNow: () => void;
  onScheduleReplacement: () => void;
  currentMediaType?: string;
  currentFileName?: string;
  newFileName?: string;
  hasExistingScheduledReplacement?: boolean;
  existingScheduledDate?: Date;
}

export default function ReplaceMediaOptionsModal({
  isOpen,
  onClose,
  onReplaceNow,
  onScheduleReplacement,
  currentMediaType,
  currentFileName,
  newFileName,
  hasExistingScheduledReplacement,
  existingScheduledDate,
}: ReplaceMediaOptionsModalProps) {
  const t = useTranslations('modals');
  const tCommon = useTranslations('common');

  if (!isOpen) return null;

  const getMediaIcon = (type?: string) => {
    switch (type) {
      case 'pdf':
        return <FileText className="w-5 h-5" />;
      case 'video':
        return <Video className="w-5 h-5" />;
      default:
        return <Image className="w-5 h-5" />;
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-accent" />
            </div>
            <h2 className="text-lg font-bold text-text-primary">{t('replaceOptions')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-bg-secondary transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* File info */}
        <div className="space-y-3 mb-6">
          {currentFileName && (
            <div className="flex items-center gap-3 p-3 bg-bg-secondary rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
                {getMediaIcon(currentMediaType)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-text-secondary">{t('replaceMediaCurrent')}</p>
                <p className="text-sm text-text-primary truncate" dir="ltr">
                  {currentFileName}
                </p>
              </div>
            </div>
          )}

          {newFileName && (
            <div className="flex items-center gap-3 p-3 bg-bg-secondary rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-text-secondary">{t('replaceMediaNew')}</p>
                <p className="text-sm text-text-primary truncate" dir="ltr">
                  {newFileName}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Warning if there's existing scheduled replacement */}
        {hasExistingScheduledReplacement && existingScheduledDate && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-text-primary">
                {t('existingScheduledReplacement', { date: formatDate(existingScheduledDate) })}
              </p>
            </div>
          </div>
        )}

        {/* Options */}
        <div className="space-y-3">
          {/* Replace Now */}
          <button
            onClick={() => {
              onReplaceNow();
              onClose();
            }}
            className="w-full flex items-center gap-4 p-4 bg-bg-secondary hover:bg-bg-hover rounded-xl transition-colors text-start"
          >
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-accent" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-text-primary">{t('replaceNow')}</p>
              <p className="text-sm text-text-secondary">{t('replaceNowDesc')}</p>
            </div>
          </button>

          {/* Schedule Replacement */}
          <button
            onClick={() => {
              onScheduleReplacement();
              onClose();
            }}
            className="w-full flex items-center gap-4 p-4 bg-bg-secondary hover:bg-bg-hover rounded-xl transition-colors text-start"
          >
            <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center">
              <Clock className="w-6 h-6 text-purple-500" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-text-primary">{t('scheduleReplacement')}</p>
              <p className="text-sm text-text-secondary">{t('scheduleReplacementDesc')}</p>
            </div>
          </button>
        </div>

        {/* Cancel */}
        <button
          onClick={onClose}
          className="w-full mt-4 btn bg-bg-secondary text-text-primary hover:bg-bg-hover"
        >
          {tCommon('cancel')}
        </button>
      </div>
    </div>
  );
}
