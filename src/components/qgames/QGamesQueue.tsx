'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Share2, ArrowLeft, Camera, X, Check, RotateCcw, Loader2, Pencil, ZoomIn, ZoomOut } from 'lucide-react';
import { compressImage } from '@/lib/imageCompression';
import RPSAnimatedEmoji from './RPSAnimatedEmoji';
import { subscribeToQueue } from '@/lib/qgames-realtime';
import { useQGamesTheme } from './QGamesThemeContext';
import type { QGameType, QGamesQueueEntry } from '@/types/qgames';

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return;

    const duration = 400;
    const start = performance.now();

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) requestAnimationFrame(animate);
      else prevRef.current = to;
    };
    requestAnimationFrame(animate);
  }, [value]);

  return <span>{display}</span>;
}

interface QGamesQueueProps {
  gameType?: QGameType;
  gameEmoji: string;
  gameName: string;
  playerAvatar: string;
  playerName: string;
  shortId: string;
  inviterVisitorId?: string;
  enableWhatsApp: boolean;
  onCancel: () => void;
  onPlayBot?: () => void;
  isRTL: boolean;
  t: (key: string) => string;
  is3Player?: boolean;
  // Avatar change props
  emojiPalette?: string[];
  allowSelfie?: boolean;
  ownerId?: string;
  codeId?: string;
  onAvatarChange?: (avatarType: 'emoji' | 'selfie', avatarValue: string) => void;
  onNameChange?: (name: string) => void;
  viewerCount?: number;
  activeMatches?: number;
}

