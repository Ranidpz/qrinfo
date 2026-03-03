'use client';

import { ArrowLeft } from 'lucide-react';
import { QGamesLeaderboardEntry } from '@/types/qgames';

interface QGamesLeaderboardProps {
  entries: QGamesLeaderboardEntry[];
  currentPlayerId?: string;
  onBack?: () => void;
  isRTL: boolean;
  t: (key: string) => string;
  compact?: boolean;
}

export default function QGamesLeaderboard({
  entries,
  currentPlayerId,
  onBack,
  isRTL,
  t,
  compact = false,
}: QGamesLeaderboardProps) {
  const topEntries = compact ? entries.slice(0, 10) : entries;
  const rankMedals = ['🥇', '🥈', '🥉'];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className={compact ? '' : 'min-h-screen flex flex-col p-4'}>
      {/* Header */}
      {!compact && (
        <div className="flex items-center gap-3 mb-6">
          {onBack && (
            <button
              onClick={onBack}
              className="text-white/40 hover:text-white/60 transition-colors p-1"
            >
              <ArrowLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
            </button>
          )}
          <h2 className="text-white font-bold text-xl flex-1">🏆 {t('leaderboard')}</h2>
        </div>
      )}

      {/* Leaderboard List */}
      <div className="space-y-1.5">
        {topEntries.length === 0 && (
          <p className="text-white/30 text-sm text-center py-8">{t('noPlayersYet')}</p>
        )}

        {topEntries.map((entry) => {
          const isMe = entry.id === currentPlayerId;
          const medal = entry.rank <= 3 ? rankMedals[entry.rank - 1] : null;

          return (
            <div
              key={entry.id}
              className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors ${
                isMe
                  ? 'bg-emerald-500/10 ring-1 ring-emerald-400/30'
                  : 'bg-white/[0.02] hover:bg-white/[0.04]'
              }`}
            >
              {/* Rank */}
              <div className="w-8 text-center shrink-0">
                {medal ? (
                  <span className="text-lg">{medal}</span>
                ) : (
                  <span className="text-white/30 text-sm font-medium">{entry.rank}</span>
                )}
              </div>

              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-lg shrink-0 overflow-hidden ${
                isMe ? 'ring-1 ring-emerald-400/30' : ''
              }`}>
                {entry.avatarValue.startsWith('http') ? (
                  <img src={entry.avatarValue} alt="" className="w-full h-full object-cover" />
                ) : entry.avatarValue}
              </div>

              {/* Name + Stats */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isMe ? 'text-emerald-400' : 'text-white'}`}>
                  {entry.nickname}
                  {isMe && <span className="text-emerald-400/60 text-xs ml-1">({t('you')})</span>}
                </p>
                <p className="text-white/30 text-[10px]">
                  {entry.wins}W / {entry.losses}L / {entry.draws}D
                </p>
              </div>

              {/* Score */}
              <div className="text-end shrink-0">
                <p className={`font-bold tabular-nums ${isMe ? 'text-emerald-400' : 'text-white'}`}>
                  {entry.score}
                </p>
                <p className="text-white/20 text-[10px]">{t('pts')}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
