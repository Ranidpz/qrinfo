'use client';

import { useMemo } from 'react';
import {
  Image as ImageIcon,
  Images,
  Video,
  FileText,
  ExternalLink,
  ScrollText,
  Cloud,
  Camera,
  Vote,
  CalendarDays,
  File,
} from 'lucide-react';
import { MediaItem, LandingPageConfig, DEFAULT_LANDING_PAGE_CONFIG } from '@/types';
import { groupMediaForLandingPage, LandingPageButton } from '@/lib/landingPage';

// Helper to get browser locale
function getBrowserLocale(): 'he' | 'en' {
  if (typeof window === 'undefined') return 'he';
  const lang = navigator.language || 'he';
  return lang.startsWith('he') ? 'he' : 'en';
}

// Icon mapping
const IconMap: Record<string, React.FC<{ className?: string }>> = {
  Image: ImageIcon,
  Images: Images,
  Video: Video,
  FileText: FileText,
  ExternalLink: ExternalLink,
  ScrollText: ScrollText,
  Cloud: Cloud,
  Camera: Camera,
  Vote: Vote,
  CalendarDays: CalendarDays,
  File: File,
};

interface LandingPageViewerProps {
  config?: LandingPageConfig;
  media: MediaItem[];
  title: string;
  codeId: string;
  shortId: string;
  ownerId: string;
  folderId?: string;
  onOpenViewer: (media: MediaItem | MediaItem[], viewerType: string) => void;
}

export default function LandingPageViewer({
  config,
  media,
  title,
  onOpenViewer,
}: LandingPageViewerProps) {
  const locale = getBrowserLocale();
  const isRTL = locale === 'he';

  // Merge with defaults
  const landingConfig: LandingPageConfig = {
    ...DEFAULT_LANDING_PAGE_CONFIG,
    ...config,
  };

  // Group media into buttons
  const buttons = useMemo(() => {
    return groupMediaForLandingPage(media, locale);
  }, [media, locale]);

  // Get button style classes
  const getButtonClasses = (style?: string): string => {
    const baseClasses = 'w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-200 active:scale-[0.98]';

    switch (style) {
      case 'outline':
        return `${baseClasses} border-2 bg-transparent hover:bg-white/10`;
      case 'glass':
        return `${baseClasses} backdrop-blur-md bg-white/10 border border-white/20 hover:bg-white/20`;
      case 'solid':
      default:
        return `${baseClasses} hover:brightness-110 shadow-lg`;
    }
  };

  // Handle button click
  const handleButtonClick = (button: LandingPageButton) => {
    if (button.type === 'album') {
      onOpenViewer(button.media as MediaItem[], 'album');
    } else {
      const item = button.media as MediaItem;
      onOpenViewer(item, item.type);
    }
  };

  // Get icon component
  const getIcon = (iconName: string) => {
    const IconComponent = IconMap[iconName] || File;
    return IconComponent;
  };

  return (
    <div
      className="min-h-screen w-full relative flex flex-col"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ backgroundColor: landingConfig.backgroundColor }}
    >
      {/* Background Image */}
      {landingConfig.backgroundImageUrl && (
        <>
          <div
            className={`absolute inset-0 bg-cover bg-center ${
              landingConfig.backgroundBlur ? 'blur-md scale-105' : ''
            }`}
            style={{
              backgroundImage: `url(${landingConfig.backgroundImageUrl})`,
            }}
          />
          {/* Overlay for text readability */}
          {(landingConfig.imageOverlayOpacity ?? 40) > 0 && (
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: `rgba(0, 0, 0, ${(landingConfig.imageOverlayOpacity ?? 40) / 100})`,
              }}
            />
          )}
        </>
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col flex-1 px-6 py-8 safe-area-inset">
        {/* Header with Title */}
        <div className="text-center mb-8">
          {landingConfig.title ? (
            <h1
              className="text-2xl font-bold mb-2"
              style={{ color: landingConfig.buttonTextColor }}
            >
              {landingConfig.title}
            </h1>
          ) : title ? (
            <h1
              className="text-2xl font-bold mb-2"
              style={{ color: landingConfig.buttonTextColor }}
            >
              {title}
            </h1>
          ) : null}

          {landingConfig.subtitle && (
            <p
              className="text-base opacity-80"
              style={{ color: landingConfig.buttonTextColor }}
            >
              {landingConfig.subtitle}
            </p>
          )}
        </div>

        {/* Buttons */}
        <div
          className={`flex-1 flex flex-col ${
            landingConfig.buttonLayout === 'grid' ? 'justify-start' : 'justify-center'
          }`}
        >
          <div
            className={
              landingConfig.buttonLayout === 'grid'
                ? 'grid grid-cols-2 gap-4'
                : 'flex flex-col gap-4 max-w-md mx-auto w-full'
            }
          >
            {buttons.map((button) => {
              const Icon = getIcon(button.icon);
              const isOutline = landingConfig.buttonStyle === 'outline';
              const isGlass = landingConfig.buttonStyle === 'glass';

              return (
                <button
                  key={button.id}
                  onClick={() => handleButtonClick(button)}
                  className={getButtonClasses(landingConfig.buttonStyle)}
                  style={{
                    backgroundColor: isOutline || isGlass ? 'transparent' : landingConfig.buttonColor,
                    borderColor: isOutline ? landingConfig.buttonColor : undefined,
                    color: landingConfig.buttonTextColor,
                  }}
                >
                  <div
                    className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                      isOutline || isGlass ? '' : 'bg-white/20'
                    }`}
                    style={isOutline ? { backgroundColor: `${landingConfig.buttonColor}20` } : undefined}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 text-start">
                    <span className="text-lg font-medium block">
                      {landingConfig.buttonTitles?.[button.id] || button.title}
                    </span>
                    {button.type === 'album' && Array.isArray(button.media) && (
                      <span className="text-sm opacity-70">
                        {button.media.length} {isRTL ? 'תמונות' : 'photos'}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Empty state */}
        {buttons.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p
              className="text-center opacity-70"
              style={{ color: landingConfig.buttonTextColor }}
            >
              {isRTL ? 'אין תוכן זמין כרגע' : 'No content available'}
            </p>
          </div>
        )}
      </div>

      {/* Safe area padding for iOS */}
      <style jsx global>{`
        .safe-area-inset {
          padding-top: max(2rem, env(safe-area-inset-top));
          padding-bottom: max(2rem, env(safe-area-inset-bottom));
        }
      `}</style>
    </div>
  );
}
