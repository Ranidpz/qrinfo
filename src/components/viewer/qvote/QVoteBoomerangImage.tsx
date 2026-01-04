'use client';

import { memo, useState, useEffect, useCallback, useRef } from 'react';
import type { CandidatePhoto } from '@/types/qvote';

interface QVoteBoomerangImageProps {
  photos: CandidatePhoto[];
  className?: string;
  frameDuration?: number;
  enabled?: boolean;
}

/**
 * Boomerang effect component for candidates with 2 photos.
 * Automatically alternates between images with smooth crossfade.
 * Pattern: 1 -> 2 -> 1 -> 2 ... (continuous loop)
 */
const QVoteBoomerangImage = memo(function QVoteBoomerangImage({
  photos,
  className = '',
  frameDuration = 800,
  enabled = true,
}: QVoteBoomerangImageProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState<boolean[]>([false, false]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Preload images
  useEffect(() => {
    if (photos.length < 2) return;

    photos.slice(0, 2).forEach((photo, idx) => {
      const img = new Image();
      img.onload = () => {
        setImagesLoaded((prev) => {
          const next = [...prev];
          next[idx] = true;
          return next;
        });
      };
      img.src = photo.url;
    });
  }, [photos]);

  // Boomerang animation loop
  useEffect(() => {
    if (!enabled || photos.length < 2 || !imagesLoaded.every(Boolean)) {
      return;
    }

    intervalRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev === 0 ? 1 : 0));
    }, frameDuration);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, photos.length, frameDuration, imagesLoaded]);

  // Single photo fallback
  if (photos.length < 2 || !enabled) {
    const photo = photos[0];
    return (
      <div className={`relative w-full h-full ${className}`}>
        {photo && (
          <img
            src={photo.url}
            alt=""
            className="w-full h-full object-cover"
            loading="eager"
          />
        )}
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      {/* Base image (always visible as fallback) */}
      <img
        src={photos[0].url}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        loading="eager"
      />

      {/* Overlay image with crossfade */}
      <img
        src={photos[1].url}
        alt=""
        className="absolute inset-0 w-full h-full object-cover transition-opacity ease-in-out"
        style={{
          opacity: activeIndex === 1 ? 1 : 0,
          transitionDuration: `${frameDuration * 0.4}ms`,
        }}
        loading="eager"
      />

      {/* Boomerang indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
        {[0, 1].map((idx) => (
          <div
            key={idx}
            className="w-1.5 h-1.5 rounded-full transition-all duration-300"
            style={{
              backgroundColor: activeIndex === idx ? '#ffffff' : 'rgba(255,255,255,0.4)',
              transform: activeIndex === idx ? 'scale(1.3)' : 'scale(1)',
              boxShadow: activeIndex === idx ? '0 0 8px rgba(255,255,255,0.5)' : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
});

export default QVoteBoomerangImage;
