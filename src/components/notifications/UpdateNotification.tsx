'use client';

import { useState, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';
import { APP_VERSION, getLatestUpdate, hasNewVersion } from '@/lib/version';

const LAST_SEEN_VERSION_KEY = 'qr_last_seen_version';

export default function UpdateNotification() {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

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

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 transition-all duration-300 ${
        isAnimating ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
    >
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl shadow-2xl p-5 text-white">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-300" />
            <span className="font-bold text-lg">גרסה {update.version}</span>
            <span className="bg-yellow-400 text-yellow-900 text-xs px-2 py-0.5 rounded-full font-bold">
              חדש!
            </span>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white/70 hover:text-white transition-colors p-1"
            aria-label="סגור"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Highlights */}
        <ul className="space-y-2 mb-4">
          {update.highlights.map((highlight, index) => (
            <li key={index} className="text-sm text-white/90 flex items-start gap-2">
              <span className="text-base leading-5">{highlight}</span>
            </li>
          ))}
        </ul>

        {/* CTA Button */}
        <button
          onClick={handleDismiss}
          className="w-full bg-white text-indigo-700 font-semibold py-2.5 px-4 rounded-xl hover:bg-indigo-50 transition-colors"
        >
          מעולה, הבנתי! 👍
        </button>
      </div>
    </div>
  );
}
