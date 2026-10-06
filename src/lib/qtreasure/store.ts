/**
 * Q.Treasure data store — Admin SDK data-access layer for the treasure hot path.
 *
 * This is the single seam through which all treasure player/scan reads and writes
 * flow from the API routes. Keeping it thin and isolated means a future migration
 * of the high-volume game-session data (players/scans/leaderboard) to another
 * backend (e.g. Supabase) is a contained change rather than a rewrite. Config +
 * ownership stay in Firestore either way.
 *
 * All writes go through the Admin SDK so they bypass the (now locked) client
 * security rules on `qtreasure_players` / `qtreasure_scans`.
 */

import type { DocumentData } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { QTreasureConfig, QTreasurePlayer, QTreasureScan } from '@/types/qtreasure';

const PLAYERS = 'qtreasure_players';
const SCANS = 'qtreasure_scans';

export interface TreasureCodeConfig {
  codeData: DocumentData;
  config: QTreasureConfig;
  mediaId: string;
  mediaIndex: number;
}

/** Read the code doc and locate its Q.Treasure media item + config. */
export async function getTreasureCodeConfig(codeId: string): Promise<TreasureCodeConfig | null> {
  const snap = await getAdminDb().collection('codes').doc(codeId).get();
  if (!snap.exists) return null;
  const codeData = snap.data() as DocumentData;
  const media: Array<{ id: string; type: string; qtreasureConfig?: QTreasureConfig }> =
    codeData.media || [];
  const mediaIndex = media.findIndex((m) => m.type === 'qtreasure' && m.qtreasureConfig);
  if (mediaIndex === -1) return null;
  return {
    codeData,
    config: media[mediaIndex].qtreasureConfig as QTreasureConfig,
    mediaId: media[mediaIndex].id,
    mediaIndex,
  };
}

export async function getTreasurePlayer(
  codeId: string,
  playerId: string
): Promise<QTreasurePlayer | null> {
  const snap = await getAdminDb()
    .collection('codes')
    .doc(codeId)
    .collection(PLAYERS)
    .doc(playerId)
    .get();
  return snap.exists ? (snap.data() as QTreasurePlayer) : null;
}

export async function createTreasurePlayer(codeId: string, player: QTreasurePlayer): Promise<void> {
  await getAdminDb()
    .collection('codes')
    .doc(codeId)
    .collection(PLAYERS)
    .doc(player.id)
    .set(player);
}

export async function updateTreasurePlayer(
  codeId: string,
  playerId: string,
  patch: Partial<QTreasurePlayer>
): Promise<void> {
  await getAdminDb()
    .collection('codes')
    .doc(codeId)
    .collection(PLAYERS)
    .doc(playerId)
    .update(patch);
}

/** Has this player already scanned this station? (dedupe guard) */
export async function hasScannedStation(
  codeId: string,
  playerId: string,
  stationId: string
): Promise<boolean> {
  const q = await getAdminDb()
    .collection('codes')
    .doc(codeId)
    .collection(SCANS)
    .where('playerId', '==', playerId)
    .where('stationId', '==', stationId)
    .limit(1)
    .get();
  return !q.empty;
}

export async function createTreasureScan(codeId: string, scan: QTreasureScan): Promise<void> {
  await getAdminDb()
    .collection('codes')
    .doc(codeId)
    .collection(SCANS)
    .doc(scan.id)
    .set(scan);
}

/** Persist a partial config patch onto the Q.Treasure media item (phase changes). */
export async function patchTreasureConfig(
  codeId: string,
  mediaId: string,
  patch: Partial<QTreasureConfig>
): Promise<void> {
  const db = getAdminDb();
  const ref = db.collection('codes').doc(codeId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('CODE_NOT_FOUND');
  const codeData = snap.data() as DocumentData;
  const media = [...(codeData.media || [])];
  const idx = media.findIndex((m: { id: string }) => m.id === mediaId);
  if (idx === -1) throw new Error('MEDIA_NOT_FOUND');
  media[idx] = {
    ...media[idx],
    qtreasureConfig: { ...(media[idx].qtreasureConfig || {}), ...patch },
  };
  await ref.update({ media });
}

/** Delete all players + scans for a fresh session (used by the phase reset). */
export async function resetTreasureSession(codeId: string): Promise<void> {
  const db = getAdminDb();
  const base = db.collection('codes').doc(codeId);
  for (const sub of [PLAYERS, SCANS]) {
    const snap = await base.collection(sub).get();
    let batch = db.batch();
    let n = 0;
    for (const d of snap.docs) {
      batch.delete(d.ref);
      n += 1;
      // Firestore batch limit is 500; commit in chunks well below it.
      if (n % 400 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    if (n % 400 !== 0) await batch.commit();
  }
}

export interface StationResolution {
  found: boolean;
  mainCodeId?: string;
  mainCodeShortId?: string;
  stationId?: string;
  stationOrder?: number;
  totalStations?: number;
  gameTitle?: string;
}

/**
 * Resolve a scanned station shortId → parent Q.Treasure game WITHOUT scanning the
 * whole `codes` collection. A station QR is its own `codes` doc carrying a
 * `parentCodeShortId` back-pointer, so we hop: shortId → station doc → parent code.
 * Two indexed shortId lookups instead of a full-collection scan.
 */
export async function resolveTreasureStation(stationShortId: string): Promise<StationResolution> {
  const db = getAdminDb();

  const stationSnap = await db
    .collection('codes')
    .where('shortId', '==', stationShortId)
    .limit(1)
    .get();
  if (stationSnap.empty) return { found: false };
  const parentShortId: string | undefined = stationSnap.docs[0].data().parentCodeShortId;
  if (!parentShortId) return { found: false };

  const parentSnap = await db
    .collection('codes')
    .where('shortId', '==', parentShortId)
    .limit(1)
    .get();
  if (parentSnap.empty) return { found: false };

  const parentDoc = parentSnap.docs[0];
  const parentData = parentDoc.data();
  const media = parentData.media || [];
  const qtreasureMedia = media.find(
    (m: { type: string; qtreasureConfig?: QTreasureConfig }) =>
      m.type === 'qtreasure' && m.qtreasureConfig
  );
  if (!qtreasureMedia?.qtreasureConfig) return { found: false };

  const config: QTreasureConfig = qtreasureMedia.qtreasureConfig;
  const station = config.stations.find((s) => s.isActive && s.stationShortId === stationShortId);
  if (!station) return { found: false };

  const activeStations = config.stations.filter((s) => s.isActive);
  return {
    found: true,
    mainCodeId: parentDoc.id,
    mainCodeShortId: parentData.shortId,
    stationId: station.id,
    stationOrder: station.order,
    totalStations: activeStations.length,
    gameTitle: config.branding?.gameTitle || 'ציד אוצרות',
  };
}
