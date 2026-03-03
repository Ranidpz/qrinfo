'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { QGamesMatch, GAME_META } from '@/types/qgames';

interface QGamesMatchHistoryProps {
  codeId: string;
  currentPlayerId?: string;
  isRTL: boolean;
  t: (key: string) => string;
  maxItems?: number;
}

export default function QGamesMatchHistory({
  codeId,
  currentPlayerId,
  isRTL,
  t,
  maxItems = 10,
}: QGamesMatchHistoryProps) {
  const [matches, setMatches] = useState<QGamesMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMatches() {
      try {
        const matchesRef = collection(db, 'codes', codeId, 'qgames_matches');
        const q = query(matchesRef, orderBy('finishedAt', 'desc'), limit(maxItems));
        const snapshot = await getDocs(q);
        setMatches(snapshot.docs.map(doc => doc.data() as QGamesMatch));
      } catch (error) {
        console.error('Error fetching match history:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchMatches();
  }, [codeId, maxItems]);

  if (loading) return null;
  if (matches.length === 0) return null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-2">
      <p className="text-white/30 text-xs uppercase tracking-wider mb-2">{t('recentMatches')}</p>
      <div className="space-y-1">
        {matches.map((match) => {
          const isMyMatch = match.player1Id === currentPlayerId || match.player2Id === currentPlayerId || match.player3Id === currentPlayerId;
          const is3Player = !!match.player3Id;
          const iWon = is3Player
            ? (match.winnerIds?.includes(currentPlayerId || '') ?? false)
            : match.winnerId === currentPlayerId;
          const isDraw = is3Player ? false : match.winnerId === null;
          const meta = GAME_META[match.gameType];
          const timeAgo = getTimeAgo(match.finishedAt || match.startedAt, isRTL);

          return (
            <div
              key={match.id}
              className={`flex items-center gap-2 py-2 px-3 rounded-lg text-xs ${
                isMyMatch
                  ? iWon ? 'bg-emerald-500/5' : isDraw ? 'bg-yellow-500/5' : 'bg-red-500/5'
                  : 'bg-white/[0.02]'
              }`}
            >
              <span className="text-sm">{meta?.emoji || '🎮'}</span>
              <span className="text-white/60 truncate max-w-[70px]">{match.player1Nickname}</span>
              {is3Player ? (
                <>
                  <span className="text-white/20 text-[10px]">vs</span>
                  <span className="text-white/60 truncate max-w-[55px]">{match.player2Nickname}</span>
                  <span className="text-white/20 text-[10px]">vs</span>
                  <span className="text-white/60 truncate max-w-[55px]">{match.player3Nickname}</span>
                </>
              ) : (
                <>
                  <span className="text-white/20 font-mono tabular-nums">
                    {match.player1Score}-{match.player2Score}
                  </span>
                  <span className="text-white/60 truncate max-w-[70px]">{match.player2Nickname}</span>
                </>
              )}
              <span className="text-white/20 text-[10px] ms-auto">{timeAgo}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getTimeAgo(timestamp: number, isRTL: boolean): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return isRTL ? 'עכשיו' : 'now';
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    return isRTL ? `${m} דק׳` : `${m}m`;
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    return isRTL ? `${h} שע׳` : `${h}h`;
  }
  const d = Math.floor(seconds / 86400);
  return isRTL ? `${d} ימים` : `${d}d`;
}
