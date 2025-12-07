'use client';

import { useState, useEffect } from 'react';
import { X, Link as LinkIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface AddLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (linkUrl: string, title?: string) => void;
  loading?: boolean;
}

export default function AddLinkModal({
  isOpen,
  onClose,
  onSave,
  loading = false,
}: AddLinkModalProps) {
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
      setError(t('addLinkUrlRequired'));
      return;
    }

    // Ensure URL has protocol
    let finalUrl = trimmedUrl;
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      finalUrl = 'https://' + trimmedUrl;
    }

    // Basic URL validation
    try {
      new URL(finalUrl);
    } catch {
      setError(t('addLinkInvalidUrl'));
      return;
    }

    onSave(finalUrl, title.trim() || undefined);
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
            <LinkIcon className="w-5 h-5 text-accent" />
            {t('addLink')}
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
          {t('addLinkDescription')}
        </p>

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
              {t('addLinkUrl')} <span className="text-danger">{t('required')}</span>
            </label>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => {
                setLinkUrl(e.target.value);
                setError('');
              }}
              placeholder="https://example.com"
              className="input w-full"
              dir="ltr"
              autoFocus
            />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              {t('addLinkTitle')} <span className="text-text-secondary font-normal">({t('optional')})</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('addLinkTitlePlaceholder')}
              className="input w-full"
            />
            <p className="text-xs text-text-secondary">
              {t('addLinkTitleNote')}
            </p>
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
