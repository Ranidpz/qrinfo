'use client';

import { Pencil, Trophy } from 'lucide-react';
import { QGameType, GAME_META, QGamesConfig, LiveMatchInfo, GAME_DISPLAY_ORDER } from '@/types/qgames';
import { useQGamesTheme } from './QGamesThemeContext';
import RPSAnimatedEmoji from './RPSAnimatedEmoji';
import OOOAnimatedEmoji from './OOOAnimatedEmoji';
import TTTAnimatedEmoji from './TTTAnimatedEmoji';
import MemoryAnimatedEmoji from './MemoryAnimatedEmoji';
import Connect4AnimatedEmoji from './Connect4AnimatedEmoji';

interface QGamesSelectorProps {
  config: QGamesConfig;
  playerNickname: string;
  playerAvatar: string;
  onSelectGame: (gameType: QGameType) => void;
  onViewLeaderboard: () => void;
  onEditProfile?: () => void;
  isRTL: boolean;
  t: (key: string) => string;
  viewerCount?: number;
  matchesPerGame?: Record<string, number>;
  queuePerGame?: Record<string, number>;
  liveMatches?: LiveMatchInfo[];
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
  viewerCount = 0,
  matchesPerGame = {},
  queuePerGame = {},
  liveMatches = [],
}: QGamesSelectorProps) {
  const theme = useQGamesTheme();
  const enabledSet = new Set(config.enabledGames || ['rps']);
  const enabledGames = GAME_DISPLAY_ORDER.filter(g => enabledSet.has(g));
  const gameName = config.branding.title || 'Q.Games';

  return (
    <div
      className="h-[100dvh] flex flex-col"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ fontFamily: 'var(--font-assistant), sans-serif' }}
    >
      {/* ── Fixed Profile Header ── */}
      <div className="shrink-0 flex flex-col items-center px-6" style={{ backgroundColor: theme.backgroundColor }}>
        {/* Event Logo */}
        {config.branding.eventLogo && (
          <div className="w-full flex justify-center pt-8">
            <img
              src={config.branding.eventLogo}
              alt=""
              className="object-contain drop-shadow-lg"
              style={{ maxHeight: `${60 * (config.branding.logoScale ?? 1)}px`, maxWidth: '50%' }}
            />
          </div>
        )}

        {/* Profile hero */}
        <div
          className={`flex flex-col items-center ${config.branding.eventLogo ? 'pt-4' : 'pt-14'} pb-4 w-full animate-in fade-in slide-in-from-bottom-4 duration-500`}
        >
          {/* Avatar with glow */}
          <button
            onClick={onEditProfile}
            className="relative group mb-4"
            disabled={!onEditProfile}
          >
            <div className="absolute -inset-1.5 rounded-full blur-md transition-all duration-300" style={{ backgroundColor: `${theme.accentColor}33` }} />

            <div
              className="relative w-24 h-24 rounded-full flex items-center justify-center text-5xl overflow-hidden transition-transform duration-200 group-active:scale-95"
              style={{ backgroundColor: theme.surfaceColor, boxShadow: `0 0 0 2px ${theme.accentColor}66` }}
            >
              {playerAvatar.startsWith('http') ? (
                <img src={playerAvatar} alt="" className="w-full h-full object-cover" />
              ) : playerAvatar}
            </div>

            {onEditProfile && (
              <div
                className="absolute -bottom-0.5 -end-0.5 w-7 h-7 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-110"
                style={{ backgroundColor: theme.accentColor, boxShadow: `0 0 0 2px ${theme.backgroundColor}` }}
              >
                <Pencil className="w-3.5 h-3.5 text-white" />
              </div>
            )}
          </button>

          {/* Player name */}
          <h1 className="font-bold text-xl tracking-tight mb-1" style={{ color: theme.textColor }}>
            {playerNickname}
          </h1>

          {/* Tagline */}
          <p className="text-sm font-medium" style={{ color: theme.textSecondary }}>
            {t('selectorTagline')}
          </p>

          {/* Live connected count */}
          <div className="flex items-center gap-1.5 mt-3 animate-in fade-in duration-500" style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}>
            <div
              className={`w-2 h-2 rounded-full ${viewerCount > 0 ? 'animate-pulse' : ''}`}
              style={{ backgroundColor: viewerCount > 0 ? theme.accentColor : theme.borderColor }}
            />
            <span className="text-xs font-medium tabular-nums" style={{ color: viewerCount > 0 ? `${theme.accentColor}b3` : theme.textSecondary }}>
              {viewerCount}
            </span>
            <span className="text-xs" style={{ color: theme.textSecondary }}>{isRTL ? 'מחוברים' : 'online'}</span>
          </div>
        </div>
      </div>

      {/* ── Scrollable Games Section ── */}
      <div className="flex-1 overflow-y-auto px-6 pb-20 flex flex-col items-center">
        {/* Game title */}
        {gameName !== 'Q.Games' && (
          <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: theme.textSecondary }}>
            {gameName}
          </p>
        )}

        {/* Game cards */}
        <div className="w-full max-w-sm space-y-3 mt-2">
          {enabledGames.map((gameType, index) => {
            const meta = GAME_META[gameType];
            if (!meta) return null;
            const waitingNow = queuePerGame[gameType] || 0;
            const playingNow = matchesPerGame[gameType] || 0;
            const hasActivity = waitingNow > 0 || playingNow > 0;

            return (
              <button
                key={gameType}
                onClick={() => onSelectGame(gameType)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl active:scale-[0.97] transition-all duration-200 group animate-in fade-in slide-in-from-bottom-2"
                style={{
                  animationDelay: `${(index + 1) * 80}ms`,
                  animationFillMode: 'backwards',
                  backgroundColor: theme.surfaceColor,
                  border: `1px solid ${waitingNow > 0 ? `${theme.accentColor}60` : theme.borderColor}`,
                  boxShadow: waitingNow > 0 ? `0 0 16px ${theme.accentColor}25` : 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.surfaceHover;
                  e.currentTarget.style.borderColor = `${theme.primaryColor}40`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = theme.surfaceColor;
                  e.currentTarget.style.borderColor = waitingNow > 0 ? `${theme.accentColor}60` : theme.borderColor;
                }}
              >
                {/* Game emoji */}
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition-transform duration-200"
                  style={{ backgroundColor: theme.surfaceHover }}
                >
                  {gameType === 'rps' ? <RPSAnimatedEmoji /> : gameType === 'oddoneout' ? <OOOAnimatedEmoji /> : gameType === 'tictactoe' ? <TTTAnimatedEmoji /> : gameType === 'connect4' ? <Connect4AnimatedEmoji /> : gameType === 'memory' ? <MemoryAnimatedEmoji /> : meta.emoji}
                </div>

                {/* Text */}
                <div className="text-start flex-1 min-w-0">
                  <h3 className="font-bold text-base" style={{ color: theme.textColor }}>{t(meta.labelKey)}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-sm truncate" style={{ color: theme.textSecondary }}>{t(meta.descriptionKey)}</p>
                    <span
                      className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none"
                      style={{ backgroundColor: `${theme.primaryColor}33`, color: theme.primaryColor }}
                    >
                      {gameType === 'memory' ? (isRTL ? '2-6 שחקנים' : '2-6 players') : gameType === 'oddoneout' ? (isRTL ? '3 שחקנים' : '3 players') : (isRTL ? '2 שחקנים' : '2 players')}
                    </span>
                  </div>
                  {/* Live activity badges */}
                  <div className="flex items-center gap-3 mt-1.5">
                    {/* Waiting in queue */}
                    <div className="flex items-center gap-1">
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${waitingNow > 0 ? 'animate-pulse' : ''}`}
                        style={{ backgroundColor: waitingNow > 0 ? theme.accentColor : theme.borderColor }}
                      />
                      <span className="text-xs font-medium" style={{ color: waitingNow > 0 ? `${theme.accentColor}cc` : theme.textSecondary }}>
                        {waitingNow} {t('waitingInQueue')}
                      </span>
                    </div>
                    {/* Currently playing */}
                    {playingNow > 0 && (
                      <div className="flex items-center gap-1">
                        <div
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: theme.primaryColor }}
                        />
                        <span className="text-xs font-medium" style={{ color: `${theme.primaryColor}cc` }}>
                          {playingNow} {isRTL ? 'במשחק' : 'playing'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Chevron */}
                <div className="text-lg shrink-0 transition-colors ltr:group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform" style={{ color: hasActivity ? theme.accentColor : theme.borderColor }}>
                  {isRTL ? '‹' : '›'}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Live Matches Marquee ── */}
        {liveMatches.length > 0 && (
          <div
            className="w-full max-w-sm mt-6 animate-in fade-in duration-500"
            style={{ animationDelay: `${(enabledGames.length + 1) * 80}ms`, animationFillMode: 'backwards' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: theme.accentColor }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.textSecondary }}>
                {t('playingNow')}
              </span>
            </div>

            {/* Marquee ticker */}
            <div className="overflow-hidden rounded-xl py-2 px-1" style={{ backgroundColor: theme.surfaceColor, border: `1px solid ${theme.borderColor}` }}>
              <div
                className="flex items-center gap-5 whitespace-nowrap"
                style={{
                  animation: `marquee-scroll ${Math.max(8, liveMatches.length * 5)}s linear infinite`,
                }}
              >
                {/* Duplicate items for seamless loop */}
                {[...liveMatches.slice(0, 10), ...liveMatches.slice(0, 10)].map((match, i) => {
                  const meta = GAME_META[match.gameType];
                  return (
                    <div key={`${match.matchId}-${i}`} className="flex items-center gap-1.5 shrink-0">
                      {/* Game emoji */}
                      <span className="text-sm">{meta?.emoji || '🎮'}</span>

                      {/* Player 1 avatar */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-base overflow-hidden shrink-0"
                        style={{ backgroundColor: theme.surfaceHover, boxShadow: `0 0 0 2px ${theme.primaryColor}40` }}
                      >
                        {match.player1AvatarValue.startsWith('http') ? (
                          <img src={match.player1AvatarValue} alt="" className="w-full h-full object-cover" />
                        ) : match.player1AvatarValue}
                      </div>

                      {/* VS */}
                      <span className="text-[9px] font-black" style={{ color: theme.primaryColor }}>VS</span>

                      {/* Player 2 avatar */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-base overflow-hidden shrink-0"
                        style={{ backgroundColor: theme.surfaceHover, boxShadow: `0 0 0 2px ${theme.primaryColor}40` }}
                      >
                        {match.player2AvatarValue.startsWith('http') ? (
                          <img src={match.player2AvatarValue} alt="" className="w-full h-full object-cover" />
                        ) : match.player2AvatarValue}
                      </div>

                      {/* Player 3 (OOO) */}
                      {match.player3AvatarValue && (
                        <>
                          <span className="text-[9px] font-black" style={{ color: theme.primaryColor }}>VS</span>
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-base overflow-hidden shrink-0"
                            style={{ backgroundColor: theme.surfaceHover, boxShadow: `0 0 0 2px ${theme.primaryColor}40` }}
                          >
                            {match.player3AvatarValue.startsWith('http') ? (
                              <img src={match.player3AvatarValue} alt="" className="w-full h-full object-cover" />
                            ) : match.player3AvatarValue}
                          </div>
                        </>
                      )}

                      {/* Separator dot */}
                      <div className="w-1 h-1 rounded-full mx-1" style={{ backgroundColor: theme.borderColor }} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Marquee keyframes */}
            <style>{`
              @keyframes marquee-scroll {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
            `}</style>
          </div>
        )}

        {/* ── Leaderboard ── */}
        <button
          onClick={onViewLeaderboard}
          className="mt-10 flex items-center gap-2 text-sm transition-colors duration-200 animate-in fade-in duration-700"
          style={{ animationDelay: '400ms', animationFillMode: 'backwards', color: theme.textSecondary }}
        >
          <Trophy className="w-4 h-4" />
          <span>{t('viewLeaderboard')}</span>
        </button>
      </div>
    </div>
  );
}
