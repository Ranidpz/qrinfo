'use client';

/**
 * QTreasureRegistration - Explorer registration with avatar selection
 *
 * Design: Ancient scroll/parchment with mystical elements
 * - Elegant serif typography
 * - Gold accents on dark forest background
 * - Compass and map decorations
 */

import React, { useState, useRef, useCallback } from 'react';
import { QTreasureConfig, QTreasureStation, DEFAULT_QTREASURE_EMOJI_PALETTE } from '@/types/qtreasure';

interface QTreasureRegistrationProps {
  codeId: string;
  playerId: string;
  config: QTreasureConfig;
  lang: 'he' | 'en';
  isRegistered?: boolean;
  onComplete: (firstStation?: QTreasureStation) => void;
  onStart: () => void;
}

const translations = {
  he: {
    title: 'ברוכים הבאים למסע',
    subtitle: 'הציד מתחיל כאן',
    enterName: 'הכניסו את שם החוקר',
    namePlaceholder: 'שם החוקר שלכם',
    chooseAvatar: 'בחרו סמל',
    takeSelfie: 'צלמו תמונה',
    consent: 'אני מאשר/ת הצגת תמונתי בטבלת המובילים',
    startHunt: 'התחילו את הציד!',
    continueHunt: 'המשיכו במסע',
    stationsCount: 'תחנות במסלול',
    ready: 'מוכנים?',
    instructions: 'סרקו את הקודים בכל תחנה וגלו רמזים למיקום הבא',
    nameError: 'השם צריך להכיל 2-20 תווים',
    registering: 'נרשמים למסע...',
  },
  en: {
    title: 'Welcome to the Journey',
    subtitle: 'The hunt begins here',
    enterName: 'Enter your explorer name',
    namePlaceholder: 'Your explorer name',
    chooseAvatar: 'Choose your symbol',
    takeSelfie: 'Take a photo',
    consent: 'I agree to show my photo on the leaderboard',
    startHunt: 'Start the Hunt!',
    continueHunt: 'Continue Journey',
    stationsCount: 'stations to discover',
    ready: 'Ready?',
    instructions: 'Scan the codes at each station and discover hints to the next location',
    nameError: 'Name must be 2-20 characters',
    registering: 'Joining the adventure...',
  },
};

