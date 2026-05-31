import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import { requireCodeOwner, isAuthError } from '@/lib/auth';
import {
  buildMediaStorageKey,
  uploadStoredObject,
} from '@/lib/media-storage';
import { R2_STORAGE_PROVIDER, isR2Configured } from '@/lib/r2-storage';

// Raffle assets (background image/video, custom win sound) — owner-only,
// always stored on Cloudflare R2 under the uploader's folder:
//   {ownerId}/{codeId}/raffle/{file}
// This route FORCES the R2 provider so it never touches Vercel Blob, and never
// changes the storage behaviour of any other experience.

const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/aac',
]);

// Vercel serverless body cap is ~4.5MB; keep a safe ceiling. Larger assets
// should be compressed client-side before upload.
const MAX_SIZE = 4 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const rl = checkRateLimit(`raffle-upload:${clientIp}`, RATE_LIMITS.UPLOAD);
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many uploads. Try again shortly.' }, { status: 429 });
    }

    if (!isR2Configured()) {
      return NextResponse.json(
        { error: 'R2 storage is not configured on the server.' },
        { status: 503 }
      );
    }

    const form = await request.formData();
    const file = form.get('file') as File | null;
    const codeId = form.get('codeId') as string | null;
    const kindRaw = (form.get('kind') as string | null) || 'image';
    const kind = ['image', 'video', 'audio'].includes(kindRaw) ? kindRaw : 'image';

    if (!codeId) {
      return NextResponse.json({ error: 'codeId is required' }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Owner-only.
    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;

    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: 'File type not allowed', fileType: file.type }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File exceeds 4MB. Please compress it first.' }, { status: 400 });
    }

    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    const rand = crypto.randomUUID().slice(0, 8);
    const key = buildMediaStorageKey(
      [auth.uid, codeId, 'raffle'],
      `${Date.now()}_${rand}.${ext}`
    );

    const buffer = Buffer.from(await file.arrayBuffer());
    const mediaType = kind === 'audio' ? 'image' : kind; // mediaType only steers blob path; R2 is forced anyway

    const uploaded = await uploadStoredObject({
      key,
      body: buffer,
      contentType: file.type || 'application/octet-stream',
      mediaType,
      provider: R2_STORAGE_PROVIDER, // force R2 regardless of env default
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: {
        ownerId: auth.uid,
        codeId,
        feature: 'raffle',
        kind,
      },
    });

    return NextResponse.json({
      url: uploaded.url,
      size: uploaded.size,
      kind,
      storageProvider: uploaded.storageProvider,
    });
  } catch (error) {
    console.error('Raffle upload error:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
