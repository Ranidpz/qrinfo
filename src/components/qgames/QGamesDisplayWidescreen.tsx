'use client';

import { useState, useEffect, useRef } from 'react';
import { QGamesConfig, DEFAULT_QGAMES_CONFIG, resolveTheme, GAME_META, QGameType } from '@/types/qgames';
import { useQGamesLeaderboard, useQGamesStats } from '@/hooks/useQGamesRealtime';

// ─── Translations ──────────────────────────────────────────────
const translations: Record<string, Record<string, string>> = {
  he: {
    online: 'מחוברים',
    live: 'משחקים עכשיו',
    overallLeaderboard: 'טבלת מובילים',
    waitingForPlayers: 'מחכים לשחקנים...',
    games: 'משחקים',
    winsShort: 'נ',
    pts: 'נק׳',
    champions: 'אלופים',
    noChampionYet: 'עדיין אין אלוף',
    wins: 'ניצחונות',
    gamesLabel: 'משחקים',
    liveStats: 'סטטיסטיקות',
    totalPlayers: 'סה"כ שחקנים',
    onlineNow: 'מחוברים כעת',
    totalMatches: 'סה"כ משחקים',
    inProgress: 'בתהליך',
    playersPerGame: 'שחקנים לכל משחק',
    topWinRates: 'אחוזי ניצחון',
    newPlayer: 'חדש!',
    rps: 'אבן נייר ומספריים',
    oddoneout: 'משלוש יוצא אחד',
    tictactoe: 'איקס עיגול',
    memory: 'זיכרון',
    connect4: 'ארבע בשורה',
  },
  en: {
    online: 'online',
    live: 'live',
    overallLeaderboard: 'Leaderboard',
    waitingForPlayers: 'Waiting for players...',
    games: 'games',
    winsShort: 'W',
    pts: 'pts',
    champions: 'Champions',
    noChampionYet: 'No champion yet',
    wins: 'wins',
    gamesLabel: 'games',
    liveStats: 'Live Stats',
    totalPlayers: 'Total Players',
    onlineNow: 'Online Now',
    totalMatches: 'Total Matches',
    inProgress: 'In Progress',
    playersPerGame: 'Players per Game',
    topWinRates: 'Top Win Rates',
    newPlayer: 'NEW!',
    rps: 'Rock Paper Scissors',
    oddoneout: 'Odd One Out',
    tictactoe: 'Tic-Tac-Toe',
    memory: 'Memory Match',
    connect4: 'Connect 4',
  },
};

// ─── Hooks & Helpers ───────────────────────────────────────────

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

function getGameStats(entry: { score: number; wins: number; gamesPlayed: number; rpsPlayed?: number; rpsWins?: number; oddoneoutPlayed?: number; oddoneoutWins?: number; tictactoePlayed?: number; tictactoeWins?: number; connect4Played?: number; connect4Wins?: number; memoryPlayed?: number; memoryWins?: number }, game: QGameType) {
  if (game === 'rps') return { played: entry.rpsPlayed ?? 0, wins: entry.rpsWins ?? 0 };
  if (game === 'oddoneout') return { played: entry.oddoneoutPlayed ?? 0, wins: entry.oddoneoutWins ?? 0 };
  if (game === 'tictactoe') return { played: entry.tictactoePlayed ?? 0, wins: entry.tictactoeWins ?? 0 };
  if (game === 'connect4') return { played: entry.connect4Played ?? 0, wins: entry.connect4Wins ?? 0 };
  if (game === 'memory') return { played: entry.memoryPlayed ?? 0, wins: entry.memoryWins ?? 0 };
  return { played: entry.gamesPlayed, wins: entry.wins };
}

// ─── Props ─────────────────────────────────────────────────────

interface QGamesDisplayWidescreenProps {
  codeId: string;
  mediaId: string;
  initialConfig: QGamesConfig;
  locale?: 'he' | 'en';
}

// ─── Main Component ────────────────────────────────────────────

