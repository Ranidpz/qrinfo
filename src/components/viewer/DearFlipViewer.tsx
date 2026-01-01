'use client';

import { useEffect, useRef, useState, memo } from 'react';

interface DearFlipViewerProps {
  pdfUrl: string;
  height?: number | string;
  webgl?: boolean;
  backgroundColor?: string;
  onReady?: () => void;
}

// Note: Window interface is extended in ViewerClient.tsx
// This component is deprecated - using 3D FlipBook instead

const DearFlipViewer = memo(({
  pdfUrl,
  height = '100%',
  webgl = true,
  backgroundColor = '#1a1a2e',
  onReady
}: DearFlipViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scriptsLoadedRef = useRef(false);

  useEffect(() => {
    // Don't run on server
    if (typeof window === 'undefined') return;

    const loadScripts = async () => {
      try {
        // Load jQuery if not already loaded
        if (!window.jQuery) {
          await loadScript('/dflip/js/libs/jquery.min.js');
        }

        // Load DearFlip CSS
        if (!document.querySelector('link[href="/dflip/css/dflip.min.css"]')) {
          const cssLink = document.createElement('link');
          cssLink.rel = 'stylesheet';
          cssLink.href = '/dflip/css/dflip.min.css';
          document.head.appendChild(cssLink);

          const iconsLink = document.createElement('link');
          iconsLink.rel = 'stylesheet';
          iconsLink.href = '/dflip/css/themify-icons.min.css';
          document.head.appendChild(iconsLink);
        }

        // Load DearFlip JS if not already loaded
        if (!window.DFLIP) {
          await loadScript('/dflip/js/dflip.min.js');
        }

        scriptsLoadedRef.current = true;
        setIsLoading(false);

        // Initialize the flipbook after a short delay
        setTimeout(() => {
          if (window.DFLIP?.parseBooks) {
            window.DFLIP.parseBooks();
          }
          onReady?.();
        }, 100);

      } catch (err) {
        console.error('Failed to load DearFlip:', err);
        setError('Failed to load flipbook viewer');
        setIsLoading(false);
      }
    };

    loadScripts();

    // Cleanup
    return () => {
      // DearFlip doesn't have a built-in destroy method in lite version
    };
  }, [onReady]);

  // Re-parse when PDF URL changes
  useEffect(() => {
    if (scriptsLoadedRef.current && window.DFLIP?.parseBooks) {
      setTimeout(() => {
        window.DFLIP?.parseBooks?.();
      }, 100);
    }
  }, [pdfUrl]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative" style={{ backgroundColor }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div className="text-white flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            <p>Loading flipbook...</p>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="_df_book"
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
        data-source={pdfUrl}
        data-webgl={webgl ? 'true' : 'false'}
        data-backgroundcolor={backgroundColor}
        data-hard="cover"
        data-autoplay="false"
        data-autoplaystart="false"
        data-duration="800"
        data-soundenable="true"
        data-direction="2"
        data-pagemode="2"
        data-singlepage="auto"
      />
    </div>
  );
});

DearFlipViewer.displayName = 'DearFlipViewer';

// Helper function to load scripts
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if script already exists
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

export default DearFlipViewer;
