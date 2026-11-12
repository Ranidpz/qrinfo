import type { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase-admin';
import TheCodeLobby from './TheCodeLobby';

// הקוד — the venue's TV: the families' board, this week ↔ all time.
// Resolved on the server by shortId (Admin SDK, like /v/{shortId}); the board itself is
// polled client-side from the public /api/thecode/leaderboard.

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'הקוד — טבלת הקבוצות',
  robots: { index: false, follow: false },
};

async function resolve(shortId: string): Promise<{ codeId: string; title: string } | null> {
  try {
    const snap = await getAdminDb().collection('codes').where('shortId', '==', shortId).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    const data = doc.data() as { title?: string; media?: { type?: string; title?: string; thecodeConfig?: { title?: string } }[] };
    const m = (data.media || []).find((x) => x?.type === 'thecode');
    if (!m) return null;
    return { codeId: doc.id, title: m.thecodeConfig?.title || m.title || data.title || 'הקוד' };
  } catch (err) {
    console.error('[lobby/thecode] resolve failed', err);
    return null;
  }
}

export default async function TheCodeLobbyPage({ params }: { params: Promise<{ shortId: string }> }) {
  const { shortId } = await params;
  const found = await resolve(shortId);
  return <TheCodeLobby codeId={found?.codeId ?? null} title={found?.title ?? ''} />;
}
