'use client';

import { useEffect, useState, useRef } from 'react';

interface QChallengeTimerProps {
  totalSeconds: number;
  onTimeUp: () => void;
  isPaused?: boolean;
  primaryColor?: string;
  warningColor?: string;
  dangerColor?: string;
}

export default function QChallengeTimer({
  totalSeconds,
  onTimeUp,
  isPaused = false,
  primaryColor = '#3b82f6',
  warningColor = '#f59e0b',
  dangerColor = '#ef4444',
}: QChallengeTimerProps) {
  const [timeLeft, setTimeLeft] = useState(totalSeconds);
  const [startTime] = useState(Date.now());
  const onTimeUpRef = useRef(onTimeUp);

  // Keep onTimeUp ref updated
  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  // Timer logic
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, totalSeconds - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onTimeUpRef.current();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [totalSeconds, startTime, isPaused]);

  // Calculate progress (0 to 1)
  const progress = timeLeft / totalSeconds;

  // Determine color based on time remaining
  const getColor = () => {
    if (progress > 0.5) return primaryColor;
    if (progress > 0.25) return warningColor;
    return dangerColor;
  };

  // Format time as M:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const color = getColor();
  const isLow = progress <= 0.25;

  return (
    <div className="relative">
      {/* Progress bar background */}
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        {/* Progress bar fill */}
        <div
          className={`h-full rounded-full transition-all duration-100 ${isLow ? 'animate-pulse' : ''}`}
          style={{
            width: `${progress * 100}%`,
            backgroundColor: color,
            boxShadow: `0 0 10px ${color}`,
          }}
        />
      </div>

      {/* Time display */}
      <div
        className={`absolute -top-8 right-0 font-mono font-bold text-lg ${isLow ? 'animate-pulse' : ''}`}
        style={{ color }}
      >
        {formatTime(timeLeft)}
      </div>
    </div>
  );
}
