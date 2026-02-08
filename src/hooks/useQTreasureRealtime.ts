/**
 * useQTreasureRealtime - React hooks for QTreasure real-time data
 * Provides easy-to-use subscriptions for display and player interfaces
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  QTreasureLiveData,
  QTreasureLeaderboardEntry,
  QTreasureRecentCompletion,
  QTreasureStats,
  QTreasureConfig,
  QTreasurePhase,
  QTreasurePlayer,
  QTreasureScan,
  formatTreasureTime,
  formatTreasureDuration,
} from '@/types/qtreasure';
import {
  subscribeToTreasureLive,
  subscribeToTreasureStats,
  subscribeToTreasureLeaderboard,
  subscribeToTreasureRecentCompletions,
  getTreasureLive,
  initTreasureSession,
  treasureSessionExists,
} from '@/lib/qtreasure-realtime';
import {
  subscribeToTreasureConfig,
  subscribeToTreasurePlayer,
  subscribeToTreasurePlayers,
  getTreasurePlayer,
  getTreasurePlayerScans,
} from '@/lib/qtreasure';

// ============ FULL SESSION HOOK ============

interface UseQTreasureLiveResult {
  data: QTreasureLiveData | null;
  loading: boolean;
  error: string | null;
}

/**
 * Subscribe to full QTreasure session data
 * Best for: Display screen that needs all data
 */
