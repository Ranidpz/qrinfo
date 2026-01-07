'use client';

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import dynamic from 'next/dynamic';
import { ChevronLeft, ChevronRight, ExternalLink, ArrowLeft, Volume2, VolumeX } from 'lucide-react';
import { MediaItem, CodeWidgets, LinkSource, LandingPageConfig, DEFAULT_LANDING_PAGE_CONFIG, PDFFlipbookSettings } from '@/types';
import WhatsAppWidget from '@/components/viewer/WhatsAppWidget';
import ContactWidget from '@/components/viewer/ContactWidget';
// Dynamic imports for components that use isomorphic-dompurify (jsdom SSR issue)
const RiddleViewer = dynamic(() => import('@/components/viewer/RiddleViewer'), { ssr: false });
const SelfiebeamViewer = dynamic(() => import('@/components/viewer/SelfiebeamViewer'), { ssr: false });
import QVoteViewer from '@/components/viewer/QVoteViewer';
import WeeklyCalendarViewer from '@/components/viewer/WeeklyCalendarViewer';
import { QStageDisplay, QStageMobileVoter } from '@/components/qstage';
import { QHuntPlayerView, QHuntDisplay } from '@/components/qhunt';
import { QTreasurePlayerView } from '@/components/qtreasure';
import PWAInstallBanner from '@/components/viewer/PWAInstallBanner';
import LandingPageViewer from '@/components/viewer/LandingPageViewer';
import { shouldShowLandingPage } from '@/lib/landingPage';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Virtual } from 'swiper/modules';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import type { Swiper as SwiperType } from 'swiper';
import { incrementViews } from '@/lib/db';
import { createLinkClick } from '@/lib/analytics';
import { getBrowserLocale, viewerTranslations } from '@/lib/publicTranslations';
// Import Swiper styles
import 'swiper/css';

// Extend Window interface for flipbook libraries
declare global {
  interface Window {
    jQuery?: JQueryStatic;
    $?: JQueryStatic;
    // 3D FlipBook
    FlipBook?: unknown;
    defined?: unknown;
  }
}

// jQuery type for Real3D FlipBook
interface JQueryStatic {
  (selector: string | Element): JQueryElement;
  fn?: { flipBook?: unknown };
}

interface JQueryElement {
  flipBook?: (options: Real3DFlipBookOptions) => unknown;
  remove?: () => void;
}

// Real3D FlipBook options
interface Real3DFlipBookOptions {
  pdfUrl?: string;
  pages?: Array<{ src: string; thumb?: string; title?: string }>;
  rightToLeft?: boolean;
  singlePageMode?: boolean;
  viewMode?: '2d' | '3d' | 'swipe' | 'scroll';
  responsiveView?: boolean;
  responsiveViewTreshold?: number;
  sound?: boolean;
  pageFlipDuration?: number;
  autoplayOnStart?: boolean;
  autoplayInterval?: number;
  mouseWheel?: boolean;
  sideNavigationButtons?: boolean;
  currentPage?: { enabled: boolean };
  assets?: {
    flipMp3?: string;
    spinner?: string;
    preloader?: string;
    backgroundMp3?: string;
    left?: string;
    overlay?: string;
  };
  pdfBrowserViewerIfMobile?: boolean;
  pdfBrowserViewerIfIE?: boolean;
  backgroundColor?: string;
  backgroundImage?: string;
  btnToc?: { enabled: boolean };
  btnThumbs?: { enabled: boolean };
  btnZoomIn?: { enabled: boolean };
  btnZoomOut?: { enabled: boolean };
  btnAutoplay?: { enabled: boolean };
  btnExpand?: { enabled: boolean };
  btnPrint?: { enabled: boolean };
  btnDownloadPages?: { enabled: boolean };
  btnDownloadPdf?: { enabled: boolean };
  btnShare?: { enabled: boolean };
  btnSound?: { enabled: boolean };
  zoomMin?: number;
  zoomMax?: number;
}

// Helper function to load scripts dynamically
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });
}

// Generate page flip sound using Web Audio API (for MultiPDFViewer fallback)
const createFlipSound = () => {
  if (typeof window === 'undefined') return null;

  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    return () => {
      const bufferSize = audioContext.sampleRate * 0.15;
      const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        const t = i / bufferSize;
        const envelope = Math.exp(-t * 15) * (1 - Math.exp(-t * 100));
        data[i] = (Math.random() * 2 - 1) * envelope * 0.3;
      }

      const source = audioContext.createBufferSource();
      source.buffer = buffer;

      const filter = audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2000;

      const osc = audioContext.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.1);

      const oscGain = audioContext.createGain();
      oscGain.gain.setValueAtTime(0.05, audioContext.currentTime);
      oscGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);

      source.connect(filter);
      filter.connect(audioContext.destination);

      osc.connect(oscGain);
      oscGain.connect(audioContext.destination);

      source.start();
      osc.start();
      osc.stop(audioContext.currentTime + 0.15);
    };
  } catch {
    return null;
  }
};

