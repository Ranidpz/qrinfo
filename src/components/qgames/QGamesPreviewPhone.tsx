'use client';

import { QGamesConfig, GAME_META, resolveTheme } from '@/types/qgames';

interface QGamesPreviewPhoneProps {
  config: QGamesConfig;
  isRTL: boolean;
}

export default function QGamesPreviewPhone({ config, isRTL }: QGamesPreviewPhoneProps) {
  const theme = resolveTheme(config.branding);
  const gameName = config.branding.title || 'Q.Games';
  const lang = isRTL ? 'he' : 'en';

  const nameMap: Record<string, { he: string; en: string }> = {
    rps: { he: 'אבן נייר ומספריים', en: 'Rock Paper Scissors' },
    oddoneout: { he: 'משלוש יוצא א....חד!', en: 'Odd One Out' },
    tictactoe: { he: 'איקס מיקס דריקס', en: 'Tic-Tac-Toe' },
    memory: { he: 'זיכרון', en: 'Memory Match' },
    connect4: { he: 'ארבע בשורה', en: 'Connect 4' },
  };

  const descMap: Record<string, { he: string; en: string }> = {
    rps: { he: '2 שחקנים', en: '2 players' },
    oddoneout: { he: '3 שחקנים', en: '3 players' },
    tictactoe: { he: '2 שחקנים', en: '2 players' },
    memory: { he: '2-6 שחקנים', en: '2-6 players' },
    connect4: { he: '2 שחקנים', en: '2 players' },
  };

  return (
    <div
      className="w-[240px] h-[480px] rounded-[2rem] border-2 overflow-hidden shadow-2xl flex flex-col relative"
      style={{
        borderColor: theme.borderColor,
        backgroundColor: theme.backgroundColor,
      }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Background image layer */}
      {config.branding.backgroundImage && (
        <>
          <div
            className="absolute inset-0 z-0"
            style={{
              backgroundImage: `url(${config.branding.backgroundImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              ...(config.branding.backgroundBlur ? { filter: `blur(${config.branding.backgroundBlur * 0.5}px)` } : {}),
            }}
          />
          <div
            className="absolute inset-0 z-0"
            style={{ backgroundColor: `rgba(0, 0, 0, ${(config.branding.imageOverlayOpacity ?? 40) / 100})` }}
          />
        </>
      )}

      {/* Phone notch */}
      <div className="relative z-10 flex justify-center pt-2 pb-1">
        <div className="w-16 h-1 rounded-full" style={{ backgroundColor: theme.borderColor }} />
      </div>

      {/* Content area */}
      <div className="relative z-10 flex-1 px-3 pb-3 overflow-hidden flex flex-col items-center">
        {/* Event Logo */}
        {config.branding.eventLogo && (
          <div className="flex justify-center pt-1 pb-1">
            <img
              src={config.branding.eventLogo}
              alt=""
              className="object-contain"
              style={{ maxHeight: `${24 * (config.branding.logoScale ?? 1)}px`, maxWidth: '60%' }}
            />
          </div>
        )}

        {/* ── Profile hero (matches real selector) ── */}
        <div className="flex flex-col items-center pt-3 pb-2 w-full">
          {/* Avatar with glow */}
          <div className="relative mb-2">
            <div
              className="absolute -inset-1 rounded-full blur-sm"
              style={{ backgroundColor: `${theme.accentColor}33` }}
            />
            <div
              className="relative w-12 h-12 rounded-full flex items-center justify-center text-xl"
              style={{
                backgroundColor: theme.surfaceColor,
                boxShadow: `0 0 0 2px ${theme.accentColor}66`,
              }}
            >
              😎
            </div>
          </div>

          {/* Player name */}
          <p className="text-[11px] font-bold" style={{ color: theme.textColor }}>
            {isRTL ? 'שחקן' : 'Player'}
          </p>

          {/* Tagline */}
          <p className="text-[8px] mt-0.5" style={{ color: theme.textSecondary }}>
            {isRTL ? 'בחרו משחק ושחקו!' : 'Choose a game & play!'}
          </p>

          {/* Online count */}
          <div className="flex items-center gap-1 mt-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.accentColor }} />
            <span className="text-[8px] font-medium" style={{ color: `${theme.accentColor}b3` }}>
              12
            </span>
            <span className="text-[8px]" style={{ color: theme.textSecondary }}>
              {isRTL ? 'מחוברים' : 'online'}
            </span>
          </div>
        </div>

        {/* Game name (if custom) */}
        {gameName !== 'Q.Games' && (
          <p className="text-[7px] font-medium uppercase tracking-wider mb-1.5" style={{ color: theme.textSecondary }}>
            {gameName}
          </p>
        )}

        {/* ── Game cards (matches real selector layout) ── */}
        <div className="w-full space-y-1.5 flex-1 overflow-hidden">
          {config.enabledGames.map((gameType) => {
            const meta = GAME_META[gameType];
            return (
              <div
                key={gameType}
                className="flex items-center gap-2 p-1.5 rounded-xl"
                style={{
                  backgroundColor: theme.surfaceColor,
                  border: `1px solid ${theme.borderColor}`,
                }}
              >
                {/* Emoji box (like real selector) */}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                  style={{ backgroundColor: theme.surfaceHover }}
                >
                  {meta.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-bold truncate" style={{ color: theme.textColor }}>
                    {nameMap[gameType]?.[lang] || gameType}
                  </p>
                  <div className="flex items-center gap-1 mt-px">
                    <p className="text-[7px]" style={{ color: theme.textSecondary }}>
                      {descMap[gameType]?.[lang]}
                    </p>
                    <span
                      className="px-1 rounded-full text-[6px] font-bold leading-tight"
                      style={{ backgroundColor: `${theme.primaryColor}33`, color: theme.primaryColor }}
                    >
                      {descMap[gameType]?.[lang]}
                    </span>
                  </div>
                  {/* Online dot */}
                  <div className="flex items-center gap-0.5 mt-0.5">
                    <div className="w-1 h-1 rounded-full" style={{ backgroundColor: theme.accentColor }} />
                    <span className="text-[6px]" style={{ color: `${theme.accentColor}cc` }}>
                      0 {isRTL ? 'מחוברים' : 'online'}
                    </span>
                  </div>
                </div>
                {/* Chevron */}
                <span className="text-[10px] shrink-0" style={{ color: theme.borderColor }}>
                  {isRTL ? '‹' : '›'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Leaderboard link */}
        <div className="mt-auto pt-2 flex items-center justify-center gap-1">
          <span className="text-[9px]">🏆</span>
          <span className="text-[8px] font-medium" style={{ color: theme.textSecondary }}>
            {isRTL ? 'טבלת מובילים' : 'Leaderboard'}
          </span>
        </div>
      </div>
    </div>
  );
}