export function useQTreasureLive(codeId: string | null): UseQTreasureLiveResult {
  const [data, setData] = useState<QTreasureLiveData | null>(null);
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

    const unsubscribe = subscribeToTreasureLive(codeId, (newData) => {
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

interface UseQTreasureStatsResult {
  stats: QTreasureStats | null;
  loading: boolean;
}

/**
 * Subscribe to stats only (lighter subscription)
 * Best for: Mobile interface showing player counts
 */
export function useQTreasureStats(codeId: string | null): UseQTreasureStatsResult {
  const [stats, setStats] = useState<QTreasureStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codeId) {
      setStats(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToTreasureStats(codeId, (newStats) => {
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

interface UseQTreasureLeaderboardResult {
  leaderboard: QTreasureLeaderboardEntry[];
  loading: boolean;
}

/**
 * Subscribe to leaderboard data (sorted by completion time)
 * Best for: Display screen leaderboard
 */
export function useQTreasureLeaderboard(codeId: string | null): UseQTreasureLeaderboardResult {
  const [leaderboard, setLeaderboard] = useState<QTreasureLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codeId) {
      setLeaderboard([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToTreasureLeaderboard(codeId, (entries) => {
      setLeaderboard(entries);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [codeId]);

  return { leaderboard, loading };
}

// ============ RECENT COMPLETIONS HOOK ============

interface UseQTreasureRecentCompletionsResult {
  recentCompletions: QTreasureRecentCompletion[];
  loading: boolean;
}

/**
 * Subscribe to recent completions (for live feed)
 * Best for: Display screen showing recent finishers
 */
export function useQTreasureRecentCompletions(codeId: string | null): UseQTreasureRecentCompletionsResult {
  const [recentCompletions, setRecentCompletions] = useState<QTreasureRecentCompletion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codeId) {
      setRecentCompletions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToTreasureRecentCompletions(codeId, (completions) => {
      setRecentCompletions(completions);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [codeId]);

  return { recentCompletions, loading };
}

// ============ CONFIG HOOK (FROM FIRESTORE) ============

interface UseQTreasureConfigResult {
  config: QTreasureConfig | null;
  loading: boolean;
}

/**
 * Subscribe to QTreasure config from Firestore
 * Best for: Getting settings, stations, branding
 */
export function useQTreasureConfig(
  codeId: string | null,
  mediaId: string | null
): UseQTreasureConfigResult {
  const [config, setConfig] = useState<QTreasureConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codeId || !mediaId) {
      setTimeout(() => {
        setConfig(null);
        setLoading(false);
      }, 0);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToTreasureConfig(codeId, mediaId, (newConfig) => {
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

interface UseQTreasurePlayerResult {
  player: QTreasurePlayer | null;
  loading: boolean;
  refreshPlayer: () => Promise<void>;
}

/**
 * Hook for player's own session data with real-time updates
 * Best for: Player interface showing their progress
 */
export function useQTreasurePlayer(
  codeId: string | null,
  playerId: string | null
): UseQTreasurePlayerResult {
  const [player, setPlayer] = useState<QTreasurePlayer | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshPlayer = useCallback(async () => {
    if (!codeId || !playerId) return;
    const p = await getTreasurePlayer(codeId, playerId);
    setPlayer(p);
  }, [codeId, playerId]);

  useEffect(() => {
    if (!codeId || !playerId) {
      setTimeout(() => {
        setPlayer(null);
        setLoading(false);
      }, 0);
      return;
    }

    setLoading(true);

    // Use real-time subscription for player data
    const unsubscribe = subscribeToTreasurePlayer(codeId, playerId, (playerData) => {
      setPlayer(playerData);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [codeId, playerId]);

  return { player, loading, refreshPlayer };
}

// ============ TIMER HOOK ============

interface UseQTreasureTimerResult {
  timeRemaining: number; // seconds
  isExpired: boolean;
  formattedTime: string; // "MM:SS"
  elapsedTime: number; // milliseconds since hunt started
  formattedElapsed: string; // "M:SS.CC"
}

/**
 * Hook for game timer with server time sync
 * Best for: Player interface countdown/stopwatch
 */
export function useQTreasureTimer(
  startedAt: number | null | undefined,
  maxTimeSeconds: number = 0
): UseQTreasureTimerResult {
  const [timeRemaining, setTimeRemaining] = useState(maxTimeSeconds);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setTimeout(() => {
        setTimeRemaining(maxTimeSeconds);
        setElapsedTime(0);
      }, 0);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - startedAt;
      setElapsedTime(elapsed);

      if (maxTimeSeconds === 0) {
        // Unlimited mode - just track elapsed time
        setTimeRemaining(Infinity);
      } else {
        const remaining = Math.max(0, maxTimeSeconds - Math.floor(elapsed / 1000));
        setTimeRemaining(remaining);
      }
    }, 100); // Update every 100ms for smooth display

    return () => clearInterval(interval);
  }, [startedAt, maxTimeSeconds]);

  const isExpired = maxTimeSeconds > 0 && timeRemaining <= 0;
  const formattedTime = maxTimeSeconds === 0 ? '--:--' : formatTreasureTime(timeRemaining);
  const formattedElapsed = formatTreasureDuration(elapsedTime);

  return { timeRemaining, isExpired, formattedTime, elapsedTime, formattedElapsed };
}

// ============ COMBINED DISPLAY HOOK ============

interface UseQTreasureDisplayResult {
  config: QTreasureConfig | null;
  liveData: QTreasureLiveData | null;
  leaderboard: QTreasureLeaderboardEntry[];
  recentCompletions: QTreasureRecentCompletion[];
  phase: QTreasurePhase;
  stats: QTreasureStats | null;
  loading: boolean;
  ready: boolean;
}

/**
 * Combined hook for display screen with all needed data
 * Merges config from Firestore with live data from Realtime DB
 */
export function useQTreasureDisplay(
  codeId: string | null,
  mediaId: string | null
): UseQTreasureDisplayResult {
  const { config, loading: configLoading } = useQTreasureConfig(codeId, mediaId);
  const { data: liveData, loading: liveLoading } = useQTreasureLive(codeId);
  const { leaderboard } = useQTreasureLeaderboard(codeId);
  const { recentCompletions } = useQTreasureRecentCompletions(codeId);

  // Initialize session if it doesn't exist
  useEffect(() => {
    if (!codeId || !config) return;

    const checkAndInit = async () => {
      const exists = await treasureSessionExists(codeId);
      if (!exists) {
        await initTreasureSession(codeId);
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
    recentCompletions,
    phase,
    stats,
    loading,
    ready,
  };
}

// ============ PROGRESS HOOK ============

interface UseQTreasureProgressResult {
  completedCount: number;
  totalCount: number;
  progressPercent: number;
  isComplete: boolean;
  currentStationIndex: number;
}

/**
 * Hook for tracking player's progress through stations
 */
export function useQTreasureProgress(
  player: QTreasurePlayer | null,
  config: QTreasureConfig | null
): UseQTreasureProgressResult {
  const totalCount = config?.stations.filter(s => s.isActive).length || 0;
  const completedCount = player?.completedStations.length || 0;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isComplete = completedCount >= totalCount && totalCount > 0;
  const currentStationIndex = player?.currentStationIndex || 0;

  return {
    completedCount,
    totalCount,
    progressPercent,
    isComplete,
    currentStationIndex,
  };
}

// ============ SOUND EFFECTS HOOK ============

interface UseQTreasureSoundsResult {
  playScanSuccess: () => void;
  playScanError: () => void;
  playHuntComplete: () => void;
  playOutOfOrder: () => void;
}

/**
 * Hook for playing game sound effects
 */
export function useQTreasureSounds(enabled: boolean = true): UseQTreasureSoundsResult {
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

  const playHuntComplete = useCallback(() => {
    // Victory fanfare
    playTone(523.25, 0.15); // C5
    setTimeout(() => playTone(659.25, 0.15), 150); // E5
    setTimeout(() => playTone(783.99, 0.15), 300); // G5
    setTimeout(() => playTone(1046.50, 0.4), 450); // C6
  }, [playTone]);

  const playOutOfOrder = useCallback(() => {
    // Warning sound
    playTone(440, 0.15); // A4
    setTimeout(() => playTone(349.23, 0.2), 150); // F4
  }, [playTone]);

  return {
    playScanSuccess,
    playScanError,
    playHuntComplete,
    playOutOfOrder,
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
