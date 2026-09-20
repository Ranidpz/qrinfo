import { mkdir, readFile, writeFile, rename, chmod, open, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return fallback; throw error; }
}
export async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${randomBytes(6).toString('hex')}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temp, file);
  await chmod(file, 0o600);
}
export async function acquireLock(dir) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, 'runner.lock');
  let handle;
  try { handle = await open(file, 'wx', 0o600); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error(`RUN_LOCKED: another run or an interrupted run owns ${file}. Use doctor; do not start a second browser.`);
    throw error;
  }
  await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  await handle.close();
  return () => rm(file, { force: true });
}
export function safeFilename(name) {
  const value = name.normalize('NFC').replace(/[\x00-\x1f\x7f/\\:]/g, '_').replace(/^\.+/, '').trim();
  if (!value || !value.toLowerCase().endsWith('.pdf')) throw new Error('INVALID_PDF_NAME');
  return value.slice(0, 180).replace(/\.pdf$/i, '') + '.pdf';
}
