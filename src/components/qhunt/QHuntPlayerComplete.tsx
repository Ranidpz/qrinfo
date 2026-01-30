'use client';

/**
 * QHuntPlayerComplete - Game finished screen with score, time, and rank
 *
 * Design: Neon Hunter - Arcade Gaming Vibe
 * - Celebration animation
 * - Big score display
 * - Scan history
 * - Tap anywhere to try again
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  QHuntConfig,
  QHuntPlayer,
  QHuntScan,
  QHUNT_TRANSLATIONS,
  formatGameDuration,
} from '@/types/qhunt';
import { useQHuntLeaderboard } from '@/hooks/useQHuntRealtime';

// Animated number component
function AnimatedNumber({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = Math.floor(easeOutQuart * value);

      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  return <>{displayValue}</>;
}

interface QHuntPlayerCompleteProps {
  codeId: string;
  player: QHuntPlayer;
  scans: QHuntScan[];
  config: QHuntConfig;
  lang: 'he' | 'en';
  onTryAgain?: () => void;
}

export function QHuntPlayerComplete({
  codeId,
  player,
  scans,
  config,
  lang,
  onTryAgain,
}: QHuntPlayerCompleteProps) {
  const t = QHUNT_TRANSLATIONS[lang];
  const { leaderboard } = useQHuntLeaderboard(codeId);
  const [showConfetti, setShowConfetti] = useState(true);
  const [showTryAgainModal, setShowTryAgainModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Find player's rank - fallback to calculating from leaderboard position
  const leaderboardEntry = leaderboard.find(e => e.playerId === player.id);
  const leaderboardIndex = leaderboard.findIndex(e => e.playerId === player.id);
  // Use rank from entry, or calculate from position (if found, index >= 0)
  const playerRank = leaderboardEntry?.rank ||
    (leaderboardIndex >= 0 ? leaderboardIndex + 1 : null);

  // Calculate game time
  const gameTime = player.gameEndedAt && player.gameStartedAt
    ? player.gameEndedAt - player.gameStartedAt
    : 0;

  // Sort scans by time
  const sortedScans = [...scans]
    .filter(s => s.isValid)
    .sort((a, b) => a.scannedAt - b.scannedAt);

  useEffect(() => {
    // Hide confetti after animation
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Handle screen tap
  const handleScreenTap = () => {
    if (onTryAgain && !showTryAgainModal) {
      setShowTryAgainModal(true);
    }
  };

  // Handle confirm try again
  const handleConfirmTryAgain = () => {
    setShowTryAgainModal(false);
    onTryAgain?.();
  };

  return (
    <div className="qhunt-complete" onClick={handleScreenTap}>
      {/* Try Again Modal */}
      {showTryAgainModal && (
        <div className="try-again-modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="try-again-modal">
            <div className="modal-icon">🚀</div>
            <h3 className="modal-title">
              {lang === 'he' ? 'רוצים לשפר את התוצאה?' : 'Want to beat your score?'}
            </h3>
            <p className="modal-text">
              {lang === 'he'
                ? 'הרשמו שוב ונסו להגיע למקום גבוה יותר בטבלה!'
                : 'Register again and climb higher on the leaderboard!'}
            </p>
            <div className="modal-stats">
              <div className="modal-stat">
                <span className="modal-stat-value">{player.currentScore}</span>
                <span className="modal-stat-label">{lang === 'he' ? 'נקודות' : 'points'}</span>
              </div>
              <div className="modal-stat">
                <span className="modal-stat-value">
                  {playerRank ? `#${playerRank}` : '#—'}
                </span>
                <span className="modal-stat-label">{lang === 'he' ? 'דירוג' : 'rank'}</span>
              </div>
            </div>
            <div className="modal-buttons">
              <button
                className="modal-btn modal-btn-cancel"
                onClick={() => setShowTryAgainModal(false)}
              >
                {lang === 'he' ? 'אולי אח״כ' : 'Maybe later'}
              </button>
              <button
                className="modal-btn modal-btn-confirm"
                onClick={handleConfirmTryAgain}
              >
                {lang === 'he' ? 'יאללה!' : "Let's go!"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confetti effect */}
      {showConfetti && (
        <div className="confetti-container">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="confetti"
              style={{
                '--x': `${Math.random() * 100}%`,
                '--delay': `${Math.random() * 2}s`,
                '--duration': `${2 + Math.random() * 2}s`,
                '--color': ['#00d4ff', '#ff00aa', '#00ff88', '#ffaa00'][Math.floor(Math.random() * 4)],
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}

      {/* Header */}
      <div className="complete-header">
        <div className="trophy-icon">🏆</div>
        <h1 className="complete-title">{t.gameComplete}</h1>
      </div>

      {/* Score card */}
      <div className="score-card">
        <div className={`player-avatar ${player.avatarType === 'selfie' ? 'photo-avatar' : ''}`}>
          {player.avatarType === 'selfie' && player.avatarValue ? (
            <img
              src={player.avatarValue}
              alt=""
              className="avatar-img"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.textContent = '🎮';
                  parent.classList.remove('photo-avatar');
                }
              }}
            />
          ) : (
            player.avatarValue || '🎮'
          )}
        </div>
        <div className="player-name">{player.name}</div>

        <div className="score-display">
          <span className="score-value">{player.currentScore}</span>
          <span className="score-label">{lang === 'he' ? 'נקודות' : 'points'}</span>
        </div>

        <div className="stats-row">
          <div className="stat">
            <span className="stat-value">{player.scansCount}</span>
            <span className="stat-label">{t.codesFound}</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-value">{formatGameDuration(gameTime)}</span>
            <span className="stat-label">{t.totalTime}</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-value rank">
              {playerRank ? `#${playerRank}` : (leaderboard.length === 0 ? '...' : '#—')}
            </span>
            <span className="stat-label">{t.rank}</span>
          </div>
        </div>
      </div>

      {/* Scan history */}
      {sortedScans.length > 0 && (
        <div className="scan-history">
          <h3 className="history-title">
            {lang === 'he' ? 'היסטוריית סריקות' : 'Scan History'}
          </h3>
          <div className="history-list">
            {sortedScans.map((scan, index) => {
              const timeSinceStart = player.gameStartedAt
                ? scan.scannedAt - player.gameStartedAt
                : 0;

              return (
                <div key={scan.id} className="history-item">
                  <span className="item-number">#{index + 1}</span>
                  <span className="item-code">{scan.codeValue.toUpperCase()}</span>
                  <span className="item-points">+{scan.points}</span>
                  <span className="item-time">{formatGameDuration(timeSinceStart)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="action-buttons">
        <button
          className="leaderboard-btn"
          onClick={(e) => {
            e.stopPropagation();
            setShowLeaderboard(true);
          }}
        >
          <span className="btn-icon">🏆</span>
          <span>{lang === 'he' ? 'טבלת מובילים' : 'Leaderboard'}</span>
        </button>
        {onTryAgain && (
          <div className="tap-hint">
            <span className="tap-hint-text">
              {lang === 'he' ? 'לחצו לנסות שוב' : 'Tap to try again'}
            </span>
          </div>
        )}
      </div>

      {/* Leaderboard Overlay */}
      {showLeaderboard && (
        <div className="leaderboard-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="leaderboard-container">
            <div className="leaderboard-header">
              <h2 className="leaderboard-title">
                <span className="title-icon">🏆</span>
                {lang === 'he' ? 'טבלת מובילים' : 'Leaderboard'}
              </h2>
              <button
                className="close-btn"
                onClick={() => setShowLeaderboard(false)}
              >
                ✕
              </button>
            </div>
            <div className="leaderboard-list">
              {leaderboard.length === 0 ? (
                <div className="empty-state">
                  {lang === 'he' ? 'אין שחקנים עדיין' : 'No players yet'}
                </div>
              ) : (
                leaderboard.map((entry, index) => {
                  const isCurrentPlayer = entry.playerId === player.id;
                  const isTop3 = entry.rank <= 3;
                  const rankEmoji = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`;

                  return (
                    <div
                      key={entry.playerId}
                      className={`leaderboard-row ${isTop3 ? `top-${entry.rank}` : ''} ${isCurrentPlayer ? 'current-player' : ''}`}
                      style={{ '--row-index': index } as React.CSSProperties}
                    >
                      <div className={`row-avatar ${entry.avatarType === 'selfie' ? 'photo' : ''}`}>
                        {entry.avatarType === 'selfie' && entry.avatarValue?.startsWith('http') ? (
                          <img
                            src={entry.avatarValue}
                            alt=""
                            className="avatar-img"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                parent.textContent = '🎮';
                                parent.classList.remove('photo');
                              }
                            }}
                          />
                        ) : (
                          entry.avatarValue || '🎮'
                        )}
                      </div>
                      <div className="row-info">
                        <span className="row-name">{entry.playerName}</span>
                        {entry.isFinished && entry.gameTime && (
                          <span className="row-time">{formatGameDuration(entry.gameTime)}</span>
                        )}
                      </div>
                      <div className="row-score-area">
                        <span className="row-rank">{rankEmoji}</span>
                        <span className="row-score">
                          <AnimatedNumber value={entry.score} duration={800} />
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .qhunt-complete {
          min-height: 100vh;
          min-height: 100dvh;
          padding: 24px 16px;
          padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
          display: flex;
          flex-direction: column;
          position: relative;
          overflow-x: hidden;
          overflow-y: auto;
          cursor: pointer;
        }

        /* Confetti */
        .confetti-container {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 10;
        }

        .confetti {
          position: absolute;
          top: -20px;
          left: var(--x);
          width: 10px;
          height: 10px;
          background: var(--color);
          border-radius: 50%;
          animation: confettiFall var(--duration) ease-out var(--delay) forwards;
        }

        @keyframes confettiFall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }

        /* Header */
        .complete-header {
          text-align: center;
          margin-bottom: 24px;
          animation: bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        @keyframes bounceIn {
          0% { transform: scale(0); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }

        .trophy-icon {
          font-size: 4rem;
          margin-bottom: 8px;
          animation: trophyPulse 2s ease-in-out infinite;
        }

        @keyframes trophyPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        .complete-title {
          font-size: 2rem;
          font-weight: 800;
          color: var(--qhunt-success);
          margin: 0;
          text-shadow: 0 0 20px var(--qhunt-success);
        }

        /* Score card */
        .score-card {
          background: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
          border: 2px solid color-mix(in srgb, var(--qhunt-primary) 30%, transparent);
          border-radius: 24px;
          padding: 24px;
          text-align: center;
          margin-bottom: 24px;
          animation: slideUp 0.5s ease-out 0.2s backwards;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
        }

        .player-avatar {
          font-size: 3rem;
          margin-bottom: 8px;
          width: 80px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-left: auto;
          margin-right: auto;
        }

        .player-avatar.photo-avatar {
          border-radius: 50%;
          overflow: hidden;
          border: 3px solid var(--qhunt-primary);
          box-shadow: 0 0 20px color-mix(in srgb, var(--qhunt-primary) 30%, transparent);
        }

        .player-avatar .avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .player-name {
          font-size: 1.3rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 16px;
        }

        .score-display {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 20px;
        }

        .score-value {
          font-size: 4rem;
          font-weight: 800;
          color: var(--qhunt-primary);
          text-shadow: 0 0 30px var(--qhunt-primary);
          line-height: 1;
          animation: scoreCount 1s ease-out;
        }

        @keyframes scoreCount {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }

        .score-label {
          font-size: 1rem;
          color: #ffffff80;
          text-transform: uppercase;
          letter-spacing: 2px;
        }

        .stats-row {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 16px;
        }

        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .stat-value {
          font-size: 1.3rem;
          font-weight: 700;
          color: #fff;
        }

        .stat-value.rank {
          color: var(--qhunt-warning);
        }

        .stat-label {
          font-size: 0.75rem;
          color: #ffffff60;
          text-transform: uppercase;
        }

        .stat-divider {
          width: 1px;
          height: 30px;
          background: #ffffff20;
        }

        /* Scan history */
        .scan-history {
          flex: 1;
          animation: slideUp 0.5s ease-out 0.4s backwards;
        }

        .history-title {
          font-size: 1rem;
          font-weight: 600;
          color: #ffffff80;
          margin: 0 0 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .history-list {
          background: #ffffff08;
          border-radius: 16px;
          overflow: hidden;
        }

        .history-item {
          display: grid;
          grid-template-columns: 40px 1fr auto auto;
          gap: 12px;
          padding: 12px 16px;
          align-items: center;
          border-bottom: 1px solid #ffffff10;
        }

        .history-item:last-child {
          border-bottom: none;
        }

        .item-number {
          font-size: 0.85rem;
          color: #ffffff40;
          font-weight: 600;
        }

        .item-code {
          font-family: 'Courier New', monospace;
          font-size: 0.9rem;
          color: #fff;
          font-weight: 600;
        }

        .item-points {
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--qhunt-success);
        }

        .item-time {
          font-size: 0.8rem;
          color: #ffffff60;
          font-family: 'Courier New', monospace;
        }

        /* Try Again Modal */
        .try-again-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(12px);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeIn 0.25s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .try-again-modal {
          background: linear-gradient(145deg, #1a2035, #0d1220);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 28px 24px;
          max-width: 340px;
          width: 100%;
          text-align: center;
          animation: modalSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow:
            0 20px 60px rgba(0, 0, 0, 0.5),
            0 0 40px color-mix(in srgb, var(--qhunt-primary) 15%, transparent),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }

        @keyframes modalSlideUp {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .modal-icon {
          font-size: 3.5rem;
          margin-bottom: 12px;
          animation: rocketBounce 1s ease-in-out infinite;
        }

        @keyframes rocketBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        .modal-title {
          font-size: 1.4rem;
          font-weight: 800;
          color: #fff;
          margin: 0 0 8px;
          text-shadow: 0 0 20px color-mix(in srgb, var(--qhunt-primary) 40%, transparent);
        }

        .modal-text {
          font-size: 0.95rem;
          color: rgba(255, 255, 255, 0.7);
          margin: 0 0 16px;
          line-height: 1.5;
        }

        .modal-stats {
          display: flex;
          justify-content: center;
          gap: 24px;
          margin-bottom: 20px;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
        }

        .modal-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .modal-stat-value {
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--qhunt-primary);
          text-shadow: 0 0 15px var(--qhunt-primary);
        }

        .modal-stat-label {
          font-size: 0.7rem;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .modal-buttons {
          display: flex;
          gap: 12px;
        }

        .modal-btn {
          flex: 1;
          padding: 14px 16px;
          font-size: 0.95rem;
          font-weight: 700;
          font-family: 'Assistant', sans-serif;
          border: none;
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .modal-btn-cancel {
          background: rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .modal-btn-cancel:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
        }

        .modal-btn-confirm {
          background: linear-gradient(135deg, var(--qhunt-secondary), var(--qhunt-primary));
          color: #fff;
          box-shadow: 0 4px 20px color-mix(in srgb, var(--qhunt-primary) 30%, transparent);
        }

        .modal-btn-confirm:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 30px color-mix(in srgb, var(--qhunt-primary) 50%, transparent);
        }

        .modal-btn-confirm:active {
          transform: translateY(0);
        }

        .btn-emoji {
          font-size: 1.1rem;
        }

        /* Action buttons */
        .action-buttons {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          margin-top: auto;
          padding-top: 24px;
        }

        .leaderboard-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 16px 32px;
          font-size: 1.1rem;
          font-weight: 700;
          font-family: 'Assistant', sans-serif;
          color: #fff;
          background: linear-gradient(135deg, var(--qhunt-primary), var(--qhunt-secondary));
          border: none;
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 20px color-mix(in srgb, var(--qhunt-primary) 30%, transparent);
        }

        .leaderboard-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 30px color-mix(in srgb, var(--qhunt-primary) 50%, transparent);
        }

        .leaderboard-btn:active {
          transform: translateY(0);
        }

        .leaderboard-btn .btn-icon {
          font-size: 1.3rem;
        }

        /* Tap hint */
        .tap-hint {
          text-align: center;
          padding: 8px 0;
          flex-shrink: 0;
        }

        .tap-hint-text {
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--qhunt-primary);
          opacity: 0.7;
        }

        /* Leaderboard Overlay */
        .leaderboard-overlay {
          position: fixed;
          inset: 0;
          background: var(--qhunt-bg, #0a0f1a);
          z-index: 200;
          display: flex;
          flex-direction: column;
          animation: slideInFromRight 0.3s ease;
        }

        @keyframes slideInFromRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        .leaderboard-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .leaderboard-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .leaderboard-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 1.4rem;
          font-weight: 800;
          color: #fff;
          margin: 0;
        }

        .title-icon {
          font-size: 1.5rem;
        }

        .close-btn {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
          color: rgba(255,255,255,0.7);
          background: rgba(255,255,255,0.1);
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .close-btn:hover {
          background: rgba(255,255,255,0.15);
          color: #fff;
        }

        .leaderboard-list {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .empty-state {
          text-align: center;
          padding: 40px;
          color: rgba(255,255,255,0.5);
          font-size: 1.1rem;
        }

        .leaderboard-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          background: rgba(255,255,255,0.05);
          border-radius: 16px;
          transition: all 0.2s ease;
          opacity: 0;
          transform: translateX(30px);
          animation: rowSlideIn 0.4s ease forwards;
          animation-delay: calc(var(--row-index, 0) * 0.08s);
        }

        @keyframes rowSlideIn {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .leaderboard-row.current-player {
          background: linear-gradient(135deg,
            color-mix(in srgb, var(--qhunt-primary) 20%, transparent),
            color-mix(in srgb, var(--qhunt-secondary) 10%, transparent)
          );
          border: 1px solid color-mix(in srgb, var(--qhunt-primary) 40%, transparent);
        }

        .leaderboard-row.top-1 {
          background: linear-gradient(90deg, rgba(255,215,0,0.2), rgba(255,215,0,0.05) 70%, transparent);
        }

        .leaderboard-row.top-2 {
          background: linear-gradient(90deg, rgba(192,192,192,0.15), rgba(192,192,192,0.05) 70%, transparent);
        }

        .leaderboard-row.top-3 {
          background: linear-gradient(90deg, rgba(205,127,50,0.15), rgba(205,127,50,0.05) 70%, transparent);
        }

        .row-avatar {
          width: 56px;
          height: 56px;
          font-size: 1.8rem;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.08);
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.1);
          overflow: hidden;
          flex-shrink: 0;
        }

        .row-avatar .avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .row-avatar.photo {
          border-radius: 50%;
          border: 2px solid var(--qhunt-primary);
          background: rgba(255,255,255,0.05);
        }

        .row-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .row-name {
          font-size: 1.1rem;
          font-weight: 600;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .row-time {
          font-size: 0.8rem;
          color: rgba(255,255,255,0.5);
          font-family: 'Courier New', monospace;
        }

        .row-score-area {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }

        .row-rank {
          font-size: 1rem;
          opacity: 0.8;
        }

        .row-score {
          font-size: 1.4rem;
          font-weight: 800;
          color: var(--qhunt-primary);
          text-shadow: 0 0 15px var(--qhunt-primary);
          min-width: 40px;
          text-align: left;
        }
      `}</style>
    </div>
  );
}