export function QTreasureRegistration({
  codeId,
  playerId,
  config,
  lang,
  isRegistered = false,
  onComplete,
  onStart,
}: QTreasureRegistrationProps) {
  const t = translations[lang];
  const isRTL = lang === 'he';

  const [nickname, setNickname] = useState('');
  const [avatarType, setAvatarType] = useState<'emoji' | 'selfie'>('emoji');
  const [avatarValue, setAvatarValue] = useState(DEFAULT_QTREASURE_EMOJI_PALETTE[0]);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const emojiPalette = config.registration?.emojiPalette || DEFAULT_QTREASURE_EMOJI_PALETTE;
  const activeStations = config.stations.filter(s => s.isActive);

  // Handle selfie capture
  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 400, height: 400 }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setShowCamera(true);
    } catch (err) {
      console.error('Camera access denied:', err);
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = 200;
    canvas.height = 200;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw circular crop
    ctx.beginPath();
    ctx.arc(100, 100, 100, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(video, 0, 0, 200, 200);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setSelfieUrl(dataUrl);
    setAvatarValue(dataUrl);
    setAvatarType('selfie');

    // Stop camera
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  }, [stream]);

  const cancelCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  }, [stream]);

  // Handle registration
  const handleSubmit = async () => {
    // Validate nickname
    if (nickname.length < 2 || nickname.length > 20) {
      setError(t.nameError);
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/qtreasure/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeId,
          playerId,
          nickname,
          avatarType,
          avatarValue,
          consent,
        }),
      });

      const result = await response.json();

      if (result.success) {
        onComplete(result.firstStation);
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Game intro
  const gameTitle = config.branding?.gameTitle || (lang === 'he' ? 'ציד אוצרות' : 'Treasure Hunt');

  return (
    <div className="registration-container">
      {/* Decorative header */}
      <div className="header">
        <div className="compass-icon">🧭</div>
        <h1 className="title">{gameTitle}</h1>
        <p className="subtitle">{t.subtitle}</p>
      </div>

      {/* Stats preview */}
      <div className="stats-preview">
        <div className="stat">
          <span className="stat-value">{activeStations.length}</span>
          <span className="stat-label">{t.stationsCount}</span>
        </div>
      </div>

      {/* Registration form or start button */}
      {!isRegistered ? (
        <div className="form-scroll">
          {/* Nickname input */}
          <div className="form-group">
            <label>{t.enterName}</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t.namePlaceholder}
              maxLength={20}
              className={error ? 'error' : ''}
            />
            {error && <span className="error-text">{error}</span>}
          </div>

          {/* Avatar selection */}
          <div className="form-group">
            <label>{t.chooseAvatar}</label>

            <div className="avatar-tabs">
              <button
                className={`tab ${avatarType === 'emoji' ? 'active' : ''}`}
                onClick={() => setAvatarType('emoji')}
              >
                {lang === 'he' ? 'סמל' : 'Symbol'}
              </button>
              {config.registration?.allowSelfie !== false && (
                <button
                  className={`tab ${avatarType === 'selfie' ? 'active' : ''}`}
                  onClick={() => {
                    setAvatarType('selfie');
                    if (!selfieUrl) startCamera();
                  }}
                >
                  {t.takeSelfie}
                </button>
              )}
            </div>

            {avatarType === 'emoji' && (
              <div className="emoji-grid">
                {emojiPalette.map((emoji) => (
                  <button
                    key={emoji}
                    className={`emoji-btn ${avatarValue === emoji ? 'selected' : ''}`}
                    onClick={() => setAvatarValue(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {avatarType === 'selfie' && (
              <div className="selfie-area">
                {showCamera ? (
                  <div className="camera-view">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="camera-feed"
                    />
                    <div className="camera-controls">
                      <button className="capture-btn" onClick={capturePhoto}>
                        📸
                      </button>
                      <button className="cancel-btn" onClick={cancelCamera}>
                        ✕
                      </button>
                    </div>
                  </div>
                ) : selfieUrl ? (
                  <div className="selfie-preview">
                    <img src={selfieUrl} alt="Selfie" />
                    <button className="retake-btn" onClick={startCamera}>
                      {lang === 'he' ? 'צלמו שוב' : 'Retake'}
                    </button>
                  </div>
                ) : (
                  <button className="start-camera-btn" onClick={startCamera}>
                    📷 {t.takeSelfie}
                  </button>
                )}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </div>
            )}
          </div>

          {/* Consent checkbox */}
          {config.registration?.requireConsent !== false && (
            <label className="consent-label">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span className="checkmark" />
              <span>{t.consent}</span>
            </label>
          )}

          {/* Submit button */}
          <button
            className="start-btn"
            onClick={handleSubmit}
            disabled={isSubmitting || nickname.length < 2}
          >
            {isSubmitting ? (
              <span className="loading">{t.registering}</span>
            ) : (
              <>
                <span className="btn-icon">🗺️</span>
                <span>{t.startHunt}</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="ready-section">
          <div className="ready-text">{t.ready}</div>
          <p className="instructions">{t.instructions}</p>
          <button className="start-btn" onClick={onStart}>
            <span className="btn-icon">⚔️</span>
            <span>{t.continueHunt}</span>
          </button>
        </div>
      )}

      <style jsx>{`
        .registration-container {
          min-height: 100vh;
          min-height: 100dvh;
          padding: 2rem 1.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .compass-icon {
          font-size: 3rem;
          margin-bottom: 0.5rem;
          animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        .title {
          font-family: 'Cinzel', 'Crimson Text', Georgia, serif;
          font-size: 2rem;
          font-weight: 700;
          color: #d4af37;
          text-shadow: 0 2px 20px rgba(212, 175, 55, 0.3);
          margin: 0 0 0.5rem;
          letter-spacing: 0.05em;
        }

        .subtitle {
          color: rgba(212, 175, 55, 0.7);
          font-size: 1rem;
          font-style: italic;
          margin: 0;
        }

        .stats-preview {
          display: flex;
          justify-content: center;
          margin-bottom: 2rem;
        }

        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1rem 2rem;
          background: rgba(212, 175, 55, 0.1);
          border: 1px solid rgba(212, 175, 55, 0.2);
          border-radius: 12px;
        }

        .stat-value {
          font-size: 2.5rem;
          font-weight: 700;
          color: #d4af37;
        }

        .stat-label {
          font-size: 0.875rem;
          color: rgba(212, 175, 55, 0.7);
          margin-top: 0.25rem;
        }

        .form-scroll {
          width: 100%;
          max-width: 400px;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-group label {
          font-size: 0.875rem;
          color: rgba(212, 175, 55, 0.8);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .form-group input[type="text"] {
          width: 100%;
          padding: 1rem;
          font-size: 1.125rem;
          font-family: inherit;
          background: rgba(0, 0, 0, 0.3);
          border: 2px solid rgba(212, 175, 55, 0.3);
          border-radius: 8px;
          color: #f5f5dc;
          outline: none;
          transition: all 0.3s;
        }

        .form-group input[type="text"]:focus {
          border-color: #d4af37;
          box-shadow: 0 0 20px rgba(212, 175, 55, 0.2);
        }

        .form-group input[type="text"].error {
          border-color: #ef4444;
        }

        .error-text {
          color: #ef4444;
          font-size: 0.75rem;
        }

        .avatar-tabs {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .tab {
          flex: 1;
          padding: 0.75rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(212, 175, 55, 0.2);
          border-radius: 8px;
          color: rgba(212, 175, 55, 0.7);
          font-family: inherit;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.3s;
        }

        .tab.active {
          background: rgba(212, 175, 55, 0.2);
          border-color: #d4af37;
          color: #d4af37;
        }

        .emoji-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 0.5rem;
        }

        .emoji-btn {
          aspect-ratio: 1;
          font-size: 1.5rem;
          background: rgba(0, 0, 0, 0.3);
          border: 2px solid transparent;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .emoji-btn:hover {
          transform: scale(1.1);
          background: rgba(212, 175, 55, 0.1);
        }

        .emoji-btn.selected {
          border-color: #d4af37;
          background: rgba(212, 175, 55, 0.2);
          box-shadow: 0 0 15px rgba(212, 175, 55, 0.3);
        }

        .selfie-area {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .camera-view {
          position: relative;
          width: 200px;
          height: 200px;
        }

        .camera-feed {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
          border: 3px solid #d4af37;
        }

        .camera-controls {
          position: absolute;
          bottom: -40px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 1rem;
        }

        .capture-btn, .cancel-btn {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .capture-btn {
          background: #d4af37;
        }

        .cancel-btn {
          background: rgba(255, 255, 255, 0.2);
          color: white;
        }

        .capture-btn:active, .cancel-btn:active {
          transform: scale(0.95);
        }

        .selfie-preview {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }

        .selfie-preview img {
          width: 150px;
          height: 150px;
          border-radius: 50%;
          border: 3px solid #d4af37;
          object-fit: cover;
        }

        .retake-btn {
          padding: 0.5rem 1rem;
          background: rgba(212, 175, 55, 0.2);
          border: 1px solid rgba(212, 175, 55, 0.5);
          border-radius: 6px;
          color: #d4af37;
          font-family: inherit;
          font-size: 0.875rem;
          cursor: pointer;
        }

        .start-camera-btn {
          padding: 1rem 2rem;
          background: rgba(0, 0, 0, 0.3);
          border: 2px dashed rgba(212, 175, 55, 0.3);
          border-radius: 12px;
          color: rgba(212, 175, 55, 0.7);
          font-family: inherit;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.3s;
        }

        .start-camera-btn:hover {
          border-color: #d4af37;
          color: #d4af37;
        }

        .consent-label {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
          color: rgba(212, 175, 55, 0.7);
          font-size: 0.875rem;
        }

        .consent-label input {
          display: none;
        }

        .checkmark {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(212, 175, 55, 0.5);
          border-radius: 4px;
          position: relative;
          flex-shrink: 0;
        }

        .consent-label input:checked + .checkmark {
          background: #d4af37;
          border-color: #d4af37;
        }

        .consent-label input:checked + .checkmark::after {
          content: '✓';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #0d1f17;
          font-size: 0.75rem;
          font-weight: bold;
        }

        .start-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          width: 100%;
          padding: 1.25rem 2rem;
          margin-top: 1rem;
          font-family: 'Cinzel', 'Crimson Text', Georgia, serif;
          font-size: 1.25rem;
          font-weight: 700;
          color: #0d1f17;
          background: linear-gradient(135deg, #d4af37, #f5d670, #d4af37);
          background-size: 200% 200%;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          box-shadow:
            0 4px 15px rgba(212, 175, 55, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.3);
        }

        .start-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(212, 175, 55, 0.4);
          background-position: 100% 0;
        }

        .start-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .start-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-icon {
          font-size: 1.5rem;
        }

        .loading {
          opacity: 0.7;
        }

        .ready-section {
          text-align: center;
          width: 100%;
          max-width: 400px;
        }

        .ready-text {
          font-family: 'Cinzel', 'Crimson Text', Georgia, serif;
          font-size: 2.5rem;
          font-weight: 700;
          color: #d4af37;
          margin-bottom: 1rem;
          text-shadow: 0 2px 20px rgba(212, 175, 55, 0.5);
        }

        .instructions {
          color: rgba(212, 175, 55, 0.7);
          font-size: 1rem;
          line-height: 1.6;
          margin-bottom: 2rem;
        }
      `}</style>
    </div>
  );
}
