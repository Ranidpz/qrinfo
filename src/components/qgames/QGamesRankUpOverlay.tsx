'use client';

import { useState, useEffect } from 'react';
import { RANK_TIERS } from '@/types/qgames';
import { useQGamesTheme } from './QGamesThemeContext';
import { RANK_ICONS } from './QGamesRankBadge';

interface QGamesRankUpOverlayProps {
  previousRankId: string;
  newRankId: string;
  isRTL?: boolean;
  locale?: 'he' | 'en';
  onComplete: () => void;
}

export default function QGamesRankUpOverlay({
  previousRankId,
  newRankId,
  isRTL = false,
  locale = 'he',
  onComplete,
}: QGamesRankUpOverlayProps) {
  const theme = useQGamesTheme();
  const [phase, setPhase] = useState<'enter' | 'show' | 'exit'>('enter');

  const oldRank = RANK_TIERS.find(r => r.id === previousRankId) || RANK_TIERS[0];
  const newRank = RANK_TIERS.find(r => r.id === newRankId) || RANK_TIERS[1];

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('show'), 100);
    const t2 = setTimeout(() => setPhase('exit'), 2500);
    const t3 = setTimeout(onComplete, 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ backgroundColor: `${theme.backgroundColor}f0` }}
      onClick={onComplete}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: '-10px',
              backgroundColor: [newRank.color, '#F59E0B', '#8B5CF6', '#10B981', '#EF4444'][i % 5],
              animation: `rankup-particle ${1.5 + Math.random() * 2}s ease-out ${Math.random() * 0.5}s forwards`,
              opacity: phase === 'show' ? 1 : 0,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div
        className={`flex flex-col items-center gap-6 transition-all duration-500 ${
          phase === 'enter' ? 'opacity-0 scale-75' :
          phase === 'exit' ? 'opacity-0 scale-110' :
          'opacity-100 scale-100'
        }`}
      >
        {/* Title */}
        <h2
          className="text-2xl font-bold"
          style={{ color: newRank.color }}
        >
          {locale === 'he' ? '🎉 עלית דרגה!' : '🎉 Rank Up!'}
        </h2>

        {/* Old → New rank */}
        <div className="flex items-center gap-6">
          {/* Old rank */}
          {(() => {
            const OldIcon = RANK_ICONS[oldRank.id];
            return (
              <div className="flex flex-col items-center gap-1 opacity-50">
                {OldIcon ? <OldIcon size={40} style={{ color: oldRank.color }} /> : <span className="text-4xl">{oldRank.icon}</span>}
                <span className="text-sm" style={{ color: theme.textSecondary }}>
                  {locale === 'he' ? oldRank.nameHe : oldRank.nameEn}
                </span>
              </div>
            );
          })()}

          {/* Arrow */}
          <span className="text-3xl" style={{ color: newRank.color }}>→</span>

          {/* New rank */}
          {(() => {
            const NewIcon = RANK_ICONS[newRank.id];
            return (
              <div className="flex flex-col items-center gap-1">
                {NewIcon ? (
                  <NewIcon size={56} style={{ color: newRank.color, filter: `drop-shadow(0 0 12px ${newRank.color})` }} />
                ) : (
                  <span className="text-6xl" style={{ filter: `drop-shadow(0 0 12px ${newRank.color})` }}>{newRank.icon}</span>
                )}
                <span
                  className="text-lg font-bold"
                  style={{ color: newRank.color }}
                >
                  {locale === 'he' ? newRank.nameHe : newRank.nameEn}
                </span>
              </div>
            );
          })()}
        </div>
      </div>

      {/* CSS */}
      <style>{`
        @keyframes rankup-particle {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
