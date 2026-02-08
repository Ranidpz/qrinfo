'use client';

import { useEffect, useState } from 'react';
import { PackOpening, RARITY_CONFIG } from '@/types';

interface WinnerCelebrationProps {
  winner: PackOpening;
  locale?: 'he' | 'en';
  onComplete: () => void;
  duration?: number; // Duration in ms before auto-dismiss
}

const translations = {
  he: {
    winner: 'יש לנו זוכה!',
    won: 'זכה ב:',
    congratulations: 'מזל טוב!',
  },
  en: {
    winner: 'We have a winner!',
    won: 'Won:',
    congratulations: 'Congratulations!',
  },
};

export default function WinnerCelebration({
  winner,
  locale = 'he',
  onComplete,
  duration = 10000, // 10 seconds default
}: WinnerCelebrationProps) {
  const t = translations[locale];
  const isRTL = locale === 'he';
  const config = RARITY_CONFIG[winner.prizeRarity];

  const [isVisible, setIsVisible] = useState(false);
  const [confetti, setConfetti] = useState<Array<{ id: number; left: number; delay: number; duration: number; color: string }>>([]);

  // Generate confetti on mount
  useEffect(() => {
    const colors = winner.prizeRarity === 'legendary'
      ? ['#F59E0B', '#FBBF24', '#FCD34D', '#FEF3C7', '#FFFFFF']
      : ['#8B5CF6', '#A78BFA', '#C4B5FD', '#DDD6FE', '#FFFFFF'];

    const newConfetti = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 3,
      duration: 3 + Math.random() * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setTimeout(() => setConfetti(newConfetti), 0);

    // Animate in
    setTimeout(() => setIsVisible(true), 100);

    // Auto dismiss
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 500);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete, winner.prizeRarity]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      dir={isRTL ? 'rtl' : 'ltr'}
      onClick={() => {
        setIsVisible(false);
        setTimeout(onComplete, 500);
      }}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-black/90" />

      {/* Confetti */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {confetti.map((c) => (
          <div
            key={c.id}
            className="absolute w-3 h-3 rounded-full animate-confetti-fall"
            style={{
              left: `${c.left}%`,
              top: '-20px',
              backgroundColor: c.color,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className={`relative z-10 text-center px-8 transition-transform duration-700 ${isVisible ? 'scale-100' : 'scale-50'}`}>
        {/* Winner Banner */}
        <div
          className="inline-block px-8 py-3 rounded-full text-2xl font-bold text-white mb-6 animate-bounce"
          style={{
            background: `linear-gradient(135deg, ${config.bgColor}, ${config.color})`,
            boxShadow: `0 0 50px ${config.color}80`,
          }}
        >
          {config.emoji} {t.winner} {config.emoji}
        </div>

        {/* Winner Name */}
        <h1 className="text-6xl font-black text-white mb-4 animate-pulse">
          {winner.visitorNickname}
        </h1>

        {/* Prize */}
        <div className="mb-8">
          <p className="text-2xl text-white/70 mb-2">{t.won}</p>
          <div
            className="inline-block px-8 py-4 rounded-2xl"
            style={{
              background: `linear-gradient(135deg, ${config.bgColor}40, ${config.color}40)`,
              border: `3px solid ${config.color}`,
              boxShadow: `0 0 40px ${config.color}60`,
            }}
          >
            {/* Prize Image */}
            {winner.prizeImageUrl && (
              <img
                src={winner.prizeImageUrl}
                alt=""
                className="w-24 h-24 mx-auto mb-4 rounded-xl object-cover"
              />
            )}
            <h2 className="text-4xl font-bold text-white">
              {locale === 'he' ? winner.prizeName : winner.prizeNameEn}
            </h2>
            <div
              className="inline-block mt-3 px-4 py-1 rounded-full text-sm font-bold"
              style={{ backgroundColor: config.color, color: 'white' }}
            >
              {locale === 'he' ? config.name : config.nameEn}
            </div>
          </div>
        </div>

        {/* Congratulations */}
        <p className="text-3xl text-white/80 animate-pulse">
          {t.congratulations}
        </p>
      </div>

      {/* Radial glow effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at center, ${config.color}30 0%, transparent 50%)`,
        }}
      />

      {/* CSS for confetti */}
      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }

        .animate-confetti-fall {
          animation: confetti-fall linear forwards;
        }
      `}</style>
    </div>
  );
}
