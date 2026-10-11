import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin, isAuthError } from '@/lib/auth';
import { getAdminApp, getAdminDb } from '@/lib/firebase-admin';
import { CloudIntakeError, FATTAL_CLOUD_PAUSED_TARGETS, requireCloud } from '@/lib/content-intake/cloud-policy';
import { SetupReviewError } from '@/lib/content-intake/setup-review';
import { createManifestApprovals } from '@/lib/content-intake/cloud-approval';
import { createReviewPdfReader } from '@/lib/content-intake/cloud-review-pdf';

export const runtime = 'nodejs';
export const maxDuration = 60;
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const enabled = () => process.env.FATTAL_CLOUD_APPROVALS_ENABLED === 'true' && process.env.FATTAL_CLOUD_ENABLED === 'true';
async function boundedBody(request: NextRequest) {
  requireCloud(request.headers.get('content-type')?.split(';')[0] === 'application/json' && request.body, 400, 'JSON required');
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length;
      requireCloud(size <= 65536, 413, 'Review request is too large');
      chunks.push(value);
    }
  } catch (error) { await reader.cancel(); throw error; }
  finally { reader.releaseLock(); }
  const text = Buffer.concat(chunks).toString('utf8');
  requireCloud(!/tq_(?:fc|ci)_/i.test(text), 400, 'Do not submit credentials');
  let body;
  try { body = JSON.parse(text); } catch { requireCloud(false, 400, 'Invalid JSON'); }
  requireCloud(body && typeof body === 'object' && !Array.isArray(body), 400, 'JSON object required');
  return body as Record<string, unknown>;
}
function service() {
  return createManifestApprovals(getAdminDb(), {
    projectId: getAdminApp().options.projectId || '', publicProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    cloudProjectId: process.env.FATTAL_CLOUD_PROJECT_ID, cloudOwnerId: process.env.FATTAL_CLOUD_OWNER_ID,
    cloudOwnerEmail: process.env.FATTAL_CLOUD_OWNER_EMAIL,
    legacyOwnerId: process.env.FATTAL_BOOKLETS_OWNER_ID, legacyOwnerEmail: process.env.FATTAL_BOOKLETS_OWNER_EMAIL,
  }, async media => {
    const rawOrigins = process.env.FATTAL_CLOUD_REVIEW_STORAGE_ORIGINS;
    let origins: string[] = [];
    try { if (rawOrigins) origins = JSON.parse(rawOrigins); } catch { throw new CloudIntakeError(503, 'Invalid review storage configuration'); }
    return createReviewPdfReader(origins)(media);
  });
}
async function handle(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (isAuthError(auth)) return reply({ error: 'unauthorized', retryAllowed: false }, auth.response.status);
    if (request.method !== 'GET') requireCloud(request.headers.get('origin') === request.nextUrl.origin, 403, 'Same-origin request required');
    const params = request.nextUrl.searchParams;
    if (request.method === 'GET' && params.size === 0) return reply({ approvalEnabled: enabled(), pausedTargets: FATTAL_CLOUD_PAUSED_TARGETS, createsCredentials: false, uploads: false });
    if (request.method === 'POST') {
      requireCloud(params.size === 0, 400, 'Unexpected query');
      const body = await boundedBody(request);
      requireCloud(['preview', 'approve'].includes(String(body.action)) && typeof body.connectionId === 'string', 400, 'Invalid review action');
      const keys = body.action === 'preview' ? 'action,connectionId,manifest' : 'action,connectionId,manifest,manifestId';
      requireCloud(Object.keys(body).sort().join(',') === keys, 400, 'Unexpected fields');
      if (body.action === 'approve') {
        requireCloud(enabled(), 503, 'Approval creation is disabled');
        requireCloud(typeof body.manifestId === 'string', 400, 'Manifest ID required');
        return reply(await service().approve(auth.uid, body.connectionId, body.manifest, body.manifestId));
      }
      // Preview never persists an approval or uploads media, even with the gate enabled.
      return reply(await service().preview(auth.uid, body.connectionId, body.manifest));
    }
    requireCloud(params.size === 1 && params.has('manifestId'), 400, 'Manifest ID required');
    const api = service(), id = params.get('manifestId') || '';
    // Status and cancellation remain available when approval creation is disabled.
    return reply(await (request.method === 'DELETE' ? api.revoke(auth.uid, id) : api.status(auth.uid, id)));
  } catch (error) {
    return reply({ error: error instanceof CloudIntakeError ? error.message : 'Review unavailable; inspect status before retrying', retryAllowed: false },
      error instanceof CloudIntakeError ? error.status : error instanceof SetupReviewError ? 409 : 503);
  }
}
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
