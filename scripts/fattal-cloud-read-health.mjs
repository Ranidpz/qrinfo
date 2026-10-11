import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const endpoint = 'https://qr.playzones.app/api/content-intake/fattal/cloud/health';
// Dedicated proxy-secret entrypoint. The existing raw-token clients remain strict.
// No URL/command/credential arguments, uploads, preview saves, retries or redirects.
export async function main(args = process.argv.slice(2), environment = process.env, runtime = {}) {
  const output = runtime.output || (text => process.stdout.write(text));
  try {
    if (args.length || environment.FATTAL_CLOUD_NETWORK_READ_ENABLED !== 'true') throw Error();
    const config = JSON.parse(await (runtime.readFile || readFile)(environment.FATTAL_CLOUD_NETWORK_READ_CONFIG, 'utf8'));
    if (!config || Object.keys(config).sort().join(',') !== 'ownerEmail,ownerId,projectId'
      || typeof config.ownerId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(config.ownerId)
      || config.ownerEmail !== 'biduratias@gmail.com' || config.projectId !== 'qrinfo-905c9') throw Error();
    const { FATTAL_BOOKLET_TARGETS: targets } = await (runtime.loadTargets || (() => import('../build/fattal-cloud/fattal.js')))();
    // This may be an opaque network-secret placeholder. Never print/parse it.
    const key = environment.FATTAL_CLOUD_NETWORK_KEY;
    if (typeof key !== 'string' || !key || /[\r\n]/.test(key)) throw Error();
    const response = await (runtime.fetch || fetch)(endpoint, { method: 'GET', redirect: 'error', credentials: 'omit', cache: 'no-store',
      signal: AbortSignal.timeout(20000), headers: { 'x-fattal-cloud-key': key } });
    if (!response.ok || !response.body || (response.url && response.url !== endpoint)) throw Error();
    const reader = response.body.getReader();
    const chunks = []; let length = 0;
    try {
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        length += value.length;
        if (length > 65536) { await reader.cancel(); throw Error(); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const health = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (health.protocol !== 1 || health.ownerId !== config.ownerId || health.ownerEmail !== config.ownerEmail
      || health.projectId !== config.projectId || JSON.stringify(health.scopes) !== '["read"]'
      || health.writesEnabled !== false || health.notificationsEnabled !== false || health.cleanupEnabled !== false
      || !Number.isSafeInteger(health.expiresAt) || health.expiresAt <= (runtime.now || Date.now)()
      || !Array.isArray(health.targets) || health.targets.length !== 12 || targets.length !== 12
      || new Set(health.targets.map(t => t.shortId)).size !== 12) throw Error();
    const verified = targets.map(t => {
      const found = health.targets.find(v => v.shortId === t.shortId && v.hotel === t.key);
      if (!found || !/^[a-f0-9]{64}$/.test(found.expectedVersion) || typeof found.pending !== 'boolean') throw Error();
      return { shortId: t.shortId, hotel: t.key, expectedVersion: found.expectedVersion, pending: found.pending };
    });
    output(JSON.stringify({ protocol: 1, ownerId: config.ownerId, ownerEmail: config.ownerEmail, projectId: config.projectId,
      scopes: ['read'], expiresAt: health.expiresAt, writesEnabled: false, notificationsEnabled: false, cleanupEnabled: false, targets: verified }) + '\n');
    return 0;
  } catch {
    output('{"error":"Read-only health check failed","retryAllowed":false}\n'); return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main();
