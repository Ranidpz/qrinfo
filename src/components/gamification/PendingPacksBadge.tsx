'use client';

import { Gift } from 'lucide-react';
import { PendingPack } from '@/types';

interface PendingPacksBadgeProps {
  pendingPacks: PendingPack[];
  onClick: () => void;
  locale?: 'he' | 'en';
}

const translations = {
  he: {
    openPacks: 'פתח חבילות',
    packWaiting: 'חבילה מחכה!',
    packsWaiting: 'חבילות מחכות!',
  },
  en: {
    openPacks: 'Open Packs',
    packWaiting: 'Pack waiting!',
    packsWaiting: 'Packs waiting!',
  },
};

export default function PendingPacksBadge({
  pendingPacks,
  onClick,
  locale = 'he',
}: PendingPacksBadgeProps) {
  const t = translations[locale];
  const count = pendingPacks.length;

  if (count === 0) return null;

  const waitingText = count === 1 ? t.packWaiting : t.packsWaiting;

  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-full shadow-lg animate-pulse transition-all duration-300 hover:scale-105"
      aria-label={t.openPacks}
    >
      {/* Gift icon with shake animation */}
      <div className="relative animate-bounce">
        <Gift className="w-5 h-5" />
        {/* Sparkle effects */}
        <span className="absolute -top-1 -right-1 text-xs animate-ping">✨</span>
      </div>

      {/* Text */}
      <span className="font-medium text-sm whitespace-nowrap">
        {waitingText}
      </span>

      {/* Count badge */}
      {count > 1 && (
        <span className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center bg-yellow-400 text-purple-900 text-xs font-bold rounded-full shadow-md">
          {count > 9 ? '9+' : count}
        </span>
      )}

      {/* Glow effect */}
      <div className="absolute inset-0 rounded-full bg-purple-500/30 blur-md -z-10" />
    </button>
  );
}

// Mini version for tight spaces (just the icon with count)
export function PendingPacksBadgeMini({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className="relative p-2 bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-full shadow-lg animate-bounce transition-all duration-300 hover:scale-110"
    >
      <Gift className="w-5 h-5" />

      {/* Count badge */}
      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-yellow-400 text-purple-900 text-xs font-bold rounded-full shadow-md px-1">
        {count > 9 ? '9+' : count}
      </span>

      {/* Glow effect */}
      <div className="absolute inset-0 rounded-full bg-purple-500/40 blur-sm -z-10 animate-pulse" />
    </button>
  );
}
