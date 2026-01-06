'use client';

/**
 * QHuntTeamScores - Team scores display for team mode
 *
 * Design: Neon Hunter - Arcade Gaming Vibe
 * - Team cards with colors
 * - Score bars
 * - Player count
 */

import React from 'react';
import { QHuntTeamScore, QHUNT_TRANSLATIONS } from '@/types/qhunt';

interface QHuntTeamScoresProps {
  teams: QHuntTeamScore[];
  lang: 'he' | 'en';
}

export function QHuntTeamScores({
  teams,
  lang,
}: QHuntTeamScoresProps) {
  const t = QHUNT_TRANSLATIONS[lang];

  // Find max score for relative bar width
  const maxScore = Math.max(...teams.map(t => t.score), 1);

  if (teams.length === 0) {
    return (
      <div className="teams-empty">
        <span className="empty-icon">👥</span>
        <span className="empty-text">
          {lang === 'he' ? 'אין קבוצות פעילות' : 'No active teams'}
        </span>

        <style jsx>{`
          .teams-empty {
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
    <div className="team-scores">
      {teams.map((team, index) => {
        const barWidth = (team.score / maxScore) * 100;
        const isLeader = team.rank === 1;

        return (
          <div
            key={team.teamId}
            className={`team-card ${isLeader ? 'leader' : ''}`}
            style={{
              '--team-color': team.teamColor,
              '--bar-width': `${barWidth}%`,
              '--delay': `${index * 0.1}s`,
            } as React.CSSProperties}
          >
            {/* Rank badge */}
            <div className="team-rank">
              {team.rank === 1 ? '🥇' : team.rank === 2 ? '🥈' : team.rank === 3 ? '🥉' : `#${team.rank}`}
            </div>

            {/* Team info */}
            <div className="team-info">
              <div className="team-header">
                <h3 className="team-name">{team.teamName}</h3>
                <span className="team-players">
                  {team.players} {lang === 'he' ? 'שחקנים' : 'players'}
                </span>
              </div>

              {/* Score bar */}
              <div className="score-bar-container">
                <div className="score-bar">
                  <div className="score-bar-fill" />
                </div>
              </div>
            </div>

            {/* Score */}
            <div className="team-score">
              <span className="score-value">{team.score}</span>
              <span className="score-label">{lang === 'he' ? 'נק\'' : 'pts'}</span>
            </div>
          </div>
        );
      })}

      <style jsx>{`
        .team-scores {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .team-card {
          display: grid;
          grid-template-columns: 60px 1fr auto;
          gap: 16px;
          align-items: center;
          padding: 20px 24px;
          background: #ffffff08;
          border: 2px solid var(--team-color);
          border-radius: 16px;
          animation: cardSlide 0.4s ease-out var(--delay) backwards;
          transition: all 0.3s ease;
        }

        @keyframes cardSlide {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
        }

        .team-card.leader {
          background: var(--team-color)20;
          box-shadow: 0 0 30px var(--team-color)40;
        }

        /* Rank */
        .team-rank {
          font-size: 2rem;
          text-align: center;
        }

        /* Team info */
        .team-info {
          flex: 1;
        }

        .team-header {
          display: flex;
          align-items: baseline;
          gap: 12px;
          margin-bottom: 10px;
        }

        .team-name {
          font-size: 1.3rem;
          font-weight: 700;
          color: var(--team-color);
          margin: 0;
        }

        .team-players {
          font-size: 0.85rem;
          color: #ffffff60;
        }

        /* Score bar */
        .score-bar-container {
          width: 100%;
        }

        .score-bar {
          height: 8px;
          background: #ffffff15;
          border-radius: 4px;
          overflow: hidden;
        }

        .score-bar-fill {
          width: var(--bar-width);
          height: 100%;
          background: var(--team-color);
          border-radius: 4px;
          transition: width 0.5s ease-out;
          box-shadow: 0 0 10px var(--team-color);
        }

        /* Score */
        .team-score {
          text-align: center;
        }

        .score-value {
          display: block;
          font-size: 2rem;
          font-weight: 800;
          color: var(--team-color);
          text-shadow: 0 0 20px var(--team-color);
          line-height: 1;
        }

        .score-label {
          font-size: 0.8rem;
          color: #ffffff60;
          text-transform: uppercase;
        }
      `}</style>
    </div>
  );
}
