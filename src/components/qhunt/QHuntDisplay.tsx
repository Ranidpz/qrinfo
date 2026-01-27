'use client';

/**
 * QHuntDisplay - Big screen leaderboard display
 *
 * Design: Premium Neon Display with Real-time Animations
 * - Animated leaderboard with FLIP transitions
 * - Animated counting numbers
 * - Team scores
 * - Live scan feed with particle effects
 * - Game status/timer
 */

import React, { useState, useEffect, useRef } from 'react';
import { QHuntConfig, QHuntPhase, QHUNT_TRANSLATIONS, formatGameDuration } from '@/types/qhunt';
import { useQHuntDisplay, useQHuntTimer, QHuntLeaderboardEntry } from '@/hooks/useQHuntRealtime';
import { QHuntTeamScores } from './QHuntTeamScores';

interface QHuntDisplayProps {
  codeId: string;
  mediaId: string;
  initialConfig: QHuntConfig;
}

// Animated number component - counts from previous to current value
function AnimatedNumber({
  value,
  duration = 800,
  className = '',
  suffix = '',
}: {
  value: number;
  duration?: number;
  className?: string;
  suffix?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const previousValue = useRef(0);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = previousValue.current;
    const endValue = value;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out-expo)
      const easeOut = 1 - Math.pow(2, -10 * progress);
      const current = Math.round(startValue + (endValue - startValue) * easeOut);

      setDisplayValue(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        previousValue.current = endValue;
      }
    };

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  return (
    <span className={className}>
      {displayValue.toLocaleString()}{suffix}
    </span>
  );
}

