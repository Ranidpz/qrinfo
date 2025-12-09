'use client';

import { useState, useEffect, useRef } from 'react';
import { onSnapshot, collection, query, where, orderBy, limit, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LeaderboardEntry, StationVisit } from '@/types';
import { getLevelForXP, formatXP, getProgressToNextLevel } from '@/lib/xp';
import { gamificationTranslations } from '@/lib/publicTranslations';
import { Trash2, Pencil, X, Loader2, Check } from 'lucide-react';

// Gaming-style rank badge component - larger with medal design
function RankBadge({ rank, size = 'md' }: { rank: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-10 h-10 text-sm',
    md: 'w-14 h-14 text-lg',
    lg: 'w-16 h-16 text-xl',
  };

  const getBadgeStyle = (rank: number) => {
    if (rank === 1) {
      return {
        bg: 'bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600',
        border: 'border-yellow-500/80',
        shadow: 'shadow-[0_0_20px_rgba(251,191,36,0.6)]',
        text: 'text-yellow-900',
        icon: '👑',
        iconSize: 'text-2xl',
      };
    }
    if (rank === 2) {
      return {
        bg: 'bg-gradient-to-br from-slate-200 via-gray-300 to-slate-500',
        border: 'border-slate-400/80',
        shadow: 'shadow-[0_0_15px_rgba(148,163,184,0.5)]',
        text: 'text-slate-700',
        icon: '🥈',
        iconSize: 'text-xl',
      };
    }
    if (rank === 3) {
      return {
        bg: 'bg-gradient-to-br from-amber-400 via-orange-500 to-amber-700',
        border: 'border-amber-600/80',
        shadow: 'shadow-[0_0_12px_rgba(217,119,6,0.5)]',
        text: 'text-amber-100',
        icon: '🥉',
        iconSize: 'text-xl',
      };
    }
    return {
      bg: 'bg-white/10 backdrop-blur-sm',
      border: 'border-white/20',
      shadow: '',
      text: 'text-white/90',
      icon: null,
      iconSize: 'text-base',
    };
  };

  const style = getBadgeStyle(rank);

  return (
    <div
      className={`
        ${sizeClasses[size]} ${style.bg} ${style.shadow}
        rounded-2xl border-2 ${style.border}
        flex items-center justify-center font-black ${style.text}
        transform transition-all duration-200 hover:scale-110
        relative overflow-hidden flex-shrink-0
      `}
    >
      {/* Shine effect */}
      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/10 to-white/30 pointer-events-none" />

      {style.icon ? (
        <span className={`${style.iconSize} drop-shadow-lg`}>{style.icon}</span>
      ) : (
        <span className="drop-shadow-sm font-bold">{rank}</span>
      )}
    </div>
  );
}

// Time ago formatter
function timeAgo(date: Date, locale: 'he' | 'en'): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (locale === 'he') {
    if (diffMins < 1) return 'עכשיו';
    if (diffMins < 60) return `לפני ${diffMins} דק׳`;
    if (diffHours < 24) return `לפני ${diffHours} שע׳`;
    if (diffDays === 1) return 'אתמול';
    if (diffDays < 7) return `לפני ${diffDays} ימים`;
    return date.toLocaleDateString('he-IL');
  } else {
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US');
  }
}

interface LiveLeaderboardProps {
  routeId: string;
  locale?: 'he' | 'en';
  maxEntries?: number;
  currentVisitorId?: string;
  className?: string;
  isVisible?: boolean; // For enter/exit animation
  isAdmin?: boolean; // Show admin controls (edit/delete)
}

// Track rank changes for animation
interface RankChangeMap {
  [visitorId: string]: 'up' | 'down' | 'new' | null;
}

