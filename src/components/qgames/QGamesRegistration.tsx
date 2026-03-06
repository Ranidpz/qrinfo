'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { User, Camera, X, Check, RotateCcw, Loader2, ZoomIn, ZoomOut, ExternalLink, Copy, CheckCheck, Download, Share, MoreVertical } from 'lucide-react';
import { QGamesConfig, DEFAULT_QGAMES_EMOJI_PALETTE } from '@/types/qgames';
import { useQGamesTheme } from './QGamesThemeContext';
import { compressImage } from '@/lib/imageCompression';

/** Detect if running inside an in-app browser (WhatsApp, Facebook, Instagram, etc.)
 *  Only detect via known UA strings — avoid fragile heuristics like window.safari check
 *  which causes false positives in regular Safari. */
function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // Facebook
  if (/FBAN|FBAV/i.test(ua)) return true;
  // Instagram
  if (/Instagram/i.test(ua)) return true;
  // WhatsApp
  if (/WhatsApp/i.test(ua)) return true;
  // Telegram
  if (/TelegramBot|Telegram/i.test(ua)) return true;
  // Line
  if (/\bLine\//i.test(ua)) return true;
  // Android WebView (generic)
  if (/; wv\b/.test(ua)) return true;
  return false;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as { MSStream?: unknown }).MSStream;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

interface QGamesRegistrationProps {
  config: QGamesConfig;
  onRegister: (nickname: string, avatarType: 'emoji' | 'selfie', avatarValue: string) => Promise<void>;
  ownerId: string;
  codeId: string;
  isRTL: boolean;
  t: (key: string) => string;
  initialNickname?: string;
  initialAvatarType?: 'emoji' | 'selfie';
  initialAvatarValue?: string;
}

