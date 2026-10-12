import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import {
  buildMediaStorageKey,
  deleteStoredObjectByUrl,
  uploadStoredObject,
} from '@/lib/media-storage';
import { verifyAuthToken } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  adjustStorageUsed,
  canDeleteStoredObject,
  checkStorageQuota,
  getStoredObjectKey,
  getStoredObjectSize,
  ownerOfKey,
} from '@/lib/storage-guard';
import sharp from 'sharp';

// Anonymous Q.Games players may upload a small selfie avatar into the owner's code folder.
const ANON_AVATAR_MAX_BYTES = 1024 * 1024;

const PDF_SIGNATURE = Buffer.from('%PDF-');

async function hasPdfSignature(file: File): Promise<boolean> {
  const header = Buffer.from(await file.slice(0, Math.min(file.size, 1024)).arrayBuffer());
  return header.includes(PDF_SIGNATURE);
}

function getUploadContentType(file: File, mediaType: 'image' | 'video' | 'pdf' | 'gif', extension: string): string {
  if (mediaType === 'pdf') return 'application/pdf';
  if (extension === 'webp') return 'image/webp';
  if (mediaType === 'gif') return 'image/gif';
  return file.type || 'application/octet-stream';
}

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

    // The storage owner comes from the verified token — never from the form.
    // Without a token, only a Q.Games player selfie is accepted, stored under the code's owner.
    let userId: string;
    let anonymousAvatar = false;
    if (request.headers.get('Authorization')) {
      const authResult = await verifyAuthToken(request);
      if ('error' in authResult) return authResult.error;
      userId = authResult.uid;
    } else {
      if (folder !== 'avatars' || !codeId || !file.type.startsWith('image/') || file.size > ANON_AVATAR_MAX_BYTES) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      const codeDoc = await getAdminDb().collection('codes').doc(codeId).get();
      const codeData = codeDoc.data();
      const hasQGames = Array.isArray(codeData?.media) &&
        codeData.media.some((m: { type?: string }) => m?.type === 'qgames');
      if (!codeData?.ownerId || !hasQGames) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      userId = codeData.ownerId as string;
      anonymousAvatar = true;
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

    const fileNameLower = file.name.toLowerCase();
    const isPdfByName = fileNameLower.endsWith('.pdf');
    const isPdfByMime = file.type === 'application/pdf';
    const isPdfUpload = (isPdfByMime || isPdfByName) && await hasPdfSignature(file);

    if ((isPdfByMime || isPdfByName) && !isPdfUpload) {
      console.error('Upload rejected - PDF signature missing:', file.type, 'name:', file.name);
      return NextResponse.json(
        { error: 'Invalid PDF file' },
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

    if (!allowedTypes.includes(file.type) && !isPdfUpload) {
      console.error('Upload rejected - file type not allowed:', file.type, 'name:', file.name);
      return NextResponse.json(
        { error: 'File type not allowed', fileType: file.type },
        { status: 400 }
      );
    }

    // Server-side storage quota (players' selfies count toward the owner but never block a live game)
    if (!anonymousAvatar) {
      const quota = await checkStorageQuota(userId, file.size);
      if (!quota.ok) {
        return NextResponse.json(
          { error: 'Storage limit reached', code: 'STORAGE_LIMIT', used: quota.used, limit: quota.limit },
          { status: 413 }
        );
      }
    }

    const timestamp = Date.now();
    let extension = isPdfUpload ? 'pdf' : file.name.split('.').pop() || 'bin';
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

    const effectiveFolder = folder || (isPdfUpload ? 'booklets' : null);

    // If codeId is provided, save in code folder (for storage tracking)
    // Otherwise save directly in user folder
    let filename: string;
    if (codeId && effectiveFolder) {
      filename = `${userId}/${codeId}/${effectiveFolder}/${timestamp}_${randomSuffix}.${extension}`;
    } else if (codeId) {
      filename = `${userId}/${codeId}/${timestamp}_${randomSuffix}.${extension}`;
    } else if (effectiveFolder) {
      filename = `${userId}/${effectiveFolder}/${timestamp}_${randomSuffix}.${extension}`;
    } else {
      filename = `${userId}/${timestamp}_${randomSuffix}.${extension}`;
    }

    // Determine media type
    let mediaType: 'image' | 'video' | 'pdf' | 'gif' = 'image';
    if (isPdfUpload) {
      mediaType = 'pdf';
    } else if (file.type === 'image/gif') {
      mediaType = 'gif';
    } else if (file.type.startsWith('video/')) {
      mediaType = 'video';
    }

    const uploadBuffer = Buffer.isBuffer(uploadData)
      ? uploadData
      : Buffer.from(await uploadData.arrayBuffer());
    const contentType = getUploadContentType(file, mediaType, extension);
    const storageKey = buildMediaStorageKey(
      filename.split('/').slice(0, -1),
      filename.split('/').at(-1) || `${timestamp}_${randomSuffix}.${extension}`
    );
    const uploaded = await uploadStoredObject({
      key: storageKey,
      body: uploadBuffer,
      contentType,
      mediaType,
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: {
        ownerId: userId,
        ...(codeId ? { codeId } : {}),
        ...(effectiveFolder ? { folder: effectiveFolder } : {}),
        mediaType,
        originalFilename: encodeURIComponent(file.name).slice(0, 500),
      },
    });

    try {
      await adjustStorageUsed(userId, uploaded.size);
    } catch (storageErr) {
      console.error('Failed to update storageUsed:', storageErr);
    }

    return NextResponse.json({
      url: uploaded.url,
      size: uploaded.size,
      type: mediaType,
      filename: file.name,
      storageProvider: uploaded.storageProvider,
      storageKey: uploaded.storageKey,
      storageBucket: uploaded.storageBucket,
      contentType: uploaded.contentType || contentType,
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

    const authResult = await verifyAuthToken(request);
    if ('error' in authResult) return authResult.error;

    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    const key = getStoredObjectKey(url);
    if (!key) {
      return NextResponse.json({ error: 'Not a managed storage URL' }, { status: 400 });
    }
    if (!(await canDeleteStoredObject(authResult.uid, key))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const size = await getStoredObjectSize(url);
    await deleteStoredObjectByUrl(url);
    if (size) {
      try {
        await adjustStorageUsed(ownerOfKey(key), -size);
      } catch (storageErr) {
        console.error('Failed to update storageUsed:', storageErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}
