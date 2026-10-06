import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireCodeOwner, isAuthError } from '@/lib/auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import {
  getR2ObjectSize,
  getR2KeyFromUrl,
  getR2PublicUrl,
  deleteR2ObjectByUrl,
} from '@/lib/r2-storage';

// Second half of the presigned Cliostro-video upload: after the browser PUTs the
// file directly to R2, it calls here to (1) verify the object landed + read its
// real size, (2) account the size against the owner's storage quota, and
// (3) optionally delete + decrement a video this one replaces.

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (!checkRateLimit(`qtreasure-video-confirm:${ip}`, RATE_LIMITS.UPLOAD).success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const {
      codeId,
      key,
      replaceUrl,
    }: { codeId?: string; key?: string; replaceUrl?: string } = body;

    if (!codeId || !key) {
      return NextResponse.json({ error: 'codeId and key are required' }, { status: 400 });
    }

    // Owner-only.
    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;

    // The key must live under the owner's folder (prevents accounting another
    // user's object).
    if (!key.startsWith(`${auth.uid}/`)) {
      return NextResponse.json({ error: 'Key does not belong to owner' }, { status: 403 });
    }

    // Verify the upload landed and read its real size.
    const size = await getR2ObjectSize(key);
    if (size === null) {
      return NextResponse.json({ error: 'Upload not found on storage' }, { status: 404 });
    }

    const db = getAdminDb();
    const userRef = db.collection('users').doc(auth.uid);

    // Replace: delete the previous video + decrement its size (best-effort).
    let freedBytes = 0;
    if (replaceUrl) {
      try {
        const oldKey = getR2KeyFromUrl(replaceUrl);
        if (oldKey && oldKey.startsWith(`${auth.uid}/`) && oldKey !== key) {
          const oldSize = await getR2ObjectSize(oldKey);
          await deleteR2ObjectByUrl(replaceUrl);
          if (oldSize) freedBytes = oldSize;
        }
      } catch (e) {
        console.error('Failed to remove replaced video:', e);
      }
    }

    const delta = size - freedBytes;
    if (delta !== 0) {
      await userRef.update({ storageUsed: FieldValue.increment(delta) });
    }

    return NextResponse.json({
      url: getR2PublicUrl(key),
      size,
    });
  } catch (error) {
    console.error('Video confirm error:', error);
    return NextResponse.json({ error: 'Failed to confirm upload' }, { status: 500 });
  }
}
