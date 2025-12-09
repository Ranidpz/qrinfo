'use client';

import { useState, useEffect } from 'react';
import { X, ExternalLink, Smartphone, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface MobilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title?: string;
}

export default function MobilePreviewModal({
  isOpen,
  onClose,
  url,
  title,
}: MobilePreviewModalProps) {
  const t = useTranslations('modals');
  const [isLoading, setIsLoading] = useState(true);
  const [showSpinner, setShowSpinner] = useState(false);

  // Reset loading state when URL changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setShowSpinner(false);

      // Show spinner after 1 second if still loading
      const timer = setTimeout(() => {
        setShowSpinner(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isOpen, url]);

  if (!isOpen) return null;

  // Add utm_source parameter to track preview views
  const previewUrl = `${url}?utm_source=preview`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative z-10 flex flex-col items-center gap-4 max-h-[90vh]">
        {/* Header with title and close button */}
        <div className="flex items-center gap-4 text-white">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            <span className="font-medium">{t('mobilePreview')}</span>
            {title && (
              <>
                <span className="text-white/50">•</span>
                <span className="text-white/70">{title}</span>
              </>
            )}
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            title={t('openInNewTab')}
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Phone Frame */}
        <div className="relative">
          {/* Phone outer frame - iPhone style */}
          <div className="relative bg-gray-900 rounded-[3rem] p-3 shadow-2xl shadow-black/50">
            {/* Phone inner bezel */}
            <div className="relative bg-black rounded-[2.5rem] overflow-hidden">
              {/* Screen */}
              <div className="relative w-[375px] h-[667px] bg-black overflow-hidden rounded-[2.3rem]">
                {/* Loading spinner - shows after 1 second */}
                {isLoading && showSpinner && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 bg-black">
                    <Loader2 className="w-8 h-8 text-white/70 animate-spin" />
                  </div>
                )}
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title={title || 'Mobile Preview'}
                  allow="autoplay; fullscreen"
                  onLoad={() => setIsLoading(false)}
                />
              </div>

              {/* Home indicator */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/30 rounded-full z-10" />
            </div>
          </div>

          {/* Side buttons */}
          <div className="absolute right-[-3px] top-28 w-1 h-12 bg-gray-700 rounded-r-sm" />
          <div className="absolute left-[-3px] top-20 w-1 h-8 bg-gray-700 rounded-l-sm" />
          <div className="absolute left-[-3px] top-32 w-1 h-14 bg-gray-700 rounded-l-sm" />
          <div className="absolute left-[-3px] top-48 w-1 h-14 bg-gray-700 rounded-l-sm" />
        </div>

        {/* URL Display */}
        <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg text-white/70 text-sm">
          <span className="font-mono" dir="ltr">{url}</span>
        </div>
      </div>
    </div>
  );
}
