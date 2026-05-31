import { getAdminDb } from '@/lib/firebase-admin';
import type { RaffleConfig } from '@/lib/raffle/types';

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
  return {
    codeId,
    ownerId: String(data.ownerId || ''),
    mediaId: String(media.id || ''),
    config: (media.raffleConfig as RaffleConfig) || ({} as RaffleConfig),
  };
}

// Constant-time-ish token check for the public big-screen link.
export function raffleTokenValid(config: RaffleConfig, token: string | null): boolean {
  if (!config.token) return false;
  if (!token) return false;
  return token === config.token;
}

export function participantsCol(codeId: string) {
  return getAdminDb().collection('codes').doc(codeId).collection('raffle_participants');
}

export function winnersCol(codeId: string) {
  return getAdminDb().collection('codes').doc(codeId).collection('raffle_winners');
}