export default function LiveLeaderboard({
  routeId,
  locale = 'he',
  maxEntries = 10,
  currentVisitorId,
  className = '',
  isVisible = true,
  isAdmin = false,
}: LiveLeaderboardProps) {
  const t = gamificationTranslations[locale];
  const isRTL = locale === 'he';

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rankChanges, setRankChanges] = useState<RankChangeMap>({});

  // Admin controls state
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [editingNickname, setEditingNickname] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingPlayer, setDeletingPlayer] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Track previous ranks for animation
  const prevRanksRef = useRef<Map<string, number>>(new Map());

  // Use refs to store current values without re-subscribing
  const currentVisitorIdRef = useRef(currentVisitorId);
  currentVisitorIdRef.current = currentVisitorId;

  const tRef = useRef(t);
  tRef.current = t;

  // Admin: Edit player nickname
  const handleEditPlayer = async (visitorId: string) => {
    if (!editingNickname.trim() || savingEdit) return;

    setSavingEdit(true);
    try {
      // Update visitorProgress
      const progressId = `${visitorId}_${routeId}`;
      await updateDoc(doc(db, 'visitorProgress', progressId), {
        nickname: editingNickname.trim(),
      });

      // Also update visitors collection
      try {
        await updateDoc(doc(db, 'visitors', visitorId), {
          nickname: editingNickname.trim(),
        });
      } catch {
        // Visitor doc might not exist, that's ok
      }

      setEditingPlayer(null);
      setEditingNickname('');
    } catch (err) {
      console.error('Error updating player:', err);
    } finally {
      setSavingEdit(false);
    }
  };

  // Admin: Delete player from leaderboard
  const handleDeletePlayer = async (visitorId: string) => {
    if (deletingPlayer) return;

    setDeletingPlayer(visitorId);
    try {
      // Delete visitorProgress
      const progressId = `${visitorId}_${routeId}`;
      await deleteDoc(doc(db, 'visitorProgress', progressId));

      setConfirmDelete(null);
    } catch (err) {
      console.error('Error deleting player:', err);
    } finally {
      setDeletingPlayer(null);
    }
  };

  // Subscribe to leaderboard updates - only re-subscribe when routeId or maxEntries changes
  useEffect(() => {
    if (!routeId) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const q = query(
      collection(db, 'visitorProgress'),
      where('routeId', '==', routeId),
      orderBy('xp', 'desc'),
      limit(maxEntries)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!isMounted) return;

        const leaderboardEntries: LeaderboardEntry[] = [];

        for (let i = 0; i < snapshot.docs.length; i++) {
          const doc = snapshot.docs[i];
          const data = doc.data();
          const visitorId = data.visitorId;

          // Parse visitedStations - handle both old (string[]) and new (StationVisit[]) format
          let stations: StationVisit[] = [];
          if (Array.isArray(data.visitedStations)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            stations = data.visitedStations.map((station: any) => {
              if (typeof station === 'string') {
                // Old format - just codeId
                return { codeId: station, title: 'תחנה', xpEarned: 10, visitedAt: new Date() };
              }
              // New format - StationVisit object (visitedAt may be Firestore Timestamp)
              const visitedAt = station.visitedAt?.toDate ? station.visitedAt.toDate() : new Date();
              return {
                codeId: station.codeId,
                title: station.title || 'תחנה',
                xpEarned: station.xpEarned || 10,
                visitedAt,
              };
            });
          }

          leaderboardEntries.push({
            visitorId,
            nickname: data.nickname || 'Player',
            xp: data.xp || 0,
            level: getLevelForXP(data.xp || 0),
            rank: i + 1,
            photosUploaded: data.photosUploaded || 0,
            visitedStations: stations,
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
          });
        }

        // Detect rank changes for animation
        const newChanges: RankChangeMap = {};
        const prevRanks = prevRanksRef.current;

        leaderboardEntries.forEach((entry) => {
          const prevRank = prevRanks.get(entry.visitorId);
          if (prevRank === undefined) {
            // New entry
            newChanges[entry.visitorId] = 'new';
          } else if (entry.rank < prevRank) {
            // Moved up
            newChanges[entry.visitorId] = 'up';
          } else if (entry.rank > prevRank) {
            // Moved down
            newChanges[entry.visitorId] = 'down';
          }
        });

        // Update previous ranks for next comparison
        const newPrevRanks = new Map<string, number>();
        leaderboardEntries.forEach((entry) => {
          newPrevRanks.set(entry.visitorId, entry.rank);
        });
        prevRanksRef.current = newPrevRanks;

        // Set rank changes for animation
        if (Object.keys(newChanges).length > 0) {
          setRankChanges(newChanges);
          // Clear animation after it completes
          setTimeout(() => setRankChanges({}), 600);
        }

        setEntries(leaderboardEntries);
        setLoading(false);
        setError(null);

        // Find current user's rank using ref to avoid dependency
        const vid = currentVisitorIdRef.current;
        if (vid) {
          const userIndex = leaderboardEntries.findIndex(e => e.visitorId === vid);
          setCurrentUserRank(userIndex >= 0 ? userIndex + 1 : null);
        }
      },
      (err) => {
        // Handle Firestore errors (e.g., missing index)
        if (!isMounted) return;
        console.error('Leaderboard query error:', err);
        setLoading(false);
        setError(tRef.current.loadError);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [routeId, maxEntries]);

  if (loading) {
    return (
      <div className={`${className}`}>
        {/* Glassmorphism loading skeleton */}
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10" />
                <div className="flex-1">
                  <div className="h-4 bg-white/10 rounded-lg w-28 mb-3" />
                  <div className="flex gap-3">
                    <div className="h-6 bg-white/5 rounded-lg w-20" />
                    <div className="h-6 bg-white/5 rounded-lg w-12" />
                  </div>
                </div>
                <div className="w-14 h-14 rounded-xl bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-red-500/10 backdrop-blur-sm border border-red-400/20">
          <span className="text-xl">⚠️</span>
          <span className="text-sm text-red-300">{error}</span>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className={`text-center py-10 ${className}`}>
        <div className="inline-flex flex-col items-center gap-3 px-8 py-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
          <span className="text-4xl">🎮</span>
          <span className="text-white/70 text-base font-medium">
            {locale === 'he' ? 'עדיין אין משתתפים' : 'No participants yet'}
          </span>
          <span className="text-white/40 text-sm">
            {locale === 'he' ? 'היו הראשונים!' : 'Be the first!'}
          </span>
        </div>
      </div>
    );
  }

  // Get animation class for rank changes
  const getRankChangeClass = (visitorId: string) => {
    const change = rankChanges[visitorId];
    if (change === 'up') return 'animate-rank-up';
    if (change === 'down') return 'animate-rank-down';
    if (change === 'new') return 'animate-rank-new';
    return '';
  };

  return (
    <div
      className={`
        ${className}
        transition-all duration-500 ease-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
      `}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Gaming-style header with glassmorphism */}
      <div className="flex items-center gap-4 mb-6 pb-4 border-b border-white/10">
        <div className="relative">
          <span className="text-3xl animate-bounce">🏆</span>
          <div className="absolute -inset-2 bg-yellow-400/20 rounded-full blur-lg" />
        </div>
        <div>
          <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-400">
            {t.leaderboard}
          </h3>
          <p className="text-xs text-white/40 uppercase tracking-widest mt-0.5">
            Top {maxEntries} {locale === 'he' ? 'שחקנים' : 'Players'}
          </p>
        </div>
      </div>

      {/* Leaderboard list - glass cards */}
      <div className="space-y-3">
        {entries.map((entry, index) => {
          const isCurrentUser = entry.visitorId === currentVisitorId;
          const isTop3 = entry.rank <= 3;
          const rankChangeClass = getRankChangeClass(entry.visitorId);

          return (
            <div
              key={entry.visitorId}
              style={{ animationDelay: `${index * 50}ms` }}
              className={`
                group relative rounded-2xl overflow-hidden
                transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg
                ${rankChangeClass}
                ${isCurrentUser
                  ? 'bg-emerald-500/20 backdrop-blur-sm border-2 border-emerald-400/50 shadow-[0_0_20px_rgba(52,211,153,0.25)]'
                  : isTop3
                    ? 'bg-white/10 backdrop-blur-sm border border-white/20'
                    : 'bg-white/5 backdrop-blur-sm border border-white/10'
                }
              `}
            >
              {/* Glossy overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

              <div className="relative p-4">
                <div className="flex items-center gap-4">
                  {/* Level badge with emoji and name below */}
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`
                      w-14 h-14 rounded-xl flex items-center justify-center
                      ${isTop3
                        ? 'bg-gradient-to-br from-amber-400/20 to-yellow-500/20 border border-amber-400/40'
                        : 'bg-white/10 border border-white/10'
                      }
                    `}>
                      <span className="text-2xl">
                        {entry.level.emoji}
                      </span>
                    </div>
                    <span className="text-[10px] text-white/50 mt-1 text-center">
                      {entry.level.name}
                    </span>
                  </div>

                  {/* Player info - expanded */}
                  <div className="flex-1 min-w-0">
                    {/* Name row */}
                    <div className="flex items-center gap-2 mb-1">
                      {editingPlayer === entry.visitorId ? (
                        // Edit mode
                        <div className="flex items-center gap-2 w-full">
                          <input
                            type="text"
                            value={editingNickname}
                            onChange={(e) => setEditingNickname(e.target.value)}
                            className="flex-1 px-2 py-1 rounded bg-white/20 border border-white/30 text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
                            autoFocus
                            maxLength={20}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleEditPlayer(entry.visitorId);
                              if (e.key === 'Escape') {
                                setEditingPlayer(null);
                                setEditingNickname('');
                              }
                            }}
                          />
                          <button
                            onClick={() => handleEditPlayer(entry.visitorId)}
                            disabled={savingEdit || !editingNickname.trim()}
                            className="p-1 rounded bg-emerald-500/30 text-emerald-400 hover:bg-emerald-500/50 disabled:opacity-50"
                          >
                            {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => {
                              setEditingPlayer(null);
                              setEditingNickname('');
                            }}
                            className="p-1 rounded bg-white/10 text-white/60 hover:bg-white/20"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        // Display mode
                        <>
                          <span className={`
                            font-bold truncate text-base
                            ${isCurrentUser ? 'text-emerald-300' : 'text-white'}
                          `}>
                            {entry.nickname}
                          </span>
                          {/* Admin controls */}
                          {isAdmin && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingPlayer(entry.visitorId);
                                  setEditingNickname(entry.nickname);
                                }}
                                className="p-1 rounded bg-white/10 text-white/60 hover:bg-white/20 hover:text-white"
                                title={locale === 'he' ? 'ערוך שם' : 'Edit name'}
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDelete(entry.visitorId);
                                }}
                                className="p-1 rounded bg-red-500/10 text-red-400/60 hover:bg-red-500/20 hover:text-red-400"
                                title={locale === 'he' ? 'הסר שחקן' : 'Remove player'}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Delete confirmation */}
                    {confirmDelete === entry.visitorId && (
                      <div className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-red-500/20 border border-red-500/30">
                        <span className="text-xs text-red-300 flex-1">
                          {locale === 'he' ? 'להסיר את השחקן?' : 'Remove player?'}
                        </span>
                        <button
                          onClick={() => handleDeletePlayer(entry.visitorId)}
                          disabled={deletingPlayer === entry.visitorId}
                          className="px-2 py-1 rounded text-xs bg-red-500/30 text-red-300 hover:bg-red-500/50 disabled:opacity-50"
                        >
                          {deletingPlayer === entry.visitorId ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            locale === 'he' ? 'כן' : 'Yes'
                          )}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-2 py-1 rounded text-xs bg-white/10 text-white/60 hover:bg-white/20"
                        >
                          {locale === 'he' ? 'לא' : 'No'}
                        </button>
                      </div>
                    )}

                    {/* Stats row - clearer layout */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Photos uploaded */}
                      {entry.photosUploaded > 0 && (
                        <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-lg">
                          <span className="text-pink-400 text-xs">📸</span>
                          <span className="text-xs text-white/70">{entry.photosUploaded}</span>
                        </div>
                      )}

                      {/* Time ago */}
                      {entry.updatedAt && (
                        <div className="flex items-center gap-1 text-xs text-white/40">
                          <span>🕐</span>
                          <span>{timeAgo(entry.updatedAt, locale)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rank number - simple */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                    <span className={`text-sm font-bold ${isTop3 ? 'text-yellow-300' : 'text-white/60'}`}>
                      {entry.rank}
                    </span>
                  </div>
                </div>

                {/* XP Progress bar inside the card */}
                <div className="mt-3 pt-3 border-t border-white/10">
                  {/* XP breakdown */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-400 text-sm">⚡</span>
                      <span className="text-sm font-bold text-yellow-300">
                        {formatXP(entry.xp, locale)} XP
                      </span>
                    </div>
                  </div>

                  {/* XP details - stations and photos */}
                  <div className="space-y-1 text-[10px] text-white/40 mb-2">
                    {/* Individual station breakdown */}
                    {entry.visitedStations && entry.visitedStations.length > 0 && (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        {entry.visitedStations.map((station, idx) => (
                          <span key={station.codeId || idx} className="flex items-center gap-1">
                            🚩 {station.title}: {station.xpEarned} XP
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Photos breakdown */}
                    {entry.photosUploaded > 0 && (
                      <span className="block">
                        📸 {entry.photosUploaded} {locale === 'he' ? 'תמונות' : 'photos'} = {entry.photosUploaded * 25} XP
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isCurrentUser
                          ? 'bg-gradient-to-r from-emerald-400 to-teal-400'
                          : 'bg-gradient-to-r from-yellow-400 to-amber-500'
                      }`}
                      style={{ width: `${getProgressToNextLevel(entry.xp)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Current user hint (if not in top) */}
      {currentVisitorId && currentUserRank === null && (
        <div className="mt-6 pt-4 border-t border-white/10">
          <div className="flex items-center justify-center gap-3 px-5 py-4 rounded-2xl bg-purple-500/10 backdrop-blur-sm border border-purple-400/20">
            <span className="text-2xl animate-pulse">🎯</span>
            <p className="text-sm text-purple-200/90">
              {locale === 'he'
                ? 'העלו תמונות כדי להופיע בלידרבורד!'
                : 'Upload photos to appear on the leaderboard!'}
            </p>
          </div>
        </div>
      )}

      {/* CSS for animations */}
      <style jsx>{`
        /* Rank up animation - green glow, slide up */
        @keyframes rank-up {
          0% {
            transform: translateY(20px) scale(0.95);
            opacity: 0.5;
            box-shadow: 0 0 0 rgba(52, 211, 153, 0);
          }
          50% {
            transform: translateY(-5px) scale(1.02);
            box-shadow: 0 0 30px rgba(52, 211, 153, 0.6);
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
            box-shadow: 0 0 0 rgba(52, 211, 153, 0);
          }
        }

        /* Rank down animation - red flash, slide down */
        @keyframes rank-down {
          0% {
            transform: translateY(-20px) scale(1.02);
            opacity: 0.5;
          }
          50% {
            transform: translateY(5px) scale(0.98);
            box-shadow: 0 0 20px rgba(239, 68, 68, 0.4);
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
            box-shadow: none;
          }
        }

        /* New entry animation - pop in */
        @keyframes rank-new {
          0% {
            transform: scale(0) translateX(50px);
            opacity: 0;
          }
          60% {
            transform: scale(1.1) translateX(-5px);
          }
          100% {
            transform: scale(1) translateX(0);
            opacity: 1;
          }
        }

        .animate-rank-up {
          animation: rank-up 0.6s ease-out forwards;
        }

        .animate-rank-down {
          animation: rank-down 0.6s ease-out forwards;
        }

        .animate-rank-new {
          animation: rank-new 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
