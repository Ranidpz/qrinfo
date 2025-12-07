import { put, del } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';

// POST: Upload a gallery image to Vercel Blob
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

    // Validate file type (only images allowed for gallery)
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only images allowed' },
        { status: 400 }
      );
    }

    // Validate file size (500KB max - already compressed on client)
    const maxSize = 500 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 500KB limit' },
        { status: 400 }
      );
    }

    // Generate unique filename in owner's folder
    const timestamp = Date.now();
    const imageId = `gallery_${timestamp}_${Math.random().toString(36).substring(7)}`;
    const filename = `${ownerId}/${codeId}/gallery/${imageId}.webp`;

    // Upload to Vercel Blob
    const blob = await put(filename, file, {
      access: 'public',
      addRandomSuffix: false,
    });

    // Return the image data - client will update Firestore
    return NextResponse.json({
      success: true,
      image: {
        id: imageId,
        url: blob.url,
        uploaderName: uploaderName || 'אנונימי',
        size: file.size,
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

// DELETE: Remove a gallery image from Vercel Blob
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

    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'imageUrl is required' },
        { status: 400 }
      );
    }

    // Delete from Vercel Blob
    try {
      await del(imageUrl);
    } catch (deleteError) {
      console.error('Failed to delete blob:', deleteError);
      // Continue even if blob deletion fails
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
