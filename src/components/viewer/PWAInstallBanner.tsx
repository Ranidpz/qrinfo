'use client';

import { useState, useEffect, useCallback } from 'react';
import { Smartphone, Download, X, Share, MoreVertical } from 'lucide-react';

interface PWAInstallBannerProps {
  shortId: string;
  enabled?: boolean; // Default true - show banner unless explicitly disabled
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Helper to get browser locale
function getBrowserLocale(): 'he' | 'en' {
  if (typeof window === 'undefined') return 'he';
  const lang = navigator.language || 'he';
  return lang.startsWith('he') ? 'he' : 'en';
}

// Detect iOS
function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as { MSStream?: unknown }).MSStream;
}

// Detect if running as standalone (already installed)
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export default function PWAInstallBanner({ shortId, enabled = true }: PWAInstallBannerProps) {
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [showAndroidInstructions, setShowAndroidInstructions] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOSDevice, setIsIOSDevice] = useState(false);

  const locale = getBrowserLocale();
  const isRTL = locale === 'he';

  // Check if banner should be shown
  useEffect(() => {
    // Don't show if already installed
    if (isStandalone()) {
      return;
    }

    // Check if user dismissed this banner in current session
    // Use sessionStorage so banner shows again on next visit
    const dismissedKey = `pwa_dismissed_${shortId}`;
    const dismissed = sessionStorage.getItem(dismissedKey);
    if (dismissed) {
      return;
    }

    // Check if iOS
    const isIOS_ = isIOS();
    setIsIOSDevice(isIOS_);

    // For iOS, show banner after a short delay (no SW needed)
    if (isIOS_) {
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 2000);
      return () => clearTimeout(timer);
    }

    // For non-iOS, wait for service worker to be ready before showing banner
    // This ensures the install prompt will work
    const setupInstallPrompt = async () => {
      // Wait for service worker to be ready
      if ('serviceWorker' in navigator) {
        try {
          await navigator.serviceWorker.ready;
        } catch {
          // SW not available, continue anyway
        }
      }

      // For other browsers, wait for beforeinstallprompt event
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setShowBanner(true);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      // Show banner anyway after 3 seconds if event doesn't fire
      // (some browsers support PWA but don't fire the event)
      const fallbackTimer = setTimeout(() => {
        setShowBanner(true);
      }, 3000);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        clearTimeout(fallbackTimer);
      };
    };

    const cleanup = setupInstallPrompt();

    // Listen for successful installation
    const handleAppInstalled = () => {
      setShowBanner(false);
      console.log('[PWA] App installed successfully');
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      cleanup.then((cleanupFn) => cleanupFn?.());
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [shortId]);

  // Handle install click
  const handleInstall = useCallback(async () => {
    if (isIOSDevice) {
      setShowIOSInstructions(true);
      return;
    }

    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setShowBanner(false);
      }

      setDeferredPrompt(null);
    } else {
      // No prompt available - show manual Android instructions
      setShowAndroidInstructions(true);
    }
  }, [deferredPrompt, isIOSDevice]);

  // Handle dismiss
  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    setShowIOSInstructions(false);
    setShowAndroidInstructions(false);

    // Save dismissal in sessionStorage (only for current session)
    // Banner will show again on next visit until user installs the app
    sessionStorage.setItem(`pwa_dismissed_${shortId}`, 'true');
  }, [shortId]);

  // Don't render if disabled or not showing
  if (!enabled || !showBanner) {
    return null;
  }

  return (
    <>
      {/* Main Banner */}
      <div
        className="fixed top-0 left-0 right-0 z-50 animate-slide-down"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 shadow-lg">
          <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Top row: Icon, Text, Close button (mobile) */}
            <div className="flex items-center gap-3 w-full sm:w-auto sm:flex-1">
              {/* Icon */}
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-white" />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {isRTL ? 'הוסף למסך הבית' : 'Add to Home Screen'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {isRTL ? 'לגישה מהירה בכל עת' : 'For quick access anytime'}
                </p>
              </div>

              {/* Close Button - Mobile only */}
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors sm:hidden"
                aria-label={isRTL ? 'סגור' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Install Button - Full width on mobile */}
            <button
              onClick={handleInstall}
              className="flex-shrink-0 flex items-center justify-center gap-1.5 px-3 py-2 w-full sm:w-auto bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {isIOSDevice ? (
                <>
                  <Share className="w-4 h-4" />
                  <span>{isRTL ? 'הוראות' : 'How'}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>{isRTL ? 'התקנה' : 'Install'}</span>
                </>
              )}
            </button>

            {/* Close Button - Desktop only */}
            <button
              onClick={handleDismiss}
              className="hidden sm:flex flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors"
              aria-label={isRTL ? 'סגור' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Android Instructions Modal */}
      {showAndroidInstructions && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowAndroidInstructions(false)}
          />
          <div
            className="relative bg-white dark:bg-gray-900 rounded-t-3xl shadow-xl w-full max-h-[70vh] overflow-hidden animate-slide-up"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>

            {/* Content */}
            <div className="px-6 pb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-6">
                {isRTL ? 'התקנת האפליקציה' : 'Install App'}
              </h2>

              {/* Steps */}
              <div className="space-y-4">
                {/* Step 1 */}
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {isRTL ? 'פתחו את תפריט הדפדפן' : 'Open browser menu'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {isRTL
                        ? 'לחצו על 3 הנקודות בפינה העליונה'
                        : 'Tap the 3 dots in the top corner'}
                    </p>
                    <div className="mt-2 inline-flex items-center justify-center w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      <MoreVertical className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {isRTL
                        ? 'בחרו "התקן אפליקציה" או "הוסף למסך הבית"'
                        : 'Select "Install app" or "Add to Home screen"'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {isRTL
                        ? 'גללו בתפריט עד שתמצאו'
                        : 'Scroll in the menu to find it'}
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {isRTL ? 'לחצו "התקן"' : 'Tap "Install"'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {isRTL
                        ? 'בחלון שנפתח'
                        : 'In the popup that appears'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Done Button */}
              <button
                onClick={() => {
                  setShowAndroidInstructions(false);
                  handleDismiss();
                }}
                className="w-full mt-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-colors"
              >
                {isRTL ? 'הבנתי' : 'Got it'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS Instructions Modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowIOSInstructions(false)}
          />
          <div
            className="relative bg-white dark:bg-gray-900 rounded-t-3xl shadow-xl w-full max-h-[70vh] overflow-hidden animate-slide-up"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>

            {/* Content */}
            <div className="px-6 pb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-6">
                {isRTL ? 'הוסף למסך הבית' : 'Add to Home Screen'}
              </h2>

              {/* Steps */}
              <div className="space-y-4">
                {/* Step 1 */}
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {isRTL ? 'לחצו על כפתור השיתוף' : 'Tap the Share button'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {isRTL
                        ? 'בתחתית המסך בספארי'
                        : 'At the bottom of Safari'}
                    </p>
                    <div className="mt-2 inline-flex items-center justify-center w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      <Share className="w-5 h-5 text-blue-500" />
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {isRTL
                        ? 'בחרו "הוסף למסך הבית"'
                        : 'Select "Add to Home Screen"'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {isRTL
                        ? 'גלול למטה בתפריט'
                        : 'Scroll down in the menu'}
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {isRTL ? 'לחצו "הוסף"' : 'Tap "Add"'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {isRTL
                        ? 'בפינה העליונה של המסך'
                        : 'In the top corner of the screen'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Done Button */}
              <button
                onClick={() => {
                  setShowIOSInstructions(false);
                  handleDismiss();
                }}
                className="w-full mt-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-colors"
              >
                {isRTL ? 'הבנתי' : 'Got it'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animation styles */}
      <style jsx>{`
        @keyframes slide-down {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        .animate-slide-down {
          animation: slide-down 0.3s ease-out forwards;
        }

        .animate-slide-up {
          animation: slide-up 0.3s ease-out forwards;
        }
      `}</style>
    </>
  );
}
