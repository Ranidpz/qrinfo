import { NextRequest, NextResponse } from 'next/server';
import { requireCodeOwner, isAuthError } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { participantsCol } from '@/lib/raffle/server';
import { normalizePhoneNumber } from '@/lib/phone-utils';

// Owner-only participant management. Excel is parsed CLIENT-SIDE and sent as
// JSON (the xlsx package is unreliable on Vercel serverless).

interface IncomingParticipant {
  firstName?: string;
  lastName?: string;
  phone?: string;
  quantity?: number;
}

function phoneId(phone: string, fallbackIndex: number): string {
  const norm = normalizePhoneNumber(String(phone || ''));
  const digits = norm.replace(/[^0-9]/g, '');
  return digits || `row-${fallbackIndex}`;
}

// GET — full participant list (with phones) for the owner's management UI.
export async function GET(request: NextRequest) {
  try {
    const codeId = new URL(request.url).searchParams.get('codeId');
    if (!codeId) return NextResponse.json({ error: 'codeId is required' }, { status: 400 });

    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;

    const snap = await participantsCol(codeId).get();
    const participants = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ participants, count: participants.length });
  } catch (error) {
    console.error('Raffle participants GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — import participants. body: { codeId, participants, mode: 'replace'|'merge' }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const codeId: string = body?.codeId;
    const incoming: IncomingParticipant[] = Array.isArray(body?.participants) ? body.participants : [];
    const mode: 'replace' | 'merge' = body?.mode === 'merge' ? 'merge' : 'replace';

    if (!codeId) return NextResponse.json({ error: 'codeId is required' }, { status: 400 });
    if (incoming.length === 0) return NextResponse.json({ error: 'No participants provided' }, { status: 400 });
    if (incoming.length > 50000) return NextResponse.json({ error: 'Too many participants (max 50,000)' }, { status: 400 });

    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;

    const db = getAdminDb();
    const col = participantsCol(codeId);

    // Dedupe by normalized phone (last occurrence wins — client already resolved).
    const byId = new Map<string, { firstName: string; lastName: string; phone: string; quantity: number; remaining: number; rand: number }>();
    incoming.forEach((p, i) => {
      const firstName = String(p.firstName || '').trim();
      const lastName = String(p.lastName || '').trim();
      const phone = String(p.phone || '').trim();
      if (!firstName && !lastName && !phone) return;
      const q = Number(p.quantity);
      const quantity = Number.isFinite(q) && q > 0 ? Math.floor(q) : 1;
      const id = phoneId(phone, i);
      byId.set(id, { firstName, lastName, phone, quantity, remaining: quantity, rand: Math.random() });
    });

    // replace → wipe existing first
    if (mode === 'replace') {
      const existing = await col.get();
      for (let i = 0; i < existing.docs.length; i += 450) {
        const batch = db.batch();
        existing.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }

    const entries = [...byId.entries()];
    for (let i = 0; i < entries.length; i += 450) {
      const batch = db.batch();
      entries.slice(i, i + 450).forEach(([id, data]) => batch.set(col.doc(id), data, { merge: true }));
      await batch.commit();
    }

    return NextResponse.json({ ok: true, count: byId.size });
  } catch (error) {
    console.error('Raffle participants POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH — update a single participant (name/phone/quantity).
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const codeId: string | undefined = body?.codeId;
    const participantId: string | undefined = body?.participantId;
    if (!codeId || !participantId) {
      return NextResponse.json({ error: 'codeId and participantId are required' }, { status: 400 });
    }
    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;

    const firstName = String(body.firstName ?? '').trim();
    const lastName = String(body.lastName ?? '').trim();
    const phone = String(body.phone ?? '').trim();
    const q = Number(body.quantity);
    const quantity = Number.isFinite(q) && q > 0 ? Math.floor(q) : 1;

    await participantsCol(codeId)
      .doc(participantId)
      .set({ firstName, lastName, phone, quantity, remaining: quantity }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Raffle participants PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — one participant (?participantId=) or all.
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const codeId = searchParams.get('codeId');
    const participantId = searchParams.get('participantId');
    if (!codeId) return NextResponse.json({ error: 'codeId is required' }, { status: 400 });

    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;

    const db = getAdminDb();
    const col = participantsCol(codeId);

    if (participantId) {
      await col.doc(participantId).delete();
      return NextResponse.json({ ok: true, deleted: 1 });
    }

    const existing = await col.get();
    for (let i = 0; i < existing.docs.length; i += 450) {
      const batch = db.batch();
      existing.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    return NextResponse.json({ ok: true, deleted: existing.size });
  } catch (error) {
    console.error('Raffle participants DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
