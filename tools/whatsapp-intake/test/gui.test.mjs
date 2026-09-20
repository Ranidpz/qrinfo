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
  assert.deepEqual(status.rows,[{filename:'original.pdf',title:'Experience name',status:'matched'}]);
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
  await writeFile(path.join(dir,'storage.mjs'),'export const readJson=async()=>null;export const acquireLock=async()=>()=>{};');
  await symlink(path.join(dir,'gui.mjs'),path.join(dir,'gui-link.mjs'));
  const {stdout}=await promisify(execFile)(process.execPath,[path.join(dir,'gui-link.mjs'),'status']);
  assert.equal(JSON.parse(stdout).installed,false);
 } finally {await rm(dir,{recursive:true,force:true});}
});
