import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {runCommand} from '../src/runner.mjs';
import {readJson, writeJson} from '../src/storage.mjs';
import {nextCheck} from '../src/activity.mjs';

async function fixture(fn) {
 const dir=await mkdtemp(path.join(tmpdir(),'theq-recovery-')), originalFetch=globalThis.fetch;
 try {
  const bytes=Buffer.from('%PDF-1.7\nfixture');await writeFile(path.join(dir,'file.pdf'),bytes);
  const file={path:path.join(dir,'file.pdf'),size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),receivedAt:'2026-09-24T06:00:00Z',key:'one',messageId:'one',name:'valid.pdf'};
  const config={id:'test',runtimeDir:dir,groupName:'Fixture',apiBaseUrl:'https://fixture.invalid',workflowPath:'/fattal',ownerEmail:'test@example.com',timeZone:'Asia/Jerusalem',scanWindowHours:24,scanLookbackHours:48,sendGroupReports:true,autoCommit:true,schedule:{enabled:true,checks:[{weekday:4,time:'10:05'},{weekday:4,time:'12:00'},{weekday:4,time:'14:00'}]}};
  await writeJson(path.join(dir,'credentials.json'),{contentIntakeApiKey:'fixture'});
  const state={files:[file],now:new Date('2026-09-24T07:05:00Z'),batches:new Map(),commits:0,scans:0,emailFail:true,sendFail:true,sends:[],probes:0,finalizes:0,dropResponse:false};let seq=0;
  const services={now:()=>state.now,syncSchedule:async()=>{},collect:async()=>{state.scans++;return{files:state.files};},sendGroupUpdate:async(_,m)=>{state.sends.push(m);if(state.sendFail)throw Error('WHATSAPP_SEND_UNCONFIRMED');return{sent:true};}};
  globalThis.fetch=async(url,options={})=>{
   const pathname=new URL(url).pathname, body=options.method==='POST'&&typeof options.body==='string'?JSON.parse(options.body):{};
   if(pathname.endsWith('/preview')){
    const preview={generatedAt:state.now.toISOString(),batchProtocolVersion:1,assignmentProtocolVersion:1,matches:body.files.map(f=>({file:f,status:f.name==='unknown.pdf'?'unmatched':'matched',target:{codeId:f.id,title:f.name}})),missingTargets:[],summary:{}};
    if(body.saveRun){preview.runId=`batch-${++seq}`;state.batches.set(preview.runId,{runId:preview.runId,preview,activeCommits:0});state.last=preview.runId;}
    return Response.json(preview);
   }
   if(pathname.endsWith('/commit')){state.commits++;return Response.json({results:[],reportEmail:{deferred:true}});}
   if(pathname.endsWith('/report')&&options.method!=='POST'){
    state.probes++;return Response.json({...state.batches.get(new URL(url).searchParams.get('batchPreviewRunId')),recoveryProtocolVersion:1});
   }
   if(pathname.endsWith('/report')){
    state.finalizes++;const batch=state.batches.get(body.batchPreviewRunId);
    if(body.sendEmail&&state.emailFail)throw Error('email unavailable');
    if(!batch.batchFinalized){batch.results=batch.preview.matches.map(m=>({fileId:m.file.id,filename:m.file.name,title:m.file.name,status:m.status==='matched'?'updated':'skipped',reason:m.status}));batch.summary={updated:batch.results.filter(r=>r.status==='updated').length,skipped:batch.results.filter(r=>r.status==='skipped').length,failed:0};batch.batchFinalized=true;}
    batch.reportEmail={sent:body.sendEmail===true};
    if(state.dropResponse){state.dropResponse=false;throw Error('network lost after server finalized');}
    return Response.json({...batch,recoveryProtocolVersion:1});
   }
   if(pathname.endsWith('/agent-status'))return Response.json({accepted:true});
   throw Error('Unexpected fixture request '+pathname);
  };
  await fn({dir,config,state,services,file});
 }finally{globalThis.fetch=originalFetch;await rm(dir,{recursive:true,force:true});}
}

test('failed morning delivery does not block noon upload or quiet 14:00 check; manual run preserves slots',()=>fixture(async({dir,config,state,services,file})=>{
 state.files.push({...file,key:'unknown',messageId:'unknown',name:'unknown.pdf'});
 await runCommand('schedule',config,{},services);
 assert.equal(state.commits,1);assert.equal(await readJson(path.join(dir,'pending.json'),null),null);
 assert.equal((await readJson(path.join(dir,'delivery-status.json'))).outstanding,1);
 assert.doesNotMatch(state.sends[0].text,/ממשק|מזהה|batch-/);
 assert.match(state.sends[0].text,/לא עודכנו/);
 state.now=new Date('2026-09-24T09:00:00Z');state.files=[file,{...file,key:'corrected',messageId:'new',name:'corrected.pdf'}];
 await runCommand('schedule',config,{},services);assert.equal(state.commits,2);
 state.now=new Date('2026-09-24T11:00:00Z');state.emailFail=false;state.sendFail=false;
 await runCommand('schedule',config,{},services);assert.equal(state.commits,2);assert.equal(state.scans,3);
 assert.deepEqual((await readJson(path.join(dir,'schedule.json'))).completed,['2026-09-24/10:05','2026-09-24/12:00','2026-09-24/14:00']);
 assert.equal((await readJson(path.join(dir,'delivery-status.json'))).outstanding,0);
 const attempts=await readJson(path.join(dir,'attempts.json'));assert.deepEqual(attempts.map(a=>a.outcome),['completed_with_issues','completed','no_changes']);
 state.files.push({...file,key:'manual',messageId:'manual',name:'manual.pdf'});config.schedule.enabled=false;
 await runCommand('run',config,{commit:true},services);assert.equal(state.commits,3);
 assert.equal((await readJson(path.join(dir,'schedule.json'))).completed.length,3);assert.equal(config.schedule.enabled,false);
}));

