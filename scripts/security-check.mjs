#!/usr/bin/env node
/**
 * npm run security:check — static guard for the rules in docs/SECURITY_RULES.md.
 * Fails (exit 1) when a change reintroduces a known class of hole. Every exception lives in
 * scripts/security-allowlist.json WITH a written reason — never silence a check in code.
 *
 * Checks:
 *  1. every API route uses an auth / rate-limit / signed-access helper
 *  2. dangerouslySetInnerHTML only with a sanitiser (or JSON-LD)
 *  3. no `if true` writes in firestore.rules, no `.write: true` in database.rules.json
 *  4. paid INFORU sends only through src/lib/messaging/paidSend.ts
 *  5. no raw error text (String(error) / error.message) in API JSON responses
 *  6. no new secret-like fields (token / pin / secret / password / apiKey) in src/types
 *  7. no client-SDK Firestore/RTDB import in API routes (server code must use the Admin SDK)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const allow = JSON.parse(readFileSync(join(ROOT, 'scripts/security-allowlist.json'), 'utf8'));
const failures = [];
const fail = (check, file, msg) => failures.push(`[${check}] ${file}: ${msg}`);
const rel = (p) => relative(ROOT, p);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const srcFiles = walk(join(ROOT, 'src')).filter((f) => /\.(ts|tsx)$/.test(f));
const read = (f) => readFileSync(f, 'utf8');

// 1. API route guards
const GUARDS = [
  'requireCodeOwner', 'requireSuperAdmin', 'verifyAuthToken', 'checkRateLimit', 'authorizeScanner',
  'hasValidServerApiKey', 'authenticateIntakeKey', 'raffleTokenValid', 'verifyObjectDeleteToken',
  'CRON_SECRET', 'isValidOrigin', 'validateOrigin',
];
for (const f of srcFiles.filter((f) => /src\/app\/api\/.*\/route\.tsx?$/.test(f))) {
  const r = rel(f);
  if (allow.unguardedRoutes[r]) continue;
  const s = read(f);
  if (!GUARDS.some((g) => s.includes(g))) fail('route-guard', r, 'no auth / rate-limit helper (add one, or allowlist with a reason)');
}

// 2. dangerouslySetInnerHTML
const SANITISERS = ['sanitizeRichText', 'DOMPurify', 'formatContent', 'JSON.stringify'];
for (const f of srcFiles) {
  const r = rel(f);
  const lines = read(f).split('\n');
  lines.forEach((line, i) => {
    if (!line.includes('dangerouslySetInnerHTML')) return;
    const window = lines.slice(i, i + 4).join('\n');
    if (SANITISERS.some((s) => window.includes(s))) return;
    if (allow.rawHtml[`${r}`]) return;
    fail('raw-html', `${r}:${i + 1}`, 'dangerouslySetInnerHTML without sanitizeRichText/DOMPurify');
  });
}

// 3. open rules
const fsRules = read(join(ROOT, 'firestore.rules')).split('\n');
let matchStack = [];
fsRules.forEach((line, i) => {
  const m = line.match(/match\s+(\S+)\s*\{/);
  if (m) matchStack.push(m[1]);
  if (/allow\s+[^:]*\b(write|create|update|delete)\b[^:]*:\s*if\s+true\s*;/.test(line)) {
    const path = matchStack.join('');
    if (!allow.openFirestoreWrites.some((p) => path.endsWith(p))) fail('firestore-rules', `firestore.rules:${i + 1}`, `public write on ${path}`);
  }
  const closes = (line.match(/\}/g) || []).length - (line.match(/\{/g) || []).length;
  for (let k = 0; k < closes; k++) matchStack.pop();
});
const rtdb = JSON.parse(read(join(ROOT, 'database.rules.json')));
(function scan(node, path) {
  if (!node || typeof node !== 'object') return;
  if (node['.write'] === true && !allow.openRtdbWrites.includes(path)) fail('rtdb-rules', 'database.rules.json', `.write: true at ${path}`);
  for (const [k, v] of Object.entries(node)) if (!k.startsWith('.')) scan(v, `${path}/${k}`);
})(rtdb.rules, '');

// 4. paid sends
const SEND_FNS = /\b(sendOTP|sendWhatsAppOTP|sendSMSOTP|sendTemplateMessage|sendQTagQRWhatsApp)\b/;
const SEND_OWNERS = ['src/lib/inforu.ts', 'src/lib/qtag-whatsapp.ts', 'src/lib/messaging/paidSend.ts'];
for (const f of srcFiles) {
  const r = rel(f);
  if (SEND_OWNERS.includes(r)) continue;
  const imports = read(f).match(/import\s*\{[^}]*\}\s*from\s*'@\/lib\/(inforu|qtag-whatsapp)'/g) || [];
  if (imports.some((imp) => SEND_FNS.test(imp))) fail('paid-send', r, 'imports an INFORU send function — use src/lib/messaging/paidSend.ts');
}

// 5. raw error text in API responses
for (const f of srcFiles.filter((f) => f.includes('/src/app/api/'))) {
  const r = rel(f);
  if (allow.errorText[r]) continue;
  const s = read(f);
  for (const m of s.matchAll(/NextResponse\.json\(([\s\S]*?)\)\s*;/g)) {
    if (/String\((error|err|e)\)|\b(error|err|e)\.message\b|details:\s*(errorMessage|error|err)\b/.test(m[1])) {
      fail('error-text', r, 'raw error text in a JSON response — log it, return a generic message');
    }
  }
}

// 6. secret-like fields in types
const SECRET_FIELD = /^\s*([A-Za-z0-9_]*(?:[Tt]oken|[Pp]in|[Ss]ecret|[Pp]assword|[Aa]pi[Kk]ey)[A-Za-z0-9_]*)\??\s*:/;
for (const f of srcFiles.filter((f) => f.includes('/src/types/') || f.endsWith('/lib/raffle/types.ts'))) {
  const r = rel(f);
  read(f).split('\n').forEach((line) => {
    const m = line.match(SECRET_FIELD);
    if (m && !allow.secretFields.includes(`${r}#${m[1]}`)) {
      fail('secret-field', r, `new secret-like field "${m[1]}" — secrets go in codes/{id}/private (see docs/SECURITY_RULES.md), then allowlist`);
    }
  });
}

// 7. client SDK in API routes
for (const f of srcFiles.filter((f) => f.includes('/src/app/api/'))) {
  const r = rel(f);
  if (allow.clientSdkInApi[r]) continue;
  const s = read(f);
  if (/from '@\/lib\/firebase'|from 'firebase\/(firestore|database)'|from '@\/lib\/[a-z-]+-realtime'/.test(s)) {
    fail('client-sdk', r, 'client Firebase SDK in an API route — use getAdminDb / src/lib/server/*-rtdb');
  }
}

if (failures.length) {
  console.error(`security:check — ${failures.length} problem(s):\n` + failures.map((x) => '  ' + x).join('\n'));
  console.error('\nSee docs/SECURITY_RULES.md. Exceptions go in scripts/security-allowlist.json with a reason.');
  process.exit(1);
}
console.log('security:check — OK');
