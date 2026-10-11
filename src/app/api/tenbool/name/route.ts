import { NextRequest, NextResponse } from 'next/server';
import { cleanNickname } from '@/lib/tenbool/competition';
import { getAuthedPlayer, setNickname } from '@/lib/tenbool/store';
import { errorResponse, guardPublic, isValidCodeId, loadPhoneModeCode, readJson } from '@/lib/tenbool/server';

// Phone mode: the name shown on the closest list (before any hit). Winners set theirs in /claim.
export async function POST(request: NextRequest) {
  const blocked = guardPublic(request, 'name', { maxRequests: 120, windowMs: 60 * 1000 });
  if (blocked) return blocked;
  try {
    const { codeId, playerId, token, nickname } = await readJson(request);
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    const name = cleanNickname(nickname);
    if (!name) return NextResponse.json({ error: 'Invalid name', errorCode: 'INVALID_NAME' }, { status: 400 });
    await loadPhoneModeCode(codeId);
    const { ref, player } = await getAuthedPlayer(codeId, playerId, token);
    // A claimed winner's name is part of the board entry - changed only through the owner
    if (player.claimed) return NextResponse.json({ error: 'Already on the board', errorCode: 'CLAIMED' }, { status: 409 });
    await setNickname(ref, name);
    return NextResponse.json({ success: true, nickname: name });
  } catch (error) {
    return errorResponse(error, 'name');
  }
}
