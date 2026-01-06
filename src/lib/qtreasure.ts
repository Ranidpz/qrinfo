/**
 * QTreasure - Firestore operations for treasure hunt game
 * Handles session configuration, players, scans, and progress tracking
 */

import { db } from './firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  writeBatch,
  onSnapshot,
  Unsubscribe,
  where,
} from 'firebase/firestore';
import {
  QTreasureConfig,
  QTreasurePlayer,
  QTreasureScan,
  QTreasurePhase,
  QTreasureStation,
  QTreasureStats,
  QTreasureLeaderboardEntry,
  DEFAULT_QTREASURE_CONFIG,
} from '@/types/qtreasure';

// ============ SESSION MANAGEMENT ============

/**
 * Get QTreasure config from a code's media item
 */
export async function getQTreasureConfig(codeId: string, mediaId: string): Promise<QTreasureConfig | null> {
  try {
    const codeDoc = await getDoc(doc(db, 'codes', codeId));
    if (!codeDoc.exists()) return null;

    const data = codeDoc.data();
    const media = data.media?.find((m: { id: string }) => m.id === mediaId);

    return media?.qtreasureConfig || null;
  } catch (error) {
    console.error('Error getting QTreasure config:', error);
    return null;
  }
}

/**
 * Update QTreasure config in a code's media item
 */
export async function updateQTreasureConfig(
  codeId: string,
  mediaId: string,
  updates: Partial<QTreasureConfig>
): Promise<boolean> {
  try {
    const codeRef = doc(db, 'codes', codeId);
    const codeDoc = await getDoc(codeRef);
    if (!codeDoc.exists()) return false;

    const data = codeDoc.data();
    const mediaIndex = data.media?.findIndex((m: { id: string }) => m.id === mediaId);
    if (mediaIndex === -1 || mediaIndex === undefined) return false;

    // Update the specific media item's qtreasureConfig
    const updatedMedia = [...data.media];
    updatedMedia[mediaIndex] = {
      ...updatedMedia[mediaIndex],
      qtreasureConfig: {
        ...updatedMedia[mediaIndex].qtreasureConfig,
        ...updates,
      },
    };

    await updateDoc(codeRef, { media: updatedMedia });
    return true;
  } catch (error) {
    console.error('Error updating QTreasure config:', error);
    return false;
  }
}

/**
 * Change QTreasure phase
 */
export async function setQTreasurePhase(
  codeId: string,
  mediaId: string,
  phase: QTreasurePhase
): Promise<boolean> {
  const updates: Partial<QTreasureConfig> = { currentPhase: phase };

  // Add timestamps based on phase
  if (phase === 'playing') {
    updates.gameStartedAt = Date.now();
  } else if (phase === 'registration') {
    updates.lastResetAt = Date.now();
  }

  return updateQTreasureConfig(codeId, mediaId, updates);
}

// ============ PLAYER MANAGEMENT ============

/**
 * Register a new player
 */
export async function registerTreasurePlayer(
  codeId: string,
  player: {
    id: string;
    nickname: string;
    avatarType: 'emoji' | 'selfie';
    avatarValue: string;
    consent: boolean;
  }
): Promise<QTreasurePlayer | null> {
  try {
    const playerRef = doc(db, 'codes', codeId, 'qtreasure_players', player.id);

    // Check if already registered
    const existingPlayer = await getDoc(playerRef);
    if (existingPlayer.exists()) {
      // Return existing player data
      return existingPlayer.data() as QTreasurePlayer;
    }

    const newPlayer: QTreasurePlayer = {
      ...player,
      registeredAt: Date.now(),
      currentStationIndex: 0,
      completedStations: [],
      stationTimes: {},
      totalXP: 0,
      outOfOrderScans: 0,
    };

    await setDoc(playerRef, newPlayer);
    return newPlayer;
  } catch (error) {
    console.error('Error registering player:', error);
    return null;
  }
}

/**
 * Get a player by ID
 */
