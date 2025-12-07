'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface DeleteConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
}

export default function DeleteConfirm({
  isOpen,
  onClose,
  onConfirm,
  title,
}: DeleteConfirmProps) {
  const [inputValue, setInputValue] = useState('');
  const t = useTranslations('modals');
  const tCommon = useTranslations('common');
  const confirmWord = t('deleteConfirmWord');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (inputValue === confirmWord) {
      onConfirm();
      setInputValue('');
    }
  };

  const handleClose = () => {
    setInputValue('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 modal-backdrop"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-bg-card border border-border rounded-xl shadow-2xl">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 start-4 p-1 rounded-lg hover:bg-bg-hover transition-colors"
        >
          <X className="w-5 h-5 text-text-secondary" />
        </button>

        <div className="p-6">
          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-danger" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-text-primary text-center mb-2">
            {t('deleteCode')}
          </h2>

          {/* Message */}
          <div className="text-center text-text-secondary mb-6">
            <p className="mb-2">
              {t('aboutToDelete')} <strong className="text-text-primary">{title}</strong>
            </p>
            <p className="text-sm text-danger">
              {t('deleteWarning')}
            </p>
          </div>

          {/* Confirmation input */}
          <div className="mb-6">
            <label className="block text-sm text-text-secondary mb-2">
              {t('typeToConfirm', { word: '' })} <strong className="text-danger">{confirmWord}</strong>
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={confirmWord}
              className="input text-center"
              autoFocus
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="btn btn-secondary flex-1"
            >
              {tCommon('cancel')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={inputValue !== confirmWord}
              className="btn btn-danger flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {tCommon('deleteForever')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
