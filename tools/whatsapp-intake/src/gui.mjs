// Native application bridge. No local HTTP server, credentials in argv or shell interpolation.
import {nextCheck, statusLabels} from './activity.mjs';
import path from 'node:path';
import { realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
import { createHash } from 'node:crypto';
import { localFileId } from './intake-client.mjs';
import { mkdir, readFile } from 'node:fs/promises';
import { install, importConnection, enableUpdates, disableSchedule } from './macos.mjs';
import { readJson, writeJson, acquireLock } from './storage.mjs';
const base = path.join(homedir(), 'Library/Application Support/TheQContentIntake');
export async function guiStatus(dataDir = base) {
  const config = await readJson(path.join(dataDir, 'config.json'), null);
  if (!config) return { installed: false, connected: false, paired: false, enabled: false, previewReady: false, rows: [], downloadDirectory: null };
  const runtime = path.join(dataDir, config.id);
  const [credentials, account, state, preview, pending, sync, collection] = await Promise.all([
    readJson(path.join(runtime, 'credentials.json'), {}), readJson(path.join(runtime, 'account.json'), null),
    readJson(path.join(runtime, 'status.json'), {}), readJson(path.join(runtime, 'last-preview.json'), null),
    readJson(path.join(runtime, 'pending.json'), null), readJson(path.join(runtime, 'schedule-sync.json'), null), readJson(path.join(runtime, 'last-collection.json'), null),
  ]);
  const previewStale = ['collecting', 'no_files', 'attention_required', 'upgrade_needs_preview', 'connection_imported', 'assignment_changed'].includes(state.state)
    || (collection?.scannedAt && (!preview?.generatedAt || Date.parse(collection.scannedAt) > Date.parse(preview.generatedAt)));
  const rows = (previewStale ? [] : preview?.matches || []).map(m => ({ id: m.file?.id || m.file?.name, filename: m.file?.name || m.filename || '', title: m.target?.title || 'לא זוהתה חוויה', status: m.status, receivedAt: m.file?.receivedAt || '', reason: m.file?.evidence?.length ? (m.reasons || []).filter(v => /[א-ת]/.test(v)).join('; ') : 'לפי שם הקובץ', warnings: m.warnings || [] }));
  const attempts = await readJson(path.join(runtime, 'attempts.json'), []);
  const lastAttempt = [...attempts].reverse().find(a => !['disabled','not_due','synced'].includes(a.outcome));
  const delivery = await readJson(path.join(runtime, 'delivery-status.json'), {});
  const lastCheck = await readJson(path.join(runtime, 'last-check.json'), null);
  const lastUpdate = await readJson(path.join(runtime, 'last-update.json'), null);
  const history = await readJson(path.join(runtime, 'schedule.json'), {completed:[]});
  const activation = await readJson(path.join(runtime, 'activation.json'), null);
  const fresh = Number.isFinite(Date.parse(state.at)) && Date.now() - Date.parse(state.at) < 12 * 3600000;
  return { installed: true, runnerVersion: (await readJson(path.join(dataDir, 'app/package.json'), {})).version || null, id: config.id, groupName: config.groupName, ownerEmail: config.ownerEmail,
    connected: !!credentials.contentIntakeApiKey, paired: !!account, enabled: config.schedule.enabled === true,
    nextCheck: nextCheck(config, new Date(), history.completed), lastCheckAt:lastCheck?.at, lastUpdateAt:lastUpdate?.at,
    lastOutcome:lastAttempt ? statusLabels[lastAttempt.outcome] || lastAttempt.outcome : null, lastError:state.code || '',
    deliveryOutstanding:delivery.outstanding || 0, activationReason:activation?.reason || null,
    state: state.state || '', previewStale: !!previewStale, syncState: sync?.state || '', pending: !!pending,
    previewReady: fresh && !previewStale && ['preview_ready','completed','completed_with_issues','no_changes'].includes(state.state) && rows.length > 0 && rows.some(r => r.status === 'matched') && !pending,
    rows, targets: (previewStale ? [] : preview?.targets || []).map(t => ({id:t.codeId, title:t.title})), downloadDirectory: path.join(runtime, 'downloads'), configFile: path.join(dataDir, 'config.json') };
}
export async function saveAssignment(dataDir, fileId, targetCodeId) {
  const config = await readJson(path.join(dataDir, 'config.json'));
  const runtime = path.join(dataDir, config.id);
  const unlock = await acquireLock(runtime);
  try {
    if (await readJson(path.join(runtime, 'pending.json'), null)) throw Error('UNCONFIRMED_BATCH');
    const preview = await readJson(path.join(runtime, 'last-preview.json'));
    const collection = await readJson(path.join(runtime, 'last-collection.json'));
    const file = collection.files.find(f => localFileId(f) === fileId);
    if (!file || !preview.matches.some(m => m.file.id === fileId) || createHash('sha256').update(await readFile(file.path)).digest('hex') !== file.sha256) throw Error('FILE_CHANGED');
    const target = preview.targets?.find(t => t.codeId === targetCodeId);
    if (!target && !['exclude', 'clear'].includes(targetCodeId)) throw Error('TARGET_NOT_ALLOWED');
    const decisionsPath = path.join(runtime, 'assignments.json');
    const decisions = await readJson(decisionsPath, {});
    if (targetCodeId === 'clear') delete decisions[file.key];
    else decisions[file.key] = { messageId:file.messageId, sha256:file.sha256, at:new Date().toISOString(),
      ...(target ? {targetCodeId:target.codeId} : {exclude:true}), reason:target ? `בחירה מפורשת במחשב: ${target.title}` : 'השארת קובץ זה ללא עדכון' };
    await writeJson(decisionsPath, decisions);
    await writeJson(path.join(runtime, 'status.json'), {state:'assignment_changed', at:new Date().toISOString()});
  } finally { await unlock(); }
}
export async function exportReview(dataDir = base) {
  const config = await readJson(path.join(dataDir, 'config.json'));
  const runtime = path.join(dataDir, config.id);
  const [preview, observations, collection, status, pending, installed] = await Promise.all([
    readJson(path.join(runtime, 'last-preview.json'), null), readJson(path.join(runtime, 'last-message-evidence.json'), []),
    readJson(path.join(runtime, 'last-collection.json'), null), readJson(path.join(runtime, 'status.json'), {}),
    readJson(path.join(runtime, 'pending.json'), null), readJson(path.join(dataDir, 'app/package.json'), {}),
  ]);
  return { exportedAt:new Date().toISOString(), runnerVersion:installed.version || null,
    state:status.state, stateAt:status.at, errorCode:status.code, pending:!!pending,
    previewGeneratedAt:preview?.generatedAt, batchProtocolVersion:preview?.batchProtocolVersion,
    assignmentProtocolVersion:preview?.assignmentProtocolVersion, targetCount:preview?.targets?.length || 0,
    previewStale:(await guiStatus(dataDir)).previewStale,
    schedule:{enabled:config.schedule.enabled, checks:config.schedule.checks, weekdays:config.schedule.weekdays, times:config.schedule.times, revision:config.schedule.revision},
    scheduleSync:await readJson(path.join(runtime, 'schedule-sync.json'), null),
    attempts:(await readJson(path.join(runtime, 'attempts.json'), [])).slice(-100),
    pendingDetails:pending ? {batchPreviewRunId:pending.batchPreviewRunId, startedAt:pending.startedAt, slot:pending.slot} : null,
    lastReport:await readJson(path.join(runtime, 'last-report.json'), null),
    delivery:await readJson(path.join(runtime, 'delivery-queue.json'), null),
    activation:await readJson(path.join(runtime, 'activation.json'), null),
    scan:await readJson(path.join(runtime, 'last-scan.json'), null),
    collection:collection ? {scannedAt:collection.scannedAt, since:collection.since, complete:collection.complete,
      files:collection.files.map(f => ({id:localFileId(f), name:f.name, size:f.size, sha256:f.sha256, receivedAt:f.receivedAt, sourceMessageId:f.messageId}))} : null,
    matches:(preview?.matches || []).map(m => ({file:m.file,target:m.target ? {title:m.target.title,shortId:m.target.shortId}:null,status:m.status,reasons:m.reasons,warnings:m.warnings})), observations };
}
async function main() {
  const action = process.argv[2];
  if (action === 'assign') { await saveAssignment(base, process.argv[3], process.argv[4]); return; }
  if (action === 'export-review') {
    if (!process.argv[3]) throw Error('EXPORT_PATH_REQUIRED');
    await writeJson(process.argv[3], await exportReview(base));
    return;
  }
  if (action === 'status') { console.log(JSON.stringify(await guiStatus())); return; }
  if (action === 'import') { if (!process.argv[3]) throw Error('CONNECTION_FILE_REQUIRED'); await importConnection(process.argv[3]); return; }
  const recordActivation = async reason => {
    const config = await readJson(path.join(base,'config.json'));
    await writeJson(path.join(base,config.id,'activation.json'), {reason, at:new Date().toISOString()});
  };
  if (action === 'disable') { await disableSchedule(); await recordActivation('paused'); return; }
  if (action === 'enable') {
    if (!(await guiStatus()).previewReady) throw Error('PREVIEW_REQUIRED');
    await enableUpdates(); await recordActivation('enabled'); return;
  }
  if (action === 'install') {
    const installUnlock = await acquireLock(path.join(base, 'setup'));
    try {
    const before = await readJson(path.join(base, 'config.json'), null);
    const previousVersion = (await readJson(path.join(base, 'app/package.json'), {})).version;
    const unlock = before ? await acquireLock(path.join(base, before.id)) : () => {};
    try {
      if (before && previousVersion !== '0.8.1') {
        await writeJson(path.join(base,before.id,'activation.json'), {reason:'upgrade', wasEnabled:before.schedule.enabled === true, at:new Date().toISOString()});
        await disableSchedule();
      }
      await install({ bundledDependencies: true, openCommands: false });
      if (before && previousVersion !== '0.8.1') await writeJson(path.join(base, before.id, 'status.json'), {state:'upgrade_needs_preview', at:new Date().toISOString()});
    }
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