export default function QGamesRegistration({
  config,
  onRegister,
  ownerId,
  codeId,
  isRTL,
  t,
  initialNickname,
  initialAvatarType,
  initialAvatarValue,
}: QGamesRegistrationProps) {
  const theme = useQGamesTheme();
  const emojiPalette = config.emojiPalette?.length
    ? config.emojiPalette
    : DEFAULT_QGAMES_EMOJI_PALETTE;

  const gameName = config.branding.title || 'Q.Games';

  const [nickname, setNickname] = useState(initialNickname || '');
  const [selectedEmoji, setSelectedEmoji] = useState(() => {
    if (initialAvatarType === 'emoji' && initialAvatarValue) return initialAvatarValue;
    return emojiPalette[Math.floor(Math.random() * emojiPalette.length)];
  });
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [avatarMode, setAvatarMode] = useState<'emoji' | 'selfie'>(initialAvatarType || 'emoji');
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(
    initialAvatarType === 'selfie' && initialAvatarValue ? initialAvatarValue : null
  );
  const [isUploading, setIsUploading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [zoom, setZoom] = useState(1);
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartZoom = useRef(1);

  // In-app browser detection
  const [inAppBrowser, setInAppBrowser] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // PWA install state
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [showAndroidInstructions, setShowAndroidInstructions] = useState(false);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);

  useEffect(() => {
    const inApp = isInAppBrowser();
    setInAppBrowser(inApp);
    setIsPWAInstalled(isStandalone());
    setIsIOSDevice(isIOS());

    // Don't set up PWA listeners in in-app browser
    if (inApp) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setIsPWAInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 400, height: 400 },
        audio: false,
      });
      streamRef.current = stream;
      setZoom(1);
      setShowCamera(true);
    } catch {
      alert(isRTL ? 'לא ניתן לגשת למצלמה' : 'Cannot access camera');
    }
  }, [isRTL]);

  useEffect(() => {
    if (showCamera && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [showCamera]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDist.current = Math.hypot(dx, dy);
      pinchStartZoom.current = zoom;
    }
  }, [zoom]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDist.current !== null) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const scale = dist / pinchStartDist.current;
      setZoom(Math.min(3, Math.max(1, pinchStartZoom.current * scale)));
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    pinchStartDist.current = null;
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
    setCapturedImage(null);
    setZoom(1);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const fullSize = Math.min(video.videoWidth, video.videoHeight);
    const cropSize = fullSize / zoom;
    const x = (video.videoWidth - cropSize) / 2;
    const y = (video.videoHeight - cropSize) / 2;

    canvas.width = 200;
    canvas.height = 200;
    ctx.drawImage(video, x, y, cropSize, cropSize, 0, 0, 200, 200);
    setCapturedImage(canvas.toDataURL('image/webp', 0.8));
  }, [zoom]);

  const confirmSelfie = useCallback(async () => {
    if (!capturedImage) return;
    setIsUploading(true);
    try {
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const file = new File([blob], 'selfie.webp', { type: 'image/webp' });
      const compressed = await compressImage(file, { maxSizeKB: 50, maxWidth: 200, maxHeight: 200 });

      const formData = new FormData();
      formData.append('file', new File([compressed.blob], 'selfie.webp', { type: compressed.blob.type }));
      formData.append('userId', ownerId);
      formData.append('codeId', codeId);
      formData.append('folder', 'avatars');
      formData.append('convertToWebp', 'true');

      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.url) throw new Error(uploadData.error || 'Upload failed');

      setSelfieUrl(uploadData.url);
      setAvatarMode('selfie');
      stopCamera();
    } catch (err) {
      console.error('Selfie upload error:', err);
      alert(isRTL ? 'שגיאה בהעלאת התמונה' : 'Failed to upload photo');
    } finally {
      setIsUploading(false);
    }
  }, [capturedImage, ownerId, codeId, stopCamera, isRTL]);

  const handleSubmit = async () => {
    const trimmed = nickname.trim();
    if (trimmed.length < 2) { setError(t('nicknameMinLength')); return; }
    setIsRegistering(true);
    setError(null);
    try {
      if (avatarMode === 'selfie' && selfieUrl) {
        await onRegister(trimmed, 'selfie', selfieUrl);
      } else {
        await onRegister(trimmed, 'emoji', selectedEmoji);
      }
    } catch {
      setError(t('registrationError'));
    } finally {
      setIsRegistering(false);
    }
  };

  const handleSelectEmoji = (emoji: string) => {
    setSelectedEmoji(emoji);
    setAvatarMode('emoji');
  };

  const handleOpenInBrowser = useCallback(() => {
    const url = window.location.href;
    // Trick: target="_blank" in SFSafariViewController opens Safari,
    // in Android Custom Tabs opens Chrome
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  }, []);

  const handleInstall = useCallback(async () => {
    if (isIOSDevice) {
      setShowIOSInstructions(true);
      return;
    }
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsPWAInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      setShowAndroidInstructions(true);
    }
  }, [deferredPrompt, isIOSDevice]);

  // Full-screen in-app browser gate
  if (inAppBrowser && !bannerDismissed) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center p-8"
        style={{ backgroundColor: theme.backgroundColor }}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Event Logo */}
        {config.branding.eventLogo && (
          <img
            src={config.branding.eventLogo}
            alt=""
            className="object-contain drop-shadow-lg mb-6"
            style={{ maxHeight: `${80 * (config.branding.logoScale ?? 1)}px`, maxWidth: '60%' }}
          />
        )}

        {/* Icon */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ backgroundColor: `${theme.accentColor}20` }}
        >
          <Download className="w-10 h-10" style={{ color: theme.accentColor }} />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-center mb-2" style={{ color: theme.textColor }}>
          {isRTL ? 'התקינו כאפליקציה' : 'Install as App'}
        </h1>

        {/* Subtitle */}
        <p className="text-center mb-8 max-w-xs" style={{ color: theme.textSecondary }}>
          {isRTL
            ? 'פתחו בדפדפן → התקינו למסך הבית → הפרופיל שלכם יישמר לתמיד!'
            : 'Open in browser → Install to home screen → Your profile is saved forever!'}
        </p>

        {/* Open in browser button */}
        <button
          onClick={handleOpenInBrowser}
          className="w-full max-w-xs flex items-center justify-center gap-2 py-4 rounded-2xl text-lg font-bold transition-all active:scale-95 text-white mb-3"
          style={{ background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})` }}
        >
          <ExternalLink className="w-5 h-5" />
          {isRTL ? 'פתחו בדפדפן' : 'Open in browser'}
        </button>

        {/* Copy link fallback */}
        <button
          onClick={handleCopyLink}
          className="w-full max-w-xs flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium transition-all active:scale-95 mb-8"
          style={{
            backgroundColor: theme.surfaceColor,
            border: `1px solid ${theme.borderColor}`,
            color: theme.textColor,
          }}
        >
          {linkCopied ? <CheckCheck className="w-4 h-4" style={{ color: theme.accentColor }} /> : <Copy className="w-4 h-4" />}
          {linkCopied
            ? (isRTL ? 'הלינק הועתק! הדביקו בדפדפן' : 'Link copied! Paste in browser')
            : (isRTL ? 'העתקת לינק' : 'Copy link')}
        </button>

        {/* Continue anyway - subtle */}
        <button
          onClick={() => setBannerDismissed(true)}
          className="text-xs underline transition-opacity active:opacity-50"
          style={{ color: theme.textSecondary }}
        >
          {isRTL ? 'המשיכו כאן בכל זאת' : 'Continue here anyway'}
        </button>
      </div>
    );
  }

  return (
    <><div className="min-h-[100dvh] flex flex-col items-center justify-start pt-8 pb-6 px-6" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Event Logo */}
      {config.branding.eventLogo && (
        <img
          src={config.branding.eventLogo}
          alt=""
          className="object-contain drop-shadow-lg mb-2"
          style={{ maxHeight: `${80 * (config.branding.logoScale ?? 1)}px`, maxWidth: '70%' }}
        />
      )}
      {/* Title */}
      <div className="text-center mb-3">
        <h1 className="text-2xl font-bold mb-0.5" style={{ color: theme.textColor }}>{!config.branding.eventLogo && '🎮 '}{gameName}</h1>
        <p className="text-sm" style={{ color: theme.textSecondary }}>{t('joinToPlay')}</p>
      </div>

      {/* PWA Install Card - show in regular browser when not installed */}
      {!isPWAInstalled && !inAppBrowser && (
        <div
          className="w-full max-w-sm mb-3 p-3 rounded-2xl flex items-center gap-3"
          style={{ backgroundColor: theme.surfaceColor, border: `1px solid ${theme.borderColor}` }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})` }}
          >
            <Download className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: theme.textColor }}>
              {isRTL ? 'התקינו לגישה מהירה' : 'Install for quick access'}
            </p>
            <p className="text-xs" style={{ color: theme.textSecondary }}>
              {isRTL ? 'הפרופיל שלכם יישמר' : 'Your profile will be saved'}
            </p>
          </div>
          <button
            onClick={handleInstall}
            className="shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-all active:scale-95"
            style={{ background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})` }}
          >
            {isRTL ? 'התקנה' : 'Install'}
          </button>
        </div>
      )}

      {/* Camera View */}
      {showCamera ? (
        <div className="w-full max-w-xs mb-6 flex flex-col items-center">
          <div
            className="relative w-52 h-52 rounded-full overflow-hidden mb-4"
            style={{ backgroundColor: theme.surfaceColor, boxShadow: `0 0 0 2px ${theme.accentColor}4d` }}
            onTouchStart={!capturedImage ? handleTouchStart : undefined}
            onTouchMove={!capturedImage ? handleTouchMove : undefined}
            onTouchEnd={!capturedImage ? handleTouchEnd : undefined}
          >
            {capturedImage ? (
              <img src={capturedImage} alt="Selfie preview" className="w-full h-full object-cover" />
            ) : (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: `scaleX(-1) scale(${zoom})` }} />
            )}
          </div>

          {!capturedImage && (
            <div className="flex items-center gap-3 mb-4 w-48">
              <ZoomOut className="w-4 h-4 shrink-0" style={{ color: theme.textSecondary }} />
              <input type="range" min="1" max="3" step="0.1" value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 h-1 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none"
                style={{ background: theme.surfaceHover, accentColor: theme.accentColor }}
              />
              <ZoomIn className="w-4 h-4 shrink-0" style={{ color: theme.textSecondary }} />
            </div>
          )}

          <div className="flex justify-center gap-4">
            {capturedImage ? (
              <>
                <button onClick={() => setCapturedImage(null)} className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95" style={{ backgroundColor: theme.surfaceColor, color: theme.textColor }}>
                  <RotateCcw className="w-6 h-6" />
                </button>
                <button onClick={confirmSelfie} disabled={isUploading} className="w-14 h-14 rounded-full flex items-center justify-center text-black transition-all active:scale-95 disabled:opacity-50" style={{ background: theme.accentColor, boxShadow: `0 0 20px ${theme.accentColor}66` }}>
                  {isUploading ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : <Check className="w-7 h-7" />}
                </button>
                <button onClick={stopCamera} className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95" style={{ backgroundColor: theme.surfaceColor, color: theme.textColor }}>
                  <X className="w-6 h-6" />
                </button>
              </>
            ) : (
              <>
                <button onClick={stopCamera} className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95" style={{ backgroundColor: theme.surfaceColor, color: theme.textColor }}>
                  <X className="w-6 h-6" />
                </button>
                <button onClick={capturePhoto} className="w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-95" style={{ background: `linear-gradient(135deg, ${theme.accentColor}, ${theme.accentColor}cc)`, boxShadow: `0 0 30px ${theme.accentColor}66` }}>
                  <div className="w-12 h-12 rounded-full border-4 border-white" />
                </button>
              </>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      ) : (
        <>
          {/* Selected Avatar Preview */}
          <div className="w-18 h-18 rounded-full flex items-center justify-center text-3xl mb-2 overflow-hidden mx-auto" style={{ width: 72, height: 72, backgroundColor: theme.surfaceColor, boxShadow: `0 0 0 2px ${theme.borderColor}` }}>
            {avatarMode === 'selfie' && selfieUrl ? (
              <img src={selfieUrl} alt="" className="w-full h-full object-cover" />
            ) : selectedEmoji}
          </div>

          {/* Avatar Selection */}
          <div className="w-full max-w-sm mb-3">
            <p className="text-xs text-center mb-2 uppercase tracking-wider" style={{ color: theme.textSecondary }}>{t('chooseAvatar')}</p>
            <div className="flex gap-2 overflow-x-auto pb-2 px-1 scrollbar-hide">
              {emojiPalette.slice(0, 12).map((emoji) => (
                <button key={emoji} onClick={() => handleSelectEmoji(emoji)}
                  className="w-11 h-11 text-xl rounded-xl transition-all duration-200 shrink-0"
                  style={{
                    backgroundColor: avatarMode === 'emoji' && selectedEmoji === emoji ? theme.surfaceHover : theme.surfaceColor,
                    boxShadow: avatarMode === 'emoji' && selectedEmoji === emoji ? `0 0 0 2px ${theme.accentColor}99, 0 4px 12px ${theme.accentColor}33` : 'none',
                    transform: avatarMode === 'emoji' && selectedEmoji === emoji ? 'scale(1.1)' : 'scale(1)',
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {config.allowSelfie && (
              <button onClick={startCamera}
                className="w-full flex items-center justify-center gap-2 mt-3 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95"
                style={{
                  backgroundColor: avatarMode === 'selfie' && selfieUrl ? `${theme.accentColor}1a` : theme.surfaceColor,
                  border: `1px solid ${avatarMode === 'selfie' && selfieUrl ? `${theme.accentColor}4d` : theme.borderColor}`,
                }}
              >
                {avatarMode === 'selfie' && selfieUrl ? (
                  <>
                    <img src={selfieUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                    <span style={{ color: theme.accentColor }}>{isRTL ? 'צלמו שוב' : 'Retake selfie'}</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" style={{ color: theme.accentColor }} />
                    <span style={{ color: theme.textSecondary }}>{isRTL ? 'או צלמו סלפי' : 'or take a selfie'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </>
      )}

      {/* Nickname Input */}
      {!showCamera && (
        <>
          <div className="w-full max-w-sm mb-3">
            <div className="relative">
              <User className="absolute top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: theme.textSecondary, [isRTL ? 'right' : 'left']: 12 }} />
              <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isRegistering && handleSubmit()}
                placeholder={t('enterNickname')} maxLength={20} dir="auto"
                className="w-full rounded-xl py-3 text-center focus:outline-none transition-all"
                style={{ backgroundColor: theme.surfaceColor, border: `1px solid ${theme.borderColor}`, color: theme.textColor, paddingLeft: 40, paddingRight: 40 }}
                onFocus={(e) => { e.currentTarget.style.borderColor = `${theme.accentColor}80`; e.currentTarget.style.boxShadow = `0 0 0 2px ${theme.accentColor}33`; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = theme.borderColor; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm mb-2 text-center">{error}</p>}

          <button onClick={handleSubmit} disabled={isRegistering || nickname.trim().length < 2}
            className="w-full max-w-sm py-3 rounded-xl font-bold text-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed text-white"
            style={{ background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})` }}
          >
            {isRegistering ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t('registering')}
              </span>
            ) : t('letsPlay')}
          </button>
        </>
      )}
    </div>

    {/* iOS Install Instructions Modal */}
    {showIOSInstructions && (
      <div className="fixed inset-0 z-[60] flex items-end justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={() => setShowIOSInstructions(false)} />
        <div
          className="relative rounded-t-3xl shadow-xl w-full max-h-[70vh] overflow-hidden"
          style={{ backgroundColor: theme.surfaceColor }}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <div className="flex justify-center py-3">
            <div className="w-12 h-1.5 rounded-full" style={{ backgroundColor: theme.borderColor }} />
          </div>
          <div className="px-6 pb-8">
            <h2 className="text-xl font-bold text-center mb-6" style={{ color: theme.textColor }}>
              {isRTL ? 'הוסיפו למסך הבית' : 'Add to Home Screen'}
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${theme.accentColor}20` }}>
                  <span className="font-bold" style={{ color: theme.accentColor }}>1</span>
                </div>
                <div>
                  <p className="font-medium" style={{ color: theme.textColor }}>
                    {isRTL ? 'לחצו על כפתור השיתוף' : 'Tap the Share button'}
                  </p>
                  <p className="text-sm" style={{ color: theme.textSecondary }}>
                    {isRTL ? 'בתחתית המסך בספארי' : 'At the bottom of Safari'}
                  </p>
                  <div className="mt-2 inline-flex items-center justify-center w-10 h-10 rounded-lg" style={{ backgroundColor: `${theme.accentColor}15` }}>
                    <Share className="w-5 h-5" style={{ color: theme.accentColor }} />
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${theme.accentColor}20` }}>
                  <span className="font-bold" style={{ color: theme.accentColor }}>2</span>
                </div>
                <div>
                  <p className="font-medium" style={{ color: theme.textColor }}>
                    {isRTL ? 'בחרו "הוסף למסך הבית"' : 'Select "Add to Home Screen"'}
                  </p>
                  <p className="text-sm" style={{ color: theme.textSecondary }}>
                    {isRTL ? 'גללו למטה בתפריט' : 'Scroll down in the menu'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${theme.accentColor}20` }}>
                  <span className="font-bold" style={{ color: theme.accentColor }}>3</span>
                </div>
                <div>
                  <p className="font-medium" style={{ color: theme.textColor }}>
                    {isRTL ? 'לחצו "הוסף"' : 'Tap "Add"'}
                  </p>
                  <p className="text-sm" style={{ color: theme.textSecondary }}>
                    {isRTL ? 'בפינה העליונה של המסך' : 'In the top corner of the screen'}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowIOSInstructions(false)}
              className="w-full mt-6 py-3 rounded-xl font-bold text-white transition-all active:scale-95"
              style={{ background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})` }}
            >
              {isRTL ? 'הבנתי' : 'Got it'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Android Install Instructions Modal */}
    {showAndroidInstructions && (
      <div className="fixed inset-0 z-[60] flex items-end justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={() => setShowAndroidInstructions(false)} />
        <div
          className="relative rounded-t-3xl shadow-xl w-full max-h-[70vh] overflow-hidden"
          style={{ backgroundColor: theme.surfaceColor }}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <div className="flex justify-center py-3">
            <div className="w-12 h-1.5 rounded-full" style={{ backgroundColor: theme.borderColor }} />
          </div>
          <div className="px-6 pb-8">
            <h2 className="text-xl font-bold text-center mb-6" style={{ color: theme.textColor }}>
              {isRTL ? 'התקנת האפליקציה' : 'Install App'}
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${theme.accentColor}20` }}>
                  <span className="font-bold" style={{ color: theme.accentColor }}>1</span>
                </div>
                <div>
                  <p className="font-medium" style={{ color: theme.textColor }}>
                    {isRTL ? 'פתחו את תפריט הדפדפן' : 'Open browser menu'}
                  </p>
                  <p className="text-sm" style={{ color: theme.textSecondary }}>
                    {isRTL ? 'לחצו על 3 הנקודות בפינה העליונה' : 'Tap the 3 dots in the top corner'}
                  </p>
                  <div className="mt-2 inline-flex items-center justify-center w-10 h-10 rounded-lg" style={{ backgroundColor: `${theme.accentColor}15` }}>
                    <MoreVertical className="w-5 h-5" style={{ color: theme.accentColor }} />
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${theme.accentColor}20` }}>
                  <span className="font-bold" style={{ color: theme.accentColor }}>2</span>
                </div>
                <div>
                  <p className="font-medium" style={{ color: theme.textColor }}>
                    {isRTL ? 'בחרו "התקן אפליקציה" או "הוסף למסך הבית"' : 'Select "Install app" or "Add to Home screen"'}
                  </p>
                  <p className="text-sm" style={{ color: theme.textSecondary }}>
                    {isRTL ? 'גללו בתפריט עד שתמצאו' : 'Scroll in the menu to find it'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${theme.accentColor}20` }}>
                  <span className="font-bold" style={{ color: theme.accentColor }}>3</span>
                </div>
                <div>
                  <p className="font-medium" style={{ color: theme.textColor }}>
                    {isRTL ? 'לחצו "התקן"' : 'Tap "Install"'}
                  </p>
                  <p className="text-sm" style={{ color: theme.textSecondary }}>
                    {isRTL ? 'בחלון שנפתח' : 'In the popup that appears'}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowAndroidInstructions(false)}
              className="w-full mt-6 py-3 rounded-xl font-bold text-white transition-all active:scale-95"
              style={{ background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})` }}
            >
              {isRTL ? 'הבנתי' : 'Got it'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