export async function getTreasurePlayer(codeId: string, playerId: string): Promise<QTreasurePlayer | null> {
  try {
    const playerRef = doc(db, 'codes', codeId, 'qtreasure_players', playerId);
    const playerDoc = await getDoc(playerRef);

    if (!playerDoc.exists()) return null;
    return playerDoc.data() as QTreasurePlayer;
  } catch (error) {
    console.error('Error getting player:', error);
    return null;
  }
}

/**
 * Update player data
 */
export async function updateTreasurePlayer(
  codeId: string,
  playerId: string,
  updates: Partial<QTreasurePlayer>
): Promise<boolean> {
  try {
    const playerRef = doc(db, 'codes', codeId, 'qtreasure_players', playerId);
    await updateDoc(playerRef, updates);
    return true;
  } catch (error) {
    console.error('Error updating player:', error);
    return false;
  }
}

/**
 * Get all players for a game
 */
export async function getAllTreasurePlayers(codeId: string): Promise<QTreasurePlayer[]> {
  try {
    const playersRef = collection(db, 'codes', codeId, 'qtreasure_players');
    const snapshot = await getDocs(playersRef);
    return snapshot.docs.map(doc => doc.data() as QTreasurePlayer);
  } catch (error) {
    console.error('Error getting all players:', error);
    return [];
  }
}

/**
 * Start the hunt for a player
 */
export async function startTreasureHunt(
  codeId: string,
  playerId: string
): Promise<{ startedAt: number } | null> {
  try {
    const startedAt = Date.now();

    await updateTreasurePlayer(codeId, playerId, {
      startedAt,
    });

    return { startedAt };
  } catch (error) {
    console.error('Error starting hunt:', error);
    return null;
  }
}

// ============ SCAN MANAGEMENT ============

/**
 * Record a station scan
 */
export async function recordTreasureScan(
  codeId: string,
  scan: QTreasureScan
): Promise<boolean> {
  try {
    const scanRef = doc(db, 'codes', codeId, 'qtreasure_scans', scan.id);
    await setDoc(scanRef, scan);
    return true;
  } catch (error) {
    console.error('Error recording scan:', error);
    return false;
  }
}

/**
 * Get player's scans
 */
