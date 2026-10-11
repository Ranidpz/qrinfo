import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { buildMediaStorageKey, uploadStoredObject } from '@/lib/media-storage';
import { R2_STORAGE_PROVIDER, isR2Configured } from '@/lib/r2-storage';
import { cleanNickname, rankFields } from '@/lib/tenbool/competition';
import { claimWin, getAuthedPlayer, winnerPlace } from '@/lib/tenbool/store';
import { errorResponse, guardPublic, isValidCodeId, loadPhoneModeCode } from '@/lib/tenbool/server';

const MAX_PHOTO_BYTES = 1024 * 1024; // the phone crops to a 600px square (~40-120KB)
const PHOTO_TYPES: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };

// Phone mode, the end of the win flow: name + optional selfie -> onto the winners list.
// multipart/form-data: codeId, playerId, token, nickname, photo?
export async function POST(request: NextRequest) {
  const blocked = guardPublic(request, 'claim', { maxRequests: 60, windowMs: 60 * 1000 });
  if (blocked) return blocked;
  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid form' }, { status: 400 });
    }
    const codeId = form.get('codeId');
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    const name = cleanNickname(form.get('nickname'));
    if (!name) return NextResponse.json({ error: 'Invalid name', errorCode: 'INVALID_NAME' }, { status: 400 });

    const { competition, ownerId, shortId } = await loadPhoneModeCode(codeId);
    const { ref, player } = await getAuthedPlayer(codeId, form.get('playerId'), form.get('token'));
    if (!player.won) return NextResponse.json({ error: 'No hit yet', errorCode: 'NOT_WON' }, { status: 409 });
    if (player.claimed) return NextResponse.json({ error: 'Already on the board', errorCode: 'CLAIMED' }, { status: 409 });
    if (competition.verifyWinners && !player.verified) {
      return NextResponse.json({ error: 'Verify the phone first', errorCode: 'NOT_VERIFIED' }, { status: 403 });
    }

    let photoUrl: string | null = null;
    const photo = form.get('photo');
    if (photo && typeof photo !== 'string' && photo.size > 0) {
      const ext = PHOTO_TYPES[photo.type];
      if (!ext) return NextResponse.json({ error: 'Unsupported image', errorCode: 'BAD_PHOTO' }, { status: 400 });
      if (photo.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: 'Image too large', errorCode: 'BAD_PHOTO' }, { status: 413 });
      const uploaded = await uploadStoredObject({
        key: buildMediaStorageKey([ownerId, `tenbool-${shortId}`, 'players'], `${ref.id}_${Date.now()}.${ext}`),
        body: Buffer.from(await photo.arrayBuffer()),
        contentType: photo.type,
        mediaType: 'image',
        ...(isR2Configured() ? { provider: R2_STORAGE_PROVIDER } : {}),
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: { ownerId, codeId, folder: 'tenbool', playerId: ref.id },
      });
      photoUrl = uploaded.url;
      // Players aren't signed in, so the owner's storage quota is counted here (as in /api/gallery)
      try {
        await getAdminDb().collection('users').doc(ownerId).set({ storageUsed: FieldValue.increment(uploaded.size) }, { merge: true });
      } catch (quotaError) {
        console.error('tenbool claim: storage quota update failed', quotaError);
      }
    }

    const next = await claimWin(ref, player, { nickname: name, photoUrl });
    const rank = rankFields(next).winRank;
    const place = rank != null ? await winnerPlace(codeId, rank) : null;
    return NextResponse.json({ success: true, place, nickname: name, photoUrl: next.photoUrl });
  } catch (error) {
    return errorResponse(error, 'claim');
  }
}
