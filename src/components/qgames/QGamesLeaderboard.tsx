'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowLeft, Share2, X } from 'lucide-react';
import { QGamesLeaderboardEntry, QGameType } from '@/types/qgames';
import { useQGamesTheme } from './QGamesThemeContext';

/** Animate a number from 0 to target over duration ms */
function useCountUp(target: number, duration = 800, active = true) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) { setValue(0); return; }
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, active]);

  return value;
}

type GameFilter = 'all' | 'rps' | 'oddoneout' | 'tictactoe' | 'memory';
type SortMode = 'score' | 'winrate';

const MIN_GAMES_FOR_WINRATE = 3;

interface QGamesLeaderboardProps {
  entries: QGamesLeaderboardEntry[];
  currentPlayerId?: string;
  onBack?: () => void;
  shortId?: string;
  enabledGames?: QGameType[];
  isRTL: boolean;
  t: (key: string) => string;
  compact?: boolean;
}

/** Get per-game stats for an entry */
function getGameStats(entry: QGamesLeaderboardEntry, filter: GameFilter) {
  if (filter === 'rps') {
    const played = entry.rpsPlayed ?? 0;
    const wins = entry.rpsWins ?? 0;
    // Subtract other games' approximate scores (wins*3) from total
    const oooScore = (entry.oddoneoutWins ?? 0) * 3;
    const tttScore = (entry.tictactoeWins ?? 0) * 3;
    const score = Math.max(0, entry.score - oooScore - tttScore);
    return { played, wins, score };
  }
  if (filter === 'oddoneout') {
    const played = entry.oddoneoutPlayed ?? 0;
    const wins = entry.oddoneoutWins ?? 0;
    return { played, wins, score: wins * 3 };
  }
  if (filter === 'tictactoe') {
    const played = entry.tictactoePlayed ?? 0;
    const wins = entry.tictactoeWins ?? 0;
    // Subtract other games' approximate scores from total
    const oooScore = (entry.oddoneoutWins ?? 0) * 3;
    const rpsScore = (entry.rpsWins ?? 0) * 3;
    const score = Math.max(0, entry.score - oooScore - rpsScore);
    return { played, wins, score };
  }
  if (filter === 'memory') {
    const played = entry.memoryPlayed ?? 0;
    const wins = entry.memoryWins ?? 0;
    return { played, wins, score: wins * 3 };
  }
  return { played: entry.gamesPlayed, wins: entry.wins, score: entry.score };
}

