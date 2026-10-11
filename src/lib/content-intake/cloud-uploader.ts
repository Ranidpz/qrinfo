import { Buffer } from 'node:buffer';
import type { IntakeOperation, IntakeOperationEvent } from './run-telemetry';
import { FATTAL_BOOKLET_TARGETS } from './fattal';
import { canonical, isHash, manifestId, parseManifest, sha256, FATTAL_CLOUD_PAUSED_TARGETS, type CloudManifest } from './cloud-policy';
import { insist, inspectUploadJournal, UploadError, withUploadJournal } from './cloud-upload-journal';

export interface UploaderConfig {
  enabled?: boolean;
  writesEnabled?: boolean;
  baseUrl?: string;
  ownerId?: string;
  ownerEmail?: string;
  projectId?: string;
  allowedTargets?: string[];
  stateDirectory?: string;
  durableStateConfirmed?: boolean;
  credentialMode?: 'raw' | 'network-secret';
  executionMode?: 'durable' | 'supervised';
  supervisedManifestId?: string;
}
export interface UploaderRuntime {
  fetch: typeof fetch;
  now: () => number;
  resolveSecret: () => Promise<string | undefined>;
  onOperation?: (event: IntakeOperationEvent) => void;
}
const runtimeDefaults = {
  fetch: (...args) => fetch(...args), now: () => Date.now(),
} satisfies Pick<UploaderRuntime, 'fetch' | 'now'>;
const effects = { sendEmail: false, notify: false, deleteOld: false, cleanup: false };
const secretShape = /tq_(?:fc|ci)_/i;
const maxBody = 4 * 1024 * 1024;
export function createFattalCloudUploader(config: UploaderConfig = {}, suppliedRuntime?: UploaderRuntime) {
  const bounds = { ...config, allowedTargets: [...(config.allowedTargets ?? [])] };
  const runtime: UploaderRuntime = suppliedRuntime ?? { ...runtimeDefaults,
    resolveSecret: async () => bounds.credentialMode === 'network-secret'
      ? process.env.FATTAL_CLOUD_WRITER_NETWORK_KEY : process.env.FATTAL_CLOUD_CLIENT_KEY };
  function configuration() {
    insist(bounds.enabled === true, 'disabled');
    insist(bounds.baseUrl && bounds.ownerId && bounds.ownerEmail && bounds.projectId
      && !secretShape.test(JSON.stringify(bounds)), 'configuration');
    let origin: URL;
    try { origin = new URL(bounds.baseUrl); } catch { throw new UploadError('configuration'); }
    insist(origin.protocol === 'https:' && !origin.username && !origin.password && !origin.search && !origin.hash
      && origin.pathname === '/' && !origin.port, 'configuration');
    insist(bounds.credentialMode === undefined || ['raw', 'network-secret'].includes(bounds.credentialMode), 'configuration');
    if (bounds.credentialMode === 'network-secret') insist(origin.origin === 'https://qr.playzones.app', 'configuration');
    insist(bounds.allowedTargets.length > 0 && bounds.allowedTargets.length <= 12
      && new Set(bounds.allowedTargets).size === bounds.allowedTargets.length
      && bounds.allowedTargets.every(id => FATTAL_BOOKLET_TARGETS.some(t => t.shortId === id)), 'configuration');
    insist(bounds.executionMode === undefined || ['durable', 'supervised'].includes(bounds.executionMode), 'configuration');
    if (bounds.executionMode === 'supervised') insist(bounds.allowedTargets.length === 1 && isHash(bounds.supervisedManifestId)
      && bounds.durableStateConfirmed !== true && bounds.stateDirectory === undefined, 'configuration');
    return origin.origin;
  }
  function normalize(value: unknown, fresh = true): CloudManifest {
    configuration();
    try {
      insist(!secretShape.test(JSON.stringify(value)), 'input');
      return parseManifest(value, { ownerId: bounds.ownerId!, projectId: bounds.projectId!, allowedTargets: bounds.allowedTargets }, runtime.now(), fresh);
    } catch { throw new UploadError('input'); }
  }
  async function request(operation: IntakeOperation, body?: unknown, id?: string): Promise<Record<string, unknown>> {
    const origin = configuration();
    let key: string | undefined;
    try { key = await runtime.resolveSecret(); } catch { throw new UploadError('credential'); }
    insist(typeof key === 'string' && key.length > 0 && key.length <= 4096 && !/[\r\n]/.test(key)
      && (bounds.credentialMode === 'network-secret' || /^tq_fc_[a-f0-9]{32}\.[a-f0-9]{64}$/.test(key)), 'credential');
    const url = new URL(`/api/content-intake/fattal/cloud/${operation}`, origin);
    if (id) url.searchParams.set('manifestId', id);
    const started = performance.now();
    let outcome: IntakeOperationEvent['outcome'] = 'failed';
    try {
      const response = await runtime.fetch(url.toString(), { method: body === undefined ? 'GET' : 'POST',
        redirect: 'error', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(75000),
        headers: { 'x-fattal-cloud-key': key, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      insist(response.ok && response.body && (!response.url || response.url === url.toString()), 'transport');
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        while (true) {
          const { value, done } = await reader.read(); if (done) break;
          size += value.length;
          if (size > 256 * 1024) { await reader.cancel(); throw new UploadError('response'); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      const text = Buffer.concat(chunks).toString('utf8');
      insist(!text.includes(key) && !secretShape.test(text), 'response');
      const result = JSON.parse(text);
      insist(result && typeof result === 'object' && !Array.isArray(result), 'response');
      outcome = 'completed';
      return result;
    } catch (error) {
      if (error instanceof UploadError) throw error;
      throw new UploadError('transport');
    } finally {
      try { runtime.onOperation?.({ operation, outcome, durationMs: Math.max(0, performance.now() - started), retry: false }); }
      catch { /* Metrics cannot alter a write outcome or cause a retry. */ }
    }
  }
  async function health() {
    const h = await request('health');
    insist(h.protocol === 1 && h.ownerId === bounds.ownerId && h.ownerEmail === bounds.ownerEmail && h.projectId === bounds.projectId
      && Array.isArray(h.scopes) && h.scopes.includes('read') && new Set(h.scopes).size === h.scopes.length
      && h.scopes.every(s => s === 'read' || s === 'write')
      && Number.isSafeInteger(h.expiresAt) && Number(h.expiresAt) > runtime.now()
      && typeof h.writesEnabled === 'boolean' && h.notificationsEnabled === false && h.cleanupEnabled === false
      && Array.isArray(h.targets) && h.targets.length === bounds.allowedTargets.length, 'response');
    const targets = h.targets.map(t => {
      insist(t && bounds.allowedTargets.includes(t.shortId) && t.hotel === FATTAL_BOOKLET_TARGETS.find(f => f.shortId === t.shortId)?.key
        && isHash(t.expectedVersion) && typeof t.pending === 'boolean', 'response');
      return { shortId: String(t.shortId), expectedVersion: String(t.expectedVersion), pending: Boolean(t.pending) };
    });
    insist(new Set(targets.map(t => t.shortId)).size === targets.length, 'response');
    return { protocol: 1, ownerId: bounds.ownerId, projectId: bounds.projectId, scopes: h.scopes as string[],
      writesEnabled: h.writesEnabled, supervisedEnabled: h.supervisedEnabled === true, writeMode: h.writeMode,
      attemptManifestId: h.attemptManifestId, expiresAt: Number(h.expiresAt), targets };
  }
  async function preview(value: unknown) {
    const manifest = normalize(value);
    const h = await health();
    const target = h.targets.find(t => t.shortId === manifest.shortId);
    insist(target && !target.pending && target.expectedVersion === manifest.expectedVersion, 'input');
    const p = await request('preview', { manifest, saveRun: false, ...effects });
    insist(p.protocol === 1 && p.manifestId === manifestId(manifest) && canonical(p.manifest) === canonical(manifest)
      && p.saved === false && p.pending === false && typeof p.duplicate === 'boolean'
      && p.notification === 'disabled' && p.cleanup === 'disabled', 'response');
    return { manifest, manifestId: manifestId(manifest), duplicate: p.duplicate };
  }
  function journalBinding() {
    const origin = configuration();
    insist(bounds.executionMode !== 'supervised', 'configuration');
    insist(bounds.durableStateConfirmed === true && bounds.stateDirectory?.startsWith('/'), 'configuration');
    return sha256(canonical({ origin, ownerId: bounds.ownerId, ownerEmail: bounds.ownerEmail, projectId: bounds.projectId,
      targets: [...bounds.allowedTargets].sort() }));
  }
  function uncertain(m: CloudManifest) {
    return { manifestId: manifestId(m), shortId: m.shortId, sha256: m.sha256, status: 'uncertain' as const,
      verified: false, retryAllowed: false, notification: 'disabled', cleanup: 'disabled' };
  }
  async function recoverManifest(m: CloudManifest, healthChecked = false) {
    if (!healthChecked) await health(); // Each server recovery also authenticates/rechecks scope.
    const r = await request('recovery', undefined, manifestId(m));
    insist(r.protocol === 1 && r.manifestId === manifestId(m) && r.shortId === m.shortId && r.sha256 === m.sha256
      && ['verified', 'uncertain', 'superseded'].includes(String(r.status)) && r.verified === (r.status === 'verified')
      && r.retryAllowed === false && r.notification === 'disabled' && r.cleanup === 'disabled', 'response');
    return { ...uncertain(m), status: r.status as 'verified' | 'uncertain' | 'superseded', verified: r.verified as boolean };
  }
  async function run(value: unknown, inputBytes?: Buffer, recoverOnly = false) {
    // Recovery accepts an old review but never weakens fresh review on new writes.
    const manifest = normalize(value, false);
    const id = manifestId(manifest);
    if (!recoverOnly) insist(bounds.writesEnabled === true, 'disabled');
    if (!recoverOnly) insist(!FATTAL_CLOUD_PAUSED_TARGETS.includes(manifest.shortId), 'disabled');
    const binding = journalBinding();
    const bytes = inputBytes && Buffer.from(inputBytes); // Freeze bytes before any await.
    return withUploadJournal(bounds.stateDirectory!, binding, async (journal, save) => {
      const previous = journal.attempts[id];
      if (!previous) {
        insist(!recoverOnly, 'state'); // Never silently initialize a lost recovery journal.
        normalize(manifest); // Fresh at new submission only.
        insist(bytes && bytes.length === manifest.size && sha256(bytes) === manifest.sha256
          && bytes.subarray(0, 5).toString() === '%PDF-', 'input');
        insist(!Object.values(journal.attempts).some(a => a.manifest.shortId === manifest.shortId && a.status === 'pending'), 'pending');
        const body = { activate: true, manifest, manifestId: id, pdfBase64: bytes.toString('base64'), ...effects };
        insist(Buffer.byteLength(JSON.stringify(body)) <= maxBody, 'input');
        const h = await health();
        insist(h.writesEnabled && h.scopes.includes('write'), 'credential');
        const p = await preview(manifest);
        insist(!p.duplicate, 'pending'); // Unknown earlier receipt needs administrator reconciliation.
        normalize(manifest); // Review may have expired during preflight.
        // No POST can happen before both file and directory fsync succeed.
        journal.attempts[id] = { manifest, status: 'pending' };
        await save();
        try { await request('commit', body); }
        catch { /* May have activated. Recovery is the only permitted next request. */ }
      }
      // Always verify the exact receipt + active pointer + public bytes through GET,
      // even when POST claimed success. Missing/expired receipt is still pending.
      let result;
      try { result = await recoverManifest(manifest); }
      catch { return uncertain(manifest); }
      journal.attempts[id].status = result.verified ? 'verified' : result.status === 'superseded' ? 'superseded' : 'pending';
      await save();
      return result;
    });
  }
  const supervisedAttempts = new Set<string>();
  async function supervisedRun(value: unknown, inputBytes?: Buffer, recoverOnly = false) {
    const manifest = normalize(value, false), id = manifestId(manifest);
    insist(bounds.executionMode === 'supervised' && id === bounds.supervisedManifestId, 'configuration');
    if (recoverOnly || supervisedAttempts.has(id)) {
      try { return await recoverManifest(manifest); } catch { return uncertain(manifest); }
    }
    insist(bounds.writesEnabled === true && !FATTAL_CLOUD_PAUSED_TARGETS.includes(manifest.shortId), 'disabled');
    const bytes = inputBytes && Buffer.from(inputBytes);
    insist(bytes && bytes.length === manifest.size && sha256(bytes) === manifest.sha256 && bytes.subarray(0, 5).toString() === '%PDF-', 'input');
    supervisedAttempts.add(id); // Includes concurrent calls and ambiguous preflight failures.
    const h = await health();
    insist(h.writeMode === 'supervised' && (h.attemptManifestId === null || isHash(h.attemptManifestId)), 'response');
    if (h.attemptManifestId !== null) {
      insist(h.attemptManifestId === id, 'pending');
      try { return await recoverManifest(manifest, true); } catch { return uncertain(manifest); }
    }
    insist(h.supervisedEnabled && h.writesEnabled && h.scopes.includes('write'), 'credential');
    const p = await preview(manifest); insist(!p.duplicate, 'pending');
    normalize(manifest);
    const body = { activate: true, executionMode: 'supervised', manifest, manifestId: id, pdfBase64: bytes.toString('base64'), ...effects };
    insist(Buffer.byteLength(JSON.stringify(body)) <= maxBody, 'input');
    // A server transaction consumes the writer and claims the target before R2.
    // Locally, even a missing receipt or failed POST can never trigger another POST.
    try { await request('commit', body); } catch { /* Reconcile only. */ }
    try { return await recoverManifest(manifest); } catch { return uncertain(manifest); }
  }
  async function initializeState() {
    return withUploadJournal(bounds.stateDirectory!, journalBinding(), async () => ({ protocol: 1, initialized: true, networkRequests: 0 }), true);
  }
  async function state() {
    const { journal, lockPresent } = await inspectUploadJournal(bounds.stateDirectory!, journalBinding());
    return { protocol: 1, lockPresent, currentServerStateVerified: false,
      attempts: Object.entries(journal.attempts).map(([id, attempt]) => ({ manifestId: id,
        shortId: attempt.manifest.shortId, filename: attempt.manifest.filename, sha256: attempt.manifest.sha256, lastKnownStatus: attempt.status })) };
  }
  async function recoverPending() {
    return withUploadJournal(bounds.stateDirectory!, journalBinding(), async (journal, save) => {
      const pending = Object.entries(journal.attempts).filter(([, attempt]) => attempt.status === 'pending');
      const results: Array<Awaited<ReturnType<typeof recoverManifest>>> = [];
      if (!pending.length) return { protocol: 1, results, pending: 0, retryAllowed: false };
      await health(); // One failure stops the scan rather than repeating denied requests.
      for (const [, attempt] of pending.slice(0, 25)) {
        const manifest = normalize(attempt.manifest, false);
        let result;
        try { result = await recoverManifest(manifest, true); }
        catch { results.push(uncertain(manifest)); break; }
        attempt.status = result.verified ? 'verified' : result.status === 'superseded' ? 'superseded' : 'pending';
        await save();
        results.push(result);
      }
      return { protocol: 1, results, pending: Object.values(journal.attempts).filter(attempt => attempt.status === 'pending').length, retryAllowed: false };
    });
  }
  return { health, preview, initializeState, state, recoverPending, upload: (manifest: unknown, bytes: Buffer) => bounds.executionMode === 'supervised' ? supervisedRun(manifest, bytes) : run(manifest, bytes),
    recover: (manifest: unknown) => bounds.executionMode === 'supervised' ? supervisedRun(manifest, undefined, true) : run(manifest, undefined, true) };
}