test('lost finalization response recovers from server without reupload; preview stays read-only with pending state',()=>fixture(async({dir,config,state,services})=>{
 state.dropResponse=true;
 await assert.rejects(runCommand('run',config,{commit:true},services),/network lost/);
 assert.ok(await readJson(path.join(dir,'pending.json')));assert.equal(state.commits,1);
 const finalized=state.finalizes;
 await runCommand('run',config,{},services);
 assert.equal(state.commits,1);assert.equal(state.finalizes,finalized);assert.equal(state.probes,0);assert.equal(state.sends.length,0);
 const outbox=path.join(dir,'outbox',createHash('sha256').update(state.last).digest('hex')+'.json');
 await writeJson(outbox,{state:'sending',text:'old exact report text'});
 await runCommand('resume',config,{},services);
 assert.equal(state.commits,1);assert.equal(state.finalizes,finalized);assert.equal(state.probes,1);
 assert.equal(await readJson(path.join(dir,'pending.json'),null),null);
 assert.equal(state.sends[0].text,'old exact report text');assert.equal(state.sends[0].reconcileOnly,true);
}));

test('active or incomplete batch stays blocked; recovery never clears uncertain file writes',()=>fixture(async({dir,config,state,services})=>{
 state.dropResponse=true;await assert.rejects(runCommand('run',config,{commit:true},services));
 const batch=state.batches.get(state.last);batch.batchFinalized=false;batch.activeCommits=1;
 await assert.rejects(runCommand('resume',config,{},services),/BATCH_STILL_RUNNING/);
 assert.ok(await readJson(path.join(dir,'pending.json')));assert.equal(state.commits,1);
 batch.batchFinalized=true;batch.activeCommits=0;batch.results=[];
 await assert.rejects(runCommand('resume',config,{},services),/BATCH_NEEDS_REVIEW/);
 assert.ok(await readJson(path.join(dir,'pending.json')));assert.equal(state.commits,1);
 assert.equal(state.sends.length,0);
}));

test('activity shows next configured check and disables it when paused',()=>fixture(async({config})=>{
 assert.match(nextCheck(config,new Date('2026-09-24T07:06:00Z'),['2026-09-24/10:05']),/12:00/);
 assert.match(nextCheck(config,new Date('2026-09-24T09:01:00Z'),[]),/ממתין/);
 config.schedule.enabled=false;assert.equal(nextCheck(config),null);
}));

test('inactive unfinalized batch finalizes server receipts once during recovery, never uploads again',()=>fixture(async({dir,config,state,services})=>{
 state.dropResponse=true;await assert.rejects(runCommand('run',config,{commit:true},services));
 state.batches.get(state.last).batchFinalized=false;
 const previous=state.finalizes;await runCommand('resume',config,{},services);
 assert.equal(state.finalizes,previous+1);assert.equal(state.commits,1);
 assert.equal(await readJson(path.join(dir,'pending.json'),null),null);
}));

test('email retries stop before deduplication expires; old group reports only reconcile',()=>fixture(async({dir,config,state,services})=>{
 await runCommand('run',config,{commit:true},services);
 const previous=state.finalizes;state.now=new Date('2026-09-25T07:05:00Z');
 const {deliverQueued}=await import('../src/delivery.mjs');
 await deliverQueued(config,{baseUrl:config.apiBaseUrl,workflowPath:config.workflowPath,ownerEmail:config.ownerEmail,apiKey:'fixture'},services.sendGroupUpdate,{now:state.now});
 assert.equal(state.finalizes,previous);assert.equal(state.sends.at(-1).reconcileOnly,true);
 const queue=await readJson(path.join(dir,'delivery-queue.json'));assert.equal(queue.items[0].email,'needs_review');
 assert.equal((await readJson(path.join(dir,'delivery-status.json'))).outstanding,1);
}));

test('an empty initial scan queues one notice without email or uploads; noon remains quiet',()=>fixture(async({config,state,services})=>{
 state.files=[];state.sendFail=false;
 await runCommand('schedule',config,{},services);
 assert.equal(state.sends.length,1);assert.match(state.sends[0].text,/לא התקבלו/);
 state.now=new Date('2026-09-24T09:00:00Z');await runCommand('schedule',config,{},services);
 assert.equal(state.sends.length,1);assert.equal(state.finalizes,0);assert.equal(state.commits,0);
}));
