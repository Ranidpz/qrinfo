import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import { isValidVoterId } from '@/lib/qvoteXp/logic';
import { getXpStatus, loadGamificationSettings, voterCodeOf } from '@/lib/qvoteXp/store';

// POST: a voter's XP, packs waiting and prizes won (public — keyed by the voter's own id).
// POST (not GET) so the voter id never lands in URL logs.
export async function POST(request: NextRequest) {
  const rl = checkRateLimit(`qvote-xp:${getClientIp(request)}`, RATE_LIMITS.GAME);
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  try {
    const body = await request.json().catch(() => null);
    const codeId = body?.codeId;
    const voterId = body?.voterId;
    if (typeof codeId !== 'string' || !codeId || codeId.length > 128 || codeId.includes('/') || !isValidVoterId(voterId)) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }

    const settings = await loadGamificationSettings(codeId);
    if (!settings?.enabled) return NextResponse.json({ enabled: false });

    const status = await getXpStatus(codeId, voterId, settings);
    return NextResponse.json({
      enabled: true,
      xpPerVote: settings.xpPerVote,
      threshold: settings.xpForPackThreshold,
      voterCode: voterCodeOf(voterId),
      ...status,
    });
  } catch (error) {
    console.error('[qvote/xp]', error);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}
