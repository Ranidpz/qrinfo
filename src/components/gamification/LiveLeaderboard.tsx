'use client';

import { useState, useEffect } from 'react';
import { onSnapshot, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LeaderboardEntry, XP_LEVELS } from '@/types';
import { getLevelForXP, formatXP, getLevelName } from '@/lib/xp';
import { gamificationTranslations } from '@/lib/publicTranslations';
import LevelBadge from './LevelBadge';

interface LiveLeaderboardProps {
  routeId: string;
  locale?: 'he' | 'en';
  maxEntries?: number;
  currentVisitorId?: string;
  className?: string;
}

export default function LiveLeaderboard({
  routeId,
  locale = 'he',
  maxEntries = 10,
  currentVisitorId,
  className = '',
}: LiveLeaderboardProps) {
  const t = gamificationTranslations[locale];
  const isRTL = locale === 'he';

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);

  // Subscribe to leaderboard updates
  useEffect(() => {
    const q = query(
      collection(db, 'visitorProgress'),
      where('routeId', '==', routeId),
      orderBy('xp', 'desc'),
      limit(maxEntries)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const leaderboardEntries: LeaderboardEntry[] = [];

      for (let i = 0; i < snapshot.docs.length; i++) {
        const doc = snapshot.docs[i];
        const data = doc.data();
        const visitorId = data.visitorId;

        // Get visitor nickname from visitors collection
        // We need to fetch this separately
        leaderboardEntries.push({
          visitorId,
          nickname: data.nickname || 'Player', // Fallback
          xp: data.xp,
          level: getLevelForXP(data.xp),
          rank: i + 1,
          photosUploaded: data.photosUploaded || 0,
        });
      }

      setEntries(leaderboardEntries);
      setLoading(false);

      // Find current user's rank
      if (currentVisitorId) {
        const userIndex = leaderboardEntries.findIndex(e => e.visitorId === currentVisitorId);
        setCurrentUserRank(userIndex >= 0 ? userIndex + 1 : null);
      }
    });

    return () => unsubscribe();
  }, [routeId, maxEntries, currentVisitorId]);

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-6 bg-gray-200 rounded mb-4 w-1/3"></div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded mb-2"></div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className={`text-center text-gray-500 py-8 ${className}`}>
        {locale === 'he' ? 'עדיין אין משתתפים' : 'No participants yet'}
      </div>
    );
  }

  return (
    <div className={`${className}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
        <span className="text-xl">🏆</span>
        {t.leaderboard}
      </h3>

      {/* Leaderboard list */}
      <div className="space-y-2">
        {entries.map((entry, index) => {
          const isCurrentUser = entry.visitorId === currentVisitorId;
          const isTop3 = index < 3;
          const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';

          return (
            <div
              key={entry.visitorId}
              className={`
                flex items-center gap-3 p-3 rounded-xl
                transition-all duration-300
                ${isCurrentUser
                  ? 'bg-emerald-50 border-2 border-emerald-200 shadow-md'
                  : 'bg-gray-50 border border-gray-100'
                }
                ${isTop3 ? 'shadow-sm' : ''}
              `}
            >
              {/* Rank */}
              <div className={`
                w-8 h-8 flex items-center justify-center rounded-full
                ${isTop3
                  ? 'bg-gradient-to-br from-amber-100 to-yellow-50 text-amber-700 font-bold'
                  : 'bg-gray-100 text-gray-500'
                }
                text-sm
              `}>
                {rankEmoji || entry.rank}
              </div>

              {/* Player info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`
                    font-medium truncate
                    ${isCurrentUser ? 'text-emerald-700' : 'text-gray-800'}
                  `}>
                    {entry.nickname}
                    {isCurrentUser && (
                      <span className="text-emerald-500 text-xs mr-1">
                        ({locale === 'he' ? 'את/ה' : 'you'})
                      </span>
                    )}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {formatXP(entry.xp, locale)} XP
                </div>
              </div>

              {/* Level badge */}
              <LevelBadge
                xp={entry.xp}
                locale={locale}
                size="sm"
                showName={false}
                animated={index === 0}
              />
            </div>
          );
        })}
      </div>

      {/* Current user rank (if not in top) */}
      {currentVisitorId && currentUserRank === null && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500 text-center">
            {locale === 'he'
              ? 'העלו תמונות כדי להופיע בלידרבורד!'
              : 'Upload photos to appear on the leaderboard!'}
          </p>
        </div>
      )}

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes rank-change {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
