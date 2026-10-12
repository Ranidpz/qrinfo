import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import { stripSecretsForPublic } from '@/lib/codeSecrets';

// GET /api/codes/[codeId] - Get code data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ codeId: string }> }
) {
  try {
    const rateLimit = checkRateLimit(`code-read:${getClientIp(request)}`, RATE_LIMITS.API);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { codeId } = await params;

    if (!codeId) {
      return NextResponse.json(
        { error: 'codeId is required' },
        { status: 400 }
      );
    }

    const codeSnap = await getAdminDb().collection('codes').doc(codeId).get();

    if (!codeSnap.exists) {
      return NextResponse.json(
        { error: 'Code not found' },
        { status: 404 }
      );
    }

    const data = codeSnap.data()!;

    return NextResponse.json({
      code: {
        id: codeSnap.id,
        shortId: data.shortId,
        title: data.title,
        media: stripSecretsForPublic(data.media || []),
        config: data.config,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
      },
    });
  } catch (error) {
    console.error('[API codes] Error fetching code:', error);
    return NextResponse.json(
      { error: 'Failed to fetch code' },
      { status: 500 }
    );
  }
}
