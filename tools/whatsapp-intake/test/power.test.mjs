import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {buildPowerAgent,hasIdleAssertion,enableWake,disableWake} from '../src/power.mjs';
test('power assertion is scoped to our caffeinate PID and permits display sleep',()=>{
 const plist=buildPowerAgent('test-machine');
 assert.match(plist,/<string>-i<\/string>/);assert.doesNotMatch(plist,/<string>-(d|s)<\/string>/);
 assert.throws(()=>buildPowerAgent('../escape'),/INVALID/);
 const output='Assertion status system-wide:\n PreventUserIdleSystemSleep 1\nListed by owning process:\n pid 42(caffeinate): [0x123] PreventUserIdleSystemSleep named: "caffeinate command-line tool"\n pid 43(other): [0x124] PreventUserIdleSystemSleep';
 assert.equal(hasIdleAssertion(output,42),true);assert.equal(hasIdleAssertion(output,43),false);assert.equal(hasIdleAssertion(output,99),false);
});
test('wake helper verifies actual assertion, survives login, and pause removes only owned helper',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'theq-power-')),calls=[];let attempts=0;
 const run=async(file,args)=>{calls.push([file,...args]);if(args[0]==='print')return {stdout:'pid = 42'};if(file.endsWith('/pmset'))return {stdout:++attempts>1?'pid 42(caffeinate): PreventUserIdleSystemSleep':''};return {stdout:''};};
 const options={run,agentsDir:dir,wait:async()=>{}};
 try{
  await enableWake('test-machine',options);
  const plist=path.join(dir,'app.theq.whatsapp-awake.test-machine.plist');
  assert.match(await readFile(plist,'utf8'),/<key>KeepAlive<\/key><true\/>/);assert.equal(attempts,2);assert.equal((await stat(plist)).mode&0o777,0o600);
  await disableWake('test-machine',options);await assert.rejects(stat(plist),{code:'ENOENT'});
  assert.ok(calls.filter(c=>c[1]==='bootout').every(c=>c[2].endsWith('/app.theq.whatsapp-awake.test-machine')));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('unverified wake protection fails activation and removes persistent helper',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'theq-power-'));
 try{
  await assert.rejects(enableWake('test-machine',{agentsDir:dir,wait:async()=>{},run:async()=>({stdout:''})}),/POWER_GUARD_NOT_VERIFIED/);
  await assert.rejects(stat(path.join(dir,'app.theq.whatsapp-awake.test-machine.plist')),{code:'ENOENT'});
 }finally{await rm(dir,{recursive:true,force:true});}
});
