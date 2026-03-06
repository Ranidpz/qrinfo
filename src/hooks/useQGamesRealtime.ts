/**
 * useQGamesRealtime - React hooks for Q.Games real-time data
 * Provides subscriptions for match state, queue, leaderboard, stats
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  QGamesStats,
  QGamesLeaderboardEntry,
  QGamesQueueEntry,
  QGameType,
  QGamesAvatarType,
  RTDBMatch,
  RTDBRPSState,
  RTDBTTTState,
  RTDBOOOState,
  RTDBC4State,
  RTDBMemoryState,
  RTDBMemoryPlayer,
  LiveMatchInfo,
  ViewerPresenceData,
  OnlineViewerInfo,
  QGamesChatMessage,
} from '@/types/qgames';
import {
  subscribeToQGamesStats,
  subscribeToQGamesLeaderboard,
  subscribeToQueueEntry,
  subscribeToQueue,
  subscribeToMatch,
  subscribeToRPSState,
  subscribeToTTTState,
  subscribeToC4State,
  subscribeToOOOState,
  subscribeToMemoryRoom,
  subscribeToMemoryPlayers,
  setupMatchPresence,
  subscribeToMatchPresence,
  setupViewerPresence,
  updateViewerPresenceInfo,
  subscribeToViewerCount,
  subscribeToActiveMatchStats,
  subscribeToRecentViewers,
  cleanupStaleMatches,
  subscribeToChatMessages,
  subscribeToChatBan,
  cleanupOldChatMessages,
} from '@/lib/qgames-realtime';

// ============ STATS HOOK ============

interface UseQGamesStatsResult {
  stats: QGamesStats | null;
  loading: boolean;
}

export function useQGamesStats(codeId: string | null): UseQGamesStatsResult {
  const [stats, setStats] = useState<QGamesStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codeId) {
      setStats(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToQGamesStats(codeId, (data) => {
      setStats(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [codeId]);

  return { stats, loading };
}

// ============ LEADERBOARD HOOK ============

interface UseQGamesLeaderboardResult {
  entries: QGamesLeaderboardEntry[];
  loading: boolean;
}

export function useQGamesLeaderboard(codeId: string | null): UseQGamesLeaderboardResult {
  const [entries, setEntries] = useState<QGamesLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codeId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToQGamesLeaderboard(codeId, (data) => {
      setEntries(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [codeId]);

  return { entries, loading };
}

// ============ QUEUE ENTRY HOOK (for matchmaking) ============

interface UseQGamesQueueResult {
  entry: QGamesQueueEntry | null;
  loading: boolean;
}

export function useQGamesQueueEntry(
  codeId: string | null,
  visitorId: string | null
): UseQGamesQueueResult {
  const [entry, setEntry] = useState<QGamesQueueEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codeId || !visitorId) {
      setEntry(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToQueueEntry(codeId, visitorId, (data) => {
      setEntry(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [codeId, visitorId]);

  return { entry, loading };
}

// ============ FULL QUEUE HOOK (for display) ============

interface UseQGamesQueueAllResult {
  entries: QGamesQueueEntry[];
  loading: boolean;
}

export function useQGamesQueue(codeId: string | null): UseQGamesQueueAllResult {
  const [entries, setEntries] = useState<QGamesQueueEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codeId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToQueue(codeId, (data) => {
      setEntries(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [codeId]);

  return { entries, loading };
}

// ============ QUEUE WATCHER (for bot match opponent detection) ============

interface WaitingOpponentInfo {
  id: string;
  nickname: string;
  avatarType: QGamesAvatarType;
  avatarValue: string;
  isInvitedByMe: boolean;
}

/**
 * Watches the queue for real opponents while player is in a bot match.
 * Only active when `isActive` is true. Filters for opponents matching the
 * specified gameType who are `waiting` and NOT `inBotMatch`.
 */
