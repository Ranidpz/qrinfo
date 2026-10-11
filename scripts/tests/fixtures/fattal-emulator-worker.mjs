import assert from 'node:assert/strict';
import { main } from '../../fattal-cloud-upload.mjs';

// Test-only bridge: the production client's strict HTTPS origin check is unchanged.
// The only socket destination is the explicitly supplied numeric loopback server.
const local = new URL(process.env.FATTAL_TEST_HTTP_ORIGIN);
assert.equal(local.hostname, '127.0.0.1');
assert.equal(local.protocol, 'http:');
assert.ok(local.port);
assert.equal(local.pathname, '/');
assert.equal(local.username + local.password + local.search + local.hash, '');
const fetchLocal = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  assert.equal(url.origin, 'https://fattal-api.invalid');
  assert.match(url.pathname, /^\/api\/content-intake\/fattal\/cloud\/(health|preview|commit|recovery)$/);
  assert.equal(init.redirect, 'error');
  const response = await fetchLocal(new URL(url.pathname + url.search, local), init);
  // Deliberately project transport response without the loopback URL, as in the
  // existing injected fixture tests. This does not test production TLS routing.
  return new Response(response.body, { status: response.status, headers: response.headers });
};
const writerId = process.env.FATTAL_TEST_WRITER_ID || 'a'.repeat(32);
assert.match(writerId, /^[a-f0-9]{32}$/);
const environment = {
  FATTAL_CLOUD_UPLOADER_CONFIG: process.env.FATTAL_CLOUD_UPLOADER_CONFIG,
  FATTAL_CLOUD_CLIENT_KEY: `tq_fc_${writerId}.${'b'.repeat(64)}`, // Synthetic fixture only.
};
process.exitCode = await main(process.argv.slice(2), environment);
