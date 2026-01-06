'use client';

import { memo } from 'react';
import { QStageBackgroundType } from '@/types/qstage';

interface QStageBackgroundProps {
  type: QStageBackgroundType;
  color: string;
  imageUrl?: string;
  videoUrl?: string;
  overlayOpacity?: number;
}

/**
 * QStageBackground - Atmospheric background layer
 * Supports color, image, or looping video with overlay
 */
export const QStageBackground = memo(function QStageBackground({
  type,
  color,
  imageUrl,
  videoUrl,
  overlayOpacity = 40,
}: QStageBackgroundProps) {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      {/* Base layer - always present */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: color }}
      />

      {/* Animated gradient overlay for atmosphere */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: `
            radial-gradient(ellipse at 20% 80%, rgba(0, 212, 255, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 20%, rgba(255, 0, 170, 0.1) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, rgba(0, 255, 136, 0.05) 0%, transparent 70%)
          `,
        }}
      />

      {/* Image background */}
      {type === 'image' && imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'brightness(0.7)' }}
        />
      )}

      {/* Video background */}
      {type === 'video' && videoUrl && (
        <video
          src={videoUrl}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'brightness(0.6)' }}
        />
      )}

      {/* Dark overlay for readability */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg,
            rgba(10, 15, 26, ${overlayOpacity / 100}) 0%,
            rgba(10, 15, 26, ${Math.min(overlayOpacity / 100 + 0.2, 0.9)}) 100%
          )`,
        }}
      />

      {/* Subtle noise texture */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Vignette effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)',
        }}
      />
    </div>
  );
});

export default QStageBackground;
