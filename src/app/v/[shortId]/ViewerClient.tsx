'use client';

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { MediaItem, CodeWidgets } from '@/types';
import WhatsAppWidget from '@/components/viewer/WhatsAppWidget';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Virtual } from 'swiper/modules';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import type { Swiper as SwiperType } from 'swiper';
import { incrementViews } from '@/lib/db';

// Import Swiper styles
import 'swiper/css';

interface ViewerClientProps {
  media: MediaItem[];
  widgets: CodeWidgets;
  title: string;
  codeId: string;
  shortId: string;
  ownerId: string;
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

// PDF Annotation interface
interface PDFAnnotation {
  url: string;
  rect: { x: number; y: number; width: number; height: number };
}

// PDF Page data interface
interface PDFPageData {
  image: string;
  annotations: PDFAnnotation[];
}

// PDF Swiper Viewer - smooth swipe navigation with pinch-to-zoom
const PDFFlipBookViewer = memo(({
  url,
  title,
  onLoad
}: {
  url: string;
  title: string;
  onLoad: () => void;
}) => {
  const [pages, setPages] = useState<PDFPageData[]>([]);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({ width: 595, height: 842 });
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const swiperRef = useRef<SwiperType | null>(null);

  // Load PDF and convert to images with high resolution
  useEffect(() => {
    const loadPDF = async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const pdf = await pdfjsLib.getDocument(url).promise;
        setTotalPages(pdf.numPages);

        const pagesData: PDFPageData[] = [];
        // Higher scale for better zoom quality - use device pixel ratio
        const deviceScale = Math.min(window.devicePixelRatio || 1, 3);
        const scale = 2 * deviceScale;

        // Get first page dimensions
        const firstPage = await pdf.getPage(1);
        const viewport = firstPage.getViewport({ scale: 1 });
        setPageDimensions({ width: viewport.width, height: viewport.height });

        // Render all pages and extract annotations
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const pageViewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d')!;
          canvas.width = pageViewport.width;
          canvas.height = pageViewport.height;

          await page.render({ canvasContext: context, viewport: pageViewport, canvas }).promise;
          const imageData = canvas.toDataURL('image/webp', 0.92);

          // Extract link annotations
          const pageLinks: PDFAnnotation[] = [];
          try {
            const annotations = await page.getAnnotations();
            for (const annotation of annotations) {
              if (annotation.subtype === 'Link' && annotation.url) {
                const rect = annotation.rect;
                // PDF coordinates: origin at bottom-left
                pageLinks.push({
                  url: annotation.url,
                  rect: {
                    x: rect[0],
                    y: viewport.height - rect[3], // Convert from bottom-left to top-left origin
                    width: rect[2] - rect[0],
                    height: rect[3] - rect[1],
                  },
                });
              }
            }
          } catch {
            // Ignore annotation errors
          }

          pagesData.push({ image: imageData, annotations: pageLinks });
        }

        setPages(pagesData);
        onLoad();
      } catch (error) {
        console.error('Error loading PDF:', error);
        onLoad();
      }
    };

    loadPDF();
  }, [url, onLoad]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && swiperRef.current) {
        swiperRef.current.slideNext();
      }
      if (e.key === 'ArrowRight' && swiperRef.current) {
        swiperRef.current.slidePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (pages.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
        <div className="text-white text-center">
          <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg">טוען את הספר...</p>
          <p className="text-sm text-white/60 mt-2">אנא המתן</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 overflow-hidden">
      <Swiper
        modules={[Virtual]}
        onSwiper={(swiper) => { swiperRef.current = swiper; }}
        onSlideChange={(swiper) => setCurrentPage(swiper.activeIndex)}
        dir="rtl"
        slidesPerView={1}
        spaceBetween={0}
        speed={300}
        resistance={true}
        resistanceRatio={0.85}
        touchRatio={1}
        threshold={10}
        cssMode={false}
        allowTouchMove={true}
        virtual
        className="w-full h-full"
        style={{ direction: 'rtl' }}
      >
        {pages.map((page, index) => (
          <SwiperSlide key={index} virtualIndex={index} className="flex items-center justify-center">
            <TransformWrapper
              initialScale={1}
              minScale={1}
              maxScale={5}
              centerOnInit={true}
              wheel={{ disabled: false, step: 0.1 }}
              pinch={{ step: 5 }}
              panning={{ disabled: !isZoomed }}
              doubleClick={{ mode: 'toggle', step: 2 }}
              onTransformed={(ref) => {
                const zoomed = ref.state.scale > 1.05;
                setIsZoomed(zoomed);
                if (swiperRef.current) {
                  swiperRef.current.allowTouchMove = !zoomed;
                }
              }}
            >
              {() => (
                <TransformComponent
                  wrapperStyle={{ width: '100%', height: '100%' }}
                  contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <div className="relative max-w-full max-h-full flex items-center justify-center">
                    <img
                      src={page.image}
                      alt={`${title} - עמוד ${index + 1}`}
                      className="max-w-full max-h-[100vh] object-contain select-none"
                      draggable={false}
                      style={{
                        transform: 'translateZ(0)',
                        backfaceVisibility: 'hidden',
                      }}
                    />
                    {/* PDF Link Annotations */}
                    {page.annotations.map((annotation, idx) => (
                      <a
                        key={idx}
                        href={annotation.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute cursor-pointer hover:bg-blue-500/20 active:bg-blue-500/30 transition-colors z-50"
                        style={{
                          left: `${(annotation.rect.x / pageDimensions.width) * 100}%`,
                          top: `${(annotation.rect.y / pageDimensions.height) * 100}%`,
                          width: `${(annotation.rect.width / pageDimensions.width) * 100}%`,
                          height: `${(annotation.rect.height / pageDimensions.height) * 100}%`,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ))}
                  </div>
                </TransformComponent>
              )}
            </TransformWrapper>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Minimal page indicator - small dots at bottom */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
        {pages.length <= 10 ? (
          pages.map((_, index) => (
            <button
              key={index}
              onClick={() => swiperRef.current?.slideTo(index)}
              className={`rounded-full transition-all duration-200 ${
                index === currentPage
                  ? 'w-6 h-2 bg-white'
                  : 'w-2 h-2 bg-white/40 hover:bg-white/60'
              }`}
            />
          ))
        ) : (
          <div className="px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-sm">
            <span className="text-white/90 text-sm font-medium">
              {currentPage + 1} / {totalPages}
            </span>
          </div>
        )}
      </div>

      {/* Navigation arrows - only on desktop */}
      <div className="hidden md:block">
        {currentPage > 0 && (
          <button
            onClick={() => swiperRef.current?.slidePrev()}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center backdrop-blur-sm transition-all hover:scale-110 z-10"
            aria-label="הקודם"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        )}
        {currentPage < totalPages - 1 && (
          <button
            onClick={() => swiperRef.current?.slideNext()}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center backdrop-blur-sm transition-all hover:scale-110 z-10"
            aria-label="הבא"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        )}
      </div>

      <style jsx global>{`
        .swiper-slide {
          transform: translateZ(0);
          will-change: transform;
          backface-visibility: hidden;
        }
        /* Prevent browser zoom on mobile */
        html {
          touch-action: pan-x pan-y;
        }
        /* Smooth transitions */
        .react-transform-wrapper {
          width: 100% !important;
          height: 100% !important;
        }
        .react-transform-component {
          width: 100% !important;
          height: 100% !important;
        }
      `}</style>
    </div>
  );
});
PDFFlipBookViewer.displayName = 'PDFFlipBookViewer';

// Image Gallery Viewer with Swiper - smooth swipe and pinch-to-zoom
const ImageGalleryViewer = memo(({
  mediaItems,
  title,
  onLoad
}: {
  mediaItems: MediaItem[];
  title: string;
  onLoad: () => void;
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [showLinkButton, setShowLinkButton] = useState(false);
  const linkButtonTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const swiperRef = useRef<SwiperType | null>(null);

  useEffect(() => {
    onLoad();
  }, [onLoad]);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (linkButtonTimeoutRef.current) {
        clearTimeout(linkButtonTimeoutRef.current);
      }
    };
  }, []);

  // Hide link button when page changes
  useEffect(() => {
    setShowLinkButton(false);
    if (linkButtonTimeoutRef.current) {
      clearTimeout(linkButtonTimeoutRef.current);
    }
  }, [currentPage]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && swiperRef.current) {
        swiperRef.current.slideNext();
      }
      if (e.key === 'ArrowRight' && swiperRef.current) {
        swiperRef.current.slidePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle image tap to show link button
  const handleImageTap = (mediaItem: MediaItem) => {
    if (!mediaItem.linkUrl) return;

    // Toggle link button visibility
    if (showLinkButton) {
      setShowLinkButton(false);
      if (linkButtonTimeoutRef.current) {
        clearTimeout(linkButtonTimeoutRef.current);
      }
    } else {
      setShowLinkButton(true);
      // Auto-hide after 5 seconds
      if (linkButtonTimeoutRef.current) {
        clearTimeout(linkButtonTimeoutRef.current);
      }
      linkButtonTimeoutRef.current = setTimeout(() => {
        setShowLinkButton(false);
      }, 5000);
    }
  };

  // Get display text for link button
  const getLinkDisplayText = (mediaItem: MediaItem) => {
    if (mediaItem.linkTitle) return mediaItem.linkTitle;
    try {
      return new URL(mediaItem.linkUrl!).hostname;
    } catch {
      return 'פתח לינק';
    }
  };

  const currentMedia = mediaItems[currentPage];

  if (mediaItems.length === 1) {
    const media = mediaItems[0];
    // Single image - with pinch-to-zoom support
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black relative">
        <TransformWrapper
          initialScale={1}
          minScale={1}
          maxScale={5}
          centerOnInit={true}
          wheel={{ disabled: false, step: 0.1 }}
          pinch={{ step: 5 }}
          doubleClick={{ mode: 'toggle', step: 2 }}
        >
          {() => (
            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%' }}
              contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <img
                src={media.url}
                alt={title}
                className="max-w-full max-h-full object-contain select-none"
                draggable={false}
                onClick={() => handleImageTap(media)}
              />
            </TransformComponent>
          )}
        </TransformWrapper>

        {/* Link Button - appears on tap */}
        {media.linkUrl && showLinkButton && (
          <a
            href={media.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-accent hover:bg-accent-hover text-white rounded-full flex items-center gap-2 shadow-lg shadow-accent/30 transition-all animate-slideUp z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-5 h-5" />
            <span className="font-medium">{getLinkDisplayText(media)}</span>
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 overflow-hidden relative">
      <Swiper
        modules={[Virtual]}
        onSwiper={(swiper) => { swiperRef.current = swiper; }}
        onSlideChange={(swiper) => setCurrentPage(swiper.activeIndex)}
        dir="rtl"
        slidesPerView={1}
        spaceBetween={0}
        speed={300}
        resistance={true}
        resistanceRatio={0.85}
        touchRatio={1}
        threshold={10}
        cssMode={false}
        allowTouchMove={true}
        virtual
        className="w-full h-full"
        style={{ direction: 'rtl' }}
      >
        {mediaItems.map((media, index) => (
          <SwiperSlide key={index} virtualIndex={index} className="flex items-center justify-center">
            <TransformWrapper
              initialScale={1}
              minScale={1}
              maxScale={5}
              centerOnInit={true}
              wheel={{ disabled: false, step: 0.1 }}
              pinch={{ step: 5 }}
              panning={{ disabled: !isZoomed }}
              doubleClick={{ mode: 'toggle', step: 2 }}
              onTransformed={(ref) => {
                const zoomed = ref.state.scale > 1.05;
                setIsZoomed(zoomed);
                if (swiperRef.current) {
                  swiperRef.current.allowTouchMove = !zoomed;
                }
              }}
            >
              {() => (
                <TransformComponent
                  wrapperStyle={{ width: '100%', height: '100%' }}
                  contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <img
                    src={media.url}
                    alt={`${title} - ${index + 1}`}
                    className="max-w-full max-h-[100vh] object-contain select-none"
                    draggable={false}
                    onClick={() => handleImageTap(media)}
                    style={{
                      transform: 'translateZ(0)',
                      backfaceVisibility: 'hidden',
                      cursor: media.linkUrl ? 'pointer' : 'default',
                    }}
                  />
                </TransformComponent>
              )}
            </TransformWrapper>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Link Button - appears on tap for current slide */}
      {currentMedia?.linkUrl && showLinkButton && (
        <a
          href={currentMedia.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-16 left-1/2 -translate-x-1/2 px-6 py-3 bg-accent hover:bg-accent-hover text-white rounded-full flex items-center gap-2 shadow-lg shadow-accent/30 transition-all animate-slideUp z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-5 h-5" />
          <span className="font-medium">{getLinkDisplayText(currentMedia)}</span>
        </a>
      )}

      {/* Minimal page indicator - small dots at bottom */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
        {mediaItems.length <= 10 ? (
          mediaItems.map((_, index) => (
            <button
              key={index}
              onClick={() => swiperRef.current?.slideTo(index)}
              className={`rounded-full transition-all duration-200 ${
                index === currentPage
                  ? 'w-6 h-2 bg-white'
                  : 'w-2 h-2 bg-white/40 hover:bg-white/60'
              }`}
            />
          ))
        ) : (
          <div className="px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-sm">
            <span className="text-white/90 text-sm font-medium">
              {currentPage + 1} / {mediaItems.length}
            </span>
          </div>
        )}
      </div>

      {/* Navigation arrows - only on desktop */}
      <div className="hidden md:block">
        {currentPage > 0 && (
          <button
            onClick={() => swiperRef.current?.slidePrev()}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center backdrop-blur-sm transition-all hover:scale-110 z-10"
            aria-label="הקודם"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        )}
        {currentPage < mediaItems.length - 1 && (
          <button
            onClick={() => swiperRef.current?.slideNext()}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center backdrop-blur-sm transition-all hover:scale-110 z-10"
            aria-label="הבא"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        )}
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
});
ImageGalleryViewer.displayName = 'ImageGalleryViewer';

export default function ViewerClient({ media, widgets, title, codeId, shortId, ownerId }: ViewerClientProps) {
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadMessage, setLoadMessage] = useState('טוען תוכן...');
  const [showContent, setShowContent] = useState(false);
  const loadedCount = useRef(0);

  // Log view on client side (runs once per page load)
  useEffect(() => {
    // Use sessionStorage to track if we've logged this specific code view in this session
    const viewKey = `viewed_${codeId}`;
    const hasViewed = sessionStorage.getItem(viewKey);

    if (hasViewed) {
      console.log('[ViewerClient] Already logged view for this session:', codeId);
      return;
    }

    console.log('[ViewerClient] Logging view for:', codeId, shortId);
    sessionStorage.setItem(viewKey, 'true');

    const userAgent = navigator.userAgent;
    incrementViews(codeId, shortId, ownerId, userAgent)
      .then(() => console.log('[ViewerClient] View logged successfully'))
      .catch((err) => console.error('[ViewerClient] Error logging view:', err));
  }, [codeId, shortId, ownerId]);

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
            mediaItems={media}
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
          // Single image - use ImageGalleryViewer for link button support
          <ImageGalleryViewer
            mediaItems={[currentMedia]}
            title={title}
            onLoad={handleMediaLoad}
          />
        )}
      </div>

      {/* WhatsApp Widget */}
      {widgets.whatsapp?.enabled && widgets.whatsapp.groupLink && (
        <WhatsAppWidget groupLink={widgets.whatsapp.groupLink} />
      )}
    </div>
  );
}
