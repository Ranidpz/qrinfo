/**
 * useQGamesRealtime - React hooks for Q.Games real-time data
 * Provides subscriptions for match state, queue, leaderboard, stats
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  QGamesStats,
  QGamesLeaderboardEntry,
  QGamesQueueEntry,
  RTDBMatch,
  RTDBRPSState,
  RTDBTTTState,
  RTDBOOOState,
} from '@/types/qgames';
import {
  subscribeToQGamesStats,
  subscribeToQGamesLeaderboard,
  subscribeToQueueEntry,
  subscribeToQueue,
  subscribeToMatch,
  subscribeToRPSState,
  subscribeToTTTState,
  subscribeToOOOState,
  setupMatchPresence,
  subscribeToMatchPresence,
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
  // Stable ref for opponentIds to avoid re-running effect on array reference changes
  const opponentIdsKey = opponentIds.join(',');

  useEffect(() => {
    if (!codeId || !matchId || !playerId || !isActive || opponentIds.length === 0) {
      setOpponentDisconnected(false);
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
        setOpponentDisconnected(true);
      }
    });

    return () => {
      mounted = false;
      unsubPresence();
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeId, matchId, playerId, isActive, opponentIdsKey]);

  return { opponentDisconnected };
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

  return { playSelect, playWinRound, playLoseRound, playWinMatch, playLoseMatch, playCountdown, playReveal };
}
