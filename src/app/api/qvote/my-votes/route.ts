import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';

/**
 * A voter's own votes in a round (to restore "already voted" state in the viewer).
 * Replaces the public client read of codes/{id}/votes, which exposed every voter's phone.
 * Returns only category/candidate ids — never phones or fingerprints.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(`qvote-my-votes:${getClientIp(request)}`, RATE_LIMITS.GAME);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { codeId, voterId, round } = await request.json();
    if (typeof codeId !== 'string' || !codeId || typeof voterId !== 'string' || !voterId || typeof round !== 'number') {
      return NextResponse.json({ error: 'codeId, voterId and round are required' }, { status: 400 });
    }

    const snapshot = await getAdminDb()
      .collection('codes').doc(codeId).collection('votes')
      .where('voterId', '==', voterId)
      .where('round', '==', round)
      .get();

    const votes = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        categoryId: data.categoryId || null,
        candidateId: data.candidateId,
        round: data.round,
        createdAt: data.createdAt?.toMillis?.() || null,
      };
    });

    return NextResponse.json({ votes });
  } catch (error) {
    console.error('qvote my-votes error:', error);
    return NextResponse.json({ error: 'Failed to load votes' }, { status: 500 });
  }
}
