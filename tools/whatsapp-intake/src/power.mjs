import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
const exec = promisify(execFile);
function label(id) {
  if(!/^[a-zA-Z0-9-]{1,100}$/.test(id))throw Error('INVALID_POWER_AGENT_ID');
  return `app.theq.whatsapp-awake.${id}`;
}
export function buildPowerAgent(id) {
 return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>Label</key><string>${label(id)}</string>
<key>ProgramArguments</key><array><string>/usr/bin/caffeinate</string><string>-i</string></array>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/></dict></plist>\n`;
}
export function hasIdleAssertion(text,pid) {
 return text.split(/\n(?=\s*pid\s+\d+\()/).some(block=>new RegExp(`^\\s*pid\\s+${Number(pid)}\\(caffeinate\\)`).test(block) && block.includes('PreventUserIdleSystemSleep'));
}
export async function powerStatus(id,{run=exec}={}) {
 try {
  const {stdout}=await run('/bin/launchctl',['print',`gui/${process.getuid()}/${label(id)}`]);
  const pid=/\bpid = (\d+)/.exec(stdout)?.[1];
  if(!pid)return {active:false,reason:'not_running'};
  const assertions=await run('/usr/bin/pmset',['-g','assertions']);
  return {active:hasIdleAssertion(assertions.stdout,pid),agentRunning:true};
 }catch{return {active:false,reason:'not_verified'};}
}
export async function disableWake(id,{run=exec,agentsDir=path.join(homedir(),'Library/LaunchAgents')}={}) {
 await run('/bin/launchctl',['bootout',`gui/${process.getuid()}/${label(id)}`]).catch(()=>{});
 // Remove only our helper so login cannot re-enable it after an explicit pause.
 await rm(path.join(agentsDir,label(id)+'.plist'),{force:true});
}
export async function enableWake(id,{run=exec,agentsDir=path.join(homedir(),'Library/LaunchAgents'),wait=sleep}={}) {
 const options={run,agentsDir};
 await disableWake(id,options);
 await mkdir(agentsDir,{recursive:true});
 const plist=path.join(agentsDir,label(id)+'.plist');
 await writeFile(plist,buildPowerAgent(id),{mode:0o600});
 try {
  await run('/bin/launchctl',['bootstrap',`gui/${process.getuid()}`,plist]);
  for(let i=0;i<10;i++){
   if((await powerStatus(id,{run})).active)return;
   await wait(200);
  }
  throw Error('POWER_GUARD_NOT_VERIFIED');
 }catch(error){await disableWake(id,options);throw Error('POWER_GUARD_NOT_VERIFIED',{cause:error});}
}
