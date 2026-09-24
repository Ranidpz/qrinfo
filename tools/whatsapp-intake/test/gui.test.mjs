import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { guiStatus } from '../src/gui.mjs';
import { writeJson } from '../src/storage.mjs';
test('native status exposes the download folder and mappings, never secrets; activation needs fresh clean preview', async () => {
 const base=await mkdtemp(path.join(os.tmpdir(),'theq-gui-'));
 try {
  assert.equal((await guiStatus(base)).installed,false);
  await writeJson(path.join(base,'config.json'),{id:'mac-test',groupName:'Test',ownerEmail:'test@example.com',schedule:{enabled:false}});
  const run=path.join(base,'mac-test');
  await writeJson(path.join(run,'credentials.json'),{contentIntakeApiKey:'never-expose-this-secret'});
  await writeJson(path.join(run,'account.json'),{confirmed:true});
  await writeJson(path.join(run,'status.json'),{state:'preview_ready',at:new Date().toISOString()});
  await writeJson(path.join(run,'last-preview.json'),{matches:[{file:{name:'original.pdf'},target:{title:'Experience name'},status:'matched'}]});
  let status=await guiStatus(base);
  assert.equal(status.downloadDirectory,path.join(run,'downloads'));assert.equal(status.previewReady,true);
  assert.equal(status.rows[0].filename,'original.pdf'); assert.equal(status.rows[0].title,'Experience name');
  assert.ok(!JSON.stringify(status).includes('never-expose'));
  await writeJson(path.join(run,'status.json'),{state:'connection_imported',at:new Date().toISOString()});
  assert.equal((await guiStatus(base)).previewReady,false);
  await writeJson(path.join(run,'status.json'),{state:'preview_ready',at:new Date().toISOString()});
  await writeJson(path.join(run,'pending.json'),{id:'unconfirmed'});assert.equal((await guiStatus(base)).previewReady,false);
  await rm(path.join(run,'pending.json'));await writeJson(path.join(run,'status.json'),{state:'preview_ready',at:'2020-01-01T00:00:00Z'});assert.equal((await guiStatus(base)).previewReady,false);
 } finally {await rm(base,{recursive:true,force:true});}
});

test('native bridge executes when its entry path is a symlink, rather than silently exiting', async () => {
 const { readFile, writeFile, symlink } = await import('node:fs/promises');
 const { execFile } = await import('node:child_process');const { promisify }=await import('node:util');
 const dir=await mkdtemp(path.join(os.tmpdir(),'theq-gui-entry-'));
 try {
  await writeFile(path.join(dir,'gui.mjs'),await readFile(new URL('../src/gui.mjs',import.meta.url)));
  await writeFile(path.join(dir,'macos.mjs'),'export const install=()=>{};export const importConnection=()=>{};export const enableUpdates=()=>{};export const disableSchedule=()=>{};');
  await writeFile(path.join(dir,'storage.mjs'),'export const readJson=async()=>null;export const writeJson=async()=>{};export const acquireLock=async()=>()=>{};');
  await writeFile(path.join(dir,'intake-client.mjs'),'export const localFileId=()=>"test";');
  await symlink(path.join(dir,'gui.mjs'),path.join(dir,'gui-link.mjs'));
  const {stdout}=await promisify(execFile)(process.execPath,[path.join(dir,'gui-link.mjs'),'status']);
  assert.equal(JSON.parse(stdout).installed,false);
 } finally {await rm(dir,{recursive:true,force:true});}
});

test('manual choice is hash-bound, target-scoped, refuses pending writes and needs fresh preview',async()=>{
 const { saveAssignment }=await import('../src/gui.mjs');
 const { localFileId }=await import('../src/intake-client.mjs');
 const { readJson }=await import('../src/storage.mjs');
 const { writeFile }=await import('node:fs/promises');
 const { createHash }=await import('node:crypto');
 const base=await mkdtemp(path.join(os.tmpdir(),'theq-choice-'));
 try {
  await writeJson(path.join(base,'config.json'),{id:'mac-test',schedule:{enabled:false}});
  const run=path.join(base,'mac-test'),filePath=path.join(base,'fixture.pdf'),bytes=Buffer.from('%PDF-1.7\nfixture');await writeFile(filePath,bytes);
  const file={path:filePath,key:'messagekey',messageId:'source',name:'original.pdf',sha256:createHash('sha256').update(bytes).digest('hex')};
  const id=localFileId(file);
  await writeJson(path.join(run,'last-collection.json'),{files:[file]});
  await writeJson(path.join(run,'last-preview.json'),{matches:[{file:{id,name:file.name},status:'unmatched'}],targets:[{codeId:'allowed',title:'Experience'}]});
  await assert.rejects(saveAssignment(base,id,'outside'),/TARGET_NOT_ALLOWED/);
  await saveAssignment(base,id,'allowed');
  assert.equal((await readJson(path.join(run,'assignments.json'))).messagekey.sha256,file.sha256);
  assert.equal((await readJson(path.join(run,'status.json'))).state,'assignment_changed');
  assert.equal((await guiStatus(base)).previewReady,false);
  await saveAssignment(base,id,'exclude');assert.equal((await readJson(path.join(run,'assignments.json'))).messagekey.exclude,true);
  await saveAssignment(base,id,'clear');assert.deepEqual(await readJson(path.join(run,'assignments.json')),{});
  await writeJson(path.join(run,'pending.json'),{id:'uncertain'});
  await assert.rejects(saveAssignment(base,id,'allowed'),/UNCONFIRMED_BATCH/);
  await rm(path.join(run,'pending.json'));await writeFile(filePath,'changed');
  await assert.rejects(saveAssignment(base,id,'allowed'),/FILE_CHANGED/);
 }finally{await rm(base,{recursive:true,force:true});}
});

test('a newer empty scan hides cached matches; review export includes freshness without credentials',async()=>{
 const {exportReview}=await import('../src/gui.mjs');
 const base=await mkdtemp(path.join(os.tmpdir(),'theq-stale-'));
 try{
  await writeJson(path.join(base,'config.json'),{id:'test',schedule:{enabled:false}});
  const run=path.join(base,'test');
  await writeJson(path.join(base,'app/package.json'),{version:'0.7.1'});
  await writeJson(path.join(run,'credentials.json'),{contentIntakeApiKey:'never-export-secret'});
  await writeJson(path.join(run,'last-preview.json'),{generatedAt:'2026-09-23T00:00:00Z',matches:[{file:{id:'old',name:'old.pdf'},target:{title:'Old'},status:'matched'}],targets:[{codeId:'old',title:'Old'}]});
  await writeJson(path.join(run,'last-collection.json'),{scannedAt:new Date().toISOString(),complete:true,files:[]});
  await writeJson(path.join(run,'status.json'),{state:'no_files',at:new Date().toISOString()});
  const status=await guiStatus(base);
  assert.equal(status.previewReady,false);assert.equal(status.previewStale,true);
  assert.deepEqual(status.rows,[]);assert.deepEqual(status.targets,[]);
  const report=await exportReview(base);
  assert.equal(report.runnerVersion,'0.7.1');assert.equal(report.state,'no_files');
  assert.equal(report.previewStale,true);assert.equal(report.collection.files.length,0);
  assert.equal(report.matches.length,1);assert.equal(report.pending,false);
  assert.ok(!JSON.stringify(report).includes('never-export-secret'));
 }finally{await rm(base,{recursive:true,force:true});}
});
