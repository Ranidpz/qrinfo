import { NextRequest, NextResponse } from 'next/server';
import { requireCodeOwner, isAuthError } from '@/lib/auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import {
  buildStorageKey,
  getPresignedPutUrl,
  isR2Configured,
} from '@/lib/r2-storage';

// Cliostro character videos (Q.Treasure / Q.Hunt) are uploaded by the OWNER
// directly to R2 via a presigned PUT URL. Direct-to-R2 bypasses the Vercel
// serverless body cap (~4.5MB) so real clips (already mobile-optimized on the
// client) can be uploaded. The bucket needs a CORS policy allowing PUT from the
// app origin. After the PUT, the client calls /api/qtreasure/video-confirm.

const ALLOWED_TYPES: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

// Generous ceiling — presigned bypasses Vercel, but cap to prevent abuse.
const MAX_SIZE = 100 * 1024 * 1024; // 100MB

const TREASURE_SCENARIOS = new Set(['welcome', 'success', 'fail']);
const HUNT_SCENARIOS = new Set(['welcome', 'hint', 'success', 'fail']);

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (!checkRateLimit(`qtreasure-video-url:${ip}`, RATE_LIMITS.UPLOAD).success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    if (!isR2Configured()) {
      return NextResponse.json(
        { error: 'R2 storage is not configured on the server.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const {
      codeId,
      game,
      scenario,
      contentType,
      size,
    }: {
      codeId?: string;
      game?: string;
      scenario?: string;
      contentType?: string;
      size?: number;
    } = body;

    if (!codeId) {
      return NextResponse.json({ error: 'codeId is required' }, { status: 400 });
    }

    // Owner-only.
    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;

    if (game !== 'treasure' && game !== 'hunt') {
      return NextResponse.json({ error: 'Invalid game' }, { status: 400 });
    }
    const validScenarios = game === 'treasure' ? TREASURE_SCENARIOS : HUNT_SCENARIOS;
    if (!scenario || !validScenarios.has(scenario)) {
      return NextResponse.json({ error: 'Invalid scenario' }, { status: 400 });
    }

    if (!contentType || !ALLOWED_TYPES[contentType]) {
      return NextResponse.json({ error: 'Unsupported video type' }, { status: 400 });
    }

    if (typeof size === 'number' && size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Video exceeds 100MB. Please shorten or compress it first.' },
        { status: 400 }
      );
    }

    const ext = ALLOWED_TYPES[contentType];
    const rand = crypto.randomUUID().slice(0, 8);
    const key = buildStorageKey(
      [auth.uid, codeId, 'qtreasure'],
      `${game}-${scenario}_${Date.now()}_${rand}.${ext}`
    );

    const presigned = await getPresignedPutUrl({ key, contentType, expiresInSeconds: 600 });

    return NextResponse.json({
      uploadUrl: presigned.uploadUrl,
      publicUrl: presigned.publicUrl,
      key: presigned.key,
      contentType,
    });
  } catch (error) {
    console.error('Video presign error:', error);
    return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 });
  }
}
