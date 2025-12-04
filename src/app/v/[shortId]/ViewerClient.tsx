'use client';

import { useState, useEffect, useCallback, useRef, memo, forwardRef } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Minimize2 } from 'lucide-react';
import { MediaItem, CodeWidgets } from '@/types';
import WhatsAppWidget from '@/components/viewer/WhatsAppWidget';
import HTMLFlipBook from 'react-pageflip';

interface ViewerClientProps {
  media: MediaItem[];
  widgets: CodeWidgets;
  title: string;
}

// Loading spinner with percentage
const LoadingSpinner = memo(({ progress, message }: { progress: number; message: string }) => (
  <div className="fixed inset-0 bg-gradient-to-br from-gray-900 to-black z-50 flex flex-col items-center justify-center">
    <div className="relative w-28 h-28">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="6"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="url(#gradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${progress * 2.83} 283`}
          style={{ transition: 'stroke-dasharray 0.3s ease-out' }}
        />
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-white text-2xl font-bold">{Math.round(progress)}%</span>
      </div>
    </div>
    <p className="text-white/70 mt-6 text-sm font-medium">{message}</p>
  </div>
));
LoadingSpinner.displayName = 'LoadingSpinner';

// Page component for flipbook
interface PageProps {
  children: React.ReactNode;
  number: number;
  annotations?: PDFAnnotation[];
  pageWidth: number;
  pageHeight: number;
}

interface PDFAnnotation {
  url: string;
  rect: { x: number; y: number; width: number; height: number };
}

