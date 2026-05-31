import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getRaffleContext, raffleTokenValid, participantsCol, winnersCol } from '@/lib/raffle/server';

export const dynamic = 'force-dynamic';

// Public (token-gated) — performs ONE atomic draw on the server:
// picks a random eligible participant, decrements their remaining count, and
// records a winner. Returns the winner's NAME ONLY (never the phone).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const codeId: string | undefined = body?.codeId;
    const token: string | undefined = body?.token;
    if (!codeId) return NextResponse.json({ error: 'codeId is required' }, { status: 400 });

    const ctx = await getRaffleContext(codeId);
    if (!ctx) return NextResponse.json({ error: 'Raffle not found' }, { status: 404 });
    if (!raffleTokenValid(ctx.config, token ?? null)) {
      return NextResponse.json({ error: 'Invalid or missing token' }, { status: 403 });
    }

    const db = getAdminDb();
    const col = participantsCol(codeId);
    const allowRepeat = ctx.config.allowRepeat !== false;

    // eligible pool (single-field index, auto-created)
    const eligibleSnap = await col.where('remaining', '>', 0).get();
    if (eligibleSnap.empty) {
      return NextResponse.json({ winner: null, reason: 'empty' });
    }

    // current winner count → next rank (aggregate count, 1 read)
    const countSnap = await winnersCol(codeId).count().get();
    const baseRank = (countSnap.data().count as number) || 0;

    // pick a random eligible participant, then commit atomically. Retry a few
    // times in case of a concurrent depletion (rare on a single big screen).
    const docs = eligibleSnap.docs;
    let winner: { id: string; firstName: string; lastName: string; rank: number } | null = null;

    for (let attempt = 0; attempt < 5 && !winner; attempt++) {
      const pick = docs[Math.floor(Math.random() * docs.length)];
      const committed = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(pick.ref);
        if (!fresh.exists) return null;
        const data = fresh.data() as Record<string, unknown>;
        const remaining = Number(data.remaining ?? 0);
        if (remaining <= 0) return null;

        const newRemaining = allowRepeat ? remaining - 1 : 0;
        tx.update(pick.ref, { remaining: newRemaining });

        const rank = baseRank + 1;
        const winnerRef = winnersCol(codeId).doc();
        const won = {
          participantId: pick.id,
          firstName: String(data.firstName || ''),
          lastName: String(data.lastName || ''),
          phone: String(data.phone || ''), // stored server-side only
          rank,
          wonAt: Date.now(),
        };
        tx.set(winnerRef, won);
        return { id: winnerRef.id, firstName: won.firstName, lastName: won.lastName, rank };
      });
      if (committed) winner = committed;
    }

    if (!winner) return NextResponse.json({ winner: null, reason: 'contended' });
    // NOTE: response intentionally omits phone.
    return NextResponse.json({ winner });
  } catch (error) {
    console.error('Raffle draw error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
