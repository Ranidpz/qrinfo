'use client';

import { memo, useRef, useEffect, useState } from 'react';
import { QStageThreshold, DEFAULT_QSTAGE_THRESHOLDS } from '@/types/qstage';
import { useAnimatedPercentage, useThresholdColor } from '@/hooks/useQStageRealtime';

interface QStagePercentageBarProps {
  percentage: number;
  thresholds?: QStageThreshold[];
  width?: number;
  showPercentageText?: boolean;
  glowEnabled?: boolean;
  successThreshold?: number;
  onSuccessReached?: () => void;
}

/**
 * QStagePercentageBar - The hero element
 * Vertical neon bar that fills based on votes with dramatic glow effects
 */
export const QStagePercentageBar = memo(function QStagePercentageBar({
  percentage,
  thresholds = DEFAULT_QSTAGE_THRESHOLDS,
  width = 120,
  showPercentageText = true,
  glowEnabled = true,
  successThreshold = 65,
  onSuccessReached,
}: QStagePercentageBarProps) {
  // Smooth animation at 60fps
  const animatedPercent = useAnimatedPercentage({
    targetPercent: percentage,
    easingFactor: 0.12,
  });

  // Get current color based on threshold
  const { color, glowColor } = useThresholdColor(animatedPercent, thresholds);

  // Track success threshold crossing
  const hasTriggeredSuccess = useRef(false);
  useEffect(() => {
    if (animatedPercent >= successThreshold && !hasTriggeredSuccess.current) {
      hasTriggeredSuccess.current = true;
      onSuccessReached?.();
    } else if (animatedPercent < successThreshold) {
      hasTriggeredSuccess.current = false;
    }
  }, [animatedPercent, successThreshold, onSuccessReached]);

  // Pulse intensity based on how close to next threshold
  const [pulseIntensity, setPulseIntensity] = useState(1);
  useEffect(() => {
    // Find next threshold
    const nextThreshold = thresholds.find(t => t.percentage > animatedPercent);
    if (nextThreshold) {
      const prevThreshold = thresholds
        .filter(t => t.percentage <= animatedPercent)
        .pop();
      const prevPercent = prevThreshold?.percentage || 0;
      const range = nextThreshold.percentage - prevPercent;
      const progress = (animatedPercent - prevPercent) / range;
      // Pulse faster as we approach threshold
      setPulseIntensity(1 + progress * 0.5);
    }
  }, [animatedPercent, thresholds]);

  const displayPercent = Math.round(animatedPercent);

  return (
    <div
      className="relative flex flex-col items-center"
      style={{ width }}
    >
      {/* Percentage text - massive and glowing */}
      {showPercentageText && (
        <div className="mb-6 text-center">
          <div
            className="font-black tabular-nums leading-none"
            style={{
              fontSize: `${width * 0.7}px`,
              color: color,
              textShadow: glowEnabled
                ? `0 0 20px ${glowColor}, 0 0 40px ${glowColor}, 0 0 60px ${glowColor}`
                : 'none',
              fontFamily: "'Bebas Neue', 'Impact', sans-serif",
              letterSpacing: '-0.02em',
            }}
          >
            {displayPercent}
          </div>
          <div
            className="text-2xl font-bold tracking-wider opacity-80"
            style={{ color }}
          >
            %
          </div>
        </div>
      )}

      {/* The Bar Container */}
      <div
        className="relative flex-1 w-full rounded-full overflow-hidden"
        style={{
          minHeight: '60vh',
          background: 'rgba(255, 255, 255, 0.05)',
          boxShadow: 'inset 0 0 30px rgba(0, 0, 0, 0.5)',
          border: '2px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Threshold markers */}
        {thresholds.map((threshold, i) => (
          <div
            key={i}
            className="absolute left-0 right-0 h-[2px] z-10"
            style={{
              bottom: `${threshold.percentage}%`,
              background: animatedPercent >= threshold.percentage
                ? `linear-gradient(90deg, transparent, ${threshold.color}80, transparent)`
                : 'rgba(255, 255, 255, 0.1)',
            }}
          />
        ))}

        {/* Glass reflection overlay */}
        <div
          className="absolute inset-0 z-20 pointer-events-none"
          style={{
            background: `linear-gradient(
              135deg,
              rgba(255, 255, 255, 0.1) 0%,
              transparent 50%,
              rgba(0, 0, 0, 0.1) 100%
            )`,
          }}
        />

        {/* The fill - with liquid gradient effect */}
        <div
          className="absolute bottom-0 left-0 right-0 transition-colors duration-500"
          style={{
            height: `${animatedPercent}%`,
            background: `linear-gradient(
              180deg,
              ${color}ee 0%,
              ${color} 30%,
              ${color}dd 70%,
              ${color}aa 100%
            )`,
            boxShadow: glowEnabled
              ? `
                0 0 30px ${glowColor},
                0 0 60px ${glowColor},
                inset 0 0 30px rgba(255, 255, 255, 0.3)
              `
              : 'none',
            borderRadius: '0 0 9999px 9999px',
          }}
        >
          {/* Inner glow gradient */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(
                90deg,
                transparent 0%,
                rgba(255, 255, 255, 0.2) 30%,
                rgba(255, 255, 255, 0.3) 50%,
                rgba(255, 255, 255, 0.2) 70%,
                transparent 100%
              )`,
            }}
          />

          {/* Animated shimmer effect */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ borderRadius: 'inherit' }}
          >
            <div
              className="absolute inset-0 animate-qstage-shimmer"
              style={{
                background: `linear-gradient(
                  180deg,
                  transparent 0%,
                  rgba(255, 255, 255, 0.4) 50%,
                  transparent 100%
                )`,
                transform: 'translateY(-100%)',
              }}
            />
          </div>

          {/* Top bubble/meniscus effect */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] aspect-[2/1] rounded-[50%]"
            style={{
              background: `radial-gradient(
                ellipse at center,
                ${color} 0%,
                transparent 70%
              )`,
              filter: 'blur(8px)',
            }}
          />
        </div>

        {/* Pulsing glow ring at current level */}
        {glowEnabled && (
          <div
            className="absolute left-1/2 -translate-x-1/2 w-[140%] aspect-square rounded-full pointer-events-none animate-qstage-pulse"
            style={{
              bottom: `calc(${animatedPercent}% - 10%)`,
              background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
              opacity: 0.6,
              animationDuration: `${2 / pulseIntensity}s`,
            }}
          />
        )}
      </div>

      {/* Bottom label */}
      <div className="mt-4 text-center">
        <span
          className="text-sm font-medium uppercase tracking-[0.2em] opacity-60"
          style={{ color }}
        >
          LIVE
        </span>
      </div>
    </div>
  );
});

export default QStagePercentageBar;