export default function QGamesDisplayWidescreen({
  codeId,
  initialConfig,
  locale,
}: QGamesDisplayWidescreenProps) {
  const config = { ...DEFAULT_QGAMES_CONFIG, ...initialConfig };
  const theme = resolveTheme(config.branding);
  const { entries } = useQGamesLeaderboard(codeId);
  const { stats } = useQGamesStats(codeId);

  // Language / RTL
  const lang = config.language === 'auto' ? (locale || 'he') : config.language;
  const isRTL = lang === 'he';
  const t = (key: string) => translations[lang]?.[key] || translations.en[key] || key;

  // Clock
  const [clock, setClock] = useState('');
  useEffect(() => {
    const tick = () => setClock(
      new Date().toLocaleTimeString(isRTL ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit' })
    );
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isRTL]);

  // Entrance animation
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Score change tracking
  const prevScoresRef = useRef<Record<string, number>>({});
  const initialLoadRef = useRef(true);
  const [scoreChanges, setScoreChanges] = useState<Record<string, number>>({});
  const [newPlayers, setNewPlayers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (entries.length === 0) return;

    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      const initial: Record<string, number> = {};
      for (const e of entries) initial[e.id] = e.score;
      prevScoresRef.current = initial;
      return;
    }

    const prev = prevScoresRef.current;
    const changes: Record<string, number> = {};
    const added = new Set<string>();

    for (const entry of entries) {
      const prevScore = prev[entry.id];
      if (prevScore === undefined) {
        added.add(entry.id);
      } else if (entry.score > prevScore) {
        changes[entry.id] = entry.score - prevScore;
      }
      prev[entry.id] = entry.score;
    }

    if (Object.keys(changes).length > 0) {
      setScoreChanges(changes);
      const timer = setTimeout(() => setScoreChanges({}), 2500);
      return () => clearTimeout(timer);
    }
    if (added.size > 0) {
      setNewPlayers(added);
      const timer = setTimeout(() => setNewPlayers(new Set()), 2500);
      return () => clearTimeout(timer);
    }
  }, [entries]);

  // Auto-scroll leaderboard when many players
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (entries.length <= 12) return;
    const el = scrollRef.current;
    if (!el) return;
    let scrollDown = true;
    const interval = setInterval(() => {
      if (scrollDown) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      } else {
        el.scrollTo({ top: 0, behavior: 'smooth' });
      }
      scrollDown = !scrollDown;
    }, 8000);
    return () => clearInterval(interval);
  }, [entries.length]);

  // Champion per game
  const rankMedals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
  const enabledGames = config.enabledGames;

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

  // Column entrance style
  const colBase = 'flex flex-col min-h-0 rounded-2xl p-5 overflow-hidden transition-all duration-700';
  const colAnim = mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8';

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="h-screen w-screen flex flex-col overflow-hidden p-6"
      style={{ backgroundColor: theme.backgroundColor, fontFamily: 'var(--font-assistant), Assistant, sans-serif' }}
    >
      {/* Custom keyframes */}
      <style>{`
        @keyframes scorePopUp {
          0% { opacity: 0; transform: translateY(4px) scale(0.8); }
          15% { opacity: 1; transform: translateY(-2px) scale(1.15); }
          100% { opacity: 0; transform: translateY(-20px) scale(0.9); }
        }
        @keyframes newBadgePulse {
          0% { opacity: 0; transform: scale(0.7); }
          20% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0; transform: scale(0.8); }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes progressGrow {
          from { width: 0%; }
        }
      `}</style>

      {/* ─── Header ─────────────────────────────────────── */}
      <div
        className={`flex items-center justify-between mb-5 transition-all duration-700 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        }`}
      >
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-black tracking-tight" style={{ color: theme.textColor }}>
            {config.branding.title || 'Q.Games'}
          </h1>
          {stats && (
            <div className="flex gap-5 ms-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: theme.accentColor }} />
                <span className="font-bold text-lg tabular-nums" style={{ color: theme.accentColor }}>
                  {stats.playersOnline}
                </span>
                <span className="text-sm" style={{ color: theme.textSecondary }}>{t('online')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#f59e0b' }} />
                <span className="font-bold text-lg tabular-nums" style={{ color: '#f59e0b' }}>
                  {stats.matchesInProgress}
                </span>
                <span className="text-sm" style={{ color: theme.textSecondary }}>{t('live')}</span>
              </div>
            </div>
          )}
        </div>
        <div className="text-2xl font-mono tabular-nums tracking-widest" style={{ color: theme.textSecondary }}>
          {clock}
        </div>
      </div>

      {/* ─── 3-Column Grid ──────────────────────────────── */}
      <div className="flex-1 grid grid-cols-3 gap-5 min-h-0">

        {/* ═══ Column 1: Leaderboard ═══ */}
        <div
          className={`${colBase} ${colAnim}`}
          style={{ backgroundColor: theme.surfaceColor, border: `1px solid ${theme.borderColor}`, transitionDelay: '0ms' }}
        >
          <SectionHeader color={theme.primaryColor} accent={theme.accentColor} textColor={theme.textColor}>
            {t('overallLeaderboard')}
          </SectionHeader>

          <div className="relative flex-1 min-h-0 mt-3">
            <div
              ref={scrollRef}
              className="h-full overflow-y-auto space-y-1 pe-1"
              style={{ scrollbarWidth: 'none' }}
            >
              {entries.length === 0 ? (
                <p className="text-center py-12 text-lg" style={{ color: theme.textSecondary }}>
                  {t('waitingForPlayers')}
                </p>
              ) : (
                entries.slice(0, 20).map((entry, idx) => {
                  const rank = idx + 1;
                  const isTop = rank <= 3;
                  const isCompact = rank > 5;

                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-2.5 rounded-xl"
                      style={{
                        padding: isCompact ? '4px 10px' : '8px 12px',
                        borderInlineStart: isTop ? `3px solid ${theme.primaryColor}` : '3px solid transparent',
                        backgroundColor: isTop ? `${theme.primaryColor}12` : newPlayers.has(entry.id) ? `${theme.accentColor}12` : 'transparent',
                        animation: mounted ? `fadeSlideIn 0.5s ease-out ${idx * 40}ms backwards` : 'none',
                      }}
                    >
                      {/* Rank */}
                      <div className="w-7 text-center shrink-0">
                        {isTop ? (
                          <span className={isCompact ? 'text-base' : 'text-lg'}>{rankMedals[rank - 1]}</span>
                        ) : (
                          <span className="text-xs font-medium tabular-nums" style={{ color: theme.textSecondary }}>{rank}</span>
                        )}
                      </div>

                      {/* Avatar */}
                      <div
                        className="rounded-full flex items-center justify-center shrink-0 overflow-hidden"
                        style={{
                          width: isCompact ? 24 : 36,
                          height: isCompact ? 24 : 36,
                          fontSize: isCompact ? '0.75rem' : '1.125rem',
                          backgroundColor: `${theme.textColor}15`,
                          boxShadow: isTop ? `0 0 0 2px ${theme.primaryColor}40` : 'none',
                        }}
                      >
                        {entry.avatarValue.startsWith('http') ? (
                          <img src={entry.avatarValue} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : entry.avatarValue}
                      </div>

                      {/* Name & stats */}
                      <div className="flex-1 min-w-0">
                        <p className="truncate" style={{
                          color: rank === 1 ? '#facc15' : theme.textColor,
                          fontSize: isCompact ? '0.8rem' : rank <= 3 ? '0.95rem' : '0.875rem',
                          fontWeight: isTop ? 800 : 600,
                        }}>
                          {entry.nickname}
                        </p>
                        {!isCompact && (
                          <p className="text-xs" style={{ color: theme.textSecondary }}>
                            {entry.gamesPlayed} {t('games')} · {entry.wins}{t('winsShort')}
                          </p>
                        )}
                      </div>

                      {/* Score + change badge */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {scoreChanges[entry.id] && (
                          <span
                            className="text-xs font-bold tabular-nums"
                            style={{ color: '#22c55e', animation: 'scorePopUp 2s ease-out forwards' }}
                          >
                            +{scoreChanges[entry.id]}
                          </span>
                        )}
                        {newPlayers.has(entry.id) && (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{
                              color: theme.accentColor,
                              backgroundColor: `${theme.accentColor}20`,
                              animation: 'newBadgePulse 2s ease-out forwards',
                            }}
                          >
                            {t('newPlayer')}
                          </span>
                        )}
                        <p className="font-black tabular-nums text-end" style={{
                          color: rank === 1 ? '#facc15' : theme.textColor,
                          fontSize: isCompact ? '0.85rem' : rank <= 3 ? '1.35rem' : '1rem',
                        }}>
                          {entry.score}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Fade gradient at bottom */}
            {entries.length > 10 && (
              <div
                className="absolute bottom-0 inset-x-0 h-10 pointer-events-none"
                style={{ background: `linear-gradient(transparent, ${theme.surfaceColor})` }}
              />
            )}
          </div>
        </div>

        {/* ═══ Column 2: Champions ═══ */}
        <div
          className={`${colBase} ${colAnim}`}
          style={{ backgroundColor: theme.surfaceColor, border: `1px solid ${theme.borderColor}`, transitionDelay: '150ms' }}
        >
          <SectionHeader color={theme.accentColor} accent={theme.primaryColor} textColor={theme.textColor}>
            {t('champions')}
          </SectionHeader>

          <div className={`flex-1 overflow-y-auto mt-3 ${enabledGames.length >= 3 ? 'grid grid-cols-2 gap-3 auto-rows-min' : 'space-y-3'}`}>
            {enabledGames.map((game, gi) => {
              const meta = GAME_META[game];
              const champion = getChampion(game);
              const champStats = champion ? getGameStats(champion, game) : null;

              return (
                <div
                  key={game}
                  className="rounded-xl p-4"
                  style={{
                    backgroundColor: `${theme.textColor}08`,
                    border: `1px solid ${theme.borderColor}`,
                    animation: mounted ? `fadeSlideIn 0.5s ease-out ${150 + gi * 80}ms backwards` : 'none',
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">{meta.emoji}</span>
                    <span className="font-semibold text-sm" style={{ color: theme.textColor }}>
                      {t(game)}
                    </span>
                  </div>

                  {champion ? (
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-xl overflow-hidden"
                        style={{
                          backgroundColor: `${theme.textColor}15`,
                          boxShadow: `0 0 0 2px ${theme.accentColor}50`,
                        }}
                      >
                        {champion.avatarValue.startsWith('http') ? (
                          <img src={champion.avatarValue} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : champion.avatarValue}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate" style={{ color: '#facc15' }}>
                          {champion.nickname}
                        </p>
                        <p className="text-xs" style={{ color: theme.textSecondary }}>
                          {champStats?.wins} {t('wins')} / {champStats?.played} {t('gamesLabel')}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: theme.textSecondary }}>
                      {t('noChampionYet')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══ Column 3: Live Stats ═══ */}
        <div
          className={`${colBase} ${colAnim}`}
          style={{ backgroundColor: theme.surfaceColor, border: `1px solid ${theme.borderColor}`, transitionDelay: '300ms' }}
        >
          <SectionHeader color={theme.primaryColor} accent={theme.accentColor} textColor={theme.textColor}>
            {t('liveStats')}
          </SectionHeader>

          <div className="space-y-4 mt-3">
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3">
              <AnimatedStatCard
                label={t('totalPlayers')}
                value={stats?.totalPlayers ?? 0}
                color={theme.primaryColor}
                delay={400}
                mounted={mounted}
              />
              <AnimatedStatCard
                label={t('onlineNow')}
                value={stats?.playersOnline ?? 0}
                color={theme.accentColor}
                delay={480}
                mounted={mounted}
              />
              <AnimatedStatCard
                label={t('totalMatches')}
                value={stats?.totalMatches ?? 0}
                color={theme.textColor}
                delay={560}
                mounted={mounted}
              />
              <AnimatedStatCard
                label={t('inProgress')}
                value={stats?.matchesInProgress ?? 0}
                color="#f59e0b"
                delay={640}
                mounted={mounted}
              />
            </div>

            {/* Players per game */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: theme.textSecondary }}>
                {t('playersPerGame')}
              </h3>
              <div className="space-y-2.5">
                {enabledGames.map((game, gi) => {
                  const playersInGame = entries.filter(e => getGameStats(e, game).played > 0).length;
                  const totalPlayers = entries.length;
                  const pct = totalPlayers > 0 ? (playersInGame / totalPlayers) * 100 : 0;

                  return (
                    <div key={game}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium" style={{ color: theme.textColor }}>
                          {t(game)}
                        </span>
                        <span className="text-xs font-bold tabular-nums" style={{ color: theme.accentColor }}>
                          {playersInGame}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${theme.textColor}0d` }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, ${theme.primaryColor}, ${theme.accentColor})`,
                            animation: mounted ? `progressGrow 0.8s ease-out ${400 + gi * 100}ms backwards` : 'none',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top win rates */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: theme.textSecondary }}>
                {t('topWinRates')}
              </h3>
              <div className="space-y-1">
                {entries
                  .filter(e => e.gamesPlayed >= 3)
                  .sort((a, b) => {
                    const aRate = a.gamesPlayed > 0 ? a.wins / a.gamesPlayed : 0;
                    const bRate = b.gamesPlayed > 0 ? b.wins / b.gamesPlayed : 0;
                    return bRate - aRate;
                  })
                  .slice(0, 5)
                  .map((entry, wi) => {
                    const winRate = entry.gamesPlayed > 0 ? Math.round((entry.wins / entry.gamesPlayed) * 100) : 0;
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center gap-2 py-1.5 px-2 rounded-lg"
                        style={{
                          backgroundColor: `${theme.textColor}06`,
                          animation: mounted ? `fadeSlideIn 0.4s ease-out ${600 + wi * 60}ms backwards` : 'none',
                        }}
                      >
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs overflow-hidden shrink-0"
                          style={{ backgroundColor: `${theme.textColor}15` }}
                        >
                          {entry.avatarValue.startsWith('http') ? (
                            <img src={entry.avatarValue} alt="" className="w-full h-full object-cover" />
                          ) : entry.avatarValue}
                        </div>
                        <span className="flex-1 text-xs truncate" style={{ color: theme.textColor }}>
                          {entry.nickname}
                        </span>
                        <span className="font-bold text-xs tabular-nums" style={{ color: theme.accentColor }}>
                          {winRate}%
                        </span>
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

// ─── Sub-components ────────────────────────────────────────────

function SectionHeader({ color, accent, textColor, children }: {
  color: string; accent: string; textColor: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="w-1 h-5 rounded-full shrink-0"
        style={{ background: `linear-gradient(to bottom, ${color}, ${accent})` }}
      />
      <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: textColor }}>
        {children}
      </h2>
    </div>
  );
}

function AnimatedStatCard({ label, value, color, delay, mounted }: {
  label: string; value: number; color: string; delay: number; mounted: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const count = useCountUp(value, 700, visible);

  useEffect(() => {
    if (!mounted) return;
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [mounted, delay]);

  return (
    <div
      className={`rounded-xl p-4 text-center transition-all duration-500 ${
        visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-3 scale-95'
      }`}
      style={{ backgroundColor: `${color}12` }}
    >
      <p className="text-3xl font-black tabular-nums" style={{ color }}>{count}</p>
      <p className="text-[10px] mt-1 font-medium uppercase tracking-wider" style={{ color, opacity: 0.5 }}>{label}</p>
    </div>
  );
}
