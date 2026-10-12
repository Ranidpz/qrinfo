import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { BOOKLET_EDITORS_COLLECTION } from '@/lib/booklets/access';

// GET /api/booklet-editor/booklets — booklets a super admin let the caller update.
// Only what the dashboard needs to show and replace the PDF; no owner details.
export async function GET(request: NextRequest) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const { uid } = authResult;

  try {
    const db = getAdminDb();
    const grants = await db.collection(BOOKLET_EDITORS_COLLECTION).where('uid', '==', uid).get();
    const codeIds = grants.docs.map((doc) => doc.data()).filter((g) => !g.revokedAt).map((g) => String(g.codeId));
    if (codeIds.length === 0) return NextResponse.json({ booklets: [] });

    const docs = await db.getAll(...codeIds.map((id) => db.collection('codes').doc(id)));
    const booklets = docs.flatMap((doc) => {
      const data = doc.data();
      if (!data) return [];
      const pdfs = (Array.isArray(data.media) ? data.media : [])
        .filter((m: { type?: string }) => m?.type === 'pdf')
        .map((m: Record<string, unknown>) => ({
          id: String(m.id || ''),
          url: String(m.url || ''),
          filename: String(m.filename || m.title || ''),
          size: Number(m.size || 0),
          pageCount: typeof m.pageCount === 'number' ? m.pageCount : null,
        }));
      if (pdfs.length === 0) return [];
      return [{
        codeId: doc.id,
        shortId: String(data.shortId || ''),
        title: String(data.title || ''),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
        pdfs,
      }];
    });

    return NextResponse.json({ booklets });
  } catch (error) {
    console.error('[booklet-editor] list failed:', error);
    return NextResponse.json({ error: 'Failed to load booklets' }, { status: 500 });
  }
}
