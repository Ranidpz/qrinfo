import { NextRequest, NextResponse } from 'next/server';
import { authenticateIntakeKey } from '@/lib/content-intake/fattal-server';
import { requireSuperAdmin, isAuthError } from '@/lib/auth';
import { getAdminApp, getAdminDb } from '@/lib/firebase-admin';
import { resolveFattalOwnerId } from '@/lib/content-intake/fattal-server';
import { FATTAL_BOOKLET_TARGETS } from '@/lib/content-intake/fattal';

export const runtime = 'nodejs';
// Diagnostics for this integration only: no credentials or other-owner records.
export async function GET(request: NextRequest) {
  try {
    const integrationAuth = await authenticateIntakeKey(request);
    if (!integrationAuth) {
      const auth = await requireSuperAdmin(request);
      if (isAuthError(auth)) return auth.response;
    }
    const ownerId = await resolveFattalOwnerId({ integrationAuth });
    const db = getAdminDb();
    const snapshot = await db.collection('codes').where('shortId', 'in', FATTAL_BOOKLET_TARGETS.map(t => t.shortId)).get();
    const targets = FATTAL_BOOKLET_TARGETS.map(target => {
      const docs = snapshot.docs.filter(doc => doc.data().shortId === target.shortId);
      return { shortId: target.shortId, title: target.title, found: docs.length,
        ownerMatches: docs.length === 1 && docs[0].data().ownerId === ownerId,
        isChild: docs.length === 1 && !!docs[0].data().parentCodeShortId };
    });
    const projectMatches = getAdminApp().options.projectId === process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    return NextResponse.json({ batchProtocolVersion: 1, projectMatches, ownerResolved: !!ownerId,
      ready: projectMatches && !!ownerId && targets.every(t => t.found === 1 && t.ownerMatches && !t.isChild), targets },
    { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[Fattal health]', error);
    return NextResponse.json({ error: 'Intake health check failed' }, { status: 500 });
  }
}
