'use client';

import { useState, useEffect } from 'react';
import { useQGamesTheme } from './QGamesThemeContext';

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

function PlayerCard({ nickname, avatar, ringColor, glowColor, animateFrom, delay }: {
  nickname: string; avatar: string; ringColor: string; glowColor: string;
  animateFrom: 'left' | 'right'; delay?: string;
}) {
  const isLeft = animateFrom === 'left';
  return (
    <div
      className={`flex ${isLeft ? 'flex-row' : 'flex-row-reverse'} items-center gap-4 animate-in ${isLeft ? 'slide-in-from-left-12' : 'slide-in-from-right-12'} duration-700 ease-out`}
      style={delay ? { animationDelay: delay } : undefined}
    >
      <div className="relative">
        {/* Glow ring behind avatar */}
        <div className={`absolute inset-[-4px] rounded-full ${glowColor} blur-md animate-pulse`} />
        <div className={`relative w-24 h-24 rounded-full bg-white/10 flex items-center justify-center text-5xl ring-3 ${ringColor} overflow-hidden`}>
          {avatar.startsWith('http') ? (
            <img src={avatar} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : avatar}
        </div>
      </div>
      <div className={isLeft ? 'text-start' : 'text-end'}>
        <p className="text-white font-black text-xl tracking-wide truncate max-w-[160px]">{nickname}</p>
      </div>
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
  onCountdownComplete,
}: QGamesVSScreenProps) {
  const theme = useQGamesTheme();
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
      {/* Radial background glow */}
      <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${theme.primaryColor}4d, transparent, ${theme.accentColor}4d)` }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full blur-[80px]" style={{ backgroundColor: `${theme.primaryColor}1a` }} />

      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-sm">
        {/* Player 1 */}
        <PlayerCard
          nickname={player1Nickname}
          avatar={player1Avatar}
          ringColor="ring-blue-400/50"
          glowColor="bg-blue-500/30"
          animateFrom="left"
        />

        {/* VS */}
        <div className={`transition-all duration-700 ease-out ${showVS ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
          <span
            className="text-6xl font-black tracking-tighter bg-gradient-to-b from-white via-white/90 to-white/60 bg-clip-text text-transparent"
            style={{ textShadow: `0 0 40px ${theme.primaryColor}99, 0 0 80px ${theme.primaryColor}4d` }}
          >
            VS
          </span>
        </div>

        {/* Player 2 */}
        <PlayerCard
          nickname={player2Nickname}
          avatar={player2Avatar}
          ringColor="ring-red-400/50"
          glowColor="bg-red-500/30"
          animateFrom="right"
          delay="200ms"
        />

        {/* Player 3 (for 3-player games) */}
        {is3Player && player3Avatar && (
          <PlayerCard
            nickname={player3Nickname!}
            avatar={player3Avatar}
            ringColor="ring-amber-400/50"
            glowColor="bg-amber-500/30"
            animateFrom="left"
            delay="400ms"
          />
        )}

        {/* Countdown */}
        {countdown > 0 && (
          <div className="mt-4">
            <div
              key={countdown}
              className="text-8xl font-black text-white animate-in zoom-in duration-300"
              style={{ textShadow: `0 0 50px ${theme.accentColor}b3, 0 0 100px ${theme.accentColor}4d` }}
            >
              {countdown}
            </div>
          </div>
        )}

        {countdown === 0 && (
          <div className="mt-4 animate-in zoom-in duration-200">
            <span
              className="text-4xl font-black"
              style={{ color: theme.accentColor, textShadow: `0 0 40px ${theme.accentColor}b3, 0 0 80px ${theme.accentColor}4d` }}
            >
              GO!
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
