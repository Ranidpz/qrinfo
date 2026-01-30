'use client';

/**
 * QHuntLeaderboard - Animated leaderboard component
 *
 * Design: Neon Hunter - Arcade Gaming Vibe
 * - Rank change animations
 * - Top 3 highlighted
 * - Score glow effects
 */

import React, { useState, useEffect, useRef } from 'react';
import { QHuntLeaderboardEntry, QHUNT_TRANSLATIONS, formatGameDuration } from '@/types/qhunt';

interface QHuntLeaderboardProps {
  entries: QHuntLeaderboardEntry[];
  lang: 'he' | 'en';
  maxVisible?: number;
}

interface EntryWithPrevRank extends QHuntLeaderboardEntry {
  prevRank?: number;
  isNew?: boolean;
}

export function QHuntLeaderboard({
  entries,
  lang,
  maxVisible = 10,
}: QHuntLeaderboardProps) {
  const t = QHUNT_TRANSLATIONS[lang];
  const prevEntriesRef = useRef<Map<string, number>>(new Map());
  const [entriesWithRankChange, setEntriesWithRankChange] = useState<EntryWithPrevRank[]>([]);

  // Track rank changes
  useEffect(() => {
    const prevRanks = prevEntriesRef.current;

    const newEntries: EntryWithPrevRank[] = entries.slice(0, maxVisible).map(entry => {
      const prevRank = prevRanks.get(entry.playerId);
      const isNew = prevRank === undefined;

      return {
        ...entry,
        prevRank,
        isNew,
      };
    });

    setEntriesWithRankChange(newEntries);

    // Update refs for next comparison
    const newRanks = new Map<string, number>();
    entries.forEach(e => newRanks.set(e.playerId, e.rank));
    prevEntriesRef.current = newRanks;
  }, [entries, maxVisible]);

  const getRankChange = (entry: EntryWithPrevRank) => {
    if (entry.isNew) return 'new';
    if (entry.prevRank === undefined) return null;
    if (entry.prevRank > entry.rank) return 'up';
    if (entry.prevRank < entry.rank) return 'down';
    return null;
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  if (entries.length === 0) {
    return (
      <div className="leaderboard-empty">
        <span className="empty-icon">🎯</span>
        <span className="empty-text">
          {lang === 'he' ? 'ממתינים לשחקנים...' : 'Waiting for players...'}
        </span>

        <style jsx>{`
          .leaderboard-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            padding: 60px 20px;
            background: #ffffff08;
            border-radius: 20px;
            border: 2px dashed #ffffff20;
          }

          .empty-icon {
            font-size: 3rem;
            opacity: 0.5;
          }

          .empty-text {
            font-size: 1.2rem;
            color: #ffffff60;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="leaderboard">
      <div className="leaderboard-list">
        {entriesWithRankChange.map((entry, index) => {
          const rankChange = getRankChange(entry);
          const isTop3 = entry.rank <= 3;

          return (
            <div
              key={entry.playerId}
              className={`leaderboard-row ${isTop3 ? 'top-3' : ''} ${entry.isFinished ? 'finished' : ''} ${rankChange || ''}`}
              style={{
                '--row-delay': `${index * 0.05}s`,
                '--rank-color': isTop3
                  ? entry.rank === 1 ? '#ffd700' : entry.rank === 2 ? '#c0c0c0' : '#cd7f32'
                  : '#ffffff',
              } as React.CSSProperties}
            >
              {/* Rank */}
              <div className="row-rank">
                <span className="rank-badge">{getRankBadge(entry.rank)}</span>
                {rankChange === 'up' && <span className="rank-change up">▲</span>}
                {rankChange === 'down' && <span className="rank-change down">▼</span>}
                {rankChange === 'new' && <span className="rank-change new">NEW</span>}
              </div>

              {/* Player info */}
              <div className="row-player">
                <div className={`player-avatar ${entry.avatarType === 'selfie' ? 'photo' : ''}`}>
                  {entry.avatarType === 'selfie' && entry.avatarValue?.startsWith('http') ? (
                    <img
                      src={entry.avatarValue}
                      alt=""
                      onError={(e) => {
                        // Fallback to default emoji on error
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
                <span className="stat-codes">{entry.scansCount}</span>
                {entry.isFinished && entry.gameTime && (
                  <span className="stat-time">{formatGameDuration(entry.gameTime)}</span>
                )}
              </div>

              {/* Score */}
              <div className="row-score">
                <span className="score-value">{entry.score}</span>
              </div>

              {/* Status */}
              {entry.isFinished && (
                <div className="row-status">
                  <span className="status-badge">✓</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .leaderboard {
          background: #ffffff08;
          border-radius: 20px;
          overflow: hidden;
          border: 1px solid #ffffff15;
        }

        .leaderboard-list {
          display: flex;
          flex-direction: column;
        }

        .leaderboard-row {
          display: grid;
          grid-template-columns: 80px 1fr auto 120px 50px;
          gap: 16px;
          align-items: center;
          padding: 16px 24px;
          border-bottom: 1px solid #ffffff10;
          transition: all 0.3s ease;
          animation: rowSlide 0.4s ease-out var(--row-delay) backwards;
        }

        @keyframes rowSlide {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
        }

        .leaderboard-row:last-child {
          border-bottom: none;
        }

        .leaderboard-row.top-3 {
          background: linear-gradient(90deg, var(--rank-color)15, transparent);
        }

        .leaderboard-row.up {
          animation: rankUp 0.5s ease-out;
        }

        .leaderboard-row.down {
          animation: rankDown 0.5s ease-out;
        }

        @keyframes rankUp {
          0% { background: var(--qhunt-success)30; }
          100% { background: transparent; }
        }

        @keyframes rankDown {
          0% { background: #ff446630; }
          100% { background: transparent; }
        }

        /* Rank */
        .row-rank {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .rank-badge {
          font-size: 1.4rem;
          font-weight: 800;
          color: var(--rank-color);
        }

        .rank-change {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .rank-change.up {
          color: var(--qhunt-success);
          animation: bounceUp 0.3s ease-out;
        }

        .rank-change.down {
          color: #ff4466;
          animation: bounceDown 0.3s ease-out;
        }

        .rank-change.new {
          background: var(--qhunt-primary);
          color: #000;
          animation: popIn 0.3s ease-out;
        }

        @keyframes bounceUp {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }

        @keyframes bounceDown {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(5px); }
        }

        @keyframes popIn {
          0% { transform: scale(0); }
          100% { transform: scale(1); }
        }

        /* Player */
        .row-player {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .player-avatar {
          font-size: 1.8rem;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .player-avatar.photo {
          border-radius: 50%;
          overflow: hidden;
          background: #ffffff10;
          border: 2px solid var(--qhunt-primary);
        }

        .player-avatar.photo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .player-name {
          font-size: 1.1rem;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .player-team-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* Stats */
        .row-stats {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .stat-codes {
          font-size: 0.9rem;
          color: #ffffff60;
        }

        .stat-codes::after {
          content: ' codes';
          font-size: 0.8rem;
        }

        .stat-time {
          font-size: 0.85rem;
          font-family: 'Courier New', monospace;
          color: #ffffff60;
        }

        /* Score */
        .row-score {
          text-align: right;
        }

        .score-value {
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--qhunt-primary);
          text-shadow: 0 0 10px var(--qhunt-primary);
        }

        .top-3 .score-value {
          color: var(--rank-color);
          text-shadow: 0 0 10px var(--rank-color);
        }

        /* Status */
        .row-status {
          text-align: center;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: var(--qhunt-success);
          border-radius: 50%;
          font-size: 0.9rem;
          color: #000;
        }
      `}</style>
    </div>
  );
}
