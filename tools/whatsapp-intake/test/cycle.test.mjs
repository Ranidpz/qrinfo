import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {startManualCycle,loadCycle,cycleSince,cycleSchedule,reconfirmCycle,canReconfirmCycle} from '../src/cycle.mjs';
import {writeJson,readJson} from '../src/storage.mjs';
import {guiStatus} from '../src/gui.mjs';
import {slotDue} from '../src/messages.mjs';
import {assertKnownMessagesObserved} from '../src/history.mjs';

test('manual completion preserves evidence, refuses uncertain writes and requires fresh post-baseline scan',async()=>{
 const base=await mkdtemp(path.join(os.tmpdir(),'theq-cycle-')),runtime=path.join(base,'machine');
 const now=new Date(),old=new Date(now.getTime()-3600000).toISOString();
 const config={id:'machine',ownerEmail:'owner@example.com',groupName:'Test',schedule:{enabled:false},runtimeDir:runtime};
 try{
  await writeJson(path.join(base,'config.json'),config);
  await writeJson(path.join(runtime,'account.json'),{confirmedAt:old});
  await writeJson(path.join(runtime,'credentials.json'),{contentIntakeApiKey:'test-only'});
  await writeJson(path.join(runtime,'messages.json'),{files:{royal:{messageId:'deleted',receivedAt:old,sha256:'abc'}}});
  const before=await readFile(path.join(runtime,'messages.json'),'utf8');
  await assert.rejects(startManualCycle(base),/CONFIRMATION_REQUIRED/);
  await writeJson(path.join(runtime,'pending.json'),{id:'uncertain'});
  await assert.rejects(startManualCycle(base,{confirmed:true,now}),/UNCONFIRMED_BATCH/);
  await rm(path.join(runtime,'pending.json'));
  const cycle=await startManualCycle(base,{confirmed:true,now});
  assert.equal(await readFile(path.join(runtime,'messages.json'),'utf8'),before);
  assert.equal((await readJson(path.join(runtime,'cycles',cycle.id+'.json'))).reason,'operator_confirmed_manual_completion');
  assert.equal((await guiStatus(base)).previewReady,false);
  assert.equal((await loadCycle(config)).at,now.toISOString());
  assert.doesNotThrow(()=>assertKnownMessagesObserved(JSON.parse(before).files,new Map(),Date.parse(cycleSince(old,cycle))));
  const after=new Date(now.getTime()+10).toISOString();
  assert.throws(()=>assertKnownMessagesObserved({new:{messageId:'new-missing',receivedAt:after}},new Map(),Date.parse(cycle.at)),/HISTORY_KNOWN/);
  await writeJson(path.join(runtime,'status.json'),{state:'no_files',at:after});
  await writeJson(path.join(runtime,'last-collection.json'),{complete:true,files:[],since:cycle.at,scannedAt:after});
  assert.equal((await guiStatus(base)).previewReady,false);
  await writeJson(path.join(runtime,'schedule-sync.json'),{state:'synced',at:after});
  assert.equal((await guiStatus(base)).previewReady,true);
  await writeJson(path.join(runtime,'last-collection.json'),{complete:true,files:[],since:old,scannedAt:after});
  assert.equal((await guiStatus(base)).previewReady,false);
  await writeJson(path.join(runtime,'account.json'),{confirmedAt:after});
  await assert.rejects(loadCycle(config),/CYCLE_SCOPE_CHANGED/);
 }finally{await rm(base,{recursive:true,force:true});}
});
test('new cycle skips earlier scheduled slots without changing future Sunday checks',()=>{
 const config={timeZone:'Asia/Jerusalem',schedule:{enabled:true,checks:[{weekday:0,time:'10:05'},{weekday:4,time:'10:05'},{weekday:4,time:'12:00'},{weekday:4,time:'14:00'}]}};
 const cycle={at:'2026-09-24T18:10:00.000Z'};
 assert.equal(slotDue(cycleSchedule(config,cycle),new Date('2026-09-24T18:15:00Z'),[]),null);
 assert.equal(slotDue(cycleSchedule(config,cycle),new Date('2026-09-27T07:05:00Z'),[]),'2026-09-27/10:05');
 assert.equal(config.schedule.effectiveAfter,undefined);
 assert.equal(cycleSince('2026-09-26T01:00:00Z',cycle),'2026-09-26T01:00:00Z');
});

