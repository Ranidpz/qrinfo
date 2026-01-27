import { put, del, list } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import sharp from 'sharp';

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

    const avatarPath = `avatars/${codeId}/${identifier}`;

    // Delete existing avatar if any
    try {
      const existingBlobs = await list({ prefix: avatarPath });
      for (const blob of existingBlobs.blobs) {
        await del(blob.url);
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

    // Upload to Vercel Blob
    const filename = `${avatarPath}.webp`;
    const blob = await put(filename, webpBuffer, {
      access: 'public',
      addRandomSuffix: false,
    });

    // Add cache-busting timestamp to prevent browser caching old images
    const urlWithCacheBust = `${blob.url}?t=${Date.now()}`;

    return NextResponse.json({
      url: urlWithCacheBust,
      size: webpBuffer.length,
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
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Only delete if it's an avatar URL
    if (!url.includes('/avatars/')) {
      return NextResponse.json({ error: 'Invalid avatar URL' }, { status: 400 });
    }

    await del(url);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Avatar delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete avatar' },
      { status: 500 }
    );
  }
}
