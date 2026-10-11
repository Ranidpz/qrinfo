import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin, isAuthError } from '@/lib/auth';
import { getAdminApp, getAdminDb } from '@/lib/firebase-admin';
import { CloudIntakeError, requireCloud } from '@/lib/content-intake/cloud-policy';
import { createSupervisedReconciliation } from '@/lib/content-intake/cloud-supervised';
import { createReviewPdfReader } from '@/lib/content-intake/cloud-review-pdf';

export const runtime = 'nodejs';
export const maxDuration = 60;
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (isAuthError(auth)) return reply({ error: 'administrator_required', retryAllowed: false }, auth.response.status);
    requireCloud(request.nextUrl.searchParams.size === 1 && request.nextUrl.searchParams.has('manifestId'), 400, 'Manifest ID required');
    const service = createSupervisedReconciliation(getAdminDb(), {
      projectId: getAdminApp().options.projectId || '', publicProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
      cloudProjectId: process.env.FATTAL_CLOUD_PROJECT_ID, cloudOwnerId: process.env.FATTAL_CLOUD_OWNER_ID, cloudOwnerEmail: process.env.FATTAL_CLOUD_OWNER_EMAIL,
      legacyOwnerId: process.env.FATTAL_BOOKLETS_OWNER_ID, legacyOwnerEmail: process.env.FATTAL_BOOKLETS_OWNER_EMAIL,
    }, async object => {
      let origins: string[] = [];
      try { origins = JSON.parse(process.env.FATTAL_CLOUD_REVIEW_STORAGE_ORIGINS || '[]'); } catch { throw new CloudIntakeError(503, 'Storage configuration unavailable'); }
      return createReviewPdfReader(origins)(object);
    });
    return reply(await service.reconcile(auth.uid, request.nextUrl.searchParams.get('manifestId') || ''));
  } catch (error) {
    return reply({ error: 'Reconciliation unavailable; do not resubmit', retryAllowed: false, uploadAllowed: false }, error instanceof CloudIntakeError ? error.status : 503);
  }
}
