'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { User, Camera, X, Check, RotateCcw, Loader2 } from 'lucide-react';
import { QGamesConfig, DEFAULT_QGAMES_EMOJI_PALETTE } from '@/types/qgames';
import { compressImage } from '@/lib/imageCompression';

interface QGamesRegistrationProps {
  config: QGamesConfig;
  onRegister: (nickname: string, avatarType: 'emoji' | 'selfie', avatarValue: string) => Promise<void>;
  ownerId: string;
  codeId: string;
  isRTL: boolean;
  t: (key: string) => string;
}

export default function QGamesRegistration({
  config,
  onRegister,
  ownerId,
  codeId,
  isRTL,
  t,
}: QGamesRegistrationProps) {
  const [nickname, setNickname] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState(
    config.emojiPalette?.[0] || DEFAULT_QGAMES_EMOJI_PALETTE[0]
  );
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selfie state
  const [avatarMode, setAvatarMode] = useState<'emoji' | 'selfie'>('emoji');
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const emojiPalette = config.emojiPalette?.length
    ? config.emojiPalette
    : DEFAULT_QGAMES_EMOJI_PALETTE;

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 400, height: 400 },
        audio: false,
      });
      streamRef.current = stream;
      setShowCamera(true); // Render video element first, then connect in useEffect
    } catch {
      alert(isRTL ? 'לא ניתן לגשת למצלמה' : 'Cannot access camera');
    }
  }, [isRTL]);

  // Connect stream to video element after it renders
  useEffect(() => {
    if (showCamera && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [showCamera]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
    setCapturedImage(null);
  }, []);

  // Capture photo
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Square crop from center
    const size = Math.min(video.videoWidth, video.videoHeight);
    const x = (video.videoWidth - size) / 2;
    const y = (video.videoHeight - size) / 2;

    canvas.width = 200;
    canvas.height = 200;
    ctx.drawImage(video, x, y, size, size, 0, 0, 200, 200);

    const imageData = canvas.toDataURL('image/webp', 0.8);
    setCapturedImage(imageData);
  }, []);

  // Confirm selfie - compress + upload to Vercel Blob
  const confirmSelfie = useCallback(async () => {
    if (!capturedImage) return;

    setIsUploading(true);
    try {
      // Convert data URL to blob for compression
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const file = new File([blob], 'selfie.webp', { type: 'image/webp' });

      // Compress to 50KB max
      const compressed = await compressImage(file, {
        maxSizeKB: 50,
        maxWidth: 200,
        maxHeight: 200,
      });

      // Upload to Vercel Blob
      const formData = new FormData();
      formData.append('file', new File([compressed.blob], 'selfie.webp', { type: compressed.blob.type }));
      formData.append('userId', ownerId);
      formData.append('codeId', codeId);
      formData.append('folder', 'avatars');
      formData.append('convertToWebp', 'true');

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.url) {
        throw new Error(uploadData.error || 'Upload failed');
      }

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
    if (trimmed.length < 2) {
      setError(t('nicknameMinLength'));
      return;
    }

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

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Title */}
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">🎮</div>
        <h1 className="text-2xl font-bold text-white mb-1">Q.Games</h1>
        <p className="text-white/50 text-sm">{t('joinToPlay')}</p>
      </div>

      {/* Camera View */}
      {showCamera ? (
        <div className="w-full max-w-xs mb-6">
          {/* Video / Preview */}
          <div className="relative w-full aspect-square rounded-2xl overflow-hidden mb-4 bg-black/50 border-2 border-emerald-400/20">
            {capturedImage ? (
              <img
                src={capturedImage}
                alt="Selfie preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
            )}

            {/* Face guide */}
            {!capturedImage && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-32 h-32 rounded-full border-2 border-dashed border-emerald-400/40" />
              </div>
            )}
          </div>

          {/* Camera controls */}
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
                  style={{ background: '#10b981', boxShadow: '0 0 20px rgba(16,185,129,0.4)' }}
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
                  onClick={capturePhoto}
                  className="w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 0 30px rgba(16,185,129,0.4)' }}
                >
                  <div className="w-12 h-12 rounded-full border-4 border-white" />
                </button>
                <button
                  onClick={stopCamera}
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white transition-all active:scale-95 bg-white/10"
                >
                  <X className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />
        </div>
      ) : (
        <>
          {/* Avatar Selection */}
          <div className="w-full max-w-sm mb-4">
            <p className="text-white/60 text-xs text-center mb-3 uppercase tracking-wider">
              {t('chooseAvatar')}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {emojiPalette.slice(0, 12).map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleSelectEmoji(emoji)}
                  className={`w-12 h-12 text-2xl rounded-xl transition-all duration-200 ${
                    avatarMode === 'emoji' && selectedEmoji === emoji
                      ? 'bg-white/20 scale-110 ring-2 ring-emerald-400/60 shadow-lg shadow-emerald-500/20'
                      : 'bg-white/5 hover:bg-white/10 active:scale-95'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Selfie button */}
          {config.allowSelfie && (
            <>
              <div className="flex items-center gap-4 w-full max-w-sm mb-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-white/30 text-xs">{t('or')}</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <button
                onClick={startCamera}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-white/70 text-sm font-medium transition-all active:scale-95 mb-4 bg-white/5 border border-white/10 hover:bg-white/10"
              >
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>{t('takeSelfie')}</span>
              </button>
            </>
          )}
        </>
      )}

      {/* Selected Avatar Preview */}
      {!showCamera && (
        <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center text-4xl mb-4 ring-2 ring-white/10 overflow-hidden">
          {avatarMode === 'selfie' && selfieUrl ? (
            <img src={selfieUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            selectedEmoji
          )}
        </div>
      )}

      {/* Nickname Input */}
      {!showCamera && (
        <>
          <div className="w-full max-w-sm mb-4">
            <div className="relative">
              <User className="absolute top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" style={{ [isRTL ? 'right' : 'left']: 12 }} />
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isRegistering && handleSubmit()}
                placeholder={t('enterNickname')}
                maxLength={20}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 text-white placeholder-white/30 text-center focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-transparent transition-all"
                style={{ paddingLeft: 40, paddingRight: 40 }}
                dir="auto"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-400 text-sm mb-3 text-center">{error}</p>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={isRegistering || nickname.trim().length < 2}
            className="w-full max-w-sm py-3.5 rounded-xl font-bold text-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: 'white',
            }}
          >
            {isRegistering ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t('registering')}
              </span>
            ) : (
              t('letsPlay')
            )}
          </button>
        </>
      )}
    </div>
  );
}
