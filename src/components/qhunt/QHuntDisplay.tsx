'use client';

/**
 * QHuntDisplay - Big screen leaderboard display
 *
 * Design: Neon Hunter - Arcade Gaming Vibe
 * - Animated leaderboard
 * - Team scores
 * - Live scan feed
 * - Game status/timer
 */

import React from 'react';
import { QHuntConfig, QHuntPhase, QHUNT_TRANSLATIONS, formatGameTime } from '@/types/qhunt';
import { useQHuntDisplay, useQHuntTimer } from '@/hooks/useQHuntRealtime';
import { QHuntLeaderboard } from './QHuntLeaderboard';
import { QHuntTeamScores } from './QHuntTeamScores';

interface QHuntDisplayProps {
  codeId: string;
  mediaId: string;
  initialConfig: QHuntConfig;
}

export function QHuntDisplay({
  codeId,
  mediaId,
  initialConfig,
}: QHuntDisplayProps) {
  const {
    config,
    liveData,
    leaderboard,
    teamScores,
    recentScans,
    phase,
    stats,
    loading,
    ready,
  } = useQHuntDisplay(codeId, mediaId);

  const activeConfig = config || initialConfig;

  // Timer for game
  const { formattedTime, timeRemaining } = useQHuntTimer(
    liveData?.gameStartedAt || activeConfig.gameStartedAt,
    activeConfig.gameDurationSeconds
  );

  // Determine language
  const lang = activeConfig.language === 'auto' ? 'he' : activeConfig.language;
  const t = QHUNT_TRANSLATIONS[lang];
  const isRTL = lang === 'he';

  const isTeamMode = activeConfig.mode === 'teams' && activeConfig.teams.length > 0;

  // Phase display
  const getPhaseDisplay = (p: QHuntPhase) => {
    const phases: Record<QHuntPhase, { label: string; color: string }> = {
      registration: { label: t.registration, color: '#00d4ff' },
      countdown: { label: t.countdown, color: '#ffaa00' },
      playing: { label: t.playing, color: '#00ff88' },
      finished: { label: t.gameEnded, color: '#ff00aa' },
      results: { label: t.results, color: '#aa55ff' },
    };
    return phases[p] || phases.registration;
  };

  const phaseInfo = getPhaseDisplay(phase);

  return (
    <div
      className="qhunt-display"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        '--qhunt-bg': activeConfig.branding.backgroundColor || '#0a0f1a',
        '--qhunt-primary': activeConfig.branding.primaryColor || '#00d4ff',
        '--qhunt-secondary': activeConfig.branding.secondaryColor || '#ff00aa',
        '--qhunt-success': activeConfig.branding.successColor || '#00ff88',
        '--qhunt-warning': activeConfig.branding.warningColor || '#ffaa00',
      } as React.CSSProperties}
    >
      {/* Background */}
      <div className="display-bg">
        {activeConfig.branding.backgroundImage && (
          <div
            className="bg-image"
            style={{ backgroundImage: `url(${activeConfig.branding.backgroundImage})` }}
          />
        )}
        <div className="bg-grid" />
        <div className="bg-glow glow-1" />
        <div className="bg-glow glow-2" />
      </div>

      {/* Header */}
      <header className="display-header">
        <div className="header-left">
          {activeConfig.branding.eventLogo && (
            <img src={activeConfig.branding.eventLogo} alt="" className="event-logo" />
          )}
          <h1 className="game-title">
            {activeConfig.branding.gameTitle || (lang === 'he' ? 'ציד קודים' : 'Code Hunt')}
          </h1>
        </div>

        <div className="header-center">
          <div className="phase-indicator" style={{ '--phase-color': phaseInfo.color } as React.CSSProperties}>
            <span className="phase-dot" />
            <span className="phase-label">{phaseInfo.label}</span>
          </div>
        </div>

        <div className="header-right">
          {phase === 'playing' && activeConfig.gameDurationSeconds > 0 && (
            <div className={`timer-display ${timeRemaining <= 60 ? 'urgent' : ''}`}>
              <span className="timer-icon">⏱️</span>
              <span className="timer-value">{formattedTime}</span>
            </div>
          )}

          <div className="stats-display">
            <div className="stat-item">
              <span className="stat-value">{stats?.totalPlayers || 0}</span>
              <span className="stat-label">{t.players}</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats?.playersPlaying || 0}</span>
              <span className="stat-label">{t.playing}</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats?.playersFinished || 0}</span>
              <span className="stat-label">{t.finished}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="display-main">
        {/* Leaderboard */}
        <section className="leaderboard-section">
          <h2 className="section-title">{t.leaderboard}</h2>
          <QHuntLeaderboard
            entries={leaderboard}
            lang={lang}
            maxVisible={10}
          />
        </section>

        {/* Team scores (if team mode) */}
        {isTeamMode && (
          <section className="teams-section">
            <h2 className="section-title">{t.teamScores}</h2>
            <QHuntTeamScores
              teams={teamScores}
              lang={lang}
            />
          </section>
        )}

        {/* Recent scans feed */}
        {recentScans.length > 0 && (
          <aside className="scans-feed">
            <h3 className="feed-title">
              {lang === 'he' ? 'סריקות אחרונות' : 'Recent Scans'}
            </h3>
            <div className="feed-list">
              {recentScans.slice(0, 5).map((scan, index) => (
                <div
                  key={scan.id}
                  className="feed-item"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <span className="feed-avatar">{scan.avatarValue}</span>
                  <span className="feed-name">{scan.playerName}</span>
                  <span className="feed-points">+{scan.points}</span>
                </div>
              ))}
            </div>
          </aside>
        )}
      </main>

      <style jsx>{`
        .qhunt-display {
          min-height: 100vh;
          background: var(--qhunt-bg);
          font-family: 'Assistant', sans-serif;
          color: #fff;
          position: relative;
          overflow: hidden;
        }

        /* Background effects */
        .display-bg {
          position: fixed;
          inset: 0;
          z-index: 0;
        }

        .bg-image {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          opacity: 0.3;
        }

        .bg-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(var(--qhunt-primary)08 1px, transparent 1px),
            linear-gradient(90deg, var(--qhunt-primary)08 1px, transparent 1px);
          background-size: 80px 80px;
          animation: gridMove 30s linear infinite;
        }

        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(80px, 80px); }
        }

        .bg-glow {
          position: absolute;
          border-radius: 50%;
          filter: blur(150px);
          opacity: 0.4;
          animation: glowPulse 8s ease-in-out infinite;
        }

        .glow-1 {
          width: 600px;
          height: 600px;
          background: var(--qhunt-primary);
          top: -200px;
          left: -200px;
        }

        .glow-2 {
          width: 500px;
          height: 500px;
          background: var(--qhunt-secondary);
          bottom: -200px;
          right: -200px;
          animation-delay: -4s;
        }

        @keyframes glowPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.1); }
        }

        /* Header */
        .display-header {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px 40px;
          background: linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 100%);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .event-logo {
          height: 60px;
          width: auto;
        }

        .game-title {
          font-size: 2.5rem;
          font-weight: 800;
          margin: 0;
          text-shadow: 0 0 30px var(--qhunt-primary);
        }

        .header-center {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
        }

        .phase-indicator {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 24px;
          background: var(--phase-color)20;
          border: 2px solid var(--phase-color);
          border-radius: 30px;
        }

        .phase-dot {
          width: 12px;
          height: 12px;
          background: var(--phase-color);
          border-radius: 50%;
          animation: phasePulse 1s ease-in-out infinite;
        }

        @keyframes phasePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .phase-label {
          font-size: 1.2rem;
          font-weight: 700;
          color: var(--phase-color);
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 32px;
        }

        .timer-display {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 24px;
          background: #ffffff10;
          border-radius: 16px;
        }

        .timer-display.urgent {
          background: #ff446620;
          animation: timerPulse 0.5s ease-in-out infinite;
        }

        @keyframes timerPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }

        .timer-icon {
          font-size: 1.5rem;
        }

        .timer-value {
          font-size: 1.8rem;
          font-weight: 800;
          font-family: 'Courier New', monospace;
        }

        .stats-display {
          display: flex;
          gap: 24px;
        }

        .stat-item {
          text-align: center;
        }

        .stat-value {
          display: block;
          font-size: 1.8rem;
          font-weight: 800;
          color: var(--qhunt-primary);
        }

        .stat-label {
          font-size: 0.8rem;
          color: #ffffff60;
          text-transform: uppercase;
        }

        /* Main content */
        .display-main {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: ${isTeamMode ? '1fr 1fr' : '1fr'};
          gap: 40px;
          padding: 24px 40px;
          min-height: calc(100vh - 120px);
        }

        .section-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #ffffff80;
          margin: 0 0 20px;
          text-transform: uppercase;
          letter-spacing: 2px;
        }

        /* Scans feed */
        .scans-feed {
          position: fixed;
          bottom: 24px;
          right: 40px;
          width: 280px;
          background: #ffffff10;
          border: 1px solid #ffffff20;
          border-radius: 16px;
          padding: 16px;
          backdrop-filter: blur(10px);
        }

        .feed-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: #ffffff60;
          margin: 0 0 12px;
          text-transform: uppercase;
        }

        .feed-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .feed-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          background: #ffffff08;
          border-radius: 10px;
          animation: feedSlide 0.3s ease-out backwards;
        }

        @keyframes feedSlide {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
        }

        .feed-avatar {
          font-size: 1.3rem;
        }

        .feed-name {
          flex: 1;
          font-size: 0.9rem;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .feed-points {
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--qhunt-success);
        }
      `}</style>
    </div>
  );
}
