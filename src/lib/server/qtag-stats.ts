import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * `qtagStats/current.totalRegistered` / `totalGuests` count ACTIVE registrations only —
 * the same rule as `computeQTagStats` on the client — and `maxRegistrations` is checked
 * against them. Call with delta -1 when a guest is cancelled and +1 when restored.
 */
export async function adjustQTagActiveRegistrations(
  codeId: string,
  plusOneCount: number,
  delta: 1 | -1
): Promise<void> {
  const statsRef = getAdminDb().collection('codes').doc(codeId).collection('qtagStats').doc('current');
  const statsDoc = await statsRef.get();
  if (!statsDoc.exists) return;
  await statsRef.update({
    totalRegistered: FieldValue.increment(delta),
    totalGuests: FieldValue.increment(delta * (1 + (plusOneCount || 0))),
    lastUpdated: FieldValue.serverTimestamp(),
  });
}

/** True when the event's registration cap is reached (0 / unset = unlimited). */
export async function isQTagAtCapacity(codeId: string): Promise<boolean> {
  const db = getAdminDb();
  const codeDoc = await db.collection('codes').doc(codeId).get();
  const max = codeDoc.data()?.media?.find((m: { type: string }) => m.type === 'qtag')?.qtagConfig?.maxRegistrations;
  if (!max || max <= 0) return false;
  const statsDoc = await db.collection('codes').doc(codeId).collection('qtagStats').doc('current').get();
  return (statsDoc.data()?.totalRegistered || 0) >= max;
}
