'use client';

import { useState } from 'react';
import { ArrowLeft, Share2, X } from 'lucide-react';
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
  const [selectedPlayer, setSelectedPlayer] = useState<QGamesLeaderboardEntry | null>(null);

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
              onClick={() => setSelectedPlayer(entry)}
              className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors cursor-pointer ${
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
                  {entry.gamesPlayed} {t('games')} · {entry.wins}{t('winsShort')} / {entry.losses}{t('lossesShort')} / {entry.draws}{t('drawsShort')}
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
                    onClick={(e) => { e.stopPropagation(); handleChallengePlayer(entry.nickname); }}
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

      {/* Player Stats Modal */}
      {selectedPlayer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedPlayer(null)}
        >
          <div
            className="bg-[#1a1a2e] rounded-2xl w-full max-w-xs p-5 relative animate-in zoom-in-95 duration-200"
            dir={isRTL ? 'rtl' : 'ltr'}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedPlayer(null)}
              className="absolute top-3 end-3 text-white/30 hover:text-white/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Player header */}
            <div className="flex flex-col items-center mb-5">
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-3xl overflow-hidden mb-2">
                {selectedPlayer.avatarValue.startsWith('http') ? (
                  <img src={selectedPlayer.avatarValue} alt="" className="w-full h-full object-cover" />
                ) : selectedPlayer.avatarValue}
              </div>
              <h3 className="text-white font-bold text-lg">{selectedPlayer.nickname}</h3>
              <div className="flex items-center gap-2 mt-1">
                {selectedPlayer.rank <= 3 ? (
                  <span className="text-lg">{rankMedals[selectedPlayer.rank - 1]}</span>
                ) : (
                  <span className="text-white/40 text-sm">#{selectedPlayer.rank}</span>
                )}
                <span className="text-emerald-400 font-bold">{selectedPlayer.score} {t('pts')}</span>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-white font-bold text-xl tabular-nums">{selectedPlayer.gamesPlayed}</p>
                <p className="text-white/40 text-xs mt-0.5">{t('gamesPlayedLabel')}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-white font-bold text-xl tabular-nums">
                  {selectedPlayer.gamesPlayed > 0
                    ? Math.round((selectedPlayer.wins / selectedPlayer.gamesPlayed) * 100)
                    : 0}%
                </p>
                <p className="text-white/40 text-xs mt-0.5">{t('winRate')}</p>
              </div>
              <div className="bg-emerald-500/10 rounded-xl p-3 text-center">
                <p className="text-emerald-400 font-bold text-xl tabular-nums">{selectedPlayer.wins}</p>
                <p className="text-emerald-400/50 text-xs mt-0.5">{t('winsLabel')}</p>
              </div>
              <div className="bg-red-500/10 rounded-xl p-3 text-center">
                <p className="text-red-400 font-bold text-xl tabular-nums">{selectedPlayer.losses}</p>
                <p className="text-red-400/50 text-xs mt-0.5">{t('lossesLabel')}</p>
              </div>
              <div className="bg-yellow-500/10 rounded-xl p-3 text-center col-span-2">
                <p className="text-yellow-400 font-bold text-xl tabular-nums">{selectedPlayer.draws}</p>
                <p className="text-yellow-400/50 text-xs mt-0.5">{t('drawsLabel')}</p>
              </div>
            </div>

            {/* Challenge button */}
            {selectedPlayer.id !== currentPlayerId && shortId && (
              <button
                onClick={() => { handleChallengePlayer(selectedPlayer.nickname); setSelectedPlayer(null); }}
                className="mt-4 w-full py-2.5 rounded-xl font-bold text-white text-sm active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
              >
                ⚔️ {t('challenge')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
