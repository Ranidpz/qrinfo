import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readJson, writeJson } from '../src/storage.mjs';
import { slotDue } from '../src/messages.mjs';
import { syncSchedule, validateRemoteSchedule } from '../src/schedule-sync.mjs';
const remote = {checks:[{weekday:0,time:'10:05'},{weekday:4,time:'12:00'}],revision:'rev-2',timeZone:'Asia/Jerusalem',effectiveAfter:null};
test('independent weekdays, future-only revisions, DST and completed slots',()=>{
 const config={timeZone:'Asia/Jerusalem',schedule:remote};
 assert.equal(slotDue(config,new Date('2026-09-20T09:30:00Z'),[]),'2026-09-20/10:05');
 assert.equal(slotDue(config,new Date('2026-09-24T08:30:00Z'),[]),null);
 assert.equal(slotDue(config,new Date('2026-09-24T09:30:00Z'),[]),'2026-09-24/12:00');
 assert.equal(slotDue(config,new Date('2026-09-20T09:30:00Z'),['2026-09-20/10:05']),null);
 assert.equal(slotDue({...config,schedule:{...remote,effectiveAfter:'2026-09-20T08:00:00Z'}},new Date('2026-09-20T09:00:00Z'),[]),null);
 assert.equal(slotDue(config,new Date('2026-12-20T08:06:00Z'),[]),'2026-12-20/10:05');
 assert.throws(()=>validateRemoteSchedule({...remote,checks:[...remote.checks,remote.checks[0]]}));
 assert.throws(()=>validateRemoteSchedule({...remote,checks:[{weekday:9,time:'13:00'}]}));
});
test('remote sync preserves local activation, secrets and paths; failed/revoked fetch stops execution',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'theq-sync-test-'));
 const config={id:'mac-test',configFile:path.join(dir,'config.json'),runtimeDir:dir,apiBaseUrl:'https://example.com',workflowPath:'/api/content-intake/fattal',autoCommit:false,profileDir:'/unchanged',schedule:{enabled:false}};
 const originalFetch=globalThis.fetch; const acknowledgments=[];
 try {
  await writeJson(config.configFile,config);await writeJson(path.join(dir,'credentials.json'),{contentIntakeApiKey:'fixture-secret'});
  globalThis.fetch=async(_,options)=>{
   if(options.method==='POST'){acknowledgments.push(JSON.parse(options.body));return new Response('{}');}
   return Response.json({...remote,autoCommit:true,schedule:{enabled:true},profileDir:'/attacker'});
  };
  await syncSchedule(config); const saved=await readJson(config.configFile);
  assert.equal(saved.autoCommit,false);assert.equal(saved.schedule.enabled,false);assert.equal(saved.profileDir,'/unchanged');
  assert.deepEqual(saved.schedule.checks,remote.checks);assert.equal(acknowledgments[0].revision,'rev-2');assert.ok(!JSON.stringify(saved).includes('fixture-secret'));
  globalThis.fetch=async()=>new Response('',{status:401});
  await assert.rejects(syncSchedule(config),/HTTP_401/);
  assert.equal((await readJson(path.join(dir,'schedule-sync.json'))).state,'failed');
 } finally {globalThis.fetch=originalFetch;await rm(dir,{recursive:true,force:true});}
});
