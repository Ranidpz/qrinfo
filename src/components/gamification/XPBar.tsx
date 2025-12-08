'use client';

import { getLevelForXP, getProgressToNextLevel, formatXP, getLevelName } from '@/lib/xp';

interface XPBarProps {
  xp: number;
  locale?: 'he' | 'en';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showLevel?: boolean;
  animated?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: { bar: 'h-2', text: 'text-xs', gap: 'gap-1', emoji: 'text-base' },
  md: { bar: 'h-3', text: 'text-sm', gap: 'gap-1.5', emoji: 'text-xl' },
  lg: { bar: 'h-4', text: 'text-base', gap: 'gap-2', emoji: 'text-2xl' },
};

export default function XPBar({
  xp,
  locale = 'he',
  size = 'md',
  showLabel = true,
  showLevel = true,
  animated = true,
  className = '',
}: XPBarProps) {
  const level = getLevelForXP(xp);
  const progress = getProgressToNextLevel(xp);
  const levelName = getLevelName(level, locale);
  const isMaxLevel = level.maxXP === Infinity;

  const sizes = sizeClasses[size];

  return (
    <div className={`flex flex-col ${sizes.gap} ${className}`}>
      {/* Label row */}
      {showLabel && (
        <div className={`flex items-center justify-between ${sizes.text}`}>
          <div className="flex items-center gap-1.5">
            {showLevel && (
              <>
                <span
                  className={`${sizes.emoji} ${animated ? 'animate-bounce-subtle' : ''}`}
                  role="img"
                  aria-label={levelName}
                >
                  {level.emoji}
                </span>
                <span className="font-semibold bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent">
                  {levelName}
                </span>
              </>
            )}
          </div>
          <span className="font-bold text-gray-700">
            {formatXP(xp, locale)} XP
          </span>
        </div>
      )}

      {/* Progress bar with game-like styling */}
      <div
        className={`
          relative w-full rounded-full overflow-hidden
          bg-gradient-to-b from-gray-200 to-gray-300
          shadow-inner
          ${sizes.bar}
        `}
      >
        {/* Fill with gradient */}
        <div
          className={`
            absolute inset-y-0 left-0 rounded-full
            transition-all duration-700 ease-out
            ${isMaxLevel
              ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500'
              : 'bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-500'
            }
          `}
          style={{ width: `${progress}%` }}
        >
          {/* Shine effect overlay */}
          <div
            className={`
              absolute inset-0 rounded-full
              bg-gradient-to-b from-white/40 via-transparent to-transparent
            `}
          />

          {/* Animated sparkle/shine sweep */}
          {animated && progress > 10 && (
            <div
              className="absolute inset-0 rounded-full overflow-hidden"
            >
              <div
                className="absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shine"
              />
            </div>
          )}
        </div>

        {/* Stars at the edge of progress (for max level) */}
        {isMaxLevel && animated && (
          <div
            className="absolute top-1/2 -translate-y-1/2 animate-pulse"
            style={{ left: `calc(${Math.min(progress, 95)}% - 4px)` }}
          >
            <span className="text-xs">✨</span>
          </div>
        )}
      </div>

      {/* Next level hint */}
      {!isMaxLevel && showLabel && (
        <div className={`${sizes.text} text-gray-400 text-center`}>
          {locale === 'he'
            ? `עוד ${formatXP(level.maxXP - xp, locale)} XP לרמה הבאה`
            : `${formatXP(level.maxXP - xp, locale)} XP to next level`}
        </div>
      )}

      {/* Max level celebration */}
      {isMaxLevel && showLabel && (
        <div className={`${sizes.text} text-center font-medium bg-gradient-to-r from-amber-500 to-yellow-500 bg-clip-text text-transparent`}>
          {locale === 'he' ? '🏆 הגעתם לפסגה!' : '🏆 You reached the top!'}
        </div>
      )}

      {/* CSS for custom animations */}
      <style jsx>{`
        @keyframes shine {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(400%);
          }
        }

        @keyframes bounce-subtle {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-2px);
          }
        }

        .animate-shine {
          animation: shine 2s ease-in-out infinite;
        }

        .animate-bounce-subtle {
          animation: bounce-subtle 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
