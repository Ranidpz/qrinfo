#!/usr/bin/env node
import { parseArgs } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { rm } from 'node:fs/promises';
import { loadConfig } from './config.mjs';
import { acquireLock, readJson, writeJson } from './storage.mjs';
import { openWhatsApp, waitForLogin, openGroup, confirmBusinessProfile } from './browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  config: { type: 'string', default: path.join(root, 'config', 'fattal.example.json') },
  data: { type: 'string', default: path.join(root, '.runtime') },
  headed: { type: 'boolean', default: false },
  'debug-port': { type: 'string' },
  'confirm-business': { type: 'boolean', default: false },
  'key-stdin': { type: 'boolean', default: false },
  commit: { type: 'boolean', default: false },
  'report-confirmed': { type: 'boolean', default: false },
  since: { type: 'string' },
  help: { type: 'boolean', default: false },
} });
const command = positionals[0] || 'help';
if (values.help || command === 'help') {
  console.log('The Q WhatsApp Intake\nCommands: connect, confirm, credentials, collect, run, schedule, sync-config, doctor, status, resume, report-group, unlock\nOptions: --config <file> --data <directory> --headed --commit --since <ISO>\nConfirm requires --confirm-business. Credentials requires --key-stdin. Default run is preview only.');
} else {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
async function main() {
  const config = await loadConfig(values.config, values.data);
  if (command === 'run' && values.commit && values['report-confirmed']) config.sendGroupReports = true;
  if (command === 'credentials') {
    if (!values['key-stdin']) throw new Error('Use --key-stdin; never pass secrets in command arguments');
    let key = '';
    for await (const chunk of process.stdin) { key += chunk; if (key.length > 4096) throw new Error('INVALID_KEY'); }
    key = key.trim();
    if (key.length < 16) throw new Error('INVALID_KEY');
    await writeJson(path.join(config.runtimeDir, 'credentials.json'), { contentIntakeApiKey: key });
    console.log('Integration key saved locally.');
    return;
  }
  if (command === 'doctor') {
    const { runCommand } = await import('./runner.mjs');
    await runCommand(command, config, values);
    return;
  }
  if (command === 'unlock') {
    const file = path.join(config.runtimeDir, 'runner.lock');
    const lock = await readJson(file, null);
    if (lock) {
      if (!Number.isInteger(lock.pid) || lock.pid < 1) throw new Error('INVALID_LOCK_NEEDS_REVIEW');
      try { process.kill(lock.pid, 0); throw new Error('RUN_STILL_ACTIVE'); }
      catch (error) { if (error.code !== 'ESRCH') throw error; }
      await rm(file);
    }
    console.log('No active run lock.'); return;
  }
  if (command === 'confirm') {
    if (!values['confirm-business']) throw new Error('Explicit business account confirmation required');
    await confirmBusinessProfile(config);
    console.log('Business profile confirmed.');
    return;
  }
  if (command === 'status') {
    console.log(JSON.stringify(await readJson(path.join(config.runtimeDir, 'status.json'), { state: 'not_started' }), null, 2));
    return;
  }
  const unlock = await acquireLock(config.runtimeDir);
  let context;
  const stop = async () => { await context?.close().catch(() => {}); await unlock(); process.exit(0); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  try {
    if (command === 'connect') {
      const browser = await openWhatsApp(config, { headed: true, debugPort: values['debug-port'] });
      context = browser.context;
      console.log('Scan the QR code using the BUSINESS WhatsApp phone. This profile is separate from all existing WhatsApp apps.');
      await writeJson(path.join(config.runtimeDir, 'status.json'), { state: 'awaiting_login', at: new Date().toISOString() });
      await waitForLogin(browser.page, 15 * 60 * 1000);
      console.log('LOGIN_CONNECTED');
      await openGroup(browser.page, config);
      await writeJson(path.join(config.runtimeDir, 'status.json'), { state: 'connected_needs_confirmation', groupName: config.groupName, at: new Date().toISOString() });
      console.log(`GROUP_FOUND: ${config.groupName}. Confirm the business account before collecting.`);
      while (context.pages().length) await sleep(1000);
    } else {
      const { runCommand } = await import('./runner.mjs');
      await runCommand(command, config, values);
    }
  } finally { await context?.close().catch(() => {}); await unlock(); }
}
