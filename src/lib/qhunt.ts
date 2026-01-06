/**
 * QHunt - Firestore operations for code hunting game
 * Handles session configuration, players, scans, and teams
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
  deleteDoc,
  writeBatch,
  onSnapshot,
  Unsubscribe,
  where,
} from 'firebase/firestore';
import {
  QHuntConfig,
  QHuntPlayer,
  QHuntScan,
  QHuntPhase,
  QHuntCodeType,
  QHuntTeam,
  QHuntCode,
  QHuntStats,
  QHuntLeaderboardEntry,
  QHuntTeamScore,
  DEFAULT_QHUNT_CONFIG,
} from '@/types/qhunt';

// ============ SESSION MANAGEMENT ============

/**
 * Get QHunt config from a code's media item
 */
export async function getQHuntConfig(codeId: string, mediaId: string): Promise<QHuntConfig | null> {
  try {
    const codeDoc = await getDoc(doc(db, 'codes', codeId));
    if (!codeDoc.exists()) return null;

    const data = codeDoc.data();
    const media = data.media?.find((m: { id: string }) => m.id === mediaId);

    return media?.qhuntConfig || null;
  } catch (error) {
    console.error('Error getting QHunt config:', error);
    return null;
  }
}

/**
 * Update QHunt config in a code's media item
 */
export async function updateQHuntConfig(
  codeId: string,
  mediaId: string,
  updates: Partial<QHuntConfig>
): Promise<boolean> {
  try {
    const codeRef = doc(db, 'codes', codeId);
    const codeDoc = await getDoc(codeRef);
    if (!codeDoc.exists()) return false;

    const data = codeDoc.data();
    const mediaIndex = data.media?.findIndex((m: { id: string }) => m.id === mediaId);
    if (mediaIndex === -1 || mediaIndex === undefined) return false;

    // Update the specific media item's qhuntConfig
    const updatedMedia = [...data.media];
    updatedMedia[mediaIndex] = {
      ...updatedMedia[mediaIndex],
      qhuntConfig: {
        ...updatedMedia[mediaIndex].qhuntConfig,
        ...updates,
      },
    };

    await updateDoc(codeRef, { media: updatedMedia });
    return true;
  } catch (error) {
    console.error('Error updating QHunt config:', error);
    return false;
  }
}

/**
 * Change QHunt phase
 */
export async function setQHuntPhase(
  codeId: string,
  mediaId: string,
  phase: QHuntPhase
): Promise<boolean> {
  const updates: Partial<QHuntConfig> = { currentPhase: phase };

  // Add timestamps based on phase
  if (phase === 'playing') {
    updates.gameStartedAt = Date.now();
  } else if (phase === 'finished' || phase === 'results') {
    updates.gameEndedAt = Date.now();
  } else if (phase === 'registration') {
    updates.lastResetAt = Date.now();
  }

  return updateQHuntConfig(codeId, mediaId, updates);
}

// ============ PLAYER MANAGEMENT ============

/**
 * Register a new player
 */
