import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireCodeOwner, isAuthError } from '@/lib/auth';
import {
  buildMediaStorageKey,
  deleteStoredObjectByUrl,
  uploadStoredObject,
} from '@/lib/media-storage';

// POST: Upload a candidate photo to the configured media storage
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`qvote-upload:${clientIp}`, RATE_LIMITS.BULK_UPLOAD);

    if (!rateLimit.success) {
      const retryAfterSeconds = Math.max(Math.ceil((rateLimit.resetTime - Date.now()) / 1000), 1);
      return NextResponse.json(
        { error: 'Too many uploads. Try again in a minute.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetTime.toString(),
            'Retry-After': retryAfterSeconds.toString(),
          }
        }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const codeId = formData.get('codeId') as string;
    let ownerId = formData.get('ownerId') as string;

    if (!file || !codeId) {
      return NextResponse.json(
        { error: 'File and codeId are required' },
        { status: 400 }
      );
    }

    // Validate file type (only images allowed)
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only images allowed' },
        { status: 400 }
      );
    }

    // Validate file size (5MB max for Q.Vote photos)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 5MB limit' },
        { status: 400 }
      );
    }

    // Resolve ownerId from Firestore if not provided by client
    if (!ownerId && codeId) {
      try {
        const adminDb = getAdminDb();
        const codeDoc = await adminDb.collection('codes').doc(codeId).get();
        if (codeDoc.exists) {
          ownerId = codeDoc.data()?.ownerId || '';
        }
      } catch (err) {
        console.error('Failed to resolve ownerId for QVote upload:', err);
      }
    }

    // Generate unique filename
    const timestamp = Date.now();
    const photoId = `qvote_${timestamp}_${Math.random().toString(36).substring(7)}`;
    const extension = file.type === 'image/webp' ? 'webp' : 'jpg';

    // Build path with owner folder structure: {ownerId}/{codeId}/qvote/photos/...
    const basePathParts = ownerId ? [ownerId, codeId, 'qvote'] : ['qvote', codeId];

    // Read file into buffer once — File stream may only be consumable once
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Upload main image
    const mainFilename = buildMediaStorageKey([...basePathParts, 'photos'], `${photoId}.${extension}`);
    const mainObject = await uploadStoredObject({
      key: mainFilename,
      body: fileBuffer,
      contentType: file.type,
      mediaType: 'image',
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: {
        ...(ownerId ? { ownerId } : {}),
        codeId,
        folder: 'qvote/photos',
        photoId,
      },
    });

    // Upload thumbnail (same for now - could resize server-side)
    const thumbnailFilename = buildMediaStorageKey([...basePathParts, 'thumbs'], `${photoId}_thumb.${extension}`);
    const thumbnailObject = await uploadStoredObject({
      key: thumbnailFilename,
      body: fileBuffer,
      contentType: file.type,
      mediaType: 'image',
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: {
        ...(ownerId ? { ownerId } : {}),
        codeId,
        folder: 'qvote/thumbs',
        photoId,
      },
    });

    return NextResponse.json({
      success: true,
      id: photoId,
      url: mainObject.url,
      thumbnailUrl: thumbnailObject.url,
      size: mainObject.size,
      thumbnailSize: thumbnailObject.size,
      storageProvider: mainObject.storageProvider,
      storageKey: mainObject.storageKey,
      storageBucket: mainObject.storageBucket,
      contentType: mainObject.contentType,
      thumbnailStorageProvider: thumbnailObject.storageProvider,
      thumbnailStorageKey: thumbnailObject.storageKey,
      thumbnailStorageBucket: thumbnailObject.storageBucket,
      thumbnailContentType: thumbnailObject.contentType,
    });
  } catch (error) {
    console.error('Q.Vote upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}

// DELETE: Remove a Q.Vote photo from configured media storage (admin only)
export async function DELETE(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`qvote-delete:${clientIp}`, RATE_LIMITS.DELETE);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many delete requests. Try again in a minute.' },
        { status: 429 }
      );
    }

    const { imageUrl, thumbnailUrl, codeId } = await request.json();

    // Auth check: only code owner can delete photos
    if (codeId) {
      const auth = await requireCodeOwner(request, codeId);
      if (isAuthError(auth)) return auth.response;
    }

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'imageUrl is required' },
        { status: 400 }
      );
    }

    try {
      await deleteStoredObjectByUrl(imageUrl);
    } catch (deleteError) {
      console.error('Failed to delete main image:', deleteError);
    }

    if (thumbnailUrl) {
      try {
        await deleteStoredObjectByUrl(thumbnailUrl);
      } catch (deleteError) {
        console.error('Failed to delete thumbnail:', deleteError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Q.Vote delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}
