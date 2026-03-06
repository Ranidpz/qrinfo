'use client';

import { useState, useEffect } from 'react';
import { Sprout, Swords, ShieldHalf, Trophy, Gem, Crown } from 'lucide-react';
import { getRankForScore, getNextRank } from '@/types/qgames';
import { useQGamesTheme } from './QGamesThemeContext';

interface QGamesRankBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  isRTL?: boolean;
  showProgress?: boolean;
  locale?: 'he' | 'en';
}

const sizeConfig = {
  sm: { container: 'gap-1 px-2 py-0.5 text-xs', iconSize: 14 },
  md: { container: 'gap-1.5 px-3 py-1 text-sm', iconSize: 18 },
  lg: { container: 'gap-2 px-4 py-1.5 text-base', iconSize: 22 },
};

/** Lucide icon per rank id */
const RANK_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>> = {
  rookie: Sprout,
  contender: Swords,
  warrior: ShieldHalf,
  champion: Trophy,
  legend: Gem,
  mythic: Crown,
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
  const cfg = sizeConfig[size];
  const isMaxRank = !nextRank;

  const progress = nextRank
    ? ((score - rank.minScore) / (nextRank.minScore - rank.minScore)) * 100
    : 100;

  // Animate progress from 0 on mount
  const [animatedProgress, setAnimatedProgress] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedProgress(progress), 150);
    return () => clearTimeout(timer);
  }, [progress]);

  const RankIcon = RANK_ICONS[rank.id] || Sprout;
  const NextRankIcon = nextRank ? (RANK_ICONS[nextRank.id] || Swords) : null;

  return (
    <div className="flex flex-col items-start gap-1">
      {/* Badge */}
      <span
        className={`inline-flex items-center rounded-full font-semibold ${cfg.container}`}
        style={{
          backgroundColor: `${rank.color}20`,
          color: rank.color,
          border: `1px solid ${rank.color}40`,
        }}
      >
        <RankIcon size={cfg.iconSize} style={{ color: rank.color }} />
        <span>{locale === 'he' ? rank.nameHe : rank.nameEn}</span>
      </span>

      {/* Progress bar */}
      {showProgress && (
        <div className="w-full max-w-[160px] flex flex-col gap-0.5">
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ backgroundColor: `${theme.textColor}15` }}
          >
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${Math.min(animatedProgress, 100)}%`,
                backgroundColor: rank.color,
              }}
            />
          </div>
          <div className="flex items-center gap-1">
            {NextRankIcon && (
              <NextRankIcon size={10} style={{ color: nextRank!.color, opacity: 0.7 }} />
            )}
            <span
              className="text-[10px]"
              style={{ color: theme.textSecondary }}
            >
              {isMaxRank
                ? (locale === 'he' ? 'דרגה מקסימלית!' : 'Max rank!')
                : (locale === 'he'
                  ? `${score}/${nextRank!.minScore} לדרגה הבאה`
                  : `${score}/${nextRank!.minScore} to next rank`)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export { RANK_ICONS };