const Page = forwardRef<HTMLDivElement, PageProps>(
  ({ children, annotations = [], pageWidth, pageHeight }, ref) => {
    return (
      <div ref={ref} className="page bg-white shadow-lg relative" data-density="soft">
        {children}
        {/* Render clickable link areas */}
        {annotations.map((annotation, idx) => (
          <a
            key={idx}
            href={annotation.url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute cursor-pointer hover:bg-blue-500/10 transition-colors"
            style={{
              left: `${(annotation.rect.x / pageWidth) * 100}%`,
              bottom: `${(annotation.rect.y / pageHeight) * 100}%`,
              width: `${(annotation.rect.width / pageWidth) * 100}%`,
              height: `${(annotation.rect.height / pageHeight) * 100}%`,
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ))}
      </div>
    );
  }
);
Page.displayName = 'Page';

// PDF FlipBook Viewer
const PDFFlipBookViewer = memo(({
  url,
  title,
  onLoad
}: {
  url: string;
  title: string;
  onLoad: () => void;
}) => {
  const [pdfImages, setPdfImages] = useState<string[]>([]);
  const [pageAnnotations, setPageAnnotations] = useState<PDFAnnotation[][]>([]);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({ width: 595, height: 842 });
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 400, height: 560 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const flipBookRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load PDF and convert to images
  useEffect(() => {
    const loadPDF = async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const pdf = await pdfjsLib.getDocument(url).promise;
        setTotalPages(pdf.numPages);

        const images: string[] = [];
        const allAnnotations: PDFAnnotation[][] = [];
        const scale = 2; // High quality

        // Get first page dimensions
        const firstPage = await pdf.getPage(1);
        const viewport = firstPage.getViewport({ scale: 1 });
        const aspectRatio = viewport.height / viewport.width;
        setPageDimensions({ width: viewport.width, height: viewport.height });

        // Calculate optimal dimensions for screen
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const isMobile = screenWidth < 768;

        let bookWidth: number;
        let bookHeight: number;

        if (isMobile) {
          // Mobile: use more screen width
          bookWidth = screenWidth * 0.9;
          bookHeight = bookWidth * aspectRatio;
          if (bookHeight > screenHeight * 0.75) {
            bookHeight = screenHeight * 0.75;
            bookWidth = bookHeight / aspectRatio;
          }
        } else {
          // Desktop
          bookWidth = Math.min(screenWidth * 0.4, 500);
          bookHeight = bookWidth * aspectRatio;
          if (bookHeight > screenHeight * 0.85) {
            bookHeight = screenHeight * 0.85;
            bookWidth = bookHeight / aspectRatio;
          }
        }

        setDimensions({ width: Math.round(bookWidth), height: Math.round(bookHeight) });

        // Render all pages and extract annotations
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const pageViewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d')!;
          canvas.width = pageViewport.width;
          canvas.height = pageViewport.height;

          await page.render({ canvasContext: context, viewport: pageViewport, canvas }).promise;
          images.push(canvas.toDataURL('image/jpeg', 0.92));

          // Extract link annotations
          try {
            const annotations = await page.getAnnotations();
            const pageLinks: PDFAnnotation[] = [];

            for (const annotation of annotations) {
              if (annotation.subtype === 'Link' && annotation.url) {
                const rect = annotation.rect;
                pageLinks.push({
                  url: annotation.url,
                  rect: {
                    x: rect[0],
                    y: rect[1],
                    width: rect[2] - rect[0],
                    height: rect[3] - rect[1],
                  },
                });
              }
            }
            allAnnotations.push(pageLinks);
          } catch {
            allAnnotations.push([]);
          }
        }

        setPdfImages(images);
        setPageAnnotations(allAnnotations);
        onLoad();
      } catch (error) {
        console.error('Error loading PDF:', error);
        onLoad();
      }
    };

    loadPDF();
  }, [url, onLoad]);

  const handleFlip = useCallback((e: any) => {
    setCurrentPage(e.data);
  }, []);

  const goToPage = useCallback((pageNum: number) => {
    if (flipBookRef.current) {
      flipBookRef.current.pageFlip().flip(pageNum);
    }
  }, []);

  const nextPage = useCallback(() => {
    if (flipBookRef.current) {
      flipBookRef.current.pageFlip().flipNext();
    }
  }, []);

  const prevPage = useCallback(() => {
    if (flipBookRef.current) {
      flipBookRef.current.pageFlip().flipPrev();
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') nextPage();
      if (e.key === 'ArrowRight') prevPage();
      if (e.key === 'Escape' && isFullscreen) toggleFullscreen();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextPage, prevPage, isFullscreen, toggleFullscreen]);

  if (pdfImages.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg">טוען את הספר...</p>
          <p className="text-sm text-white/60 mt-2">אנא המתן</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"
    >
      {/* Flipbook container */}
      <div
        className="relative flex items-center justify-center"
        style={{
          transform: `scale(${zoom})`,
          transition: 'transform 0.3s ease'
        }}
      >
        <HTMLFlipBook
          ref={flipBookRef}
          width={dimensions.width}
          height={dimensions.height}
          size="stretch"
          minWidth={280}
          maxWidth={1000}
          minHeight={400}
          maxHeight={1400}
          showCover={true}
          mobileScrollSupport={false}
          onFlip={handleFlip}
          className="flipbook-shadow"
          style={{}}
          startPage={0}
          drawShadow={true}
          flippingTime={600}
          usePortrait={true}
          startZIndex={0}
          autoSize={true}
          maxShadowOpacity={0.5}
          showPageCorners={true}
          disableFlipByClick={false}
          swipeDistance={30}
          clickEventForward={true}
          useMouseEvents={true}
        >
          {pdfImages.map((img, index) => (
            <Page
              key={index}
              number={index + 1}
              annotations={pageAnnotations[index] || []}
              pageWidth={pageDimensions.width}
              pageHeight={pageDimensions.height}
            >
              <img
                src={img}
                alt={`${title} - עמוד ${index + 1}`}
                className="w-full h-full object-contain"
                draggable={false}
              />
            </Page>
          ))}
        </HTMLFlipBook>

        {/* Navigation arrows */}
        {currentPage > 0 && (
          <button
            onClick={prevPage}
            className="absolute right-[-60px] top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center backdrop-blur-sm transition-all hover:scale-110"
            aria-label="הקודם"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        )}
        {currentPage < totalPages - 1 && (
          <button
            onClick={nextPage}
            className="absolute left-[-60px] top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center backdrop-blur-sm transition-all hover:scale-110"
            aria-label="הבא"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        )}
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 rounded-full bg-black/40 backdrop-blur-md">
        {/* Page indicator */}
        <div className="text-white text-sm font-medium">
          <span className="text-white/60">עמוד</span>{' '}
          <span className="text-lg">{currentPage + 1}</span>{' '}
          <span className="text-white/60">מתוך</span>{' '}
          <span className="text-lg">{totalPages}</span>
        </div>

        <div className="w-px h-6 bg-white/20" />

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            disabled={zoom <= 0.5}
          >
            <ZoomOut className="w-4 h-4 text-white" />
          </button>
          <span className="text-white text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(Math.min(2, zoom + 0.1))}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            disabled={zoom >= 2}
          >
            <ZoomIn className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="w-px h-6 bg-white/20" />

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4 text-white" />
          ) : (
            <Maximize2 className="w-4 h-4 text-white" />
          )}
        </button>
      </div>

      {/* Page thumbnails / progress bar */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-1">
        {pdfImages.slice(0, Math.min(10, totalPages)).map((_, index) => (
          <button
            key={index}
            onClick={() => goToPage(index)}
            className={`h-1 rounded-full transition-all ${
              index === currentPage
                ? 'w-8 bg-white'
                : 'w-2 bg-white/30 hover:bg-white/50'
            }`}
          />
        ))}
        {totalPages > 10 && (
          <span className="text-white/50 text-xs ml-2">+{totalPages - 10}</span>
        )}
      </div>

      <style jsx global>{`
        .flipbook-shadow {
          box-shadow: 0 0 60px rgba(0, 0, 0, 0.4), 0 0 20px rgba(0, 0, 0, 0.2);
          border-radius: 4px;
        }
        .page {
          background: white;
          overflow: hidden;
        }
        .stf__parent {
          margin: 0 auto;
        }
      `}</style>
    </div>
  );
});
PDFFlipBookViewer.displayName = 'PDFFlipBookViewer';

