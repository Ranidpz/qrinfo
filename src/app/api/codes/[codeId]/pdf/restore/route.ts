import { NextRequest, NextResponse } from 'next/server';
import { requireBookletAccess } from '@/lib/booklets/access';
import { PdfHistoryError, restorePdfVersion } from '@/lib/booklets/pdf-history';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

// POST /api/codes/[codeId]/pdf/restore { eventId } — put back the file a replacement displaced.
// Owner, super admin or a booklet editor of this code.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ codeId: string }> }
) {
  const { codeId } = await params;
  try {
    const access = await requireBookletAccess(request, codeId);
    if ('response' in access) return access.response;
    const rl = checkRateLimit(`booklet-pdf:${access.actor.uid}`, RATE_LIMITS.UPLOAD);
    if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const body = await request.json().catch(() => ({}));
    const eventId = typeof body?.eventId === 'string' ? body.eventId : '';
    if (!/^[A-Za-z0-9]{1,64}$/.test(eventId)) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }

    const result = await restorePdfVersion(codeId, eventId, access.actor);
    return NextResponse.json({ success: true, media: serialize(result.media) });
  } catch (error) {
    if (error instanceof PdfHistoryError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    console.error('[pdf-restore] failed:', error);
    return NextResponse.json({ error: 'Failed to restore' }, { status: 500 });
  }
}

function serialize(media: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(media).map(([key, value]) => [
    key,
    value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function'
      ? (value.toDate as () => Date)().toISOString()
      : value,
  ]));
}
