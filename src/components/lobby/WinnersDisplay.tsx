'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PackOpening, RARITY_CONFIG } from '@/types';
import WinnerCelebration from './WinnerCelebration';

interface WinnersDisplayProps {
  routeId: string;
  maxWinners?: number;
  locale?: 'he' | 'en';
}

const translations = {
  he: {
    recentWinners: 'זוכים אחרונים',
    noWinnersYet: 'עדיין אין זוכים',
    won: 'זכה ב:',
    waitingForWinners: 'מחכים לזוכה הראשון...',
  },
  en: {
    recentWinners: 'Recent Winners',
    noWinnersYet: 'No winners yet',
    won: 'Won:',
    waitingForWinners: 'Waiting for the first winner...',
  },
};

export default function WinnersDisplay({
  routeId,
  maxWinners = 10,
  locale = 'he',
}: WinnersDisplayProps) {
  const t = translations[locale];
  const isRTL = locale === 'he';

  const [winners, setWinners] = useState<PackOpening[]>([]);
  const [celebratingWinner, setCelebratingWinner] = useState<PackOpening | null>(null);
  const [seenWinnerIds, setSeenWinnerIds] = useState<Set<string>>(new Set());

  // Listen to real-time winner updates
  useEffect(() => {
    const q = query(
      collection(db, 'packOpenings'),
      where('routeId', '==', routeId),
      where('prizeRarity', 'in', ['epic', 'legendary']),
      orderBy('openedAt', 'desc'),
      limit(maxWinners)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newWinners: PackOpening[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        newWinners.push({
          id: doc.id,
          ...data,
          openedAt: data.openedAt instanceof Timestamp ? data.openedAt.toDate() : new Date(data.openedAt),
          redeemedAt: data.redeemedAt instanceof Timestamp ? data.redeemedAt.toDate() : undefined,
        } as PackOpening);
      });

      // Check for new winners to celebrate
      const newWinnerToShow = newWinners.find(
        (w) => !seenWinnerIds.has(w.id)
      );

      if (newWinnerToShow && seenWinnerIds.size > 0) {
        // Only celebrate if we already had winners (not initial load)
        setCelebratingWinner(newWinnerToShow);
      }

      // Update seen IDs
      setSeenWinnerIds((prev) => {
        const updated = new Set(prev);
        newWinners.forEach((w) => updated.add(w.id));
        return updated;
      });

      setWinners(newWinners);
    });

    return () => unsubscribe();
  }, [routeId, maxWinners, seenWinnerIds.size]);

  // Format time ago
  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return locale === 'he' ? 'הרגע' : 'Just now';
    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return locale === 'he' ? `לפני ${minutes} דקות` : `${minutes}m ago`;
    }
    if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      return locale === 'he' ? `לפני ${hours} שעות` : `${hours}h ago`;
    }
    const days = Math.floor(seconds / 86400);
    return locale === 'he' ? `לפני ${days} ימים` : `${days}d ago`;
  };

  return (
    <div className="w-full h-full" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">
          {t.recentWinners}
        </h1>
        <div className="h-1 w-32 mx-auto bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 rounded-full" />
      </div>

      {/* Winners List */}
      {winners.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64">
          <div className="text-6xl mb-4 animate-pulse">🎁</div>
          <p className="text-xl text-white/60">{t.waitingForWinners}</p>
        </div>
      ) : (
        <div className="grid gap-4 max-w-4xl mx-auto">
          {winners.map((winner, index) => {
            const config = RARITY_CONFIG[winner.prizeRarity];
            const isFirst = index === 0;

            return (
              <div
                key={winner.id}
                className={`
                  relative p-4 rounded-2xl backdrop-blur-sm border
                  ${isFirst ? 'bg-gradient-to-r from-purple-900/50 to-pink-900/50 border-purple-500/50 scale-105' : 'bg-white/5 border-white/10'}
                  transition-all duration-500
                  ${isFirst ? 'animate-pulse' : ''}
                `}
                style={{
                  boxShadow: isFirst ? `0 0 30px ${config.color}40` : undefined,
                }}
              >
                <div className="flex items-center gap-4">
                  {/* Rarity Icon */}
                  <div
                    className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl"
                    style={{
                      background: `linear-gradient(135deg, ${config.bgColor}, ${config.color})`,
                      boxShadow: `0 0 20px ${config.color}60`,
                    }}
                  >
                    {config.emoji}
                  </div>

                  {/* Winner Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl font-bold text-white">
                        {winner.visitorNickname}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ backgroundColor: config.color, color: 'white' }}
                      >
                        {locale === 'he' ? config.name : config.nameEn}
                      </span>
                    </div>
                    <p className="text-white/80">
                      {t.won}{' '}
                      <span className="font-semibold" style={{ color: config.color }}>
                        {locale === 'he' ? winner.prizeName : winner.prizeNameEn}
                      </span>
                    </p>
                  </div>

                  {/* Time */}
                  <div className="text-white/50 text-sm">
                    {formatTimeAgo(winner.openedAt)}
                  </div>
                </div>

                {/* Prize Image */}
                {winner.prizeImageUrl && (
                  <div className="absolute top-2 left-2 w-12 h-12 rounded-lg overflow-hidden opacity-80">
                    <img
                      src={winner.prizeImageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Winner Celebration Modal */}
      {celebratingWinner && (
        <WinnerCelebration
          winner={celebratingWinner}
          locale={locale}
          onComplete={() => setCelebratingWinner(null)}
        />
      )}
    </div>
  );
}
