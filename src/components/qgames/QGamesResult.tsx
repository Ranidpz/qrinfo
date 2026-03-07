'use client';

import { useState, useEffect } from 'react';
import { RotateCcw, Trophy, Share2, ChevronRight, ChevronLeft, Gift } from 'lucide-react';
import { useQGamesTheme } from './QGamesThemeContext';
import { QGameType } from '@/types/qgames';
import RPSAnimatedEmoji from './RPSAnimatedEmoji';
import OOOAnimatedEmoji from './OOOAnimatedEmoji';
import TTTAnimatedEmoji from './TTTAnimatedEmoji';
import MemoryAnimatedEmoji from './MemoryAnimatedEmoji';
import Connect4AnimatedEmoji from './Connect4AnimatedEmoji';
import FroggerAnimatedEmoji from './FroggerAnimatedEmoji';

interface QGamesResultProps {
  isWinner: boolean;
  isDraw: boolean;
  myScore: number;
  oppScore: number;
  myNickname: string;
  myAvatar: string;
  oppNickname: string;
  oppAvatar: string;
  gameName: string;
  gameType: QGameType;
  onPlayAgain: () => void;
  onBackToSelector: () => void;
  onViewLeaderboard: () => void;
  isRTL: boolean;
  t: (key: string) => string;
  // WhatsApp share
  shortId?: string;
  visitorId?: string;
  enableWhatsApp?: boolean;
  // 3-player game support
  is3Player?: boolean;
  thirdPlayerNickname?: string;
  thirdPlayerAvatar?: string;
  thirdPlayerScore?: number;
  // Rewards
  packsEarned?: number;
  onOpenPack?: () => void;
}

const ANIMATED_EMOJI: Record<QGameType, React.ComponentType<{ className?: string }>> = {
  rps: RPSAnimatedEmoji,
  oddoneout: OOOAnimatedEmoji,
  tictactoe: TTTAnimatedEmoji,
  connect4: Connect4AnimatedEmoji,
  memory: MemoryAnimatedEmoji,
  frogger: FroggerAnimatedEmoji,
};