// Enhanced leaderboard with FLIP animations
function AnimatedLeaderboard({
  entries,
  lang,
  maxVisible = 10,
}: {
  entries: QHuntLeaderboardEntry[];
  lang: 'he' | 'en';
  maxVisible?: number;
}) {
  const [displayEntries, setDisplayEntries] = useState<(QHuntLeaderboardEntry & { animationClass: string; prevRank?: number })[]>([]);
  const prevEntriesMap = useRef<Map<string, { rank: number; score: number }>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const positionsRef = useRef<Map<string, DOMRect>>(new Map());

  // Capture positions before update
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Store current positions
    rowRefs.current.forEach((el, playerId) => {
      if (el) {
        positionsRef.current.set(playerId, el.getBoundingClientRect());
      }
    });
  });

  // Handle entries update with FLIP animation
  useEffect(() => {
    const prevMap = prevEntriesMap.current;

    const newEntries = entries.slice(0, maxVisible).map(entry => {
      const prev = prevMap.get(entry.playerId);
      let animationClass = '';

      if (!prev) {
        animationClass = 'new-entry';
      } else if (prev.rank > entry.rank) {
        animationClass = 'rank-up';
      } else if (prev.rank < entry.rank) {
        animationClass = 'rank-down';
      } else if (prev.score !== entry.score) {
        animationClass = 'score-update';
      }

      return {
        ...entry,
        animationClass,
        prevRank: prev?.rank,
      };
    });

    setDisplayEntries(newEntries);

    // After DOM update, animate from old positions
    requestAnimationFrame(() => {
      newEntries.forEach(entry => {
        const el = rowRefs.current.get(entry.playerId);
        const oldPosition = positionsRef.current.get(entry.playerId);

        if (el && oldPosition) {
          const newPosition = el.getBoundingClientRect();
          const deltaY = oldPosition.top - newPosition.top;

          if (Math.abs(deltaY) > 1) {
            // FLIP animation
            el.style.transform = `translateY(${deltaY}px)`;
            el.style.transition = 'none';

            requestAnimationFrame(() => {
              el.style.transform = '';
              el.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
            });
          }
        }
      });
    });

    // Update ref for next comparison
    const newMap = new Map<string, { rank: number; score: number }>();
    entries.forEach(e => newMap.set(e.playerId, { rank: e.rank, score: e.score }));
    prevEntriesMap.current = newMap;
  }, [entries, maxVisible]);

  const getRankBadge = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `${rank}`;
  };

  if (entries.length === 0) {
    return (
      <div className="leaderboard-empty">
        <div className="empty-icon-container">
          <span className="empty-icon">🎯</span>
          <div className="empty-glow" />
        </div>
        <span className="empty-text">
          {lang === 'he' ? 'ממתינים לשחקנים...' : 'Waiting for players...'}
        </span>

        <style jsx>{`
          .leaderboard-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 24px;
            padding: 80px 40px;
            background: linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
            border-radius: 24px;
            border: 2px dashed rgba(255,255,255,0.15);
          }

          .empty-icon-container {
            position: relative;
          }

          .empty-icon {
            font-size: 4rem;
            opacity: 0.7;
            animation: floatIcon 3s ease-in-out infinite;
          }

          .empty-glow {
            position: absolute;
            inset: -20px;
            background: radial-gradient(circle, var(--qhunt-primary)30, transparent 70%);
            animation: pulseGlow 2s ease-in-out infinite;
          }

          @keyframes floatIcon {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }

          @keyframes pulseGlow {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(1.2); }
          }

          .empty-text {
            font-size: 1.3rem;
            color: rgba(255,255,255,0.5);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="leaderboard" ref={containerRef}>
      <div className="leaderboard-list">
        {displayEntries.map((entry, index) => {
          const isTop3 = entry.rank <= 3;

          return (
            <div
              key={entry.playerId}
              ref={(el) => {
                if (el) rowRefs.current.set(entry.playerId, el);
              }}
              className={`leaderboard-row ${isTop3 ? `top-${entry.rank}` : ''} ${entry.isFinished ? 'finished' : ''} ${entry.animationClass}`}
              style={{
                '--row-index': index,
                '--rank-color': isTop3
                  ? entry.rank === 1 ? '#ffd700' : entry.rank === 2 ? '#c0c0c0' : '#cd7f32'
                  : 'var(--qhunt-primary)',
              } as React.CSSProperties}
            >
              {/* Rank badge */}
              <div className="row-rank">
                <div className="rank-badge-container">
                  <span className="rank-badge">{getRankBadge(entry.rank)}</span>
                  {isTop3 && <div className="rank-glow" />}
                </div>
                {entry.animationClass === 'rank-up' && (
                  <span className="rank-change up">▲</span>
                )}
                {entry.animationClass === 'rank-down' && (
                  <span className="rank-change down">▼</span>
                )}
                {entry.animationClass === 'new-entry' && (
                  <span className="rank-change new">NEW</span>
                )}
              </div>

              {/* Player info */}
              <div className="row-player">
                <div className={`player-avatar ${entry.avatarType === 'selfie' ? 'photo' : ''}`}>
                  {entry.avatarType === 'selfie' && entry.avatarValue?.startsWith('http') ? (
                    <img src={entry.avatarValue} alt="" />
                  ) : (
                    entry.avatarValue || '🎮'
                  )}
                </div>
                <span className="player-name">{entry.playerName}</span>
                {entry.teamColor && (
                  <span
                    className="player-team-dot"
                    style={{ background: entry.teamColor }}
                  />
                )}
              </div>

              {/* Stats */}
              <div className="row-stats">
                <div className="stat-item">
                  <span className="stat-icon">🎯</span>
                  <span className="stat-value">{entry.scansCount}</span>
                </div>
                {entry.isFinished && entry.gameTime && (
                  <div className="stat-item time">
                    <span className="stat-icon">⏱️</span>
                    <span className="stat-value">{formatGameDuration(entry.gameTime)}</span>
                  </div>
                )}
              </div>

              {/* Score */}
              <div className="row-score">
                <AnimatedNumber
                  value={entry.score}
                  className="score-value"
                  duration={600}
                />
              </div>

              {/* Finished badge */}
              {entry.isFinished && (
                <div className="row-status">
                  <span className="status-badge">✓</span>
                </div>
              )}

              {/* Highlight effect for updates */}
              <div className="row-highlight" />
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .leaderboard {
          background: linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
          border-radius: 24px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.1);
          backdrop-filter: blur(20px);
        }

        .leaderboard-list {
          display: flex;
          flex-direction: column;
        }

        .leaderboard-row {
          position: relative;
          display: grid;
          grid-template-columns: 100px 1fr auto 140px 60px;
          gap: 20px;
          align-items: center;
          padding: 20px 32px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          transition: background 0.3s ease;
          animation: rowAppear 0.5s ease-out calc(var(--row-index) * 0.05s) backwards;
        }

        @keyframes rowAppear {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
        }

        .leaderboard-row:last-child {
          border-bottom: none;
        }

        .leaderboard-row.top-1 {
          background: linear-gradient(90deg, rgba(255,215,0,0.15), transparent 60%);
        }

        .leaderboard-row.top-2 {
          background: linear-gradient(90deg, rgba(192,192,192,0.1), transparent 60%);
        }

        .leaderboard-row.top-3 {
          background: linear-gradient(90deg, rgba(205,127,50,0.1), transparent 60%);
        }

        /* Animation classes */
        .leaderboard-row.new-entry {
          animation: newEntry 0.6s ease-out;
        }

        .leaderboard-row.rank-up .row-highlight {
          animation: highlightUp 1s ease-out;
        }

        .leaderboard-row.rank-down .row-highlight {
          animation: highlightDown 1s ease-out;
        }

        .leaderboard-row.score-update .row-highlight {
          animation: highlightScore 0.8s ease-out;
        }

        .row-highlight {
          position: absolute;
          inset: 0;
          pointer-events: none;
          border-radius: 4px;
        }

        @keyframes newEntry {
          0% { opacity: 0; transform: translateX(-100px) scale(0.9); }
          50% { transform: translateX(10px) scale(1.02); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }

        @keyframes highlightUp {
          0% { background: rgba(0,255,136,0.3); }
          100% { background: transparent; }
        }

        @keyframes highlightDown {
          0% { background: rgba(255,68,102,0.2); }
          100% { background: transparent; }
        }

        @keyframes highlightScore {
          0% { background: rgba(0,212,255,0.2); }
          100% { background: transparent; }
        }

        /* Rank */
        .row-rank {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .rank-badge-container {
          position: relative;
        }

        .rank-badge {
          font-size: 1.6rem;
          font-weight: 800;
          color: var(--rank-color);
          text-shadow: 0 0 10px var(--rank-color);
        }

        .rank-glow {
          position: absolute;
          inset: -10px;
          background: radial-gradient(circle, var(--rank-color)40, transparent 70%);
          animation: rankGlow 2s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes rankGlow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        .rank-change {
          font-size: 0.75rem;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 6px;
        }

        .rank-change.up {
          color: var(--qhunt-success);
          animation: bounceUp 0.4s ease-out;
        }

        .rank-change.down {
          color: #ff4466;
          animation: bounceDown 0.4s ease-out;
        }

        .rank-change.new {
          background: linear-gradient(135deg, var(--qhunt-primary), var(--qhunt-secondary));
          color: #000;
          font-weight: 800;
          animation: popIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        @keyframes bounceUp {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        @keyframes bounceDown {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(8px); }
        }

        @keyframes popIn {
          0% { transform: scale(0) rotate(-10deg); }
          100% { transform: scale(1) rotate(0deg); }
        }

        /* Player */
        .row-player {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .player-avatar {
          width: 52px;
          height: 52px;
          font-size: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
          border-radius: 14px;
          border: 2px solid rgba(255,255,255,0.15);
          overflow: hidden;
        }

        .player-avatar.photo {
          padding: 0;
        }

        .player-avatar :global(img) {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .player-name {
          font-size: 1.2rem;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 200px;
        }

        .player-team-dot {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          flex-shrink: 0;
          box-shadow: 0 0 10px currentColor;
        }

        /* Stats */
        .row-stats {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: rgba(255,255,255,0.05);
          border-radius: 10px;
        }

        .stat-icon {
          font-size: 1rem;
        }

        .stat-item .stat-value {
          font-size: 1rem;
          font-weight: 600;
          color: rgba(255,255,255,0.8);
        }

        .stat-item.time .stat-value {
          font-family: 'SF Mono', 'Courier New', monospace;
        }

        /* Score */
        .row-score {
          text-align: right;
        }

        .row-score :global(.score-value) {
          font-size: 1.8rem;
          font-weight: 800;
          color: var(--rank-color);
          text-shadow: 0 0 20px var(--rank-color);
        }

        /* Status */
        .row-status {
          text-align: center;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, var(--qhunt-success), #00cc6a);
          border-radius: 50%;
          font-size: 1.1rem;
          color: #000;
          box-shadow: 0 0 20px var(--qhunt-success);
        }
      `}</style>
    </div>
  );
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
    const phases: Record<QHuntPhase, { label: string; color: string; icon: string }> = {
      registration: { label: t.registration, color: '#00d4ff', icon: '📝' },
      countdown: { label: t.countdown, color: '#ffaa00', icon: '⏳' },
      playing: { label: t.playing, color: '#00ff88', icon: '🎮' },
      finished: { label: t.gameEnded, color: '#ff00aa', icon: '🏁' },
      results: { label: t.results, color: '#aa55ff', icon: '🏆' },
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
        <div className="bg-glow glow-3" />
        <div className="bg-particles">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="particle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${5 + Math.random() * 5}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Header */}
      <header className="display-header">
        <div className="header-left">
          {activeConfig.branding.eventLogo && (
            <img src={activeConfig.branding.eventLogo} alt="" className="event-logo" />
          )}
          <div className="game-title-wrapper">
            <h1 className="game-title">
              {activeConfig.branding.gameTitle || (lang === 'he' ? 'ציד קודים' : 'Code Hunt')}
            </h1>
            <div className="title-glow" />
          </div>
        </div>

        <div className="header-center">
          <div className="phase-indicator" style={{ '--phase-color': phaseInfo.color } as React.CSSProperties}>
            <span className="phase-icon">{phaseInfo.icon}</span>
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
            <div className="stat-card">
              <span className="stat-icon">👥</span>
              <div className="stat-content">
                <AnimatedNumber value={stats?.totalPlayers || 0} className="stat-number" />
                <span className="stat-label">{t.players}</span>
              </div>
            </div>
            <div className="stat-card playing">
              <span className="stat-icon">🎮</span>
              <div className="stat-content">
                <AnimatedNumber value={stats?.playersPlaying || 0} className="stat-number" />
                <span className="stat-label">{t.playing}</span>
              </div>
            </div>
            <div className="stat-card finished">
              <span className="stat-icon">🏁</span>
              <div className="stat-content">
                <AnimatedNumber value={stats?.playersFinished || 0} className="stat-number" />
                <span className="stat-label">{t.finished}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="display-main">
        {/* Leaderboard */}
        <section className="leaderboard-section">
          <div className="section-header">
            <span className="section-icon">🏆</span>
            <h2 className="section-title">{t.leaderboard}</h2>
          </div>
          <AnimatedLeaderboard
            entries={leaderboard}
            lang={lang}
            maxVisible={10}
          />
        </section>

        {/* Team scores (if team mode) */}
        {isTeamMode && (
          <section className="teams-section">
            <div className="section-header">
              <span className="section-icon">👥</span>
              <h2 className="section-title">{t.teamScores}</h2>
            </div>
            <QHuntTeamScores
              teams={teamScores}
              lang={lang}
            />
          </section>
        )}

        {/* Recent scans feed */}
        {recentScans.length > 0 && (
          <aside className="scans-feed">
            <div className="feed-header">
              <span className="feed-icon">⚡</span>
              <h3 className="feed-title">
                {lang === 'he' ? 'סריקות אחרונות' : 'Recent Scans'}
              </h3>
            </div>
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

        .glow-3 {
          width: 400px;
          height: 400px;
          background: var(--qhunt-success);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation-delay: -2s;
          opacity: 0.2;
        }

        .bg-particles {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }

        .particle {
          position: absolute;
          width: 4px;
          height: 4px;
          background: var(--qhunt-primary);
          border-radius: 50%;
          animation: floatParticle 10s ease-in-out infinite;
          opacity: 0.6;
        }

        @keyframes floatParticle {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 0.6; }
          90% { opacity: 0.6; }
          100% { transform: translateY(-100vh) translateX(50px); opacity: 0; }
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
          padding: 28px 48px;
          background: linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .event-logo {
          height: 70px;
          width: auto;
          filter: drop-shadow(0 0 20px rgba(255,255,255,0.3));
        }

        .game-title-wrapper {
          position: relative;
        }

        .game-title {
          font-size: 2.8rem;
          font-weight: 800;
          margin: 0;
          background: linear-gradient(135deg, #fff, var(--qhunt-primary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .title-glow {
          position: absolute;
          inset: -10px;
          background: var(--qhunt-primary);
          filter: blur(40px);
          opacity: 0.3;
          z-index: -1;
        }

        .header-center {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
        }

        .phase-indicator {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 28px;
          background: linear-gradient(135deg, var(--phase-color)25, var(--phase-color)10);
          border: 2px solid var(--phase-color);
          border-radius: 40px;
          box-shadow: 0 0 30px var(--phase-color)40;
        }

        .phase-icon {
          font-size: 1.4rem;
        }

        .phase-dot {
          width: 12px;
          height: 12px;
          background: var(--phase-color);
          border-radius: 50%;
          animation: phasePulse 1s ease-in-out infinite;
          box-shadow: 0 0 10px var(--phase-color);
        }

        @keyframes phasePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }

        .phase-label {
          font-size: 1.3rem;
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
          gap: 12px;
          padding: 14px 28px;
          background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.15);
        }

        .timer-display.urgent {
          background: linear-gradient(135deg, rgba(255,68,102,0.3), rgba(255,68,102,0.15));
          border-color: #ff4466;
          animation: timerPulse 0.5s ease-in-out infinite;
        }

        @keyframes timerPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 20px rgba(255,68,102,0.3); }
          50% { transform: scale(1.03); box-shadow: 0 0 40px rgba(255,68,102,0.5); }
        }

        .timer-icon {
          font-size: 1.6rem;
        }

        .timer-value {
          font-size: 2rem;
          font-weight: 800;
          font-family: 'SF Mono', 'Courier New', monospace;
        }

        .stats-display {
          display: flex;
          gap: 16px;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 20px;
          background: linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.1);
        }

        .stat-card .stat-icon {
          font-size: 1.5rem;
        }

        .stat-content {
          display: flex;
          flex-direction: column;
        }

        .stat-card :global(.stat-number) {
          font-size: 1.8rem;
          font-weight: 800;
          color: var(--qhunt-primary);
          line-height: 1;
        }

        .stat-card.playing :global(.stat-number) {
          color: var(--qhunt-success);
        }

        .stat-card.finished :global(.stat-number) {
          color: #ffd700;
        }

        .stat-label {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Main content */
        .display-main {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: ${isTeamMode ? '1fr 1fr' : '1fr'};
          gap: 40px;
          padding: 32px 48px;
          min-height: calc(100vh - 140px);
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .section-icon {
          font-size: 1.6rem;
        }

        .section-title {
          font-size: 1.6rem;
          font-weight: 700;
          color: rgba(255,255,255,0.7);
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 2px;
        }

        /* Scans feed */
        .scans-feed {
          position: fixed;
          bottom: 32px;
          right: 48px;
          width: 320px;
          background: linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 20px;
          padding: 20px;
          backdrop-filter: blur(20px);
        }

        .feed-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
        }

        .feed-icon {
          font-size: 1.2rem;
        }

        .feed-title {
          font-size: 0.9rem;
          font-weight: 600;
          color: rgba(255,255,255,0.6);
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .feed-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .feed-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          animation: feedSlide 0.4s ease-out backwards;
        }

        @keyframes feedSlide {
          from {
            opacity: 0;
            transform: translateX(30px) scale(0.95);
          }
        }

        .feed-avatar {
          font-size: 1.4rem;
        }

        .feed-name {
          flex: 1;
          font-size: 0.95rem;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .feed-points {
          font-size: 1rem;
          font-weight: 700;
          color: var(--qhunt-success);
          text-shadow: 0 0 10px var(--qhunt-success);
        }
      `}</style>
    </div>
  );
}
