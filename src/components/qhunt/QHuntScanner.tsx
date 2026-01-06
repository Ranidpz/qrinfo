'use client';

/**
 * QHuntScanner - QR code scanning interface with score and timer display
 *
 * Design: Neon Hunter - Arcade Gaming Vibe
 * - Scanning beam animation
 * - Neon score display
 * - Urgent timer effects
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  QHuntConfig,
  QHuntPlayer,
  QHuntScanResult,
  CODE_TYPE_CONFIG,
  QHUNT_TRANSLATIONS,
  formatGameTime,
} from '@/types/qhunt';
import { useQHuntTimer, useAnimatedScore } from '@/hooks/useQHuntRealtime';
import { QHuntManualEntry } from './QHuntManualEntry';

interface QHuntScannerProps {
  codeId: string;
  player: QHuntPlayer;
  config: QHuntConfig;
  onScanComplete: (isGameComplete: boolean) => Promise<void>;
  onScanError: () => void;
  lang: 'he' | 'en';
}

export function QHuntScanner({
  codeId,
  player,
  config,
  onScanComplete,
  onScanError,
  lang,
}: QHuntScannerProps) {
  const t = QHUNT_TRANSLATIONS[lang];
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
    points?: number;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { timeRemaining, isExpired, formattedTime, elapsedTime } = useQHuntTimer(
    player.gameStartedAt,
    config.gameDurationSeconds
  );

  const animatedScore = useAnimatedScore({
    targetScore: player.currentScore,
    duration: 500,
    enabled: true,
  });

  // Get assigned code type config
  const assignedType = player.assignedCodeType;
  const typeConfig = assignedType ? CODE_TYPE_CONFIG[assignedType] : null;

  // Initialize scanner
  useEffect(() => {
    if (!containerRef.current || showManualEntry) return;

    const scannerId = 'qhunt-scanner';

    // Make sure the container exists
    const container = containerRef.current;
    if (!container.querySelector(`#${scannerId}`)) {
      const scannerDiv = document.createElement('div');
      scannerDiv.id = scannerId;
      container.appendChild(scannerDiv);
    }

    const initScanner = async () => {
      try {
        scannerRef.current = new Html5Qrcode(scannerId);

        await scannerRef.current.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          handleScan,
          () => {} // Ignore errors
        );

        setIsScanning(true);
      } catch (error) {
        console.error('Scanner init error:', error);
      }
    };

    initScanner();

    return () => {
      if (scannerRef.current && isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [showManualEntry]);

  // Handle QR scan
  const handleScan = useCallback(async (decodedText: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      await processScan(decodedText, 'qr');
    } finally {
      // Add delay before allowing next scan
      setTimeout(() => setIsProcessing(false), 1500);
    }
  }, [isProcessing]);

  // Handle manual code entry
  const handleManualEntry = async (code: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      await processScan(code, 'manual');
    } finally {
      setTimeout(() => setIsProcessing(false), 1500);
    }

    setShowManualEntry(false);
  };

  // Process scan (common for QR and manual)
  const processScan = async (codeValue: string, method: 'qr' | 'manual') => {
    try {
      const playerId = localStorage.getItem('qhunt_visitor_id');
      if (!playerId) throw new Error('No player ID');

      const response = await fetch('/api/qhunt/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeId,
          playerId,
          codeValue,
          scanMethod: method,
        }),
      });

      const result: QHuntScanResult = await response.json();

      if (result.success) {
        // Show success feedback
        setFeedback({
          type: 'success',
          message: t.correctCode,
          points: result.scan?.points,
        });

        await onScanComplete(result.isGameComplete || false);
      } else {
        // Show error feedback
        if (result.error === 'WRONG_TYPE') {
          const correctTypeConfig = result.correctType ? CODE_TYPE_CONFIG[result.correctType] : null;
          setFeedback({
            type: 'warning',
            message: `${t.wrongType} ${t.lookFor} ${correctTypeConfig ? (lang === 'he' ? correctTypeConfig.name : correctTypeConfig.nameEn) : ''}!`,
          });
        } else if (result.error === 'ALREADY_SCANNED') {
          setFeedback({
            type: 'error',
            message: t.alreadyScanned,
          });
        } else if (result.error === 'CODE_NOT_FOUND') {
          setFeedback({
            type: 'error',
            message: t.codeNotFound,
          });
        } else if (result.error === 'TIME_EXPIRED') {
          setFeedback({
            type: 'error',
            message: t.timeUp,
          });
        } else {
          setFeedback({
            type: 'error',
            message: result.message || 'Error',
          });
        }

        onScanError();
      }

      // Clear feedback after delay
      setTimeout(() => setFeedback(null), 2500);
    } catch (error) {
      console.error('Scan error:', error);
      setFeedback({
        type: 'error',
        message: lang === 'he' ? 'שגיאה בסריקה' : 'Scan error',
      });
      onScanError();
      setTimeout(() => setFeedback(null), 2500);
    }
  };

  // Timer urgency level
  const getTimerUrgency = () => {
    if (config.gameDurationSeconds === 0) return 'normal';
    if (timeRemaining <= 30) return 'critical';
    if (timeRemaining <= 60) return 'warning';
    return 'normal';
  };

  return (
    <div className="qhunt-scanner">
      {/* Header with stats */}
      <div className="scanner-header">
        <div className="stat-box score-box">
          <span className="stat-label">{t.yourScore}</span>
          <span className="stat-value score-value">{animatedScore}</span>
        </div>

        <div className={`stat-box timer-box ${getTimerUrgency()}`}>
          <span className="stat-label">{t.timeRemaining}</span>
          <span className="stat-value timer-value">{formattedTime}</span>
        </div>

        <div className="stat-box codes-box">
          <span className="stat-label">{t.codesFound}</span>
          <span className="stat-value">
            {player.scansCount}/{config.targetCodeCount}
          </span>
        </div>
      </div>

      {/* Mission indicator */}
      {config.enableTypeBasedHunting && typeConfig && (
        <div
          className="mission-indicator"
          style={{
            '--type-color': typeConfig.color,
            '--type-glow': typeConfig.glowColor,
          } as React.CSSProperties}
        >
          <span className="mission-label">{t.yourMission}:</span>
          <span className="mission-type">
            {t.findCodes} {lang === 'he' ? typeConfig.name : typeConfig.nameEn}
          </span>
        </div>
      )}

      {/* Scanner area or manual entry */}
      <div className="scanner-main">
        {showManualEntry ? (
          <QHuntManualEntry
            onSubmit={handleManualEntry}
            onCancel={() => setShowManualEntry(false)}
            isProcessing={isProcessing}
            lang={lang}
          />
        ) : (
          <>
            <div className="scanner-container" ref={containerRef}>
              {/* Scanner will be inserted here */}
              <div className="scanner-overlay">
                <div className="scan-frame">
                  <div className="frame-corner top-left" />
                  <div className="frame-corner top-right" />
                  <div className="frame-corner bottom-left" />
                  <div className="frame-corner bottom-right" />
                  <div className="scan-line" />
                </div>
              </div>
            </div>

            {/* Feedback overlay */}
            {feedback && (
              <div className={`feedback-overlay ${feedback.type}`}>
                <div className="feedback-content">
                  {feedback.type === 'success' && feedback.points && (
                    <div className="feedback-points">+{feedback.points}</div>
                  )}
                  <div className="feedback-message">{feedback.message}</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom actions */}
      {!showManualEntry && (
        <div className="scanner-actions">
          <button
            className="manual-entry-btn"
            onClick={() => setShowManualEntry(true)}
            disabled={isProcessing}
          >
            <span className="btn-icon">⌨️</span>
            {t.enterCode}
          </button>
        </div>
      )}

      <style jsx>{`
        .qhunt-scanner {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          min-height: 100dvh;
          padding: 16px;
          gap: 16px;
        }

        /* Header stats */
        .scanner-header {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
        }

        .stat-box {
          background: #ffffff08;
          border: 1px solid #ffffff15;
          border-radius: 12px;
          padding: 10px 8px;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .stat-label {
          font-size: 0.7rem;
          color: #ffffff60;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .stat-value {
          font-size: 1.3rem;
          font-weight: 800;
          color: #fff;
        }

        .score-box {
          border-color: var(--qhunt-primary)40;
        }

        .score-value {
          color: var(--qhunt-primary);
          text-shadow: 0 0 10px var(--qhunt-primary);
        }

        .timer-box {
          transition: all 0.3s ease;
        }

        .timer-box.warning {
          border-color: var(--qhunt-warning)60;
          background: var(--qhunt-warning)10;
        }

        .timer-box.warning .timer-value {
          color: var(--qhunt-warning);
          animation: timerPulse 1s ease-in-out infinite;
        }

        .timer-box.critical {
          border-color: #ff4466;
          background: #ff446620;
          animation: timerShake 0.5s ease-in-out infinite;
        }

        .timer-box.critical .timer-value {
          color: #ff4466;
        }

        @keyframes timerPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        @keyframes timerShake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }

        .codes-box {
          border-color: var(--qhunt-success)40;
        }

        .codes-box .stat-value {
          color: var(--qhunt-success);
        }

        /* Mission indicator */
        .mission-indicator {
          background: var(--type-color, var(--qhunt-primary))15;
          border: 2px solid var(--type-color, var(--qhunt-primary));
          border-radius: 12px;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          justify-content: center;
          box-shadow: 0 0 20px var(--type-glow, var(--qhunt-primary)40);
        }

        .mission-label {
          color: #ffffff90;
          font-size: 0.9rem;
        }

        .mission-type {
          color: var(--type-color, var(--qhunt-primary));
          font-weight: 700;
          font-size: 1.1rem;
          text-shadow: 0 0 10px var(--type-glow, var(--qhunt-primary));
        }

        /* Scanner main */
        .scanner-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .scanner-container {
          flex: 1;
          position: relative;
          border-radius: 20px;
          overflow: hidden;
          background: #000;
        }

        .scanner-container :global(#qhunt-scanner) {
          width: 100%;
          height: 100%;
        }

        .scanner-container :global(#qhunt-scanner video) {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .scanner-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }

        .scan-frame {
          width: 250px;
          height: 250px;
          position: relative;
        }

        .frame-corner {
          position: absolute;
          width: 30px;
          height: 30px;
          border: 3px solid var(--qhunt-primary);
        }

        .frame-corner.top-left {
          top: 0;
          left: 0;
          border-right: none;
          border-bottom: none;
          border-top-left-radius: 12px;
        }

        .frame-corner.top-right {
          top: 0;
          right: 0;
          border-left: none;
          border-bottom: none;
          border-top-right-radius: 12px;
        }

        .frame-corner.bottom-left {
          bottom: 0;
          left: 0;
          border-right: none;
          border-top: none;
          border-bottom-left-radius: 12px;
        }

        .frame-corner.bottom-right {
          bottom: 0;
          right: 0;
          border-left: none;
          border-top: none;
          border-bottom-right-radius: 12px;
        }

        .scan-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg,
            transparent,
            var(--qhunt-primary),
            var(--qhunt-primary),
            transparent
          );
          box-shadow: 0 0 10px var(--qhunt-primary);
          animation: scanMove 2s ease-in-out infinite;
        }

        @keyframes scanMove {
          0%, 100% { top: 0; opacity: 1; }
          50% { top: calc(100% - 2px); opacity: 0.8; }
        }

        /* Feedback overlay */
        .feedback-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
          animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .feedback-overlay.success {
          background: var(--qhunt-success)20;
        }

        .feedback-overlay.error {
          background: #ff446620;
        }

        .feedback-overlay.warning {
          background: var(--qhunt-warning)20;
        }

        .feedback-content {
          text-align: center;
          padding: 24px;
          border-radius: 20px;
          animation: popIn 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        @keyframes popIn {
          from { transform: scale(0.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .feedback-overlay.success .feedback-content {
          background: var(--qhunt-success);
          color: #000;
        }

        .feedback-overlay.error .feedback-content {
          background: #ff4466;
          color: #fff;
        }

        .feedback-overlay.warning .feedback-content {
          background: var(--qhunt-warning);
          color: #000;
        }

        .feedback-points {
          font-size: 2.5rem;
          font-weight: 800;
          margin-bottom: 4px;
          animation: bounceIn 0.4s ease-out;
        }

        @keyframes bounceIn {
          0% { transform: scale(0); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }

        .feedback-message {
          font-size: 1.2rem;
          font-weight: 600;
        }

        /* Actions */
        .scanner-actions {
          padding-top: 16px;
        }

        .manual-entry-btn {
          width: 100%;
          padding: 16px;
          font-size: 1.1rem;
          font-weight: 600;
          font-family: 'Assistant', sans-serif;
          background: #ffffff10;
          border: 2px solid #ffffff30;
          border-radius: 12px;
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.3s ease;
        }

        .manual-entry-btn:hover:not(:disabled) {
          background: #ffffff20;
          border-color: var(--qhunt-primary);
        }

        .manual-entry-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-icon {
          font-size: 1.3rem;
        }
      `}</style>
    </div>
  );
}
