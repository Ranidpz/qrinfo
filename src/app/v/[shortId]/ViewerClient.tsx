'use client';

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MediaItem, CodeWidgets } from '@/types';
import WhatsAppWidget from '@/components/viewer/WhatsAppWidget';

interface ViewerClientProps {
  media: MediaItem[];
  widgets: CodeWidgets;
  title: string;
}

// Loading spinner with percentage
const LoadingSpinner = memo(({ progress, message }: { progress: number; message: string }) => (
  <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center">
    <div className="relative w-24 h-24">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="white"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${progress * 2.83} 283`}
          style={{ transition: 'stroke-dasharray 0.3s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-white text-2xl font-bold">{Math.round(progress)}%</span>
      </div>
    </div>
    <p className="text-white/70 mt-4 text-sm">{message}</p>
  </div>
));
LoadingSpinner.displayName = 'LoadingSpinner';

// PDF Viewer with flip animation
const PDFViewer = memo(({
  url,
  title,
  onLoad
}: {
  url: string;
  title: string;
  onLoad: () => void;
}) => {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfImages, setPdfImages] = useState<string[]>([]);
  const [flipping, setFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<'next' | 'prev'>('next');
  const [isLandscape, setIsLandscape] = useState(false);
  const touchStartX = useRef(0);

  useEffect(() => {
    const loadPDF = async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        // Use unpkg CDN which has all versions
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const pdf = await pdfjsLib.getDocument(url).promise;
        setNumPages(pdf.numPages);

        const images: string[] = [];
        const scale = Math.min(window.devicePixelRatio * 2, 3);

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale });

          // Check if first page is landscape
          if (i === 1) {
            setIsLandscape(viewport.width > viewport.height);
          }

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d')!;
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({ canvasContext: context, viewport, canvas }).promise;
          images.push(canvas.toDataURL('image/jpeg', 0.92));
        }

        setPdfImages(images);
        onLoad();
      } catch (error) {
        console.error('Error loading PDF:', error);
        onLoad();
      }
    };

    loadPDF();
  }, [url, onLoad]);

  const goToPage = useCallback((page: number, direction: 'next' | 'prev') => {
    if (page < 1 || page > numPages || flipping) return;

    setFlipDirection(direction);
    setFlipping(true);

    setTimeout(() => {
      setCurrentPage(page);
      setTimeout(() => setFlipping(false), 300);
    }, 150);
  }, [numPages, flipping]);

  const handleTouchEnd = useCallback((endX: number) => {
    const diff = touchStartX.current - endX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goToPage(currentPage + 1, 'next');
      else goToPage(currentPage - 1, 'prev');
    }
  }, [currentPage, goToPage]);

  if (pdfImages.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p>טוען PDF...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-full h-full flex items-center justify-center ${isLandscape ? 'pdf-landscape-container' : ''}`}
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => handleTouchEnd(e.changedTouches[0].clientX)}
    >
      <div className="relative w-full h-full flex items-center justify-center" style={{ perspective: '1000px' }}>
        <div
          style={{
            transformStyle: 'preserve-3d',
            transition: 'transform 0.3s ease-out',
            transform: flipping
              ? `perspective(1000px) rotateY(${flipDirection === 'next' ? '-15deg' : '15deg'})`
              : 'perspective(1000px) rotateY(0deg)',
          }}
        >
          <img
            src={pdfImages[currentPage - 1]}
            alt={`${title} - עמוד ${currentPage}`}
            className="shadow-2xl"
            style={{
              maxHeight: isLandscape ? '100vw' : '90vh',
              maxWidth: isLandscape ? '100vh' : '95vw',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
            }}
          />
        </div>
      </div>

      {numPages > 1 && (
        <>
          {currentPage > 1 && (
            <button
              onClick={() => goToPage(currentPage - 1, 'prev')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center backdrop-blur-sm z-10"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          )}
          {currentPage < numPages && (
            <button
              onClick={() => goToPage(currentPage + 1, 'next')}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center backdrop-blur-sm z-10"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
          )}

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/60 text-white text-sm backdrop-blur-sm">
            {currentPage} / {numPages}
          </div>
        </>
      )}
    </div>
  );
});
PDFViewer.displayName = 'PDFViewer';

