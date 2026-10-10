import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin, isAuthError } from '@/lib/auth';
import { CloudClientError, createFattalCloudClient } from '@/lib/content-intake/cloud-client';

export const runtime = 'nodejs';
const reply = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { 'Cache-Control': 'no-store' },
});

// A separate admin read surface. Never forward browser credentials to the scoped
// API, query grant documents, or accept deployment/owner configuration from users.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (isAuthError(auth)) return reply({ error: 'Unauthorized' }, auth.response.status);
    const params = request.nextUrl.searchParams;
    const keys = [...params.keys()].sort().join(',');
    if (keys !== '' && keys !== 'manifestId,sha256,shortId') return reply({ error: 'Invalid lookup' }, 400);
    const manifestId = params.get('manifestId');
    const sha256 = params.get('sha256');
    const shortId = params.get('shortId');
    if (keys && (!/^[a-f0-9]{64}$/.test(manifestId || '') || !/^[a-f0-9]{64}$/.test(sha256 || '')
      || !/^[A-Za-z0-9_-]{1,80}$/.test(shortId || ''))) return reply({ error: 'Invalid lookup' }, 400);
    if (process.env.FATTAL_CLOUD_MANAGEMENT_ENABLED !== 'true') return reply({ state: 'unconfigured' });
    let allowedTargets: unknown;
    try { allowedTargets = JSON.parse(process.env.FATTAL_CLOUD_CLIENT_TARGETS || 'null'); }
    catch { return reply({ state: 'unconfigured' }); }
    if (!Array.isArray(allowedTargets) || !allowedTargets.every(t => typeof t === 'string')) return reply({ state: 'unconfigured' });
    const client = createFattalCloudClient({
      enabled: true,
      baseUrl: process.env.FATTAL_CLOUD_CLIENT_BASE_URL,
      ownerId: process.env.FATTAL_CLOUD_CLIENT_OWNER_ID,
      ownerEmail: process.env.FATTAL_CLOUD_CLIENT_OWNER_EMAIL,
      projectId: process.env.FATTAL_CLOUD_CLIENT_PROJECT_ID,
      allowedTargets,
      credentialRef: 'env:FATTAL_CLOUD_CLIENT_KEY',
    });
    if (manifestId && sha256 && shortId) return reply({ state: 'ready', recovery: await client.recovery({ manifestId, sha256, shortId }) });
    return reply({ state: 'ready', health: await client.health() });
  } catch (error) {
    if (error instanceof CloudClientError) {
      if (error.code === 'configuration' || error.code === 'disabled') return reply({ state: 'unconfigured' });
      if (error.code === 'input') return reply({ error: 'Invalid lookup' }, 400);
    }
    // Includes missing, expired or revoked keys; never echo errors or credentials.
    return reply({ state: 'unavailable' }, 503);
  }
}
