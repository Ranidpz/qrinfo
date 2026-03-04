'use client';

import { useState, useEffect } from 'react';
import { RotateCcw, Trophy, List } from 'lucide-react';

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
  onPlayAgain: () => void;
  onBackToSelector: () => void;
  onViewLeaderboard: () => void;
  isRTL: boolean;
  t: (key: string) => string;
  // 3-player game support
  is3Player?: boolean;
  thirdPlayerNickname?: string;
  thirdPlayerAvatar?: string;
  thirdPlayerScore?: number;
}

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
  onPlayAgain,
  onBackToSelector,
  onViewLeaderboard,
  isRTL,
  t,
  is3Player,
  thirdPlayerNickname,
  thirdPlayerAvatar,
  thirdPlayerScore,
}: QGamesResultProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isWinner) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }
  }, [isWinner]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
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
                backgroundColor: ['#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#3b82f6'][i % 5],
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
      <h1 className={`text-3xl font-black mb-2 animate-in fade-in duration-500 ${
        isWinner ? 'text-emerald-400' : isDraw ? 'text-yellow-400' : 'text-white/70'
      }`}>
        {is3Player
          ? (isWinner ? t('youSurvivedMatch') : t('youWereEliminated'))
          : (isWinner ? t('youWon') : isDraw ? t('draw') : t('youLost'))
        }
      </h1>

      {/* Score */}
      <div className="flex items-center gap-4 mb-8 animate-in fade-in-50 duration-500" style={{ animationDelay: '200ms' }}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-2xl mx-auto mb-1 overflow-hidden">
            {myAvatar.startsWith('http') ? (
              <img src={myAvatar} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : myAvatar}
          </div>
          <p className="text-white text-xs truncate max-w-[80px]">{myNickname}</p>
          <p className={`text-2xl font-black ${isWinner ? 'text-emerald-400' : 'text-white'}`}>{myScore}</p>
        </div>
        <span className="text-white/20 text-xl font-bold">:</span>
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-2xl mx-auto mb-1 overflow-hidden">
            {oppAvatar.startsWith('http') ? (
              <img src={oppAvatar} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : oppAvatar}
          </div>
          <p className="text-white text-xs truncate max-w-[80px]">{oppNickname}</p>
          <p className={`text-2xl font-black ${!isWinner && !isDraw ? 'text-red-400' : 'text-white'}`}>{oppScore}</p>
        </div>
        {is3Player && thirdPlayerAvatar && (
          <>
            <span className="text-white/20 text-xl font-bold">:</span>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-2xl mx-auto mb-1 overflow-hidden">
                {thirdPlayerAvatar.startsWith('http') ? (
                  <img src={thirdPlayerAvatar} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : thirdPlayerAvatar}
              </div>
              <p className="text-white text-xs truncate max-w-[80px]">{thirdPlayerNickname}</p>
              <p className="text-2xl font-black text-white">{thirdPlayerScore}</p>
            </div>
          </>
        )}
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-sm space-y-3 animate-in fade-in-50 slide-in-from-bottom-4 duration-500" style={{ animationDelay: '400ms' }}>
        <button
          onClick={onPlayAgain}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-lg transition-all active:scale-95"
          style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white' }}
        >
          <RotateCcw className="w-5 h-5" />
          {t('playAgain')}
        </button>

        <button
          onClick={onViewLeaderboard}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-95"
        >
          <Trophy className="w-4 h-4" />
          {t('viewLeaderboard')}
        </button>

        <button
          onClick={onBackToSelector}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white/40 hover:text-white/60 transition-all"
        >
          <List className="w-4 h-4" />
          {t('backToGames')}
        </button>
      </div>
    </div>
  );
}
