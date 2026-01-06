/**
 * useQHuntRealtime - React hooks for QHunt real-time data
 * Provides easy-to-use subscriptions for display and player interfaces
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  QHuntLiveData,
  QHuntLeaderboardEntry,
  QHuntTeamScore,
  QHuntRecentScan,
  QHuntStats,
  QHuntConfig,
  QHuntPhase,
  QHuntPlayer,
  QHuntScan,
  formatGameTime,
} from '@/types/qhunt';
import {
  subscribeToQHuntLive,
  subscribeToQHuntStats,
  subscribeToQHuntLeaderboard,
  subscribeToQHuntTeamScores,
  subscribeToQHuntRecentScans,
  getQHuntLive,
  initQHuntSession,
  qhuntSessionExists,
} from '@/lib/qhunt-realtime';
import {
  subscribeToQHuntConfig,
  subscribeToQHuntPlayers,
  getPlayer,
  getPlayerScans,
} from '@/lib/qhunt';

// ============ FULL SESSION HOOK ============

interface UseQHuntLiveResult {
  data: QHuntLiveData | null;
  loading: boolean;
  error: string | null;
}

/**
 * Subscribe to full QHunt session data
 * Best for: Display screen that needs all data
 */
export function useQHuntLive(codeId: string | null): UseQHuntLiveResult {
  const [data, setData] = useState<QHuntLiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codeId) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToQHuntLive(codeId, (newData) => {
      setData(newData);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [codeId]);

  return { data, loading, error };
}

// ============ STATS ONLY HOOK ============

interface UseQHuntStatsResult {
  stats: QHuntStats | null;
  loading: boolean;
}

/**
 * Subscribe to stats only (lighter subscription)
 * Best for: Mobile interface showing player counts
 */
