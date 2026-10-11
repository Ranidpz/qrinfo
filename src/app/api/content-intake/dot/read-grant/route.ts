import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin, isAuthError } from '@/lib/auth';
import { getAdminApp, getAdminDb } from '@/lib/firebase-admin';
import { requireCloud } from '@/lib/content-intake/cloud-policy';
import { SetupReviewError } from '@/lib/content-intake/setup-review';
import { inspectReadGrant, issueReadGrant, parseReadGrant, readGrantError, readGrantFailureCode, readGrantConfiguration, requireReadGrant } from '@/lib/content-intake/read-grant';

export const runtime = 'nodejs';
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const issuanceEnabled = () => process.env.FATTAL_CLOUD_READ_GRANTS_ENABLED === 'true'
  && process.env.FATTAL_CLOUD_ENABLED === 'true' && process.env.FATTAL_CLOUD_WRITES_ENABLED !== 'true';
const bindings = () => ({
  projectId: getAdminApp().options.projectId || '', publicProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  cloudProjectId: process.env.FATTAL_CLOUD_PROJECT_ID, cloudOwnerId: process.env.FATTAL_CLOUD_OWNER_ID,
  cloudOwnerEmail: process.env.FATTAL_CLOUD_OWNER_EMAIL,
  legacyOwnerId: process.env.FATTAL_BOOKLETS_OWNER_ID, legacyOwnerEmail: process.env.FATTAL_BOOKLETS_OWNER_EMAIL,
});
async function body(request: NextRequest) {
  requireCloud(request.headers.get('content-type')?.split(';')[0] === 'application/json' && request.body, 400, 'JSON required');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 4096) { await reader.cancel(); requireCloud(false, 413, 'Request too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { requireCloud(false, 400, 'Invalid JSON'); }
}
async function handle(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (isAuthError(auth)) return reply({ error: 'unauthorized', code: 'administrator_required', retryAllowed: false }, auth.response.status);
    if (request.method !== 'GET') requireReadGrant(request.headers.get('origin') === request.nextUrl.origin, 403, 'same_origin_required');
    if (request.method === 'GET' && request.nextUrl.searchParams.size === 0) return reply({ issuanceEnabled: issuanceEnabled(), durationHours: 1 });
    if (request.method === 'POST') {
      requireReadGrant(issuanceEnabled(), 503, 'issuance_disabled');
      const input = parseReadGrant(await body(request));
      return reply(await issueReadGrant(getAdminDb(), auth.uid, bindings(), input), 201);
    }
    requireCloud(request.nextUrl.searchParams.size === 1 && request.nextUrl.searchParams.has('connectionId'), 400, 'Invalid lookup');
    // Inspection and revocation remain available when new issuance is disabled.
    const result = await inspectReadGrant(getAdminDb(), auth.uid, request.nextUrl.searchParams.get('connectionId') || '', request.method === 'DELETE');
    // Existing open pages can inspect this response without losing their in-memory key.
    return reply(request.method === 'GET' && result.state === 'missing'
      ? { ...result, diagnostics: readGrantConfiguration(bindings(), issuanceEnabled()) } : result);
  } catch (error) {
    return reply({ error: 'Read grant request failed; inspect status before trying again', code: readGrantFailureCode(error), retryAllowed: false },
      error instanceof SetupReviewError ? 409 : readGrantError(error));
  }
}
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