interface ViewerClientProps {
  media: MediaItem[];
  widgets: CodeWidgets;
  title: string;
  codeId: string;
  shortId: string;
  ownerId: string;
  folderId?: string; // For route/XP tracking
  landingPageConfig?: LandingPageConfig; // Landing page configuration for mixed media
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

// PDF FlipBook Viewer using Real3D FlipBook
const PDFFlipBookViewer = memo(({
  url,
  title,
  onLoad,
  pdfSettings,
}: {
  url: string;
  title: string;
  onLoad: () => void;
  onLinkClick?: (linkUrl: string, source: LinkSource) => void;
  pdfSettings?: PDFFlipbookSettings;
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const flipbookId = useRef(`real3d_${Date.now()}`);

  // Get translations based on browser locale
  const t = viewerTranslations[getBrowserLocale()];

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadReal3DFlipBook = async () => {
      try {
        // Load jQuery if not already loaded
        if (!window.jQuery) {
          await loadScript('https://code.jquery.com/jquery-3.6.3.min.js');
        }

        // Load Real3D FlipBook CSS
        if (!document.querySelector('link[href="/real3dflipbook/css/flipbook.min.css"]')) {
          const cssLink = document.createElement('link');
          cssLink.rel = 'stylesheet';
          cssLink.href = '/real3dflipbook/css/flipbook.min.css';
          document.head.appendChild(cssLink);
        }

        // Load Real3D FlipBook JS
        if (!window.$?.fn?.flipBook) {
          await loadScript('/real3dflipbook/js/flipbook.min.js');
        }

        // Set FLIPBOOK paths explicitly to ensure correct dependency loading
        // The library auto-detects paths from script src, but dynamic loading can fail
        const FLIPBOOK = (window as Window & { FLIPBOOK?: Record<string, string> }).FLIPBOOK;
        if (FLIPBOOK) {
          const basePath = '/real3dflipbook/js/';
          FLIPBOOK.flipbookSrc = basePath + 'flipbook.min.js';
          FLIPBOOK.pdfjsSrc = basePath + 'libs/pdf.min.js';
          FLIPBOOK.pdfjsworkerSrc = basePath + 'libs/pdf.worker.min.js';
          FLIPBOOK.threejsSrc = basePath + 'libs/three.min.js';
          FLIPBOOK.iscrollSrc = basePath + 'libs/iscroll.min.js';
          FLIPBOOK.markSrc = basePath + 'libs/mark.min.js';
          FLIPBOOK.pdfServiceSrc = basePath + 'flipbook.pdfservice.min.js';
          FLIPBOOK.flipbookBook3Src = basePath + 'flipbook.book3.min.js';
          FLIPBOOK.flipbookWebGlSrc = basePath + 'flipbook.webgl.min.js';
          FLIPBOOK.flipBookSwipeSrc = basePath + 'flipbook.swipe.min.js';
          FLIPBOOK.flipBookScrollSrc = basePath + 'flipbook.scroll.min.js';
        }

        // Map PDFFlipbookSettings to Real3D FlipBook options
        const isRTL = pdfSettings?.direction === '2';  // 2 = RTL, 1 = LTR
        const isSinglePage = pdfSettings?.pagemode === '1';  // 1 = single, 2 = double
        const is3D = pdfSettings?.webgl !== false;  // Default true (3D mode)
        const hasSound = pdfSettings?.soundenable !== false;  // Default true
        const flipDuration = pdfSettings?.duration ? pdfSettings.duration / 1000 : 0.8;  // Convert ms to seconds
        const zoomMax = pdfSettings?.zoomratio || 1.5;
        const autoplay = pdfSettings?.autoplay || false;
        const autoplayInterval = 3000;  // 3 seconds between pages
        const mouseWheel = pdfSettings?.scrollwheel !== false;  // Default true
        const enableDownload = pdfSettings?.enabledownload || false;

        // Controls visibility: 'auto' = default, 'true' = always, 'false' = never
        const controlsMode = pdfSettings?.controls || 'auto';
        const showControls = controlsMode !== 'false';  // Show for 'auto' and 'true'

        // Initialize the flipbook after container is ready
        // Use requestAnimationFrame to ensure DOM is rendered
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (window.$ && containerRef.current) {
              const $container = window.$(`#${flipbookId.current}`);
              if ($container && $container.flipBook) {
                try {
                  // Use proxy for external PDF URLs to avoid CORS issues
                  const pdfUrl = url.includes('blob.vercel-storage.com')
                    ? `/api/pdf-proxy?url=${encodeURIComponent(url)}`
                    : url;

                  // Debug logging
                  console.log('[PDFFlipBookViewer] URL check:', {
                    originalUrl: url,
                    hasBlob: url.includes('blob.vercel-storage.com'),
                    finalPdfUrl: pdfUrl,
                    pdfSettings: pdfSettings,
                    showControls: showControls,
                    controlsMode: controlsMode,
                  });

                  $container.flipBook({
                    pdfUrl: pdfUrl,
                    rightToLeft: isRTL,
                    singlePageMode: isSinglePage,
                    viewMode: is3D ? '3d' : 'swipe',  // Use '3d' for WebGL, 'swipe' for 2D
                    responsiveView: true,
                    responsiveViewTreshold: 768,  // Single page on mobile (< 768px)
                    sound: hasSound,
                    pageFlipDuration: flipDuration,
                    autoplayOnStart: autoplay,
                    autoplayInterval: autoplayInterval,
                    mouseWheel: mouseWheel,
                    sideNavigationButtons: showControls,  // Hide side arrows when controls hidden
                    currentPage: { enabled: showControls },  // Hide page indicator
                    // Set absolute paths for all assets to avoid relative path issues
                    assets: {
                      spinner: '/real3dflipbook/assets/images/spinner.gif',
                      preloader: '/real3dflipbook/assets/images/preloader.jpg',
                      flipMp3: '/real3dflipbook/assets/mp3/turnPage2.mp3',
                      backgroundMp3: '/real3dflipbook/assets/mp3/background.mp3',
                    },
                    pdfBrowserViewerIfMobile: false,
                    pdfBrowserViewerIfIE: false,
                    backgroundColor: '#1a1a2e',
                    // Menu buttons - hide all when controls='false'
                    btnToc: { enabled: showControls },
                    btnThumbs: { enabled: showControls },
                    btnZoomIn: { enabled: showControls },
                    btnZoomOut: { enabled: showControls },
                    btnSound: { enabled: showControls && hasSound },
                    btnAutoplay: { enabled: showControls },
                    btnExpand: { enabled: showControls },
                    zoomMin: 1,
                    zoomMax: zoomMax,
                    btnPrint: { enabled: false },
                    btnDownloadPages: { enabled: showControls && enableDownload },
                    btnDownloadPdf: { enabled: showControls && enableDownload },
                    btnShare: { enabled: false },
                  });
                  setIsLoading(false);
                } catch (initError) {
                  console.error('Error initializing flipbook:', initError);
                  setError('Failed to initialize flipbook');
                  setIsLoading(false);
                }
              }
            }
            onLoad();
          }, 100);
        });

      } catch (err) {
        console.error('Failed to load Real3D FlipBook:', err);
        setError('Failed to load flipbook viewer');
        setIsLoading(false);
        onLoad();
      }
    };

    loadReal3DFlipBook();
  }, [url, onLoad, pdfSettings]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 overflow-hidden relative"
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div className="text-white flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            <p>{t.loadingDocument}</p>
          </div>
        </div>
      )}

      {/* Real3D FlipBook Container */}
      <div
        id={flipbookId.current}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
});
PDFFlipBookViewer.displayName = 'PDFFlipBookViewer';

