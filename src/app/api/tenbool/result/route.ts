import { NextRequest, NextResponse } from 'next/server';
import { finishRound } from '@/lib/tenbool/store';
import { PLAY_LIMIT, errorResponse, guardPublic, isValidCodeId, readJson } from '@/lib/tenbool/server';

// Phone mode: the stop. The phone measured the time; the store checks it was physically possible
// for this round and judges it (hit / closest list / miss).
export async function POST(request: NextRequest) {
  const blocked = guardPublic(request, 'play', PLAY_LIMIT);
  if (blocked) return blocked;
  try {
    const { codeId, playerId, token, roundId, ms } = await readJson(request);
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    return NextResponse.json(await finishRound(codeId, playerId, token, roundId, ms));
  } catch (error) {
    return errorResponse(error, 'result');
  }
}
