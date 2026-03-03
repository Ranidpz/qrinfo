'use client';

import { QGameType, GAME_META, QGamesConfig } from '@/types/qgames';

interface QGamesSelectorProps {
  config: QGamesConfig;
  playerNickname: string;
  playerAvatar: string;
  onSelectGame: (gameType: QGameType) => void;
  isRTL: boolean;
  t: (key: string) => string;
}

export default function QGamesSelector({
  config,
  playerNickname,
  playerAvatar,
  onSelectGame,
  isRTL,
  t,
}: QGamesSelectorProps) {
  const enabledGames = config.enabledGames || ['rps'];

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Player Info */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-2xl ring-2 ring-white/10">
          {playerAvatar}
        </div>
        <div>
          <p className="text-white font-semibold">{playerNickname}</p>
          <p className="text-white/40 text-xs">{t('selectGame')}</p>
        </div>
      </div>

      {/* Game Cards */}
      <div className="w-full max-w-sm space-y-3">
        {enabledGames.map((gameType) => {
          const meta = GAME_META[gameType];
          if (!meta) return null;

          return (
            <button
              key={gameType}
              onClick={() => onSelectGame(gameType)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 active:scale-[0.98] transition-all duration-200 group"
            >
              <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                {meta.emoji}
              </div>
              <div className="text-start flex-1">
                <h3 className="text-white font-bold text-lg">{t(meta.labelKey)}</h3>
                <p className="text-white/40 text-sm">{t(meta.descriptionKey)}</p>
              </div>
              <div className="text-white/20 text-xl">{isRTL ? '‹' : '›'}</div>
            </button>
          );
        })}
      </div>

      {/* Leaderboard link at bottom */}
      <button
        onClick={() => {/* TODO: show leaderboard */}}
        className="mt-8 text-white/30 text-sm hover:text-white/50 transition-colors"
      >
        🏆 {t('viewLeaderboard')}
      </button>
    </div>
  );
}
