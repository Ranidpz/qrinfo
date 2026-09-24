import { assignmentFingerprint, isExpectedReview } from './assignment.mjs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { collect as collectMessages } from './collector.mjs';
import { readJson, writeJson } from './storage.mjs';
import { slotDue } from './messages.mjs';
import { previewBatch, commitWithPayloadFallback, finalizeBatch, getBatchStatus, intakeHealth } from './intake-client.mjs';
import { cycleDay, hasNewFiles } from './group-report.mjs';
import { queueReport, queueEmptyReport, deliverQueued } from './delivery.mjs';
import { sendGroupUpdate as sendGroupMessage } from './group-sender.mjs';
import { syncSchedule as synchronizeSchedule } from './schedule-sync.mjs';
const exec = promisify(execFile);
export async function runCommand(command, config, options = {}, services = {}) {
  const collect = services.collect || collectMessages;
  const sendGroupUpdate = services.sendGroupUpdate || sendGroupMessage;
  const syncSchedule = services.syncSchedule || synchronizeSchedule;
  const statusPath = path.join(config.runtimeDir, 'status.json');
  const historyPath = path.join(config.runtimeDir, 'schedule.json');
  const pendingPath = path.join(config.runtimeDir, 'pending.json');
  const checkpointPath = path.join(config.runtimeDir, 'checkpoint.json');
  if (command === 'doctor') {
    const { stdout } = await exec('/usr/bin/pmset', ['-g', 'custom']);
    const account = await readJson(path.join(config.runtimeDir, 'account.json'), null);
    const credentials = await readJson(path.join(config.runtimeDir, 'credentials.json'), {});
    const key = process.env.CONTENT_INTAKE_API_KEY || credentials.contentIntakeApiKey;
    const api = key ? await intakeHealth({ baseUrl: config.apiBaseUrl, workflowPath: config.workflowPath, apiKey: key }).catch(() => ({ ready: false, error: 'API unavailable or unauthorized' })) : { ready: false, error: 'API key missing' };
    console.log(JSON.stringify({ node: process.version, profileConfirmed: !!account, runtime: config.runtimeDir, pending: !!(await readJson(pendingPath, null)), lock: await readJson(path.join(config.runtimeDir, 'runner.lock'), null), scheduleSync: await readJson(path.join(config.runtimeDir, 'schedule-sync.json'), null), schedule: config.schedule, autoCommit: config.autoCommit, api, powerSettings: stdout }, null, 2));
    return;
  }
  if (!['collect', 'run', 'schedule', 'resume', 'report-group', 'sync-config'].includes(command)) throw Error('UNKNOWN_COMMAND');
  const now = services.now ? services.now() : new Date();
  const day = cycleDay(now, config.timeZone);
  let checkpoint = await readJson(checkpointPath, null);
  const history = await readJson(historyPath, {completed:[]});
  const credentials = await readJson(path.join(config.runtimeDir, 'credentials.json'), {});
  const params = {baseUrl:config.apiBaseUrl, workflowPath:config.workflowPath, ownerEmail:config.ownerEmail,
    apiKey:process.env.CONTENT_INTAKE_API_KEY || credentials.contentIntakeApiKey, source:'whatsapp'};
  const attemptsPath = path.join(config.runtimeDir, 'attempts.json');
  const attempts = await readJson(attemptsPath, []);
  const attempt = {id:randomUUID(), command, mode:options.commit ? 'update_now' : command, startedAt:now.toISOString(), outcome:'running'};
  attempts.push(attempt);
  await writeJson(attemptsPath, attempts.slice(-1000));
  const finishSlot = async slot => {
    if (!slot) return;
    history.completed = [...new Set([...history.completed, slot])].slice(-100);
    await writeJson(historyPath, history);
  };
  const confirmData = async (report, pending) => {
    // Only server-derived confirmed results permit clearing an uncertain-write marker.
    if (report.runId !== pending.batchPreviewRunId || !isExpectedReview(report)
      || !Array.isArray(report.preview?.matches) || !report.preview.matches.length
      || report.results.length !== report.preview.matches.length
      || new Set(report.results.map(r => r.fileId)).size !== report.results.length
      || report.preview.matches.some(m => !report.results.some(r => r.fileId === m.file.id))
      || !Number.isFinite(Date.parse(report.preview.generatedAt))) throw Error('BATCH_NEEDS_REVIEW');
    await writeJson(path.join(config.runtimeDir, 'last-report.json'), report);
    const reportDay = cycleDay(new Date(report.preview.generatedAt), config.timeZone);
    await queueReport(config, report, {first:checkpoint?.day !== reportDay, now});
    checkpoint = {day:reportDay, fileKeys:pending.fileIds, runId:report.runId, dataConfirmed:true, at:now.toISOString()};
    await writeJson(checkpointPath, checkpoint);
    await finishSlot(pending.slot);
    await rm(pendingPath, {force:true});
    await writeJson(path.join(config.runtimeDir, 'last-update.json'), {at:now.toISOString(), runId:report.runId, summary:report.summary});
  };
  let inhibitor;
  try {
    if (['sync-config', 'schedule', 'run', 'resume', 'report-group'].includes(command)) await syncSchedule(config);
    if (command === 'sync-config') {attempt.outcome='synced';return;}
    if (command === 'schedule' && config.schedule.enabled !== true) {attempt.outcome='disabled';return;}
    const slot = command === 'schedule' ? slotDue(config, now, history.completed) : null;
    attempt.slot = slot;
    const doCommit = options.commit === true || (command === 'schedule' && config.autoCommit === true);
    const pending = await readJson(pendingPath, null);
    if (process.platform === 'darwin') {
      const {spawn} = await import('node:child_process');
      inhibitor = spawn('/usr/bin/caffeinate', ['-i','-w',String(process.pid)], {stdio:'ignore'});
    }
    if (pending && (doCommit || command === 'resume')) {
      await writeJson(statusPath, {state:'recovering', at:now.toISOString()});
      let report = await getBatchStatus({...params, batchPreviewRunId:pending.batchPreviewRunId});
      if (!report.batchFinalized) {
        if (report.activeCommits > 0) throw Error('BATCH_STILL_RUNNING');
        report = await finalizeBatch({...params, batchPreviewRunId:pending.batchPreviewRunId});
      }
      await confirmData(report, pending);
      await writeJson(statusPath, {state:'recovered', summary:report.summary, at:now.toISOString()});
    }
    if (['resume','report-group'].includes(command)) {
      await deliverQueued(config, params, sendGroupUpdate, {now, headed:options.headed, reconcileOnly:true});
      if (!pending) await writeJson(statusPath, {state:'recovered', at:now.toISOString()});
      attempt.outcome='recovered';return;
    }
    if (command === 'schedule' && !slot) {
      if (config.autoCommit) await deliverQueued(config, params, sendGroupUpdate, {now});
      attempt.outcome='not_due';return;
    }
    const since = options.since || new Date(now.getTime() - config.scanWindowHours * 3600000).toISOString();
    if (Date.parse(since) < now.getTime() - config.scanLookbackHours * 3600000 || Date.parse(since) > now.getTime()) throw Error('SCAN_START_OUTSIDE_ALLOWED_WINDOW');
    await writeJson(statusPath, {state:'collecting', since, at:now.toISOString()});
    const collection = await collect(config, {since, headed:options.headed});
    const files = collection.files;
    attempt.fileCount = files.length;
    await writeJson(path.join(config.runtimeDir, 'last-check.json'), {at:now.toISOString(), fileCount:files.length, slot});
    if (command === 'collect') {attempt.outcome='collected';await writeJson(statusPath, {state:'collected',fileCount:files.length,at:now.toISOString()});return;}
    if (!params.apiKey) throw Error('API_KEY_REQUIRED');
    if (doCommit && !hasNewFiles(files, checkpoint, day)) {
      await writeJson(statusPath, {state:'no_changes', fileCount:files.length, at:now.toISOString()});
      await finishSlot(slot);
      await deliverQueued(config, params, sendGroupUpdate, {now, headed:options.headed});
      attempt.outcome='no_changes';return;
    }
    if (!files.length) {
      await writeJson(statusPath, {state:'no_files', since, at:now.toISOString()});
      if (doCommit) {
        await queueEmptyReport(config, now);
        await writeJson(checkpointPath, {day, fileKeys:[], at:now.toISOString()});
        await finishSlot(slot);
        await deliverQueued(config, params, sendGroupUpdate, {now, headed:options.headed});
      }
      await notifyStatus(config, params, 'no_files');
      attempt.outcome='no_files';return;
    }
    const preview = await previewBatch({...params, files, receivedAt:now.toISOString()});
    await writeJson(path.join(config.runtimeDir, 'last-preview.json'), preview);
    if (!doCommit) {
      // A preview remains read-only even when a previous write is unresolved.
      await writeJson(statusPath, {state:'preview_ready', summary:preview.summary, at:now.toISOString()});
      attempt.outcome='preview_ready';return;
    }
    let activeBatch;
    const report = await commitWithPayloadFallback({...params, files, receivedAt:now.toISOString(),
      onBatchStarted:async batchPreviewRunId => {
        activeBatch = {batchPreviewRunId, startedAt:now.toISOString(), fileIds:files.map(assignmentFingerprint), slot};
        await writeJson(pendingPath, activeBatch);
      },
    });
    await confirmData(report, activeBatch);
    const state = report.summary.skipped ? 'completed_with_issues' : 'completed';
    await writeJson(statusPath, {state, summary:report.summary, runId:report.runId, at:now.toISOString()});
    await deliverQueued(config, params, sendGroupUpdate, {now, headed:options.headed});
    await notifyStatus(config, params, report.summary.skipped ? 'review_required' : 'ready');
    attempt.outcome = state;
  } catch (error) {
    const code = error.message.split(':')[0].slice(0,100);
    attempt.outcome='failed';attempt.errorCode=code;
    await writeJson(statusPath, {state:'attention_required', code, at:now.toISOString()});
    await notifyStatus(config, params, code.includes('LOGIN') ? 'login_required' : 'run_failed');
    throw error;
  } finally {
    inhibitor?.kill('SIGTERM');
    attempt.finishedAt = new Date().toISOString();
    await writeJson(attemptsPath, attempts.slice(-1000));
  }
}
async function notifyStatus(config, params, state) {
  if (!params.apiKey) return;
  try {
    const response = await fetch(`${config.apiBaseUrl}${config.workflowPath}/agent-status`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-content-intake-key': params.apiKey },
      body: JSON.stringify({ ownerEmail: config.ownerEmail, agentId: config.id, state }),
      redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Alert endpoint unavailable');
    await writeJson(path.join(config.runtimeDir, 'notification.json'), { state, accepted: true, at: new Date().toISOString() });
  } catch {
    await writeJson(path.join(config.runtimeDir, 'notification.json'), { state, accepted: false, at: new Date().toISOString() });
  }
}
