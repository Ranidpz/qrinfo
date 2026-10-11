import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// No downloads, credentials, default Firebase project, proxies, or inherited NODE_OPTIONS.
// Run only the verified official JAR already provided by the operator.
const root = fileURLToPath(new URL('..', import.meta.url));
const dependencies = resolve(process.env.FATTAL_TEST_DEPENDENCY_ROOT || join(root, 'scripts/fattal-emulator'));
const jar = process.env.FATTAL_TEST_EMULATOR_JAR;
assert.ok(jar, 'Set FATTAL_TEST_EMULATOR_JAR to the verified local official JAR');
const info = JSON.parse(await readFile(join(dependencies, 'node_modules/firebase-tools/lib/emulator/downloadableEmulatorInfo.json'), 'utf8')).firestore;
const jarBytes = await readFile(jar);
assert.equal(jarBytes.length, info.expectedSize, 'Official emulator size');
assert.equal(createHash('sha256').update(jarBytes).digest('hex'), info.expectedChecksumSHA256, 'Official emulator SHA256');
const artifacts = process.env.FATTAL_TEST_ARTIFACTS ? resolve(process.env.FATTAL_TEST_ARTIFACTS)
  : await mkdtemp(join(tmpdir(), 'fattal-emulator-evidence-'));
await mkdir(artifacts, { recursive: true, mode: 0o700 });
const env = { PATH: `${dirname(process.execPath)}:/usr/bin:/bin`, LANG: 'C.UTF-8', TMPDIR: tmpdir() };
async function run(command, args, childEnv = env) {
  const child = spawn(command, args, { cwd: root, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const [code] = await once(child, 'exit');
  assert.equal(code, 0, output);
  return output;
}
const javaVersion = await run('java', ['-version']);
assert.match(javaVersion, /version "(?:2[1-9]|[3-9]\d)\./, 'Java 21 or newer required');
await run(process.execPath, ['scripts/build-fattal-cloud-cli.mjs']);
const portProbe = createServer();
portProbe.listen(0, '127.0.0.1');
await once(portProbe, 'listening');
const port = portProbe.address().port;
await new Promise(resolveClose => portProbe.close(resolveClose));
const projectId = 'demo-fattal-acceptance';
const rules = join(artifacts, 'deny-all.rules');
await writeFile(rules, "rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if false; } } }\n");
const emulator = spawn('java', ['-jar', resolve(jar), '--host', '127.0.0.1', '--port', String(port),
  '--project_id', projectId, '--single_project_mode', '--single_project_mode_error', '--rules', rules],
{ cwd: artifacts, env, stdio: ['ignore', 'pipe', 'pipe'] });
let emulatorLog = '';
emulator.stdout.on('data', b => { emulatorLog += b; });
emulator.stderr.on('data', b => { emulatorLog += b; });
const emulatorExit = once(emulator, 'exit');
let outcome = 'failed';
try {
  const deadline = Date.now() + 30000;
  while (!emulatorLog.includes('Dev App Server is now running')) {
    assert.equal(emulator.exitCode, null, emulatorLog);
    assert.ok(Date.now() < deadline, `Emulator startup timed out: ${emulatorLog}`);
    await new Promise(resolveWait => setTimeout(resolveWait, 100));
  }
  console.log(`Verified emulator ${info.version} running on loopback; project ${projectId}.`);
  const childEnv = { ...env, FIRESTORE_EMULATOR_HOST: `127.0.0.1:${port}`,
    FATTAL_TEST_DEPENDENCY_ROOT: dependencies, FATTAL_TEST_ARTIFACTS: artifacts };
  const child = spawn(process.execPath, ['--test', '--test-concurrency=1', '--test-reporter=tap',
    'scripts/tests/fattal-cloud.emulator.mjs'], { cwd: root, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', b => { output += b; process.stdout.write(b); });
  child.stderr.on('data', b => { output += b; process.stderr.write(b); });
  const [code] = await once(child, 'exit');
  await writeFile(join(artifacts, 'acceptance.tap'), output);
  outcome = code === 0 ? 'passed' : 'failed';
  process.exitCode = code || 0;
} finally {
  if (emulator.exitCode === null) emulator.kill('SIGTERM');
  await Promise.race([emulatorExit, new Promise(resolveWait => {
    const timer = setTimeout(() => { if (emulator.exitCode === null) emulator.kill('SIGKILL'); resolveWait(); }, 5000);
    timer.unref();
  })]);
  await writeFile(join(artifacts, 'emulator.log'), emulatorLog);
  await writeFile(join(artifacts, 'environment.json'), JSON.stringify({ outcome, projectId,
    host: '127.0.0.1', emulatorVersion: info.version, expectedSHA256: info.expectedChecksumSHA256,
    javaVersion: javaVersion.trim(), inheritedCredentials: false, productionCalls: 0,
    limitations: ['No actual environment remount', 'No real R2 or S3 adapter acceptance', 'Next server and TLS replaced by test transport'] }, null, 2) + '\n');
  console.log(`Acceptance evidence: ${artifacts}`);
}
