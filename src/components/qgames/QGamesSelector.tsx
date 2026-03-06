'use client';

import { useState } from 'react';
import { Pencil, Info, X, ExternalLink, Gift, Backpack } from 'lucide-react';
import { QGameType, GAME_META, QGamesConfig, LiveMatchInfo, GAME_DISPLAY_ORDER } from '@/types/qgames';
import { useQGamesTheme } from './QGamesThemeContext';
import QGamesRankBadge from './QGamesRankBadge';
import { getBorderStyle } from './QGamesAvatarBorder';
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
  onEditProfile?: () => void;
  isRTL: boolean;
  t: (key: string) => string;
  matchesPerGame?: Record<string, number>;
  queuePerGame?: Record<string, number>;
  liveMatches?: LiveMatchInfo[];
  // Rewards
  playerScore?: number;
  unopenedPacks?: number;
  onOpenPack?: () => void;
  onOpenInventory?: () => void;
  locale?: 'he' | 'en';
  playerInventoryCount?: number;
  equippedBorder?: string | null;
}

export default function QGamesSelector({
  config,
  playerNickname,
  playerAvatar,
  onSelectGame,
  onEditProfile,
  isRTL,
  t,
  matchesPerGame = {},
  queuePerGame = {},
  liveMatches = [],
  playerScore = 0,
  unopenedPacks = 0,
  onOpenPack,
  onOpenInventory,
  locale,
  playerInventoryCount = 0,
  equippedBorder,
}: QGamesSelectorProps) {
  const theme = useQGamesTheme();
  const [showInfo, setShowInfo] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const enabledSet = new Set(config.enabledGames || ['rps']);
  const enabledGames = GAME_DISPLAY_ORDER.filter(g => enabledSet.has(g));
  const gameName = config.branding.title || 'Q.Games';

  return (
    <div
      className="h-[100dvh] flex flex-col relative"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ fontFamily: 'var(--font-assistant), sans-serif' }}
    >
      {/* Keyframes */}
      <style>{`
        @keyframes game-card-bounce-in {
          0% { opacity: 0; transform: translateY(30px) scale(0.95); }
          50% { opacity: 1; transform: translateY(-4px) scale(1.01); }
          70% { transform: translateY(2px) scale(0.995); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes info-slide-up {
          0% { opacity: 0; transform: translateY(100%); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Fixed Profile Header ── */}
      <div className="shrink-0 px-4" style={{ backgroundColor: theme.backgroundColor }}>
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

        {/* Profile row — same height as info button */}
        <div
          className={`${config.branding.eventLogo ? 'pt-2' : 'pt-4'} pb-3 w-full animate-in fade-in slide-in-from-top-4 duration-500`}
        >
          {/* Main row: avatar + name/rank + info + action buttons */}
          <div className="flex items-center gap-2.5">
            {/* Avatar */}
            <button
              onClick={onEditProfile}
              className="relative group shrink-0"
              disabled={!onEditProfile}
            >
              <div className="absolute -inset-1 rounded-full blur-md transition-all duration-300" style={{ backgroundColor: `${theme.accentColor}25` }} />
              <div
                className="relative w-16 h-16 rounded-full flex items-center justify-center text-3xl overflow-hidden transition-transform duration-200 group-active:scale-95"
                style={{ backgroundColor: theme.surfaceColor, ...(equippedBorder ? getBorderStyle(equippedBorder) : { boxShadow: `0 0 0 2px ${theme.accentColor}66` }) }}
              >
                {playerAvatar.startsWith('http') ? (
                  <img src={playerAvatar} alt="" className="w-full h-full object-cover" />
                ) : playerAvatar}
              </div>
              {onEditProfile && (
                <div
                  className="absolute -bottom-0.5 -end-0.5 w-6 h-6 rounded-full flex items-center justify-center shadow-lg"
                  style={{ backgroundColor: theme.accentColor, boxShadow: `0 0 0 2px ${theme.backgroundColor}` }}
                >
                  <Pencil className="w-3 h-3 text-white" />
                </div>
              )}
            </button>

            {/* Name + rank + progress */}
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-lg tracking-tight truncate" style={{ color: theme.textColor }}>
                {playerNickname}
              </h1>
              <QGamesRankBadge
                score={playerScore}
                size="sm"
                isRTL={isRTL}
                showProgress
                locale={locale || (isRTL ? 'he' : 'en')}
              />
            </div>

            {/* Info button */}
            <button
              onClick={() => setShowInfo(true)}
              className="shrink-0 p-2 rounded-full transition-colors active:scale-95"
              style={{ color: theme.textSecondary }}
              aria-label={t('infoTitle')}
            >
              <Info className="w-5 h-5" />
            </button>

            {/* Action buttons */}
            <div className="shrink-0 flex items-center gap-1.5">
              {/* Pack notification */}
              {unopenedPacks > 0 && onOpenPack && (
                <button
                  onClick={onOpenPack}
                  className="relative flex items-center justify-center w-10 h-10 rounded-xl text-white transition-all active:scale-95"
                  style={{
                    background: `linear-gradient(135deg, #F59E0B, #EF4444)`,
                    boxShadow: `0 3px 10px rgba(245, 158, 11, 0.35)`,
                  }}
                >
                  <Gift className="w-4.5 h-4.5" />
                  <span
                    className="absolute -top-1 -end-1 w-4.5 h-4.5 rounded-full text-[9px] font-bold flex items-center justify-center animate-pulse"
                    style={{ backgroundColor: theme.accentColor, color: theme.backgroundColor }}
                  >
                    {unopenedPacks > 9 ? '9+' : unopenedPacks}
                  </span>
                </button>
              )}
              {/* Inventory */}
              {onOpenInventory && playerInventoryCount > 0 && (
                <button
                  onClick={onOpenInventory}
                  className="flex items-center justify-center w-10 h-10 rounded-xl transition-all active:scale-95"
                  style={{
                    backgroundColor: theme.surfaceColor,
                    border: `1px solid ${theme.borderColor}`,
                  }}
                >
                  <Backpack className="w-4.5 h-4.5" style={{ color: theme.textSecondary }} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Scrollable Games Section ── */}
      <div className="flex-1 overflow-y-auto px-6 pb-20 flex flex-col items-center">
        {/* Game title */}
        {gameName !== 'Q.Games' && (
          <p className="text-sm font-bold tracking-wide mb-3" style={{ color: theme.textColor, opacity: 0.7 }}>
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
                className="w-full flex items-center gap-4 p-4 rounded-2xl active:scale-[0.97] transition-all duration-200 group"
                style={{
                  animation: `game-card-bounce-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${300 + index * 120}ms backwards`,
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

      </div>

      {/* ── Info Modal ── */}
      {showInfo && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => { setShowInfo(false); setShowLeaveConfirm(false); }}
        >
          <div
            className="rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-5 pb-8 sm:pb-5 relative max-h-[85vh] overflow-y-auto"
            dir={isRTL ? 'rtl' : 'ltr'}
            style={{
              backgroundColor: theme.surfaceColor,
              border: `1px solid ${theme.borderColor}`,
              scrollbarWidth: 'none',
              animation: 'info-slide-up 0.3s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle (mobile) */}
            <div className="sm:hidden flex justify-center mb-3">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: theme.borderColor }} />
            </div>

            {/* Close button */}
            <button
              onClick={() => { setShowInfo(false); setShowLeaveConfirm(false); }}
              className="absolute top-3 end-3 p-1 transition-colors"
              style={{ color: theme.textSecondary }}
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${theme.primaryColor}20` }}
              >
                <Info className="w-5 h-5" style={{ color: theme.primaryColor }} />
              </div>
              <h2 className="font-bold text-lg" style={{ color: theme.textColor }}>
                {t('infoTitle')}
              </h2>
            </div>

            {/* Content */}
            <div className="space-y-3">
              <p className="text-sm leading-relaxed" style={{ color: theme.textColor }}>
                {t('infoDesc1')}
              </p>

              <p className="text-sm leading-relaxed" style={{ color: theme.textSecondary }}>
                {t('infoDesc2')}
              </p>

              <div
                className="rounded-xl p-3"
                style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.18)' }}
              >
                <p className="text-sm leading-relaxed" style={{ color: theme.textColor }}>
                  {t('infoDesc3')}
                </p>
                <p className="text-xs mt-1.5 leading-relaxed" style={{ color: theme.textSecondary }}>
                  {t('infoDesc3Note')}
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="my-4" style={{ borderTop: `1px solid ${theme.borderColor}` }} />

            {/* The Q link */}
            <p className="text-sm leading-relaxed mb-3 text-center" style={{ color: theme.textSecondary }}>
              {t('infoDesc4')}
            </p>

            {!showLeaveConfirm ? (
              <button
                onClick={() => setShowLeaveConfirm(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
                style={{
                  backgroundColor: `${theme.primaryColor}15`,
                  color: theme.primaryColor,
                  border: `1px solid ${theme.primaryColor}30`,
                }}
              >
                <ExternalLink className="w-4 h-4" />
                {t('infoVisitTheQ')}
              </button>
            ) : (
              <div className="text-center">
                <p className="font-bold text-sm mb-1" style={{ color: theme.textColor }}>
                  {t('infoLeaveTitle')}
                </p>
                <p className="text-xs mb-3" style={{ color: theme.textSecondary }}>
                  {t('infoLeaveMessage')}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowLeaveConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors"
                    style={{ backgroundColor: theme.surfaceHover, color: theme.textColor }}
                  >
                    {t('infoStay')}
                  </button>
                  <button
                    onClick={() => {
                      window.open('https://theq.app', '_blank');
                      setShowLeaveConfirm(false);
                    }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors text-white"
                    style={{ background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})` }}
                  >
                    {t('infoGo')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
