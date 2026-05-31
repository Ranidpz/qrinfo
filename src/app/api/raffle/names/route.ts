import { NextRequest, NextResponse } from 'next/server';
import { getRaffleContext, raffleTokenValid, participantsCol } from '@/lib/raffle/server';

export const dynamic = 'force-dynamic';

// Public (token-gated) — returns NAMES ONLY for the scrolling reel.
// Phone numbers are never included here.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const codeId = searchParams.get('codeId');
    const token = searchParams.get('token');
    if (!codeId) return NextResponse.json({ error: 'codeId is required' }, { status: 400 });

    const ctx = await getRaffleContext(codeId);
    if (!ctx) return NextResponse.json({ error: 'Raffle not found' }, { status: 404 });
    if (!raffleTokenValid(ctx.config, token)) {
      return NextResponse.json({ error: 'Invalid or missing token' }, { status: 403 });
    }

    const snap = await participantsCol(codeId).get();
    const participants = snap.docs
      .map((d) => {
        const v = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          firstName: String(v.firstName || ''),
          lastName: String(v.lastName || ''),
          remaining: Number(v.remaining ?? 0),
        };
      })
      .filter((p) => p.remaining > 0);

    return NextResponse.json({ participants, count: participants.length });
  } catch (error) {
    console.error('Raffle names GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
