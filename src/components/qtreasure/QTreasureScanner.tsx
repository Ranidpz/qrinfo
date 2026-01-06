'use client';

/**
 * QTreasureScanner - QR code scanner for station verification
 *
 * Design: Mystical scanning portal with ancient frame
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QTreasureConfig, QTreasureStation } from '@/types/qtreasure';

interface QTreasureScannerProps {
  codeId: string;
  playerId: string;
  config: QTreasureConfig;
  lang: 'he' | 'en';
  onResult: (result: {
    success: boolean;
    isComplete?: boolean;
    nextStation?: QTreasureStation;
    outOfOrderMessage?: string;
    error?: string;
  }) => void;
  onClose: () => void;
}

const translations = {
  he: {
    scanning: 'סורקים...',
    pointCamera: 'כוונו את המצלמה לקוד QR',
    success: 'תחנה נמצאה!',
    error: 'שגיאה',
    wrongStation: 'זו לא התחנה הנכונה!',
    alreadyScanned: 'כבר סרקתם תחנה זו',
    stationNotFound: 'התחנה לא נמצאה',
    tryAgain: 'נסו שוב',
    continue: 'המשך',
    close: 'סגור',
    cameraError: 'לא ניתן לגשת למצלמה',
  },
  en: {
    scanning: 'Scanning...',
    pointCamera: 'Point camera at QR code',
    success: 'Station found!',
    error: 'Error',
    wrongStation: 'This is not the right station!',
    alreadyScanned: 'You already scanned this station',
    stationNotFound: 'Station not found',
    tryAgain: 'Try again',
    continue: 'Continue',
    close: 'Close',
    cameraError: 'Cannot access camera',
  },
};

export function QTreasureScanner({
  codeId,
  playerId,
  config,
  lang,
  onResult,
  onClose,
}: QTreasureScannerProps) {
  const t = translations[lang];

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isScanning, setIsScanning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    isComplete?: boolean;
    nextStation?: QTreasureStation;
    outOfOrderMessage?: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Start camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 720 },
            height: { ideal: 720 },
          },
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Start scanning after video is ready
        if (videoRef.current) {
          videoRef.current.onloadedmetadata = () => {
            startQRScanning();
          };
        }
      } catch (err) {
        console.error('Camera error:', err);
        setError(t.cameraError);
        setIsScanning(false);
      }
    };

    startCamera();

    return () => {
      stopCamera();
    };
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  // QR scanning logic
  const startQRScanning = useCallback(() => {
    // Dynamic import of jsQR
    import('jsqr').then(({ default: jsQR }) => {
      scanIntervalRef.current = setInterval(() => {
        if (!videoRef.current || !canvasRef.current || isProcessing) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code) {
          handleQRCode(code.data);
        }
      }, 200);
    });
  }, [isProcessing]);

  // Handle scanned QR code
  const handleQRCode = useCallback(async (qrData: string) => {
    if (isProcessing) return;

    // Extract shortId from QR data (could be full URL or just shortId)
    const shortIdMatch = qrData.match(/\/v\/([a-zA-Z0-9]+)/);
    const stationShortId = shortIdMatch ? shortIdMatch[1] : qrData;

    setIsProcessing(true);
    setIsScanning(false);

    try {
      const response = await fetch('/api/qtreasure/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeId,
          playerId,
          stationShortId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        stopCamera();
        setResult({
          success: true,
          message: t.success,
          isComplete: data.isComplete,
          nextStation: data.nextStation,
        });
      } else {
        // Handle errors
        let errorMessage = t.error;
        if (data.error === 'alreadyCompleted') {
          errorMessage = t.alreadyScanned;
        } else if (data.error === 'stationNotFound') {
          errorMessage = t.stationNotFound;
        } else if (data.outOfOrderMessage) {
          setResult({
            success: true, // Still success but with warning
            message: data.outOfOrderMessage,
            outOfOrderMessage: data.outOfOrderMessage,
            isComplete: data.isComplete,
            nextStation: data.nextStation,
          });
          stopCamera();
          return;
        }

        setError(errorMessage);
        setIsScanning(false);
      }
    } catch (err) {
      console.error('Scan error:', err);
      setError(t.error);
      setIsScanning(false);
    } finally {
      setIsProcessing(false);
    }
  }, [codeId, playerId, stopCamera, t, isProcessing]);

  // Retry scanning
  const handleRetry = useCallback(() => {
    setError(null);
    setIsScanning(true);
    startQRScanning();
  }, [startQRScanning]);

  // Continue after success
  const handleContinue = useCallback(() => {
    if (result) {
      onResult({
        success: result.success,
        isComplete: result.isComplete,
        nextStation: result.nextStation,
        outOfOrderMessage: result.outOfOrderMessage,
      });
    }
  }, [result, onResult]);

  return (
    <div className="scanner-overlay">
      <div className="scanner-container">
        {/* Close button */}
        <button className="close-btn" onClick={onClose}>
          ✕
        </button>

        {/* Camera view */}
        <div className="camera-wrapper">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`camera-feed ${isScanning ? 'scanning' : ''}`}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Scanning frame */}
          {isScanning && (
            <div className="scan-frame">
              <div className="corner top-left" />
              <div className="corner top-right" />
              <div className="corner bottom-left" />
              <div className="corner bottom-right" />
              <div className="scan-line" />
            </div>
          )}

          {/* Processing indicator */}
          {isProcessing && (
            <div className="processing">
              <div className="spinner" />
              <p>{t.scanning}</p>
            </div>
          )}
        </div>

        {/* Instructions */}
        {isScanning && !error && !result && (
          <p className="instructions">{t.pointCamera}</p>
        )}

        {/* Error state */}
        {error && (
          <div className="result-card error">
            <div className="result-icon">❌</div>
            <p className="result-message">{error}</p>
            <button className="action-btn" onClick={handleRetry}>
              {t.tryAgain}
            </button>
          </div>
        )}

        {/* Success state */}
        {result && (
          <div className={`result-card ${result.outOfOrderMessage ? 'warning' : 'success'}`}>
            <div className="result-icon">
              {result.outOfOrderMessage ? '⚠️' : (result.isComplete ? '🏆' : '✅')}
            </div>
            <p className="result-message">{result.message}</p>
            <button className="action-btn" onClick={handleContinue}>
              {t.continue}
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .scanner-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.95);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }

        .scanner-container {
          width: 100%;
          max-width: 400px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
        }

        .close-btn {
          position: absolute;
          top: 1rem;
          right: 1rem;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 50%;
          color: white;
          font-size: 1.25rem;
          cursor: pointer;
          transition: background 0.2s;
          z-index: 10;
        }

        .close-btn:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .camera-wrapper {
          position: relative;
          width: 100%;
          aspect-ratio: 1;
          border-radius: 20px;
          overflow: hidden;
          background: #111;
        }

        .camera-feed {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .camera-feed.scanning {
          filter: brightness(1.1);
        }

        .scan-frame {
          position: absolute;
          inset: 15%;
          pointer-events: none;
        }

        .corner {
          position: absolute;
          width: 30px;
          height: 30px;
          border-color: #d4af37;
          border-style: solid;
          border-width: 0;
        }

        .top-left {
          top: 0;
          left: 0;
          border-top-width: 3px;
          border-left-width: 3px;
          border-top-left-radius: 8px;
        }

        .top-right {
          top: 0;
          right: 0;
          border-top-width: 3px;
          border-right-width: 3px;
          border-top-right-radius: 8px;
        }

        .bottom-left {
          bottom: 0;
          left: 0;
          border-bottom-width: 3px;
          border-left-width: 3px;
          border-bottom-left-radius: 8px;
        }

        .bottom-right {
          bottom: 0;
          right: 0;
          border-bottom-width: 3px;
          border-right-width: 3px;
          border-bottom-right-radius: 8px;
        }

        .scan-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #d4af37, transparent);
          animation: scan 2s ease-in-out infinite;
        }

        @keyframes scan {
          0%, 100% { top: 0; opacity: 0.5; }
          50% { top: 100%; opacity: 1; }
        }

        .processing {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.7);
          color: #d4af37;
        }

        .spinner {
          width: 50px;
          height: 50px;
          border: 3px solid rgba(212, 175, 55, 0.3);
          border-top-color: #d4af37;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 1rem;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .instructions {
          color: rgba(212, 175, 55, 0.8);
          font-size: 1rem;
          text-align: center;
        }

        .result-card {
          width: 100%;
          padding: 2rem;
          border-radius: 16px;
          text-align: center;
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .result-card.success {
          background: linear-gradient(135deg, rgba(74, 222, 128, 0.2), rgba(0, 0, 0, 0.3));
          border: 1px solid rgba(74, 222, 128, 0.3);
        }

        .result-card.warning {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(0, 0, 0, 0.3));
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .result-card.error {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(0, 0, 0, 0.3));
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .result-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .result-message {
          color: #f5f5dc;
          font-size: 1.125rem;
          margin: 0 0 1.5rem;
        }

        .action-btn {
          padding: 0.875rem 2rem;
          font-family: 'Cinzel', 'Crimson Text', Georgia, serif;
          font-size: 1rem;
          font-weight: 600;
          color: #0d1f17;
          background: linear-gradient(135deg, #d4af37, #f5d670);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-btn:hover {
          transform: scale(1.02);
        }

        .action-btn:active {
          transform: scale(0.98);
        }
      `}</style>
    </div>
  );
}
