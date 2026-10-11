import { NextRequest, NextResponse } from 'next/server';
import { startRound } from '@/lib/tenbool/store';
import { PLAY_LIMIT, errorResponse, guardPublic, isValidCodeId, loadPhoneModeCode, readJson } from '@/lib/tenbool/server';

// Phone mode: a round starts. The attempt is counted here, before the result is known.
// No playerId = this phone's first round, and the player is created now.
export async function POST(request: NextRequest) {
  const blocked = guardPublic(request, 'play', PLAY_LIMIT);
  if (blocked) return blocked;
  try {
    const { codeId, playerId, token } = await readJson(request);
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    await loadPhoneModeCode(codeId);
    return NextResponse.json(await startRound(codeId, playerId ?? null, token));
  } catch (error) {
    return errorResponse(error, 'round');
  }
}