export function useQueueWatcher(
  codeId: string | null,
  visitorId: string | null,
  gameType: QGameType | null,
  isActive: boolean
): { waitingOpponents: WaitingOpponentInfo[] } {
  const [waitingOpponents, setWaitingOpponents] = useState<WaitingOpponentInfo[]>([]);

  useEffect(() => {
    if (!codeId || !visitorId || !gameType || !isActive) {
      setWaitingOpponents([]);
      return;
    }

    const unsubscribe = subscribeToQueue(codeId, (entries) => {
      const opponents = entries.filter(
        e => e.gameType === gameType
          && e.status === 'waiting'
          && e.id !== visitorId
          && !e.inBotMatch
      );
      const mapped = opponents.map(o => ({
        id: o.id,
        nickname: o.nickname,
        avatarType: o.avatarType,
        avatarValue: o.avatarValue,
        isInvitedByMe: o.preferredOpponentId === visitorId,
      }));
      // Sort invited players first (they have priority)
      mapped.sort((a, b) => (a.isInvitedByMe === b.isInvitedByMe ? 0 : a.isInvitedByMe ? -1 : 1));
      setWaitingOpponents(mapped);
    });

    return () => unsubscribe();
  }, [codeId, visitorId, gameType, isActive]);

  return { waitingOpponents };
}

// ============ MATCH HOOK ============

interface UseQGamesMatchResult {
  match: RTDBMatch | null;
  loading: boolean;
}