export default function ViewerClient({ media, widgets, title }: ViewerClientProps) {
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadMessage, setLoadMessage] = useState('טוען תוכן...');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [showContent, setShowContent] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<'next' | 'prev'>('next');
  const loadedCount = useRef(0);

  const hasMultiple = media.length > 1;
  const currentMedia = media[currentIndex];

  // Preload all media
  useEffect(() => {
    if (media.length === 0) {
      setLoading(false);
      return;
    }

    const totalItems = media.length;

    const updateProgress = () => {
      loadedCount.current++;
      const progress = (loadedCount.current / totalItems) * 100;
      setLoadProgress(progress);

      if (loadedCount.current === 1) setLoadMessage('מכין תצוגה...');
      else if (progress > 50) setLoadMessage('כמעט שם...');

      if (loadedCount.current >= totalItems) {
        setLoadProgress(100);
        setLoadMessage('מוכן!');
        setTimeout(() => {
          setLoading(false);
          setTimeout(() => setShowContent(true), 50);
        }, 200);
      }
    };

    media.forEach((item) => {
      if (item.type === 'image' || item.type === 'gif') {
        const img = new Image();
        img.onload = updateProgress;
        img.onerror = updateProgress;
        img.src = item.url;
      } else if (item.type === 'video') {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = updateProgress;
        video.onerror = updateProgress;
        video.src = item.url;
      } else if (item.type === 'pdf') {
        // PDF loads in its own component, just mark progress
        updateProgress();
      } else {
        // Links and other types
        updateProgress();
      }
    });

    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setShowContent(true);
      }
    }, 8000);

    return () => clearTimeout(timeout);
  }, [media, loading]);

  // Navigation with flip animation
  const goNext = useCallback(() => {
    if (currentIndex < media.length - 1 && !flipping) {
      setFlipDirection('next');
      setFlipping(true);
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
        setTimeout(() => setFlipping(false), 300);
      }, 150);
    }
  }, [currentIndex, media.length, flipping]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0 && !flipping) {
      setFlipDirection('prev');
      setFlipping(true);
      setTimeout(() => {
        setCurrentIndex(prev => prev - 1);
        setTimeout(() => setFlipping(false), 300);
      }, 150);
    }
  }, [currentIndex, flipping]);

  const goToIndex = useCallback((index: number) => {
    if (index !== currentIndex && !flipping) {
      setFlipDirection(index > currentIndex ? 'next' : 'prev');
      setFlipping(true);
      setTimeout(() => {
        setCurrentIndex(index);
        setTimeout(() => setFlipping(false), 300);
      }, 150);
    }
  }, [currentIndex, flipping]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goNext();
      if (e.key === 'ArrowRight') goPrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev]);

  // Touch handlers
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
    if (Math.abs(distance) > 50) {
      if (distance > 0) goNext();
      else goPrev();
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  const handleVideoEnd = useCallback(() => {
    if (hasMultiple && currentIndex < media.length - 1) goNext();
  }, [hasMultiple, currentIndex, media.length, goNext]);

  const handleMediaLoad = useCallback(() => {}, []);

  if (loading) {
    return <LoadingSpinner progress={loadProgress} message={loadMessage} />;
  }

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
      onTouchStart={currentMedia.type !== 'pdf' ? handleTouchStart : undefined}
      onTouchMove={currentMedia.type !== 'pdf' ? handleTouchMove : undefined}
      onTouchEnd={currentMedia.type !== 'pdf' ? handleTouchEnd : undefined}
    >
      <style jsx global>{`
        @keyframes bounceIn {
          0% { opacity: 0; transform: scale(0.3); }
          50% { opacity: 1; transform: scale(1.05); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
        .bounce-in { animation: bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55); }

        @media (orientation: portrait) {
          .pdf-landscape-container {
            transform: rotate(90deg);
            transform-origin: center center;
            width: 100vh;
            height: 100vw;
            position: absolute;
            top: 50%;
            left: 50%;
            margin-left: -50vh;
            margin-top: -50vw;
          }
        }
      `}</style>

      <div className={`w-full h-screen flex items-center justify-center ${showContent ? 'bounce-in' : 'opacity-0'}`}>
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            perspective: '1000px',
            transformStyle: 'preserve-3d',
            transition: currentMedia.type !== 'pdf' ? 'transform 0.3s ease-out' : 'none',
            transform: flipping && currentMedia.type !== 'pdf'
              ? `perspective(1000px) rotateY(${flipDirection === 'next' ? '-15deg' : '15deg'})`
              : 'perspective(1000px) rotateY(0deg)',
          }}
        >
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
            <PDFViewer url={currentMedia.url} title={title} onLoad={handleMediaLoad} />
          ) : currentMedia.type === 'link' ? (
            <iframe
              src={currentMedia.url}
              className="w-full h-full"
              title={title}
              sandbox="allow-scripts allow-same-origin"
            />
          ) : null}
        </div>
      </div>

      {hasMultiple && currentMedia.type !== 'pdf' && (
        <>
          {currentIndex > 0 && (
            <button
              onClick={goPrev}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors backdrop-blur-sm z-20"
              aria-label="הקודם"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          )}
          {currentIndex < media.length - 1 && (
            <button
              onClick={goNext}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors backdrop-blur-sm z-20"
              aria-label="הבא"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
          )}
        </>
      )}

      {hasMultiple && currentMedia.type !== 'pdf' && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {media.map((_, index) => (
            <button
              key={index}
              onClick={() => goToIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex ? 'bg-white w-6' : 'bg-white/50 hover:bg-white/70'
              }`}
              aria-label={`עמוד ${index + 1}`}
            />
          ))}
        </div>
      )}

      {hasMultiple && currentMedia.type !== 'pdf' && (
        <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-black/50 text-white text-sm backdrop-blur-sm z-20">
          {currentIndex + 1} / {media.length}
        </div>
      )}

      {widgets.whatsapp?.enabled && widgets.whatsapp.groupLink && (
        <WhatsAppWidget groupLink={widgets.whatsapp.groupLink} />
      )}
    </div>
  );
}