// Multi-PDF Viewer - combines all pages from multiple PDFs with Swiper and flip sound
const MultiPDFViewer = memo(({
  pdfUrls,
  title,
  onLoad,
  onLinkClick
}: {
  pdfUrls: string[];
  title: string;
  onLoad: () => void;
  onLinkClick?: (linkUrl: string, source: LinkSource) => void;
}) => {
  const [pages, setPages] = useState<PDFPageData[]>([]);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({ width: 595, height: 842 });
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('flipbook-muted') === 'true';
    }
    return false;
  });
  const swiperRef = useRef<SwiperType | null>(null);
  const playFlipSoundRef = useRef<(() => void) | null>(null);

  // Get translations based on browser locale
  const t = viewerTranslations[getBrowserLocale()];

  // Initialize sound
  useEffect(() => {
    playFlipSoundRef.current = createFlipSound();
  }, []);

  // Handle mute toggle
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const newValue = !prev;
      localStorage.setItem('flipbook-muted', String(newValue));
      return newValue;
    });
  }, []);

  // Play flip sound
  const playFlipSound = useCallback(() => {
    if (!isMuted && playFlipSoundRef.current) {
      playFlipSoundRef.current();
    }
  }, [isMuted]);

  // Load all PDFs and combine pages
  useEffect(() => {
    const loadAllPDFs = async () => {
      try {
        setLoadingMessage(t.loadingDocument);
        setLoadingProgress(5);

        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        setLoadingProgress(10);

        const allPagesData: PDFPageData[] = [];
        const deviceScale = Math.min(window.devicePixelRatio || 1, 3);
        const scale = 2 * deviceScale;
        let dimensionsSet = false;
        let totalPageCount = 0;
        let processedPages = 0;

        // First pass: count total pages for progress
        for (const url of pdfUrls) {
          try {
            const pdf = await pdfjsLib.getDocument(url).promise;
            totalPageCount += pdf.numPages;
          } catch {
            // Skip failed PDFs
          }
        }

        setTotalPages(totalPageCount);
        setLoadingProgress(15);
        setLoadingMessage(t.processingPages.replace('{count}', String(totalPageCount)));

        // Second pass: render pages
        for (const url of pdfUrls) {
          try {
            const pdf = await pdfjsLib.getDocument(url).promise;

            // Get first page dimensions (from first PDF only)
            if (!dimensionsSet) {
              const firstPage = await pdf.getPage(1);
              const viewport = firstPage.getViewport({ scale: 1 });
              setPageDimensions({ width: viewport.width, height: viewport.height });
              dimensionsSet = true;
            }

            // Render all pages from this PDF
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
                const pageVp = page.getViewport({ scale: 1 });
                for (const annotation of annotations) {
                  if (annotation.subtype === 'Link' && annotation.url) {
                    const rect = annotation.rect;
                    pageLinks.push({
                      url: annotation.url,
                      rect: {
                        x: rect[0],
                        y: pageVp.height - rect[3],
                        width: rect[2] - rect[0],
                        height: rect[3] - rect[1],
                      },
                    });
                  }
                }
              } catch {
                // Ignore annotation errors
              }

              allPagesData.push({ image: imageData, annotations: pageLinks });

              // Update progress
              processedPages++;
              const progress = 15 + ((processedPages / totalPageCount) * 80);
              setLoadingProgress(progress);
              if (processedPages === 1) setLoadingMessage(t.preparingDisplay);
              else if (processedPages > totalPageCount / 2) setLoadingMessage(t.almostThere);
            }
          } catch (error) {
            console.error('Error loading PDF:', url, error);
          }
        }

        setLoadingProgress(100);
        setLoadingMessage(t.ready);
        setPages(allPagesData);
        onLoad();
      } catch (error) {
        console.error('Error loading PDFs:', error);
        onLoad();
      }
    };

    loadAllPDFs();
  }, [pdfUrls, onLoad, t]);

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
    // Show loading spinner while PDFs are being processed
    return <LoadingSpinner progress={loadingProgress} message={loadingMessage || t.loadingContent} />;
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 overflow-hidden">
      <Swiper
        modules={[Virtual]}
        onSwiper={(swiper) => { swiperRef.current = swiper; }}
        onSlideChange={(swiper) => {
          setCurrentPage(swiper.activeIndex);
          playFlipSound();
        }}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          onLinkClick?.(annotation.url, 'pdf');
                        }}
                      />
                    ))}
                  </div>
                </TransformComponent>
              )}
            </TransformWrapper>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Sound mute toggle button */}
      <button
        onClick={toggleMute}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center backdrop-blur-sm transition-all z-20"
        aria-label={isMuted ? 'הפעל סאונד' : 'השתק סאונד'}
      >
        {isMuted ? (
          <VolumeX className="w-5 h-5 text-white/70" />
        ) : (
          <Volume2 className="w-5 h-5 text-white" />
        )}
      </button>

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
MultiPDFViewer.displayName = 'MultiPDFViewer';

