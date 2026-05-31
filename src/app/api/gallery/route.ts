import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireCodeOwner, isAuthError } from '@/lib/auth';
import {
  buildMediaStorageKey,
  deleteStoredObjectByUrl,
  uploadStoredObject,
} from '@/lib/media-storage';

// POST: Upload a gallery image to the configured media storage
// Note: Firestore update is done client-side to avoid permission issues
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`gallery:${clientIp}`, RATE_LIMITS.GALLERY_UPLOAD);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'יותר מדי העלאות. נסה שוב בעוד דקה.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetTime.toString(),
          }
        }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const codeId = formData.get('codeId') as string;
    const ownerId = formData.get('ownerId') as string;
    const uploaderName = formData.get('uploaderName') as string;

    if (!file || !codeId || !ownerId) {
      return NextResponse.json(
        { error: 'File, codeId and ownerId are required' },
        { status: 400 }
      );
    }

    // Validate that ownerId matches the code's actual owner (prevents path traversal)
    try {
      const adminDb = getAdminDb();
      const codeDoc = await adminDb.collection('codes').doc(codeId).get();
      if (!codeDoc.exists) {
        return NextResponse.json({ error: 'Code not found' }, { status: 404 });
      }
      if (codeDoc.data()?.ownerId !== ownerId) {
        return NextResponse.json({ error: 'Invalid ownerId' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: 'Failed to validate code' }, { status: 500 });
    }

    // Validate file type (only images allowed for gallery)
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only images allowed' },
        { status: 400 }
      );
    }

    // Validate file size (1MB max - already cropped/compressed to a ~1000px square WebP on the client)
    const maxSize = 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 1MB limit' },
        { status: 400 }
      );
    }

    // Generate unique filename in owner's folder with correct extension
    const timestamp = Date.now();
    const imageId = `gallery_${timestamp}_${Math.random().toString(36).substring(7)}`;
    const ext = file.type === 'image/webp' ? 'webp' : file.type === 'image/jpeg' ? 'jpg' : 'webp';
    const filename = buildMediaStorageKey(
      [ownerId, codeId, 'gallery'],
      `${imageId}.${ext}`
    );

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadStoredObject({
      key: filename,
      body: buffer,
      contentType: file.type || (ext === 'webp' ? 'image/webp' : 'image/jpeg'),
      mediaType: 'image',
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: {
        ownerId,
        codeId,
        folder: 'gallery',
        imageId,
      },
    });

    // Return the image data - client will update Firestore
    return NextResponse.json({
      success: true,
      image: {
        id: imageId,
        url: uploaded.url,
        uploaderName: uploaderName || 'אנונימי',
        size: uploaded.size,
        storageProvider: uploaded.storageProvider,
        storageKey: uploaded.storageKey,
        storageBucket: uploaded.storageBucket,
        contentType: uploaded.contentType,
      },
    });
  } catch (error) {
    console.error('Gallery upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}

// DELETE: Remove a gallery image from the configured media storage
// Note: Firestore update is done client-side
export async function DELETE(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`gallery-delete:${clientIp}`, RATE_LIMITS.DELETE);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'יותר מדי בקשות מחיקה. נסה שוב בעוד דקה.' },
        { status: 429 }
      );
    }

    const { imageUrl, codeId } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'imageUrl is required' },
        { status: 400 }
      );
    }

    // Auth check: only code owner can delete gallery images
    if (codeId) {
      const auth = await requireCodeOwner(request, codeId);
      if (isAuthError(auth)) return auth.response;
    }

    try {
      await deleteStoredObjectByUrl(imageUrl);
    } catch (deleteError) {
      console.error('Failed to delete gallery object:', deleteError);
      // Continue even if storage deletion fails
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Gallery delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}
