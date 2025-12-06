'use client';

import { useState, useEffect } from 'react';
import { X, MessageCircle } from 'lucide-react';

interface WhatsAppWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (groupLink: string | undefined) => Promise<void>;
  currentGroupLink?: string;
}

export default function WhatsAppWidgetModal({
  isOpen,
  onClose,
  onSave,
  currentGroupLink,
}: WhatsAppWidgetModalProps) {
  const [groupLink, setGroupLink] = useState(currentGroupLink || '');
  const [enabled, setEnabled] = useState(!!currentGroupLink);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setGroupLink(currentGroupLink || '');
      setEnabled(!!currentGroupLink);
      setError('');
    }
  }, [isOpen, currentGroupLink]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (enabled && !groupLink.trim()) {
      setError('יש להזין קישור לקבוצת WhatsApp');
      return;
    }

    if (enabled && groupLink.trim()) {
      // Validate WhatsApp link
      if (!groupLink.includes('chat.whatsapp.com') && !groupLink.includes('wa.me')) {
        setError('הקישור חייב להיות קישור WhatsApp תקין');
        return;
      }
    }

    setIsSaving(true);
    try {
      if (enabled && groupLink.trim()) {
        await onSave(groupLink.trim());
      } else {
        await onSave(undefined);
      }
      onClose();
    } catch (error) {
      console.error('Error saving WhatsApp widget:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    setIsSaving(true);
    try {
      await onSave(undefined);
      onClose();
    } catch (error) {
      console.error('Error removing WhatsApp widget:', error);
    } finally {
      setIsSaving(false);
    }
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
            <MessageCircle className="w-5 h-5 text-[#25D366]" />
            קישור לקבוצת WhatsApp
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
          הוסף כפתור הצטרפות לקבוצת WhatsApp שיופיע לצופים בתצוגת המדיה אחרי שנייה עם אנימציה.
        </p>

        {/* Enable toggle */}
        <div className="flex items-center justify-between p-3 bg-bg-secondary rounded-lg">
          <span className="text-sm font-medium text-text-primary">הפעל כפתור WhatsApp</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => {
                setEnabled(e.target.checked);
                setError('');
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#25D366]"></div>
          </label>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        {/* Group Link Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary">
            קישור לקבוצה
          </label>
          <input
            type="url"
            value={groupLink}
            onChange={(e) => {
              setGroupLink(e.target.value);
              setError('');
            }}
            placeholder="https://chat.whatsapp.com/..."
            className="input w-full"
            dir="ltr"
            disabled={!enabled}
          />
          <p className="text-xs text-text-secondary">
            ניתן להשיג את הקישור מהגדרות הקבוצה ב-WhatsApp
          </p>
        </div>

        {/* Preview */}
        {enabled && groupLink && (
          <div className="flex items-center justify-center py-4">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#25D366] text-white rounded-full text-sm font-medium shadow-lg">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              הצטרפו לקבוצה
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          {currentGroupLink ? (
            <button
              onClick={handleRemove}
              disabled={isSaving}
              className="btn bg-danger/10 text-danger hover:bg-danger/20 disabled:opacity-50"
            >
              הסר כפתור
            </button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="btn bg-bg-secondary text-text-primary hover:bg-bg-hover disabled:opacity-50"
            >
              ביטול
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="btn bg-[#25D366] text-white hover:bg-[#20BD5A] disabled:opacity-50 min-w-[80px]"
            >
              {isSaving ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'שמור'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
