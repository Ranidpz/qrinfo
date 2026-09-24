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
