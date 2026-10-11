import { NextRequest, NextResponse } from 'next/server';
import { getAuthedPlayer, publicStatus, winnerPlace } from '@/lib/tenbool/store';
import { PLAY_LIMIT, errorResponse, guardPublic, isValidCodeId, loadPhoneModeCode, readJson } from '@/lib/tenbool/server';

// Phone mode: where this phone stands (after a refresh the win flow picks up where it stopped).
// POST so the player token never lands in a URL log.
export async function POST(request: NextRequest) {
  const blocked = guardPublic(request, 'play', PLAY_LIMIT);
  if (blocked) return blocked;
  try {
    const { codeId, playerId, token } = await readJson(request);
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    const { competition } = await loadPhoneModeCode(codeId);
    const { player } = await getAuthedPlayer(codeId, playerId, token);
    const place = player.winRank != null ? await winnerPlace(codeId, player.winRank) : null;
    return NextResponse.json({ ...publicStatus(player), place, verifyWinners: competition.verifyWinners });
  } catch (error) {
    return errorResponse(error, 'me');
  }
}
