'use client';

import { getRankForScore, getNextRank, RANK_TIERS } from '@/types/qgames';
import { useQGamesTheme } from './QGamesThemeContext';

interface QGamesRankBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  isRTL?: boolean;
  showProgress?: boolean;
  locale?: 'he' | 'en';
}

const sizeClasses = {
  sm: { container: 'gap-1 px-2 py-0.5 text-xs', icon: 'text-sm' },
  md: { container: 'gap-1.5 px-3 py-1 text-sm', icon: 'text-lg' },
  lg: { container: 'gap-2 px-4 py-1.5 text-base', icon: 'text-2xl' },
};

export default function QGamesRankBadge({
  score,
  size = 'md',
  isRTL = false,
  showProgress = false,
  locale = 'he',
}: QGamesRankBadgeProps) {
  const theme = useQGamesTheme();
  const rank = getRankForScore(score);
  const nextRank = getNextRank(score);
  const sizes = sizeClasses[size];
  const isMaxRank = !nextRank;

  // Progress to next rank (0-100)
  const progress = nextRank
    ? ((score - rank.minScore) / (nextRank.minScore - rank.minScore)) * 100
    : 100;

  return (
    <div className="flex flex-col items-start gap-0.5">
      {/* Badge */}
      <span
        className={`inline-flex items-center rounded-full font-semibold ${sizes.container}`}
        style={{
          backgroundColor: `${rank.color}20`,
          color: rank.color,
          border: `1px solid ${rank.color}40`,
        }}
      >
        <span className={sizes.icon}>{rank.icon}</span>
        <span>{locale === 'he' ? rank.nameHe : rank.nameEn}</span>
      </span>

      {/* Progress bar */}
      {showProgress && (
        <div className="w-full max-w-[140px] flex flex-col gap-0.5">
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ backgroundColor: `${theme.textColor}15` }}
          >
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${Math.min(progress, 100)}%`,
                backgroundColor: rank.color,
              }}
            />
          </div>
          <span
            className="text-[10px]"
            style={{ color: theme.textSecondary }}
          >
            {isMaxRank
              ? (locale === 'he' ? 'דרגה מקסימלית!' : 'Max rank!')
              : (locale === 'he'
                ? `${score}/${nextRank.minScore} ל${nextRank.nameHe}`
                : `${score}/${nextRank.minScore} to ${nextRank.nameEn}`)}
          </span>
        </div>
      )}
    </div>
  );
}
