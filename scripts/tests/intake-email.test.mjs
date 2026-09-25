import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs,stub} from './load-ts.mjs';
const copy=await loadTs('../../src/lib/content-intake/agent-email.ts');

test('empty scan is informational, identifies computer and time without installation or success claims',()=>{
 const mail=copy.buildAgentStatusEmail('no_files','המק של מיכל',new Date('2026-09-25T03:51:00Z'));
 assert.match(mail.subject,/המק של מיכל.*לא נמצאו/);assert.doesNotMatch(mail.subject,/נדרשת בדיקה/);
 assert.match(mail.text,/06:51/);assert.match(mail.text,/החוברות במערכת לא שונו/);
 assert.doesNotMatch(mail.text,/התקנה|מזהה|חזרו לפעול/);
 const unsafe=copy.buildAgentStatusEmail('login_required','<img src=x onerror=evil()>',new Date());
 assert.doesNotMatch(unsafe.html,/<img/);assert.match(unsafe.html,/&lt;img/);
 const unknown=copy.buildAgentStatusEmail('run_failed',undefined,new Date());assert.match(unknown.text,/שם המחשב לא זמין/);
 for(const state of copy.agentEmailStates){const value=copy.buildAgentStatusEmail(state,'Test Mac',new Date());assert.match(value.text,/מה צריך לעשות:/);assert.ok(value.text.length<650);}
});

test('report computer is resolved only from the authenticated owner and connection',async()=>{
 let record={ownerId:'owner',workflow:'fattal-booklets',name:'המק של מיכל',agentId:'machine'};
 let agent={ownerId:'owner',connectionId:'connection',computerName:'Michal Mac'};
 globalThis.__mailIdentityDb={collection:name=>({doc:()=>({get:async()=>({data:()=>name==='contentIntakeConnections'?record:agent})})})};
 try{
 const {resolveIntakeComputerName}=await loadTs('../../src/lib/content-intake/fattal-server.ts',{
  '@/lib/firebase-admin':stub('export const getAdminDb=()=>globalThis.__mailIdentityDb;'),
  '@/lib/server-api-key':stub('export const hasValidServerApiKey=()=>false;'),
  './fattal':stub('export const FATTAL_BOOKLET_TARGETS=[];export const FATTAL_DEFAULT_OWNER_EMAIL="owner@example.com";'),
 });
 const auth={ownerId:'owner',connectionId:'connection',ownerEmail:'owner@example.com'};
 assert.equal(await resolveIntakeComputerName('owner',auth),'המק של מיכל');
 assert.equal(await resolveIntakeComputerName('other-owner',auth),undefined);
 assert.equal(await resolveIntakeComputerName('owner',true),undefined);
 record={...record,name:''};assert.equal(await resolveIntakeComputerName('owner',auth),'Michal Mac');
 agent={...agent,connectionId:'other'};assert.equal(await resolveIntakeComputerName('owner',auth),undefined);
 record={...record,ownerId:'other-owner'};assert.equal(await resolveIntakeComputerName('owner',auth),undefined);
 }finally{delete globalThis.__mailIdentityDb;}
});

test('status endpoint uses registered machine name, keeps dedup and does not accept a body-supplied name',async()=>{
 let saved={computerName:'המק של מיכל'},sent=[];
 const ref={set:async v=>{saved={...saved,...v};}};
 globalThis.__mailStatusDb={collection:()=>({doc:()=>ref}),runTransaction:async fn=>fn({get:async()=>({data:()=>saved}),set:(_,v)=>{saved={...saved,...v};}})};
 globalThis.__mailStatusFns={...copy,sendEmail:async mail=>{sent.push(mail);return {success:true};}};
 try{
 const {POST}=await loadTs('../../src/app/api/content-intake/fattal/agent-status/route.ts',{
  'next/server':stub('export const NextResponse=Response;'),
  'firebase-admin/firestore':stub('export const FieldValue={serverTimestamp:()=>"now"};'),
  '@/lib/firebase-admin':stub('export const getAdminDb=()=>globalThis.__mailStatusDb;'),
  '@/lib/auth':stub('export const requireSuperAdmin=async()=>({response:new Response("Unauthorized",{status:401})});export const isAuthError=v=>!!v.response;'),
  '@/lib/content-intake/fattal-server':stub('export const authenticateIntakeKey=r=>r.headers.get("x-content-intake-key")==="test";export const resolveFattalOwnerId=async()=>"owner";'),
  '@/lib/content-intake/agent-email':stub(`export const agentEmailStates=${JSON.stringify(copy.agentEmailStates)};export const buildAgentStatusEmail=(...a)=>globalThis.__mailStatusFns.buildAgentStatusEmail(...a);`),
  '@/lib/resend':stub('export const isResendConfigured=()=>true;export const sendEmail=(...a)=>globalThis.__mailStatusFns.sendEmail(...a);'),
 });
 const req=(state='no_files',key='test')=>new Request('https://example.test',{method:'POST',headers:{'x-content-intake-key':key},body:JSON.stringify({state,agentId:'machine',computerName:'spoofed name'})});
 assert.equal((await POST(req('no_files','bad'))).status,401);
 assert.equal((await POST(req())).status,200);assert.equal(sent.length,1);
 assert.match(sent[0].subject,/המק של מיכל/);assert.doesNotMatch(sent[0].text,/spoofed|machine/);
 assert.equal((await POST(req())).status,200);assert.equal(sent.length,1);
 assert.equal((await POST(req('unknown'))).status,400);
 }finally{delete globalThis.__mailStatusDb;delete globalThis.__mailStatusFns;}
});
