import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import sharp from 'sharp';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireCodeOwner, isAuthError } from '@/lib/auth';
import {
  buildMediaStorageKey,
  deleteStoredObjectByUrl,
  deleteStoredObjectsByPrefix,
  uploadStoredObject,
} from '@/lib/media-storage';

// Avatar upload for registration - stores in codeId/avatars folder
// Converts any image format (including HEIC) to WebP
// Deletes old avatar if phone number already has one

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`avatar:${clientIp}`, RATE_LIMITS.UPLOAD);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const codeId = formData.get('codeId') as string;
    const visitorId = formData.get('visitorId') as string;
    const phone = formData.get('phone') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!codeId) {
      return NextResponse.json({ error: 'Code ID is required' }, { status: 400 });
    }

    if (!visitorId) {
      return NextResponse.json({ error: 'Visitor ID is required' }, { status: 400 });
    }

    // Resolve ownerId from code document for organized blob path
    let ownerId: string | null = null;
    try {
      const adminDb = getAdminDb();
      const codeDoc = await adminDb.collection('codes').doc(codeId).get();
      if (codeDoc.exists) {
        ownerId = codeDoc.data()?.ownerId || null;
      }
    } catch (err) {
      console.error('Failed to resolve ownerId for avatar:', err);
    }

    // Validate file size (2MB max for avatars)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 2MB limit' },
        { status: 400 }
      );
    }

    // Create a unique identifier for the avatar
    // Use phone hash if available, otherwise visitorId
    const identifier = phone
      ? Buffer.from(phone).toString('base64url').slice(0, 12)
      : visitorId.slice(0, 12);

    // Organized path: {ownerId}/{codeId}/avatars/{identifier}
    // Legacy fallback: avatars/{codeId}/{identifier}
    const legacyPath = `avatars/${codeId}/${identifier}`;
    const avatarPath = ownerId
      ? `${ownerId}/${codeId}/avatars/${identifier}`
      : legacyPath;

    // Delete existing avatar if any (check both new and legacy paths)
    try {
      await deleteStoredObjectsByPrefix(avatarPath);
      if (ownerId) {
        await deleteStoredObjectsByPrefix(legacyPath);
      }
    } catch {
      // Ignore errors when listing/deleting - might not exist
    }

    // Convert image to WebP using sharp
    let webpBuffer: Buffer;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      webpBuffer = await sharp(buffer)
        .resize(200, 200, {
          fit: 'cover',
          position: 'centre'
        })
        .webp({ quality: 80 })
        .toBuffer();
    } catch (conversionError) {
      console.error('Image conversion error:', conversionError);
      return NextResponse.json(
        { error: 'Failed to process image. Please try a different format (JPEG, PNG).' },
        { status: 400 }
      );
    }

    // Add a unique suffix to prevent stale avatar caching.
    const filename = buildMediaStorageKey(
      avatarPath.split('/').slice(0, -1),
      `${identifier}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webp`
    );
    const uploaded = await uploadStoredObject({
      key: filename,
      body: webpBuffer,
      contentType: 'image/webp',
      mediaType: 'image',
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: {
        ...(ownerId ? { ownerId } : {}),
        codeId,
        folder: 'avatars',
        visitorId,
      },
    });

    return NextResponse.json({
      url: uploaded.url,
      size: uploaded.size,
      storageProvider: uploaded.storageProvider,
      storageKey: uploaded.storageKey,
      storageBucket: uploaded.storageBucket,
      contentType: uploaded.contentType,
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload avatar' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { url, codeId } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Auth check: only code owner can delete avatars
    if (codeId) {
      const auth = await requireCodeOwner(request, codeId);
      if (isAuthError(auth)) return auth.response;
    }

    // Only delete if it's an avatar URL
    if (!url.includes('/avatars/')) {
      return NextResponse.json({ error: 'Invalid avatar URL' }, { status: 400 });
    }

    await deleteStoredObjectByUrl(url);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Avatar delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete avatar' },
      { status: 500 }
    );
  }
}
