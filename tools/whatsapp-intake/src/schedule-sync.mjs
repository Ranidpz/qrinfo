import path from 'node:path';
import { hostname } from 'node:os';
import { readJson, writeJson } from './storage.mjs';

export function validateRemoteSchedule(value) {
  if (!value || value.timeZone !== 'Asia/Jerusalem' || typeof value.revision !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(value.revision)
    || (value.effectiveAfter !== null && (typeof value.effectiveAfter !== 'string' || !Number.isFinite(Date.parse(value.effectiveAfter))))
    || !Array.isArray(value.checks) || value.checks.length < 1 || value.checks.length > 28) throw new Error('INVALID_REMOTE_SCHEDULE');
  const seen = new Set();
  for (const c of value.checks) {
    if (!c || !Number.isInteger(c.weekday) || c.weekday < 0 || c.weekday > 6 || typeof c.time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(c.time)) throw new Error('INVALID_REMOTE_SCHEDULE');
    const key = `${c.weekday}/${c.time}`;
    if (seen.has(key)) throw new Error('DUPLICATE_REMOTE_SLOT');
    seen.add(key);
  }
  return { checks: value.checks.map(({ weekday, time }) => ({ weekday, time })), timeZone: value.timeZone, revision: value.revision, effectiveAfter: value.effectiveAfter };
}
export async function syncSchedule(config) {
  const syncPath = path.join(config.runtimeDir, 'schedule-sync.json');
  try {
    const credentials = await readJson(path.join(config.runtimeDir, 'credentials.json'), {});
    const key = process.env.CONTENT_INTAKE_API_KEY || credentials.contentIntakeApiKey;
    if (!key) throw new Error('API_KEY_REQUIRED');
    const endpoint = `${config.apiBaseUrl}${config.workflowPath}/config`;
    const headers = { 'x-content-intake-key': key, 'content-type': 'application/json' };
    const response = await fetch(`${endpoint}?agentId=${encodeURIComponent(config.id)}`, { headers, redirect: 'error', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`SCHEDULE_SYNC_HTTP_${response.status}`);
    const remote = validateRemoteSchedule(await response.json());
    // Only schedule fields are remotely writable. Activation, account, key and paths remain local.
    const stored = await readJson(config.configFile);
    const next = { ...stored, schedule: { ...stored.schedule, checks: remote.checks, revision: remote.revision, effectiveAfter: remote.effectiveAfter }, timeZone: remote.timeZone };
    if (JSON.stringify(stored) !== JSON.stringify(next)) await writeJson(config.configFile, next);
    config.schedule = next.schedule;
    config.timeZone = remote.timeZone;
    const ack = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ agentId: config.id, revision: remote.revision, computerName: hostname().slice(0, 80), runnerVersion: '0.7.0', scheduleEnabled: config.schedule.enabled === true, autoCommit: config.autoCommit === true }), redirect: 'error', signal: AbortSignal.timeout(20000) });
    if (!ack.ok) throw new Error(`SCHEDULE_ACK_HTTP_${ack.status}`);
    await writeJson(syncPath, { state: 'synced', revision: remote.revision, checks: remote.checks, at: new Date().toISOString() });
    return remote;
  } catch (error) {
    await writeJson(syncPath, { state: 'failed', code: error.message, at: new Date().toISOString() });
    // Do not execute an obsolete schedule when remote settings or authorization cannot be checked.
    throw error;
  }
}