// Image Gallery Viewer with Swiper - smooth swipe and pinch-to-zoom
const ImageGalleryViewer = memo(({
  mediaItems,
  title,
  onLoad,
  onLinkClick
}: {
  mediaItems: MediaItem[];
  title: string;
  onLoad: () => void;
  onLinkClick?: (linkUrl: string, source: LinkSource) => void;
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [showLinkButton, setShowLinkButton] = useState(false);
  const linkButtonTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const swiperRef = useRef<SwiperType | null>(null);

  useEffect(() => {
    onLoad();
  }, [onLoad]);

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      if (linkButtonTimeoutRef.current) {
        clearTimeout(linkButtonTimeoutRef.current);
      }
    };
  }, []);

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

  // Auto-show link button after delay when viewing image with link
  useEffect(() => {
    const media = mediaItems[currentPage];
    if (!media?.linkUrl) {
      setShowLinkButton(false);
      return;
    }

    // Show link button after 0.8 seconds of viewing
    const showTimer = setTimeout(() => {
      setShowLinkButton(true);
      // Auto-hide after 5 seconds
      linkButtonTimeoutRef.current = setTimeout(() => {
        setShowLinkButton(false);
      }, 5000);
    }, 800);

    return () => {
      clearTimeout(showTimer);
      if (linkButtonTimeoutRef.current) {
        clearTimeout(linkButtonTimeoutRef.current);
      }
    };
  }, [currentPage, mediaItems]);

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
            onClick={(e) => {
              e.stopPropagation();
              onLinkClick?.(media.linkUrl!, 'media');
            }}
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
                    style={{
                      transform: 'translateZ(0)',
                      backfaceVisibility: 'hidden',
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
          onClick={(e) => {
            e.stopPropagation();
            onLinkClick?.(currentMedia.linkUrl!, 'media');
          }}
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

export default function ViewerClient({ media, widgets, title, codeId, shortId, ownerId, folderId, landingPageConfig }: ViewerClientProps) {
  // Get browser locale for translations
  const [locale, setLocale] = useState<'he' | 'en'>('he');
  const t = viewerTranslations[locale];

  // Check for display mode (for QStage big screen)
  const [isDisplayMode, setIsDisplayMode] = useState(false);

  useEffect(() => {
    // Check URL params for display mode
    const params = new URLSearchParams(window.location.search);
    setIsDisplayMode(params.get('display') === 'true');
  }, []);

  useEffect(() => {
    const browserLocale = getBrowserLocale();
    setLocale(browserLocale);
    // Update initial loading message to match browser locale
    setLoadMessage(viewerTranslations[browserLocale].loadingContent);
  }, []);

  // Register service worker for PWA installation
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('[SW] Registered:', registration.scope);
        })
        .catch((error) => {
          console.error('[SW] Registration failed:', error);
        });
    }
  }, []);

  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadMessage, setLoadMessage] = useState(t.loadingContent);
  const [showContent, setShowContent] = useState(false);
  const loadedCount = useRef(0);

  // Track link clicks (fire and forget)
  const trackLinkClick = useCallback((linkUrl: string, source: LinkSource) => {
    createLinkClick(codeId, shortId, ownerId, linkUrl, source)
      .then(() => console.log('[ViewerClient] Link click tracked:', source, linkUrl))
      .catch((err) => console.error('[ViewerClient] Error tracking link click:', err));
  }, [codeId, shortId, ownerId]);

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

  const [currentIndex, setCurrentIndex] = useState(0);
  const swiperRef = useRef<SwiperType | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);

  // Landing page state
  const [showLandingPage, setShowLandingPage] = useState(true);
  const [activeViewer, setActiveViewer] = useState<{
    type: string;
    media: MediaItem | MediaItem[];
  } | null>(null);

  const currentMedia = media[currentIndex] || media[0];
  const hasMultipleMedia = media.length > 1;

  // Check if all media are images/gifs (for backward compatibility with old image gallery behavior)
  const isAllImages = media.length > 0 && media.every(m => m.type === 'image' || m.type === 'gif');

  // Check if all media are PDFs (for combined PDF viewing)
  const isAllPDFs = media.length > 0 && media.every(m => m.type === 'pdf');

  // For single media detection
  const isPDF = media.length === 1 && currentMedia?.type === 'pdf';
  const isVideo = media.length === 1 && currentMedia?.type === 'video';
  const isLink = media.length === 1 && currentMedia?.type === 'link';
  const isRiddle = media.length === 1 && currentMedia?.type === 'riddle';
  const isWordCloud = media.length === 1 && currentMedia?.type === 'wordcloud';
  const isSelfiebeam = media.length === 1 && currentMedia?.type === 'selfiebeam';
  const isQVote = media.length === 1 && currentMedia?.type === 'qvote';
  const isWeeklyCal = media.length === 1 && currentMedia?.type === 'weeklycal';
  const isQStage = media.length === 1 && currentMedia?.type === 'qstage';
  const isQHunt = media.length === 1 && currentMedia?.type === 'qhunt';
  const isQTreasure = media.length === 1 && currentMedia?.type === 'qtreasure';

  // Check if we need the mixed media swiper (multiple items with different types)
  const needsMixedSwiper = hasMultipleMedia && !isAllImages && !isAllPDFs;

  // Determine if landing page should show
  const shouldUseLandingPage = (() => {
    // Only for mixed media
    if (!needsMixedSwiper) return false;
    // If explicitly disabled, don't show
    if (landingPageConfig?.enabled === false) return false;
    // If enabled or auto-detect (default enabled)
    return shouldShowLandingPage(media);
  })();

  // Redirect for link-type media (external links like wa.me refuse iframe embedding)
  useEffect(() => {
    if (isLink && currentMedia?.url) {
      // Track the link click before redirecting
      trackLinkClick(currentMedia.url, 'link');
      // Small delay to ensure analytics is tracked, then redirect
      const timer = setTimeout(() => {
        window.location.href = currentMedia.url;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLink, currentMedia?.url, trackLinkClick]);

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

      if (loadedCount.current === 1) setLoadMessage(t.preparingDisplay);
      else if (progress > 50) setLoadMessage(t.almostThere);

      if (loadedCount.current >= totalItems) {
        setLoadProgress(100);
        setLoadMessage(t.ready);
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

  if (loading || !showContent) {
    return <LoadingSpinner progress={loadProgress} message={loadMessage} />;
  }

  if (!currentMedia) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <p>{t.noContent}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden animate-fadeIn">
      {/* PWA Install Banner */}
      <PWAInstallBanner shortId={shortId} enabled={widgets?.pwaEncourage?.enabled !== false} />

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>

      {/* Content based on type */}
      <div className="w-full h-screen">
        {/* Landing Page for mixed media */}
        {shouldUseLandingPage && showLandingPage && !activeViewer ? (
          <LandingPageViewer
            config={landingPageConfig || DEFAULT_LANDING_PAGE_CONFIG}
            media={media}
            title={title}
            codeId={codeId}
            shortId={shortId}
            ownerId={ownerId}
            folderId={folderId}
            onOpenViewer={(mediaOrItems, viewerType) => {
              setActiveViewer({ type: viewerType, media: mediaOrItems });
              setShowLandingPage(false);
            }}
          />
        ) : activeViewer ? (
          // Active viewer from landing page
          <div className="w-full h-full relative">
            {/* Back button */}
            <button
              onClick={() => {
                setActiveViewer(null);
                setShowLandingPage(true);
              }}
              className="fixed top-4 start-4 z-50 p-3 rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 transition-colors"
              style={{ direction: 'ltr' }}
            >
              <ArrowLeft className="w-6 h-6" />
            </button>

            {/* Render viewer based on type */}
            {activeViewer.type === 'album' && Array.isArray(activeViewer.media) && (
              <ImageGalleryViewer
                mediaItems={activeViewer.media}
                title={title}
                onLoad={handleMediaLoad}
                onLinkClick={trackLinkClick}
              />
            )}
            {activeViewer.type === 'pdf' && !Array.isArray(activeViewer.media) && (
              <PDFFlipBookViewer
                url={activeViewer.media.url}
                title={title}
                onLoad={handleMediaLoad}
                onLinkClick={trackLinkClick}
                pdfSettings={activeViewer.media.pdfSettings}
              />
            )}
            {activeViewer.type === 'video' && !Array.isArray(activeViewer.media) && (
              <div className="w-full h-full flex items-center justify-center bg-black">
                <video
                  src={activeViewer.media.url}
                  className="max-w-full max-h-full"
                  controls
                  autoPlay
                  playsInline
                />
              </div>
            )}
            {activeViewer.type === 'link' && !Array.isArray(activeViewer.media) && (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mb-4"></div>
                <p className="text-lg">מעביר אותך...</p>
                <p className="text-sm text-gray-400 mt-2 max-w-xs text-center break-all">{activeViewer.media.url}</p>
              </div>
            )}
            {activeViewer.type === 'riddle' && !Array.isArray(activeViewer.media) && activeViewer.media.riddleContent && (
              <RiddleViewer
                content={activeViewer.media.riddleContent}
                codeId={codeId}
                shortId={shortId}
                ownerId={ownerId}
                folderId={folderId}
              />
            )}
            {activeViewer.type === 'selfiebeam' && !Array.isArray(activeViewer.media) && activeViewer.media.selfiebeamContent && (
              <SelfiebeamViewer
                content={activeViewer.media.selfiebeamContent}
                codeId={codeId}
                shortId={shortId}
                ownerId={ownerId}
              />
            )}
            {activeViewer.type === 'qvote' && !Array.isArray(activeViewer.media) && activeViewer.media.qvoteConfig && (
              <QVoteViewer
                config={activeViewer.media.qvoteConfig}
                codeId={codeId}
                mediaId={activeViewer.media.id}
                shortId={shortId}
                ownerId={ownerId}
              />
            )}
            {activeViewer.type === 'weeklycal' && !Array.isArray(activeViewer.media) && activeViewer.media.weeklycalConfig && (
              <WeeklyCalendarViewer
                config={activeViewer.media.weeklycalConfig}
                codeId={codeId}
                shortId={shortId}
                ownerId={ownerId}
              />
            )}
            {activeViewer.type === 'qstage' && !Array.isArray(activeViewer.media) && (
              isDisplayMode ? (
                <QStageDisplay
                  codeId={codeId}
                  mediaId={activeViewer.media.id}
                  initialConfig={activeViewer.media.qstageConfig}
                />
              ) : (
                <QStageMobileVoter
                  codeId={codeId}
                  mediaId={activeViewer.media.id}
                  initialConfig={activeViewer.media.qstageConfig}
                />
              )
            )}
            {activeViewer.type === 'qtreasure' && !Array.isArray(activeViewer.media) && activeViewer.media.qtreasureConfig && (
              <QTreasurePlayerView
                codeId={codeId}
                mediaId={activeViewer.media.id}
                initialConfig={activeViewer.media.qtreasureConfig}
                shortId={shortId}
              />
            )}
          </div>
        ) : needsMixedSwiper ? (
          // Mixed media types - use swiper to navigate between all types
          <div className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 overflow-hidden relative">
            <Swiper
              modules={[Virtual]}
              onSwiper={(swiper) => { swiperRef.current = swiper; }}
              onSlideChange={(swiper) => setCurrentIndex(swiper.activeIndex)}
              dir="rtl"
              slidesPerView={1}
              spaceBetween={0}
              speed={300}
              resistance={true}
              resistanceRatio={0.85}
              touchRatio={1}
              threshold={10}
              cssMode={false}
              allowTouchMove={!isZoomed}
              virtual
              className="w-full h-full"
              style={{ direction: 'rtl' }}
            >
              {media.map((item, index) => (
                <SwiperSlide key={index} virtualIndex={index} className="flex items-center justify-center">
                  {item.type === 'riddle' && item.riddleContent ? (
                    <RiddleViewer content={item.riddleContent} codeId={codeId} shortId={shortId} ownerId={ownerId} folderId={folderId} />
                  ) : item.type === 'selfiebeam' && item.selfiebeamContent ? (
                    <SelfiebeamViewer content={item.selfiebeamContent} codeId={codeId} shortId={shortId} ownerId={ownerId} />
                  ) : item.type === 'pdf' ? (
                    <PDFFlipBookViewer url={item.url} title={title} onLoad={handleMediaLoad} onLinkClick={trackLinkClick} pdfSettings={item.pdfSettings} />
                  ) : item.type === 'video' ? (
                    <div className="w-full h-full flex items-center justify-center bg-black">
                      <video
                        src={item.url}
                        className="max-w-full max-h-full"
                        controls
                        autoPlay={index === currentIndex}
                        playsInline
                      />
                    </div>
                  ) : item.type === 'link' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mb-4"></div>
                      <p className="text-lg">מעביר אותך...</p>
                      <p className="text-sm text-gray-400 mt-2 max-w-xs text-center break-all">{item.url}</p>
                    </div>
                  ) : item.type === 'wordcloud' ? (
                    <iframe
                      src={item.url}
                      className="w-full h-full"
                      title={item.title || 'ענן מילים'}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                  ) : (
                    // Image or gif
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
                            src={item.url}
                            alt={`${title} - ${index + 1}`}
                            className="max-w-full max-h-[100vh] object-contain select-none"
                            draggable={false}
                            style={{
                              transform: 'translateZ(0)',
                              backfaceVisibility: 'hidden',
                            }}
                          />
                        </TransformComponent>
                      )}
                    </TransformWrapper>
                  )}
                </SwiperSlide>
              ))}
            </Swiper>

            {/* Page indicator for mixed media */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
              {media.length <= 10 ? (
                media.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => swiperRef.current?.slideTo(index)}
                    className={`rounded-full transition-all duration-200 ${
                      index === currentIndex
                        ? 'w-6 h-2 bg-white'
                        : 'w-2 h-2 bg-white/40 hover:bg-white/60'
                    }`}
                  />
                ))
              ) : (
                <div className="px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-sm">
                  <span className="text-white/90 text-sm font-medium">
                    {currentIndex + 1} / {media.length}
                  </span>
                </div>
              )}
            </div>

            {/* Navigation arrows - only on desktop */}
            <div className="hidden md:block">
              {currentIndex > 0 && (
                <button
                  onClick={() => swiperRef.current?.slidePrev()}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center backdrop-blur-sm transition-all hover:scale-110 z-10"
                  aria-label="הקודם"
                >
                  <ChevronRight className="w-6 h-6 text-white" />
                </button>
              )}
              {currentIndex < media.length - 1 && (
                <button
                  onClick={() => swiperRef.current?.slideNext()}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center backdrop-blur-sm transition-all hover:scale-110 z-10"
                  aria-label="הבא"
                >
                  <ChevronLeft className="w-6 h-6 text-white" />
                </button>
              )}
            </div>
          </div>
        ) : isRiddle && currentMedia.riddleContent ? (
          <RiddleViewer content={currentMedia.riddleContent} codeId={codeId} shortId={shortId} ownerId={ownerId} folderId={folderId} />
        ) : isSelfiebeam && currentMedia.selfiebeamContent ? (
          <SelfiebeamViewer content={currentMedia.selfiebeamContent} codeId={codeId} shortId={shortId} ownerId={ownerId} />
        ) : isQVote && currentMedia.qvoteConfig ? (
          <QVoteViewer config={currentMedia.qvoteConfig} codeId={codeId} mediaId={currentMedia.id} shortId={shortId} ownerId={ownerId} />
        ) : isWeeklyCal && currentMedia.weeklycalConfig ? (
          <WeeklyCalendarViewer config={currentMedia.weeklycalConfig} codeId={codeId} shortId={shortId} ownerId={ownerId} />
        ) : isQStage ? (
          isDisplayMode ? (
            <QStageDisplay codeId={codeId} mediaId={currentMedia.id} initialConfig={currentMedia.qstageConfig} />
          ) : (
            <QStageMobileVoter codeId={codeId} mediaId={currentMedia.id} initialConfig={currentMedia.qstageConfig} />
          )
        ) : isQHunt && currentMedia.qhuntConfig ? (
          isDisplayMode ? (
            <QHuntDisplay codeId={codeId} mediaId={currentMedia.id} initialConfig={currentMedia.qhuntConfig} />
          ) : (
            <QHuntPlayerView codeId={codeId} mediaId={currentMedia.id} initialConfig={currentMedia.qhuntConfig} shortId={shortId} />
          )
        ) : isQTreasure && currentMedia.qtreasureConfig ? (
          <QTreasurePlayerView
            codeId={codeId}
            mediaId={currentMedia.id}
            initialConfig={currentMedia.qtreasureConfig}
            shortId={shortId}
          />
        ) : isPDF ? (
          <PDFFlipBookViewer url={currentMedia.url} title={title} onLoad={handleMediaLoad} onLinkClick={trackLinkClick} pdfSettings={currentMedia.pdfSettings} />
        ) : isAllPDFs && hasMultipleMedia ? (
          <MultiPDFViewer pdfUrls={media.map(m => m.url)} title={title} onLoad={handleMediaLoad} onLinkClick={trackLinkClick} />
        ) : isAllImages && hasMultipleMedia ? (
          <ImageGalleryViewer
            mediaItems={media}
            title={title}
            onLoad={handleMediaLoad}
            onLinkClick={trackLinkClick}
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
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mb-4"></div>
            <p className="text-lg">מעביר אותך...</p>
            <p className="text-sm text-gray-400 mt-2 max-w-xs text-center break-all">{currentMedia.url}</p>
          </div>
        ) : isWordCloud ? (
          <iframe
            src={currentMedia.url}
            className="w-full h-full"
            title={currentMedia.title || 'ענן מילים'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        ) : (
          // Single image - use ImageGalleryViewer for link button support
          <ImageGalleryViewer
            mediaItems={[currentMedia]}
            title={title}
            onLoad={handleMediaLoad}
            onLinkClick={trackLinkClick}
          />
        )}
      </div>

      {/* WhatsApp Widget */}
      {widgets.whatsapp?.enabled && (
        <WhatsAppWidget
          config={widgets.whatsapp}
          onTrackClick={() => {
            const url = widgets.whatsapp?.type === 'phone'
              ? `https://wa.me/${widgets.whatsapp.phoneNumber}`
              : widgets.whatsapp?.groupLink || '';
            trackLinkClick(url, 'whatsapp');
          }}
        />
      )}

      {/* Contact Widgets */}
      {widgets.phone?.enabled && (
        <ContactWidget
          type="phone"
          config={widgets.phone}
          offset={widgets.whatsapp?.enabled ? 72 : 0}
          onTrackClick={() => trackLinkClick(`tel:+${widgets.phone!.phoneNumber}`, 'link')}
        />
      )}
      {widgets.email?.enabled && (
        <ContactWidget
          type="email"
          config={widgets.email}
          offset={(widgets.whatsapp?.enabled ? 72 : 0) + (widgets.phone?.enabled ? 72 : 0)}
          onTrackClick={() => trackLinkClick(`mailto:${widgets.email!.email}`, 'link')}
        />
      )}
      {widgets.sms?.enabled && (
        <ContactWidget
          type="sms"
          config={widgets.sms}
          offset={(widgets.whatsapp?.enabled ? 72 : 0) + (widgets.phone?.enabled ? 72 : 0) + (widgets.email?.enabled ? 72 : 0)}
          onTrackClick={() => trackLinkClick(`sms:+${widgets.sms!.phoneNumber}`, 'link')}
        />
      )}
      {widgets.navigation?.enabled && (
        <ContactWidget
          type="navigation"
          config={widgets.navigation}
          offset={(widgets.whatsapp?.enabled ? 72 : 0) + (widgets.phone?.enabled ? 72 : 0) + (widgets.email?.enabled ? 72 : 0) + (widgets.sms?.enabled ? 72 : 0)}
          onTrackClick={() => {
            const url = widgets.navigation!.app === 'waze'
              ? `https://waze.com/ul?q=${encodeURIComponent(widgets.navigation!.address)}&navigate=yes`
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(widgets.navigation!.address)}`;
            trackLinkClick(url, 'link');
          }}
        />
      )}
    </div>
  );
}
