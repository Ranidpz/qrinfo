import {enableWake,disableWake} from './power.mjs';
import { mkdir, writeFile, cp, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { realpathSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.mjs';
import { acquireLock, readJson, writeJson } from './storage.mjs';
const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const xml = (text) => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export function buildLaunchAgent({ nodePath, appDir, dataDir, configPath, browserPath, label }) {
  const args = [nodePath, path.join(appDir, 'src/cli.mjs'), 'schedule', '--config', configPath, '--data', dataDir];
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${xml(label)}</string>
<key>ProgramArguments</key><array>${args.map((arg) => `<string>${xml(arg)}</string>`).join('')}</array>
<key>WorkingDirectory</key><string>${xml(appDir)}</string>
<key>EnvironmentVariables</key><dict><key>PLAYWRIGHT_BROWSERS_PATH</key><string>${xml(browserPath)}</string></dict>
<key>StartInterval</key><integer>300</integer>
<key>RunAtLoad</key><true/>
<key>StandardOutPath</key><string>${xml(path.join(dataDir, 'scheduler.log'))}</string>
<key>StandardErrorPath</key><string>${xml(path.join(dataDir, 'scheduler-error.log'))}</string>
</dict></plist>\n`;
}
export async function install({ activate = false, configFile, bundledDependencies = false, openCommands = true } = {}) {
  if (process.platform !== 'darwin') throw new Error('macOS required');
  const dataDir = path.join(homedir(), 'Library/Application Support/TheQContentIntake');
  const appDir = path.join(dataDir, 'app');
  const browserPath = path.join(homedir(), 'Library/Caches/theq-playwright');
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  if (root !== appDir) {
    await mkdir(appDir, { recursive: true, mode: 0o700 });
    for (const name of ['src', 'config', 'package.json', 'package-lock.json', 'README_HE.md']) await cp(path.join(root, name), path.join(appDir, name), { recursive: true });
  }
  const configPath = path.join(dataDir, 'config.json');
  if (!(await readJson(configPath, null))) {
    const value = await readJson(configFile || path.join(root, 'config/fattal.example.json'));
    value.id = `mac-${randomUUID()}`;
    value.autoCommit = false;
    value.schedule.enabled = false;
    await writeJson(configPath, value);
  }
  const config = await readJson(configPath);
  const runtime = path.join(dataDir, config.id);
  await mkdir(runtime, { recursive: true, mode: 0o700 });
  const credentials = path.join(runtime, 'credentials.json');
  if (!(await readJson(credentials, null))) await writeJson(credentials, { contentIntakeApiKey: '' });
  const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browserPath };
  console.log('Installing pinned dependencies and dedicated browser...');
  if (bundledDependencies) {
    if (root !== appDir) await cp(path.join(root, 'node_modules'), path.join(appDir, 'node_modules'), { recursive: true });
  } else await exec('npm', ['ci', '--omit=dev', '--ignore-scripts'], { cwd: appDir, env, maxBuffer: 5e6 });
  await exec(process.execPath, [path.join(appDir, 'node_modules/playwright/cli.js'), 'install', 'chromium'], { cwd: appDir, env, maxBuffer: 5e6 });
  const label = `app.theq.whatsapp-intake.${config.id}`;
  const agents = path.join(homedir(), 'Library/LaunchAgents');
  await mkdir(agents, { recursive: true });
  const plist = path.join(agents, `${label}.plist`);
  await writeFile(plist, buildLaunchAgent({ nodePath: process.execPath, appDir, dataDir, configPath, browserPath, label }), { mode: 0o600 });
  const launcherDir = path.join(dataDir, 'Commands');
  await mkdir(launcherDir, { recursive: true });
  for (const [name, command, extra] of [['Connect', 'connect', ''], ['Collect', 'collect', ''], ['Preview', 'run', ''], ['Update', 'run', '--commit'], ['Status', 'doctor', ''], ['ResumeReport', 'resume', ''], ['UnlockAfterCrash', 'unlock', ''], ['ConfirmBusinessAccount', 'confirm', '--confirm-business'], ['SetApiKey', 'credentials', '--key-stdin']]) {
    const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
    const filename = path.join(launcherDir, `${name}.command`);
    const prompt = command === 'confirm' ? `read 'reply?Confirm this is the BUSINESS account and Fattal group (yes/no): '\n[[ "$reply" == yes ]] || exit 1\n` : '';
    const keyRead = command === 'credentials' ? `read -rs 'intake_key?Paste the intake API key (hidden): '\nprint\nprint -rn -- "$intake_key" | ` : '';
    await writeFile(filename, `#!/bin/zsh\nexport PLAYWRIGHT_BROWSERS_PATH=${quote(browserPath)}\n${prompt}${keyRead}${quote(process.execPath)} ${quote(path.join(appDir, 'src/cli.mjs'))} ${command} --config ${quote(configPath)} --data ${quote(dataDir)} ${extra}\nresult=$?\nunset intake_key\nprint "Exit status: $result"\nread '?Press Enter to close...'\nexit $result\n`, { mode: 0o700 });
    await chmod(filename, 0o700);
  }
  const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
  for (const [name, flag] of [['ImportConnection', '--import-connection'], ['EnableUpdates', '--enable-updates'], ['DisableSchedule', '--disable']]) {
    const prompt = flag === '--enable-updates' ? "read 'reply?Enable automatic PDF replacement and WhatsApp group reports (yes/no): '\n[[ \"$reply\" == yes ]] || exit 1\n" : '';
    await writeFile(path.join(launcherDir, `${name}.command`), `#!/bin/zsh\n${prompt}${quote(process.execPath)} ${quote(path.join(appDir, 'src/macos.mjs'))} ${flag}\nresult=$?\nread '?Press Enter to close...'\nexit $result\n`, { mode: 0o700 });
  }
  const connectionFile = path.join(root, 'TheQ-connection.json');
  if (await readJson(connectionFile, null)) {
    const existing = await readJson(credentials, null);
    if (!existing?.contentIntakeApiKey) await importConnection(connectionFile);
    else console.log('Existing key preserved. Use ImportConnection.command to change it.');
  }
  if (activate) {
    const current = await readJson(configPath);
    current.schedule.enabled = true;
    await writeJson(configPath, current);
    await exec('/bin/launchctl', ['bootout', `gui/${process.getuid()}`, plist]).catch(() => {});
    await exec('/bin/launchctl', ['bootstrap', `gui/${process.getuid()}`, plist]);
  }
  if (openCommands) await exec('/usr/bin/open', [launcherDir]);
  console.log(JSON.stringify({ installed: true, scheduled: activate, configPath, credentials, launcherDir, plist, mode: config.autoCommit ? 'commit' : 'preview' }, null, 2));
}
export async function disableSchedule() {
  const dataDir = path.join(homedir(), 'Library/Application Support/TheQContentIntake');
  const file = path.join(dataDir, 'config.json');
  const config = await readJson(file);
  config.schedule.enabled = false;
  await writeJson(file, config);
  await exec('/bin/launchctl', ['bootout', `gui/${process.getuid()}/app.theq.whatsapp-intake.${config.id}`]).catch(() => {});
  await disableWake(config.id);
  console.log('Schedule disabled. Saved business login preserved.');
}
export async function importConnection(file) {
  const dataDir = path.join(homedir(), 'Library/Application Support/TheQContentIntake');
  if (!file) {
    const result = await exec('/usr/bin/osascript', ['-e', 'POSIX path of (choose file with prompt "Select TheQ-connection.json")']);
    file = result.stdout.trim();
  }
  const connection = await readJson(file);
  if (connection.schemaVersion !== 1 || !/^tq_ci_[a-f0-9]{32}\.[a-f0-9]{64}$/.test(connection.contentIntakeApiKey || '') || typeof connection.ownerEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(connection.ownerEmail)) throw new Error('INVALID_CONNECTION_FILE');
  const configPath = path.join(dataDir, 'config.json');
  const config = await readJson(configPath);
  const release = await acquireLock(path.join(dataDir, config.id));
  try {
  if (await readJson(path.join(dataDir, config.id, 'pending.json'), null)) throw new Error('RESOLVE_PENDING_BATCH_FIRST');
  // Stop scheduling before changing the owner/key; preserve the dedicated login.
  await disableSchedule();
  config.ownerEmail = connection.ownerEmail;
  config.autoCommit = false;
  config.schedule.enabled = false;
  await writeJson(configPath, config);
  await writeJson(path.join(dataDir, config.id, 'credentials.json'), { contentIntakeApiKey: connection.contentIntakeApiKey });
  // A preview made with the previous owner/key must never enable the new connection.
  await writeJson(path.join(dataDir, config.id, 'status.json'), { state: 'connection_imported', at: new Date().toISOString() });
  console.log('Connection imported. Run Preview before enabling updates.');
  } finally { await release(); }
}
export async function enableUpdates() {
  const dataDir = path.join(homedir(), 'Library/Application Support/TheQContentIntake');
  const file = path.join(dataDir, 'config.json');
  const config = await loadConfig(file, dataDir);
  const { requirePairedProfile } = await import('./browser.mjs');
  await requirePairedProfile(config);
  const credentials = await readJson(path.join(config.runtimeDir, 'credentials.json'));
  if (!credentials.contentIntakeApiKey) throw new Error('API_KEY_REQUIRED');
  const response = await fetch(`${config.apiBaseUrl}${config.workflowPath}/health`, { headers: { 'x-content-intake-key': credentials.contentIntakeApiKey }, redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (!response.ok || !(await response.json()).ready) throw new Error('API_HEALTH_CHECK_FAILED');
  const stored = await readJson(file);
  await enableWake(config.id);
  try {
  stored.autoCommit = true;
  stored.sendGroupReports = true;
  stored.schedule.enabled = true;
  await writeJson(file, stored);
  const plist = path.join(homedir(), 'Library/LaunchAgents', `app.theq.whatsapp-intake.${config.id}.plist`);
  await exec('/bin/launchctl', ['bootout', `gui/${process.getuid()}`, plist]).catch(() => {});
  await exec('/bin/launchctl', ['bootstrap', `gui/${process.getuid()}`, plist]);
  } catch (error) {
    await disableWake(config.id);
    stored.schedule.enabled = false; await writeJson(file, stored); throw error;
  }
  console.log('Automatic updates and group reports enabled.');
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  (process.argv.includes('--disable') ? disableSchedule() : process.argv.includes('--import-connection') ? importConnection() : process.argv.includes('--enable-updates') ? enableUpdates() : install({ activate: process.argv.includes('--activate') })).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
