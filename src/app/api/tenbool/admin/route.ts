import { NextRequest, NextResponse } from 'next/server';
import { requireCodeOwner, isAuthError } from '@/lib/auth';
import { deleteStoredObjectByUrl } from '@/lib/media-storage';
import { clearPhoto, deleteAllPlayers, isValidPlayerId, listPlayers, setHidden } from '@/lib/tenbool/store';
import { errorResponse, isValidCodeId } from '@/lib/tenbool/server';

// Owner only: the players table in the settings modal (full phones - the owner hands out the prizes),
// moderation (hide a player / remove a photo from the big screen) and a full reset between rounds.

async function deletePhotos(urls: string[]) {
  // Best effort - a storage hiccup must never block moderation or a reset
  await Promise.all(urls.map((url) => deleteStoredObjectByUrl(url).catch((e) => console.error('tenbool photo delete failed', e))));
}

export async function GET(request: NextRequest) {
  try {
    const codeId = request.nextUrl.searchParams.get('codeId');
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;
    return NextResponse.json({ players: await listPlayers(codeId) });
  } catch (error) {
    return errorResponse(error, 'admin GET');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { codeId, playerId, action } = body as Record<string, unknown>;
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;

    if (action === 'reset') {
      const { deleted, photos } = await deleteAllPlayers(codeId);
      await deletePhotos(photos);
      return NextResponse.json({ success: true, deleted });
    }
    if (!isValidPlayerId(playerId)) return NextResponse.json({ error: 'Invalid playerId' }, { status: 400 });
    if (action === 'hide' || action === 'unhide') {
      await setHidden(codeId, playerId, action === 'hide');
      return NextResponse.json({ success: true });
    }
    if (action === 'clearPhoto') {
      const url = await clearPhoto(codeId, playerId);
      if (url) await deletePhotos([url]);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return errorResponse(error, 'admin POST');
  }
}
