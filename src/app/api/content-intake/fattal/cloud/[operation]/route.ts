import { NextRequest, NextResponse } from 'next/server';
import { getAdminApp, getAdminDb } from '@/lib/firebase-admin';
import { uploadStoredObject } from '@/lib/media-storage';
import { isR2Url } from '@/lib/r2-storage';
import { CloudIntakeError, requireCloud, sha256, type CloudConfig } from '@/lib/content-intake/cloud-policy';
import { createCloudService, type CloudStorage } from '@/lib/content-intake/cloud-service';

export const runtime = 'nodejs';
export const maxDuration = 60;
const noStore = { 'Cache-Control': 'no-store' };
const storage: CloudStorage = {
  upload: (key, bytes) => uploadStoredObject({ key, body: bytes, provider: 'cloudflare-r2', contentType: 'application/pdf', cacheControl: 'public, max-age=31536000, immutable' }),
  async verify(object, hash, size) {
    // Only server-produced managed R2 URLs, never arbitrary request URLs or redirects.
    const url = new URL(object.url);
    requireCloud(url.protocol === 'https:' && !url.username && !url.password && !url.port && isR2Url(object.url), 409, 'Untrusted stored PDF URL');
    const response = await fetch(object.url, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok || !response.body) return false;
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let length = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > size) { await reader.cancel(); return false; }
        chunks.push(Buffer.from(value));
      }
    } finally { reader.releaseLock(); }
    return length === size && sha256(Buffer.concat(chunks)) === hash;
  },
};
function service(request: NextRequest) {
  const config: CloudConfig = {
    enabled: process.env.FATTAL_CLOUD_ENABLED === 'true',
    writesEnabled: process.env.FATTAL_CLOUD_WRITES_ENABLED === 'true',
    ownerId: process.env.FATTAL_CLOUD_OWNER_ID || '',
    ownerEmail: process.env.FATTAL_CLOUD_OWNER_EMAIL || '',
    projectId: process.env.FATTAL_CLOUD_PROJECT_ID || '',
  };
  requireCloud(config.enabled && config.ownerId && config.ownerEmail && config.projectId, 503, 'Cloud intake is not configured');
  requireCloud((!process.env.FATTAL_BOOKLETS_OWNER_ID || process.env.FATTAL_BOOKLETS_OWNER_ID === config.ownerId)
    && (!process.env.FATTAL_BOOKLETS_OWNER_EMAIL || process.env.FATTAL_BOOKLETS_OWNER_EMAIL === config.ownerEmail), 403, 'Configured owner mismatch');
  requireCloud(config.projectId === process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    && config.projectId === getAdminApp().options.projectId, 403, 'Configured project mismatch');
  // No Bearer, super-admin, legacy connection or environment-key fallback.
  return createCloudService(getAdminDb(), config, request.headers.get('x-fattal-cloud-key') || '', storage);
}
async function boundedBody(request: NextRequest) {
  const limit = 4 * 1024 * 1024;
  requireCloud(request.headers.get('content-type')?.split(';')[0] === 'application/json', 415, 'JSON is required');
  requireCloud(request.body, 400, 'Request body is required');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      requireCloud(length <= limit, 413, 'Cloud request exceeds 4MB');
      chunks.push(value);
    }
  } catch (error) { await reader.cancel(); throw error; }
  finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>; }
  catch { throw new CloudIntakeError(400, 'Invalid JSON'); }
}
type RouteContext = { params: Promise<{ operation: string }> };
async function handle(request: NextRequest, route: RouteContext) {
  try {
    const { operation } = await route.params;
    const allowed = request.method === 'GET' ? ['health', 'recovery'] : ['preview', 'commit'];
    requireCloud(allowed.includes(operation), 404, 'Cloud operation not found');
    const api = service(request);
    let result;
    if (operation === 'health') result = await api.health();
    else if (operation === 'recovery') result = await api.recovery(request.nextUrl.searchParams.get('manifestId') || '');
    else {
      // Authenticate before accepting file data. This is strictly read-only.
      const attestation = await api.health();
      if (operation === 'commit') requireCloud(attestation.writesEnabled && attestation.scopes.includes('write'), 403, 'Cloud writes are not permitted');
      const body = await boundedBody(request);
      requireCloud(body && typeof body === 'object' && !Array.isArray(body), 400, 'JSON object required');
      requireCloud((body.sendEmail === undefined || body.sendEmail === false)
        && (body.notify === undefined || body.notify === false) && (body.deleteOld === undefined || body.deleteOld === false)
        && (body.cleanup === undefined || body.cleanup === false), 403, 'Notifications and cleanup are unavailable');
      if (operation === 'preview') {
        requireCloud(body.saveRun === false, 400, 'Read-only preview requires saveRun:false');
        result = await api.preview(body.manifest);
      } else {
        requireCloud(body.activate === true && typeof body.manifestId === 'string' && typeof body.pdfBase64 === 'string', 400, 'Explicit activation and reviewed PDF are required');
        const bytes = Buffer.from(body.pdfBase64, 'base64');
        requireCloud(bytes.toString('base64') === body.pdfBase64, 400, 'Invalid PDF encoding');
        result = await api.commit(body.manifest, body.manifestId, bytes);
      }
    }
    return NextResponse.json(result, { headers: noStore });
  } catch (error) {
    // Never log request headers, submitted bytes, credentials or raw SDK errors.
    return NextResponse.json({ error: error instanceof CloudIntakeError ? error.message : 'Cloud intake failed; recover before retrying any write' },
      { status: error instanceof CloudIntakeError ? error.status : 503, headers: noStore });
  }
}
export const GET = handle;
export const POST = handle;