export async function getTreasurePlayerScans(codeId: string, playerId: string): Promise<QTreasureScan[]> {
  try {
    const scansRef = collection(db, 'codes', codeId, 'qtreasure_scans');
    const q = query(
      scansRef,
      where('playerId', '==', playerId),
      orderBy('scannedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as QTreasureScan);
  } catch (error) {
    console.error('Error getting player scans:', error);
    return [];
  }
}

/**
 * Check if player has already scanned a station
 */
export async function hasScannedStation(
  codeId: string,
  playerId: string,
  stationId: string
): Promise<boolean> {
  try {
    const scansRef = collection(db, 'codes', codeId, 'qtreasure_scans');
    const q = query(
      scansRef,
      where('playerId', '==', playerId),
      where('stationId', '==', stationId),
      limit(1)
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking scanned station:', error);
    return false;
  }
}

/**
 * Find a station by its shortId
 */
export function findStationByShortId(
  stations: QTreasureStation[],
  shortId: string
): QTreasureStation | undefined {
  return stations.find(s =>
    s.isActive && s.stationShortId === shortId
  );
}

/**
 * Process a station scan - the main game logic
 */
export async function processTreasureScan(
  codeId: string,
  playerId: string,
  stationShortId: string,
  config: QTreasureConfig
): Promise<{
  success: boolean;
  error?: string;
  station?: QTreasureStation;
  xpEarned?: number;
  isInOrder?: boolean;
  isComplete?: boolean;
  outOfOrderMessage?: string;
  expectedStationOrder?: number;
  timeFromPrevious?: number;
  totalTimeMs?: number;
}> {
  try {
    // Get player
    const player = await getTreasurePlayer(codeId, playerId);
    if (!player) {
      return { success: false, error: 'notRegistered' };
    }

    // Find station
    const station = findStationByShortId(config.stations, stationShortId);
    if (!station) {
      return { success: false, error: 'stationNotFound' };
    }

    // Check if already scanned
    const alreadyScanned = await hasScannedStation(codeId, playerId, station.id);
    if (alreadyScanned) {
      return { success: false, error: 'alreadyCompleted' };
    }

    // Check order
    const expectedOrder = player.currentStationIndex + 1;
    const isInOrder = station.order === expectedOrder;
    let outOfOrderMessage: string | undefined;
    let outOfOrderCount = player.outOfOrderScans;

    if (!isInOrder && !config.allowOutOfOrder) {
      return {
        success: false,
        error: 'outOfOrder',
        expectedStationOrder: expectedOrder,
      };
    }

    if (!isInOrder) {
      outOfOrderMessage = config.language === 'en'
        ? config.outOfOrderWarningEn
        : config.outOfOrderWarning;
      outOfOrderCount += 1;
    }

    // Calculate time from previous station
    const now = Date.now();
    let timeFromPrevious: number | undefined;

    if (player.completedStations.length > 0) {
      const lastStationId = player.completedStations[player.completedStations.length - 1];
      const lastStationTime = player.stationTimes[lastStationId];
      if (lastStationTime) {
        timeFromPrevious = now - lastStationTime;
      }
    } else if (player.startedAt) {
      timeFromPrevious = now - player.startedAt;
    }

    // Record the scan
    const scan: QTreasureScan = {
      id: `scan_${now}_${playerId}_${station.id}`,
      playerId,
      stationId: station.id,
      stationOrder: station.order,
      isInOrder,
      xpEarned: station.xpReward || config.xpPerStation,
      scannedAt: now,
      timeFromPrevious,
    };

    await recordTreasureScan(codeId, scan);

    // Update player progress
    const completedStations = [...player.completedStations, station.id];
    const stationTimes = { ...player.stationTimes, [station.id]: now };
    const totalXP = player.totalXP + scan.xpEarned;

    // Check if hunt is complete
    const isComplete = completedStations.length >= config.stations.filter(s => s.isActive).length;
    let totalTimeMs: number | undefined;
    let completedAt: number | undefined;

    if (isComplete && player.startedAt) {
      totalTimeMs = now - player.startedAt;
      completedAt = now;
    }

    await updateTreasurePlayer(codeId, playerId, {
      currentStationIndex: isInOrder ? station.order : player.currentStationIndex,
      completedStations,
      stationTimes,
      totalXP: isComplete ? totalXP + config.completionBonusXP : totalXP,
      outOfOrderScans: outOfOrderCount,
      ...(isComplete ? { completedAt, totalTimeMs } : {}),
    });

    return {
      success: true,
      station,
      xpEarned: scan.xpEarned + (isComplete ? config.completionBonusXP : 0),
      isInOrder,
      isComplete,
      outOfOrderMessage,
      expectedStationOrder: isInOrder ? undefined : expectedOrder,
      timeFromPrevious,
      totalTimeMs,
    };
  } catch (error) {
    console.error('Error processing scan:', error);
    return { success: false, error: 'serverError' };
  }
}

// ============ LEADERBOARD ============

/**
 * Calculate leaderboard from players (sorted by completion time)
 */
export async function calculateTreasureLeaderboard(codeId: string): Promise<QTreasureLeaderboardEntry[]> {
  const players = await getAllTreasurePlayers(codeId);

  // Only include players who completed the hunt
  const completedPlayers = players.filter(p => p.completedAt && p.totalTimeMs);

  // Sort by completion time (ascending - fastest first)
  const sorted = completedPlayers.sort((a, b) => {
    return (a.totalTimeMs || Infinity) - (b.totalTimeMs || Infinity);
  });

  return sorted.map((player, index) => ({
    playerId: player.id,
    playerName: player.nickname,
    avatarType: player.avatarType,
    avatarValue: player.avatarValue,
    completionTimeMs: player.totalTimeMs || 0,
    stationsCompleted: player.completedStations.length,
    totalXP: player.totalXP,
    completedAt: player.completedAt || 0,
    rank: index + 1,
  }));
}

/**
 * Calculate session stats
 */
export async function calculateTreasureStats(codeId: string, totalStations: number): Promise<QTreasureStats> {
  const players = await getAllTreasurePlayers(codeId);

  const playersPlaying = players.filter(p => p.startedAt && !p.completedAt).length;
  const playersCompleted = players.filter(p => p.completedAt).length;

  const completedTimes = players
    .filter(p => p.totalTimeMs)
    .map(p => p.totalTimeMs!);

  const avgCompletionTimeMs = completedTimes.length > 0
    ? Math.round(completedTimes.reduce((a, b) => a + b, 0) / completedTimes.length)
    : 0;

  const fastestTimeMs = completedTimes.length > 0
    ? Math.min(...completedTimes)
    : 0;

  return {
    totalPlayers: players.length,
    playersPlaying,
    playersCompleted,
    avgCompletionTimeMs,
    fastestTimeMs,
    lastUpdated: Date.now(),
  };
}

// ============ RESET ============

/**
 * Reset the game session (clear all players and scans)
 */
export async function resetTreasureSession(codeId: string): Promise<boolean> {
  try {
    const batch = writeBatch(db);

    // Delete all players
    const playersRef = collection(db, 'codes', codeId, 'qtreasure_players');
    const playersSnapshot = await getDocs(playersRef);
    playersSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Delete all scans
    const scansRef = collection(db, 'codes', codeId, 'qtreasure_scans');
    const scansSnapshot = await getDocs(scansRef);
    scansSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    return true;
  } catch (error) {
    console.error('Error resetting QTreasure session:', error);
    return false;
  }
}

// ============ STATION MANAGEMENT ============

/**
 * Generate a unique station ID
 */
export function generateStationId(): string {
  return `station_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Create a new station
 */
export function createTreasureStation(
  order: number,
  title: string,
  xpReward: number = 10
): QTreasureStation {
  return {
    id: generateStationId(),
    order,
    title,
    xpReward,
    isActive: true,
    createdAt: Date.now(),
  };
}

// ============ REAL-TIME SUBSCRIPTIONS ============

/**
 * Subscribe to players collection changes
 */
export function subscribeToTreasurePlayers(
  codeId: string,
  onUpdate: (players: QTreasurePlayer[]) => void
): Unsubscribe {
  const playersRef = collection(db, 'codes', codeId, 'qtreasure_players');

  return onSnapshot(playersRef, (snapshot) => {
    const players = snapshot.docs.map(doc => doc.data() as QTreasurePlayer);
    onUpdate(players);
  });
}

/**
 * Subscribe to a single player's changes
 */
export function subscribeToTreasurePlayer(
  codeId: string,
  playerId: string,
  onUpdate: (player: QTreasurePlayer | null) => void
): Unsubscribe {
  const playerRef = doc(db, 'codes', codeId, 'qtreasure_players', playerId);

  return onSnapshot(playerRef, (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate(null);
      return;
    }
    onUpdate(snapshot.data() as QTreasurePlayer);
  });
}

/**
 * Subscribe to code document changes (for config updates)
 */
export function subscribeToTreasureConfig(
  codeId: string,
  mediaId: string,
  onUpdate: (config: QTreasureConfig | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, 'codes', codeId), (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate(null);
      return;
    }

    const data = snapshot.data();
    const media = data.media?.find((m: { id: string }) => m.id === mediaId);
    onUpdate(media?.qtreasureConfig || null);
  });
}

// ============ INITIALIZATION ============

/**
 * Initialize a new QTreasure media item with default config
 */
export function createDefaultQTreasureConfig(overrides?: Partial<QTreasureConfig>): QTreasureConfig {
  return {
    ...DEFAULT_QTREASURE_CONFIG,
    ...overrides,
    stats: {
      ...DEFAULT_QTREASURE_CONFIG.stats,
      lastUpdated: Date.now(),
    },
  };
}
