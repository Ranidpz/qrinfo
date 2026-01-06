'use client';

import { memo, useState, useRef, useCallback } from 'react';
import { Camera, X, Check, RotateCcw } from 'lucide-react';
import { DEFAULT_EMOJI_PALETTE, QStageAvatarType, QSTAGE_TRANSLATIONS } from '@/types/qstage';
import { compressImage, createCompressedFile } from '@/lib/imageCompression';

interface QStageAvatarPickerProps {
  onSelect: (type: QStageAvatarType, value: string) => void;
  emojiPalette?: string[];
  allowSelfie?: boolean;
  locale?: 'he' | 'en';
  primaryColor?: string;
}

/**
 * QStageAvatarPicker - Emoji grid + selfie camera
 * Clean, dark UI for selecting voter avatar
 */
export const QStageAvatarPicker = memo(function QStageAvatarPicker({
  onSelect,
  emojiPalette = DEFAULT_EMOJI_PALETTE,
  allowSelfie = true,
  locale = 'he',
  primaryColor = '#00d4ff',
}: QStageAvatarPickerProps) {
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isRTL = locale === 'he';
  const t = QSTAGE_TRANSLATIONS[locale];

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 400, height: 400 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setShowCamera(true);
    } catch (error) {
      console.error('Camera error:', error);
      alert(locale === 'he' ? 'לא ניתן לגשת למצלמה' : 'Cannot access camera');
    }
  }, [locale]);

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

    setIsCapturing(true);
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
    setIsCapturing(false);
  }, []);

  // Confirm selfie selection
  const confirmSelfie = useCallback(async () => {
    if (!capturedImage) return;

    // Convert data URL to blob for compression
    const response = await fetch(capturedImage);
    const blob = await response.blob();
    const file = new File([blob], 'selfie.webp', { type: 'image/webp' });

    // Compress to 50KB max for avatar
    const compressed = await compressImage(file, {
      maxSizeKB: 50,
      maxWidth: 200,
      maxHeight: 200,
    });

    // Convert back to data URL for preview (actual upload happens later)
    const reader = new FileReader();
    reader.onloadend = () => {
      onSelect('selfie', reader.result as string);
      stopCamera();
    };
    reader.readAsDataURL(compressed.blob);
  }, [capturedImage, onSelect, stopCamera]);

  // Retry photo
  const retryPhoto = useCallback(() => {
    setCapturedImage(null);
  }, []);

  // Select emoji
  const handleEmojiSelect = useCallback((emoji: string) => {
    setSelectedEmoji(emoji);
    onSelect('emoji', emoji);
  }, [onSelect]);

  return (
    <div
      className="flex flex-col items-center justify-center min-h-[60vh] px-6"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ fontFamily: "'Assistant', sans-serif" }}
    >
      <h2
        className="text-2xl font-bold text-white mb-8"
        style={{ textShadow: `0 0 20px ${primaryColor}40` }}
      >
        {t.selectAvatar}
      </h2>

      {/* Camera view */}
      {showCamera ? (
        <div className="w-full max-w-xs">
          {/* Video/Preview container */}
          <div
            className="relative w-full aspect-square rounded-2xl overflow-hidden mb-6"
            style={{
              background: 'rgba(0, 0, 0, 0.5)',
              border: `2px solid ${primaryColor}40`,
            }}
          >
            {capturedImage ? (
              // Captured preview
              <img
                src={capturedImage}
                alt="Selfie preview"
                className="w-full h-full object-cover"
              />
            ) : (
              // Live video
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
            )}

            {/* Face guide overlay */}
            {!capturedImage && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div
                  className="w-32 h-32 rounded-full border-2 border-dashed"
                  style={{ borderColor: `${primaryColor}60` }}
                />
              </div>
            )}
          </div>

          {/* Camera controls */}
          <div className="flex justify-center gap-4">
            {capturedImage ? (
              <>
                {/* Retry */}
                <button
                  onClick={retryPhoto}
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white transition-all active:scale-95"
                  style={{ background: 'rgba(255, 255, 255, 0.1)' }}
                >
                  <RotateCcw className="w-6 h-6" />
                </button>

                {/* Confirm */}
                <button
                  onClick={confirmSelfie}
                  className="w-14 h-14 rounded-full flex items-center justify-center text-black transition-all active:scale-95"
                  style={{
                    background: primaryColor,
                    boxShadow: `0 0 20px ${primaryColor}60`,
                  }}
                >
                  <Check className="w-7 h-7" />
                </button>

                {/* Cancel */}
                <button
                  onClick={stopCamera}
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white transition-all active:scale-95"
                  style={{ background: 'rgba(255, 255, 255, 0.1)' }}
                >
                  <X className="w-6 h-6" />
                </button>
              </>
            ) : (
              <>
                {/* Capture */}
                <button
                  onClick={capturePhoto}
                  disabled={isCapturing}
                  className="w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
                  style={{
                    background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`,
                    boxShadow: `0 0 30px ${primaryColor}60`,
                  }}
                >
                  <div className="w-12 h-12 rounded-full border-4 border-white" />
                </button>

                {/* Cancel */}
                <button
                  onClick={stopCamera}
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white transition-all active:scale-95"
                  style={{ background: 'rgba(255, 255, 255, 0.1)' }}
                >
                  <X className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      ) : (
        <>
          {/* Emoji grid */}
          <div
            className="grid grid-cols-6 gap-3 mb-8 p-4 rounded-2xl w-full max-w-xs"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            {emojiPalette.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmojiSelect(emoji)}
                className={`
                  w-12 h-12 rounded-xl text-2xl flex items-center justify-center
                  transition-all active:scale-95
                  ${selectedEmoji === emoji ? 'ring-2' : ''}
                `}
                style={{
                  background: selectedEmoji === emoji
                    ? `${primaryColor}30`
                    : 'rgba(255, 255, 255, 0.08)',
                  borderColor: selectedEmoji === emoji ? primaryColor : 'transparent',
                  boxShadow: selectedEmoji === emoji
                    ? `0 0 15px ${primaryColor}40`
                    : 'none',
                }}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Selfie button */}
          {allowSelfie && (
            <>
              <div className="flex items-center gap-4 w-full max-w-xs mb-4">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-white/40 text-sm">
                  {isRTL ? 'או' : 'or'}
                </span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <button
                onClick={startCamera}
                className="flex items-center gap-3 px-6 py-3 rounded-full text-white font-medium transition-all active:scale-95"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor}20, ${primaryColor}10)`,
                  border: `1px solid ${primaryColor}40`,
                }}
              >
                <Camera className="w-5 h-5" style={{ color: primaryColor }} />
                <span>{t.takeSelfie}</span>
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
});

export default QStageAvatarPicker;