export default function QGamesLeaderboard({
  entries,
  currentPlayerId,
  onBack,
  shortId,
  enabledGames,
  isRTL,
  t,
  compact = false,
}: QGamesLeaderboardProps) {
  const theme = useQGamesTheme();
  const rankMedals = ['🥇', '🥈', '🥉'];
  const [selectedPlayer, setSelectedPlayer] = useState<QGamesLeaderboardEntry | null>(null);
  const [gameFilter, setGameFilter] = useState<GameFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('score');

  // Available game tabs based on enabled games
  const gameTabs = useMemo(() => {
    const tabs: { key: GameFilter; label: string }[] = [
      { key: 'all', label: t('allGames') },
    ];
    if (!enabledGames || enabledGames.includes('rps')) {
      tabs.push({ key: 'rps', label: t('rps') });
    }
    if (!enabledGames || enabledGames.includes('oddoneout')) {
      tabs.push({ key: 'oddoneout', label: t('oddoneout') });
    }
    if (!enabledGames || enabledGames.includes('tictactoe')) {
      tabs.push({ key: 'tictactoe', label: t('tictactoe') });
    }
    if (!enabledGames || enabledGames.includes('memory')) {
      tabs.push({ key: 'memory', label: t('memory') });
    }
    return tabs;
  }, [enabledGames, t]);


  // Filter + sort entries
  const sortedEntries = useMemo(() => {
    let filtered = entries;

    // Filter by game: only show players who played that game
    if (gameFilter !== 'all') {
      filtered = entries.filter(e => {
        const stats = getGameStats(e, gameFilter);
        return stats.played > 0;
      });
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      const aStats = getGameStats(a, gameFilter);
      const bStats = getGameStats(b, gameFilter);

      if (sortMode === 'winrate') {
        const aHasMin = aStats.played >= MIN_GAMES_FOR_WINRATE;
        const bHasMin = bStats.played >= MIN_GAMES_FOR_WINRATE;
        // Players with min games come first
        if (aHasMin !== bHasMin) return aHasMin ? -1 : 1;
        const aRate = aStats.played > 0 ? aStats.wins / aStats.played : 0;
        const bRate = bStats.played > 0 ? bStats.wins / bStats.played : 0;
        if (bRate !== aRate) return bRate - aRate;
        // Tiebreak: more games played is better when same rate
        return bStats.played - aStats.played;
      }

      // Sort by score (default — only for 'all' tab)
      if (bStats.score !== aStats.score) return bStats.score - aStats.score;
      if (bStats.wins !== aStats.wins) return bStats.wins - aStats.wins;
      return aStats.played - bStats.played; // Less games = better
    });

    // Cap at 50 entries
    return sorted.slice(0, 50);
  }, [entries, gameFilter, sortMode]);

  const topEntries = compact ? sortedEntries.slice(0, 10) : sortedEntries; // sortedEntries already capped at 50

  const gameUrl = shortId ? `https://qr.playzones.app/v/${shortId}` : '';

  const handleShareWhatsApp = () => {
    if (!gameUrl) return;
    const top3 = topEntries.slice(0, 3).map((e, i) =>
      `${rankMedals[i]} ${e.nickname} - ${e.score} ${t('pts')}`
    ).join('\n');

    const text = `🏆 ${t('leaderboard')}\n\n${top3}\n\n${t('joinAndPlay')}\n${gameUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };


  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className={compact ? '' : 'min-h-screen flex flex-col p-4'}>
      {/* Header */}
      {!compact && (
        <div className="flex items-center gap-3 mb-4">
          {onBack && (
            <button
              onClick={onBack}
              className="text-white/40 hover:text-white/60 transition-colors p-1"
            >
              <ArrowLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
            </button>
          )}
          <h2 className="font-bold text-xl flex-1" style={{ color: theme.textColor }}>🏆 {t('leaderboard')}</h2>
          {shortId && (
            <button
              onClick={handleShareWhatsApp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{ backgroundColor: `${theme.accentColor}26`, color: theme.accentColor }}
            >
              <Share2 className="w-4 h-4" />
              {t('share')}
            </button>
          )}
        </div>
      )}

      {/* Game Filter Tabs */}
      {!compact && gameTabs.length > 1 && (
        <div className="flex gap-1.5 mb-3">
          {gameTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setGameFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                gameFilter === tab.key
                  ? 'bg-white/10 text-white ring-1 ring-white/20'
                  : 'bg-white/[0.03] text-white/40 hover:bg-white/[0.06]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Sort Toggle */}
      {!compact && (
        <div className="flex gap-1 mb-3">
          <button
            onClick={() => setSortMode('score')}
            className="px-2.5 py-1 rounded-md text-[10px] font-medium transition-all"
            style={sortMode === 'score'
              ? { backgroundColor: `${theme.accentColor}26`, color: theme.accentColor }
              : { color: 'rgba(255,255,255,0.3)' }}
          >
            {t('byScore')}
          </button>
          <button
            onClick={() => setSortMode('winrate')}
            className="px-2.5 py-1 rounded-md text-[10px] font-medium transition-all"
            style={sortMode === 'winrate'
              ? { backgroundColor: `${theme.accentColor}26`, color: theme.accentColor }
              : { color: 'rgba(255,255,255,0.3)' }}
          >
            % {t('byWinRate')}
          </button>
        </div>
      )}

      {/* Leaderboard List */}
      <div className="space-y-1.5">
        {topEntries.length === 0 && (
          <p className="text-white/30 text-sm text-center py-8">{t('noPlayersYet')}</p>
        )}

        {topEntries.map((entry, idx) => {
          const isMe = entry.id === currentPlayerId;
          const rank = idx + 1;
          const medal = rank <= 3 ? rankMedals[rank - 1] : null;
          const stats = getGameStats(entry, gameFilter);
          const winRate = stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0;
          const belowMinGames = sortMode === 'winrate' && stats.played < MIN_GAMES_FOR_WINRATE;

          return (
            <div
              key={entry.id}
              onClick={() => setSelectedPlayer(entry)}
              className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors cursor-pointer ${
                isMe
                  ? 'ring-1'
                  : belowMinGames
                    ? 'bg-white/[0.01] opacity-50'
                    : 'bg-white/[0.02] hover:bg-white/[0.04]'
              }`}
              style={isMe ? {
                backgroundColor: `${theme.accentColor}1a`,
                '--tw-ring-color': `${theme.accentColor}4d`,
              } as React.CSSProperties : undefined}
            >
              {/* Rank */}
              <div className="w-8 text-center shrink-0">
                {medal && !belowMinGames ? (
                  <span className="text-lg">{medal}</span>
                ) : (
                  <span className="text-white/30 text-sm font-medium">{rank}</span>
                )}
              </div>

              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-lg shrink-0 overflow-hidden ${isMe ? 'ring-1' : ''}`}
                style={isMe ? { '--tw-ring-color': `${theme.accentColor}4d` } as React.CSSProperties : undefined}
              >
                {entry.avatarValue.startsWith('http') ? (
                  <img
                    src={entry.avatarValue}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : entry.avatarValue}
              </div>

              {/* Name + Stats */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: isMe ? theme.accentColor : 'white' }}>
                  {entry.nickname}
                  {isMe && <span className="text-xs ml-1" style={{ color: `${theme.accentColor}99` }}>({t('you')})</span>}
                </p>
                <p className="text-white/30 text-[10px]">
                  {stats.played} {t('games')} · {stats.wins}{t('winsShort')} · {winRate}%
                </p>
              </div>

              {/* Score or Win Rate */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-end">
                  {sortMode === 'winrate' ? (
                    <>
                      <p className="font-bold tabular-nums" style={{ color: isMe ? theme.accentColor : 'white' }}>
                        {winRate}%
                      </p>
                      <p className="text-white/20 text-[10px]">{stats.wins}/{stats.played}</p>
                    </>
                  ) : (
                    <>
                      <p className="font-bold tabular-nums" style={{ color: isMe ? theme.accentColor : 'white' }}>
                        {stats.score}
                      </p>
                      <p className="text-white/20 text-[10px]">{t('pts')}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Min games notice */}
      {sortMode === 'winrate' && topEntries.some(e => getGameStats(e, gameFilter).played < MIN_GAMES_FOR_WINRATE) && (
        <p className="text-white/20 text-[10px] text-center mt-2">
          {t('minGames')}
        </p>
      )}

      {/* Player Stats Modal */}
      {selectedPlayer && (
        <PlayerStatsModal
          player={selectedPlayer}
          rankMedals={rankMedals}
          isRTL={isRTL}
          t={t}
          isCurrentPlayer={selectedPlayer.id === currentPlayerId}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}

/** Animated stat card inside the modal */
function AnimatedStat({ value, suffix, label, color, delay, bg }: {
  value: number; suffix?: string; label: string; color: string; delay: number; bg: string;
}) {
  const [visible, setVisible] = useState(false);
  const count = useCountUp(value, 700, visible);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      className={`${bg} rounded-xl p-3 text-center transition-all duration-500 ${
        visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-3 scale-95'
      }`}
    >
      <p className={`${color} font-black text-2xl tabular-nums`}>
        {count}{suffix}
      </p>
      <p className={`${color} opacity-50 text-xs mt-0.5`}>{label}</p>
    </div>
  );
}

/** Per-game stat row in modal */
function GameStatRow({ label, played, wins, delay, t }: {
  label: string; played: number; wins: number; delay: number; t: (key: string) => string;
}) {
  const [visible, setVisible] = useState(false);
  const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (played === 0) return null;

  return (
    <div className={`px-3 py-2.5 bg-white/[0.03] rounded-lg transition-all duration-400 ${
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
    }`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-white/70 text-xs font-medium">{label}</span>
        <span className="text-xs font-bold tabular-nums" style={{ color: '#10b981' }}>{winRate}%</span>
      </div>
      <div className="flex items-center gap-3 text-white/40 text-[10px]">
        <span>{played} {t('games')}</span>
        <span>{wins} {t('winsLabel')}</span>
        <span>{played - wins} {t('lossesLabel')}</span>
      </div>
    </div>
  );
}

/** Player stats modal with count-up animations */
function PlayerStatsModal({ player, rankMedals, isRTL, t, isCurrentPlayer, onClose }: {
  player: QGamesLeaderboardEntry;
  rankMedals: string[];
  isRTL: boolean;
  t: (key: string) => string;
  isCurrentPlayer: boolean;
  onClose: () => void;
}) {
  const winRate = player.gamesPlayed > 0
    ? Math.round((player.wins / player.gamesPlayed) * 100)
    : 0;

  const hasPerGameStats = (player.rpsPlayed ?? 0) > 0 || (player.oddoneoutPlayed ?? 0) > 0 || (player.tictactoePlayed ?? 0) > 0 || (player.memoryPlayed ?? 0) > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a2e] rounded-2xl w-full max-w-xs p-5 relative animate-in zoom-in-95 duration-200"
        dir={isRTL ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 end-3 text-white/30 hover:text-white/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Player header */}
        <div className="flex flex-col items-center mb-5">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-3xl overflow-hidden mb-2">
            {player.avatarValue.startsWith('http') ? (
              <img
                src={player.avatarValue}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : player.avatarValue}
          </div>
          <h3 className="text-white font-bold text-lg">{player.nickname}</h3>
          <div className="flex items-center gap-2 mt-1">
            {player.rank <= 3 ? (
              <span className="text-lg">{rankMedals[player.rank - 1]}</span>
            ) : (
              <span className="text-white/40 text-sm">#{player.rank}</span>
            )}
            <span className="font-bold" style={{ color: '#10b981' }}>{player.score} {t('pts')}</span>
          </div>
        </div>

        {/* Animated stats grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <AnimatedStat value={player.gamesPlayed} label={t('gamesPlayedLabel')} color="text-white" bg="bg-white/5" delay={0} />
          <AnimatedStat value={winRate} suffix="%" label={t('winRate')} color="text-white" bg="bg-white/5" delay={80} />
          <AnimatedStat value={player.wins} label={t('winsLabel')} color="text-green-400" bg="bg-green-500/10" delay={160} />
          <AnimatedStat value={player.losses} label={t('lossesLabel')} color="text-red-400" bg="bg-red-500/10" delay={240} />
        </div>

        {/* Per-game breakdown */}
        {hasPerGameStats && (
          <div className="mt-3 space-y-1.5">
            <GameStatRow label={t('rps')} played={player.rpsPlayed ?? 0} wins={player.rpsWins ?? 0} delay={320} t={t} />
            <GameStatRow label={t('oddoneout')} played={player.oddoneoutPlayed ?? 0} wins={player.oddoneoutWins ?? 0} delay={400} t={t} />
            <GameStatRow label={t('tictactoe')} played={player.tictactoePlayed ?? 0} wins={player.tictactoeWins ?? 0} delay={480} t={t} />
            <GameStatRow label={t('memory')} played={player.memoryPlayed ?? 0} wins={player.memoryWins ?? 0} delay={560} t={t} />
          </div>
        )}

      </div>
    </div>
  );
}
