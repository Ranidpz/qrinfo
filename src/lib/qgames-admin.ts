/**
 * Q.Games Admin operations (server-side only, uses Admin SDK)
 * Shared between manual reset endpoint and cron auto-reset.
 */

import { getAdminDb, getAdminRtdb } from '@/lib/firebase-admin';

const BATCH_SIZE = 500;

/** Delete all documents in a subcollection, handling batches >500 */
async function deleteSubcollection(collectionPath: string): Promise<number> {
  const db = getAdminDb();
  const collRef = db.collection(collectionPath);
  let totalDeleted = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snapshot = await collRef.limit(BATCH_SIZE).get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    totalDeleted += snapshot.size;

    if (snapshot.size < BATCH_SIZE) break;
  }

  return totalDeleted;
}

/**
 * Reset all Q.Games data for a code.
 * Deletes all players, matches (Firestore) and resets RTDB (queue, stats, leaderboard, etc.)
 */
export async function resetQGamesData(codeId: string): Promise<void> {
  const rtdb = getAdminRtdb();

  // Delete Firestore subcollections
  await Promise.all([
    deleteSubcollection(`codes/${codeId}/qgames_players`),
    deleteSubcollection(`codes/${codeId}/qgames_matches`),
  ]);

  // Reset RTDB via Admin SDK
  await rtdb.ref(`qgames/${codeId}`).set({
    stats: {
      totalPlayers: 0,
      playersOnline: 0,
      totalMatches: 0,
      matchesInProgress: 0,
      lastUpdated: Date.now(),
    },
  });
}
