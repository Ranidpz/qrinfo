'use client';

import { useState, useEffect } from 'react';

interface QGamesVSScreenProps {
  player1Nickname: string;
  player1Avatar: string;
  player2Nickname: string;
  player2Avatar: string;
  player3Nickname?: string;
  player3Avatar?: string;
  gameEmoji: string;
  onCountdownComplete: () => void;
  isRTL: boolean;
}

function PlayerRow({ nickname, avatar, ringColor, shadowColor, animateFrom, delay }: {
  nickname: string; avatar: string; ringColor: string; shadowColor: string;
  animateFrom: 'left' | 'right'; delay?: string;
}) {
  const isLeft = animateFrom === 'left';
  return (
    <div
      className={`flex items-center gap-4 w-full animate-in ${isLeft ? 'slide-in-from-left' : 'slide-in-from-right'} duration-500`}
      style={delay ? { animationDelay: delay } : undefined}
    >
      {!isLeft && (
        <div className="flex-1 text-end">
          <p className="text-white font-bold text-lg truncate">{nickname}</p>
        </div>
      )}
      <div className={`w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-3xl ring-2 ${ringColor} shadow-lg ${shadowColor} overflow-hidden`}>
        {avatar.startsWith('http') ? (
          <img src={avatar} alt="" className="w-full h-full object-cover" />
        ) : avatar}
      </div>
      {isLeft && (
        <div className="flex-1">
          <p className="text-white font-bold text-lg truncate">{nickname}</p>
        </div>
      )}
    </div>
  );
}

export default function QGamesVSScreen({
  player1Nickname,
  player1Avatar,
  player2Nickname,
  player2Avatar,
  player3Nickname,
  player3Avatar,
  gameEmoji,
  onCountdownComplete,
}: QGamesVSScreenProps) {
  const [countdown, setCountdown] = useState(3);
  const [showVS, setShowVS] = useState(false);
  const is3Player = !!player3Nickname;

  useEffect(() => {
    const vsTimer = setTimeout(() => setShowVS(true), 300);

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
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-transparent to-emerald-900/20" />

      <div className="relative z-10 flex flex-col items-center gap-5 w-full max-w-sm">
        {/* Player 1 */}
        <PlayerRow
          nickname={player1Nickname}
          avatar={player1Avatar}
          ringColor="ring-blue-400/40"
          shadowColor="shadow-blue-500/20"
          animateFrom="left"
        />

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
        <PlayerRow
          nickname={player2Nickname}
          avatar={player2Avatar}
          ringColor="ring-red-400/40"
          shadowColor="shadow-red-500/20"
          animateFrom="right"
          delay="200ms"
        />

        {/* Player 3 (for 3-player games) */}
        {is3Player && player3Avatar && (
          <PlayerRow
            nickname={player3Nickname}
            avatar={player3Avatar}
            ringColor="ring-amber-400/40"
            shadowColor="shadow-amber-500/20"
            animateFrom="left"
            delay="400ms"
          />
        )}

        {/* Countdown */}
        {countdown > 0 && (
          <div className="mt-6">
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
          <div className="mt-6 animate-in zoom-in duration-200">
            <span className="text-3xl font-black text-emerald-400" style={{ textShadow: '0 0 30px rgba(16, 185, 129, 0.6)' }}>
              GO!
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
