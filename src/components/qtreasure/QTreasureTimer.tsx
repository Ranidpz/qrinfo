'use client';

/**
 * QTreasureTimer - Elegant stopwatch/countdown display
 *
 * Design: Ancient sundial aesthetic with glowing numerals
 */

import React, { useMemo } from 'react';
import { formatTreasureTime, formatTreasureDuration } from '@/types/qtreasure';

interface QTreasureTimerProps {
  startedAt: number | null | undefined;
  maxTimeSeconds?: number;
  elapsedMs: number;
  isExpired?: boolean;
  showMilliseconds?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'countdown' | 'stopwatch';
  lang?: 'he' | 'en';
}

const translations = {
  he: {
    timeRemaining: 'זמן נותר',
    timeElapsed: 'זמן שעבר',
    timesUp: 'הזמן נגמר!',
  },
  en: {
    timeRemaining: 'Time Remaining',
    timeElapsed: 'Time Elapsed',
    timesUp: "Time's Up!",
  },
};

export function QTreasureTimer({
  startedAt,
  maxTimeSeconds = 0,
  elapsedMs,
  isExpired = false,
  showMilliseconds = false,
  size = 'medium',
  variant = 'stopwatch',
  lang = 'he',
}: QTreasureTimerProps) {
  const t = translations[lang];
  const isCountdown = variant === 'countdown' && maxTimeSeconds > 0;

  // Calculate display time
  const displayTime = useMemo(() => {
    if (!startedAt) return '--:--';

    if (isCountdown) {
      const remaining = Math.max(0, maxTimeSeconds - Math.floor(elapsedMs / 1000));
      return formatTreasureTime(remaining);
    }

    return showMilliseconds
      ? formatTreasureDuration(elapsedMs)
      : formatTreasureTime(Math.floor(elapsedMs / 1000));
  }, [startedAt, elapsedMs, maxTimeSeconds, isCountdown, showMilliseconds]);

  // Warning state (last 30 seconds)
  const isWarning = isCountdown && !isExpired && maxTimeSeconds - Math.floor(elapsedMs / 1000) <= 30;

  // Progress for ring
  const progress = useMemo(() => {
    if (!isCountdown || !startedAt) return 100;
    const remaining = maxTimeSeconds - Math.floor(elapsedMs / 1000);
    return Math.max(0, (remaining / maxTimeSeconds) * 100);
  }, [isCountdown, startedAt, elapsedMs, maxTimeSeconds]);

  const sizeClasses = {
    small: 'timer-small',
    medium: 'timer-medium',
    large: 'timer-large',
  };

  return (
    <div className={`timer-container ${sizeClasses[size]} ${isExpired ? 'expired' : ''} ${isWarning ? 'warning' : ''}`}>
      {/* Decorative ring */}
      <svg className="timer-ring" viewBox="0 0 100 100">
        {/* Background ring */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="rgba(212, 175, 55, 0.15)"
          strokeWidth="3"
        />
        {/* Progress ring */}
        {isCountdown && (
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={isExpired ? '#ef4444' : isWarning ? '#f59e0b' : '#d4af37'}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 45}`}
            strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
            transform="rotate(-90 50 50)"
            className="progress-ring"
          />
        )}
        {/* Tick marks */}
        {[...Array(12)].map((_, i) => (
          <line
            key={i}
            x1="50"
            y1="8"
            x2="50"
            y2="12"
            stroke="rgba(212, 175, 55, 0.3)"
            strokeWidth="1.5"
            transform={`rotate(${i * 30} 50 50)`}
          />
        ))}
      </svg>

      {/* Time display */}
      <div className="timer-content">
        <span className="timer-label">
          {isCountdown ? t.timeRemaining : t.timeElapsed}
        </span>
        <span className={`timer-value ${isExpired ? 'flash' : ''}`}>
          {isExpired ? t.timesUp : displayTime}
        </span>
      </div>

      {/* Glow effect */}
      <div className={`timer-glow ${isWarning ? 'warning-glow' : ''}`} />

      <style jsx>{`
        .timer-container {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Sizes */
        .timer-small {
          width: 80px;
          height: 80px;
        }

        .timer-medium {
          width: 120px;
          height: 120px;
        }

        .timer-large {
          width: 160px;
          height: 160px;
        }

        /* Ring */
        .timer-ring {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }

        .progress-ring {
          transition: stroke-dashoffset 0.5s ease-out, stroke 0.3s ease;
        }

        /* Content */
        .timer-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 1;
        }

        .timer-label {
          font-size: 0.5rem;
          color: rgba(212, 175, 55, 0.7);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.25rem;
        }

        .timer-small .timer-label {
          font-size: 0.4rem;
        }

        .timer-large .timer-label {
          font-size: 0.6rem;
        }

        .timer-value {
          font-family: 'Cinzel', monospace;
          font-weight: 700;
          color: #d4af37;
          text-shadow: 0 0 10px rgba(212, 175, 55, 0.5);
        }

        .timer-small .timer-value {
          font-size: 1rem;
        }

        .timer-medium .timer-value {
          font-size: 1.5rem;
        }

        .timer-large .timer-value {
          font-size: 2rem;
        }

        /* Warning state */
        .timer-container.warning .timer-value {
          color: #f59e0b;
          text-shadow: 0 0 15px rgba(245, 158, 11, 0.6);
          animation: pulse 1s ease-in-out infinite;
        }

        /* Expired state */
        .timer-container.expired .timer-value {
          color: #ef4444;
          text-shadow: 0 0 15px rgba(239, 68, 68, 0.6);
        }

        .timer-value.flash {
          animation: flash 0.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        @keyframes flash {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* Glow */
        .timer-glow {
          position: absolute;
          inset: -10%;
          background: radial-gradient(circle, rgba(212, 175, 55, 0.1) 0%, transparent 70%);
          pointer-events: none;
        }

        .timer-glow.warning-glow {
          background: radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, transparent 70%);
          animation: warningPulse 1s ease-in-out infinite;
        }

        .timer-container.expired .timer-glow {
          background: radial-gradient(circle, rgba(239, 68, 68, 0.15) 0%, transparent 70%);
        }

        @keyframes warningPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}

// Inline timer variant (for headers)
export function QTreasureTimerInline({
  elapsedMs,
  maxTimeSeconds = 0,
  isExpired = false,
  showLabel = true,
  lang = 'he',
}: {
  elapsedMs: number;
  maxTimeSeconds?: number;
  isExpired?: boolean;
  showLabel?: boolean;
  lang?: 'he' | 'en';
}) {
  const t = translations[lang];
  const isCountdown = maxTimeSeconds > 0;

  const displayTime = useMemo(() => {
    if (isCountdown) {
      const remaining = Math.max(0, maxTimeSeconds - Math.floor(elapsedMs / 1000));
      return formatTreasureTime(remaining);
    }
    return formatTreasureDuration(elapsedMs);
  }, [elapsedMs, maxTimeSeconds, isCountdown]);

  const isWarning = isCountdown && !isExpired && maxTimeSeconds - Math.floor(elapsedMs / 1000) <= 30;

  return (
    <div className={`inline-timer ${isExpired ? 'expired' : ''} ${isWarning ? 'warning' : ''}`}>
      <span className="timer-icon">⏱️</span>
      {showLabel && (
        <span className="timer-label">
          {isCountdown ? t.timeRemaining : t.timeElapsed}:
        </span>
      )}
      <span className="timer-value">{isExpired ? t.timesUp : displayTime}</span>

      <style jsx>{`
        .inline-timer {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: rgba(26, 45, 35, 0.8);
          border: 1px solid rgba(212, 175, 55, 0.2);
          border-radius: 20px;
          font-size: 0.875rem;
        }

        .timer-icon {
          font-size: 1rem;
        }

        .timer-label {
          color: rgba(245, 245, 220, 0.7);
        }

        .timer-value {
          font-family: 'Cinzel', monospace;
          font-weight: 600;
          color: #d4af37;
        }

        .inline-timer.warning {
          border-color: rgba(245, 158, 11, 0.4);
          background: rgba(245, 158, 11, 0.1);
        }

        .inline-timer.warning .timer-value {
          color: #f59e0b;
          animation: pulse 1s ease-in-out infinite;
        }

        .inline-timer.expired {
          border-color: rgba(239, 68, 68, 0.4);
          background: rgba(239, 68, 68, 0.1);
        }

        .inline-timer.expired .timer-value {
          color: #ef4444;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
