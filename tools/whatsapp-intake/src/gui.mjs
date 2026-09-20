// Native application bridge. No local HTTP server, credentials in argv or shell interpolation.
import path from 'node:path';
import { realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
import { mkdir } from 'node:fs/promises';
import { install, importConnection, enableUpdates, disableSchedule } from './macos.mjs';
import { readJson, acquireLock } from './storage.mjs';
const base = path.join(homedir(), 'Library/Application Support/TheQContentIntake');
export async function guiStatus(dataDir = base) {
  const config = await readJson(path.join(dataDir, 'config.json'), null);
  if (!config) return { installed: false, connected: false, paired: false, enabled: false, previewReady: false, rows: [], downloadDirectory: null };
  const runtime = path.join(dataDir, config.id);
  const [credentials, account, state, preview, pending, sync] = await Promise.all([
    readJson(path.join(runtime, 'credentials.json'), {}), readJson(path.join(runtime, 'account.json'), null),
    readJson(path.join(runtime, 'status.json'), {}), readJson(path.join(runtime, 'last-preview.json'), null),
    readJson(path.join(runtime, 'pending.json'), null), readJson(path.join(runtime, 'schedule-sync.json'), null),
  ]);
  const rows = (preview?.matches || []).map(m => ({ filename: m.file?.name || m.filename || '', title: m.target?.title || 'לא זוהתה חוברת', status: m.status }));
  const fresh = Number.isFinite(Date.parse(state.at)) && Date.now() - Date.parse(state.at) < 12 * 3600000;
  return { installed: true, runnerVersion: (await readJson(path.join(dataDir, 'app/package.json'), {})).version || null, id: config.id, groupName: config.groupName, ownerEmail: config.ownerEmail,
    connected: !!credentials.contentIntakeApiKey, paired: !!account, enabled: config.schedule.enabled === true,
    state: state.state || '', syncState: sync?.state || '', pending: !!pending,
    previewReady: fresh && state.state === 'preview_ready' && rows.length > 0 && rows.every(r => r.status === 'matched') && !pending,
    rows, downloadDirectory: path.join(runtime, 'downloads'), configFile: path.join(dataDir, 'config.json') };
}
async function main() {
  const action = process.argv[2];
  if (action === 'status') { console.log(JSON.stringify(await guiStatus())); return; }
  if (action === 'import') { if (!process.argv[3]) throw Error('CONNECTION_FILE_REQUIRED'); await importConnection(process.argv[3]); return; }
  if (action === 'disable') { await disableSchedule(); return; }
  if (action === 'enable') {
    if (!(await guiStatus()).previewReady) throw Error('PREVIEW_REQUIRED');
    await enableUpdates(); return;
  }
  if (action === 'install') {
    const installUnlock = await acquireLock(path.join(base, 'setup'));
    try {
    const before = await readJson(path.join(base, 'config.json'), null);
    const unlock = before ? await acquireLock(path.join(base, before.id)) : () => {};
    try { await install({ bundledDependencies: true, openCommands: false }); }
    finally { await unlock(); }
    const config = await readJson(path.join(base, 'config.json'));
    await mkdir(path.join(base, config.id, 'downloads'), { recursive: true, mode: 0o700 });
    if (before?.schedule?.enabled) {
      const plist = path.join(homedir(), 'Library/LaunchAgents', `app.theq.whatsapp-intake.${config.id}.plist`);
      await exec('/bin/launchctl', ['bootout', `gui/${process.getuid()}`, plist]).catch(() => {});
      await exec('/bin/launchctl', ['bootstrap', `gui/${process.getuid()}`, plist]);
    }
    return;
    } finally { await installUnlock(); }
  }
  throw Error('UNKNOWN_GUI_ACTION');
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
