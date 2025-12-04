'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MediaItem, CodeWidgets } from '@/types';
import WhatsAppWidget from '@/components/viewer/WhatsAppWidget';

interface ViewerClientProps {
  media: MediaItem[];
  widgets: CodeWidgets;
  title: string;
}

export default function ViewerClient({ media, widgets, title }: ViewerClientProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const hasMultiple = media.length > 1;
  const currentMedia = media[currentIndex];

  // Navigation
  const goNext = useCallback(() => {
    if (currentIndex < media.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, media.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goNext();
      if (e.key === 'ArrowRight') goPrev();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev]);

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;

    if (Math.abs(distance) > minSwipeDistance) {
      if (distance > 0) {
        goNext(); // Swipe left = next
      } else {
        goPrev(); // Swipe right = prev
      }
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  // Auto-advance for videos
  const handleVideoEnd = () => {
    if (hasMultiple && currentIndex < media.length - 1) {
      goNext();
    }
  };

  if (!currentMedia) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <p>אין תוכן להצגה</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-black relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Media Content */}
      <div className="w-full h-screen flex items-center justify-center">
        {currentMedia.type === 'image' || currentMedia.type === 'gif' ? (
          <img
            src={currentMedia.url}
            alt={title}
            className="max-w-full max-h-full object-contain"
          />
        ) : currentMedia.type === 'video' ? (
          <video
            src={currentMedia.url}
            className="max-w-full max-h-full"
            controls
            autoPlay
            playsInline
            onEnded={handleVideoEnd}
          />
        ) : currentMedia.type === 'pdf' ? (
          <iframe
            src={`${currentMedia.url}#view=FitH`}
            className="w-full h-full"
            title={title}
          />
        ) : currentMedia.type === 'link' ? (
          <iframe
            src={currentMedia.url}
            className="w-full h-full"
            title={title}
            sandbox="allow-scripts allow-same-origin"
          />
        ) : null}
      </div>

      {/* Navigation Arrows */}
      {hasMultiple && (
        <>
          {currentIndex > 0 && (
            <button
              onClick={goPrev}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors backdrop-blur-sm"
              aria-label="הקודם"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          )}

          {currentIndex < media.length - 1 && (
            <button
              onClick={goNext}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors backdrop-blur-sm"
              aria-label="הבא"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
          )}
        </>
      )}

      {/* Pagination Dots */}
      {hasMultiple && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {media.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? 'bg-white w-6'
                  : 'bg-white/50 hover:bg-white/70'
              }`}
              aria-label={`עמוד ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Page counter */}
      {hasMultiple && (
        <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-black/50 text-white text-sm backdrop-blur-sm">
          {currentIndex + 1} / {media.length}
        </div>
      )}

      {/* WhatsApp Widget */}
      {widgets.whatsapp?.enabled && widgets.whatsapp.groupLink && (
        <WhatsAppWidget groupLink={widgets.whatsapp.groupLink} />
      )}
    </div>
  );
}
