import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs, stub } from './load-ts.mjs';
const fattal = await loadTs('../../src/lib/content-intake/fattal.ts');
globalThis.cloudClientModules = { fattal };
const exportsOf = (name, value) => stub(Object.keys(value).map(k => `export const ${k}=globalThis.cloudClientModules.${name}.${k};`).join('\n'));
const fattalStub = exportsOf('fattal', fattal);
const policy = await loadTs('../../src/lib/content-intake/cloud-policy.ts', { './fattal': fattalStub });
globalThis.cloudClientModules.policy = policy;
const { createFattalCloudClient, createFattalCloudReadTools } = await loadTs('../../src/lib/content-intake/cloud-client.ts', {
  'server-only': stub('export {};'), './fattal': fattalStub, './cloud-policy': exportsOf('policy', policy),
});
const now = Date.parse('2026-10-09T10:00:00Z');
const key = `tq_fc_${'a'.repeat(32)}.${'b'.repeat(64)}`; // Synthetic, never real credentials.
const target = fattal.FATTAL_BOOKLET_TARGETS[0];
const hash = policy.sha256('synthetic bytes');
const version = policy.sha256('synthetic current');
function fixture(overrides = {}) {
  const config = { enabled: true, baseUrl: 'https://fixture.invalid', ownerId: 'owner', ownerEmail: 'fixture@example.invalid', projectId: 'fixture-project',
    allowedTargets: [target.shortId], credentialRef: 'env:FATTAL_CLOUD_CLIENT_KEY', ...overrides };
  const state = { resolutions: 0, calls: [], mutate: value => value, fail: false };
  const manifest = { protocol: 1, ownerId: 'owner', projectId: 'fixture-project', shortId: target.shortId, hotel: target.key,
    period: { kind: 'weekend', startDate: '2026-10-08', endDate: '2026-10-10' }, filename: 'file.pdf', sha256: hash, size: 30,
    expectedVersion: version, sourceGroupId: 'fixture-group', sources: [{ messageId: 'm1', fileId: 'f1', sha256: hash }], supersedes: [],
    review: { reviewer: 'fixture-reviewer', reviewedAt: now, evidence: 'Reviewed source evidence', contextResolved: true, replacementApproved: true } };
  const runtime = {
    now: () => now,
    resolveSecret: async reference => { assert.equal(reference, 'env:FATTAL_CLOUD_CLIENT_KEY'); state.resolutions++; return key; },
    fetch: async (url, options) => {
      state.calls.push({ url, options });
      if (state.fail) throw Error(`Unsafe remote error ${key}`);
      assert.equal(options.redirect, 'error'); assert.equal(options.credentials, 'omit'); assert.equal(options.cache, 'no-store');
      assert.equal(options.headers['x-fattal-cloud-key'], key);
      assert.equal(new URL(url).origin, 'https://fixture.invalid');
      const operation = new URL(url).pathname.split('/').pop();
      let result;
      if (operation === 'health') result = { protocol: 1, ownerId: 'owner', ownerEmail: 'fixture@example.invalid', projectId: 'fixture-project',
        scopes: ['read'], expiresAt: now + 3600000, notificationsEnabled: false, cleanupEnabled: false,
        targets: [{ shortId: target.shortId, hotel: target.key, expectedVersion: version, pending: false }], ignored: 'do not expose' };
      else if (operation === 'preview') result = { protocol: 1, manifest, manifestId: policy.manifestId(manifest), saved: false,
        duplicate: false, pending: false, notification: 'disabled', cleanup: 'disabled' };
      else if (operation === 'recovery') result = { protocol: 1, manifestId: policy.manifestId(manifest), shortId: target.shortId, sha256: hash,
        status: 'verified', verified: true, retryAllowed: false, notification: 'disabled', cleanup: 'disabled' };
      else throw Error('Unexpected write operation');
      return new Response(JSON.stringify(state.mutate(result, operation)), { status: 200 });
    },
  };
  const client = createFattalCloudClient(config, runtime);
  return { client, tools: createFattalCloudReadTools(client), state, manifest, runtime, config };
}
test('disabled/missing configuration never resolves secrets or invokes transport', async () => {
  for (const config of [{ enabled: false }, { enabled: undefined }, { baseUrl: undefined }, { ownerId: '' }, { allowedTargets: [] }, { credentialRef: 'env:OTHER_SECRET' }]) {
    const f = fixture(config); await assert.rejects(f.client.health); assert.equal(f.state.resolutions, 0); assert.equal(f.state.calls.length, 0);
  }
  await assert.rejects(createFattalCloudClient().health, /disabled/);
  const f = fixture({ enabled: false });
  await assert.rejects(() => f.client.preview(f.manifest), /disabled/);
  await assert.rejects(() => f.client.recovery({ manifestId: policy.manifestId(f.manifest), shortId: target.shortId, sha256: hash }), /disabled/);
  assert.equal(f.state.resolutions, 0); assert.equal(f.state.calls.length, 0);
});
test('origins cannot contain credentials, paths, redirects, ports or insecure transport', async () => {
  for (const baseUrl of ['http://fixture.invalid', 'https://user:password@fixture.invalid', 'https://fixture.invalid/other', 'https://fixture.invalid?q=x', 'https://fixture.invalid:444', 'not a url']) {
    const f = fixture({ baseUrl }); await assert.rejects(f.client.health, /configuration/); assert.equal(f.state.resolutions, 0);
  }
});
test('health projects only non-secret attestation and rejects owner/project/scope/target mismatch', async () => {
  const ok = fixture(); assert.equal((await ok.client.health()).ignored, undefined);
  for (const mutate of [r => r.ownerId = 'other', r => r.ownerEmail = 'other', r => r.projectId = 'other', r => r.scopes.push('write'),
    r => r.expiresAt = now, r => r.targets[0].shortId = fattal.FATTAL_BOOKLET_TARGETS[1].shortId, r => r.targets.push(r.targets[0]), r => r.cleanupEnabled = true]) {
    const f = fixture(); f.state.mutate = r => { mutate(r); return r; }; await assert.rejects(f.client.health, /response/);
  }
});
test('preview always preflights health and forces read-only fields; returned manifest must match', async () => {
  const f = fixture(); const result = await f.tools('fattal_cloud_preview', { manifest: f.manifest });
  assert.equal(result.saved, false); assert.equal(result.manifestId, policy.manifestId(f.manifest));
  assert.deepEqual(f.state.calls.map(c => c.options.method), ['GET', 'POST']);
  assert.deepEqual(JSON.parse(f.state.calls[1].options.body), { manifest: f.manifest, saveRun: false, sendEmail: false, notify: false, deleteOld: false, cleanup: false });
  for (const field of ['saved', 'manifestId', 'manifest']) {
    const g = fixture(); g.state.mutate = (r, op) => op === 'preview' ? { ...r, [field]: 'unexpected' } : r;
    await assert.rejects(() => g.client.preview(g.manifest), /response/);
  }
});
test('stale/pending and conflicting manifests never reach preview transport', async () => {
  for (const mutation of [r => r.targets[0].expectedVersion = 'c'.repeat(64), r => r.targets[0].pending = true]) {
    const f = fixture(); f.state.mutate = r => { mutation(r); return r; };
    await assert.rejects(() => f.client.preview(f.manifest), /input/); assert.equal(f.state.calls.length, 1);
  }
  const f = fixture(); f.manifest.hotel = 'adjacent hotel';
  await assert.rejects(() => f.client.preview(f.manifest), /input/); assert.equal(f.state.calls.length, 0);
});
test('recovery binds receipt target/hash, preserves uncertainty and never retries', async () => {
  const f = fixture(); const input = { manifestId: policy.manifestId(f.manifest), shortId: target.shortId, sha256: hash };
  assert.equal((await f.tools('fattal_cloud_recovery', input)).verified, true);
  f.state.mutate = (r, op) => op === 'recovery' ? { ...r, status: 'uncertain', verified: false } : r;
  const result = await f.client.recovery(input); assert.equal(result.verified, false); assert.equal(result.retryAllowed, false);
  assert.equal(f.state.calls.length, 4);
  f.state.mutate = (r, op) => op === 'recovery' ? { ...r, status: 'superseded', verified: false } : r;
  assert.equal((await f.client.recovery(input)).status, 'superseded');
  for (const change of [{ sha256: 'e'.repeat(64) }, { shortId: 'other' }, { manifestId: 'e'.repeat(64) }, { status: 'verified', verified: false }]) {
    f.state.mutate = (r, op) => op === 'recovery' ? { ...r, ...change } : r;
    await assert.rejects(() => f.client.recovery(input), /response/);
  }
});
test('transport, resolver and echoed-secret failures never expose secret or raw errors', async () => {
  const f = fixture(); f.state.fail = true;
  await assert.rejects(f.client.health, e => e.message === 'Fattal read-only connector: transport' && !JSON.stringify(e).includes(key));
  assert.equal(f.state.calls.length, 1);
  f.state.fail = false; f.state.mutate = r => ({ ...r, leaked: key });
  await assert.rejects(f.client.health, /response/);
  f.runtime.resolveSecret = async () => { throw Error(key); };
  await assert.rejects(f.client.health, e => e.message === 'Fattal read-only connector: credential');
  const circular = {}; circular.self = circular;
  for (const input of [circular, { value: 1n }, { toJSON() { throw Error(key); } }]) {
    await assert.rejects(() => f.client.preview(input), e => e.message === 'Fattal read-only connector: input');
  }
});
test('model-facing dispatcher accepts only exact read tool arguments; secret/config/write inputs rejected', async () => {
  const f = fixture();
  for (const [name, input] of [['commit', {}], ['fattal_cloud_commit', {}], ['fattal_cloud_health', { baseUrl: 'https://other.invalid' }],
    ['fattal_cloud_health', { key }], ['fattal_cloud_preview', { manifest: f.manifest, saveRun: true }],
    ['fattal_cloud_preview', { manifest: { ...f.manifest, review: { ...f.manifest.review, evidence: key } } }]]) {
    await assert.rejects(() => f.tools(name, input), /input/);
  }
  assert.equal(f.state.calls.length, 0);
  assert.deepEqual(Object.keys(f.client).sort(), ['health', 'preview', 'recovery']);
});
test('oversized and untrusted redirect responses fail closed', async () => {
  const f = fixture(); f.runtime.fetch = async () => new Response('x'.repeat(256 * 1024 + 1));
  await assert.rejects(f.client.health, /response/);
  f.runtime.fetch = async () => { const r = new Response('{}'); Object.defineProperty(r, 'url', { value: 'https://other.invalid' }); return r; };
  await assert.rejects(f.client.health, /transport/);
});