export function useQHuntStats(codeId: string | null): UseQHuntStatsResult {
  const [stats, setStats] = useState<QHuntStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codeId) {
      setStats(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToQHuntStats(codeId, (newStats) => {
      setStats(newStats);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [codeId]);

  return { stats, loading };
}

// ============ LEADERBOARD HOOK ============

interface UseQHuntLeaderboardResult {
  leaderboard: QHuntLeaderboardEntry[];
  loading: boolean;
}

/**
 * Subscribe to leaderboard data
 * Best for: Display screen leaderboard
 */
export function useQHuntLeaderboard(codeId: string | null): UseQHuntLeaderboardResult {
  const [leaderboard, setLeaderboard] = useState<QHuntLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codeId) {
      setLeaderboard([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToQHuntLeaderboard(codeId, (entries) => {
      setLeaderboard(entries);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [codeId]);

  return { leaderboard, loading };
}

// ============ TEAM SCORES HOOK ============

interface UseQHuntTeamScoresResult {
  teamScores: QHuntTeamScore[];
  loading: boolean;
}

/**
 * Subscribe to team scores
 * Best for: Team mode leaderboard
 */
export function useQHuntTeamScores(codeId: string | null): UseQHuntTeamScoresResult {
  const [teamScores, setTeamScores] = useState<QHuntTeamScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codeId) {
      setTeamScores([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToQHuntTeamScores(codeId, (scores) => {
      setTeamScores(scores);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [codeId]);

  return { teamScores, loading };
}

// ============ RECENT SCANS HOOK ============

interface UseQHuntRecentScansResult {
  recentScans: QHuntRecentScan[];
  loading: boolean;
}

/**
 * Subscribe to recent scans (for live feed)
 * Best for: Display screen showing recent activity
 */
export function useQHuntRecentScans(codeId: string | null): UseQHuntRecentScansResult {
  const [recentScans, setRecentScans] = useState<QHuntRecentScan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codeId) {
      setRecentScans([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToQHuntRecentScans(codeId, (scans) => {
      setRecentScans(scans);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [codeId]);

  return { recentScans, loading };
}

// ============ CONFIG HOOK (FROM FIRESTORE) ============

interface UseQHuntConfigResult {
  config: QHuntConfig | null;
  loading: boolean;
}

/**
 * Subscribe to QHunt config from Firestore
 * Best for: Getting settings, codes, branding
 */
export function useQHuntConfig(
  codeId: string | null,
  mediaId: string | null
): UseQHuntConfigResult {
  const [config, setConfig] = useState<QHuntConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codeId || !mediaId) {
      setConfig(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToQHuntConfig(codeId, mediaId, (newConfig) => {
      setConfig(newConfig);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [codeId, mediaId]);

  return { config, loading };
}

// ============ PLAYER SESSION HOOK ============

interface UseQHuntPlayerResult {
  player: QHuntPlayer | null;
  scans: QHuntScan[];
  loading: boolean;
  refreshPlayer: () => Promise<void>;
  refreshScans: () => Promise<void>;
}

/**
 * Hook for player's own session data
 * Best for: Player interface showing their progress
 */
export function useQHuntPlayer(
  codeId: string | null,
  playerId: string | null
): UseQHuntPlayerResult {
  const [player, setPlayer] = useState<QHuntPlayer | null>(null);
  const [scans, setScans] = useState<QHuntScan[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshPlayer = useCallback(async () => {
    if (!codeId || !playerId) return;
    const p = await getPlayer(codeId, playerId);
    setPlayer(p);
  }, [codeId, playerId]);

  const refreshScans = useCallback(async () => {
    if (!codeId || !playerId) return;
    const s = await getPlayerScans(codeId, playerId);
    setScans(s);
  }, [codeId, playerId]);

  useEffect(() => {
    if (!codeId || !playerId) {
      setPlayer(null);
      setScans([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    Promise.all([refreshPlayer(), refreshScans()]).finally(() => {
      setLoading(false);
    });
  }, [codeId, playerId, refreshPlayer, refreshScans]);

  return { player, scans, loading, refreshPlayer, refreshScans };
}

// ============ TIMER HOOK ============

interface UseQHuntTimerResult {
  timeRemaining: number; // seconds
  isExpired: boolean;
  formattedTime: string; // "MM:SS"
  elapsedTime: number; // milliseconds since game started
}

/**
 * Hook for game timer with server time sync
 * Best for: Player interface countdown
 */
export function useQHuntTimer(
  gameStartedAt: number | null | undefined,
  durationSeconds: number
): UseQHuntTimerResult {
  const [timeRemaining, setTimeRemaining] = useState(durationSeconds);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    // If no duration limit, timer is unlimited
    if (durationSeconds === 0) {
      setTimeRemaining(Infinity);
    }

    if (!gameStartedAt) {
      setTimeRemaining(durationSeconds);
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - gameStartedAt;
      setElapsedTime(elapsed);

      if (durationSeconds === 0) {
        // Unlimited mode - just track elapsed time
        setTimeRemaining(Infinity);
      } else {
        const remaining = Math.max(0, durationSeconds - Math.floor(elapsed / 1000));
        setTimeRemaining(remaining);
      }
    }, 100); // Update every 100ms for smooth countdown

    return () => clearInterval(interval);
  }, [gameStartedAt, durationSeconds]);

  const isExpired = durationSeconds > 0 && timeRemaining <= 0;
  const formattedTime = durationSeconds === 0 ? '--:--' : formatGameTime(timeRemaining);

  return { timeRemaining, isExpired, formattedTime, elapsedTime };
}

// ============ COMBINED DISPLAY HOOK ============

interface UseQHuntDisplayResult {
  config: QHuntConfig | null;
  liveData: QHuntLiveData | null;
  leaderboard: QHuntLeaderboardEntry[];
  teamScores: QHuntTeamScore[];
  recentScans: QHuntRecentScan[];
  phase: QHuntPhase;
  stats: QHuntStats | null;
  loading: boolean;
  ready: boolean;
}

/**
 * Combined hook for display screen with all needed data
 * Merges config from Firestore with live data from Realtime DB
 */
export function useQHuntDisplay(
  codeId: string | null,
  mediaId: string | null
): UseQHuntDisplayResult {
  const { config, loading: configLoading } = useQHuntConfig(codeId, mediaId);
  const { data: liveData, loading: liveLoading } = useQHuntLive(codeId);
  const { leaderboard } = useQHuntLeaderboard(codeId);
  const { teamScores } = useQHuntTeamScores(codeId);
  const { recentScans } = useQHuntRecentScans(codeId);

  // Initialize session if it doesn't exist
  useEffect(() => {
    if (!codeId || !config) return;

    const checkAndInit = async () => {
      const exists = await qhuntSessionExists(codeId);
      if (!exists) {
        await initQHuntSession(codeId);
      }
    };

    checkAndInit();
  }, [codeId, config]);

  const loading = configLoading || liveLoading;
  const ready = !loading && config !== null;

  // Derive commonly used values
  const phase = liveData?.status || config?.currentPhase || 'registration';
  const stats = liveData?.stats || config?.stats || null;

  return {
    config,
    liveData,
    leaderboard,
    teamScores,
    recentScans,
    phase,
    stats,
    loading,
    ready,
  };
}

// ============ ANIMATED SCORE HOOK ============

interface UseAnimatedScoreOptions {
  targetScore: number;
  duration?: number; // Animation duration in ms (default 500)
  enabled?: boolean;
}

/**
 * Hook for smooth score animation
 * Uses requestAnimationFrame for butter-smooth updates
 */
export function useAnimatedScore({
  targetScore,
  duration = 500,
  enabled = true,
}: UseAnimatedScoreOptions): number {
  const [displayScore, setDisplayScore] = useState(targetScore);
  const startScoreRef = useRef(targetScore);
  const startTimeRef = useRef<number | null>(null);
  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!enabled) {
      setDisplayScore(targetScore);
      return;
    }

    startScoreRef.current = displayScore;
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);

      const currentScore = Math.round(
        startScoreRef.current + (targetScore - startScoreRef.current) * eased
      );

      setDisplayScore(currentScore);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [targetScore, duration, enabled]);

  return displayScore;
}

// ============ RANK CHANGE DETECTION HOOK ============

interface UseRankChangeResult {
  previousRank: number | null;
  currentRank: number;
  direction: 'up' | 'down' | 'same' | null;
  isNew: boolean;
}

/**
 * Track rank changes for animation
 */
export function useRankChange(rank: number): UseRankChangeResult {
  const [previousRank, setPreviousRank] = useState<number | null>(null);
  const [isNew, setIsNew] = useState(true);

  useEffect(() => {
    if (previousRank !== null && previousRank !== rank) {
      // Rank changed
      const timer = setTimeout(() => {
        setPreviousRank(rank);
      }, 1000); // Keep showing change for 1 second

      return () => clearTimeout(timer);
    } else {
      setPreviousRank(rank);
      setIsNew(false);
    }
  }, [rank, previousRank]);

  let direction: 'up' | 'down' | 'same' | null = null;
  if (previousRank !== null && previousRank !== rank) {
    direction = rank < previousRank ? 'up' : rank > previousRank ? 'down' : 'same';
  }

  return {
    previousRank,
    currentRank: rank,
    direction,
    isNew,
  };
}

// ============ SOUND EFFECTS HOOK ============

interface UseQHuntSoundsResult {
  playScanSuccess: () => void;
  playScanError: () => void;
  playGameComplete: () => void;
  playMilestone: () => void;
  playCountdown: () => void;
}

/**
 * Hook for playing game sound effects
 */
export function useQHuntSounds(enabled: boolean = true): UseQHuntSoundsResult {
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize audio context on first interaction
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  // Generate a beep sound
  const playTone = useCallback((frequency: number, duration: number, type: OscillatorType = 'sine') => {
    if (!enabled) return;

    try {
      const ctx = getAudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch (error) {
      console.warn('Audio playback failed:', error);
    }
  }, [enabled, getAudioContext]);

  const playScanSuccess = useCallback(() => {
    // Ascending happy sound
    playTone(523.25, 0.1); // C5
    setTimeout(() => playTone(659.25, 0.1), 100); // E5
    setTimeout(() => playTone(783.99, 0.2), 200); // G5
  }, [playTone]);

  const playScanError = useCallback(() => {
    // Low buzzer sound
    playTone(200, 0.3, 'square');
  }, [playTone]);

  const playGameComplete = useCallback(() => {
    // Victory fanfare
    playTone(523.25, 0.15); // C5
    setTimeout(() => playTone(659.25, 0.15), 150); // E5
    setTimeout(() => playTone(783.99, 0.15), 300); // G5
    setTimeout(() => playTone(1046.50, 0.4), 450); // C6
  }, [playTone]);

  const playMilestone = useCallback(() => {
    // Power-up sound
    playTone(440, 0.1); // A4
    setTimeout(() => playTone(554.37, 0.1), 100); // C#5
    setTimeout(() => playTone(659.25, 0.15), 200); // E5
  }, [playTone]);

  const playCountdown = useCallback(() => {
    // Short beep for countdown
    playTone(880, 0.1); // A5
  }, [playTone]);

  return {
    playScanSuccess,
    playScanError,
    playGameComplete,
    playMilestone,
    playCountdown,
  };
}

// ============ VISIBILITY MANAGER ============

/**
 * Check if component is visible (for pausing/resuming subscriptions)
 */
export function useVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return isVisible;
}