export async function registerPlayer(
  codeId: string,
  player: Omit<QHuntPlayer, 'assignedCodeType' | 'currentScore' | 'scansCount' | 'isFinished' | 'gameStartedAt' | 'gameEndedAt'>
): Promise<QHuntPlayer | null> {
  try {
    const playerRef = doc(db, 'codes', codeId, 'qhunt_players', player.id);

    // Check if already registered
    const existingPlayer = await getDoc(playerRef);
    if (existingPlayer.exists()) {
      // Return existing player data
      return existingPlayer.data() as QHuntPlayer;
    }

    const newPlayer: QHuntPlayer = {
      ...player,
      currentScore: 0,
      scansCount: 0,
      isFinished: false,
      registeredAt: Date.now(),
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
export async function getPlayer(codeId: string, playerId: string): Promise<QHuntPlayer | null> {
  try {
    const playerRef = doc(db, 'codes', codeId, 'qhunt_players', playerId);
    const playerDoc = await getDoc(playerRef);

    if (!playerDoc.exists()) return null;
    return playerDoc.data() as QHuntPlayer;
  } catch (error) {
    console.error('Error getting player:', error);
    return null;
  }
}

/**
 * Update player data
 */
export async function updatePlayer(
  codeId: string,
  playerId: string,
  updates: Partial<QHuntPlayer>
): Promise<boolean> {
  try {
    const playerRef = doc(db, 'codes', codeId, 'qhunt_players', playerId);
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
export async function getAllPlayers(codeId: string): Promise<QHuntPlayer[]> {
  try {
    const playersRef = collection(db, 'codes', codeId, 'qhunt_players');
    const snapshot = await getDocs(playersRef);
    return snapshot.docs.map(doc => doc.data() as QHuntPlayer);
  } catch (error) {
    console.error('Error getting all players:', error);
    return [];
  }
}

/**
 * Assign a random code type to a player (anti-cheat)
 */
export function assignRandomCodeType(
  availableTypes: QHuntCodeType[],
  existingAssignments?: Record<string, QHuntCodeType>
): QHuntCodeType {
  if (!existingAssignments || Object.keys(existingAssignments).length === 0) {
    return availableTypes[Math.floor(Math.random() * availableTypes.length)];
  }

  // Balance distribution - count existing assignments
  const typeCounts = availableTypes.reduce((acc, type) => {
    acc[type] = Object.values(existingAssignments).filter(t => t === type).length;
    return acc;
  }, {} as Record<QHuntCodeType, number>);

  // Find minimum count
  const minCount = Math.min(...Object.values(typeCounts));

  // Pick randomly from types with minimum count
  const leastUsedTypes = availableTypes.filter(type => typeCounts[type] === minCount);
  return leastUsedTypes[Math.floor(Math.random() * leastUsedTypes.length)];
}

/**
 * Start game for a player (assign code type and start timer)
 */
export async function startPlayerGame(
  codeId: string,
  playerId: string,
  availableTypes: QHuntCodeType[]
): Promise<{ assignedType: QHuntCodeType; gameStartedAt: number } | null> {
  try {
    // Get all players to check existing assignments
    const players = await getAllPlayers(codeId);
    const existingAssignments: Record<string, QHuntCodeType> = {};
    players.forEach(p => {
      if (p.assignedCodeType) {
        existingAssignments[p.id] = p.assignedCodeType;
      }
    });

    const assignedType = assignRandomCodeType(availableTypes, existingAssignments);
    const gameStartedAt = Date.now();

    await updatePlayer(codeId, playerId, {
      assignedCodeType: assignedType,
      gameStartedAt,
    });

    return { assignedType, gameStartedAt };
  } catch (error) {
    console.error('Error starting player game:', error);
    return null;
  }
}

// ============ SCAN MANAGEMENT ============

/**
 * Record a scan
 */
export async function recordScan(
  codeId: string,
  scan: QHuntScan
): Promise<boolean> {
  try {
    const scanRef = doc(db, 'codes', codeId, 'qhunt_scans', scan.id);
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
export async function getPlayerScans(codeId: string, playerId: string): Promise<QHuntScan[]> {
  try {
    const scansRef = collection(db, 'codes', codeId, 'qhunt_scans');
    const q = query(
      scansRef,
      where('playerId', '==', playerId),
      orderBy('scannedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as QHuntScan);
  } catch (error) {
    console.error('Error getting player scans:', error);
    return [];
  }
}

/**
 * Check if player has already scanned a code
 */
export async function hasScannedCode(
  codeId: string,
  playerId: string,
  codeValue: string
): Promise<boolean> {
  try {
    const scansRef = collection(db, 'codes', codeId, 'qhunt_scans');
    const q = query(
      scansRef,
      where('playerId', '==', playerId),
      where('codeValue', '==', codeValue),
      where('isValid', '==', true),
      limit(1)
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking scanned code:', error);
    return false;
  }
}

/**
 * Validate a scan against player's assigned type
 */
export function validateScan(
  code: QHuntCode,
  assignedType: QHuntCodeType | undefined,
  enableTypeBasedHunting: boolean
): boolean {
  if (!enableTypeBasedHunting) return true;
  if (!assignedType) return true;
  return code.codeType === assignedType;
}

/**
 * Find a code by its value
 */
export function findCodeByValue(codes: QHuntCode[], codeValue: string): QHuntCode | undefined {
  return codes.find(c =>
    c.isActive && c.codeValue.toLowerCase() === codeValue.toLowerCase()
  );
}

// ============ LEADERBOARD ============

/**
 * Calculate leaderboard from players
 */
export async function calculateLeaderboard(codeId: string): Promise<QHuntLeaderboardEntry[]> {
  const players = await getAllPlayers(codeId);

  // Sort by score (desc), then by game time (asc for finished players)
  const sorted = players.sort((a, b) => {
    if (b.currentScore !== a.currentScore) {
      return b.currentScore - a.currentScore;
    }
    // If same score, faster time wins
    if (a.isFinished && b.isFinished && a.gameStartedAt && b.gameStartedAt && a.gameEndedAt && b.gameEndedAt) {
      const aTime = a.gameEndedAt - a.gameStartedAt;
      const bTime = b.gameEndedAt - b.gameStartedAt;
      return aTime - bTime;
    }
    return 0;
  });

  return sorted.map((player, index) => ({
    playerId: player.id,
    playerName: player.name,
    avatarType: player.avatarType,
    avatarValue: player.avatarValue,
    teamId: player.teamId,
    score: player.currentScore,
    scansCount: player.scansCount,
    gameTime: player.gameEndedAt && player.gameStartedAt
      ? player.gameEndedAt - player.gameStartedAt
      : undefined,
    isFinished: player.isFinished,
    rank: index + 1,
  }));
}

/**
 * Calculate team scores from players
 */
export async function calculateTeamScores(
  codeId: string,
  teams: QHuntTeam[]
): Promise<QHuntTeamScore[]> {
  const players = await getAllPlayers(codeId);

  const teamScores: Record<string, { score: number; players: number }> = {};

  // Initialize all teams
  teams.forEach(team => {
    teamScores[team.id] = { score: 0, players: 0 };
  });

  // Aggregate player scores by team
  players.forEach(player => {
    if (player.teamId && teamScores[player.teamId]) {
      teamScores[player.teamId].score += player.currentScore;
      teamScores[player.teamId].players += 1;
    }
  });

  // Convert to array and add team info
  const results: QHuntTeamScore[] = teams.map(team => ({
    teamId: team.id,
    teamName: team.name,
    teamColor: team.color,
    score: teamScores[team.id]?.score || 0,
    players: teamScores[team.id]?.players || 0,
    rank: 0,
  }));

  // Sort by score and assign ranks
  results.sort((a, b) => b.score - a.score);
  results.forEach((team, index) => {
    team.rank = index + 1;
  });

  return results;
}

/**
 * Calculate session stats
 */
export async function calculateStats(codeId: string): Promise<QHuntStats> {
  const players = await getAllPlayers(codeId);

  const playersPlaying = players.filter(p => p.gameStartedAt && !p.isFinished).length;
  const playersFinished = players.filter(p => p.isFinished).length;
  const totalScans = players.reduce((sum, p) => sum + p.scansCount, 0);
  const scores = players.map(p => p.currentScore);
  const topScore = scores.length > 0 ? Math.max(...scores) : 0;
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  return {
    totalPlayers: players.length,
    playersPlaying,
    playersFinished,
    totalScans,
    avgScore,
    topScore,
    lastUpdated: Date.now(),
  };
}

// ============ RESET ============

/**
 * Reset the game session (clear all players and scans)
 */
export async function resetQHuntSession(codeId: string): Promise<boolean> {
  try {
    const batch = writeBatch(db);

    // Delete all players
    const playersRef = collection(db, 'codes', codeId, 'qhunt_players');
    const playersSnapshot = await getDocs(playersRef);
    playersSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Delete all scans
    const scansRef = collection(db, 'codes', codeId, 'qhunt_scans');
    const scansSnapshot = await getDocs(scansRef);
    scansSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    return true;
  } catch (error) {
    console.error('Error resetting QHunt session:', error);
    return false;
  }
}

// ============ CODE MANAGEMENT ============

/**
 * Generate a unique code ID
 */
export function generateCodeId(): string {
  return `code_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Generate a random alphanumeric code value
 */
export function generateCodeValue(length: number = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars (0, O, 1, I)
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Create a new hunt code
 */
export function createHuntCode(
  codeType: QHuntCodeType,
  points: number,
  label?: string,
  customValue?: string
): QHuntCode {
  return {
    id: generateCodeId(),
    codeValue: customValue || generateCodeValue(),
    codeType,
    points,
    label,
    isActive: true,
    createdAt: Date.now(),
  };
}

// ============ REAL-TIME SUBSCRIPTIONS ============

/**
 * Subscribe to players collection changes
 */
export function subscribeToQHuntPlayers(
  codeId: string,
  onUpdate: (players: QHuntPlayer[]) => void
): Unsubscribe {
  const playersRef = collection(db, 'codes', codeId, 'qhunt_players');

  return onSnapshot(playersRef, (snapshot) => {
    const players = snapshot.docs.map(doc => doc.data() as QHuntPlayer);
    onUpdate(players);
  });
}

/**
 * Subscribe to code document changes (for config updates)
 */
export function subscribeToQHuntConfig(
  codeId: string,
  mediaId: string,
  onUpdate: (config: QHuntConfig | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, 'codes', codeId), (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate(null);
      return;
    }

    const data = snapshot.data();
    const media = data.media?.find((m: { id: string }) => m.id === mediaId);
    onUpdate(media?.qhuntConfig || null);
  });
}

// ============ INITIALIZATION ============

/**
 * Initialize a new QHunt media item with default config
 */
export function createDefaultQHuntConfig(overrides?: Partial<QHuntConfig>): QHuntConfig {
  return {
    ...DEFAULT_QHUNT_CONFIG,
    ...overrides,
    stats: {
      ...DEFAULT_QHUNT_CONFIG.stats,
      lastUpdated: Date.now(),
    },
  };
}
