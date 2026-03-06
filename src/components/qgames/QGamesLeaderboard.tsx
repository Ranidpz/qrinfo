'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowLeft, ChevronDown, Share2, X, SlidersHorizontal } from 'lucide-react';
import { QGamesLeaderboardEntry, QGamesMatch, QGameType, GAME_META, getRankForScore } from '@/types/qgames';
import { getBorderStyle } from './QGamesAvatarBorder';
import { RANK_ICONS } from './QGamesRankBadge';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
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

type GameFilter = 'all' | 'rps' | 'oddoneout' | 'tictactoe' | 'connect4' | 'memory' | 'frogger';
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
  codeId?: string;
  children?: React.ReactNode;
}

/** Get per-game stats for an entry */
function getGameStats(entry: QGamesLeaderboardEntry, filter: GameFilter) {
  if (filter === 'rps') {
    const played = entry.rpsPlayed ?? 0;
    const wins = entry.rpsWins ?? 0;
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
    const oooScore = (entry.oddoneoutWins ?? 0) * 3;
    const rpsScore = (entry.rpsWins ?? 0) * 3;
    const score = Math.max(0, entry.score - oooScore - rpsScore);
    return { played, wins, score };
  }
  if (filter === 'connect4') {
    const played = entry.connect4Played ?? 0;
    const wins = entry.connect4Wins ?? 0;
    return { played, wins, score: wins * 3 };
  }
  if (filter === 'memory') {
    const played = entry.memoryPlayed ?? 0;
    const wins = entry.memoryWins ?? 0;
    return { played, wins, score: wins * 3 };
  }
  if (filter === 'frogger') {
    const played = entry.froggerPlayed ?? 0;
    const wins = entry.froggerWins ?? 0;
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
  codeId,
  children,
}: QGamesLeaderboardProps) {
  const theme = useQGamesTheme();
  const rankMedals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
  const [selectedPlayer, setSelectedPlayer] = useState<QGamesLeaderboardEntry | null>(null);
  const [gameFilter, setGameFilter] = useState<GameFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('score');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Available game tabs based on enabled games
  const gameTabs = useMemo(() => {
    const tabs: { key: GameFilter; label: string; emoji: string }[] = [
      { key: 'all', label: t('allGames'), emoji: '' },
    ];
    if (!enabledGames || enabledGames.includes('rps')) {
      tabs.push({ key: 'rps', label: t('rps'), emoji: GAME_META.rps.emoji });
    }
    if (!enabledGames || enabledGames.includes('oddoneout')) {
      tabs.push({ key: 'oddoneout', label: t('oddoneout'), emoji: GAME_META.oddoneout.emoji });
    }
    if (!enabledGames || enabledGames.includes('tictactoe')) {
      tabs.push({ key: 'tictactoe', label: t('tictactoe'), emoji: GAME_META.tictactoe.emoji });
    }
    if (!enabledGames || enabledGames.includes('connect4')) {
      tabs.push({ key: 'connect4', label: t('connect4'), emoji: GAME_META.connect4.emoji });
    }
    if (!enabledGames || enabledGames.includes('memory')) {
      tabs.push({ key: 'memory', label: t('memory'), emoji: GAME_META.memory.emoji });
    }
    return tabs;
  }, [enabledGames, t]);

  // Filter + sort entries
  const sortedEntries = useMemo(() => {
    let filtered = entries;

    if (gameFilter !== 'all') {
      filtered = entries.filter(e => {
        const stats = getGameStats(e, gameFilter);
        return stats.played > 0;
      });
    }

    const sorted = [...filtered].sort((a, b) => {
      const aStats = getGameStats(a, gameFilter);
      const bStats = getGameStats(b, gameFilter);

      if (sortMode === 'winrate') {
        const aHasMin = aStats.played >= MIN_GAMES_FOR_WINRATE;
        const bHasMin = bStats.played >= MIN_GAMES_FOR_WINRATE;
        if (aHasMin !== bHasMin) return aHasMin ? -1 : 1;
        const aRate = aStats.played > 0 ? aStats.wins / aStats.played : 0;
        const bRate = bStats.played > 0 ? bStats.wins / bStats.played : 0;
        if (bRate !== aRate) return bRate - aRate;
        return bStats.played - aStats.played;
      }

      if (bStats.score !== aStats.score) return bStats.score - aStats.score;
      if (bStats.wins !== aStats.wins) return bStats.wins - aStats.wins;
      return aStats.played - bStats.played;
    });

    return sorted.slice(0, 50);
  }, [entries, gameFilter, sortMode]);

  const topEntries = compact ? sortedEntries.slice(0, 10) : sortedEntries;

  const gameUrl = shortId ? `https://qr.playzones.app/v/${shortId}` : '';

  const handleShareWhatsApp = () => {
    if (!gameUrl) return;
    const top3 = topEntries.slice(0, 3).map((e, i) =>
      `${rankMedals[i]} ${e.nickname} - ${e.score} ${t('pts')}`
    ).join('\n');

    const text = `\u{1F3C6} ${t('leaderboard')}\n\n${top3}\n\n${t('joinAndPlay')}\n${gameUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Active filter label for the button
  const activeFilterLabel = gameTabs.find(tab => tab.key === gameFilter)?.label || t('allGames');
  const hasActiveFilter = gameFilter !== 'all' || sortMode !== 'score';

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className={compact ? '' : 'fixed inset-0 flex flex-col'} style={compact ? undefined : { backgroundColor: theme.backgroundColor }}>
      {/* Custom keyframes */}
      <style>{`
        @keyframes leaderboardRowIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes filterPanelIn {
          from { opacity: 0; max-height: 0; transform: translateY(-4px); }
          to { opacity: 1; max-height: 200px; transform: translateY(0); }
        }
        @keyframes filterPanelOut {
          from { opacity: 1; max-height: 200px; }
          to { opacity: 0; max-height: 0; }
        }
      `}</style>

      {/* Fixed Header + Filters */}
      {!compact && (
        <div className="shrink-0 px-4 pt-4 pb-1">
          <div className="flex items-center gap-3 mb-3">
            {onBack && (
              <button
                onClick={onBack}
                className="text-white/40 hover:text-white/60 transition-colors p-1"
              >
                <ArrowLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
              </button>
            )}
            <h2 className="font-bold text-lg flex-1" style={{ color: theme.textColor }}>
              {t('leaderboard')}
            </h2>

            <div className="flex items-center gap-2">
              {/* Filter toggle button */}
              {gameTabs.length > 1 && (
                <button
                  onClick={() => setFiltersOpen(!filtersOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    backgroundColor: hasActiveFilter ? `${theme.accentColor}20` : 'rgba(255,255,255,0.05)',
                    color: hasActiveFilter ? theme.accentColor : 'rgba(255,255,255,0.5)',
                  }}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  {gameFilter !== 'all' && <span className="truncate max-w-[80px]">{activeFilterLabel}</span>}
                  <ChevronDown className={`w-3 h-3 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
                </button>
              )}

              {/* Share button */}
              {shortId && (
                <button
                  onClick={handleShareWhatsApp}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ backgroundColor: `${theme.accentColor}20`, color: theme.accentColor }}
                >
                  <Share2 className="w-3.5 h-3.5" />
                  {t('share')}
                </button>
              )}
            </div>
          </div>

          {/* Collapsible Filter Panel */}
          {filtersOpen && (
            <div
              className="mb-2 rounded-xl overflow-hidden"
              style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                animation: 'filterPanelIn 0.25s ease-out forwards',
              }}
            >
              <div className="p-3 space-y-2.5">
                {/* Game filter chips */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/25 mb-1.5">{t('filterByGame')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {gameTabs.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setGameFilter(tab.key)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={gameFilter === tab.key
                          ? { backgroundColor: `${theme.accentColor}26`, color: theme.accentColor, boxShadow: `0 0 0 1px ${theme.accentColor}40` }
                          : { backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)' }}
                      >
                        {tab.emoji && <span className="me-1">{tab.emoji}</span>}
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sort toggle */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/25 mb-1.5">{t('sortBy')}</p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setSortMode('score')}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={sortMode === 'score'
                        ? { backgroundColor: `${theme.accentColor}26`, color: theme.accentColor, boxShadow: `0 0 0 1px ${theme.accentColor}40` }
                        : { backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)' }}
                    >
                      {t('byScore')}
                    </button>
                    <button
                      onClick={() => setSortMode('winrate')}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={sortMode === 'winrate'
                        ? { backgroundColor: `${theme.accentColor}26`, color: theme.accentColor, boxShadow: `0 0 0 1px ${theme.accentColor}40` }
                        : { backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)' }}
                    >
                      % {t('byWinRate')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Leaderboard List (scrollable) */}
      <div className={compact ? 'space-y-1' : 'space-y-1 px-4 pb-24 flex-1 overflow-y-auto'} style={compact ? undefined : { scrollbarWidth: 'none' as const }}>
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
          const isCompact = rank > 5 && !isMe;

          return (
            <div
              key={entry.id}
              onClick={() => setSelectedPlayer(entry)}
              className={`flex items-center gap-2.5 rounded-xl transition-colors cursor-pointer active:scale-[0.98] ${
                isMe
                  ? 'ring-1'
                  : belowMinGames
                    ? 'opacity-50'
                    : ''
              }`}
              style={{
                padding: isCompact ? '6px 10px' : '8px 12px',
                backgroundColor: isMe ? `${theme.accentColor}1a` : rank <= 3 ? 'rgba(255,255,255,0.03)' : 'transparent',
                ...(isMe ? { '--tw-ring-color': `${theme.accentColor}4d` } as React.CSSProperties : {}),
                animation: mounted ? `leaderboardRowIn 0.4s ease-out ${idx * 30}ms backwards` : 'none',
              }}
            >
              {/* Rank */}
              <div className="w-7 text-center shrink-0">
                {medal && !belowMinGames ? (
                  <span className={isCompact ? 'text-base' : 'text-lg'}>{medal}</span>
                ) : (
                  <span className="text-white/30 text-xs font-medium tabular-nums">{rank}</span>
                )}
              </div>

              {/* Avatar */}
              <div
                className={`rounded-full bg-white/10 flex items-center justify-center shrink-0 overflow-hidden ${isMe && !entry.equippedBorder ? 'ring-1' : ''}`}
                style={{
                  width: isCompact ? 28 : 34,
                  height: isCompact ? 28 : 34,
                  fontSize: isCompact ? '0.85rem' : '1.05rem',
                  ...(entry.equippedBorder ? getBorderStyle(entry.equippedBorder) : {}),
                  ...(isMe && !entry.equippedBorder ? { '--tw-ring-color': `${theme.accentColor}4d` } as React.CSSProperties : {}),
                }}
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
                <div className="flex items-center gap-1">
                  <p className="font-semibold truncate" style={{
                    color: isMe ? theme.accentColor : 'white',
                    fontSize: isCompact ? '0.8rem' : '0.875rem',
                  }}>
                    {entry.nickname}
                    {isMe && <span className="text-xs ms-1" style={{ color: `${theme.accentColor}99` }}>({t('you')})</span>}
                  </p>
                  {!isCompact && (() => { const r = getRankForScore(stats.score); const Icon = RANK_ICONS[r.id]; return r.id !== 'rookie' && Icon ? <Icon size={13} className="shrink-0" style={{ color: r.color }} /> : null; })()}
                </div>
                {!isCompact && (
                  <p className="text-white/30 text-[10px]">
                    {stats.played} {t('games')} · {stats.wins}{t('winsShort')} · {winRate}%
                  </p>
                )}
              </div>

              {/* Score or Win Rate */}
              <div className="text-end shrink-0">
                {sortMode === 'winrate' ? (
                  <>
                    <p className="font-bold tabular-nums" style={{
                      color: isMe ? theme.accentColor : 'white',
                      fontSize: isCompact ? '0.85rem' : '1rem',
                    }}>
                      {winRate}%
                    </p>
                    {!isCompact && <p className="text-white/20 text-[10px]">{stats.wins}/{stats.played}</p>}
                  </>
                ) : (
                  <>
                    <p className="font-bold tabular-nums" style={{
                      color: isMe ? theme.accentColor : rank === 1 ? '#facc15' : 'white',
                      fontSize: isCompact ? '0.85rem' : rank <= 3 ? '1.15rem' : '1rem',
                    }}>
                      {stats.score}
                    </p>
                    {!isCompact && <p className="text-white/20 text-[10px]">{t('pts')}</p>}
                  </>
                )}
              </div>
            </div>
          );
        })}

        {/* Min games notice */}
        {sortMode === 'winrate' && topEntries.some(e => getGameStats(e, gameFilter).played < MIN_GAMES_FOR_WINRATE) && (
          <p className="text-white/20 text-[10px] text-center mt-2">
            {t('minGames')}
          </p>
        )}

        {/* Extra content (e.g. match history) rendered inside scrollable area */}
        {children}
      </div>

      {/* Player Stats Modal */}
      {selectedPlayer && (
        <PlayerStatsModal
          player={selectedPlayer}
          rankMedals={rankMedals}
          isRTL={isRTL}
          t={t}
          isCurrentPlayer={selectedPlayer.id === currentPlayerId}
          onClose={() => setSelectedPlayer(null)}
          codeId={codeId}
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
    <div className={`px-3 py-2 bg-white/[0.03] rounded-lg transition-all duration-400 ${
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
    }`}>
      <div className="flex items-center justify-between mb-0.5">
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

/** Time ago helper */
function getTimeAgo(timestamp: number, isRTL: boolean): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return isRTL ? 'עכשיו' : 'now';
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    return isRTL ? `${m} דק׳` : `${m}m`;
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    return isRTL ? `${h} שע׳` : `${h}h`;
  }
  const d = Math.floor(seconds / 86400);
  return isRTL ? `${d} ימים` : `${d}d`;
}

