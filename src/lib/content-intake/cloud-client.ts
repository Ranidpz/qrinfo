import 'server-only';
import type { IntakeOperationEvent } from './run-telemetry';
import { FATTAL_BOOKLET_TARGETS } from './fattal';
import { canonical, isHash, manifestId, parseManifest } from './cloud-policy';

// Trusted host configuration only. Never expose configuration or credentialRef as
// model/tool arguments. No CLI, connection provisioning, key generation or writes.
export interface CloudClientConfig {
  enabled?: boolean;
  baseUrl?: string;
  ownerId?: string;
  ownerEmail?: string;
  projectId?: string;
  allowedTargets?: string[];
  credentialRef?: 'env:FATTAL_CLOUD_CLIENT_KEY';
}
export interface CloudClientRuntime {
  fetch: typeof fetch;
  resolveSecret: (reference: 'env:FATTAL_CLOUD_CLIENT_KEY') => Promise<string | undefined>;
  now: () => number;
  onOperation?: (event: IntakeOperationEvent) => void;
}
export class CloudClientError extends Error {
  constructor(public code: 'disabled' | 'configuration' | 'input' | 'credential' | 'transport' | 'response') {
    super(`Fattal read-only connector: ${code}`);
  }
}
function check(value: unknown, code: CloudClientError['code']): asserts value {
  if (!value) throw new CloudClientError(code);
}
function object(value: unknown): Record<string, unknown> {
  check(value && typeof value === 'object' && !Array.isArray(value), 'response');
  return value as Record<string, unknown>;
}
function cleanInput(value: unknown) {
  try {
    check(!/tq_(?:fc|ci)_[a-f0-9]{32}\.[a-f0-9]{64}/.test(JSON.stringify(value) ?? ''), 'input');
  } catch { throw new CloudClientError('input'); }
}
const defaultRuntime: CloudClientRuntime = {
  fetch: (...args) => fetch(...args),
  resolveSecret: async reference => reference === 'env:FATTAL_CLOUD_CLIENT_KEY' ? process.env.FATTAL_CLOUD_CLIENT_KEY : undefined,
  now: () => Date.now(),
};
export function createFattalCloudClient(config: CloudClientConfig = {}, runtime: CloudClientRuntime = defaultRuntime) {
  // Copy host bounds once so a caller cannot mutate a client's scope in flight.
  const bounds = { ...config, allowedTargets: [...(config.allowedTargets ?? [])] };
  async function session() {
    check(bounds.enabled === true, 'disabled'); // Before secret resolution or network.
    check(bounds.baseUrl && bounds.ownerId && bounds.ownerEmail && bounds.projectId
      && bounds.credentialRef === 'env:FATTAL_CLOUD_CLIENT_KEY', 'configuration');
    let origin: URL;
    try { origin = new URL(bounds.baseUrl); } catch { throw new CloudClientError('configuration'); }
    check(origin.protocol === 'https:' && !origin.username && !origin.password && !origin.search && !origin.hash
      && (origin.pathname === '/' || origin.pathname === '') && (!origin.port || origin.port === '443'), 'configuration');
    const allowlist = FATTAL_BOOKLET_TARGETS.map(t => t.shortId);
    check(bounds.allowedTargets.length > 0 && bounds.allowedTargets.length <= 12
      && new Set(bounds.allowedTargets).size === bounds.allowedTargets.length
      && bounds.allowedTargets.every(id => allowlist.includes(id)), 'configuration');
    let secret: string | undefined;
    try { secret = await runtime.resolveSecret(bounds.credentialRef); } catch { throw new CloudClientError('credential'); }
    check(typeof secret === 'string' && /^tq_fc_[a-f0-9]{32}\.[a-f0-9]{64}$/.test(secret), 'credential');
    const key = secret;
    async function request(operation: 'health' | 'preview' | 'recovery', body?: unknown, id?: string) {
      const url = new URL(`/api/content-intake/fattal/cloud/${operation}`, origin);
      if (id) url.searchParams.set('manifestId', id);
      const started = performance.now();
      let outcome: IntakeOperationEvent['outcome'] = 'failed';
      try {
        const response = await runtime.fetch(url.toString(), {
          method: body === undefined ? 'GET' : 'POST', redirect: 'error', credentials: 'omit', cache: 'no-store',
          signal: AbortSignal.timeout(20000), headers: { 'x-fattal-cloud-key': key, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        // Never surface remote error bodies, redirects or SDK exception messages.
        check(response.ok && response.body && (!response.url || response.url === url.toString()), 'transport');
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let length = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            length += value.length;
            if (length > 256 * 1024) { await reader.cancel(); throw new CloudClientError('response'); }
            chunks.push(value);
          }
        } finally { reader.releaseLock(); }
        const text = Buffer.concat(chunks).toString('utf8');
        check(!text.includes(key) && !/tq_(?:fc|ci)_[a-f0-9]{32}\.[a-f0-9]{64}/.test(text), 'response');
        const result = object(JSON.parse(text));
        outcome = 'completed';
        return result;
      } catch (error) {
        if (error instanceof CloudClientError) throw error;
        throw new CloudClientError('transport');
      } finally {
        // Observability cannot turn success into failure or trigger a retry.
        try { runtime.onOperation?.({ operation, outcome, durationMs: Math.max(0, performance.now() - started), retry: false }); } catch { /* Keep original request outcome. */ }
      }
    }
    const health = await request('health');
    check(health.protocol === 1 && health.ownerId === bounds.ownerId && health.ownerEmail === bounds.ownerEmail
      && health.projectId === bounds.projectId && canonical(health.scopes) === canonical(['read'])
      && typeof health.expiresAt === 'number' && Number.isSafeInteger(health.expiresAt) && health.expiresAt > runtime.now()
      && health.notificationsEnabled === false && health.cleanupEnabled === false, 'response');
    check(Array.isArray(health.targets) && health.targets.length === bounds.allowedTargets.length, 'response');
    const targets = health.targets.map(raw => {
      const target = object(raw);
      check(typeof target.shortId === 'string' && bounds.allowedTargets.includes(target.shortId)
        && target.hotel === FATTAL_BOOKLET_TARGETS.find(t => t.shortId === target.shortId)?.key
        && isHash(target.expectedVersion) && typeof target.pending === 'boolean', 'response');
      return { shortId: target.shortId, hotel: String(target.hotel), expectedVersion: target.expectedVersion, pending: target.pending };
    });
    check(new Set(targets.map(t => t.shortId)).size === targets.length, 'response');
    return { request, attestation: { protocol: 1, ownerId: bounds.ownerId, ownerEmail: bounds.ownerEmail,
      projectId: bounds.projectId, scopes: ['read'], expiresAt: health.expiresAt, targets,
      clientReadOnly: true, notificationsEnabled: false, cleanupEnabled: false } };
  }
  async function health() { return (await session()).attestation; }
  async function preview(value: unknown) {
    cleanInput(value);
    // Validate without fetching first: missing mapping cannot acquire defaults.
    check(bounds.ownerId && bounds.projectId, bounds.enabled ? 'configuration' : 'disabled');
    let manifest;
    try { manifest = parseManifest(value, { ownerId: bounds.ownerId, projectId: bounds.projectId, allowedTargets: bounds.allowedTargets }, runtime.now()); }
    catch { throw new CloudClientError('input'); }
    const { request, attestation } = await session();
    const target = attestation.targets.find(t => t.shortId === manifest.shortId);
    check(target && !target.pending && target.expectedVersion === manifest.expectedVersion, 'input');
    const response = await request('preview', { manifest, saveRun: false, sendEmail: false, notify: false, deleteOld: false, cleanup: false });
    check(response.protocol === 1 && response.saved === false && response.manifestId === manifestId(manifest)
      && canonical(response.manifest) === canonical(manifest) && typeof response.duplicate === 'boolean'
      && typeof response.pending === 'boolean' && response.notification === 'disabled' && response.cleanup === 'disabled', 'response');
    return { protocol: 1, manifest, manifestId: manifestId(manifest), saved: false,
      duplicate: response.duplicate, pending: response.pending, notification: 'disabled', cleanup: 'disabled' };
  }
  async function recovery(input: { manifestId: string; shortId: string; sha256: string }) {
    cleanInput(input);
    check(input && isHash(input.manifestId) && isHash(input.sha256) && bounds.allowedTargets.includes(input.shortId), 'input');
    const { request } = await session();
    const response = await request('recovery', undefined, input.manifestId);
    check(response.protocol === 1 && response.manifestId === input.manifestId && response.shortId === input.shortId && response.sha256 === input.sha256
      && ['verified', 'superseded', 'uncertain'].includes(String(response.status)) && response.verified === (response.status === 'verified')
      && response.retryAllowed === false && response.notification === 'disabled' && response.cleanup === 'disabled', 'response');
    return { protocol: 1, manifestId: input.manifestId, shortId: input.shortId, sha256: input.sha256,
      status: response.status, verified: response.verified, retryAllowed: false, notification: 'disabled', cleanup: 'disabled' };
  }
  return { health, preview, recovery }; // No commit, activation, notifications or cleanup.
}

// Plain dispatcher for future tool registration, not an MCP server or registered tool.
export function createFattalCloudReadTools(client: ReturnType<typeof createFattalCloudClient>) {
  return async (name: string, input: unknown = {}) => {
    const args = object(input);
    const keys = Object.keys(args).sort().join(',');
    if (name === 'fattal_cloud_health' && keys === '') return client.health();
    if (name === 'fattal_cloud_preview' && keys === 'manifest') return client.preview(args.manifest);
    if (name === 'fattal_cloud_recovery' && keys === 'manifestId,sha256,shortId') {
      check(typeof args.manifestId === 'string' && typeof args.shortId === 'string' && typeof args.sha256 === 'string', 'input');
      return client.recovery({ manifestId: args.manifestId, shortId: args.shortId, sha256: args.sha256 });
    }
    throw new CloudClientError('input');
  };
}
