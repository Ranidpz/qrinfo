import assert from 'node:assert/strict';

const local = new URL(process.env.FATTAL_TEST_OBJECT_ORIGIN);
assert.equal(local.protocol, 'http:'); assert.equal(local.hostname, '127.0.0.1'); assert.ok(local.port);
assert.equal(local.pathname + local.search + local.hash, '/');
assert.equal(process.env.FATTAL_TEST_NEXT, 'true');
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
  if (url.origin === 'https://fattal-objects.invalid') {
    assert.ok(url.pathname.startsWith('/objects/')); assert.equal(url.search + url.hash, '');
    const response = await nativeFetch(new URL(url.pathname, local), { ...init, redirect: 'error' });
    return new Response(response.body, { status: response.status, headers: response.headers });
  }
  assert.equal(url.origin, local.origin, 'No non-loopback fetch is permitted by the fixture');
  return nativeFetch(input, { ...init, redirect: 'error' });
};
