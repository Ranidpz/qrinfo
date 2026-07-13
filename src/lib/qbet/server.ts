// QBet server helpers shared by the /api/qbet/* routes.

import { getAdminDb } from '@/lib/firebase-admin';
import type { QBetConfig } from './types';

// Load the qbet config off the code document (Firestore, Admin SDK).
// Returns null when the code doesn't exist or has no qbet experience.
export async function loadQBetConfig(
  codeId: string
): Promise<{ config: QBetConfig; shortId: string } | null> {
  const doc = await getAdminDb().collection('codes').doc(codeId).get();
  if (!doc.exists) return null;
  const data = doc.data()!;
  const media = (data.media || []).find(
    (m: { type?: string }) => m.type === 'qbet'
  );
  if (!media?.qbetConfig) return null;
  return { config: media.qbetConfig as QBetConfig, shortId: data.shortId };
}

export function isValidCodeId(codeId: unknown): codeId is string {
  return typeof codeId === 'string' && /^[a-zA-Z0-9]{10,30}$/.test(codeId);
}
