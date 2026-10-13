import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import { isValidVoterId } from '@/lib/qvoteXp/logic';
import { loadGamificationSettings, openPack } from '@/lib/qvoteXp/store';

// POST: open one pack the voter earned by voting. The server decides everything —
// how many packs are owed (XP awarded in /api/qvote/vote) and which prize comes out.
export async function POST(request: NextRequest) {
  const rl = checkRateLimit(`qvote-pack:${getClientIp(request)}`, RATE_LIMITS.GAME);
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  try {
    const body = await request.json().catch(() => null);
    const codeId = body?.codeId;
    const voterId = body?.voterId;
    if (typeof codeId !== 'string' || !codeId || codeId.length > 128 || codeId.includes('/') || !isValidVoterId(voterId)) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }
    const perVoter = checkRateLimit(`qvote-pack-voter:${voterId}`, { maxRequests: 10, windowMs: 60 * 1000 });
    if (!perVoter.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const settings = await loadGamificationSettings(codeId);
    if (!settings?.enabled) {
      return NextResponse.json({ error: 'Not available', errorCode: 'DISABLED' }, { status: 403 });
    }

    const result = await openPack(codeId, voterId, settings);
    if (!result.ok) {
      return NextResponse.json({ error: 'Not available', errorCode: result.code }, { status: 409 });
    }
    return NextResponse.json({ success: true, opening: result.opening, packsAvailable: result.packsAvailable });
  } catch (error) {
    console.error('[qvote/pack/open]', error);
    return NextResponse.json({ error: 'Failed to open pack' }, { status: 500 });
  }
}