export default function QGamesQueue({
  gameType,
  gameEmoji,
  gameName,
  playerAvatar,
  playerName,
  shortId,
  inviterVisitorId,
  enableWhatsApp,
  onCancel,
  onPlayBot,
  isRTL,
  t,
  is3Player,
  emojiPalette,
  allowSelfie,
  ownerId,
  codeId,
  onAvatarChange,
  onNameChange,
  viewerCount = 0,
  activeMatches = 0,
}: QGamesQueueProps) {
  const theme = useQGamesTheme();
  const [dots, setDots] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [showPicker, setShowPicker] = useState(false);

  // Name editing state
  const [editedName, setEditedName] = useState(playerName);
  useEffect(() => { setEditedName(playerName); }, [playerName]);

  // Selfie state
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Zoom state
  const [zoom, setZoom] = useState(1);
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartZoom = useRef(1);

  // Track other waiting players for 3-player games
  const [waitingPeers, setWaitingPeers] = useState<QGamesQueueEntry[]>([]);

  useEffect(() => {
    if (!is3Player || !codeId || !gameType) return;

    const unsubscribe = subscribeToQueue(codeId, (entries) => {
      const peers = entries.filter(
        e => e.gameType === gameType
          && e.status === 'waiting'
          && e.id !== inviterVisitorId
          && !e.inBotMatch
      );
      setWaitingPeers(peers);
    });

    return () => unsubscribe();
  }, [is3Player, codeId, gameType, inviterVisitorId]);

  const totalNeeded = 3;
  const readyCount = 1 + waitingPeers.length; // me + peers

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Track elapsed time
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup camera on unmount (match found while camera is open)
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const handleWhatsAppInvite = () => {
    const baseUrl = `https://qr.playzones.app/v/${shortId}`;
    const shareUrl = inviterVisitorId ? `${baseUrl}?invite=${inviterVisitorId}` : baseUrl;
    const message = isRTL
      ? `🎮 בוא נשחק ${gameName}! ${shareUrl}`
      : `🎮 Let's play ${gameName}! ${shareUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // ============ Camera / Selfie ============

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

  // Pinch-to-zoom handlers
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
    if (!capturedImage || !ownerId || !codeId) return;
    setIsUploading(true);
    try {
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const file = new File([blob], 'selfie.webp', { type: 'image/webp' });
      const compressed = await compressImage(file, {
        maxSizeKB: 50,
        maxWidth: 200,
        maxHeight: 200,
      });

      const formData = new FormData();
      formData.append('file', new File([compressed.blob], 'selfie.webp', { type: compressed.blob.type }));
      formData.append('userId', ownerId);
      formData.append('codeId', codeId);
      formData.append('folder', 'avatars');
      formData.append('convertToWebp', 'true');

      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.url) throw new Error(uploadData.error || 'Upload failed');

      onAvatarChange?.('selfie', uploadData.url);
      stopCamera();
      setShowPicker(false);
    } catch (err) {
      console.error('Selfie upload error:', err);
      alert(isRTL ? 'שגיאה בהעלאת התמונה' : 'Failed to upload photo');
    } finally {
      setIsUploading(false);
    }
  }, [capturedImage, ownerId, codeId, onAvatarChange, stopCamera, isRTL]);

  const handleEmojiSelect = (emoji: string) => {
    onAvatarChange?.('emoji', emoji);
    setShowPicker(false);
  };


  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Back button */}
      <button
        onClick={onCancel}
        className="absolute top-4 text-white/40 hover:text-white/60 transition-colors p-2"
        style={{ [isRTL ? 'right' : 'left']: 12 }}
      >
        <ArrowLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
      </button>

      {/* Searching animation */}
      <div className="relative mb-4">
        {/* Pulsing rings */}
        <div className="absolute inset-0 w-28 h-28 rounded-full border-2 animate-ping" style={{ animationDuration: '2s', borderColor: `${theme.accentColor}33` }} />
        <div className="absolute inset-0 w-28 h-28 rounded-full border-2 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s', borderColor: `${theme.accentColor}1a` }} />

        {/* Tappable avatar */}
        <button
          onClick={() => onAvatarChange && setShowPicker(prev => !prev)}
          className="w-28 h-28 rounded-full bg-white/10 flex items-center justify-center text-5xl relative z-10 ring-2 overflow-hidden transition-transform active:scale-95"
          style={{ '--tw-ring-color': `${theme.accentColor}4d` } as React.CSSProperties}
          disabled={!onAvatarChange}
        >
          {playerAvatar.startsWith('http') ? (
            <img src={playerAvatar} alt="" className="w-full h-full object-cover" />
          ) : playerAvatar}
        </button>

        {/* Edit hint */}
        {onAvatarChange && (
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center shadow-lg z-20 pointer-events-none" style={{ backgroundColor: theme.accentColor }}>
            <Pencil className="w-3.5 h-3.5 text-white" />
          </div>
        )}
      </div>

      {/* Player name (non-editable outside picker) */}
      {!showCamera && !showPicker && (
        <div className="mb-4 mt-1">
          <span className="text-sm font-medium text-white/70">{playerName}</span>
        </div>
      )}

      {/* Camera View — circular WYSIWYG */}
      {showCamera && (
        <div className="w-full max-w-xs mb-6 animate-in fade-in zoom-in-95 duration-200 flex flex-col items-center">
          {/* Circular viewfinder */}
          <div
            className="relative w-52 h-52 rounded-full overflow-hidden mb-4 bg-black/50 ring-2"
            style={{ '--tw-ring-color': `${theme.accentColor}4d` } as React.CSSProperties}
            onTouchStart={!capturedImage ? handleTouchStart : undefined}
            onTouchMove={!capturedImage ? handleTouchMove : undefined}
            onTouchEnd={!capturedImage ? handleTouchEnd : undefined}
          >
            {capturedImage ? (
              <img src={capturedImage} alt="Selfie preview" className="w-full h-full object-cover" />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: `scaleX(-1) scale(${zoom})` }}
              />
            )}
          </div>

          {/* Zoom slider — only when live camera */}
          {!capturedImage && (
            <div className="flex items-center gap-3 mb-4 w-48">
              <ZoomOut className="w-4 h-4 text-white/40 shrink-0" />
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none"
                style={{ accentColor: theme.accentColor }}
              />
              <ZoomIn className="w-4 h-4 text-white/40 shrink-0" />
            </div>
          )}

          <div className="flex justify-center gap-4">
            {capturedImage ? (
              <>
                <button
                  onClick={() => setCapturedImage(null)}
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white transition-all active:scale-95 bg-white/10"
                >
                  <RotateCcw className="w-6 h-6" />
                </button>
                <button
                  onClick={confirmSelfie}
                  disabled={isUploading}
                  className="w-14 h-14 rounded-full flex items-center justify-center text-black transition-all active:scale-95 disabled:opacity-50"
                  style={{ background: theme.accentColor, boxShadow: `0 0 20px ${theme.accentColor}66` }}
                >
                  {isUploading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-white" />
                  ) : (
                    <Check className="w-7 h-7" />
                  )}
                </button>
                <button
                  onClick={stopCamera}
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white transition-all active:scale-95 bg-white/10"
                >
                  <X className="w-6 h-6" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={stopCamera}
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white transition-all active:scale-95 bg-white/10"
                >
                  <X className="w-6 h-6" />
                </button>
                <button
                  onClick={capturePhoto}
                  className="w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-95"
                  style={{ background: `linear-gradient(135deg, ${theme.accentColor}, ${theme.accentColor}cc)`, boxShadow: `0 0 30px ${theme.accentColor}66` }}
                >
                  <div className="w-12 h-12 rounded-full border-4 border-white" />
                </button>
              </>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* Inline Emoji Picker */}
      {showPicker && !showCamera && emojiPalette && (
        <div className="w-full max-w-xs mb-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            {/* Editable nickname inside picker */}
            {onNameChange && (
              <div className="mb-3 flex justify-center">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  maxLength={20}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-center text-sm font-medium outline-none w-40"
                  style={{ '--focus-color': theme.accentColor } as React.CSSProperties}
                  onFocus={(e) => { e.currentTarget.style.borderColor = `${theme.accentColor}99`; e.currentTarget.style.boxShadow = `0 0 0 2px ${theme.accentColor}4d`; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.boxShadow = 'none'; }}
                  dir="auto"
                />
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-2 mb-3">
              {emojiPalette.slice(0, 12).map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiSelect(emoji)}
                  className={`w-12 h-12 text-2xl rounded-xl transition-all duration-200 ${
                    !playerAvatar.startsWith('http') && playerAvatar === emoji
                      ? 'bg-white/20 scale-110 ring-2'
                      : 'bg-white/5 hover:bg-white/10 active:scale-95'
                  }`}
                  style={!playerAvatar.startsWith('http') && playerAvatar === emoji ? { '--tw-ring-color': `${theme.accentColor}99` } as React.CSSProperties : undefined}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Selfie option */}
            {allowSelfie && (
              <>
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-white/30 text-xs">{t('or')}</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
                <button
                  onClick={startCamera}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white/70 text-sm font-medium transition-all active:scale-95 bg-white/5 border border-white/10 hover:bg-white/10"
                >
                  <Camera className="w-4 h-4" style={{ color: theme.accentColor }} />
                  <span>{t('takeSelfie')}</span>
                </button>
              </>
            )}

            {/* Save & Close button */}
            <button
              onClick={() => {
                const trimmed = editedName.trim();
                if (trimmed.length >= 2 && trimmed !== playerName) {
                  onNameChange?.(trimmed);
                }
                setShowPicker(false);
              }}
              className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium transition-all active:scale-95 text-sm"
              style={{ backgroundColor: `${theme.accentColor}33`, borderColor: `${theme.accentColor}4d`, border: `1px solid ${theme.accentColor}4d`, color: theme.accentColor }}
            >
              <Check className="w-4 h-4" />
              {isRTL ? 'שמור וסגור' : 'Save & Close'}
            </button>
          </div>
        </div>
      )}

      {/* Game info */}
      {!showCamera && (
        <h2 className="text-white font-bold text-lg mb-0.5">
          {gameType === 'rps' ? <RPSAnimatedEmoji /> : gameEmoji} {gameName}
        </h2>
      )}

      {/* Searching text */}
      <p className="text-white/50 text-sm mb-3">
        {is3Player ? t('searchingForOpponents') : t('searchingForOpponent')}{dots}
      </p>

      {/* Live player stats */}
      {!showCamera && !showPicker && (
        <div className="flex items-center gap-4 mb-3 animate-in fade-in duration-500">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${viewerCount > 0 ? 'animate-pulse' : 'bg-white/20'}`} style={viewerCount > 0 ? { backgroundColor: theme.accentColor } : undefined} />
            <span className="font-bold text-sm tabular-nums" style={{ color: viewerCount > 0 ? theme.accentColor : 'rgba(255,255,255,0.3)' }}>
              <AnimatedNumber value={viewerCount} />
            </span>
            <span className="text-white/40 text-xs">{isRTL ? 'מחוברים' : 'online'}</span>
          </div>
          {activeMatches > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-amber-400 font-bold text-sm tabular-nums">
                <AnimatedNumber value={activeMatches} />
              </span>
              <span className="text-white/40 text-xs">{isRTL ? 'במשחק' : 'playing'}</span>
            </div>
          )}
        </div>
      )}

      {/* 3-player waiting status */}
      {is3Player && !showCamera && !showPicker && (
        <div className="w-full max-w-xs mb-4 animate-in fade-in duration-300">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            {/* Player count indicator */}
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="font-bold text-lg" style={{ color: theme.accentColor }}>{readyCount}</span>
              <span className="text-white/30 text-lg">/</span>
              <span className="text-white/40 font-bold text-lg">{totalNeeded}</span>
              <span className="text-white/40 text-sm ms-1">{t('playersReady')}</span>
            </div>

            {/* Player avatars row */}
            <div className="flex items-center justify-center gap-3">
              {/* Me (always slot 1) */}
              <div className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-2xl ring-2 overflow-hidden" style={{ '--tw-ring-color': `${theme.accentColor}66` } as React.CSSProperties}>
                  {playerAvatar.startsWith('http') ? (
                    <img src={playerAvatar} alt="" className="w-full h-full object-cover" />
                  ) : playerAvatar}
                </div>
                <span className="text-[10px] font-medium" style={{ color: theme.accentColor }}>{t('you')}</span>
              </div>

              {/* Waiting peers */}
              {waitingPeers.slice(0, 2).map((peer) => (
                <div key={peer.id} className="flex flex-col items-center gap-1 animate-in zoom-in duration-300">
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-2xl ring-2 ring-blue-400/40 overflow-hidden">
                    {peer.avatarValue.startsWith('http') ? (
                      <img src={peer.avatarValue} alt="" className="w-full h-full object-cover" />
                    ) : peer.avatarValue}
                  </div>
                  <span className="text-white/50 text-[10px] truncate max-w-[60px]">{peer.nickname}</span>
                </div>
              ))}

              {/* Empty slots */}
              {Array.from({ length: Math.max(0, totalNeeded - readyCount) }).map((_, i) => (
                <div key={`empty-${i}`} className="flex flex-col items-center gap-1">
                  <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/15 flex items-center justify-center">
                    <span className="text-white/20 text-lg">?</span>
                  </div>
                  <span className="text-white/20 text-[10px]">&nbsp;</span>
                </div>
              ))}
            </div>

            {/* Status message */}
            <p className="text-center text-white/40 text-xs mt-3">
              {readyCount >= totalNeeded
                ? (isRTL ? 'מתחילים!' : 'Starting!')
                : totalNeeded - readyCount === 1
                  ? t('waiting1More')
                  : t('waiting2More')
              }
            </p>
          </div>
        </div>
      )}

      {/* Timer */}
      <div className="text-white/20 text-xs mb-4 tabular-nums">
        {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
      </div>

      {/* Invite + Bot options */}
      {!showCamera && !showPicker && (
        <div className="w-full max-w-sm space-y-3">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <p className="text-white/60 text-sm mb-3">{t('dontWantToWait')}</p>

            {/* Play vs Bot */}
            {onPlayBot && (
              <button
                onClick={onPlayBot}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all active:scale-95 bg-gradient-to-r from-purple-600 to-indigo-600 text-white mb-2"
              >
                🤖 {isRTL ? 'שחקו עם בוט' : 'Play vs Bot'}
              </button>
            )}

            {/* WhatsApp invite */}
            {enableWhatsApp && (
              <button
                onClick={handleWhatsAppInvite}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all active:scale-95"
                style={{ background: '#25D366', color: 'white' }}
              >
                <Share2 className="w-4 h-4" />
                {t('inviteViaWhatsApp')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
