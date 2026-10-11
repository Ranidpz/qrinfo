import { constants } from 'node:fs';
import { lstat, open, realpath, rename, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { canonical, isHash, manifestId, type CloudManifest } from './cloud-policy';

export interface UploadAttempt { manifest: CloudManifest; status: 'pending' | 'verified' | 'superseded' }
interface Journal { protocol: 1; binding: string; attempts: Record<string, UploadAttempt> }
export class UploadError extends Error {
  constructor(public code: 'disabled' | 'configuration' | 'input' | 'credential' | 'transport' | 'response' | 'state' | 'pending') {
    super(`Fattal cloud uploader: ${code}`);
  }
}
export function insist(value: unknown, code: UploadError['code']): asserts value { if (!value) throw new UploadError(code); }
async function privateDirectory(directory: string) {
  insist(await realpath(directory) === resolve(directory), 'state');
  const info = await lstat(directory);
  insist(info.isDirectory() && !info.isSymbolicLink() && (info.mode & 0o077) === 0
    && (process.getuid === undefined || info.uid === process.getuid()), 'state');
}
async function readPrivateFile(path: string, maximum: number) {
  const input = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await input.stat();
    insist(stat.isFile() && stat.size <= maximum && (stat.mode & 0o077) === 0
      && (process.getuid === undefined || stat.uid === process.getuid()), 'state');
    const bytes = Buffer.alloc(maximum + 1);
    let size = 0;
    while (size < bytes.length) {
      const result = await input.read(bytes, size, bytes.length - size, null);
      if (!result.bytesRead) break;
      size += result.bytesRead;
    }
    insist(size <= maximum, 'state');
    return bytes.subarray(0, size).toString('utf8');
  } finally { await input.close(); }
}
async function readJournal(directory: string, binding: string): Promise<Journal> {
  insist((await readPrivateFile(join(directory, 'uploader.identity'), 256)) === `${binding}\n`, 'state');
  const journal = JSON.parse(await readPrivateFile(join(directory, 'uploader.json'), 16 * 1024 * 1024)) as Journal;
  insist(journal.protocol === 1 && journal.binding === binding && journal.attempts && typeof journal.attempts === 'object'
    && !Array.isArray(journal.attempts), 'state');
  for (const [id, attempt] of Object.entries(journal.attempts)) {
    insist(isHash(id) && attempt?.manifest && manifestId(attempt.manifest) === id
      && ['pending', 'verified', 'superseded'].includes(attempt.status), 'state');
  }
  insist(!/tq_(?:fc|ci)_/i.test(canonical(journal)), 'state');
  return journal;
}
// Atomic journal replacement permits read-only inspection even with a stale lock.
// This returns a historical local snapshot, never proof of current server state.
export async function inspectUploadJournal(directory: string, binding: string) {
  try {
    await privateDirectory(directory);
    const journal = await readJournal(directory, binding);
    let lockPresent = false;
    try { await lstat(join(directory, 'uploader.lock')); lockPresent = true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    return { journal, lockPresent };
  } catch { throw new UploadError('state'); }
}
// Requires one private persistent POSIX volume shared by every invocation. No stale
// lock takeover: after a crash an administrator must first prove the caller stopped.
export async function withUploadJournal<T>(directory: string, binding: string,
  action: (journal: Journal, save: () => Promise<void>) => Promise<T>, initialize = false): Promise<T> {
  const lock = join(directory, 'uploader.lock'), path = join(directory, 'uploader.json');
  let acquired = false;
  let directoryHandle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    await privateDirectory(directory);
    directoryHandle = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    const handle = await open(lock, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    acquired = true;
    try { await handle.writeFile('Exclusive uploader lock. Never remove while an invocation may be running.\n'); await handle.sync(); }
    finally { await handle.close(); }
    await directoryHandle.sync();
    let journal: Journal;
    if (initialize) {
      // Never recreate a missing journal on an already initialized volume.
      // A crash after this identity is saved remains fail-closed, not an empty queue.
      try { await lstat(path); throw new UploadError('state'); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      const identity = await open(join(directory, 'uploader.identity'), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try { await identity.writeFile(`${binding}\n`); await identity.sync(); } finally { await identity.close(); }
      await directoryHandle.sync();
      journal = { protocol: 1, binding, attempts: {} };
    } else {
      journal = await readJournal(directory, binding);
    }
    async function save() {
      const text = canonical(journal);
      insist(Buffer.byteLength(text) <= 16 * 1024 * 1024 && !/tq_(?:fc|ci)_/i.test(text), 'state');
      const temp = join(directory, `.uploader-${randomUUID()}.tmp`);
      const output = await open(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try { await output.writeFile(text); await output.sync(); } finally { await output.close(); }
      await rename(temp, path);
      await directoryHandle!.sync();
    }
    if (initialize) await save();
    return await action(journal, save);
  } catch (error) {
    if (error instanceof UploadError) throw error;
    throw new UploadError('state');
  } finally {
    if (acquired) {
      try { await unlink(lock); await directoryHandle?.sync(); }
      catch { /* A leftover lock safely blocks subsequent mutations. */ }
    }
    await directoryHandle?.close();
  }
}
