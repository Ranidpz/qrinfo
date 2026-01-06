'use client';

/**
 * QTreasureComplete - Victory celebration screen
 *
 * Design: Ancient scroll revealing victory, golden confetti,
 * treasure chest unlocking animation
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  QTreasureConfig,
  QTreasurePlayer,
  QTreasureLeaderboardEntry,
  formatTreasureDuration,
} from '@/types/qtreasure';
import { QTreasureLeaderboard } from './QTreasureLeaderboard';

interface QTreasureCompleteProps {
  config: QTreasureConfig;
  player: QTreasurePlayer;
  leaderboard: QTreasureLeaderboardEntry[];
  lang: 'he' | 'en';
  onPlayAgain?: () => void;
}

const translations = {
  he: {
    congratulations: 'כל הכבוד!',
    questComplete: 'השלמתם את המסע!',
    totalTime: 'זמן כולל',
    stationsCompleted: 'תחנות שהושלמו',
    xpEarned: 'נקודות ניסיון',
    yourRank: 'הדירוג שלכם',
    stationTimes: 'זמני תחנות',
    station: 'תחנה',
    leaderboard: 'טבלת האלופים',
    playAgain: 'שחקו שוב',
    share: 'שתפו',
  },
  en: {
    congratulations: 'Congratulations!',
    questComplete: 'Quest Complete!',
    totalTime: 'Total Time',
    stationsCompleted: 'Stations Completed',
    xpEarned: 'XP Earned',
    yourRank: 'Your Rank',
    stationTimes: 'Station Times',
    station: 'Station',
    leaderboard: 'Leaderboard',
    playAgain: 'Play Again',
    share: 'Share',
  },
};

// Confetti particle
interface Particle {
  id: number;
  x: number;
  y: number;
  rotation: number;
  color: string;
  size: number;
  speed: number;
  wobble: number;
}

export function QTreasureComplete({
  config,
  player,
  leaderboard,
  lang,
  onPlayAgain,
}: QTreasureCompleteProps) {
  const t = translations[lang];
  const isRTL = lang === 'he';
  const branding = config.branding;

  const [showContent, setShowContent] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Get player's rank
  const playerRank = leaderboard.find(e => e.playerId === player.id)?.rank || 0;

  // Confetti colors
  const confettiColors = ['#d4af37', '#f5d670', '#c9a227', '#e6c35c', '#a08520', '#ffeaa7'];

  // Generate confetti
  const createConfetti = useCallback(() => {
    if (!config.completion.showConfetti) return;

    const newParticles: Particle[] = [];
    for (let i = 0; i < 100; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * 100,
        y: -10 - Math.random() * 20,
        rotation: Math.random() * 360,
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
        size: 8 + Math.random() * 8,
        speed: 2 + Math.random() * 3,
        wobble: Math.random() * 10,
      });
    }
    setParticles(newParticles);
  }, [config.completion.showConfetti]);

  // Animation timeline
  useEffect(() => {
    // Start confetti immediately
    createConfetti();

    // Show content after brief delay
    const contentTimer = setTimeout(() => {
      setShowContent(true);
    }, 500);

    return () => clearTimeout(contentTimer);
  }, [createConfetti]);

  // Play victory sound
  useEffect(() => {
    if (showContent) {
      try {
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const playTone = (freq: number, delay: number, duration: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.value = freq;
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.2, ctx.currentTime + delay);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + duration);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + delay);
          osc.stop(ctx.currentTime + delay + duration);
        };
        // Victory fanfare
        playTone(523.25, 0, 0.15);
        playTone(659.25, 0.15, 0.15);
        playTone(783.99, 0.3, 0.15);
        playTone(1046.50, 0.45, 0.4);
      } catch {
        // Audio not supported
      }
    }
  }, [showContent]);

  // Get station times with names
  const stationTimesData = config.stations
    .filter(s => s.isActive)
    .map(station => ({
      station,
      time: player.stationTimes[station.id] || 0,
    }));

  // Custom message
  const customMessage = lang === 'en' && config.completion.customMessageEn
    ? config.completion.customMessageEn
    : config.completion.customMessage;

  return (
    <div
      className="complete-container"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        '--primary': branding.primaryColor,
        '--accent': branding.accentColor,
        '--success': branding.successColor,
        '--bg': branding.backgroundColor,
      } as React.CSSProperties}
    >
      {/* Confetti */}
      {config.completion.showConfetti && (
        <div className="confetti-container">
          {particles.map(p => (
            <div
              key={p.id}
              className="confetti"
              style={{
                left: `${p.x}%`,
                backgroundColor: p.color,
                width: p.size,
                height: p.size * 0.4,
                animationDuration: `${p.speed}s`,
                animationDelay: `${p.wobble * 0.1}s`,
                transform: `rotate(${p.rotation}deg)`,
              }}
            />
          ))}
        </div>
      )}

      {/* Background effects */}
      <div className="bg-glow" />
      <div className="radial-burst" />

      {/* Trophy/Chest animation */}
      <div className={`trophy-container ${showContent ? 'revealed' : ''}`}>
        <div className="trophy-glow" />
        <div className="trophy">🏆</div>
        <div className="sparkles">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="sparkle" style={{ '--i': i } as React.CSSProperties} />
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className={`content ${showContent ? 'visible' : ''}`}>
        {/* Header */}
        <div className="header">
          <h1 className="title">{t.congratulations}</h1>
          <p className="subtitle">{t.questComplete}</p>
          {customMessage && (
            <p className="custom-message">{customMessage}</p>
          )}
        </div>

        {/* Stats grid */}
        <div className="stats-grid">
          {/* Total Time */}
          {config.completion.showTotalTime && player.totalTimeMs && (
            <div className="stat-card primary">
              <div className="stat-icon">⏱️</div>
              <div className="stat-value">{formatTreasureDuration(player.totalTimeMs)}</div>
              <div className="stat-label">{t.totalTime}</div>
            </div>
          )}

          {/* Rank */}
          {config.completion.showLeaderboard && playerRank > 0 && (
            <div className="stat-card gold">
              <div className="stat-icon">
                {playerRank === 1 ? '🥇' : playerRank === 2 ? '🥈' : playerRank === 3 ? '🥉' : '🏅'}
              </div>
              <div className="stat-value">#{playerRank}</div>
              <div className="stat-label">{t.yourRank}</div>
            </div>
          )}

          {/* Stations */}
          <div className="stat-card">
            <div className="stat-icon">📍</div>
            <div className="stat-value">
              {player.completedStations.length}/{config.stations.filter(s => s.isActive).length}
            </div>
            <div className="stat-label">{t.stationsCompleted}</div>
          </div>

          {/* XP */}
          <div className="stat-card">
            <div className="stat-icon">⭐</div>
            <div className="stat-value">{player.totalXP}</div>
            <div className="stat-label">{t.xpEarned}</div>
          </div>
        </div>

        {/* Station times breakdown */}
        {config.completion.showStationTimes && stationTimesData.length > 0 && (
          <div className="station-times">
            <h3 className="section-title">{t.stationTimes}</h3>
            <div className="times-list">
              {stationTimesData.map(({ station, time }, index) => (
                <div key={station.id} className="time-row">
                  <span className="station-num">{t.station} {index + 1}</span>
                  <span className="station-name">
                    {lang === 'en' && station.titleEn ? station.titleEn : station.title}
                  </span>
                  <span className="station-time">
                    {time > 0 ? formatTreasureDuration(time) : '--:--'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Leaderboard toggle */}
        {config.completion.showLeaderboard && leaderboard.length > 0 && (
          <div className="leaderboard-section">
            <button
              className="leaderboard-toggle"
              onClick={() => setShowLeaderboard(!showLeaderboard)}
            >
              {t.leaderboard}
              <span className={`arrow ${showLeaderboard ? 'open' : ''}`}>▼</span>
            </button>
            {showLeaderboard && (
              <QTreasureLeaderboard
                entries={leaderboard}
                currentPlayerId={player.id}
                lang={lang}
                compact
              />
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="actions">
          {onPlayAgain && (
            <button className="btn-primary" onClick={onPlayAgain}>
              {t.playAgain}
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .complete-container {
          min-height: 100vh;
          min-height: 100dvh;
          background: linear-gradient(180deg, #0d1f17 0%, #0a1810 50%, #071210 100%);
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 2rem 1rem;
        }

        /* Confetti */
        .confetti-container {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 100;
          overflow: hidden;
        }

        .confetti {
          position: absolute;
          border-radius: 2px;
          animation: confettiFall linear forwards;
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

        /* Background effects */
        .bg-glow {
          position: absolute;
          top: -50%;
          left: 50%;
          transform: translateX(-50%);
          width: 150%;
          height: 100%;
          background: radial-gradient(ellipse at center, rgba(212, 175, 55, 0.15) 0%, transparent 60%);
          pointer-events: none;
        }

        .radial-burst {
          position: absolute;
          top: 10%;
          left: 50%;
          transform: translateX(-50%);
          width: 400px;
          height: 400px;
          background: conic-gradient(from 0deg, transparent, rgba(212, 175, 55, 0.1), transparent 30%);
          animation: rotate 20s linear infinite;
          pointer-events: none;
        }

        @keyframes rotate {
          to { transform: translateX(-50%) rotate(360deg); }
        }

        /* Trophy */
        .trophy-container {
          position: relative;
          width: 150px;
          height: 150px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 2rem;
          transform: scale(0);
          transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .trophy-container.revealed {
          transform: scale(1);
        }

        .trophy-glow {
          position: absolute;
          inset: -20%;
          background: radial-gradient(circle, rgba(212, 175, 55, 0.4) 0%, transparent 70%);
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.2); opacity: 0.8; }
        }

        .trophy {
          font-size: 5rem;
          filter: drop-shadow(0 0 20px rgba(212, 175, 55, 0.6));
          animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .sparkles {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .sparkle {
          position: absolute;
          width: 6px;
          height: 6px;
          background: #d4af37;
          border-radius: 50%;
          top: 50%;
          left: 50%;
          animation: sparkle 1.5s ease-in-out infinite;
          animation-delay: calc(var(--i) * 0.2s);
        }

        @keyframes sparkle {
          0%, 100% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0;
          }
          50% {
            transform: translate(
              calc(-50% + cos(calc(var(--i) * 45deg)) * 60px),
              calc(-50% + sin(calc(var(--i) * 45deg)) * 60px)
            ) scale(1);
            opacity: 1;
          }
        }

        /* Content */
        .content {
          width: 100%;
          max-width: 500px;
          opacity: 0;
          transform: translateY(30px);
          transition: all 0.6s ease-out 0.3s;
        }

        .content.visible {
          opacity: 1;
          transform: translateY(0);
        }

        /* Header */
        .header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .title {
          font-family: 'Cinzel', 'Crimson Text', Georgia, serif;
          font-size: 2.5rem;
          font-weight: 700;
          color: #d4af37;
          margin: 0 0 0.5rem;
          text-shadow: 0 0 30px rgba(212, 175, 55, 0.5);
        }

        .subtitle {
          font-size: 1.25rem;
          color: #f5f5dc;
          margin: 0;
          opacity: 0.9;
        }

        .custom-message {
          margin-top: 1rem;
          padding: 1rem;
          background: rgba(212, 175, 55, 0.1);
          border: 1px solid rgba(212, 175, 55, 0.2);
          border-radius: 12px;
          color: #f5f5dc;
          font-style: italic;
        }

        /* Stats grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          background: linear-gradient(135deg, rgba(26, 45, 35, 0.9), rgba(13, 31, 23, 0.9));
          border: 1px solid rgba(212, 175, 55, 0.2);
          border-radius: 16px;
          padding: 1.25rem;
          text-align: center;
          transition: all 0.3s ease;
        }

        .stat-card:hover {
          transform: translateY(-2px);
          border-color: rgba(212, 175, 55, 0.4);
        }

        .stat-card.primary {
          grid-column: span 2;
          background: linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(26, 45, 35, 0.9));
          border-color: rgba(212, 175, 55, 0.3);
        }

        .stat-card.gold {
          background: linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(26, 45, 35, 0.9));
          border-color: #d4af37;
          box-shadow: 0 0 20px rgba(212, 175, 55, 0.2);
        }

        .stat-icon {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }

        .stat-value {
          font-family: 'Cinzel', 'Crimson Text', Georgia, serif;
          font-size: 1.75rem;
          font-weight: 700;
          color: #d4af37;
        }

        .stat-card.primary .stat-value {
          font-size: 2.25rem;
        }

        .stat-label {
          font-size: 0.875rem;
          color: rgba(245, 245, 220, 0.7);
          margin-top: 0.25rem;
        }

        /* Station times */
        .station-times {
          background: rgba(26, 45, 35, 0.6);
          border: 1px solid rgba(212, 175, 55, 0.15);
          border-radius: 16px;
          padding: 1.25rem;
          margin-bottom: 1.5rem;
        }

        .section-title {
          font-family: 'Cinzel', 'Crimson Text', Georgia, serif;
          font-size: 1rem;
          color: #d4af37;
          margin: 0 0 1rem;
          text-align: center;
        }

        .times-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .time-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 0;
          border-bottom: 1px solid rgba(212, 175, 55, 0.1);
        }

        .time-row:last-child {
          border-bottom: none;
        }

        .station-num {
          font-size: 0.75rem;
          color: rgba(245, 245, 220, 0.5);
          min-width: 60px;
        }

        .station-name {
          flex: 1;
          color: #f5f5dc;
          font-size: 0.9rem;
        }

        .station-time {
          font-family: 'Cinzel', monospace;
          font-size: 0.9rem;
          color: #d4af37;
        }

        /* Leaderboard section */
        .leaderboard-section {
          margin-bottom: 2rem;
        }

        .leaderboard-toggle {
          width: 100%;
          padding: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          background: rgba(26, 45, 35, 0.6);
          border: 1px solid rgba(212, 175, 55, 0.2);
          border-radius: 12px;
          color: #d4af37;
          font-family: 'Cinzel', 'Crimson Text', Georgia, serif;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .leaderboard-toggle:hover {
          background: rgba(212, 175, 55, 0.1);
        }

        .arrow {
          font-size: 0.75rem;
          transition: transform 0.3s;
        }

        .arrow.open {
          transform: rotate(180deg);
        }

        /* Actions */
        .actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }

        .btn-primary {
          flex: 1;
          max-width: 200px;
          padding: 1rem 2rem;
          font-family: 'Cinzel', 'Crimson Text', Georgia, serif;
          font-size: 1rem;
          font-weight: 600;
          color: #0d1f17;
          background: linear-gradient(135deg, #d4af37, #f5d670);
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 4px 20px rgba(212, 175, 55, 0.3);
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 30px rgba(212, 175, 55, 0.4);
        }

        .btn-primary:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}
