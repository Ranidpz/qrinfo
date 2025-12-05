'use client';

import { useState, useEffect } from 'react';
import { X, Link as LinkIcon, Trash2 } from 'lucide-react';

interface MediaLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (linkUrl: string | undefined, linkTitle: string | undefined) => void;
  currentLinkUrl?: string;
  currentLinkTitle?: string;
}

export default function MediaLinkModal({
  isOpen,
  onClose,
  onSave,
  currentLinkUrl,
  currentLinkTitle,
}: MediaLinkModalProps) {
  const [linkUrl, setLinkUrl] = useState(currentLinkUrl || '');
  const [linkTitle, setLinkTitle] = useState(currentLinkTitle || '');

  // Update state when modal opens with new values
  useEffect(() => {
    if (isOpen) {
      setLinkUrl(currentLinkUrl || '');
      setLinkTitle(currentLinkTitle || '');
    }
  }, [isOpen, currentLinkUrl, currentLinkTitle]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmedUrl = linkUrl.trim();
    const trimmedTitle = linkTitle.trim();

    // If URL is empty, remove the link
    if (!trimmedUrl) {
      onSave(undefined, undefined);
    } else {
      // Ensure URL has protocol
      let finalUrl = trimmedUrl;
      if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
        finalUrl = 'https://' + trimmedUrl;
      }
      onSave(finalUrl, trimmedTitle || undefined);
    }
    onClose();
  };

  const handleRemoveLink = () => {
    onSave(undefined, undefined);
    onClose();
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
            לינק למדיה
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
          הוסף לינק שיופיע ככפתור כשהמשתמש יקליק על התמונה. המשתמש יוכל לבחור אם לפתוח את הלינק או להמשיך לצפות.
        </p>

        {/* Form */}
        <div className="space-y-4">
          {/* Link URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              כתובת הלינק
            </label>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              className="input w-full"
              dir="ltr"
            />
          </div>

          {/* Link Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              שם הכפתור <span className="text-text-secondary font-normal">(אופציונלי)</span>
            </label>
            <input
              type="text"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              placeholder="לחץ כאן לפרטים נוספים"
              className="input w-full"
            />
            <p className="text-xs text-text-secondary">
              אם לא יוזן שם, יוצג הדומיין של הלינק
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          {currentLinkUrl && (
            <button
              onClick={handleRemoveLink}
              className="p-2.5 rounded-lg text-danger hover:bg-danger/10 transition-colors"
              title="הסר לינק"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="btn bg-bg-secondary text-text-primary hover:bg-bg-hover"
          >
            ביטול
          </button>
          <button
            onClick={handleSave}
            className="btn bg-accent text-white hover:bg-accent-hover"
          >
            שמור
          </button>
        </div>
      </div>
    </div>
  );
}
