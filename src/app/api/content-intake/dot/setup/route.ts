import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin, isAuthError } from '@/lib/auth';
import { getAdminApp, getAdminDb } from '@/lib/firebase-admin';
import { FATTAL_BOOKLET_TARGETS } from '@/lib/content-intake/fattal';
import { buildSetupReview, parseSetupSelection, SetupReviewError, verifySetupProject } from '@/lib/content-intake/setup-review';

export const runtime = 'nodejs';
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

// Inspection only. No credentials, connection/approval collection reads, writes,
// secret-store API, activation flags, uploads or inference of the intended owner.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (isAuthError(auth)) return reply({ error: 'unauthorized' }, auth.response.status);
    const params = request.nextUrl.searchParams;
    const selection = params.size ? parseSetupSelection(params) : null;
    const bindings = {
      projectId: getAdminApp().options.projectId || '', publicProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
      cloudProjectId: process.env.FATTAL_CLOUD_PROJECT_ID,
      cloudOwnerId: process.env.FATTAL_CLOUD_OWNER_ID, cloudOwnerEmail: process.env.FATTAL_CLOUD_OWNER_EMAIL,
      legacyOwnerId: process.env.FATTAL_BOOKLETS_OWNER_ID, legacyOwnerEmail: process.env.FATTAL_BOOKLETS_OWNER_EMAIL,
    };
    const projectId = verifySetupProject(bindings);
    if (!selection) return reply({ projectId, durationOptions: [1, 4, 24], scopes: ['read'], credentialCreated: false, secretBinding: 'unverified' });
    if (selection.projectId !== projectId) throw new SetupReviewError('projectMismatch');
    const db = getAdminDb();
    const [owner, codes] = await Promise.all([
      db.collection('users').doc(selection.ownerId).get(),
      db.collection('codes').where('shortId', 'in', FATTAL_BOOKLET_TARGETS.map(t => t.shortId)).get(),
    ]);
    return reply(buildSetupReview(selection, bindings, owner.exists ? owner.data() : undefined, codes.docs.map(d => d.data())));
  } catch (error) {
    if (error instanceof SetupReviewError) return reply({ error: error.code }, error.code === 'input' ? 400 : 409);
    return reply({ error: 'unavailable' }, 503);
  }
}
