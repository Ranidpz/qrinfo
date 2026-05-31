import { NextRequest, NextResponse } from 'next/server';
import { requireCodeOwner, isAuthError } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { participantsCol, winnersCol } from '@/lib/raffle/server';

// Owner-only — full winners list (with phones) for export / WhatsApp, and
// reset (clears winners + restores every participant's remaining count).
export async function GET(request: NextRequest) {
  try {
    const codeId = new URL(request.url).searchParams.get('codeId');
    if (!codeId) return NextResponse.json({ error: 'codeId is required' }, { status: 400 });

    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;

    const snap = await winnersCol(codeId).orderBy('rank', 'asc').get();
    const winners = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ winners, count: winners.length });
  } catch (error) {
    console.error('Raffle winners GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — reset winners and restore participants' remaining = quantity.
export async function DELETE(request: NextRequest) {
  try {
    const codeId = new URL(request.url).searchParams.get('codeId');
    if (!codeId) return NextResponse.json({ error: 'codeId is required' }, { status: 400 });

    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;

    const db = getAdminDb();

    const winSnap = await winnersCol(codeId).get();
    for (let i = 0; i < winSnap.docs.length; i += 450) {
      const batch = db.batch();
      winSnap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    const partSnap = await participantsCol(codeId).get();
    for (let i = 0; i < partSnap.docs.length; i += 450) {
      const batch = db.batch();
      partSnap.docs.slice(i, i + 450).forEach((d) => {
        const q = Number((d.data() as Record<string, unknown>).quantity ?? 1);
        batch.update(d.ref, { remaining: q > 0 ? q : 1 });
      });
      await batch.commit();
    }

    return NextResponse.json({ ok: true, resetWinners: winSnap.size });
  } catch (error) {
    console.error('Raffle winners DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
