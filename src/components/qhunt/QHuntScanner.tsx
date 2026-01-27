'use client';

/**
 * QHuntScanner - QR code scanning interface with score and timer display
 *
 * Design: Neon Hunter - Arcade Gaming Vibe
 * - Scanning beam animation
 * - Neon score display
 * - Urgent timer effects
 * - Floating points animation
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

// Floating points animation component
interface FloatingPointsProps {
  points: number;
  onComplete: () => void;
}

function FloatingPoints({ points, onComplete }: FloatingPointsProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 1500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="floating-points">
      +{points}
      <style jsx>{`
        .floating-points {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 4rem;
          font-weight: 900;
          color: #00ff88;
          text-shadow:
            0 0 20px #00ff88,
            0 0 40px #00ff88,
            0 0 60px rgba(0, 255, 136, 0.5);
          z-index: 9999;
          pointer-events: none;
          animation: floatUp 1.5s ease-out forwards;
        }

        @keyframes floatUp {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.5);
          }
          20% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.3);
          }
          40% {
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -150%) scale(0.8);
          }
        }
      `}</style>
    </div>
  );
}

interface QHuntScannerProps {
  codeId: string;
  player: QHuntPlayer;
  config: QHuntConfig;
  onScanComplete: (isGameComplete: boolean) => Promise<void>;
  onScanError: () => void;
  onEditProfile?: () => void;
  lang: 'he' | 'en';
}

export function QHuntScanner({
  codeId,
  player,
  config,
  onScanComplete,
  onScanError,
  onEditProfile,
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
  const [floatingPoints, setFloatingPoints] = useState<number | null>(null);
  const [showEndGameModal, setShowEndGameModal] = useState(false);
  const [isEndingGame, setIsEndingGame] = useState(false);
  const [hintModal, setHintModal] = useState<{ hint: string; scannedCodeId: string } | null>(null);

  // Use ref to avoid stale closure in scanner callback
  const isProcessingRef = useRef(false);
  const lastScannedCodeRef = useRef<string | null>(null);
  const viewedHintsRef = useRef<Set<string>>(new Set());
  const isScanningRef = useRef(false);

  // Load viewed hints from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(`qhunt_viewed_hints_${codeId}`);
    if (stored) {
      try {
        viewedHintsRef.current = new Set(JSON.parse(stored));
      } catch {
        // Ignore parse errors
      }
    }
  }, [codeId]);

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

  // Calculate actual target based on assigned type (if type-based hunting)
  const actualTargetCount = React.useMemo(() => {
    if (config.enableTypeBasedHunting && assignedType) {
      // Count active codes of the assigned type
      const codesOfType = config.codes.filter(
        c => c.isActive && c.codeType === assignedType
      ).length;
      return codesOfType;
    }
    // Default: use config target
    return config.targetCodeCount;
  }, [config.codes, config.enableTypeBasedHunting, config.targetCodeCount, assignedType]);

  // Extract code from URL if scanned text is a URL
  const extractCodeFromUrl = useCallback((scannedText: string): string => {
    try {
      const url = new URL(scannedText);
      const codeParam = url.searchParams.get('code');
      if (codeParam) {
        return codeParam;
      }
    } catch {
      // Not a URL, use as-is (backward compatibility)
    }
    return scannedText;
  }, []);

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
            qrbox: { width: 200, height: 200 },
            aspectRatio: 1,
          },
          handleScan,
          () => {} // Ignore errors
        );

        isScanningRef.current = true;
        setIsScanning(true);
      } catch (error) {
        console.error('Scanner init error:', error);
      }
    };

    initScanner();

    return () => {
      isScanningRef.current = false;
      if (scannerRef.current) {
        // Only stop if actually scanning (Html5Qrcode throws if not running)
        const scanner = scannerRef.current;
        if (scanner.isScanning) {
          scanner.stop().catch(() => {});
        }
        scannerRef.current = null;
      }
    };
  }, [showManualEntry]);

  // Handle QR scan - using refs to avoid stale closure
  const handleScan = useCallback(async (decodedText: string) => {
    // Skip if scanner is not active (e.g., during cleanup)
    if (!isScanningRef.current) return;

    // Use ref to check processing state (avoids stale closure)
    if (isProcessingRef.current) return;

    // Extract code first to check for duplicates
    const extractedCode = extractCodeFromUrl(decodedText);

    // Prevent re-scanning the same code in quick succession
    if (lastScannedCodeRef.current === extractedCode.toLowerCase()) return;

    isProcessingRef.current = true;
    setIsProcessing(true);
    lastScannedCodeRef.current = extractedCode.toLowerCase();

    try {
      await processScan(decodedText, 'qr');
    } finally {
      // Add delay before allowing next scan
      setTimeout(() => {
        isProcessingRef.current = false;
        setIsProcessing(false);
      }, 2000);

      // Clear last scanned code after longer delay (allows re-scanning after 5 seconds)
      setTimeout(() => {
        lastScannedCodeRef.current = null;
      }, 5000);
    }
  }, [extractCodeFromUrl]);

  // Handle manual code entry
  const handleManualEntry = async (code: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setIsProcessing(true);

    try {
      await processScan(code, 'manual');
    } finally {
      setTimeout(() => {
        isProcessingRef.current = false;
        setIsProcessing(false);
      }, 1500);
    }

    setShowManualEntry(false);
  };

  // Process scan (common for QR and manual)
  const processScan = async (codeValue: string, method: 'qr' | 'manual') => {
    try {
      // Extract code from URL if the scanned text is a URL
      const extractedCode = extractCodeFromUrl(codeValue);

      const playerId = localStorage.getItem('qhunt_visitor_id');
      if (!playerId) throw new Error('No player ID');

      const response = await fetch('/api/qhunt/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeId,
          playerId,
          codeValue: extractedCode,
          scanMethod: method,
        }),
      });

      const result: QHuntScanResult = await response.json();

      if (result.success) {
        // Show floating points animation
        if (result.scan?.points) {
          setFloatingPoints(result.scan.points);
        }

        // Show success feedback
        setFeedback({
          type: 'success',
          message: t.correctCode,
          points: result.scan?.points,
        });

        await onScanComplete(result.isGameComplete || false);

        // Show hint modal if hint exists, game not complete, and hasn't been viewed
        // Note: Only show hint if there are more codes to find (not game complete)
        if (result.hint && result.scan?.codeId && !result.isGameComplete) {
          const alreadyViewed = viewedHintsRef.current.has(result.scan.codeId);
          console.log('[QHunt] Hint check:', { hint: result.hint, codeId: result.scan.codeId, alreadyViewed });

          if (!alreadyViewed) {
            // Delay hint modal to show after feedback clears
            setTimeout(() => {
              setHintModal({ hint: result.hint!, scannedCodeId: result.scan!.codeId });
            }, 2600);
          }
        }
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

  // Handle voluntary game end
  const handleEndGame = async () => {
    setIsEndingGame(true);
    try {
      const playerId = localStorage.getItem('qhunt_visitor_id');
      if (!playerId) throw new Error('No player ID');

      const response = await fetch('/api/qhunt/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId, playerId }),
      });

      const result = await response.json();

      if (result.success) {
        setShowEndGameModal(false);
        await onScanComplete(true); // Mark as game complete
      }
    } catch (err) {
      console.error('Error ending game:', err);
    } finally {
      setIsEndingGame(false);
    }
  };

  // Handle closing hint modal
  const handleCloseHint = useCallback(() => {
    if (hintModal) {
      viewedHintsRef.current.add(hintModal.scannedCodeId);
      const hintsArray = Array.from(viewedHintsRef.current);
      localStorage.setItem(`qhunt_viewed_hints_${codeId}`, JSON.stringify(hintsArray));
      setHintModal(null);
    }
  }, [hintModal, codeId]);

  // Timer urgency level
  const getTimerUrgency = () => {
    if (config.gameDurationSeconds === 0) return 'normal';
    if (timeRemaining <= 30) return 'critical';
    if (timeRemaining <= 60) return 'warning';
    return 'normal';
  };

  return (
    <div className="qhunt-scanner">
      {/* Floating points animation */}
      {floatingPoints !== null && (
        <FloatingPoints
          points={floatingPoints}
          onComplete={() => setFloatingPoints(null)}
        />
      )}

      {/* End Game Modal */}
      {showEndGameModal && (
        <div className="end-game-modal-overlay" onClick={() => !isEndingGame && setShowEndGameModal(false)}>
          <div className="end-game-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">
              {lang === 'he' ? 'סיום המשחק' : 'End Game'}
            </h3>
            <p className="modal-text">
              {lang === 'he'
                ? `מצאתם ${player.scansCount} קודים וצברתם ${player.currentScore} נקודות. לסיים?`
                : `You found ${player.scansCount} codes and scored ${player.currentScore} points. End now?`}
            </p>
            <div className="modal-buttons">
              <button
                className="modal-btn modal-btn-cancel"
                onClick={() => setShowEndGameModal(false)}
                disabled={isEndingGame}
              >
                {lang === 'he' ? 'ממשיכים!' : 'Continue!'}
              </button>
              <button
                className="modal-btn modal-btn-confirm"
                onClick={handleEndGame}
                disabled={isEndingGame}
              >
                {isEndingGame ? (
                  <span className="btn-loading" />
                ) : (
                  lang === 'he' ? 'סיים משחק' : 'End Game'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hint Modal with Confetti */}
      {hintModal && (
        <div className="hint-modal-overlay" onClick={handleCloseHint}>
          {/* Mini confetti */}
          <div className="hint-confetti-container">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="hint-confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 0.5}s`,
                  animationDuration: `${1.5 + Math.random()}s`,
                  backgroundColor: ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'][i % 6],
                }}
              />
            ))}
          </div>
          <div className="hint-modal" onClick={(e) => e.stopPropagation()}>
            <button className="hint-close-btn" onClick={handleCloseHint}>
              ✕
            </button>
            <div className="hint-icon">💡</div>
            <h3 className="hint-title">{lang === 'he' ? 'רמז!' : 'Hint!'}</h3>
            <p className="hint-text">{hintModal.hint}</p>
            <button className="hint-continue-btn" onClick={handleCloseHint}>
              {lang === 'he' ? 'הבנתי!' : 'Got it!'}
            </button>
          </div>
        </div>
      )}

      {/* Top bar with logo and player profile */}
      <div className="scanner-top-bar">
        <button
          className="top-bar-profile"
          onClick={onEditProfile}
          disabled={!onEditProfile}
        >
          <div className={`profile-avatar ${player.avatarType === 'selfie' ? 'photo-avatar' : ''}`}>
            {player.avatarType === 'selfie' && player.avatarValue ? (
              <img src={player.avatarValue} alt="" className="avatar-img" />
            ) : (
              player.avatarValue || '🎮'
            )}
          </div>
          <span className="profile-name">{player.name}</span>
        </button>
        <div className="top-bar-logo">
          <img src="/icons/apple-touch-icon.png" alt="Q.Hunt" />
        </div>
      </div>

      {/* Header with stats */}
      <div className="scanner-header">
        <div className="stat-box score-box">
          <span className="stat-label">{t.yourScore}</span>
          <span className="stat-value score-value">{animatedScore}</span>
        </div>

        {/* Show timer only if time-limited, otherwise show elapsed time - clickable to end game */}
        {config.gameDurationSeconds > 0 ? (
          <button
            className={`stat-box timer-box clickable ${getTimerUrgency()}`}
            onClick={() => setShowEndGameModal(true)}
          >
            <span className="stat-label">{t.timeRemaining}</span>
            <span className="stat-value timer-value">{formattedTime}</span>
          </button>
        ) : (
          <button
            className="stat-box elapsed-box clickable"
            onClick={() => setShowEndGameModal(true)}
          >
            <span className="stat-label">{lang === 'he' ? 'זמן משחק' : 'Game Time'}</span>
            <span className="stat-value elapsed-value">{formatGameTime(Math.floor(elapsedTime / 1000))}</span>
          </button>
        )}

        <div className="stat-box codes-box">
          <span className="stat-label">{t.codesFound}</span>
          <span className="stat-value">
            {player.scansCount}/{actualTargetCount}
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
          <button
            className="end-game-btn"
            onClick={() => setShowEndGameModal(true)}
            disabled={isProcessing}
          >
            <span className="btn-icon">🏁</span>
            {lang === 'he' ? 'סיימתי!' : 'I\'m done!'}
          </button>
        </div>
      )}

      <style jsx>{`
        .qhunt-scanner {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 12px;
          padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
          gap: 10px;
          overflow: hidden;
        }

        /* Top bar with logo and profile */
        .scanner-top-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 4px;
          padding-bottom: 8px;
          flex-shrink: 0;
        }

        .top-bar-logo {
          width: 40px;
          height: 40px;
        }

        .top-bar-logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          border-radius: 10px;
        }

        .top-bar-profile {
          display: flex;
          align-items: center;
          gap: 10px;
          background: transparent;
          border: none;
          padding: 4px 8px;
          margin: -4px -8px;
          border-radius: 12px;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .top-bar-profile:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
        }

        .top-bar-profile:disabled {
          cursor: default;
        }

        .top-bar-profile .profile-name {
          font-size: 1rem;
          font-weight: 600;
          color: #fff;
          max-width: 120px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .top-bar-profile .profile-avatar {
          width: 40px;
          height: 40px;
          font-size: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(145deg, #ffffff10, #ffffff05);
          border: 2px solid #00bfff;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(0, 191, 255, 0.3);
          overflow: hidden;
        }

        .top-bar-profile .profile-avatar.photo-avatar {
          padding: 0;
        }

        .top-bar-profile .profile-avatar .avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        /* Header stats */
        .scanner-header {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 6px;
          flex-shrink: 0;
        }

        .stat-box {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 8px 6px;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .stat-label {
          font-size: 0.65rem;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .stat-value {
          font-size: 1.2rem;
          font-weight: 800;
          color: #fff;
        }

        .score-box {
          border-color: rgba(0, 255, 136, 0.25);
        }

        .score-value {
          color: #00ff88;
          text-shadow: 0 0 10px #00ff88;
        }

        .timer-box {
          transition: all 0.3s ease;
        }

        .timer-box.warning {
          border-color: rgba(255, 170, 0, 0.4);
          background: rgba(255, 170, 0, 0.1);
        }

        .timer-box.warning .timer-value {
          color: #ffaa00;
          animation: timerPulse 1s ease-in-out infinite;
        }

        .timer-box.critical {
          border-color: #ff4466;
          background: rgba(255, 68, 102, 0.12);
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
          border-color: rgba(0, 255, 136, 0.25);
        }

        .codes-box .stat-value {
          color: #00ff88;
        }

        /* Elapsed time box (for unlimited time games) */
        .elapsed-box {
          border-color: rgba(100, 180, 255, 0.25);
          background: rgba(100, 180, 255, 0.05);
        }

        .elapsed-value {
          color: #64b4ff;
          text-shadow: 0 0 10px rgba(100, 180, 255, 0.5);
        }

        /* Clickable stat boxes */
        .stat-box.clickable {
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .stat-box.clickable:hover {
          transform: scale(1.02);
          box-shadow: 0 0 15px rgba(255, 255, 255, 0.1);
        }

        .stat-box.clickable:active {
          transform: scale(0.98);
        }

        /* End Game Modal */
        .end-game-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(8px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .end-game-modal {
          background: linear-gradient(145deg, #1a1f2e, #0d1117);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 24px;
          max-width: 320px;
          width: 100%;
          text-align: center;
          animation: scaleIn 0.2s ease;
        }

        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .modal-title {
          font-size: 1.4rem;
          font-weight: 700;
          color: #fff;
          margin: 0 0 12px;
        }

        .modal-text {
          font-size: 1rem;
          color: rgba(255, 255, 255, 0.7);
          margin: 0 0 20px;
          line-height: 1.5;
        }

        .modal-buttons {
          display: flex;
          gap: 12px;
        }

        .modal-btn {
          flex: 1;
          padding: 12px 16px;
          font-size: 1rem;
          font-weight: 600;
          font-family: 'Assistant', sans-serif;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .modal-btn-cancel {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .modal-btn-cancel:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.15);
        }

        .modal-btn-confirm {
          background: linear-gradient(135deg, #00ff88, #00cc6a);
          color: #000;
        }

        .modal-btn-confirm:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(0, 255, 136, 0.4);
        }

        .modal-btn .btn-loading {
          width: 20px;
          height: 20px;
          border: 2px solid transparent;
          border-top-color: currentColor;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Hint Modal */
        .hint-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(10px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeIn 0.3s ease;
        }

        .hint-modal {
          background: linear-gradient(145deg, #1a2744, #0d1525);
          border: 2px solid rgba(255, 215, 0, 0.4);
          border-radius: 24px;
          padding: 28px 24px;
          max-width: 320px;
          width: 100%;
          text-align: center;
          position: relative;
          box-shadow:
            0 0 40px rgba(255, 215, 0, 0.2),
            0 20px 60px rgba(0, 0, 0, 0.5);
          animation: hintPopIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes hintPopIn {
          from {
            transform: scale(0.8) translateY(20px);
            opacity: 0;
          }
          to {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }

        .hint-close-btn {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: rgba(255, 255, 255, 0.7);
          font-size: 1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .hint-close-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          color: #fff;
        }

        .hint-icon {
          font-size: 3rem;
          margin-bottom: 12px;
          animation: hintGlow 2s ease-in-out infinite;
        }

        @keyframes hintGlow {
          0%, 100% {
            filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.5));
          }
          50% {
            filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.8));
          }
        }

        .hint-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #ffd700;
          margin: 0 0 16px;
          text-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
        }

        .hint-text {
          font-size: 1.1rem;
          color: rgba(255, 255, 255, 0.9);
          margin: 0 0 20px;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .hint-continue-btn {
          width: 100%;
          padding: 14px 24px;
          font-size: 1rem;
          font-weight: 700;
          font-family: 'Assistant', sans-serif;
          background: linear-gradient(135deg, #ffd700, #ffaa00);
          border: none;
          border-radius: 14px;
          color: #000;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 20px rgba(255, 215, 0, 0.3);
        }

        .hint-continue-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 30px rgba(255, 215, 0, 0.5);
        }

        .hint-continue-btn:active {
          transform: translateY(0);
        }

        /* Hint confetti */
        .hint-confetti-container {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 999;
          overflow: hidden;
        }

        .hint-confetti {
          position: absolute;
          top: -10px;
          width: 10px;
          height: 10px;
          border-radius: 2px;
          animation: hintConfettiFall 2s ease-out forwards;
        }

        @keyframes hintConfettiFall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }

        /* Mission indicator */
        .mission-indicator {
          background: color-mix(in srgb, var(--type-color, #00ff88) 15%, transparent);
          border: 2px solid var(--type-color, #00ff88);
          border-radius: 10px;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          justify-content: center;
          box-shadow: 0 0 15px var(--type-glow, rgba(0, 255, 136, 0.3));
          flex-shrink: 0;
        }

        .mission-label {
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.85rem;
        }

        .mission-type {
          color: var(--type-color, #00ff88);
          font-weight: 700;
          font-size: 1rem;
          text-shadow: 0 0 8px var(--type-glow, rgba(0, 255, 136, 0.5));
        }

        /* Scanner main */
        .scanner-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          position: relative;
          min-height: 0;
          overflow: hidden;
        }

        .scanner-container {
          flex: 1;
          position: relative;
          border-radius: 14px;
          overflow: hidden;
          background: #000;
          max-height: 300px;
          min-height: 200px;
          margin: 0 auto;
          width: 100%;
          max-width: 300px;
          aspect-ratio: 1;
        }

        .scanner-container :global(#qhunt-scanner) {
          width: 100%;
          height: 100%;
        }

        .scanner-container :global(#qhunt-scanner video) {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 14px;
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
          width: 180px;
          height: 180px;
          position: relative;
        }

        .frame-corner {
          position: absolute;
          width: 25px;
          height: 25px;
          border: 3px solid #00ff88;
        }

        .frame-corner.top-left {
          top: 0;
          left: 0;
          border-right: none;
          border-bottom: none;
          border-top-left-radius: 10px;
        }

        .frame-corner.top-right {
          top: 0;
          right: 0;
          border-left: none;
          border-bottom: none;
          border-top-right-radius: 10px;
        }

        .frame-corner.bottom-left {
          bottom: 0;
          left: 0;
          border-right: none;
          border-top: none;
          border-bottom-left-radius: 10px;
        }

        .frame-corner.bottom-right {
          bottom: 0;
          right: 0;
          border-left: none;
          border-top: none;
          border-bottom-right-radius: 10px;
        }

        .scan-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg,
            transparent,
            #00ff88,
            #00ff88,
            transparent
          );
          box-shadow: 0 0 10px #00ff88;
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
          background: rgba(0, 255, 136, 0.15);
        }

        .feedback-overlay.error {
          background: rgba(255, 68, 102, 0.15);
        }

        .feedback-overlay.warning {
          background: rgba(255, 170, 0, 0.15);
        }

        .feedback-content {
          text-align: center;
          padding: 20px;
          border-radius: 16px;
          animation: popIn 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        @keyframes popIn {
          from { transform: scale(0.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .feedback-overlay.success .feedback-content {
          background: #00ff88;
          color: #000;
        }

        .feedback-overlay.error .feedback-content {
          background: #ff4466;
          color: #fff;
        }

        .feedback-overlay.warning .feedback-content {
          background: #ffaa00;
          color: #000;
        }

        .feedback-points {
          font-size: 2rem;
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
          font-size: 1.1rem;
          font-weight: 600;
        }

        /* Actions */
        .scanner-actions {
          padding-top: 12px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .manual-entry-btn {
          width: 100%;
          padding: 14px;
          font-size: 1rem;
          font-weight: 600;
          font-family: 'Assistant', sans-serif;
          background: rgba(255, 255, 255, 0.06);
          border: 2px solid rgba(255, 255, 255, 0.2);
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
          background: rgba(255, 255, 255, 0.12);
          border-color: #00ff88;
        }

        .manual-entry-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .end-game-btn {
          width: 100%;
          padding: 12px;
          font-size: 0.95rem;
          font-weight: 600;
          font-family: 'Assistant', sans-serif;
          background: rgba(255, 136, 0, 0.1);
          border: 2px solid rgba(255, 136, 0, 0.4);
          border-radius: 12px;
          color: #ff8800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.3s ease;
        }

        .end-game-btn:hover:not(:disabled) {
          background: rgba(255, 136, 0, 0.2);
          border-color: #ff8800;
        }

        .end-game-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-icon {
          font-size: 1.2rem;
        }

        /* Mobile optimizations for short screens */
        @media (max-height: 650px) {
          .qhunt-scanner {
            padding: 8px;
            padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
            gap: 8px;
          }

          .scanner-top-bar {
            padding: 0 2px;
          }

          .top-bar-logo {
            width: 32px;
            height: 32px;
          }

          .top-bar-profile .profile-name {
            font-size: 0.9rem;
            max-width: 100px;
          }

          .top-bar-profile .profile-avatar {
            width: 32px;
            height: 32px;
            font-size: 1.2rem;
          }

          .stat-box {
            padding: 6px 4px;
            border-radius: 8px;
          }

          .stat-label {
            font-size: 0.6rem;
          }

          .stat-value {
            font-size: 1rem;
          }

          .mission-indicator {
            padding: 8px 12px;
            border-radius: 8px;
          }

          .mission-label {
            font-size: 0.8rem;
          }

          .mission-type {
            font-size: 0.9rem;
          }

          .scanner-container {
            max-height: 220px;
            min-height: 180px;
            max-width: 220px;
            border-radius: 12px;
          }

          .scan-frame {
            width: 150px;
            height: 150px;
          }

          .frame-corner {
            width: 20px;
            height: 20px;
            border-width: 2px;
          }

          .feedback-content {
            padding: 16px;
            border-radius: 12px;
          }

          .feedback-points {
            font-size: 1.6rem;
          }

          .feedback-message {
            font-size: 1rem;
          }

          .scanner-actions {
            padding-top: 8px;
          }

          .manual-entry-btn {
            padding: 12px;
            font-size: 0.95rem;
            border-radius: 10px;
          }

          .end-game-btn {
            padding: 10px;
            font-size: 0.9rem;
            border-radius: 10px;
          }

          .btn-icon {
            font-size: 1.1rem;
          }
        }

        /* Extra small screens (iPhone SE, etc.) */
        @media (max-height: 550px) {
          .qhunt-scanner {
            padding: 6px;
            padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px));
            gap: 6px;
          }

          .top-bar-logo {
            width: 28px;
            height: 28px;
          }

          .top-bar-profile .profile-name {
            font-size: 0.85rem;
            max-width: 80px;
          }

          .top-bar-profile .profile-avatar {
            width: 28px;
            height: 28px;
            font-size: 1rem;
          }

          .scanner-header {
            gap: 4px;
          }

          .stat-box {
            padding: 5px 3px;
          }

          .stat-label {
            font-size: 0.55rem;
          }

          .stat-value {
            font-size: 0.9rem;
          }

          .mission-indicator {
            padding: 6px 10px;
          }

          .mission-label {
            font-size: 0.75rem;
          }

          .mission-type {
            font-size: 0.85rem;
          }

          .scanner-container {
            max-height: 180px;
            min-height: 150px;
            max-width: 180px;
          }

          .scan-frame {
            width: 130px;
            height: 130px;
          }

          .manual-entry-btn {
            padding: 10px;
            font-size: 0.9rem;
          }

          .end-game-btn {
            padding: 8px;
            font-size: 0.85rem;
          }
        }
      `}</style>
    </div>
  );
}
