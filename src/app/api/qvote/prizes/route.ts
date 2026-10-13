import { NextRequest, NextResponse } from 'next/server';
import { requireCodeOwner, isAuthError } from '@/lib/auth';
import { sanitizePrizeInput } from '@/lib/qvoteXp/logic';
import { createPrize, deletePrize, listPrizes, listWinners, updatePrize } from '@/lib/qvoteXp/store';

// Owner-only: the Q.Vote pack prize pool + who won what.
// The pool lives in codes/{codeId}/qvotePrizes (locked in rules), so producers who
// aren't super admins can manage prizes too (the route-folder pool needs admin rules).

const isId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);

export async function GET(request: NextRequest) {
  const codeId = request.nextUrl.searchParams.get('codeId');
  if (!isId(codeId)) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const auth = await requireCodeOwner(request, codeId);
  if (isAuthError(auth)) return auth.response;
  try {
    const [prizes, winners] = await Promise.all([listPrizes(codeId), listWinners(codeId)]);
    return NextResponse.json({ prizes, winners });
  } catch (error) {
    console.error('[qvote/prizes GET]', error);
    return NextResponse.json({ error: 'Failed to load prizes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!isId(body?.codeId)) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const auth = await requireCodeOwner(request, body.codeId);
  if (isAuthError(auth)) return auth.response;
  const input = sanitizePrizeInput(body.prize);
  if (!input.ok) return NextResponse.json({ error: 'Invalid prize' }, { status: 400 });
  try {
    const id = await createPrize(body.codeId, input.value);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('[qvote/prizes POST]', error);
    return NextResponse.json({ error: 'Failed to save prize' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!isId(body?.codeId) || !isId(body?.prizeId)) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const auth = await requireCodeOwner(request, body.codeId);
  if (isAuthError(auth)) return auth.response;
  const input = sanitizePrizeInput(body.prize);
  if (!input.ok) return NextResponse.json({ error: 'Invalid prize' }, { status: 400 });
  try {
    const found = await updatePrize(body.codeId, body.prizeId, input.value);
    if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[qvote/prizes PUT]', error);
    return NextResponse.json({ error: 'Failed to save prize' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!isId(body?.codeId) || !isId(body?.prizeId)) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const auth = await requireCodeOwner(request, body.codeId);
  if (isAuthError(auth)) return auth.response;
  try {
    await deletePrize(body.codeId, body.prizeId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[qvote/prizes DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete prize' }, { status: 500 });
  }
}
