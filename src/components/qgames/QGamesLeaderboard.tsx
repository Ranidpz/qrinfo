'use client';

import { ArrowLeft, Share2 } from 'lucide-react';
import { QGamesLeaderboardEntry } from '@/types/qgames';

interface QGamesLeaderboardProps {
  entries: QGamesLeaderboardEntry[];
  currentPlayerId?: string;
  onBack?: () => void;
  onChallenge?: () => void;
  shortId?: string;
  isRTL: boolean;
  t: (key: string) => string;
  compact?: boolean;
}

export default function QGamesLeaderboard({
  entries,
  currentPlayerId,
  onBack,
  onChallenge,
  shortId,
  isRTL,
  t,
  compact = false,
}: QGamesLeaderboardProps) {
  const topEntries = compact ? entries.slice(0, 10) : entries;
  const rankMedals = ['🥇', '🥈', '🥉'];

  const gameUrl = shortId ? `https://qr.playzones.app/v/${shortId}` : '';

  const handleShareWhatsApp = () => {
    if (!gameUrl) return;
    const top3 = topEntries.slice(0, 3).map((e, i) =>
      `${rankMedals[i]} ${e.nickname} - ${e.score} ${t('pts')}`
    ).join('\n');

    const text = isRTL
      ? `🏆 ${t('leaderboard')}\n\n${top3}\n\n${t('joinAndPlay')}\n${gameUrl}`
      : `🏆 ${t('leaderboard')}\n\n${top3}\n\n${t('joinAndPlay')}\n${gameUrl}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleChallengePlayer = (nickname: string) => {
    if (!gameUrl) return;
    const text = isRTL
      ? `${t('challengeMessage').replace('{name}', nickname)}\n${gameUrl}`
      : `${t('challengeMessage').replace('{name}', nickname)}\n${gameUrl}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

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
          {shortId && (
            <button
              onClick={handleShareWhatsApp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              {t('share')}
            </button>
          )}
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

              {/* Score + Challenge */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-end">
                  <p className={`font-bold tabular-nums ${isMe ? 'text-emerald-400' : 'text-white'}`}>
                    {entry.score}
                  </p>
                  <p className="text-white/20 text-[10px]">{t('pts')}</p>
                </div>
                {!isMe && !compact && shortId && (
                  <button
                    onClick={() => handleChallengePlayer(entry.nickname)}
                    className="text-[10px] px-2 py-1 rounded-md bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60 transition-colors"
                    title={t('challenge')}
                  >
                    ⚔️
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Play / Challenge CTA at bottom */}
      {!compact && shortId && onChallenge && (
        <button
          onClick={onChallenge}
          className="mt-6 w-full py-3 rounded-xl font-bold text-lg text-white active:scale-95 transition-all"
          style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
        >
          🎮 {t('playNow')}
        </button>
      )}
    </div>
  );
}