export function useQGamesMatch(
  codeId: string | null,
  matchId: string | null
): UseQGamesMatchResult {
  const [match, setMatch] = useState<RTDBMatch | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codeId || !matchId) {
      setMatch(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToMatch(codeId, matchId, (data) => {
      setMatch(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [codeId, matchId]);

  return { match, loading };
}

// ============ RPS STATE HOOK ============

interface UseRPSStateResult {
  state: RTDBRPSState | null;
  loading: boolean;
}

export function useRPSState(
  codeId: string | null,
  matchId: string | null
): UseRPSStateResult {
  const [state, setState] = useState<RTDBRPSState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codeId || !matchId) {
      setState(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToRPSState(codeId, matchId, (data) => {
      setState(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [codeId, matchId]);

  return { state, loading };
}

// ============ TTT STATE HOOK ============

interface UseTTTStateResult {
  state: RTDBTTTState | null;
  loading: boolean;
}

export function useTTTState(
  codeId: string | null,
  matchId: string | null
): UseTTTStateResult {
  const [state, setState] = useState<RTDBTTTState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codeId || !matchId) {
      setState(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToTTTState(codeId, matchId, (data) => {
      setState(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [codeId, matchId]);

  return { state, loading };
}

// ============ C4 STATE HOOK ============

interface UseC4StateResult {
  state: RTDBC4State | null;
  loading: boolean;
}

export function useC4State(
  codeId: string | null,
  matchId: string | null
): UseC4StateResult {
  const [state, setState] = useState<RTDBC4State | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codeId || !matchId) {
      setState(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToC4State(codeId, matchId, (data) => {
      setState(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [codeId, matchId]);

  return { state, loading };
}

// ============ OOO STATE HOOK ============

interface UseOOOStateResult {
  state: RTDBOOOState | null;
  loading: boolean;
}

export function useOOOState(
  codeId: string | null,
  matchId: string | null
): UseOOOStateResult {
  const [state, setState] = useState<RTDBOOOState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codeId || !matchId) {
      setState(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToOOOState(codeId, matchId, (data) => {
      setState(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [codeId, matchId]);

  return { state, loading };
}

// ============ MATCH PRESENCE HOOK ============

interface UseMatchPresenceResult {
  opponentDisconnected: boolean;
}

/**
 * Tracks opponent presence during a match.
 * Sets up own presence heartbeat and monitors opponents.
 */
export function useMatchPresence(
  codeId: string | null,
  matchId: string | null,
  playerId: string | null,
  opponentIds: string[],
  isActive: boolean
): UseMatchPresenceResult {
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Stable ref for opponentIds to avoid re-running effect on array reference changes
  const opponentIdsKey = opponentIds.join(',');

  useEffect(() => {
    if (!codeId || !matchId || !playerId || !isActive || opponentIds.length === 0) {
      setOpponentDisconnected(false);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      return;
    }

    let mounted = true;

    // Set up own presence
    setupMatchPresence(codeId, matchId, playerId).then(cleanup => {
      if (mounted) cleanupRef.current = cleanup;
      else cleanup();
    });

    // Subscribe to presence changes
    const unsubPresence = subscribeToMatchPresence(codeId, matchId, (presence) => {
      if (!mounted) return;
      if (!presence) return; // No presence data yet

      const anyMissing = opponentIds.some(oppId => !presence[oppId]);
      if (anyMissing) {
        // Debounce: wait 2s of continuous absence before declaring disconnect
        // This handles the race condition where opponent's presence isn't set up yet
        if (!debounceTimerRef.current) {
          debounceTimerRef.current = setTimeout(() => {
            if (mounted) setOpponentDisconnected(true);
            debounceTimerRef.current = null;
          }, 2000);
        }
      } else {
        // Opponent is present — cancel pending debounce and reset
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        setOpponentDisconnected(false);
      }
    });

    return () => {
      mounted = false;
      unsubPresence();
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeId, matchId, playerId, isActive, opponentIdsKey]);

  return { opponentDisconnected };
}

// ============ VIEWER PRESENCE HOOK ============

/**
 * Registers viewer presence (auto-removed on disconnect) and
 * subscribes to live viewer count, active match count, queue-per-game counts,
 * and live match details for selector display.
 */
export function useViewerPresence(
  codeId: string | null,
  visitorId: string | null,
  playerInfo?: { nickname: string; avatarType: QGamesAvatarType; avatarValue: string } | null
): { viewerCount: number; activeMatches: number; matchesPerGame: Record<string, number>; queuePerGame: Record<string, number>; liveMatches: LiveMatchInfo[] } {
  const [viewerCount, setViewerCount] = useState(0);
  const [activeMatches, setActiveMatches] = useState(0);
  const [matchesPerGame, setMatchesPerGame] = useState<Record<string, number>>({});
  const [queuePerGame, setQueuePerGame] = useState<Record<string, number>>({});
  const [liveMatches, setLiveMatches] = useState<LiveMatchInfo[]>([]);
  const cleanupRef = useRef<(() => void) | null>(null);
  const presenceSetupRef = useRef(false);

  // Use primitives for deps to avoid infinite loops with object reference
  const pNickname = playerInfo?.nickname;
  const pAvatarType = playerInfo?.avatarType;
  const pAvatarValue = playerInfo?.avatarValue;

  // Main effect: setup presence + subscriptions (only on codeId/visitorId change)
  useEffect(() => {
    if (!codeId || !visitorId) return;

    let mounted = true;
    presenceSetupRef.current = false;

    // Register own presence with player info if available
    const info = pNickname ? { nickname: pNickname, avatarType: pAvatarType!, avatarValue: pAvatarValue! } : undefined;
    setupViewerPresence(codeId, visitorId, info).then(cleanup => {
      if (mounted) {
        cleanupRef.current = cleanup;
        presenceSetupRef.current = true;
      }
      // Don't call cleanup() when stale — the new effect already owns the same RTDB path.
      // Calling cleanup() here would remove data the second effect just wrote (StrictMode race).
    });

    // Clean up stale matches on mount (fire-and-forget is OK here — runs client-side)
    cleanupStaleMatches(codeId).catch(() => {});

    // Subscribe to counts
    const unsubViewers = subscribeToViewerCount(codeId, (count) => {
      if (mounted) setViewerCount(count);
    });
    const unsubMatches = subscribeToActiveMatchStats(codeId, (stats) => {
      if (mounted) {
        setActiveMatches(stats.total);
        setMatchesPerGame(stats.perGame);
        setLiveMatches(stats.liveMatches);
      }
    });

    // Subscribe to queue for per-game waiting counts
    const unsubQueue = subscribeToQueue(codeId, (entries) => {
      if (!mounted) return;
      const perGame: Record<string, number> = {};
      for (const entry of entries) {
        if (entry.status === 'waiting' && !entry.inBotMatch) {
          perGame[entry.gameType] = (perGame[entry.gameType] || 0) + 1;
        }
      }
      setQueuePerGame(perGame);
    });

    return () => {
      mounted = false;
      unsubViewers();
      unsubMatches();
      unsubQueue();
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeId, visitorId]);

  // Separate effect: update viewer info when player profile changes (without tearing down presence)
  useEffect(() => {
    if (!codeId || !visitorId || !pNickname || !presenceSetupRef.current) return;
    updateViewerPresenceInfo(codeId, visitorId, {
      nickname: pNickname,
      avatarType: pAvatarType!,
      avatarValue: pAvatarValue!,
    }).catch(() => {});
  }, [codeId, visitorId, pNickname, pAvatarType, pAvatarValue]);

  return { viewerCount, activeMatches, matchesPerGame, queuePerGame, liveMatches };
}

// ============ ONLINE VIEWERS HOOK (for modal) ============

/**
 * Subscribe to recent online viewers. Only active when enabled=true (modal open).
 * Cross-references with liveMatches to show playing status.
 */
export function useOnlineViewers(
  codeId: string | null,
  enabled: boolean,
  liveMatches: LiveMatchInfo[]
): OnlineViewerInfo[] {
  const [rawViewers, setRawViewers] = useState<Array<ViewerPresenceData & { visitorId: string }>>([]);

  useEffect(() => {
    if (!codeId || !enabled) {
      setRawViewers([]);
      return;
    }
    const unsub = subscribeToRecentViewers(codeId, setRawViewers);
    return () => unsub();
  }, [codeId, enabled]);

  return useMemo(() => {
    return rawViewers
      .filter(v => v.nickname) // Skip anonymous/unregistered viewers
      .map(v => {
        // Find if this viewer is in any live match (by player ID)
        const matchInfo = liveMatches.find(m =>
          m.player1Id === v.visitorId ||
          m.player2Id === v.visitorId ||
          m.player3Id === v.visitorId
        );

        let playingVs: string | undefined;
        if (matchInfo) {
          if (matchInfo.player1Id === v.visitorId) {
            playingVs = matchInfo.player2Nickname;
          } else if (matchInfo.player2Id === v.visitorId) {
            playingVs = matchInfo.player1Nickname;
          } else {
            // player3 — show both opponents
            playingVs = `${matchInfo.player1Nickname} & ${matchInfo.player2Nickname}`;
          }
        }

        return {
          visitorId: v.visitorId,
          nickname: v.nickname,
          avatarType: v.avatarType,
          avatarValue: v.avatarValue,
          joinedAt: v.joinedAt,
          status: matchInfo ? 'playing' as const : 'idle' as const,
          playingGame: matchInfo?.gameType,
          playingVs,
        };
      });
  }, [rawViewers, liveMatches]);
}

// ============ MEMORY ROOM HOOK ============

interface UseMemoryRoomResult {
  room: RTDBMemoryState | null;
  loading: boolean;
}

export function useMemoryRoom(
  codeId: string | null,
  roomId: string | null
): UseMemoryRoomResult {
  const [room, setRoom] = useState<RTDBMemoryState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codeId || !roomId) {
      setRoom(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToMemoryRoom(codeId, roomId, (data) => {
      setRoom(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [codeId, roomId]);

  return { room, loading };
}

// ============ MEMORY PLAYERS HOOK ============

interface UseMemoryPlayersResult {
  players: Record<string, RTDBMemoryPlayer>;
  loading: boolean;
}

export function useMemoryPlayers(
  codeId: string | null,
  roomId: string | null
): UseMemoryPlayersResult {
  const [players, setPlayers] = useState<Record<string, RTDBMemoryPlayer>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codeId || !roomId) {
      setPlayers({});
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToMemoryPlayers(codeId, roomId, (data) => {
      setPlayers(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [codeId, roomId]);

  return { players, loading };
}

// ============ COUNTDOWN TIMER HOOK ============

interface UseCountdownResult {
  timeLeft: number;  // seconds remaining
  isExpired: boolean;
  progress: number;  // 0 to 1
}

/**
 * Countdown timer hook that syncs with server timestamp
 * @param startedAt - When the timer started (ms timestamp)
 * @param duration - Duration in seconds
 */
export function useCountdown(
  startedAt: number | null,
  duration: number | null
): UseCountdownResult {
  const [timeLeft, setTimeLeft] = useState(duration ?? 0);
  const prevRef = useRef({ startedAt, duration });

  // Compute immediate timeLeft when inputs change (before effect runs)
  // This prevents stale isExpired=true on the first render of a new round
  let effectiveTimeLeft = timeLeft;
  if (startedAt !== prevRef.current.startedAt || duration !== prevRef.current.duration) {
    prevRef.current = { startedAt, duration };
    if (startedAt && duration) {
      const elapsed = (Date.now() - startedAt) / 1000;
      effectiveTimeLeft = Math.max(0, duration - elapsed);
    } else {
      effectiveTimeLeft = 0;
    }
  }

  useEffect(() => {
    if (!startedAt || !duration) {
      setTimeLeft(0);
      return;
    }

    const tick = () => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const remaining = Math.max(0, duration - elapsed);
      setTimeLeft(remaining);
    };

    tick();
    const interval = setInterval(tick, 100); // Update 10x/sec for smooth countdown

    return () => clearInterval(interval);
  }, [startedAt, duration]);

  return {
    timeLeft: effectiveTimeLeft,
    isExpired: effectiveTimeLeft <= 0 && startedAt !== null,
    progress: duration ? effectiveTimeLeft / duration : 0,
  };
}

// ============ SOUND HOOK ============

interface UseQGamesSoundsResult {
  playSelect: () => void;
  playWinRound: () => void;
  playLoseRound: () => void;
  playWinMatch: () => void;
  playLoseMatch: () => void;
  playCountdown: () => void;
  playReveal: () => void;
}

/**
 * Sound effects using Web Audio API
 */
export function useQGamesSounds(enabled: boolean): UseQGamesSoundsResult {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return ctxRef.current;
  }, []);

  const playTone = useCallback((frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) => {
    if (!enabled) return;
    try {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Ignore audio errors
    }
  }, [enabled, getCtx]);

  const playSelect = useCallback(() => playTone(600, 0.1, 'sine', 0.2), [playTone]);
  const playWinRound = useCallback(() => {
    playTone(523, 0.15, 'sine');
    setTimeout(() => playTone(659, 0.15, 'sine'), 100);
    setTimeout(() => playTone(784, 0.2, 'sine'), 200);
  }, [playTone]);
  const playLoseRound = useCallback(() => playTone(300, 0.3, 'sawtooth', 0.15), [playTone]);
  const playWinMatch = useCallback(() => {
    playTone(523, 0.15, 'sine');
    setTimeout(() => playTone(659, 0.15, 'sine'), 120);
    setTimeout(() => playTone(784, 0.15, 'sine'), 240);
    setTimeout(() => playTone(1047, 0.3, 'sine'), 360);
  }, [playTone]);
  const playLoseMatch = useCallback(() => {
    playTone(400, 0.2, 'sawtooth', 0.15);
    setTimeout(() => playTone(300, 0.3, 'sawtooth', 0.15), 200);
  }, [playTone]);
  const playCountdown = useCallback(() => playTone(440, 0.1, 'square', 0.15), [playTone]);
  const playReveal = useCallback(() => playTone(880, 0.2, 'sine', 0.25), [playTone]);

  return useMemo(() => ({ playSelect, playWinRound, playLoseRound, playWinMatch, playLoseMatch, playCountdown, playReveal }), [playSelect, playWinRound, playLoseRound, playWinMatch, playLoseMatch, playCountdown, playReveal]);
}

// ============ LOBBY CHAT HOOKS ============

/** Subscribe to lobby chat messages (last 50, filtered by max age) */
export function useLobbyChatMessages(
  codeId: string | null,
  maxAgeMs: number = 300000 // 5 min display TTL
): { messages: QGamesChatMessage[]; loading: boolean } {
  const [messages, setMessages] = useState<QGamesChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codeId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Clean up old messages on mount (fire-and-forget)
    cleanupOldChatMessages(codeId).catch(() => {});

    const unsubscribe = subscribeToChatMessages(codeId, (allMessages) => {
      const now = Date.now();
      const filtered = allMessages.filter(m => now - m.sentAt < maxAgeMs);
      setMessages(filtered);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [codeId, maxAgeMs]);

  return { messages, loading };
}

/** Chat moderation: rate limiting, spam strikes, ban check */
export function useChatModeration(
  codeId: string | null,
  visitorId: string | null
): {
  canSend: boolean;
  isBanned: boolean;
  violations: number;
  cooldownSeconds: number;
  warningMessage: string | null;
  dismissWarning: () => void;
  checkCanSend: () => boolean;
  recordSend: () => void;
} {
  const [isBanned, setIsBanned] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const violationsRef = useRef(0);
  const [violations, setViolations] = useState(0);
  const sendTimestamps = useRef<number[]>([]);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Subscribe to ban status
  useEffect(() => {
    if (!codeId || !visitorId) return;
    const unsubscribe = subscribeToChatBan(codeId, visitorId, (banned) => {
      setIsBanned(banned);
    });
    return () => unsubscribe();
  }, [codeId, visitorId]);

  // Cooldown countdown
  useEffect(() => {
    if (cooldownUntil <= Date.now()) {
      setCooldownSeconds(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownSeconds(remaining);
    };
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  const dismissWarning = useCallback(() => {
    setWarningMessage(null);
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
  }, []);

  const showWarning = useCallback((msg: string) => {
    setWarningMessage(msg);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    warningTimerRef.current = setTimeout(() => {
      setWarningMessage(null);
      warningTimerRef.current = null;
    }, 3000);
  }, []);

  const checkCanSend = useCallback((): boolean => {
    if (isBanned) return false;
    if (cooldownUntil > Date.now()) return false;

    const now = Date.now();
    const recent = sendTimestamps.current.filter(t => now - t < 10000);

    if (recent.length >= 3) {
      // Rate limited — apply cooldown
      const cooldownMs = 5000;
      setCooldownUntil(now + cooldownMs);

      violationsRef.current += 1;
      setViolations(violationsRef.current);

      if (violationsRef.current >= 3) {
        showWarning('נחסמתם מהצ\'אט 🚫');
        return false; // Will be banned by recordSend
      } else if (violationsRef.current === 2) {
        showWarning('אזהרה אחרונה — עוד אחת ותיחסמו מהצ\'אט ⚠️');
      } else {
        showWarning('רגע, נשמו! 😅');
      }
      return false;
    }

    return true;
  }, [isBanned, cooldownUntil, showWarning]);

  const recordSend = useCallback(() => {
    sendTimestamps.current.push(Date.now());
    // Keep only last 10 seconds
    const now = Date.now();
    sendTimestamps.current = sendTimestamps.current.filter(t => now - t < 10000);

    // Check if should ban after recording
    if (violationsRef.current >= 3 && codeId && visitorId) {
      import('@/lib/qgames-realtime').then(({ banFromChat }) => {
        banFromChat(codeId, visitorId);
      });
    }
  }, [codeId, visitorId]);

  const canSend = !isBanned && cooldownUntil <= Date.now();

  return {
    canSend,
    isBanned,
    violations,
    cooldownSeconds,
    warningMessage,
    dismissWarning,
    checkCanSend,
    recordSend,
  };
}
