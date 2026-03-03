'use client';

import { useState } from 'react';
import { QGamesConfig, DEFAULT_QGAMES_CONFIG } from '@/types/qgames';
import { useQGamesLeaderboard, useQGamesStats } from '@/hooks/useQGamesRealtime';

interface QGamesDisplayProps {
  codeId: string;
  mediaId: string;
  initialConfig: QGamesConfig;
}

export default function QGamesDisplay({
  codeId,
  mediaId,
  initialConfig,
}: QGamesDisplayProps) {
  const config = { ...DEFAULT_QGAMES_CONFIG, ...initialConfig };
  const { entries } = useQGamesLeaderboard(codeId);
  const { stats } = useQGamesStats(codeId);

  const bgColor = config.branding.backgroundColor || '#0a0f1a';
  const accentColor = config.branding.accentColor || '#10b981';
  const rankMedals = ['🥇', '🥈', '🥉'];

  return (
    <div
      className="min-h-screen flex flex-col p-8"
      style={{ backgroundColor: bgColor }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-black text-white flex items-center gap-3">
            🎮 Q.Games
          </h1>
          {config.branding.title && (
            <p className="text-white/40 text-lg mt-1">{config.branding.title}</p>
          )}
        </div>

        {/* Live stats */}
        {stats && (
          <div className="flex gap-6">
            <StatBox label="Players" value={stats.totalPlayers} />
            <StatBox label="Online" value={stats.playersOnline} color={accentColor} />
            <StatBox label="Matches" value={stats.totalMatches} />
            <StatBox label="Live" value={stats.matchesInProgress} color="#f59e0b" />
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div className="flex-1">
        <h2 className="text-white/50 text-sm uppercase tracking-widest mb-4">
          Leaderboard
        </h2>

        {entries.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-white/20 text-xl">Waiting for players...</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {entries.slice(0, 20).map((entry) => (
              <div
                key={entry.id}
                className={`flex items-center gap-4 py-3 px-5 rounded-xl transition-all ${
                  entry.rank <= 3
                    ? 'bg-white/10 backdrop-blur-sm'
                    : 'bg-white/[0.03]'
                }`}
              >
                {/* Rank */}
                <div className="w-12 text-center">
                  {entry.rank <= 3 ? (
                    <span className="text-3xl">{rankMedals[entry.rank - 1]}</span>
                  ) : (
                    <span className="text-white/30 text-xl font-bold">{entry.rank}</span>
                  )}
                </div>

                {/* Avatar */}
                <div className={`w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-2xl ${
                  entry.rank <= 3 ? 'ring-2 ring-white/20' : ''
                }`}>
                  {entry.avatarValue}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className={`font-bold truncate ${
                    entry.rank === 1 ? 'text-yellow-400 text-xl' :
                    entry.rank <= 3 ? 'text-white text-lg' :
                    'text-white/80'
                  }`}>
                    {entry.nickname}
                  </p>
                  <p className="text-white/30 text-sm">
                    {entry.wins}W / {entry.losses}L / {entry.draws}D
                  </p>
                </div>

                {/* Score */}
                <div className="text-end">
                  <p className={`font-black tabular-nums ${
                    entry.rank === 1 ? 'text-yellow-400 text-3xl' :
                    entry.rank <= 3 ? 'text-white text-2xl' :
                    'text-white text-xl'
                  }`}>
                    {entry.score}
                  </p>
                  <p className="text-white/20 text-xs">points</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="text-center">
      <p className="text-3xl font-black tabular-nums" style={{ color: color || 'white' }}>
        {value}
      </p>
      <p className="text-white/30 text-xs uppercase tracking-wider">{label}</p>
    </div>
  );
}
