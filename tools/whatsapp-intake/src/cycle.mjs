import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {readJson,writeJson,acquireLock} from './storage.mjs';

// Explicit operator declaration, never inferred from a missing file or a screenshot.
// Retain cache, decisions and receipts. Only the lower bound of future reads changes.
export async function startManualCycle(dataDir, {confirmed = false, now = new Date()} = {}) {
  if (!confirmed) throw Error('MANUAL_CYCLE_CONFIRMATION_REQUIRED');
  let config = await readJson(path.join(dataDir,'config.json'));
  const runtime = path.join(dataDir,config.id), release = await acquireLock(runtime);
  try {
    const current = await readJson(path.join(dataDir,'config.json'));
    if(current.id !== config.id)throw Error('CYCLE_SCOPE_CHANGED');
    config = current;
    if (config.schedule.enabled) throw Error('PAUSE_BEFORE_NEW_CYCLE');
    if (await readJson(path.join(runtime,'pending.json'),null)) throw Error('UNCONFIRMED_BATCH');
    const account = await readJson(path.join(runtime,'account.json'),null);
    if (!account?.confirmedAt) throw Error('LOGIN_CONFIRMATION_REQUIRED');
    const cycle={id:randomUUID(),at:now.toISOString(),reason:'operator_confirmed_manual_completion',
      integrationId:config.id,ownerEmail:config.ownerEmail,groupName:config.groupName,accountConfirmedAt:account.confirmedAt};
    await writeJson(path.join(runtime,'cycles',cycle.id+'.json'),cycle);
    await writeJson(path.join(runtime,'cycle-baseline.json'),cycle);
    await writeJson(path.join(runtime,'status.json'),{state:'cycle_needs_scan',at:cycle.at});
    return cycle;
  }finally{await release();}
}
export async function loadCycle(config) {
  const cycle=await readJson(path.join(config.runtimeDir,'cycle-baseline.json'),null);
  if(!cycle)return null;
  const account=await readJson(path.join(config.runtimeDir,'account.json'),null);
  if(cycle.reason!=='operator_confirmed_manual_completion'||!Number.isFinite(Date.parse(cycle.at))
    ||cycle.integrationId!==config.id||cycle.ownerEmail!==config.ownerEmail||cycle.groupName!==config.groupName
    ||cycle.accountConfirmedAt!==account?.confirmedAt)throw Error('CYCLE_SCOPE_CHANGED');
  return cycle;
}
export function cycleSince(since, cycle) {
  return cycle && Date.parse(cycle.at)>Date.parse(since) ? cycle.at : since;
}
export function cycleSchedule(config,cycle) {
  if(!cycle)return config;
  const effectiveAfter=cycleSince(config.schedule.effectiveAfter || '1970-01-01T00:00:00.000Z',cycle);
  return {...config,schedule:{...config.schedule,effectiveAfter}};
}

// Reconfirmation is an explicit same-account declaration, not a new manual-completion cutoff.
export function canReconfirmCycle(config, cycle, account) {
  return !!cycle && cycle.reason === 'operator_confirmed_manual_completion'
    && Number.isFinite(Date.parse(cycle.at)) && cycle.integrationId === config.id
    && cycle.ownerEmail === config.ownerEmail && cycle.groupName === config.groupName
    && account?.integrationId === config.id && account.groupName === config.groupName
    && account.accountLabel === config.accountLabel && Number.isFinite(Date.parse(account.confirmedAt))
    && cycle.accountConfirmedAt !== account.confirmedAt;
}
export async function reconfirmCycle(dataDir, {confirmedSameAccount = false, now = new Date()} = {}) {
  if (!confirmedSameAccount) throw Error('SAME_ACCOUNT_CONFIRMATION_REQUIRED');
  const before = await readJson(path.join(dataDir, 'config.json'));
  const runtime = path.join(dataDir, before.id), release = await acquireLock(runtime);
  try {
    const config = await readJson(path.join(dataDir, 'config.json'));
    if (config.id !== before.id) throw Error('CYCLE_SCOPE_CHANGED');
    if (config.schedule.enabled) throw Error('PAUSE_BEFORE_RECONFIRM');
    if (await readJson(path.join(runtime, 'pending.json'), null)) throw Error('UNCONFIRMED_BATCH');
    const cycle = await readJson(path.join(runtime, 'cycle-baseline.json'), null);
    const account = await readJson(path.join(runtime, 'account.json'), null);
    if (!canReconfirmCycle(config, cycle, account)) throw Error('CYCLE_SCOPE_CHANGED');
    const audit = {id:randomUUID(), at:now.toISOString(), reason:'operator_confirmed_same_account_reconnection',
      cycleId:cycle.id, cycleStartedAt:cycle.at, integrationId:config.id, ownerEmail:config.ownerEmail,
      groupName:config.groupName, previousConfirmedAt:cycle.accountConfirmedAt, confirmedAt:account.confirmedAt};
    await writeJson(path.join(runtime, 'cycle-reconnections', audit.id + '.json'), audit);
    await writeJson(path.join(runtime, 'cycle-baseline.json'), {...cycle, accountConfirmedAt:account.confirmedAt,
      reconnection:{id:audit.id, at:audit.at, reason:audit.reason}});
    await writeJson(path.join(runtime, 'status.json'), {state:'cycle_needs_scan', at:audit.at});
    return audit;
  } finally { await release(); }
}
