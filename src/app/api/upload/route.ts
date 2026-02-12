import { put, del } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import sharp from 'sharp';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`upload:${clientIp}`, RATE_LIMITS.UPLOAD);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many upload requests. Please try again later.' },
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
    const userId = formData.get('userId') as string;
    const codeId = formData.get('codeId') as string | null;
    const folder = formData.get('folder') as string | null;
    const convertToWebp = formData.get('convertToWebp') === 'true';
    const maxWidth = formData.get('maxWidth') ? parseInt(formData.get('maxWidth') as string, 10) : null;
    const quality = formData.get('quality') ? parseInt(formData.get('quality') as string, 10) : 85;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Validate file size
    // Images that will be resized/converted get a higher limit (20MB) since they'll be processed by sharp
    const willBeProcessed = (convertToWebp || maxWidth) && file.type.startsWith('image/') && file.type !== 'image/gif';
    const maxSize = willBeProcessed ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File size exceeds ${willBeProcessed ? '20MB' : '5MB'} limit` },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/heic',
      'image/heif',
      'image/avif',
      'image/bmp',
      'image/tiff',
      'video/mp4',
      'video/webm',
      'application/pdf',
    ];

    if (!allowedTypes.includes(file.type)) {
      console.error('Upload rejected - file type not allowed:', file.type, 'name:', file.name);
      return NextResponse.json(
        { error: 'File type not allowed', fileType: file.type },
        { status: 400 }
      );
    }

    // Generate unique filename with user folder structure
    const timestamp = Date.now();
    let extension = file.name.split('.').pop() || 'bin';
    const randomSuffix = Math.random().toString(36).substring(7);

    // Process image: resize and/or convert to WebP
    let uploadData: File | Buffer = file;
    const convertibleTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/heic', 'image/heif', 'image/avif', 'image/bmp', 'image/tiff'];
    const isImage = convertibleTypes.includes(file.type) || file.type === 'image/webp';

    if (isImage && (convertToWebp || maxWidth)) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        let pipeline = sharp(buffer);

        // Resize if maxWidth is specified (preserve aspect ratio, don't enlarge)
        if (maxWidth) {
          pipeline = pipeline.resize({ width: maxWidth, fit: 'inside', withoutEnlargement: true });
        }

        // Convert to WebP (supports transparency/alpha)
        if (convertToWebp && convertibleTypes.includes(file.type)) {
          uploadData = await pipeline.webp({ quality, alphaQuality: 100 }).toBuffer();
          extension = 'webp';
        } else if (maxWidth) {
          // Resize only, keep original format
          if (file.type === 'image/png') {
            uploadData = await pipeline.png({ quality: Math.min(quality, 100) }).toBuffer();
          } else if (file.type === 'image/webp') {
            uploadData = await pipeline.webp({ quality, alphaQuality: 100 }).toBuffer();
          } else {
            uploadData = await pipeline.jpeg({ quality }).toBuffer();
          }
        }
      } catch (conversionError) {
        console.warn('Image processing failed, uploading original:', conversionError);
        // Fall back to original file if processing fails
      }
    }

    // If codeId is provided, save in code folder (for storage tracking)
    // Otherwise save directly in user folder
    let filename: string;
    if (codeId && folder) {
      filename = `${userId}/${codeId}/${folder}/${timestamp}_${randomSuffix}.${extension}`;
    } else if (codeId) {
      filename = `${userId}/${codeId}/${timestamp}_${randomSuffix}.${extension}`;
    } else {
      filename = `${userId}/${timestamp}_${randomSuffix}.${extension}`;
    }

    // Upload to Vercel Blob
    const blob = await put(filename, uploadData, {
      access: 'public',
      addRandomSuffix: false,
    });

    // Determine media type
    let mediaType: 'image' | 'video' | 'pdf' | 'gif' = 'image';
    if (file.type === 'application/pdf') {
      mediaType = 'pdf';
    } else if (file.type === 'image/gif') {
      mediaType = 'gif';
    } else if (file.type.startsWith('video/')) {
      mediaType = 'video';
    }

    // Calculate actual uploaded size
    const uploadedSize = uploadData instanceof Buffer ? uploadData.length : file.size;

    return NextResponse.json({
      url: blob.url,
      size: uploadedSize,
      type: mediaType,
      filename: file.name,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`delete:${clientIp}`, RATE_LIMITS.DELETE);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many delete requests. Please try again later.' },
        { status: 429 }
      );
    }

    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    await del(url);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}
