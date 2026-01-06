'use client';

/**
 * QHuntCountdown - Pre-game countdown animation
 *
 * Design: Neon Hunter - Arcade Gaming Vibe
 * - Big numbers with glow
 * - Pulse animations
 */

import React, { useState, useEffect } from 'react';
import { QHuntBranding } from '@/types/qhunt';

interface QHuntCountdownProps {
  seconds: number;
  onComplete: () => void;
  branding: QHuntBranding;
}

export function QHuntCountdown({
  seconds,
  onComplete,
  branding,
}: QHuntCountdownProps) {
  const [count, setCount] = useState(seconds);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (count <= 0) {
      setIsComplete(true);
      setTimeout(onComplete, 500);
      return;
    }

    const timer = setTimeout(() => {
      setCount(c => c - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [count, onComplete]);

  return (
    <div className="countdown-overlay">
      <div className="countdown-content">
        {isComplete ? (
          <div className="go-text" key="go">GO!</div>
        ) : (
          <div className="count-number" key={count}>
            {count}
          </div>
        )}
      </div>

      <style jsx>{`
        .countdown-overlay {
          position: fixed;
          inset: 0;
          background: rgba(10, 15, 26, 0.95);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }

        .countdown-content {
          text-align: center;
        }

        .count-number {
          font-size: 12rem;
          font-weight: 900;
          color: ${branding.primaryColor || '#00d4ff'};
          text-shadow:
            0 0 40px ${branding.primaryColor || '#00d4ff'},
            0 0 80px ${branding.primaryColor || '#00d4ff'}80;
          animation: countPop 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55);
          line-height: 1;
        }

        @keyframes countPop {
          0% {
            transform: scale(2);
            opacity: 0;
          }
          50% {
            transform: scale(0.9);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .go-text {
          font-size: 8rem;
          font-weight: 900;
          color: ${branding.successColor || '#00ff88'};
          text-shadow:
            0 0 40px ${branding.successColor || '#00ff88'},
            0 0 80px ${branding.successColor || '#00ff88'}80;
          animation: goExplode 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        @keyframes goExplode {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.3);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
