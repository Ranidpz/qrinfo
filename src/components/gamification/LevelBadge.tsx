'use client';

import { XPLevel, XP_LEVELS } from '@/types';
import { getLevelForXP, getLevelName } from '@/lib/xp';

interface LevelBadgeProps {
  xp: number;
  level?: XPLevel;
  locale?: 'he' | 'en';
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  animated?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: { container: 'text-sm gap-1 px-2 py-0.5', emoji: 'text-base' },
  md: { container: 'text-base gap-1.5 px-3 py-1', emoji: 'text-xl' },
  lg: { container: 'text-lg gap-2 px-4 py-1.5', emoji: 'text-2xl' },
};

// Level-specific styles
const levelStyles: Record<string, { bg: string; text: string; glow?: string }> = {
  'מתחילים': {
    bg: 'bg-gradient-to-r from-green-50 to-emerald-50',
    text: 'text-emerald-700',
  },
  'חוקרים': {
    bg: 'bg-gradient-to-r from-blue-50 to-cyan-50',
    text: 'text-blue-700',
  },
  'מומחים': {
    bg: 'bg-gradient-to-r from-purple-50 to-violet-50',
    text: 'text-purple-700',
  },
  'אלופים': {
    bg: 'bg-gradient-to-r from-amber-100 to-yellow-100',
    text: 'bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent',
    glow: 'shadow-lg shadow-amber-200/50',
  },
};

export default function LevelBadge({
  xp,
  level,
  locale = 'he',
  size = 'md',
  showName = true,
  animated = true,
  className = '',
}: LevelBadgeProps) {
  const currentLevel = level || getLevelForXP(xp);
  const levelName = getLevelName(currentLevel, locale);
  const isChampion = currentLevel === XP_LEVELS[XP_LEVELS.length - 1];

  const sizes = sizeClasses[size];
  const style = levelStyles[currentLevel.name] || levelStyles['מתחילים'];

  return (
    <span
      className={`
        inline-flex items-center rounded-full
        ${sizes.container}
        ${style.bg}
        ${style.glow || ''}
        ${isChampion && animated ? 'animate-subtle-glow' : ''}
        ${className}
      `}
      title={`${levelName} - ${xp} XP`}
    >
      <span
        className={`
          ${sizes.emoji}
          ${isChampion && animated ? 'animate-bounce-slow' : ''}
        `}
        role="img"
        aria-label={levelName}
      >
        {currentLevel.emoji}
      </span>
      {showName && (
        <span className={`font-semibold ${style.text}`}>
          {levelName}
        </span>
      )}

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes subtle-glow {
          0%, 100% {
            box-shadow: 0 0 8px rgba(251, 191, 36, 0.3);
          }
          50% {
            box-shadow: 0 0 16px rgba(251, 191, 36, 0.5);
          }
        }

        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-2px);
          }
        }

        .animate-subtle-glow {
          animation: subtle-glow 2s ease-in-out infinite;
        }

        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
      `}</style>
    </span>
  );
}
