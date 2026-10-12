import { getAdminDb } from '@/lib/firebase-admin';
import type { RaffleConfig } from '@/lib/raffle/types';
import { resolveMediaSecret, secretsEqual } from '@/lib/codeSecrets.server';

// Server-only helpers for the raffle experience (Admin SDK).
// Participants/winners live in Firestore subcollections under the code:
//   codes/{codeId}/raffle_participants/{participantId}
//   codes/{codeId}/raffle_winners/{autoId}
// Phone numbers NEVER leave the server on the public path.

export interface RaffleContext {
  codeId: string;
  ownerId: string;
  mediaId: string;
  config: RaffleConfig;
}

export interface StoredRaffleParticipant {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  quantity: number;
  remaining: number;
}

export interface StoredRaffleWinner {
  id: string;
  participantId: string;
  firstName: string;
  lastName: string;
  phone: string;
  rank: number;
  wonAt: number;
}

// Load the raffle media + config from a code document.
export async function getRaffleContext(codeId: string): Promise<RaffleContext | null> {
  const db = getAdminDb();
  const snap = await db.collection('codes').doc(codeId).get();
  if (!snap.exists) return null;
  const data = snap.data() as Record<string, unknown> | undefined;
  if (!data) return null;
  const media = (data.media as Array<Record<string, unknown>> | undefined)?.find(
    (m) => m.type === 'raffle'
  );
  if (!media) return null;
  const config = (media.raffleConfig as RaffleConfig) || ({} as RaffleConfig);
  // The big-screen token lives in the owner-only private doc (legacy: on the config).
  const token = await resolveMediaSecret(codeId, media, 'raffleToken');
  return {
    codeId,
    ownerId: String(data.ownerId || ''),
    mediaId: String(media.id || ''),
    config: { ...config, token },
  };
}

/** Raffle context by the public shortId (big-screen page). */
export async function getRaffleContextByShortId(shortId: string): Promise<RaffleContext | null> {
  const snap = await getAdminDb().collection('codes').where('shortId', '==', shortId).limit(1).get();
  const docSnap = snap.docs[0];
  if (!docSnap) return null;
  return getRaffleContext(docSnap.id);
}

// Constant-time-ish token check for the public big-screen link.
export function raffleTokenValid(config: RaffleConfig, token: string | null): boolean {
  return secretsEqual(config.token, token);
}

export function participantsCol(codeId: string) {
  return getAdminDb().collection('codes').doc(codeId).collection('raffle_participants');
}

export function winnersCol(codeId: string) {
  return getAdminDb().collection('codes').doc(codeId).collection('raffle_winners');
}
