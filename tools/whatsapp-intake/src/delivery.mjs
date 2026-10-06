import path from 'node:path';
import { createHash } from 'node:crypto';
import { readJson, writeJson } from './storage.mjs';
import { buildGroupUpdate, cycleDay } from './group-report.mjs';
import { finalizeBatch } from './intake-client.mjs';

const queuePath = config => path.join(config.runtimeDir, 'delivery-queue.json');
export async function queueReport(config, report, { first, now = new Date() }) {
  const queue = await readJson(queuePath(config), { items: [] });
  if (queue.items.some(item => item.id === report.runId)) return;
  const outbox = await readJson(path.join(config.runtimeDir, 'outbox', `${createHash('sha256').update(report.runId).digest('hex')}.json`), null);
  const legacy = await readJson(path.join(config.runtimeDir, 'group-report.json'), null);
  const send = config.sendGroupReports === true && (first || report.summary.updated > 0 || report.summary.skipped > 0);
  // Never change the text of a message whose send might already have happened.
  const text = outbox?.text || (legacy?.id === report.runId ? legacy.text : buildGroupUpdate(report, {first, now:new Date(report.preview.generatedAt), timeZone:config.timeZone}));
  queue.items.push({ id: report.runId, text, createdAt: now.toISOString(), reportDay:cycleDay(new Date(report.preview.generatedAt), config.timeZone),
    legacyReconcileOnly:!!outbox || legacy?.id === report.runId, email:report.reportEmail?.sent ? 'sent' : 'pending', emailRetryUntil:new Date(Date.parse(report.preview.generatedAt) + 20*3600000).toISOString(), group:!send ? 'skipped' : outbox?.state === 'sent' ? 'sent' : 'pending', attempts:0 });
  await writeJson(queuePath(config), queue);
}
export async function queueEmptyReport(config, now) {
  if (!config.sendGroupReports) return;
  const queue = await readJson(queuePath(config), {items:[]});
  const day = cycleDay(now, config.timeZone), id = `empty-${day}`;
  if (queue.items.some(item => item.id === id)) return;
  queue.items.push({id, text:`עדכון חוברות — ${day}\nלא התקבלו קבצים בטווח שנבדק; לא בוצע עדכון. נא לשלוח את הקבצים עם שם החוויה והמיקום בשם הקובץ.`,
    reportDay:day, createdAt:now.toISOString(), email:'skipped', group:'pending', attempts:0});
  await writeJson(queuePath(config), queue);
}
export async function deliverQueued(config, params, sendGroupUpdate, { now = new Date(), headed = false, reconcileOnly = false } = {}) {
  const queue = await readJson(queuePath(config), {items:[]});
  let processed = 0;
  for (const item of queue.items) {
    if (!['pending', 'uncertain'].includes(item.group) && item.email !== 'pending') continue;
    if (item.nextAttemptAt && Date.parse(item.nextAttemptAt) > now.getTime() && !reconcileOnly) continue;
    if (++processed > 3) break;
    item.attempts++; item.lastAttemptAt = now.toISOString();
    // Stop ambiguous retries before the provider's idempotency window expires.
    if (item.email === 'pending' && item.emailRetryUntil && now > new Date(item.emailRetryUntil)) {
      item.email = 'needs_review'; item.emailError = 'EMAIL_RETRY_WINDOW_EXPIRED';
    }
    if (item.email === 'pending' && !reconcileOnly) {
      try {
        const report = await finalizeBatch({...params, batchPreviewRunId:item.id, sendEmail:true});
        if (report.reportEmail?.sent) item.email = 'sent';
        else item.emailError = 'EMAIL_NOT_CONFIRMED';
      } catch { item.emailError = 'EMAIL_RETRY_REQUIRED'; }
    }
    if (['pending', 'uncertain'].includes(item.group)) {
      // Late recovery must not announce yesterday's batch as a new update.
      const onlyReconcile = reconcileOnly || item.legacyReconcileOnly === true || item.reportDay !== cycleDay(now, config.timeZone);
      try {
        const result = await sendGroupUpdate(config, {id:item.id, text:item.text, headed, reconcileOnly:onlyReconcile});
        item.group = result.sent ? 'sent' : result.skipped ? 'skipped' : 'uncertain';
        if (result.sent) delete item.groupError;
      } catch (error) {
        item.group = 'uncertain'; item.groupError = error.message.split(':')[0].slice(0,80);
      }
    }
    item.nextAttemptAt = new Date(now.getTime() + Math.min(60, 5 * 2 ** Math.min(item.attempts - 1, 4)) * 60000).toISOString();
    // Each result is durable. A delivery error never revokes confirmed PDF writes.
    await writeJson(queuePath(config), queue);
  }
  const outstanding = queue.items.filter(item => ['pending','needs_review'].includes(item.email) || ['pending','uncertain'].includes(item.group)).length;
  await writeJson(path.join(config.runtimeDir, 'delivery-status.json'), {outstanding, at:now.toISOString()});
  return outstanding;
}
