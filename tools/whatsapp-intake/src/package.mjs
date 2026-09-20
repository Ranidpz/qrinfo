import { mkdir, cp, rm, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version;
const dist = path.join(root, 'dist');
const name = `TheQ-WhatsApp-Intake-${version}`;
const stage = path.join(dist, name);
await mkdir(dist, { recursive: true });
await rm(stage, { recursive: true, force: true });
await mkdir(stage);
// Explicit allowlist: never copy browser profiles, downloads, credentials, or node_modules.
for (const entry of ['src', 'config', 'test', 'package.json', 'package-lock.json', 'Install.command', 'README_HE.md']) {
  await cp(path.join(root, entry), path.join(stage, entry), { recursive: true });
}
const archive = path.join(dist, `${name}.zip`);
await rm(archive, { force: true });
await exec('/usr/bin/zip', ['-qr', archive, name], { cwd: dist });
const hash = createHash('sha256').update(await readFile(archive)).digest('hex');
await writeFile(`${archive}.sha256`, `${hash}  ${path.basename(archive)}\n`);
console.log(JSON.stringify({ archive, sha256: hash }, null, 2));
