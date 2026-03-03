'use client';

import { useState, useEffect } from 'react';

interface QGamesVSScreenProps {
  player1Nickname: string;
  player1Avatar: string;
  player2Nickname: string;
  player2Avatar: string;
  gameEmoji: string;
  onCountdownComplete: () => void;
  isRTL: boolean;
}

export default function QGamesVSScreen({
  player1Nickname,
  player1Avatar,
  player2Nickname,
  player2Avatar,
  gameEmoji,
  onCountdownComplete,
  isRTL,
}: QGamesVSScreenProps) {
  const [countdown, setCountdown] = useState(3);
  const [showVS, setShowVS] = useState(false);

  useEffect(() => {
    // Show VS text after mount
    const vsTimer = setTimeout(() => setShowVS(true), 300);

    // Start countdown after 1s
    const startTimer = setTimeout(() => {
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            setTimeout(onCountdownComplete, 300);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }, 1200);

    return () => {
      clearTimeout(vsTimer);
      clearTimeout(startTimer);
    };
  }, [onCountdownComplete]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-transparent to-emerald-900/20" />

      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-sm">
        {/* Player 1 */}
        <div className="flex items-center gap-4 w-full animate-in slide-in-from-left duration-500">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-3xl ring-2 ring-blue-400/40 shadow-lg shadow-blue-500/20 overflow-hidden">
            {player1Avatar.startsWith('http') ? (
              <img src={player1Avatar} alt="" className="w-full h-full object-cover" />
            ) : player1Avatar}
          </div>
          <div className="flex-1">
            <p className="text-white font-bold text-lg truncate">{player1Nickname}</p>
          </div>
        </div>

        {/* VS */}
        <div className={`transition-all duration-500 ${showVS ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
          <div className="relative">
            <span className="text-5xl font-black text-white/90" style={{ textShadow: '0 0 30px rgba(139, 92, 246, 0.5)' }}>
              VS
            </span>
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-3xl">
              {gameEmoji}
            </div>
          </div>
        </div>

        {/* Player 2 */}
        <div className="flex items-center gap-4 w-full animate-in slide-in-from-right duration-500" style={{ animationDelay: '200ms' }}>
          <div className="flex-1 text-end">
            <p className="text-white font-bold text-lg truncate">{player2Nickname}</p>
          </div>
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-3xl ring-2 ring-red-400/40 shadow-lg shadow-red-500/20 overflow-hidden">
            {player2Avatar.startsWith('http') ? (
              <img src={player2Avatar} alt="" className="w-full h-full object-cover" />
            ) : player2Avatar}
          </div>
        </div>

        {/* Countdown */}
        {countdown > 0 && (
          <div className="mt-8">
            <div
              key={countdown}
              className="text-7xl font-black text-white animate-in zoom-in duration-300"
              style={{ textShadow: '0 0 40px rgba(16, 185, 129, 0.6)' }}
            >
              {countdown}
            </div>
          </div>
        )}

        {countdown === 0 && (
          <div className="mt-8 animate-in zoom-in duration-200">
            <span className="text-3xl font-black text-emerald-400" style={{ textShadow: '0 0 30px rgba(16, 185, 129, 0.6)' }}>
              GO!
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
