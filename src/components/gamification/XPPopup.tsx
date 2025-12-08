'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { formatXP } from '@/lib/xp';

interface XPPopupProps {
  xp: number;
  locale?: 'he' | 'en';
  onComplete?: () => void;
  className?: string;
}

// Generate random stars for the trail effect
function generateStars(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 0.8 + Math.random() * 0.4,
    size: 8 + Math.random() * 8,
  }));
}

export default function XPPopup({
  xp,
  locale = 'he',
  onComplete,
  className = '',
}: XPPopupProps) {
  const [phase, setPhase] = useState<'enter' | 'show' | 'exit'>('enter');

  // Generate stars once on mount
  const stars = useMemo(() => generateStars(8), []);

  useEffect(() => {
    // Enter -> Show
    const showTimeout = setTimeout(() => setPhase('show'), 100);

    // Show -> Exit
    const exitTimeout = setTimeout(() => setPhase('exit'), 1500);

    // Complete
    const completeTimeout = setTimeout(() => {
      onComplete?.();
    }, 2500);

    return () => {
      clearTimeout(showTimeout);
      clearTimeout(exitTimeout);
      clearTimeout(completeTimeout);
    };
  }, [onComplete]);

  if (phase === 'exit' && !onComplete) return null;

  return (
    <div
      className={`
        fixed z-50 pointer-events-none
        flex items-center justify-center
        ${className}
      `}
      style={{
        top: '35%',
        left: '50%',
        transform: 'translateX(-50%)',
      }}
    >
      {/* Stars trail */}
      <div className="absolute inset-0 w-64 h-32 -translate-x-1/2">
        {stars.map((star) => (
          <div
            key={star.id}
            className={`
              absolute text-yellow-400
              ${phase === 'show' || phase === 'exit' ? 'animate-star-burst' : 'opacity-0'}
            `}
            style={{
              left: `${star.left}%`,
              top: '50%',
              fontSize: `${star.size}px`,
              animationDelay: `${star.delay}s`,
              animationDuration: `${star.duration}s`,
            }}
          >
            ✦
          </div>
        ))}
      </div>

      {/* Main XP badge */}
      <div
        className={`
          relative px-8 py-4 rounded-2xl
          bg-gradient-to-br from-emerald-400 via-green-500 to-emerald-600
          text-white font-bold text-2xl
          shadow-2xl shadow-emerald-500/30
          border-2 border-emerald-300/50
          transition-all duration-500 ease-out
          ${phase === 'enter'
            ? 'opacity-0 scale-50'
            : phase === 'show'
              ? 'opacity-100 scale-100'
              : 'opacity-0 scale-110 -translate-y-12'
          }
        `}
      >
        {/* Inner glow */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-transparent to-white/20" />

        {/* Sparkle decorations */}
        <span className="absolute -top-2 -left-2 text-xl animate-pulse">✨</span>
        <span className="absolute -top-1 -right-3 text-lg animate-pulse" style={{ animationDelay: '0.3s' }}>⭐</span>
        <span className="absolute -bottom-2 -right-1 text-xl animate-pulse" style={{ animationDelay: '0.6s' }}>✨</span>

        {/* XP text */}
        <span className="relative z-10 drop-shadow-lg">
          +{formatXP(xp, locale)} XP
        </span>
      </div>

      {/* CSS for custom animations */}
      <style jsx>{`
        @keyframes star-burst {
          0% {
            opacity: 0;
            transform: translateY(0) scale(0);
          }
          20% {
            opacity: 1;
            transform: translateY(-10px) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-60px) scale(0.5);
          }
        }

        .animate-star-burst {
          animation: star-burst 1s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

// Hook for managing XP popup queue
export function useXPPopup() {
  const [popups, setPopups] = useState<{ id: number; xp: number }[]>([]);
  const [idCounter, setIdCounter] = useState(0);

  const showPopup = useCallback((xp: number) => {
    const id = idCounter;
    setIdCounter((prev) => prev + 1);
    setPopups((prev) => [...prev, { id, xp }]);
  }, [idCounter]);

  const removePopup = useCallback((id: number) => {
    setPopups((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { popups, showPopup, removePopup };
}

// Component to render multiple popups
interface XPPopupContainerProps {
  popups: { id: number; xp: number }[];
  onRemove: (id: number) => void;
  locale?: 'he' | 'en';
}

export function XPPopupContainer({
  popups,
  onRemove,
  locale = 'he',
}: XPPopupContainerProps) {
  return (
    <>
      {popups.map((popup) => (
        <XPPopup
          key={popup.id}
          xp={popup.xp}
          locale={locale}
          onComplete={() => onRemove(popup.id)}
        />
      ))}
    </>
  );
}
