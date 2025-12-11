import { put, del } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';

// Compress and create thumbnail
async function processImage(file: File): Promise<{ main: Blob; thumbnail: Blob }> {
  // For server-side, we just pass through - compression done on client
  // In production, could use sharp for server-side processing
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return {
    main: new Blob([buffer], { type: file.type }),
    thumbnail: new Blob([buffer], { type: file.type }), // Same for now
  };
}

// POST: Upload a candidate photo to Vercel Blob
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`qvote-upload:${clientIp}`, RATE_LIMITS.GALLERY_UPLOAD);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many uploads. Try again in a minute.' },
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

    // Generate unique filename
    const timestamp = Date.now();
    const photoId = `qvote_${timestamp}_${Math.random().toString(36).substring(7)}`;
    const extension = file.type === 'image/webp' ? 'webp' : 'jpg';

    // Upload main image
    const mainFilename = `qvote/${codeId}/photos/${photoId}.${extension}`;
    const mainBlob = await put(mainFilename, file, {
      access: 'public',
      addRandomSuffix: false,
    });

    // Upload thumbnail (same for now - could resize server-side)
    const thumbnailFilename = `qvote/${codeId}/thumbs/${photoId}_thumb.${extension}`;
    const thumbnailBlob = await put(thumbnailFilename, file, {
      access: 'public',
      addRandomSuffix: false,
    });

    return NextResponse.json({
      success: true,
      id: photoId,
      url: mainBlob.url,
      thumbnailUrl: thumbnailBlob.url,
      size: file.size,
    });
  } catch (error) {
    console.error('Q.Vote upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}

// DELETE: Remove a Q.Vote photo from Vercel Blob
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

    const { imageUrl, thumbnailUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'imageUrl is required' },
        { status: 400 }
      );
    }

    // Delete main image
    try {
      await del(imageUrl);
    } catch (deleteError) {
      console.error('Failed to delete main image:', deleteError);
    }

    // Delete thumbnail if provided
    if (thumbnailUrl) {
      try {
        await del(thumbnailUrl);
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