test('runner uses the explicit cutoff for read-only scan and does not replay an old slot',async()=>{
 const {runCommand}=await import('../src/runner.mjs');
 const base=await mkdtemp(path.join(os.tmpdir(),'theq-cycle-run-')),runtime=path.join(base,'machine');
 const originalFetch=globalThis.fetch,requests=[];let scans=0;
 const now=new Date('2026-09-24T18:15:00Z'),cutoff=new Date('2026-09-24T18:10:00Z');
 const config={id:'machine',ownerEmail:'owner@example.com',groupName:'Test',runtimeDir:runtime,apiBaseUrl:'https://test.invalid',workflowPath:'/intake',timeZone:'Asia/Jerusalem',scanWindowHours:36,scanLookbackHours:96,schedule:{enabled:false,checks:[{weekday:4,time:'14:00'}]}};
 try{
  await writeJson(path.join(base,'config.json'),config);
  await writeJson(path.join(runtime,'account.json'),{confirmedAt:'2026-09-20T10:00:00Z'});
  await writeJson(path.join(runtime,'credentials.json'),{contentIntakeApiKey:'fake'});
  await startManualCycle(base,{confirmed:true,now:cutoff});
  globalThis.fetch=async(url)=>{requests.push(url);assert.ok(url.endsWith('/agent-status'));return Response.json({accepted:true});};
  const services={now:()=>now,syncSchedule:async()=>{},collect:async(_,options)=>{scans++;assert.equal(options.since,cutoff.toISOString());return {files:[]};},sendGroupUpdate:async()=>{throw Error('Unexpected group message');}};
  await runCommand('run',config,{},services);
  assert.equal(scans,1);assert.equal((await readJson(path.join(runtime,'status.json'))).state,'no_files');
  config.schedule.enabled=true;config.autoCommit=true;
  await runCommand('schedule',config,{},services);
  assert.equal(scans,1);assert.equal((await readJson(path.join(runtime,'attempts.json'))).at(-1).outcome,'not_due');
  assert.ok(requests.length>0);
 }finally{globalThis.fetch=originalFetch;await rm(base,{recursive:true,force:true});}
});

test('same-account reconnection retains the original cutoff and evidence, requires explicit confirmation and refuses scope changes', async()=>{
 const base=await mkdtemp(path.join(os.tmpdir(),'theq-reconnect-')), runtime=path.join(base,'machine');
 const originalAt='2026-09-25T03:51:34.514Z', oldAt='2026-09-24T16:38:35.074Z', newAt='2026-09-30T07:04:00.000Z';
 const config={id:'machine',ownerEmail:'owner@example.com',groupName:'Test',accountLabel:'Business',runtimeDir:runtime,schedule:{enabled:false,checks:[{weekday:4,time:'10:05'}]}};
 const original={id:'original-cycle',at:originalAt,reason:'operator_confirmed_manual_completion',integrationId:config.id,ownerEmail:config.ownerEmail,groupName:config.groupName,accountConfirmedAt:oldAt};
 const account={integrationId:config.id,groupName:config.groupName,accountLabel:config.accountLabel,confirmedAt:newAt};
 try {
  await writeJson(path.join(base,'config.json'),config);
  await writeJson(path.join(runtime,'cycle-baseline.json'),original);
  await writeJson(path.join(runtime,'account.json'),account);
  await writeJson(path.join(runtime,'credentials.json'),{contentIntakeApiKey:'test-only'});
  await writeJson(path.join(base,'app/package.json'),{version:'test'});
  const unchanged=['messages.json','assignments.json','schedule.json','last-report.json','cycles/original-cycle.json'];
  for (const f of unchanged) await writeJson(path.join(runtime,f),{evidence:f,at:originalAt});
  const bytes=await Promise.all(unchanged.map(f=>readFile(path.join(runtime,f),'utf8')));
  assert.equal(canReconfirmCycle(config,original,account),true);
  assert.equal((await guiStatus(base)).cycleReconnectRequired,true);
  await assert.rejects(loadCycle(config),/CYCLE_SCOPE_CHANGED/);
  await assert.rejects(reconfirmCycle(base),/SAME_ACCOUNT_CONFIRMATION_REQUIRED/);
  await writeJson(path.join(runtime,'pending.json'),{uncertain:true});
  await assert.rejects(reconfirmCycle(base,{confirmedSameAccount:true}),/UNCONFIRMED_BATCH/);
  await rm(path.join(runtime,'pending.json'));
  await writeJson(path.join(base,'config.json'),{...config,schedule:{...config.schedule,enabled:true}});
  await assert.rejects(reconfirmCycle(base,{confirmedSameAccount:true}),/PAUSE_BEFORE_RECONFIRM/);
  await writeJson(path.join(base,'config.json'),config);
  for(const field of ['ownerEmail','groupName','id']) {
   const changed={...config,[field]:'different'};
   assert.equal(canReconfirmCycle(changed,original,account),false);
  }
  await writeJson(path.join(runtime,'account.json'),{...account,accountLabel:'Different account'});
  await assert.rejects(reconfirmCycle(base,{confirmedSameAccount:true}),/CYCLE_SCOPE_CHANGED/);
  await writeJson(path.join(runtime,'account.json'),account);
  const audit=await reconfirmCycle(base,{confirmedSameAccount:true,now:new Date(newAt)});
  const cycle=await loadCycle(config);
  assert.equal(cycle.id,original.id); assert.equal(cycle.at,originalAt);
  assert.equal(cycle.accountConfirmedAt,newAt);
  assert.equal(audit.previousConfirmedAt,oldAt); assert.equal(audit.cycleStartedAt,originalAt);
  assert.deepEqual(await readJson(path.join(runtime,'cycle-reconnections',audit.id+'.json')),audit);
  assert.equal((await guiStatus(base)).cycleReconnectRequired,false);
  assert.equal((await guiStatus(base)).previewReady,false);
  assert.deepEqual(await Promise.all(unchanged.map(f=>readFile(path.join(runtime,f),'utf8'))),bytes);
  assert.deepEqual(await readJson(path.join(base,'config.json')),config);
  assert.throws(()=>assertKnownMessagesObserved({a:{messageId:'unseen',receivedAt:newAt}},new Map(),Date.parse(cycle.at)),/HISTORY_KNOWN/);
 } finally { await rm(base,{recursive:true,force:true}); }
});