/** Recent matches for a specific player */
function PlayerMatchHistory({ playerId, codeId, isRTL, t }: {
  playerId: string;
  codeId: string;
  isRTL: boolean;
  t: (key: string) => string;
}) {
  const [matches, setMatches] = useState<QGamesMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function fetchMatches() {
      try {
        const matchesRef = collection(db, 'codes', codeId, 'qgames_matches');
        const q = query(matchesRef, orderBy('finishedAt', 'desc'), limit(30));
        const snapshot = await getDocs(q);
        const allMatches = snapshot.docs.map(doc => doc.data() as QGamesMatch);
        const playerMatches = allMatches.filter(m =>
          m.player1Id === playerId || m.player2Id === playerId || m.player3Id === playerId ||
          m.memoryResults?.some(r => r.id === playerId)
        );
        setMatches(playerMatches);
      } catch (error) {
        console.error('Error fetching player matches:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchMatches();
  }, [codeId, playerId]);

  if (loading || matches.length === 0) return null;

  const displayMatches = expanded ? matches : matches.slice(0, 3);

  return (
    <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1.5">{t('recentMatchesPlayer')}</p>
      <div className="space-y-1">
        {displayMatches.map((match, idx) => {
          const is3Player = !!match.player3Id;
          const isMemory = match.gameType === 'memory' && match.memoryResults;
          const meta = GAME_META[match.gameType];

          let result: 'win' | 'loss' | 'draw';
          if (is3Player) {
            result = match.winnerIds?.includes(playerId) ? 'win' : 'loss';
          } else if (isMemory) {
            const playerResult = match.memoryResults!.find(r => r.id === playerId);
            const maxScore = Math.max(...match.memoryResults!.map(r => r.score));
            result = playerResult?.score === maxScore ? 'win' : 'loss';
          } else {
            result = match.winnerId === playerId ? 'win' : match.winnerId === null ? 'draw' : 'loss';
          }

          const opponents: { nickname: string; avatarValue: string }[] = [];
          if (isMemory) {
            match.memoryResults!
              .filter(r => r.id !== playerId)
              .forEach(r => opponents.push({ nickname: r.nickname, avatarValue: r.avatarValue }));
          } else {
            if (match.player1Id !== playerId) opponents.push({ nickname: match.player1Nickname, avatarValue: match.player1AvatarValue });
            if (match.player2Id !== playerId) opponents.push({ nickname: match.player2Nickname, avatarValue: match.player2AvatarValue });
            if (match.player3Id && match.player3Id !== playerId) opponents.push({ nickname: match.player3Nickname!, avatarValue: match.player3AvatarValue! });
          }

          let scoreText = '';
          if (isMemory) {
            const playerResult = match.memoryResults!.find(r => r.id === playerId);
            scoreText = `${playerResult?.score ?? 0}`;
          } else if (match.player1Id === playerId) {
            scoreText = `${match.player1Score}-${match.player2Score}`;
          } else {
            scoreText = `${match.player2Score}-${match.player1Score}`;
          }

          const resultColor = result === 'win' ? 'bg-emerald-500/10' : result === 'loss' ? 'bg-red-500/10' : 'bg-yellow-500/10';
          const resultTextColor = result === 'win' ? 'text-emerald-400' : result === 'loss' ? 'text-red-400' : 'text-yellow-400';
          const resultLabel = result === 'win' ? t('won') : result === 'loss' ? t('lost') : t('drew');
          const timeAgo = getTimeAgo(match.finishedAt || match.startedAt, isRTL);

          return (
            <div
              key={match.id}
              className={`flex items-center gap-2 py-1.5 px-2 rounded-lg ${resultColor}`}
            >
              <span className="text-sm shrink-0">{meta?.emoji || ''}</span>
              <div className="flex -space-x-1.5 shrink-0">
                {opponents.slice(0, 3).map((opp, i) => (
                  <div
                    key={i}
                    className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] overflow-hidden ring-1 ring-[#1a1a2e]"
                  >
                    {opp.avatarValue.startsWith('http') ? (
                      <img src={opp.avatarValue} alt="" className="w-full h-full object-cover" />
                    ) : opp.avatarValue}
                  </div>
                ))}
              </div>
              <span className="text-white/60 text-[10px] truncate min-w-0 flex-1">
                {opponents.length === 1
                  ? opponents[0].nickname
                  : opponents.slice(0, 2).map(o => o.nickname).join(', ')}
              </span>
              <span className="text-white/40 text-[9px] font-mono tabular-nums shrink-0">{scoreText}</span>
              <span className={`${resultTextColor} text-[9px] font-bold shrink-0`}>{resultLabel}</span>
              <span className="text-white/20 text-[9px] shrink-0">{timeAgo}</span>
            </div>
          );
        })}
      </div>

      {matches.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-center gap-1 w-full mt-1 py-1 text-white/30 hover:text-white/50 text-[10px] transition-colors"
        >
          {expanded ? t('showLess') : `${t('showAll')} (${matches.length})`}
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
}

/** Player stats modal with count-up animations */
function PlayerStatsModal({ player, rankMedals, isRTL, t, isCurrentPlayer, onClose, codeId }: {
  player: QGamesLeaderboardEntry;
  rankMedals: string[];
  isRTL: boolean;
  t: (key: string) => string;
  isCurrentPlayer: boolean;
  onClose: () => void;
  codeId?: string;
}) {
  const winRate = player.gamesPlayed > 0
    ? Math.round((player.wins / player.gamesPlayed) * 100)
    : 0;

  const hasPerGameStats = (player.rpsPlayed ?? 0) > 0 || (player.oddoneoutPlayed ?? 0) > 0 || (player.tictactoePlayed ?? 0) > 0 || (player.connect4Played ?? 0) > 0 || (player.memoryPlayed ?? 0) > 0 || (player.froggerPlayed ?? 0) > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a2e] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-xs p-5 pb-8 sm:pb-5 relative animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 max-h-[85vh] overflow-y-auto"
        dir={isRTL ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
        style={{ scrollbarWidth: 'none' }}
      >
        {/* Drag handle (mobile) */}
        <div className="sm:hidden flex justify-center mb-3">
          <div className="w-10 h-1 rounded-full bg-white/15" />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 end-3 text-white/30 hover:text-white/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Player header */}
        <div className="flex flex-col items-center mb-4">
          <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-2xl overflow-hidden mb-2" style={player.equippedBorder ? getBorderStyle(player.equippedBorder) : {}}>
            {player.avatarValue.startsWith('http') ? (
              <img
                src={player.avatarValue}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : player.avatarValue}
          </div>
          <h3 className="text-white font-bold text-base">{player.nickname}</h3>
          {(() => {
            const playerRank = getRankForScore(player.score);
            const Icon = RANK_ICONS[playerRank.id];
            return (
              <div className="flex items-center gap-1 mt-0.5">
                {Icon && <Icon size={16} style={{ color: playerRank.color }} />}
                <span className="text-xs font-medium" style={{ color: playerRank.color }}>
                  {isRTL ? playerRank.nameHe : playerRank.nameEn}
                </span>
              </div>
            );
          })()}
          {player.equippedTitle && (
            <p className="text-[10px] mt-0.5" style={{ color: '#c084fc' }}>
              {player.equippedTitle}
            </p>
          )}
          <div className="flex items-center gap-2 mt-0.5">
            {player.rank <= 3 ? (
              <span className="text-base">{rankMedals[player.rank - 1]}</span>
            ) : (
              <span className="text-white/40 text-xs">#{player.rank}</span>
            )}
            <span className="font-bold text-sm" style={{ color: '#10b981' }}>{player.score} {t('pts')}</span>
          </div>
        </div>

        {/* Animated stats grid */}
        <div className="grid grid-cols-2 gap-2">
          <AnimatedStat value={player.gamesPlayed} label={t('gamesPlayedLabel')} color="text-white" bg="bg-white/5" delay={0} />
          <AnimatedStat value={winRate} suffix="%" label={t('winRate')} color="text-white" bg="bg-white/5" delay={80} />
          <AnimatedStat value={player.wins} label={t('winsLabel')} color="text-green-400" bg="bg-green-500/10" delay={160} />
          <AnimatedStat value={player.losses} label={t('lossesLabel')} color="text-red-400" bg="bg-red-500/10" delay={240} />
        </div>

        {/* Per-game breakdown */}
        {hasPerGameStats && (
          <div className="mt-2.5 space-y-1">
            <GameStatRow label={t('rps')} played={player.rpsPlayed ?? 0} wins={player.rpsWins ?? 0} delay={320} t={t} />
            <GameStatRow label={t('oddoneout')} played={player.oddoneoutPlayed ?? 0} wins={player.oddoneoutWins ?? 0} delay={400} t={t} />
            <GameStatRow label={t('tictactoe')} played={player.tictactoePlayed ?? 0} wins={player.tictactoeWins ?? 0} delay={480} t={t} />
            <GameStatRow label={t('connect4')} played={player.connect4Played ?? 0} wins={player.connect4Wins ?? 0} delay={560} t={t} />
            <GameStatRow label={t('memory')} played={player.memoryPlayed ?? 0} wins={player.memoryWins ?? 0} delay={640} t={t} />
            <GameStatRow label={t('frogger')} played={player.froggerPlayed ?? 0} wins={player.froggerWins ?? 0} delay={720} t={t} />
          </div>
        )}

        {/* Recent matches */}
        {codeId && (
          <PlayerMatchHistory playerId={player.id} codeId={codeId} isRTL={isRTL} t={t} />
        )}
      </div>
    </div>
  );
}
