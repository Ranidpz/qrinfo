'use client';

import { useState, useEffect } from 'react';
import { X, Edit2, Check } from 'lucide-react';
import { gamificationTranslations } from '@/lib/publicTranslations';
import { getVisitorId, getOrCreateVisitorId, validateNickname, sanitizeNickname } from '@/lib/xp';
import { getVisitor, getOrCreateVisitor, updateVisitor } from '@/lib/db';
import { Visitor } from '@/types';
import XPBar from './XPBar';
import LevelBadge from './LevelBadge';

interface RegistrationConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (visitor: Visitor) => void;
  locale?: 'he' | 'en';
  requireConsent?: boolean;
}

export default function RegistrationConsentModal({
  isOpen,
  onClose,
  onComplete,
  locale = 'he',
  requireConsent = true,
}: RegistrationConsentModalProps) {
  const t = gamificationTranslations[locale];
  const isRTL = locale === 'he';

  const [nickname, setNickname] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [existingVisitor, setExistingVisitor] = useState<Visitor | null>(null);
  const [isEditingNickname, setIsEditingNickname] = useState(false);

  // Check for existing visitor on mount
  useEffect(() => {
    if (!isOpen) return;

    const checkExistingVisitor = async () => {
      const visitorId = getVisitorId();
      if (visitorId) {
        const visitor = await getVisitor(visitorId);
        if (visitor) {
          setExistingVisitor(visitor);
          setNickname(visitor.nickname);
          setConsent(visitor.consent);
        }
      }
    };

    checkExistingVisitor();
  }, [isOpen]);

  const handleSubmit = async () => {
    // Validate nickname
    const sanitized = sanitizeNickname(nickname);
    const validation = validateNickname(sanitized);

    if (!validation.valid) {
      setError(validation.error || t.nicknameRequired);
      return;
    }

    // Require consent if needed
    if (requireConsent && !consent) {
      setError(t.mustAgree);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const visitorId = getOrCreateVisitorId();

      if (existingVisitor) {
        // Update existing visitor
        await updateVisitor(visitorId, {
          nickname: sanitized,
          consent,
        });

        onComplete({
          ...existingVisitor,
          nickname: sanitized,
          consent,
        });
      } else {
        // Create new visitor
        const visitor = await getOrCreateVisitor(visitorId, sanitized);
        await updateVisitor(visitorId, {
          nickname: sanitized,
          consent,
        });

        onComplete({
          ...visitor,
          nickname: sanitized,
          consent,
        });
      }
    } catch (err) {
      console.error('Error saving visitor:', err);
      setError(locale === 'he' ? 'שגיאה בשמירה' : 'Error saving');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`
          relative w-full max-w-md bg-white rounded-xl shadow-lg
          p-8 space-y-6
          ${isRTL ? 'text-right' : 'text-left'}
        `}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className={`
            absolute top-4 ${isRTL ? 'left-4' : 'right-4'}
            p-2 rounded-full hover:bg-gray-100 transition-colors
          `}
          aria-label="Close"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900">
          {t.consentTitle}
        </h2>

        {/* XP info for returning visitors */}
        {existingVisitor && existingVisitor.totalXP > 0 && (
          <div className="p-4 bg-gray-50 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">{t.yourXP}</span>
              <LevelBadge xp={existingVisitor.totalXP} locale={locale} size="md" />
            </div>
            <XPBar xp={existingVisitor.totalXP} locale={locale} size="md" showLabel={false} />
          </div>
        )}

        {/* Nickname input */}
        <div className="space-y-2">
          <label className="block text-base font-medium text-gray-700">
            {t.nickname}
          </label>

          {existingVisitor && !isEditingNickname ? (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="font-medium">{nickname}</span>
              <button
                onClick={() => setIsEditingNickname(true)}
                className="p-2 rounded-full hover:bg-gray-200 transition-colors"
                aria-label={t.editNickname}
              >
                <Edit2 className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          ) : (
            <input
              type="text"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setError('');
              }}
              placeholder={t.nicknamePlaceholder}
              className={`
                w-full px-4 py-3 rounded-lg border border-gray-200
                focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                text-base text-gray-900 placeholder-gray-400 bg-white
                ${isRTL ? 'text-right' : 'text-left'}
              `}
              maxLength={20}
              autoFocus={!existingVisitor}
            />
          )}
        </div>

        {/* Consent checkbox */}
        {requireConsent && (
          <label className="flex items-start gap-3 cursor-pointer">
            <div className="relative flex-shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  setError('');
                }}
                className="sr-only"
              />
              <div
                className={`
                  w-5 h-5 rounded border-2 flex items-center justify-center
                  transition-colors
                  ${consent
                    ? 'bg-emerald-500 border-emerald-500'
                    : 'bg-white border-gray-300'
                  }
                `}
              >
                {consent && <Check className="w-3 h-3 text-white" />}
              </div>
            </div>
            <span className="text-sm text-gray-600 leading-relaxed">
              {t.consentText}
            </span>
          </label>
        )}

        {/* Error message */}
        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`
            w-full py-3 px-6 rounded-lg font-medium text-white
            bg-emerald-500 hover:bg-emerald-600
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
            text-base
          `}
        >
          {loading
            ? (locale === 'he' ? 'שומר...' : 'Saving...')
            : (existingVisitor ? t.saveChanges : t.agreeAndJoin)
          }
        </button>
      </div>
    </div>
  );
}
