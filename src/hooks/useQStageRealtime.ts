/**
 * useQStageRealtime - React hooks for QStage real-time data
 * Provides easy-to-use subscriptions for display and mobile interfaces
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  QStageLiveData,
  QStageVoter,
  QStageStats,
  QStageConfig,
  QStagePhase,
} from '@/types/qstage';
import {
  subscribeToQStageLive,
  subscribeToQStageStats,
  subscribeToQStageVoters,
  subscribeToQStageEvents,
  getQStageLive,
  initQStageSession,
  qstageSessionExists,
} from '@/lib/qstage-realtime';
import { subscribeToQStageConfig } from '@/lib/qstage';

// ============ FULL SESSION HOOK ============

interface UseQStageLiveResult {
  data: QStageLiveData | null;
  loading: boolean;
  error: string | null;
}

/**
 * Subscribe to full QStage session data
 * Best for: Display screen that needs all data
 */
export function useQStageLive(codeId: string | null): UseQStageLiveResult {
  const [data, setData] = useState<QStageLiveData | null>(null);
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

    const unsubscribe = subscribeToQStageLive(codeId, (newData) => {
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

interface UseQStageStatsResult {
  stats: QStageStats | null;
  loading: boolean;
}

/**
 * Subscribe to stats only (lighter subscription)
 * Best for: Mobile voting interface showing current percentage
 */
export function useQStageStats(codeId: string | null): UseQStageStatsResult {
  const [stats, setStats] = useState<QStageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codeId) {
      setStats(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToQStageStats(codeId, (newStats) => {
      setStats(newStats);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [codeId]);

  return { stats, loading };
}

// ============ VOTERS GRID HOOK ============

interface UseQStageVotersResult {
  voters: QStageVoter[];
  loading: boolean;
}

/**
 * Subscribe to recent voters list
 * Best for: Display screen voter grid
 */
export function useQStageVoters(codeId: string | null): UseQStageVotersResult {
  const [voters, setVoters] = useState<QStageVoter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codeId) {
      setVoters([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToQStageVoters(codeId, (newVoters) => {
      setVoters(newVoters);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [codeId]);

  return { voters, loading };
}

// ============ EVENTS HOOK (FOR ANIMATIONS) ============

interface QStageEvents {
  successTriggered?: boolean;
  successTriggeredAt?: number;
  lastThresholdCrossed?: number;
}

interface UseQStageEventsResult {
  events: QStageEvents;
  onSuccessAnimationComplete: () => void;
}

/**
 * Subscribe to events for triggering animations
 * Best for: Display screen to know when to play explosion effect
 */
export function useQStageEvents(codeId: string | null): UseQStageEventsResult {
  const [events, setEvents] = useState<QStageEvents>({});
  const lastSuccessRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!codeId) {
      setEvents({});
      return;
    }

    const unsubscribe = subscribeToQStageEvents(codeId, (newEvents) => {
      // Only trigger if this is a new success event
      if (
        newEvents.successTriggered &&
        newEvents.successTriggeredAt !== lastSuccessRef.current
      ) {
        lastSuccessRef.current = newEvents.successTriggeredAt;
      }
      setEvents(newEvents);
    });

    return () => {
      unsubscribe();
    };
  }, [codeId]);

  const onSuccessAnimationComplete = useCallback(() => {
    // Could clear the event here if needed
  }, []);

  return { events, onSuccessAnimationComplete };
}

// ============ CONFIG HOOK (FROM FIRESTORE) ============

interface UseQStageConfigResult {
  config: QStageConfig | null;
  loading: boolean;
}

/**
 * Subscribe to QStage config from Firestore
 * Best for: Getting settings, thresholds, branding
 */
export function useQStageConfig(
  codeId: string | null,
  mediaId: string | null
): UseQStageConfigResult {
  const [config, setConfig] = useState<QStageConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codeId || !mediaId) {
      setConfig(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToQStageConfig(codeId, mediaId, (newConfig) => {
      setConfig(newConfig);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [codeId, mediaId]);

  return { config, loading };
}

// ============ COMBINED DISPLAY HOOK ============

interface UseQStageDisplayResult {
  config: QStageConfig | null;
  liveData: QStageLiveData | null;
  voters: QStageVoter[];
  events: QStageEvents;
  phase: QStagePhase;
  percentage: number;
  totalVoters: number;
  loading: boolean;
  ready: boolean;
}

/**
 * Combined hook for display screen with all needed data
 * Merges config from Firestore with live data from Realtime DB
 */
export function useQStageDisplay(
  codeId: string | null,
  mediaId: string | null
): UseQStageDisplayResult {
  const { config, loading: configLoading } = useQStageConfig(codeId, mediaId);
  const { data: liveData, loading: liveLoading } = useQStageLive(codeId);
  const { voters } = useQStageVoters(codeId);
  const { events } = useQStageEvents(codeId);

  // Initialize session if it doesn't exist
  useEffect(() => {
    if (!codeId || !config) return;

    const checkAndInit = async () => {
      const exists = await qstageSessionExists(codeId);
      if (!exists) {
        await initQStageSession(codeId);
      }
    };

    checkAndInit();
  }, [codeId, config]);

  const loading = configLoading || liveLoading;
  const ready = !loading && config !== null;

  // Derive commonly used values
  const phase = liveData?.status || config?.currentPhase || 'standby';
  const percentage = liveData?.stats?.likePercent ?? config?.stats?.likePercent ?? 0;
  const totalVoters = liveData?.stats?.totalVoters ?? config?.stats?.totalVoters ?? 0;

  return {
    config,
    liveData,
    voters,
    events,
    phase,
    percentage,
    totalVoters,
    loading,
    ready,
  };
}

// ============ ANIMATED PERCENTAGE HOOK ============

interface UseAnimatedPercentageOptions {
  targetPercent: number;
  easingFactor?: number; // 0-1, higher = faster (default 0.15)
  enabled?: boolean;
}

/**
 * Hook for smooth percentage animation (60fps)
 * Uses requestAnimationFrame for butter-smooth updates
 */
export function useAnimatedPercentage({
  targetPercent,
  easingFactor = 0.15,
  enabled = true,
}: UseAnimatedPercentageOptions): number {
  const [displayPercent, setDisplayPercent] = useState(targetPercent);
  const currentRef = useRef(targetPercent);
  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!enabled) {
      setDisplayPercent(targetPercent);
      return;
    }

    const animate = () => {
      const diff = targetPercent - currentRef.current;

      // Stop animating when close enough
      if (Math.abs(diff) < 0.1) {
        currentRef.current = targetPercent;
        setDisplayPercent(targetPercent);
        return;
      }

      // Lerp towards target
      currentRef.current += diff * easingFactor;
      setDisplayPercent(currentRef.current);

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [targetPercent, easingFactor, enabled]);

  return displayPercent;
}

// ============ THRESHOLD COLOR HOOK ============

import { QStageThreshold, DEFAULT_QSTAGE_THRESHOLDS } from '@/types/qstage';

interface UseThresholdColorResult {
  color: string;
  glowColor: string;
  label?: string;
  thresholdIndex: number;
}

/**
 * Get current color based on percentage and thresholds
 */
export function useThresholdColor(
  percentage: number,
  thresholds: QStageThreshold[] = DEFAULT_QSTAGE_THRESHOLDS
): UseThresholdColorResult {
  // Find the highest threshold that the percentage has passed
  let activeThreshold = thresholds[0];
  let thresholdIndex = 0;

  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (percentage >= thresholds[i].percentage) {
      activeThreshold = thresholds[i];
      thresholdIndex = i;
      break;
    }
  }

  return {
    color: activeThreshold.color,
    glowColor: activeThreshold.glowColor || `${activeThreshold.color}80`,
    label: activeThreshold.label,
    thresholdIndex,
  };
}
