'use client';

import { useState, useEffect } from 'react';
import { X, Cloud, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface WordCloudModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (linkUrl: string, title?: string) => void;
  loading?: boolean;
}

export default function WordCloudModal({
  isOpen,
  onClose,
  onSave,
  loading = false,
}: WordCloudModalProps) {
  const [linkUrl, setLinkUrl] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  const t = useTranslations('modals');
  const tCommon = useTranslations('common');

  useEffect(() => {
    if (isOpen) {
      setLinkUrl('');
      setTitle('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmedUrl = linkUrl.trim();

    if (!trimmedUrl) {
      setError(t('wordCloudLinkRequired'));
      return;
    }

    // Ensure URL has protocol
    let finalUrl = trimmedUrl;
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      finalUrl = 'https://' + trimmedUrl;
    }

    // Validate URL format
    try {
      new URL(finalUrl);
    } catch {
      setError(t('wordCloudInvalidUrl'));
      return;
    }

    // Validate it's a QuizyCloud URL
    if (!finalUrl.includes('quizycloud.playzones.app')) {
      setError(t('wordCloudOnlyQuizyCloud'));
      return;
    }

    onSave(finalUrl, title.trim() || undefined);
  };

  const openQuizyCloud = () => {
    window.open('https://quizycloud.playzones.app', '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Cloud className="w-5 h-5 text-accent" />
            {t('wordCloud')}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-text-secondary">
          {t('wordCloudDescription')}
        </p>

        {/* QuizyCloud Button */}
        <button
          onClick={openQuizyCloud}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-bg-secondary hover:bg-bg-hover rounded-xl text-text-primary font-medium transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          {t('wordCloudOpenQuizyCloud')}
        </button>

        {/* Error */}
        {error && (
          <p className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        {/* Form */}
        <div className="space-y-4">
          {/* Link URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              {t('wordCloudLinkLabel')} <span className="text-danger">{t('required')}</span>
            </label>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => {
                setLinkUrl(e.target.value);
                setError('');
              }}
              placeholder="https://quizycloud.playzones.app/..."
              className="input w-full"
              dir="ltr"
              autoFocus
            />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              {t('wordCloudTitleLabel')} <span className="text-text-secondary font-normal">({t('optional')})</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('wordCloudTitlePlaceholder')}
              className="input w-full"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="btn bg-bg-secondary text-text-primary hover:bg-bg-hover disabled:opacity-50"
          >
            {tCommon('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !linkUrl.trim()}
            className="btn bg-accent text-white hover:bg-accent-hover disabled:opacity-50 min-w-[80px]"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              tCommon('add')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
