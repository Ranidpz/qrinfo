'use client';

/**
 * QTreasureLeaderboard - Champions table display
 *
 * Design: Ancient scroll/tablet aesthetic with golden rankings
 */

import React from 'react';
import { QTreasureLeaderboardEntry, formatTreasureDuration } from '@/types/qtreasure';

interface QTreasureLeaderboardProps {
  entries: QTreasureLeaderboardEntry[];
  currentPlayerId?: string;
  lang: 'he' | 'en';
  compact?: boolean;
  maxVisible?: number;
  title?: string;
}

const translations = {
  he: {
    leaderboard: 'טבלת האלופים',
    rank: 'דירוג',
    name: 'שם',
    time: 'זמן',
    xp: 'XP',
    you: 'את/ה',
    noEntries: 'עדיין אין מסיימים',
    stations: 'תחנות',
  },
  en: {
    leaderboard: 'Leaderboard',
    rank: 'Rank',
    name: 'Name',
    time: 'Time',
    xp: 'XP',
    you: 'You',
    noEntries: 'No finishers yet',
    stations: 'Stations',
  },
};

export function QTreasureLeaderboard({
  entries,
  currentPlayerId,
  lang,
  compact = false,
  maxVisible = 10,
  title,
}: QTreasureLeaderboardProps) {
  const t = translations[lang];
  const isRTL = lang === 'he';

  // Sort by rank and limit
  const sortedEntries = [...entries]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, maxVisible);

  // Get rank medal/emoji
  const getRankDisplay = (rank: number) => {
    switch (rank) {
      case 1: return { icon: '🥇', class: 'gold' };
      case 2: return { icon: '🥈', class: 'silver' };
      case 3: return { icon: '🥉', class: 'bronze' };
      default: return { icon: `#${rank}`, class: '' };
    }
  };

  if (entries.length === 0) {
    return (
      <div className="leaderboard-empty" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="empty-icon">🏆</div>
        <p>{t.noEntries}</p>
        <style jsx>{`
          .leaderboard-empty {
            text-align: center;
            padding: 2rem;
            color: rgba(245, 245, 220, 0.6);
          }
          .empty-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
            opacity: 0.3;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      className={`leaderboard-container ${compact ? 'compact' : ''}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Title */}
      {!compact && (
        <div className="leaderboard-header">
          <h3 className="title">{title || t.leaderboard}</h3>
          <div className="title-decoration">
            <span className="line" />
            <span className="icon">🏆</span>
            <span className="line" />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="leaderboard-table">
        {/* Header row */}
        {!compact && (
          <div className="table-header">
            <span className="col-rank">{t.rank}</span>
            <span className="col-name">{t.name}</span>
            <span className="col-time">{t.time}</span>
            <span className="col-xp">{t.xp}</span>
          </div>
        )}

        {/* Entries */}
        <div className="table-body">
          {sortedEntries.map((entry, index) => {
            const isCurrentPlayer = entry.playerId === currentPlayerId;
            const rankDisplay = getRankDisplay(entry.rank);

            return (
              <div
                key={entry.playerId}
                className={`table-row ${isCurrentPlayer ? 'current-player' : ''} ${rankDisplay.class}`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {/* Rank */}
                <div className="col-rank">
                  <span className={`rank-badge ${rankDisplay.class}`}>
                    {rankDisplay.icon}
                  </span>
                </div>

                {/* Player info */}
                <div className="col-name">
                  <div className="player-info">
                    <span className="avatar">
                      {entry.avatarType === 'selfie' ? (
                        <img src={entry.avatarValue} alt="" />
                      ) : (
                        entry.avatarValue
                      )}
                    </span>
                    <span className="name">
                      {entry.playerName}
                      {isCurrentPlayer && (
                        <span className="you-badge">{t.you}</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Time */}
                <div className="col-time">
                  {formatTreasureDuration(entry.completionTimeMs)}
                </div>

                {/* XP */}
                {!compact && (
                  <div className="col-xp">
                    <span className="xp-value">{entry.totalXP}</span>
                    <span className="xp-icon">⭐</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .leaderboard-container {
          width: 100%;
        }

        /* Header */
        .leaderboard-header {
          text-align: center;
          margin-bottom: 1.5rem;
        }

        .title {
          font-family: 'Cinzel', 'Crimson Text', Georgia, serif;
          font-size: 1.5rem;
          font-weight: 700;
          color: #d4af37;
          margin: 0 0 0.75rem;
        }

        .title-decoration {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
        }

        .line {
          flex: 1;
          max-width: 80px;
          height: 1px;
          background: linear-gradient(
            ${isRTL ? '270deg' : '90deg'},
            transparent,
            rgba(212, 175, 55, 0.5),
            transparent
          );
        }

        .icon {
          font-size: 1.25rem;
        }

        /* Table */
        .leaderboard-table {
          background: rgba(26, 45, 35, 0.6);
          border: 1px solid rgba(212, 175, 55, 0.15);
          border-radius: 16px;
          overflow: hidden;
        }

        .compact .leaderboard-table {
          background: transparent;
          border: none;
          border-radius: 0;
          margin-top: 1rem;
        }

        /* Header row */
        .table-header {
          display: grid;
          grid-template-columns: 60px 1fr 90px 70px;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: rgba(212, 175, 55, 0.1);
          border-bottom: 1px solid rgba(212, 175, 55, 0.15);
          font-size: 0.75rem;
          color: rgba(212, 175, 55, 0.8);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* Body */
        .table-body {
          max-height: 400px;
          overflow-y: auto;
        }

        .compact .table-body {
          max-height: 300px;
        }

        /* Row */
        .table-row {
          display: grid;
          grid-template-columns: 60px 1fr 90px 70px;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          align-items: center;
          border-bottom: 1px solid rgba(212, 175, 55, 0.08);
          animation: slideIn 0.3s ease-out both;
          transition: background 0.2s;
        }

        .compact .table-row {
          grid-template-columns: 50px 1fr 80px;
          padding: 0.5rem;
        }

        .table-row:hover {
          background: rgba(212, 175, 55, 0.05);
        }

        .table-row:last-child {
          border-bottom: none;
        }

        /* Current player highlight */
        .table-row.current-player {
          background: rgba(212, 175, 55, 0.1);
          border-inline-start: 3px solid #d4af37;
        }

        /* Top 3 styling */
        .table-row.gold {
          background: linear-gradient(
            ${isRTL ? '270deg' : '90deg'},
            rgba(255, 215, 0, 0.1),
            transparent
          );
        }

        .table-row.silver {
          background: linear-gradient(
            ${isRTL ? '270deg' : '90deg'},
            rgba(192, 192, 192, 0.08),
            transparent
          );
        }

        .table-row.bronze {
          background: linear-gradient(
            ${isRTL ? '270deg' : '90deg'},
            rgba(205, 127, 50, 0.08),
            transparent
          );
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(${isRTL ? '20px' : '-20px'});
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        /* Columns */
        .col-rank {
          display: flex;
          justify-content: center;
        }

        .rank-badge {
          font-family: 'Cinzel', monospace;
          font-size: 1rem;
          font-weight: 600;
          color: rgba(245, 245, 220, 0.8);
        }

        .rank-badge.gold {
          font-size: 1.25rem;
        }

        .rank-badge.silver {
          font-size: 1.25rem;
        }

        .rank-badge.bronze {
          font-size: 1.25rem;
        }

        .col-name {
          min-width: 0;
        }

        .player-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .avatar {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          background: rgba(212, 175, 55, 0.15);
          border-radius: 50%;
          flex-shrink: 0;
          overflow: hidden;
        }

        .avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .name {
          color: #f5f5dc;
          font-size: 0.9rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .you-badge {
          font-size: 0.65rem;
          padding: 0.125rem 0.375rem;
          background: rgba(212, 175, 55, 0.2);
          color: #d4af37;
          border-radius: 4px;
          font-weight: 600;
        }

        .col-time {
          font-family: 'Cinzel', monospace;
          font-size: 0.875rem;
          color: #d4af37;
          text-align: ${isRTL ? 'right' : 'left'};
        }

        .col-xp {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          justify-content: flex-end;
        }

        .xp-value {
          font-size: 0.875rem;
          color: rgba(245, 245, 220, 0.9);
        }

        .xp-icon {
          font-size: 0.75rem;
        }

        /* Scrollbar */
        .table-body::-webkit-scrollbar {
          width: 6px;
        }

        .table-body::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
        }

        .table-body::-webkit-scrollbar-thumb {
          background: rgba(212, 175, 55, 0.3);
          border-radius: 3px;
        }

        .table-body::-webkit-scrollbar-thumb:hover {
          background: rgba(212, 175, 55, 0.5);
        }
      `}</style>
    </div>
  );
}

// Mini leaderboard for display screens
export function QTreasureLeaderboardMini({
  entries,
  lang,
  maxVisible = 5,
}: {
  entries: QTreasureLeaderboardEntry[];
  lang: 'he' | 'en';
  maxVisible?: number;
}) {
  const isRTL = lang === 'he';

  const topEntries = [...entries]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, maxVisible);

  if (topEntries.length === 0) return null;

  return (
    <div className="mini-leaderboard" dir={isRTL ? 'rtl' : 'ltr'}>
      {topEntries.map((entry, index) => (
        <div
          key={entry.playerId}
          className={`mini-entry rank-${entry.rank}`}
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          <span className="mini-rank">
            {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
          </span>
          <span className="mini-avatar">
            {entry.avatarType === 'selfie' ? (
              <img src={entry.avatarValue} alt="" />
            ) : (
              entry.avatarValue
            )}
          </span>
          <span className="mini-name">{entry.playerName}</span>
          <span className="mini-time">{formatTreasureDuration(entry.completionTimeMs)}</span>
        </div>
      ))}

      <style jsx>{`
        .mini-leaderboard {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .mini-entry {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.625rem 1rem;
          background: rgba(26, 45, 35, 0.7);
          border: 1px solid rgba(212, 175, 55, 0.15);
          border-radius: 10px;
          animation: fadeSlideIn 0.4s ease-out both;
        }

        .mini-entry.rank-1 {
          background: linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(26, 45, 35, 0.8));
          border-color: rgba(255, 215, 0, 0.3);
        }

        .mini-entry.rank-2 {
          background: linear-gradient(135deg, rgba(192, 192, 192, 0.1), rgba(26, 45, 35, 0.8));
          border-color: rgba(192, 192, 192, 0.2);
        }

        .mini-entry.rank-3 {
          background: linear-gradient(135deg, rgba(205, 127, 50, 0.1), rgba(26, 45, 35, 0.8));
          border-color: rgba(205, 127, 50, 0.2);
        }

        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .mini-rank {
          font-size: 1.125rem;
          min-width: 28px;
          text-align: center;
        }

        .mini-avatar {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          background: rgba(212, 175, 55, 0.15);
          border-radius: 50%;
          overflow: hidden;
        }

        .mini-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .mini-name {
          flex: 1;
          color: #f5f5dc;
          font-size: 0.9rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .mini-time {
          font-family: 'Cinzel', monospace;
          font-size: 0.875rem;
          color: #d4af37;
        }
      `}</style>
    </div>
  );
}
