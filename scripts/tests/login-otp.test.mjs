import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { stub } from './load-ts.mjs';

// Passwordless login: identity parsing, and the login-code store (hashing,
// cooldown, expiry, single use, lockout, all-or-nothing rate limits) against an
// in-memory Firestore fake. No network or credentials.

async function tsUrl(relativePath, replacements = {}) {
  let source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  for (const [specifier, replacement] of Object.entries(replacements)) {
    source = source.replaceAll(`'${specifier}'`, JSON.stringify(replacement));
  }
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}

// --- in-memory Firestore (only what the store uses) ---
const store = new Map();
globalThis.__loginFakeDb = {
  collection: (name) => ({
    doc: (id) => {
      const path = `${name}/${id}`;
      return {
        path,
        get: async () => ({ exists: store.has(path), data: () => store.get(path) }),
        delete: async () => { store.delete(path); },
      };
    },
  }),
  runTransaction: async (fn) => fn({
    get: async (ref) => ({ exists: store.has(ref.path), data: () => store.get(ref.path) }),
    set: (ref, data) => { store.set(ref.path, { ...data }); },
    update: (ref, data) => { store.set(ref.path, { ...store.get(ref.path), ...data }); },
    delete: (ref) => { store.delete(ref.path); },
  }),
};

const firestoreStub = stub(`
  export const Timestamp = { fromMillis: (ms) => ({ toMillis: () => ms }) };
  export const FieldValue = { serverTimestamp: () => ({ __serverTimestamp: true }) };
`);
const verificationUrl = await tsUrl('../../src/lib/verification.ts', {
  uuid: stub('export const v4 = () => "00000000-0000-4000-8000-000000000000";'),
});
const codes = await import(await tsUrl('../../src/lib/auth/loginCodes.server.ts', {
  'firebase-admin/firestore': firestoreStub,
  '@/lib/firebase-admin': stub('export const getAdminDb = () => globalThis.__loginFakeDb;'),
  '@/lib/verification': verificationUrl,
}));
const { parseLoginIdentity } = await import(await tsUrl('../../src/lib/auth/identity.ts', {
  '@/lib/phone-utils': await tsUrl('../../src/lib/phone-utils.ts'),
}));

const realNow = Date.now;
let clock = realNow();
beforeEach(() => {
  store.clear();
  clock = realNow();
  Date.now = () => clock;
});
const later = (ms) => { clock += ms; };

const alice = { kind: 'email', value: 'alice@example.com' };
const wrong = (code) => String((Number(code) + 1) % 1_000_000).padStart(6, '0');

test('identity: email lowercased, Israeli mobiles to E.164, everything else rejected', () => {
  assert.deepEqual(parseLoginIdentity('  Alice@Example.COM '), { kind: 'email', value: 'alice@example.com' });
  assert.deepEqual(parseLoginIdentity('050-123-4567'), { kind: 'phone', value: '+972501234567' });
  assert.deepEqual(parseLoginIdentity('+972 54 765 4321'), { kind: 'phone', value: '+972547654321' });
  for (const bad of ['', 'alice', 'a@b', '03-1234567', '+1 415 555 0100', '12345', 'x'.repeat(300), null, 42]) {
    assert.equal(parseLoginIdentity(bad), null, String(bad));
  }
});

test('issued code is 6 digits, stored only as a salted hash, and single-use', async () => {
  const issued = await codes.issueLoginCode(alice);
  assert.equal(issued.ok, true);
  assert.match(issued.code, /^\d{6}$/);
  const [doc] = [...store.values()];
  assert.ok(doc.codeHash && doc.salt);
  assert.ok(!JSON.stringify(doc).includes(issued.code), 'raw code must not be stored');
  assert.ok(![...store.keys()].some((k) => k.includes('alice')), 'raw identity must not be a doc id');

  assert.deepEqual(await codes.verifyLoginCode(alice, issued.code), { ok: true });
  assert.equal((await codes.verifyLoginCode(alice, issued.code)).ok, false, 'second use fails');
});

test('a code is bound to its identity', async () => {
  const issued = await codes.issueLoginCode(alice);
  assert.equal((await codes.verifyLoginCode({ kind: 'email', value: 'bob@example.com' }, issued.code)).ok, false);
});

test('resend cooldown, then a new code replaces the old one', async () => {
  const first = await codes.issueLoginCode(alice);
  const blocked = await codes.issueLoginCode(alice);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'cooldown');
  later(codes.RESEND_COOLDOWN_MS + 1);
  const second = await codes.issueLoginCode(alice);
  assert.equal(second.ok, true);
  if (first.code !== second.code) {
    assert.equal((await codes.verifyLoginCode(alice, first.code)).ok, false, 'old code is dead');
  }
  assert.deepEqual(await codes.verifyLoginCode(alice, second.code), { ok: true });
});

test('codes expire after 10 minutes', async () => {
  const issued = await codes.issueLoginCode(alice);
  later(codes.CODE_TTL_MS + 1);
  assert.deepEqual(await codes.verifyLoginCode(alice, issued.code), { ok: false, reason: 'expired' });
});

test('5 wrong guesses burn the code and lock the identity for 30 minutes', async () => {
  const issued = await codes.issueLoginCode(alice);
  for (let left = 4; left >= 1; left--) {
    assert.deepEqual(await codes.verifyLoginCode(alice, wrong(issued.code)), { ok: false, reason: 'invalid', attemptsLeft: left });
  }
  assert.equal((await codes.verifyLoginCode(alice, wrong(issued.code))).reason, 'blocked');
  assert.equal((await codes.verifyLoginCode(alice, issued.code)).reason, 'blocked', 'right code no longer works');
  later(codes.RESEND_COOLDOWN_MS + 1);
  assert.equal((await codes.issueLoginCode(alice)).reason, 'blocked', 'no new code while locked');
  later(30 * 60 * 1000);
  const fresh = await codes.issueLoginCode(alice);
  assert.equal(fresh.ok, true);
  assert.deepEqual(await codes.verifyLoginCode(alice, fresh.code), { ok: true });
});

test('rate limits are all-or-nothing and reset after their window', async () => {
  const limits = [
    { key: 'id', max: 2, windowMs: 1000 },
    { key: 'global', max: 100, windowMs: 1000 },
  ];
  assert.equal(await codes.consumeLimits(limits), true);
  assert.equal(await codes.consumeLimits(limits), true);
  assert.equal(await codes.consumeLimits(limits), false);
  const globalDoc = [...store.values()].find((d) => d.count && d.count >= 2 && d.resetAt);
  assert.ok(globalDoc);
  assert.equal(Math.max(...[...store.values()].map((d) => d.count)), 2, 'a rejected call consumes nothing');
  later(1001);
  assert.equal(await codes.consumeLimits(limits), true);
});

test('rate limiting fails closed when Firestore errors', async () => {
  const original = globalThis.__loginFakeDb.runTransaction;
  globalThis.__loginFakeDb.runTransaction = async () => { throw new Error('unavailable'); };
  try {
    assert.equal(await codes.consumeLimits([{ key: 'x', max: 5, windowMs: 1000 }]), false);
  } finally {
    globalThis.__loginFakeDb.runTransaction = original;
  }
});
