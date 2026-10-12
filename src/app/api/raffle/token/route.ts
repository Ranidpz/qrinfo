import { NextRequest, NextResponse } from 'next/server';
import { requireCodeOwner, isAuthError } from '@/lib/auth';
import { getRaffleContext } from '@/lib/raffle/server';

export const dynamic = 'force-dynamic';

// Owner-only: the big-screen token, so a signed-in owner who opens the raffle without
// the token link (e.g. via /v/{shortId}) is let straight in.
export async function GET(request: NextRequest) {
  const codeId = request.nextUrl.searchParams.get('codeId');
  if (!codeId) return NextResponse.json({ error: 'codeId is required' }, { status: 400 });

  const auth = await requireCodeOwner(request, codeId);
  if (isAuthError(auth)) return auth.response;

  const ctx = await getRaffleContext(codeId);
  if (!ctx?.config.token) return NextResponse.json({ error: 'Raffle not found' }, { status: 404 });
  return NextResponse.json({ token: ctx.config.token }, { headers: { 'Cache-Control': 'no-store' } });
}
