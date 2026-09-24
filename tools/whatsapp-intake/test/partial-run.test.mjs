import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { runCommand } from '../src/runner.mjs';
import { localFileId } from '../src/intake-client.mjs';
import { readJson, writeJson } from '../src/storage.mjs';
test('mixed batch commits good file, reports held file, stays quiet, then retries a corrected assignment',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'theq-partial-'));
 const originalFetch=globalThis.fetch;
 let currentFiles, lastPreview, counter=0, commits=0; const sent=[];
 try {
  const bytes=Buffer.from('%PDF-1.7\nfixture');await writeFile(path.join(dir,'file.pdf'),bytes);
  const base={path:path.join(dir,'file.pdf'),size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),receivedAt:new Date().toISOString()};
  currentFiles=[{...base,key:'good',messageId:'one',name:'good.pdf'}, {...base,key:'bad',messageId:'two',name:'unknown.pdf'}];
  const config={id:'test',runtimeDir:dir,groupName:'Fixture',apiBaseUrl:'https://test.invalid',workflowPath:'/api/content-intake/fattal',ownerEmail:'test@example.com',timeZone:'Asia/Jerusalem',scanWindowHours:24,scanLookbackHours:48,sendGroupReports:true};
  await writeJson(path.join(dir,'credentials.json'),{contentIntakeApiKey:'fake'});
  const services={syncSchedule:async()=>{},collect:async()=>({files:currentFiles}),sendGroupUpdate:async(_,m)=>{sent.push(m);return {sent:true};}};
  globalThis.fetch=async(url,options)=>{
   if(url.endsWith('/preview')){
    const body=JSON.parse(options.body);
    const preview={generatedAt:new Date().toISOString(),batchProtocolVersion:1,assignmentProtocolVersion:1,matches:body.files.map(f=>({file:f,status:f.name==='good.pdf'||f.evidence?.length?'matched':'unmatched',target:{codeId:f.id,title:f.name}})),missingTargets:[],summary:{}};
    if(body.saveRun){preview.runId=`batch-${++counter}`;lastPreview=preview;}
    return Response.json(preview);
   }
   if(url.endsWith('/commit')){
    commits++;const expected=lastPreview.matches.filter(m=>m.status==='matched').map(m=>m.file.id);
    const uploaded=options.body.getAll('files');assert.equal(uploaded.length,expected.length);
    expected.forEach((v,i)=>assert.equal(options.body.get(`sourceFileId:${i}`),v));
    return Response.json({results:[],reportEmail:{deferred:true}});
   }
   if(url.endsWith('/report')){
    const results=lastPreview.matches.map(m=>({fileId:m.file.id,filename:m.file.name,title:m.file.name,status:m.status==='matched'?'updated':'skipped',reason:m.status}));
    return Response.json({runId:lastPreview.runId,preview:lastPreview,results,summary:{updated:results.filter(r=>r.status==='updated').length,skipped:results.filter(r=>r.status==='skipped').length,failed:0},reportEmail:{sent:true}});
   }
   if(url.endsWith('/agent-status'))return Response.json({accepted:true});
   throw Error('Unexpected request');
  };
  await runCommand('run',config,{commit:true},services);
  assert.equal(commits,1);assert.equal(sent.length,1);assert.match(sent[0].text,/unknown.pdf/);
  assert.equal((await readJson(path.join(dir,'status.json'))).state,'completed_with_issues');
  assert.equal(await readJson(path.join(dir,'pending.json'),null),null);
  await runCommand('run',config,{commit:true},services);assert.equal(commits,1);assert.equal(sent.length,1);
  currentFiles=currentFiles.map(f=>f.key==='bad'?{...f,evidence:[{kind:'manual',text:'confirmed'}]}:f);
  await runCommand('run',config,{commit:true},services);assert.equal(commits,2);assert.equal(sent.length,2);
  assert.equal((await readJson(path.join(dir,'status.json'))).state,'completed');
 }finally{globalThis.fetch=originalFetch;await rm(dir,{recursive:true,force:true});}
});
