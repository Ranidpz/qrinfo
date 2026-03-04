'use client';

import { Pencil, Trophy } from 'lucide-react';
import { QGameType, GAME_META, QGamesConfig } from '@/types/qgames';

interface QGamesSelectorProps {
  config: QGamesConfig;
  playerNickname: string;
  playerAvatar: string;
  onSelectGame: (gameType: QGameType) => void;
  onViewLeaderboard: () => void;
  onEditProfile?: () => void;
  isRTL: boolean;
  t: (key: string) => string;
}

export default function QGamesSelector({
  config,
  playerNickname,
  playerAvatar,
  onSelectGame,
  onViewLeaderboard,
  onEditProfile,
  isRTL,
  t,
}: QGamesSelectorProps) {
  const enabledGames = config.enabledGames || ['rps'];

  return (
    <div
      className="min-h-screen flex flex-col items-center px-6 pb-8"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ fontFamily: 'var(--font-assistant), sans-serif' }}
    >
      {/* ── Profile hero ── */}
      <div
        className="flex flex-col items-center pt-14 pb-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500"
      >
        {/* Avatar with glow */}
        <button
          onClick={onEditProfile}
          className="relative group mb-4"
          disabled={!onEditProfile}
        >
          {/* Subtle glow ring */}
          <div className="absolute -inset-1.5 rounded-full bg-emerald-400/20 blur-md group-hover:bg-emerald-400/30 transition-all duration-300" />

          <div className="relative w-24 h-24 rounded-full bg-white/10 flex items-center justify-center text-5xl ring-2 ring-emerald-400/40 overflow-hidden transition-transform duration-200 group-active:scale-95">
            {playerAvatar.startsWith('http') ? (
              <img src={playerAvatar} alt="" className="w-full h-full object-cover" />
            ) : playerAvatar}
          </div>

          {onEditProfile && (
            <div className="absolute -bottom-0.5 -end-0.5 w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg ring-2 ring-black/40 transition-transform group-hover:scale-110">
              <Pencil className="w-3.5 h-3.5 text-white" />
            </div>
          )}
        </button>

        {/* Player name */}
        <h1 className="text-white font-bold text-xl tracking-tight mb-1">
          {playerNickname}
        </h1>

        {/* Tagline */}
        <p className="text-white/40 text-sm font-medium">
          {t('selectorTagline')}
        </p>
      </div>

      {/* ── Game cards ── */}
      <div className="w-full max-w-sm space-y-3 mt-2">
        {enabledGames.map((gameType, index) => {
          const meta = GAME_META[gameType];
          if (!meta) return null;

          return (
            <button
              key={gameType}
              onClick={() => onSelectGame(gameType)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] active:scale-[0.97] transition-all duration-200 group animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: `${(index + 1) * 80}ms`, animationFillMode: 'backwards' }}
            >
              {/* Game emoji */}
              <div className="w-14 h-14 rounded-2xl bg-white/[0.06] flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition-transform duration-200">
                {meta.emoji}
              </div>

              {/* Text */}
              <div className="text-start flex-1 min-w-0">
                <h3 className="text-white font-bold text-base">{t(meta.labelKey)}</h3>
                <p className="text-white/35 text-sm mt-0.5 truncate">{t(meta.descriptionKey)}</p>
              </div>

              {/* Chevron */}
              <div className="text-white/15 text-lg shrink-0 group-hover:text-white/30 transition-colors ltr:group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform">
                {isRTL ? '‹' : '›'}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Leaderboard ── */}
      <button
        onClick={onViewLeaderboard}
        className="mt-10 flex items-center gap-2 text-white/25 text-sm hover:text-white/45 transition-colors duration-200 animate-in fade-in duration-700"
        style={{ animationDelay: '400ms', animationFillMode: 'backwards' }}
      >
        <Trophy className="w-4 h-4" />
        <span>{t('viewLeaderboard')}</span>
      </button>
    </div>
  );
}
