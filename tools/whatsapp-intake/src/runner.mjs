import path from 'node:path';
import { rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { collect } from './collector.mjs';
import { readJson, writeJson } from './storage.mjs';
import { slotDue } from './messages.mjs';
import { previewBatch, commitWithPayloadFallback, finalizeBatch } from './intake-client.mjs';
import { cycleDay, hasNewFiles, buildGroupUpdate } from './group-report.mjs';
import { sendGroupUpdate } from './group-sender.mjs';

const exec = promisify(execFile);
export async function runCommand(command, config, options) {
  const statusPath = path.join(config.runtimeDir, 'status.json');
  const historyPath = path.join(config.runtimeDir, 'schedule.json');
  const pendingPath = path.join(config.runtimeDir, 'pending.json');
  const checkpointPath = path.join(config.runtimeDir, 'checkpoint.json');
  const history = await readJson(historyPath, { completed: [] });
  const now = new Date();
  const day = cycleDay(now, config.timeZone);
  const checkpoint = await readJson(checkpointPath, null);
  const finishSlot = async () => {
    if (slot) { history.completed.push(slot); await writeJson(historyPath, { completed: [...new Set(history.completed)].slice(-60) }); }
  };
  if (command === 'schedule' && config.schedule.enabled !== true) return;
  const slot = command === 'schedule' ? slotDue(config, now, history.completed) : null;
  if (command === 'schedule' && !slot) return;
  if (command === 'doctor') {
    const { stdout } = await exec('/usr/bin/pmset', ['-g', 'custom']);
    const account = await readJson(path.join(config.runtimeDir, 'account.json'), null);
    console.log(JSON.stringify({ node: process.version, profileConfirmed: !!account, runtime: config.runtimeDir, pending: !!(await readJson(pendingPath, null)), lock: await readJson(path.join(config.runtimeDir, 'runner.lock'), null), powerSettings: stdout }, null, 2));
    return;
  }
  if (!['collect', 'run', 'schedule', 'resume', 'report-group'].includes(command)) throw new Error('UNKNOWN_COMMAND');
  const credentials = await readJson(path.join(config.runtimeDir, 'credentials.json'), {});
  const params = { baseUrl: config.apiBaseUrl, workflowPath: config.workflowPath, ownerEmail: config.ownerEmail,
    apiKey: process.env.CONTENT_INTAKE_API_KEY || credentials.contentIntakeApiKey, source: 'whatsapp' };
  let inhibitor;
  if (process.platform === 'darwin') {
    const { spawn } = await import('node:child_process');
    inhibitor = spawn('/usr/bin/caffeinate', ['-i', '-w', String(process.pid)], { stdio: 'ignore' });
  }
  try {
    const deliver = async (report, keys) => {
      const first = checkpoint?.day !== day || !checkpoint?.initialNoticeSent;
      let message = await readJson(path.join(config.runtimeDir, 'group-report.json'), null);
      if (!message || message.id !== report.runId) {
        message = { id: report.runId, text: buildGroupUpdate(report, { first, now, timeZone: config.timeZone }) };
        await writeJson(path.join(config.runtimeDir, 'group-report.json'), message);
      }
      const shouldSend = first || report.summary.updated > 0;
      if (shouldSend) await sendGroupUpdate(config, { ...message, headed: options.headed });
      await writeJson(checkpointPath, { day, fileKeys: keys, runId: report.runId,
        initialNoticeSent: config.sendGroupReports === true && (shouldSend || checkpoint?.initialNoticeSent), at: new Date().toISOString() });
    };
    if (command === 'report-group') {
      const report = await readJson(path.join(config.runtimeDir, 'last-report.json'));
      if (cycleDay(new Date(report.preview.generatedAt), config.timeZone) !== day) throw new Error('STALE_GROUP_REPORT');
      if (report.summary.failed || report.summary.skipped) throw new Error('BATCH_NEEDS_REVIEW');
      const collection = await readJson(path.join(config.runtimeDir, 'last-collection.json'));
      await deliver(report, collection.files.map(file => file.key));
      console.log('Group report reconciled.'); return;
    }
    const pending = await readJson(pendingPath, null);
    if (pending) {
      if (command !== 'resume') throw new Error(`UNCONFIRMED_BATCH: ${pending.batchPreviewRunId}. Use resume before starting another update.`);
      if (!params.apiKey) throw new Error('API_KEY_REQUIRED');
      const report = await finalizeBatch({ ...params, batchPreviewRunId: pending.batchPreviewRunId });
      await writeJson(path.join(config.runtimeDir, 'last-report.json'), report);
      if (report.summary.failed || report.summary.skipped || !report.reportEmail?.sent) throw new Error('BATCH_NEEDS_REVIEW: inspect last-report.json before explicitly resolving pending state');
      await deliver(report, pending.fileIds);
      await rm(pendingPath);
      console.log(JSON.stringify(report.summary));
      return;
    }
    if (command === 'resume') throw new Error('NO_PENDING_BATCH');
    const since = options.since || new Date(now.getTime() - config.scanWindowHours * 3600000).toISOString();
    if (Date.parse(since) < now.getTime() - config.scanLookbackHours * 3600000 || Date.parse(since) > now.getTime()) throw new Error('SCAN_START_OUTSIDE_ALLOWED_WINDOW');
    await writeJson(statusPath, { state: 'collecting', since, at: now.toISOString() });
    const collection = await collect(config, { since, headed: options.headed });
    if (command === 'collect') {
      await writeJson(statusPath, { state: 'collected', fileCount: collection.files.length, at: new Date().toISOString() });
      console.log(JSON.stringify({ fileCount: collection.files.length, files: collection.files.map((f) => ({ name: f.name, receivedAt: f.receivedAt })) }, null, 2));
      return;
    }
    if (!params.apiKey) throw new Error('API_KEY_REQUIRED: save the dedicated intake key in credentials.json');
    const files = collection.files;
    const doCommit = options.commit || (command === 'schedule' && config.autoCommit === true);
    if (doCommit && !hasNewFiles(files, checkpoint, day)) {
      // Reconcile any unconfirmed group notice before treating the run as quiet.
      if (config.sendGroupReports && !checkpoint.initialNoticeSent && checkpoint.runId) {
        const report = await readJson(path.join(config.runtimeDir, 'last-report.json'));
        await deliver(report, files.map(file => file.key));
      }
      await writeJson(statusPath, { state: 'no_changes', fileCount: files.length, at: now.toISOString() });
      await finishSlot(); console.log('No new booklets; no update or repeated message.'); return;
    }
    if (!files.length) {
      await writeJson(statusPath, { state: 'no_files', at: new Date().toISOString(), since });
      if (slot) { history.completed.push(slot); await writeJson(historyPath, history); }
      await notifyStatus(config, params, 'no_files');
      if (doCommit) {
        const text = `עדכון חוברות — ${day}\nעדיין לא התקבלו חוברות בחלון הזמן שנבדק, ולכן לא בוצע עדכון. נבדוק שוב במועד הבדיקה הבא.`;
        await sendGroupUpdate(config, { id: `empty-${day}`, text, headed: options.headed });
        await writeJson(checkpointPath, { day, fileKeys: [], initialNoticeSent: config.sendGroupReports === true, at: now.toISOString() });
      }
      return;
    }
    // Keep original filenames for matching even though each message has its own directory.
    const preview = await previewBatch({ ...params, files, receivedAt: now.toISOString() });
    await writeJson(path.join(config.runtimeDir, 'last-preview.json'), preview);
    if (!doCommit) {
      await writeJson(statusPath, { state: 'preview_ready', summary: preview.summary, at: new Date().toISOString() });
      console.log(JSON.stringify(preview.summary, null, 2));
      if (slot) { history.completed.push(slot); await writeJson(historyPath, history); }
      return;
    }
    if (preview.matches.some((match) => ['needs_review', 'duplicate', 'unmatched'].includes(match.status))) {
      throw new Error('FILES_NEED_REVIEW: inspect last-preview.json; no replacement attempted');
    }
    const report = await commitWithPayloadFallback({ ...params, files, receivedAt: now.toISOString(),
      onBatchStarted: async (batchPreviewRunId) => writeJson(pendingPath, { batchPreviewRunId, startedAt: now.toISOString(), fileIds: files.map((file) => file.key) }),
    });
    await writeJson(path.join(config.runtimeDir, 'last-report.json'), report);
    if (report.summary.failed || report.summary.skipped || !report.reportEmail?.sent) throw new Error('BATCH_NEEDS_REVIEW');
    await deliver(report, files.map(file => file.key));
    await rm(pendingPath, { force: true });
    await writeJson(statusPath, { state: 'completed', summary: report.summary, runId: report.runId, at: new Date().toISOString() });
    if (slot) { history.completed.push(slot); await writeJson(historyPath, { completed: history.completed.slice(-60) }); }
    await notifyStatus(config, params, 'ready');
    console.log(JSON.stringify(report.summary, null, 2));
  } catch (error) {
    const code = error.message.split(':')[0].slice(0, 100);
    await writeJson(statusPath, { state: 'attention_required', code, message: error.message, at: new Date().toISOString() });
    await notifyStatus(config, params, code.includes('LOGIN') ? 'login_required' : 'run_failed');
    if (process.platform === 'darwin') {
      await exec('/usr/bin/osascript', ['-e', 'on run argv\ndisplay notification (item 1 of argv) with title "The Q — WhatsApp"\nend run', code]).catch(() => {});
    }
    throw error;
  } finally { inhibitor?.kill('SIGTERM'); }
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