// Image Gallery with flip effect
const ImageGalleryViewer = memo(({
  images,
  title,
  onLoad
}: {
  images: { url: string }[];
  title: string;
  onLoad: () => void;
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 400, height: 560 });
  const flipBookRef = useRef<any>(null);

  useEffect(() => {
    // Calculate optimal dimensions
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    let width = Math.min(screenWidth * 0.4, 500);
    let height = width * 1.4;

    if (height > screenHeight * 0.85) {
      height = screenHeight * 0.85;
      width = height / 1.4;
    }

    setDimensions({ width: Math.round(width), height: Math.round(height) });
    onLoad();
  }, [onLoad]);

  const handleFlip = useCallback((e: any) => {
    setCurrentPage(e.data);
  }, []);

  const nextPage = useCallback(() => {
    if (flipBookRef.current) {
      flipBookRef.current.pageFlip().flipNext();
    }
  }, []);

  const prevPage = useCallback(() => {
    if (flipBookRef.current) {
      flipBookRef.current.pageFlip().flipPrev();
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') nextPage();
      if (e.key === 'ArrowRight') prevPage();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextPage, prevPage]);

  if (images.length === 1) {
    // Single image - no flip needed
    return (
      <div className="w-full h-full flex items-center justify-center">
        <img
          src={images[0].url}
          alt={title}
          className="max-w-full max-h-full object-contain animate-fadeIn"
        />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="relative flex items-center justify-center">
        <HTMLFlipBook
          ref={flipBookRef}
          width={dimensions.width}
          height={dimensions.height}
          size="stretch"
          minWidth={280}
          maxWidth={800}
          minHeight={400}
          maxHeight={1200}
          showCover={true}
          mobileScrollSupport={false}
          onFlip={handleFlip}
          className="flipbook-shadow"
          style={{}}
          startPage={0}
          drawShadow={true}
          flippingTime={600}
          usePortrait={true}
          startZIndex={0}
          autoSize={true}
          maxShadowOpacity={0.5}
          showPageCorners={true}
          disableFlipByClick={false}
          swipeDistance={30}
          clickEventForward={true}
          useMouseEvents={true}
        >
          {images.map((img, index) => (
            <Page
              key={index}
              number={index + 1}
              annotations={[]}
              pageWidth={dimensions.width}
              pageHeight={dimensions.height}
            >
              <img
                src={img.url}
                alt={`${title} - ${index + 1}`}
                className="w-full h-full object-cover"
                draggable={false}
              />
            </Page>
          ))}
        </HTMLFlipBook>

        {/* Navigation arrows */}
        {currentPage > 0 && (
          <button
            onClick={prevPage}
            className="absolute right-[-60px] top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center backdrop-blur-sm transition-all hover:scale-110"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        )}
        {currentPage < images.length - 1 && (
          <button
            onClick={nextPage}
            className="absolute left-[-60px] top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center backdrop-blur-sm transition-all hover:scale-110"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        )}
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 rounded-full bg-black/40 backdrop-blur-md">
        <div className="text-white text-sm font-medium">
          {currentPage + 1} / {images.length}
        </div>
        <div className="flex gap-1">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => flipBookRef.current?.pageFlip().flip(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentPage
                  ? 'w-6 bg-white'
                  : 'w-2 bg-white/30 hover:bg-white/50'
              }`}
            />
          ))}
        </div>
      </div>

      <style jsx global>{`
        .flipbook-shadow {
          box-shadow: 0 0 60px rgba(0, 0, 0, 0.4), 0 0 20px rgba(0, 0, 0, 0.2);
          border-radius: 4px;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
});
ImageGalleryViewer.displayName = 'ImageGalleryViewer';

export default function ViewerClient({ media, widgets, title }: ViewerClientProps) {
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadMessage, setLoadMessage] = useState('טוען תוכן...');
  const [showContent, setShowContent] = useState(false);
  const loadedCount = useRef(0);

  const currentMedia = media[0];
  const isMultipleImages = media.length > 1 && media.every(m => m.type === 'image' || m.type === 'gif');
  const isPDF = currentMedia?.type === 'pdf';
  const isVideo = currentMedia?.type === 'video';
  const isLink = currentMedia?.type === 'link';

  // Preload media
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
          setTimeout(() => setShowContent(true), 100);
        }, 300);
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
      } else {
        updateProgress();
      }
    });

    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setShowContent(true);
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [media, loading]);

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
    <div className={`min-h-screen bg-black relative overflow-hidden ${showContent ? 'animate-fadeIn' : 'opacity-0'}`}>
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>

      {/* Content based on type */}
      <div className="w-full h-screen">
        {isPDF ? (
          <PDFFlipBookViewer url={currentMedia.url} title={title} onLoad={handleMediaLoad} />
        ) : isMultipleImages ? (
          <ImageGalleryViewer
            images={media.map(m => ({ url: m.url }))}
            title={title}
            onLoad={handleMediaLoad}
          />
        ) : isVideo ? (
          <div className="w-full h-full flex items-center justify-center bg-black">
            <video
              src={currentMedia.url}
              className="max-w-full max-h-full"
              controls
              autoPlay
              playsInline
            />
          </div>
        ) : isLink ? (
          <iframe
            src={currentMedia.url}
            className="w-full h-full"
            title={title}
            sandbox="allow-scripts allow-same-origin"
          />
        ) : (
          // Single image
          <div className="w-full h-full flex items-center justify-center">
            <img
              src={currentMedia.url}
              alt={title}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        )}
      </div>

      {/* WhatsApp Widget */}
      {widgets.whatsapp?.enabled && widgets.whatsapp.groupLink && (
        <WhatsAppWidget groupLink={widgets.whatsapp.groupLink} />
      )}
    </div>
  );
}
