'use client';

/**
 * QHuntPlayerComplete - Game finished screen with score, time, and rank
 *
 * Design: Neon Hunter - Arcade Gaming Vibe
 * - Celebration animation
 * - Big score display
 * - Scan history
 */

import React, { useEffect, useState } from 'react';
import {
  QHuntConfig,
  QHuntPlayer,
  QHuntScan,
  QHUNT_TRANSLATIONS,
  formatGameDuration,
} from '@/types/qhunt';
import { useQHuntLeaderboard } from '@/hooks/useQHuntRealtime';

interface QHuntPlayerCompleteProps {
  codeId: string;
  player: QHuntPlayer;
  scans: QHuntScan[];
  config: QHuntConfig;
  lang: 'he' | 'en';
}

export function QHuntPlayerComplete({
  codeId,
  player,
  scans,
  config,
  lang,
}: QHuntPlayerCompleteProps) {
  const t = QHUNT_TRANSLATIONS[lang];
  const { leaderboard } = useQHuntLeaderboard(codeId);
  const [showConfetti, setShowConfetti] = useState(true);

  // Find player's rank
  const playerRank = leaderboard.find(e => e.playerId === player.id)?.rank || 0;

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

  return (
    <div className="qhunt-complete">
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
        <div className="player-avatar">{player.avatarValue}</div>
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
            <span className="stat-value rank">#{playerRank || '—'}</span>
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

      {/* Share or view leaderboard hint */}
      <div className="complete-footer">
        <p className="footer-text">
          {lang === 'he'
            ? 'צפו בלוח התוצאות על המסך הגדול!'
            : 'Watch the leaderboard on the big screen!'}
        </p>
      </div>

      <style jsx>{`
        .qhunt-complete {
          min-height: 100vh;
          min-height: 100dvh;
          padding: 24px 16px;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
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
          background: linear-gradient(135deg, #ffffff10, #ffffff05);
          border: 2px solid var(--qhunt-primary)40;
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

        /* Footer */
        .complete-footer {
          text-align: center;
          padding-top: 20px;
          animation: slideUp 0.5s ease-out 0.6s backwards;
        }

        .footer-text {
          margin: 0;
          color: #ffffff60;
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
}
