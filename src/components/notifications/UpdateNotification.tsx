'use client';

import { useState, useEffect } from 'react';
import { X, Zap } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { APP_VERSION, getLatestUpdate, hasNewVersion } from '@/lib/version';

const LAST_SEEN_VERSION_KEY = 'qr_last_seen_version';

export default function UpdateNotification() {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const locale = useLocale() as 'he' | 'en';
  const t = useTranslations('common');

  useEffect(() => {
    // Check if user has seen this version
    const lastSeenVersion = localStorage.getItem(LAST_SEEN_VERSION_KEY);

    if (hasNewVersion(lastSeenVersion)) {
      // Small delay before showing notification
      const timer = setTimeout(() => {
        setIsVisible(true);
        setIsAnimating(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setIsAnimating(false);
    setTimeout(() => {
      setIsVisible(false);
      localStorage.setItem(LAST_SEEN_VERSION_KEY, APP_VERSION);
    }, 300);
  };

  if (!isVisible) return null;

  const update = getLatestUpdate();
  const highlights = update.highlights[locale];
  const versionLabel = locale === 'he' ? 'גרסה' : 'Version';
  const newLabel = locale === 'he' ? 'חדש' : 'New';
  const gotItLabel = locale === 'he' ? 'הבנתי, תודה!' : 'Got it, thanks!';
  const closeLabel = locale === 'he' ? 'סגור' : 'Close';

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 transition-all duration-300 ${
        isAnimating ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
    >
      <div className="bg-bg-card border border-border rounded-xl shadow-lg p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-accent" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-text-primary text-lg">{versionLabel} {update.version}</span>
                <span className="bg-success text-white text-xs px-2 py-0.5 rounded-full font-medium">
                  {newLabel}
                </span>
              </div>
              <span className="text-text-secondary text-sm">{update.date}</span>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-text-secondary hover:text-text-primary transition-colors p-2 hover:bg-bg-hover rounded-lg"
            aria-label={closeLabel}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Highlights */}
        <ul className="space-y-3 mb-6">
          {highlights.map((highlight, index) => (
            <li key={index} className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
              <span className="text-text-primary text-base leading-relaxed">{highlight}</span>
            </li>
          ))}
        </ul>

        {/* CTA Button */}
        <button
          onClick={handleDismiss}
          className="w-full btn btn-primary py-3 text-base"
        >
          {gotItLabel}
        </button>
      </div>
    </div>
  );
}
