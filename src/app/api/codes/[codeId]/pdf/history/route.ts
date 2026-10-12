import { NextRequest, NextResponse } from 'next/server';
import { requireBookletAccess } from '@/lib/booklets/access';
import { listPdfHistory } from '@/lib/booklets/pdf-history';

// GET /api/codes/[codeId]/pdf/history — who replaced the booklet file, and what can be restored.
// Owner, super admin or a booklet editor of this code.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ codeId: string }> }
) {
  const { codeId } = await params;
  try {
    const access = await requireBookletAccess(request, codeId);
    if ('response' in access) return access.response;
    return NextResponse.json({ entries: await listPdfHistory(codeId) });
  } catch (error) {
    console.error('[pdf-history] list failed:', error);
    return NextResponse.json({ error: 'Failed to load history' }, { status: 500 });
  }
}
