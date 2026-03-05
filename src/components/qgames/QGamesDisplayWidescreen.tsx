'use client';

import { useState, useEffect } from 'react';
import { QGamesConfig, DEFAULT_QGAMES_CONFIG, resolveTheme, GAME_META, QGameType } from '@/types/qgames';
import { useQGamesLeaderboard, useQGamesStats } from '@/hooks/useQGamesRealtime';

interface QGamesDisplayWidescreenProps {
  codeId: string;
  mediaId: string;
  initialConfig: QGamesConfig;
}

function getGameStats(entry: { score: number; wins: number; gamesPlayed: number; rpsPlayed?: number; rpsWins?: number; oddoneoutPlayed?: number; oddoneoutWins?: number; tictactoePlayed?: number; tictactoeWins?: number }, game: QGameType) {
  if (game === 'rps') return { played: entry.rpsPlayed ?? 0, wins: entry.rpsWins ?? 0 };
  if (game === 'oddoneout') return { played: entry.oddoneoutPlayed ?? 0, wins: entry.oddoneoutWins ?? 0 };
  if (game === 'tictactoe') return { played: entry.tictactoePlayed ?? 0, wins: entry.tictactoeWins ?? 0 };
  return { played: entry.gamesPlayed, wins: entry.wins };
}

export default function QGamesDisplayWidescreen({
  codeId,
  initialConfig,
}: QGamesDisplayWidescreenProps) {
  const config = { ...DEFAULT_QGAMES_CONFIG, ...initialConfig };
  const theme = resolveTheme(config.branding);
  const { entries } = useQGamesLeaderboard(codeId);
  const { stats } = useQGamesStats(codeId);
  const [clock, setClock] = useState('');

  const rankMedals = ['🥇', '🥈', '🥉'];

  // Live clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Find champion per game
  const getChampion = (game: QGameType) => {
    let best = null;
    let bestWins = 0;
    for (const entry of entries) {
      const s = getGameStats(entry, game);
      if (s.wins > bestWins) {
        bestWins = s.wins;
        best = entry;
      }
    }
    return best;
  };

  const enabledGames = config.enabledGames;

  const nameMap: Record<string, string> = {
    rps: 'Rock Paper Scissors',
    oddoneout: 'Odd One Out',
    tictactoe: 'Tic-Tac-Toe',
    memory: 'Memory Match',
  };

  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden p-6"
      style={{ backgroundColor: theme.backgroundColor }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-black" style={{ color: theme.textColor }}>
            🎮 {config.branding.title || 'Q.Games'}
          </h1>
          {stats && (
            <div className="flex gap-4 ml-6">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: theme.accentColor }} />
                <span className="font-bold text-lg tabular-nums" style={{ color: theme.accentColor }}>
                  {stats.playersOnline}
                </span>
                <span className="text-sm" style={{ color: theme.textSecondary }}>online</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: '#f59e0b' }} />
                <span className="font-bold text-lg tabular-nums" style={{ color: '#f59e0b' }}>
                  {stats.matchesInProgress}
                </span>
                <span className="text-sm" style={{ color: theme.textSecondary }}>live</span>
              </div>
            </div>
          )}
        </div>
        <div className="text-2xl font-mono tabular-nums" style={{ color: theme.textSecondary }}>
          {clock}
        </div>
      </div>

      {/* 3-column layout */}
      <div className="flex-1 grid grid-cols-3 gap-6 min-h-0">
        {/* Column 1: Overall Leaderboard */}
        <div className="flex flex-col min-h-0 rounded-2xl p-5 overflow-hidden" style={{ backgroundColor: theme.surfaceColor, border: `1px solid ${theme.borderColor}` }}>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: theme.textColor }}>
            🏆 Overall Leaderboard
          </h2>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1" style={{ scrollbarWidth: 'thin' }}>
            {entries.length === 0 ? (
              <p className="text-center py-12 text-lg" style={{ color: theme.textSecondary }}>
                Waiting for players...
              </p>
            ) : (
              entries.slice(0, 20).map((entry, idx) => {
                const rank = idx + 1;
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-xl"
                    style={{
                      backgroundColor: rank <= 3 ? `${theme.primaryColor}1a` : 'transparent',
                    }}
                  >
                    <div className="w-8 text-center shrink-0">
                      {rank <= 3 ? (
                        <span className="text-xl">{rankMedals[rank - 1]}</span>
                      ) : (
                        <span className="text-sm font-medium" style={{ color: theme.textSecondary }}>{rank}</span>
                      )}
                    </div>
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0 overflow-hidden"
                      style={{
                        backgroundColor: `${theme.textColor}1a`,
                        boxShadow: rank <= 3 ? `0 0 0 2px ${theme.primaryColor}4d` : 'none',
                      }}
                    >
                      {entry.avatarValue.startsWith('http') ? (
                        <img src={entry.avatarValue} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : entry.avatarValue}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate" style={{
                        color: rank === 1 ? '#facc15' : theme.textColor,
                        fontSize: rank <= 3 ? '1rem' : '0.875rem',
                      }}>
                        {entry.nickname}
                      </p>
                      <p className="text-xs" style={{ color: theme.textSecondary }}>
                        {entry.gamesPlayed} games · {entry.wins}W
                      </p>
                    </div>
                    <div className="text-end shrink-0">
                      <p className="font-black tabular-nums" style={{
                        color: rank === 1 ? '#facc15' : theme.textColor,
                        fontSize: rank <= 3 ? '1.5rem' : '1.125rem',
                      }}>
                        {entry.score}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2: Per-Game Champions */}
        <div className="flex flex-col min-h-0 rounded-2xl p-5 overflow-hidden" style={{ backgroundColor: theme.surfaceColor, border: `1px solid ${theme.borderColor}` }}>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: theme.textColor }}>
            👑 Champions
          </h2>
          <div className="flex-1 space-y-4 overflow-y-auto">
            {enabledGames.map((game) => {
              const meta = GAME_META[game];
              const champion = getChampion(game);
              const champStats = champion ? getGameStats(champion, game) : null;

              return (
                <div
                  key={game}
                  className="rounded-xl p-4"
                  style={{ backgroundColor: `${theme.primaryColor}1a`, border: `1px solid ${theme.primaryColor}33` }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">{meta.emoji}</span>
                    <span className="font-bold" style={{ color: theme.textColor }}>
                      {nameMap[game] || game}
                    </span>
                  </div>

                  {champion ? (
                    <div className="flex items-center gap-3">
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center text-2xl overflow-hidden ring-2"
                        style={{ backgroundColor: `${theme.textColor}1a`, '--tw-ring-color': `${theme.accentColor}66` } as React.CSSProperties}
                      >
                        {champion.avatarValue.startsWith('http') ? (
                          <img src={champion.avatarValue} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : champion.avatarValue}
                      </div>
                      <div>
                        <p className="font-bold text-lg" style={{ color: '#facc15' }}>
                          {champion.nickname}
                        </p>
                        <p className="text-sm" style={{ color: theme.textSecondary }}>
                          {champStats?.wins} wins / {champStats?.played} games
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: theme.textSecondary }}>
                      No champion yet
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Column 3: Live Stats */}
        <div className="flex flex-col min-h-0 rounded-2xl p-5 overflow-hidden" style={{ backgroundColor: theme.surfaceColor, border: `1px solid ${theme.borderColor}` }}>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: theme.textColor }}>
            📊 Live Stats
          </h2>
          <div className="space-y-4">
            {/* Big stat cards */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Total Players"
                value={stats?.totalPlayers ?? 0}
                color={theme.primaryColor}
                bg={`${theme.primaryColor}1a`}
              />
              <StatCard
                label="Online Now"
                value={stats?.playersOnline ?? 0}
                color={theme.accentColor}
                bg={`${theme.accentColor}1a`}
              />
              <StatCard
                label="Total Matches"
                value={stats?.totalMatches ?? 0}
                color={theme.textColor}
                bg={`${theme.textColor}0d`}
              />
              <StatCard
                label="In Progress"
                value={stats?.matchesInProgress ?? 0}
                color="#f59e0b"
                bg="rgba(245,158,11,0.1)"
              />
            </div>

            {/* Per-game player counts */}
            <div>
              <h3 className="text-sm font-medium mb-3" style={{ color: theme.textSecondary }}>
                Players per Game
              </h3>
              <div className="space-y-2">
                {enabledGames.map((game) => {
                  const meta = GAME_META[game];
                  const playersInGame = entries.filter(e => {
                    const s = getGameStats(e, game);
                    return s.played > 0;
                  }).length;
                  const totalPlayers = entries.length;
                  const pct = totalPlayers > 0 ? (playersInGame / totalPlayers) * 100 : 0;

                  return (
                    <div key={game}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm" style={{ color: theme.textColor }}>
                          {meta.emoji} {nameMap[game] || game}
                        </span>
                        <span className="text-sm font-bold tabular-nums" style={{ color: theme.accentColor }}>
                          {playersInGame}
                        </span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${theme.textColor}0d` }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, ${theme.primaryColor}, ${theme.accentColor})`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent activity */}
            <div>
              <h3 className="text-sm font-medium mb-3" style={{ color: theme.textSecondary }}>
                Top Win Rates
              </h3>
              <div className="space-y-1.5">
                {entries
                  .filter(e => e.gamesPlayed >= 3)
                  .sort((a, b) => {
                    const aRate = a.gamesPlayed > 0 ? a.wins / a.gamesPlayed : 0;
                    const bRate = b.gamesPlayed > 0 ? b.wins / b.gamesPlayed : 0;
                    return bRate - aRate;
                  })
                  .slice(0, 5)
                  .map((entry) => {
                    const winRate = entry.gamesPlayed > 0 ? Math.round((entry.wins / entry.gamesPlayed) * 100) : 0;
                    return (
                      <div key={entry.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg" style={{ backgroundColor: `${theme.textColor}08` }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm overflow-hidden" style={{ backgroundColor: `${theme.textColor}1a` }}>
                          {entry.avatarValue.startsWith('http') ? (
                            <img src={entry.avatarValue} alt="" className="w-full h-full object-cover" />
                          ) : entry.avatarValue}
                        </div>
                        <span className="flex-1 text-sm truncate" style={{ color: theme.textColor }}>{entry.nickname}</span>
                        <span className="font-bold text-sm tabular-nums" style={{ color: theme.accentColor }}>{winRate}%</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className="rounded-xl p-4 text-center" style={{ backgroundColor: bg }}>
      <p className="text-3xl font-black tabular-nums" style={{ color }}>{value}</p>
      <p className="text-xs mt-1 opacity-60" style={{ color }}>{label}</p>
    </div>
  );
}
