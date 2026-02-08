'use client';

/**
 * QTreasureDisplay - Big screen leaderboard display
 *
 * Design: Ancient Explorer / Quest Adventure
 * - Deep forest greens and mystical blues
 * - Gold/amber treasure accents
 * - Parchment textures and compass motifs
 * - Real-time animated leaderboard
 */

import React, { useState, useEffect, useRef } from 'react';
import { QTreasureConfig, QTreasureLeaderboardEntry } from '@/types/qtreasure';
import { useQTreasureDisplay, useQTreasureTimer } from '@/hooks/useQTreasureRealtime';

interface QTreasureDisplayProps {
  codeId: string;
  mediaId: string;
  initialConfig: QTreasureConfig;
}

// Format time as mm:ss or hh:mm:ss
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Format date for display (e.g., "27/01 14:32")
function formatFinishedDate(timestamp: number): string {
  const date = new Date(timestamp);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day}/${month} ${hours}:${minutes}`;
}

// Animated number component
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

// Animated leaderboard with FLIP animations
function AnimatedLeaderboard({
  entries,
  lang,
  maxVisible = 10,
}: {
  entries: QTreasureLeaderboardEntry[];
  lang: 'he' | 'en';
  maxVisible?: number;
}) {
  const [displayEntries, setDisplayEntries] = useState<(QTreasureLeaderboardEntry & { animationClass: string })[]>([]);
  const prevEntriesMap = useRef<Map<string, { rank: number; totalXP: number }>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const positionsRef = useRef<Map<string, DOMRect>>(new Map());

  // Capture positions before update
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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
      } else if (prev.totalXP !== entry.totalXP) {
        animationClass = 'xp-update';
      }

      return { ...entry, animationClass };
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
    const newMap = new Map<string, { rank: number; totalXP: number }>();
    entries.forEach(e => newMap.set(e.playerId, { rank: e.rank, totalXP: e.totalXP }));
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
        <span className="compass-icon">🧭</span>
        <span className="empty-text">
          {lang === 'he' ? 'ממתינים לחוקרים...' : 'Waiting for explorers...'}
        </span>

        <style jsx>{`
          .leaderboard-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 80px 40px;
            background: linear-gradient(145deg, rgba(212, 175, 55, 0.05), rgba(212, 175, 55, 0.02));
            border-radius: 24px;
            border: 2px dashed rgba(212, 175, 55, 0.2);
          }

          .compass-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
            animation: spin 10s linear infinite;
          }

          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          .empty-text {
            font-size: 1.3rem;
            color: rgba(212, 175, 55, 0.6);
            font-family: 'Cinzel', 'Crimson Text', Georgia, serif;
          }

          @media (max-width: 768px) {
            .leaderboard-empty {
              padding: 40px 20px;
              border-radius: 16px;
            }
            .compass-icon {
              font-size: 2rem;
            }
            .empty-text {
              font-size: 1rem;
            }
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
              className={`leaderboard-row ${isTop3 ? `top-${entry.rank}` : ''} ${entry.animationClass}`}
              style={{
                '--row-index': index,
                '--rank-color': isTop3
                  ? entry.rank === 1 ? '#ffd700' : entry.rank === 2 ? '#c0c0c0' : '#cd7f32'
                  : '#d4af37',
              } as React.CSSProperties}
            >
              {/* Player info with avatar */}
              <div className="row-player">
                <div className="avatar-wrapper">
                  <div className={`player-avatar ${entry.avatarType === 'selfie' ? 'photo' : ''}`}>
                    {entry.avatarType === 'selfie' && entry.avatarValue?.startsWith('http') ? (
                      <img
                        src={entry.avatarValue}
                        alt=""
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.textContent = '🧭';
                            parent.classList.remove('photo');
                          }
                        }}
                      />
                    ) : (
                      entry.avatarValue || '🧭'
                    )}
                  </div>
                  <span className="finish-date">
                    {formatFinishedDate(entry.completedAt)}
                  </span>
                </div>
                <span className="player-name">{entry.playerName}</span>
              </div>

              {/* Score + Rank */}
              <div className="row-score-area">
                <div className="score-with-rank">
                  <span className="rank-badge">{getRankBadge(entry.rank)}</span>
                  <AnimatedNumber
                    value={entry.totalXP}
                    className="score-value"
                    duration={800}
                    suffix=" XP"
                  />
                </div>
                <div className="score-details">
                  <span className="detail-item">{formatTime(entry.completionTimeMs)}</span>
                  <span className="detail-separator">•</span>
                  <span className="detail-item">{entry.stationsCompleted} {lang === 'he' ? 'תחנות' : 'stations'}</span>
                </div>
              </div>

              {/* Highlight effect for updates */}
              <div className="row-highlight" />
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .leaderboard {
          background: transparent;
          max-width: 800px;
          margin: 0 auto;
        }

        .leaderboard-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .leaderboard-row {
          position: relative;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 16px;
          align-items: center;
          padding: 16px 24px;
          border-radius: 20px;
          background: linear-gradient(90deg, rgba(212, 175, 55, 0.08), transparent);
          border: 1px solid rgba(212, 175, 55, 0.15);
          transition: background 0.3s ease;
          animation: rowAppear 0.5s ease-out calc(var(--row-index) * 0.05s) backwards;
        }

        @keyframes rowAppear {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
        }

        .leaderboard-row.top-1 {
          background: linear-gradient(90deg, rgba(255,215,0,0.2), rgba(255,215,0,0.05) 70%, transparent);
          border-color: rgba(255, 215, 0, 0.3);
        }

        .leaderboard-row.top-2 {
          background: linear-gradient(90deg, rgba(192,192,192,0.15), rgba(192,192,192,0.05) 70%, transparent);
          border-color: rgba(192, 192, 192, 0.3);
        }

        .leaderboard-row.top-3 {
          background: linear-gradient(90deg, rgba(205,127,50,0.15), rgba(205,127,50,0.05) 70%, transparent);
          border-color: rgba(205, 127, 50, 0.3);
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

        .leaderboard-row.xp-update .row-highlight {
          animation: highlightXP 0.8s ease-out;
        }

        .row-highlight {
          position: absolute;
          inset: 0;
          pointer-events: none;
          border-radius: 20px;
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

        @keyframes highlightXP {
          0% { background: rgba(212,175,55,0.3); }
          100% { background: transparent; }
        }

        /* Player */
        .row-player {
          display: flex;
          align-items: center;
          gap: 20px;
          min-width: 0;
        }

        .avatar-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .player-avatar {
          width: 80px;
          height: 80px;
          font-size: 2.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(145deg, rgba(212, 175, 55, 0.15), rgba(212, 175, 55, 0.05));
          border-radius: 18px;
          border: 2px solid rgba(212, 175, 55, 0.3);
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

        .finish-date {
          font-size: 0.75rem;
          color: rgba(212, 175, 55, 0.5);
          white-space: nowrap;
        }

        .player-name {
          font-size: 1.4rem;
          font-weight: 600;
          font-family: 'Cinzel', 'Crimson Text', Georgia, serif;
          color: #f5f5dc;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 300px;
        }

        /* Score Area */
        .row-score-area {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }

        .score-with-rank {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .rank-badge {
          font-size: 1.4rem;
          opacity: 0.9;
        }

        .row-score-area :global(.score-value) {
          font-size: 1.8rem;
          font-weight: 800;
          color: var(--rank-color);
          text-shadow: 0 0 20px var(--rank-color);
          font-family: 'Cinzel', 'Crimson Text', Georgia, serif;
        }

        .score-details {
          display: flex;
          gap: 8px;
          font-size: 0.9rem;
          color: rgba(212, 175, 55, 0.6);
          font-family: 'SF Mono', 'Courier New', monospace;
        }

        .detail-separator {
          opacity: 0.5;
        }

        /* ============ MOBILE RESPONSIVE ============ */
        @media (max-width: 768px) {
          .leaderboard-row {
            gap: 12px;
            padding: 12px 16px;
            border-radius: 16px;
          }

          .row-player {
            gap: 14px;
          }

          .avatar-wrapper {
            gap: 4px;
          }

          .player-avatar {
            width: 72px;
            height: 72px;
            font-size: 2.2rem;
            border-radius: 16px;
          }

          .finish-date {
            font-size: 0.65rem;
          }

          .player-name {
            font-size: 1.1rem;
            max-width: 140px;
          }

          .score-with-rank {
            gap: 6px;
          }

          .rank-badge {
            font-size: 1rem;
          }

          .row-score-area :global(.score-value) {
            font-size: 1.4rem;
          }

          .score-details {
            font-size: 0.75rem;
          }
        }

        @media (max-width: 400px) {
          .leaderboard-row {
            gap: 10px;
            padding: 10px 12px;
          }

          .player-avatar {
            width: 60px;
            height: 60px;
            font-size: 1.8rem;
            border-radius: 14px;
          }

          .player-name {
            font-size: 1rem;
            max-width: 100px;
          }

          .rank-badge {
            font-size: 0.9rem;
          }

          .row-score-area :global(.score-value) {
            font-size: 1.2rem;
          }

          .score-details {
            font-size: 0.7rem;
          }
        }
      `}</style>
    </div>
  );
}

export function QTreasureDisplay({
  codeId,
  mediaId,
  initialConfig,
}: QTreasureDisplayProps) {
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  const {
    config,
    liveData,
    leaderboard,
    recentCompletions,
    phase,
    stats,
  } = useQTreasureDisplay(codeId, mediaId);

  const activeConfig = config || initialConfig;

  // Timer for game (uses config startedAt since display shows game-wide timer)
  const timer = useQTreasureTimer(
    activeConfig.gameStartedAt,
    activeConfig.timer?.maxTimeSeconds || 0
  );

  // Keyboard shortcut: Control key to toggle header
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        setHeaderCollapsed(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Determine language
  const lang = activeConfig.language === 'auto' ? 'he' : activeConfig.language;
  const isRTL = lang === 'he';

  const translations = {
    he: {
      leaderboard: 'טבלת המובילים',
      explorers: 'חוקרים',
      exploring: 'בדרך',
      completed: 'סיימו',
      recentCompletions: 'סיימו לאחרונה',
    },
    en: {
      leaderboard: 'Leaderboard',
      explorers: 'Explorers',
      exploring: 'Exploring',
      completed: 'Completed',
      recentCompletions: 'Recent Completions',
    },
  };
  const t = translations[lang];

  return (
    <div
      className="qtreasure-display"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        '--treasure-bg': activeConfig.branding?.backgroundColor || '#0d1f17',
        '--treasure-primary': activeConfig.branding?.primaryColor || '#d4af37',
        '--treasure-accent': activeConfig.branding?.accentColor || '#00ff88',
        '--treasure-success': activeConfig.branding?.successColor || '#4ade80',
      } as React.CSSProperties}
    >
      {/* Background */}
      <div className="display-bg">
        {activeConfig.branding?.backgroundImage && (
          <div
            className="bg-image"
            style={{ backgroundImage: `url(${activeConfig.branding.backgroundImage})` }}
          />
        )}
        <div className="bg-fog fog-1" />
        <div className="bg-fog fog-2" />
        <div className="bg-particles">
          {[...Array(15)].map((_, i) => (
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

      {/* Fixed Header Section */}
      <div className="fixed-header">
        {/* Q Logo Header - Press Ctrl to toggle */}
        <a href="https://qr.playzones.app" className={`q-logo-header ${headerCollapsed ? 'collapsed' : ''}`}>
          <img src="/theQ.png" alt="The Q" className="q-logo" />
        </a>

        {/* Header */}
        <header className="display-header">
          <div className="header-left">
            {activeConfig.branding?.eventLogo && (
              <img src={activeConfig.branding.eventLogo} alt="" className="event-logo" />
            )}
            <div className="game-title-wrapper">
              <h1 className="game-title">
                {activeConfig.branding?.gameTitle || (lang === 'he' ? 'ציד אוצרות' : 'Treasure Hunt')}
              </h1>
              <div className="title-glow" />
            </div>
          </div>

          <div className="header-right">
            {/* Timer (if active) */}
            {phase === 'playing' && activeConfig.timer?.maxTimeSeconds > 0 && (
              <div className={`timer-display ${timer.isExpired ? 'expired' : ''}`}>
                <span className="timer-icon">⏱️</span>
                <span className="timer-value">{timer.formattedTime}</span>
              </div>
            )}

            {/* Stats */}
            <div className="stats-display">
              <div className="stat-card">
                <AnimatedNumber value={stats?.playersCompleted || 0} className="stat-number" duration={1200} />
                <span className="stat-label">{t.completed}</span>
              </div>
              <div className="stat-card playing">
                <AnimatedNumber value={stats?.playersPlaying || 0} className="stat-number" duration={1200} />
                <span className="stat-label">{t.exploring}</span>
              </div>
              <div className="stat-card">
                <AnimatedNumber value={stats?.totalPlayers || 0} className="stat-number" duration={1200} />
                <span className="stat-label">{t.explorers}</span>
              </div>
            </div>
          </div>
        </header>
      </div>

      {/* Scrollable Main content */}
      <main className="display-main scrollable">
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
      </main>

      {/* Recent completions feed - floating on the side */}
      {recentCompletions.length > 0 && (
        <aside className="completions-feed-floating">
          <div className="feed-header">
            <span className="feed-icon">🎉</span>
            <span className="feed-title">{t.recentCompletions}</span>
          </div>
          <div className="feed-list-vertical">
            {recentCompletions.slice(0, 5).map((completion, index) => (
              <div
                key={completion.id}
                className="feed-item-vertical"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <span className={`feed-avatar ${completion.avatarValue?.startsWith('http') ? 'photo' : ''}`}>
                  {completion.avatarValue?.startsWith('http') ? (
                    <img
                      src={completion.avatarValue}
                      alt=""
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        if (target.parentElement) {
                          target.parentElement.textContent = '🧭';
                        }
                      }}
                    />
                  ) : (
                    completion.avatarValue || '🧭'
                  )}
                </span>
                <div className="feed-info">
                  <span className="feed-name">{completion.playerName}</span>
                  <span className="feed-time">{formatTime(completion.completionTimeMs)}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      )}

      <style jsx>{`
        .qtreasure-display {
          height: 100vh;
          height: 100dvh;
          background: var(--treasure-bg);
          font-family: 'Crimson Text', Georgia, serif;
          color: #f5f5dc;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        /* Fixed Header Section */
        .fixed-header {
          flex-shrink: 0;
          z-index: 20;
          background: linear-gradient(180deg, var(--treasure-bg) 0%, rgba(13, 31, 23, 0.95) 100%);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
        }

        /* Q Logo Header */
        .q-logo-header {
          display: flex;
          align-items: center;
          position: relative;
          z-index: 10;
          direction: ltr;
          justify-content: flex-start;
          padding: 0 27px;
          height: 71px;
          text-decoration: none;
          background: var(--treasure-bg);
          transition: height 0.3s ease-out, padding 0.3s ease-out, opacity 0.3s ease-out;
          overflow: hidden;
        }

        .q-logo-header.collapsed {
          height: 0;
          padding-top: 0;
          padding-bottom: 0;
          opacity: 0;
          pointer-events: none;
        }

        .q-logo-header .q-logo {
          height: 40px;
          width: auto;
          filter: drop-shadow(0 0 10px rgba(212, 175, 55, 0.3));
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

        .bg-fog {
          position: absolute;
          width: 200%;
          height: 200%;
          background: radial-gradient(ellipse at center, rgba(212, 175, 55, 0.05) 0%, transparent 70%);
        }

        .fog-1 {
          top: -50%;
          left: -50%;
          animation: fog-drift 30s ease-in-out infinite;
        }

        .fog-2 {
          bottom: -50%;
          right: -50%;
          animation: fog-drift 25s ease-in-out infinite reverse;
          opacity: 0.5;
        }

        @keyframes fog-drift {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(5%, 5%) rotate(5deg); }
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
          background: var(--treasure-primary);
          border-radius: 50%;
          animation: floatParticle 10s ease-in-out infinite;
          opacity: 0.5;
        }

        @keyframes floatParticle {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 0.5; }
          90% { opacity: 0.5; }
          100% { transform: translateY(-100vh) translateX(30px); opacity: 0; }
        }

        /* Header */
        .display-header {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 28px 48px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .event-logo {
          height: 70px;
          width: auto;
          filter: drop-shadow(0 0 20px rgba(212, 175, 55, 0.3));
        }

        .game-title-wrapper {
          position: relative;
        }

        .game-title {
          font-size: 2.8rem;
          font-weight: 700;
          margin: 0;
          font-family: 'Cinzel', 'Crimson Text', Georgia, serif;
          background: linear-gradient(135deg, #d4af37, #f5d670, #d4af37);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: 0.05em;
        }

        .title-glow {
          position: absolute;
          inset: -10px;
          background: #d4af37;
          filter: blur(40px);
          opacity: 0.15;
          z-index: -1;
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
          background: linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(212, 175, 55, 0.05));
          border-radius: 20px;
          border: 1px solid rgba(212, 175, 55, 0.3);
        }

        .timer-display.expired {
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
          font-weight: 700;
          font-family: 'SF Mono', 'Courier New', monospace;
          color: var(--treasure-primary);
        }

        .stats-display {
          display: flex;
          gap: 16px;
        }

        .stat-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px 24px;
          background: linear-gradient(145deg, rgba(212, 175, 55, 0.1), rgba(212, 175, 55, 0.03));
          border-radius: 16px;
          border: 1px solid rgba(212, 175, 55, 0.2);
        }

        .stat-card :global(.stat-number) {
          font-size: 1.8rem;
          font-weight: 800;
          color: var(--treasure-primary);
          font-family: 'Cinzel', Georgia, serif;
          line-height: 1;
        }

        .stat-card.playing :global(.stat-number) {
          color: var(--treasure-accent);
        }

        .stat-label {
          font-size: 0.75rem;
          color: rgba(212, 175, 55, 0.6);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 4px;
        }

        /* Main content */
        .display-main.scrollable {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          position: relative;
          z-index: 1;
          padding: 32px 48px;
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .section-icon {
          font-size: 1.6rem;
        }

        .section-title {
          font-size: 1.6rem;
          font-weight: 700;
          font-family: 'Cinzel', 'Crimson Text', Georgia, serif;
          color: rgba(212, 175, 55, 0.8);
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 2px;
        }

        /* Floating recent completions */
        .completions-feed-floating {
          position: fixed;
          left: 24px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 30;
          background: rgba(13, 31, 23, 0.9);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          border: 1px solid rgba(212, 175, 55, 0.2);
          padding: 16px;
          max-width: 200px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }

        [dir="rtl"] .completions-feed-floating {
          left: auto;
          right: 24px;
        }

        .feed-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(212, 175, 55, 0.2);
        }

        .feed-icon {
          font-size: 1.2rem;
        }

        .feed-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: rgba(212, 175, 55, 0.8);
          white-space: nowrap;
        }

        .feed-list-vertical {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .feed-item-vertical {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          background: rgba(212, 175, 55, 0.08);
          border-radius: 12px;
          animation: feedSlideIn 0.3s ease-out backwards;
        }

        @keyframes feedSlideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .feed-avatar {
          width: 32px;
          height: 32px;
          font-size: 1.2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: rgba(212, 175, 55, 0.1);
          border-radius: 8px;
        }

        .feed-avatar.photo {
          border-radius: 50%;
          overflow: hidden;
          padding: 0;
          background: transparent;
        }

        .feed-avatar.photo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .feed-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .feed-name {
          font-size: 0.85rem;
          font-weight: 600;
          color: #f5f5dc;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100px;
        }

        .feed-time {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--treasure-accent);
        }

        /* ============ MOBILE RESPONSIVE ============ */
        @media (max-width: 768px) {
          .q-logo-header {
            padding: 8px 16px 0;
            height: auto;
          }

          .q-logo-header .q-logo {
            height: 40px;
          }

          .display-header {
            flex-direction: column;
            gap: 6px;
            padding: 0 16px 8px;
            text-align: center;
          }

          .header-left {
            flex-direction: column;
            gap: 0;
          }

          .event-logo {
            display: none;
          }

          .game-title {
            font-size: 1.4rem;
          }

          .title-glow {
            display: none;
          }

          .header-right {
            flex-direction: column;
            gap: 12px;
            width: 100%;
          }

          .timer-display {
            padding: 10px 20px;
            width: fit-content;
          }

          .timer-icon {
            font-size: 1.2rem;
          }

          .timer-value {
            font-size: 1.4rem;
          }

          .stats-display {
            width: 100%;
            justify-content: center;
            gap: 8px;
          }

          .stat-card {
            padding: 8px 12px;
            min-width: 70px;
          }

          .stat-card :global(.stat-number) {
            font-size: 1.3rem;
          }

          .stat-label {
            font-size: 0.65rem;
          }

          .display-main.scrollable {
            padding: 8px 16px 16px;
          }

          .section-header {
            margin-bottom: 8px;
          }

          .section-icon {
            font-size: 1.2rem;
          }

          .section-title {
            font-size: 1.1rem;
            letter-spacing: 1px;
          }

          /* Hide floating completions feed on mobile */
          .completions-feed-floating {
            display: none;
          }

          /* Reduce background effects on mobile */
          .bg-fog {
            display: none;
          }

          .bg-particles .particle {
            display: none;
          }
        }

        @media (max-width: 400px) {
          .q-logo-header {
            padding: 6px 12px 0;
          }

          .q-logo-header .q-logo {
            height: 36px;
          }

          .display-header {
            padding: 0 12px 6px;
            gap: 4px;
          }

          .game-title {
            font-size: 1.3rem;
          }

          .stat-card {
            padding: 6px 10px;
            min-width: 60px;
          }

          .stat-card :global(.stat-number) {
            font-size: 1.1rem;
          }

          .stat-label {
            font-size: 0.6rem;
          }

          .display-main.scrollable {
            padding: 6px 12px 12px;
          }

          .section-title {
            font-size: 1rem;
          }
        }
      `}</style>
    </div>
  );
}
