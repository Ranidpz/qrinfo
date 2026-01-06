'use client';

import { memo, useState, useEffect, useCallback } from 'react';

interface QStageCountdownProps {
  duration?: number; // seconds (default 3)
  onComplete: () => void;
  primaryColor?: string;
}

/**
 * QStageCountdown - Dramatic 3-2-1 countdown overlay
 * Full-screen with cinematic number animations
 */
export const QStageCountdown = memo(function QStageCountdown({
  duration = 3,
  onComplete,
  primaryColor = '#00d4ff',
}: QStageCountdownProps) {
  const [count, setCount] = useState(duration);
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    if (count <= 0) {
      // Show "GO!" briefly then complete
      const timeout = setTimeout(() => {
        onComplete();
      }, 800);
      return () => clearTimeout(timeout);
    }

    const timer = setTimeout(() => {
      setCount(c => c - 1);
      setAnimationKey(k => k + 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [count, onComplete]);

  const displayText = count > 0 ? count.toString() : 'GO!';
  const isGo = count <= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
      {/* Darkened backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        style={{
          animation: 'fadeIn 0.3s ease-out',
        }}
      />

      {/* Radial pulse background */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at center, ${primaryColor}20 0%, transparent 60%)`,
          animation: 'qstage-countdown-pulse 1s ease-out',
          animationIterationCount: 'infinite',
        }}
      />

      {/* Ring burst effect */}
      <div
        key={`ring-${animationKey}`}
        className="absolute w-[50vmin] h-[50vmin] rounded-full border-4 opacity-0"
        style={{
          borderColor: isGo ? '#00ff88' : primaryColor,
          animation: 'qstage-ring-burst 1s ease-out forwards',
        }}
      />

      {/* Main number/text */}
      <div
        key={`num-${animationKey}`}
        className="relative z-10"
        style={{
          animation: 'qstage-countdown-number 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}
      >
        <span
          className="block font-black"
          style={{
            fontSize: isGo ? '20vmin' : '40vmin',
            lineHeight: 1,
            color: isGo ? '#00ff88' : primaryColor,
            textShadow: `
              0 0 40px ${isGo ? '#00ff8880' : primaryColor}80,
              0 0 80px ${isGo ? '#00ff8860' : primaryColor}60,
              0 0 120px ${isGo ? '#00ff8840' : primaryColor}40
            `,
            fontFamily: "'Bebas Neue', 'Impact', sans-serif",
            letterSpacing: isGo ? '0.1em' : '-0.02em',
          }}
        >
          {displayText}
        </span>
      </div>

      {/* Particle burst on each count */}
      <div
        key={`particles-${animationKey}`}
        className="absolute inset-0 pointer-events-none"
      >
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 w-2 h-2 rounded-full"
            style={{
              backgroundColor: isGo ? '#00ff88' : primaryColor,
              boxShadow: `0 0 10px ${isGo ? '#00ff88' : primaryColor}`,
              transform: `rotate(${i * 30}deg) translateY(-30vmin)`,
              animation: 'qstage-particle-burst 0.8s ease-out forwards',
              animationDelay: `${i * 20}ms`,
              opacity: 0,
            }}
          />
        ))}
      </div>

      {/* Progress dots at bottom */}
      <div className="absolute bottom-[15%] left-1/2 -translate-x-1/2 flex gap-4">
        {[...Array(duration)].map((_, i) => (
          <div
            key={i}
            className="w-3 h-3 rounded-full transition-all duration-300"
            style={{
              backgroundColor: i < duration - count ? primaryColor : 'rgba(255,255,255,0.2)',
              boxShadow: i < duration - count ? `0 0 10px ${primaryColor}` : 'none',
              transform: i < duration - count ? 'scale(1.2)' : 'scale(1)',
            }}
          />
        ))}
      </div>
    </div>
  );
});

export default QStageCountdown;