export default function QGamesResult({
  isWinner,
  isDraw,
  myScore,
  oppScore,
  myNickname,
  myAvatar,
  oppNickname,
  oppAvatar,
  gameName,
  gameType,
  onPlayAgain,
  onBackToSelector,
  onViewLeaderboard,
  isRTL,
  t,
  shortId,
  visitorId,
  enableWhatsApp,
  is3Player,
  thirdPlayerNickname,
  thirdPlayerAvatar,
  thirdPlayerScore,
  packsEarned = 0,
  onOpenPack,
}: QGamesResultProps) {
  const theme = useQGamesTheme();
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isWinner) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }
  }, [isWinner]);

  const AnimatedEmoji = ANIMATED_EMOJI[gameType];

  const handleWhatsAppShare = () => {
    if (!shortId) return;
    const baseUrl = `https://qr.playzones.app/v/${shortId}`;
    const params = new URLSearchParams();
    if (visitorId) params.set('invite', visitorId);
    params.set('game', gameType);
    const shareUrl = `${baseUrl}?${params}`;
    const message = isRTL
      ? (isWinner
        ? `🏆 ניצחתי את ${oppNickname} ב${gameName}!\n💪 ${myScore}:${oppScore}\n🎮 בואו לשחק איתי!\n${shareUrl}`
        : isDraw
          ? `🤝 תיקו עם ${oppNickname} ב${gameName}!\n💪 ${myScore}:${oppScore}\n🎮 בואו לשחק איתי!\n${shareUrl}`
          : `😤 הפסדתי ל${oppNickname} ב${gameName}!\n💪 ${myScore}:${oppScore}\n🎮 בואו לשחק איתי!\n${shareUrl}`)
      : (isWinner
        ? `🏆 I beat ${oppNickname} at ${gameName}!\n💪 ${myScore}:${oppScore}\n🎮 Come play with me!\n${shareUrl}`
        : isDraw
          ? `🤝 Drew with ${oppNickname} at ${gameName}!\n💪 ${myScore}:${oppScore}\n🎮 Come play with me!\n${shareUrl}`
          : `😤 Lost to ${oppNickname} at ${gameName}!\n💪 ${myScore}:${oppScore}\n🎮 Come play with me!\n${shareUrl}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Back button - top */}
      <button
        onClick={onBackToSelector}
        className="absolute top-4 start-4 flex items-center gap-1 py-2 px-3 rounded-xl text-sm font-medium transition-all active:scale-95 z-10"
        style={{ color: theme.textSecondary }}
      >
        {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        {t('backToGames')}
      </button>

      {/* Confetti particles for winner */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-10px',
                backgroundColor: [theme.accentColor, '#f59e0b', theme.primaryColor, '#ef4444', '#3b82f6'][i % 5],
                animation: `confetti-fall ${1.5 + Math.random() * 2}s linear ${Math.random() * 0.5}s forwards`,
              }}
            />
          ))}
          <style>{`
            @keyframes confetti-fall {
              0% { transform: translateY(0) rotate(0deg); opacity: 1; }
              100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
            }
          `}</style>
        </div>
      )}

      {/* Game Name Header with Animated Emoji */}
      <div className="flex items-center gap-2 mb-4 animate-in fade-in slide-in-from-top-2 duration-500">
        <div className="text-2xl">
          <AnimatedEmoji />
        </div>
        <h2 className="text-lg font-bold" style={{ color: theme.textSecondary }}>
          {gameName}
        </h2>
      </div>

      {/* Result Icon */}
      <div className="mb-6 animate-in zoom-in duration-500">
        {isWinner ? (
          <div className="text-7xl">🏆</div>
        ) : isDraw ? (
          <div className="text-7xl">🤝</div>
        ) : (
          <div className="text-7xl">😤</div>
        )}
      </div>

      {/* Result Text */}
      <h1 className="text-3xl font-black mb-2 animate-in fade-in duration-500"
        style={{ color: isWinner ? theme.accentColor : isDraw ? '#facc15' : theme.textSecondary }}
      >
        {is3Player
          ? (isWinner ? t('youSurvivedMatch') : t('youWereEliminated'))
          : (isWinner ? t('youWon') : isDraw ? t('draw') : t('youLost'))
        }
      </h1>

      {/* Score */}
      <div className="flex items-center gap-4 mb-8 animate-in fade-in-50 duration-500" style={{ animationDelay: '200ms' }}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl mx-auto mb-1 overflow-hidden" style={{ backgroundColor: theme.surfaceColor }}>
            {myAvatar.startsWith('http') ? (
              <img src={myAvatar} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : myAvatar}
          </div>
          <p className="text-xs truncate max-w-[80px]" style={{ color: theme.textColor }}>{myNickname}</p>
          <p className="text-2xl font-black" style={{ color: isWinner ? theme.accentColor : theme.textColor }}>{myScore}</p>
        </div>
        <span className="text-xl font-bold" style={{ color: theme.borderColor }}>:</span>
        <div className="text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl mx-auto mb-1 overflow-hidden" style={{ backgroundColor: theme.surfaceColor }}>
            {oppAvatar.startsWith('http') ? (
              <img src={oppAvatar} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : oppAvatar}
          </div>
          <p className="text-xs truncate max-w-[80px]" style={{ color: theme.textColor }}>{oppNickname}</p>
          <p className="text-2xl font-black" style={{ color: !isWinner && !isDraw ? '#f87171' : theme.textColor }}>{oppScore}</p>
        </div>
        {is3Player && thirdPlayerAvatar && (
          <>
            <span className="text-xl font-bold" style={{ color: theme.borderColor }}>:</span>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl mx-auto mb-1 overflow-hidden" style={{ backgroundColor: theme.surfaceColor }}>
                {thirdPlayerAvatar.startsWith('http') ? (
                  <img src={thirdPlayerAvatar} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : thirdPlayerAvatar}
              </div>
              <p className="text-xs truncate max-w-[80px]" style={{ color: theme.textColor }}>{thirdPlayerNickname}</p>
              <p className="text-2xl font-black" style={{ color: theme.textColor }}>{thirdPlayerScore}</p>
            </div>
          </>
        )}
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-sm space-y-3 animate-in fade-in-50 slide-in-from-bottom-4 duration-500" style={{ animationDelay: '400ms' }}>
        <button
          onClick={onPlayAgain}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-lg transition-all active:scale-95 text-white"
          style={{ background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})` }}
        >
          <RotateCcw className="w-5 h-5" />
          {t('playAgain')}
        </button>

        {/* Open Pack */}
        {packsEarned > 0 && onOpenPack && (
          <button
            onClick={onOpenPack}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-lg transition-all active:scale-95 text-white animate-pulse"
            style={{
              background: 'linear-gradient(135deg, #F59E0B, #EF4444)',
              boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)',
            }}
          >
            <Gift className="w-5 h-5" />
            {t('openPack')}
          </button>
        )}

        {/* WhatsApp Share */}
        {enableWhatsApp && shortId && (
          <button
            onClick={handleWhatsAppShare}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all active:scale-95 text-white"
            style={{ background: '#25D366' }}
          >
            <Share2 className="w-4 h-4" />
            {t('shareOnWhatsApp')}
          </button>
        )}

        <button
          onClick={onViewLeaderboard}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all active:scale-95"
          style={{ color: theme.textSecondary, backgroundColor: theme.surfaceColor, border: `1px solid ${theme.borderColor}` }}
        >
          <Trophy className="w-4 h-4" />
          {t('viewLeaderboard')}
        </button>

      </div>
    </div>
  );
}
