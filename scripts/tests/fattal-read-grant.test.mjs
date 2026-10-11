import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs, stub } from './load-ts.mjs';
import { main as healthCheck } from '../fattal-cloud-read-health.mjs';

const fattal = await loadTs('../../src/lib/content-intake/fattal.ts');
globalThis.readGrantTest = { fattal };
const expose = name => stub(Object.keys(globalThis.readGrantTest[name]).map(k => `export const ${k}=globalThis.readGrantTest.${name}.${k};`).join('\n'));
const policy = await loadTs('../../src/lib/content-intake/cloud-policy.ts', { './fattal': expose('fattal') });
globalThis.readGrantTest.policy = policy;
const setup = await loadTs('../../src/lib/content-intake/setup-review.ts', { './fattal': expose('fattal') });
globalThis.readGrantTest.setup = setup;
const service = await loadTs('../../src/lib/content-intake/read-grant.ts', { './fattal': expose('fattal'), './setup-review': expose('setup'), './cloud-policy': expose('policy') });
globalThis.readGrantTest.service = service;
const now = 1700000000000, id = 'a'.repeat(32);
const selection = { connectionId:id, keyHash:'b'.repeat(64), ownerId:'owner',ownerEmail:'owner@example.invalid',projectId:'fixture',durationHours:1 };
const bindings = { projectId:'fixture',publicProjectId:'fixture',cloudProjectId:'fixture',cloudOwnerId:'owner',cloudOwnerEmail:selection.ownerEmail };
function fixture() {
 const docs=new Map([['users/admin',{role:'super_admin'}],['users/owner',{email:selection.ownerEmail}]]);
 const codes=fattal.FATTAL_BOOKLET_TARGETS.map(t=>({shortId:t.shortId,ownerId:'owner'}));
 const writes=[];let queue=Promise.resolve();
 const snap=ref=>({id:ref.id,exists:docs.has(ref.path),data:()=>docs.get(ref.path)});
 const db={collection:name=>({doc:id=>({path:`${name}/${id}`,id,get:async()=>snap({path:`${name}/${id}`,id})}),where:(field,op,ids)=>{
  assert.equal(name,'codes');assert.equal(field,'shortId');assert.equal(op,'in');assert.deepEqual(ids,fattal.FATTAL_BOOKLET_TARGETS.map(t=>t.shortId));return {query:true};
 }}),runTransaction:fn=>{
  const run=queue.then(()=>fn({get:async ref=>ref.query?{docs:codes.map(c=>({data:()=>c}))}:snap(ref),
   create:(ref,data)=>{assert.ok(!docs.has(ref.path));writes.push(ref.path);docs.set(ref.path,data);},
   update:(ref,data)=>{writes.push(ref.path);docs.set(ref.path,{...docs.get(ref.path),...data});}}));queue=run.catch(()=>{});return run;
 }};
 return {docs,codes,writes,db};
}
const issue = (f,input=selection,b=bindings)=>service.issueReadGrant(f.db,'admin',b,service.parseReadGrant(input),()=>now);
test('issuance persists only a one-hour read grant with all twelve parents and no token',async()=>{
 const f=fixture(),result=await issue(f),record=f.docs.get(`fattalCloudConnections/${id}`);
 assert.equal(result.expiresAt,now+3600000);assert.deepEqual(record.scopes,['read']);assert.equal(record.allowedTargets.length,12);
 assert.equal(record.ownerVerifiedBy,'admin');assert.equal(record.keyHash,selection.keyHash);
 assert.equal(JSON.stringify(result).includes(selection.keyHash),false);assert.deepEqual(f.writes,[`fattalCloudConnections/${id}`]);
});
test('issued grant interoperates with actual server validation and cannot write, survive expiry or revocation',async()=>{
 const f=fixture(),token=`tq_fc_${id}.${'c'.repeat(64)}`;
 await issue(f,{...selection,keyHash:policy.sha256(token)});
 const record=f.docs.get(`fattalCloudConnections/${id}`);
 const config={enabled:true,writesEnabled:false,ownerId:selection.ownerId,ownerEmail:selection.ownerEmail,projectId:selection.projectId};
 assert.deepEqual(policy.validateGrant(record,token,config,'read',now).scopes,['read']);
 assert.throws(()=>policy.validateGrant(record,token,config,'write',now));
 assert.throws(()=>policy.validateGrant(record,token,config,'read',now+3600000));
 await service.inspectReadGrant(f.db,'admin',id,true,()=>now+1);
 assert.throws(()=>policy.validateGrant(f.docs.get(`fattalCloudConnections/${id}`),token,config,'read',now+2));
});
test('input cannot request writes, arbitrary targets, extended duration, raw credentials or malformed identity/hash',()=>{
 for(const change of [{scopes:['write']},{allowedTargets:['child']},{durationHours:4},{durationHours:'1'},{token:'do-not-accept'},
 {connectionId:'bad'},{keyHash:'bad'},{ownerId:[]},{ownerEmail:'bad'}]) assert.throws(()=>service.parseReadGrant({...selection,...change}));
});
test('transaction rechecks admin, exact owner, parent-only targets, uniqueness, and all project/legacy bindings',async()=>{
 for(const mutate of [f=>f.docs.set('users/admin',{role:'free'}),f=>f.docs.delete('users/owner'),f=>f.docs.set('users/owner',{email:'other'}),
 f=>f.codes.pop(),f=>f.codes.push({...f.codes[0]}),f=>f.codes[0].parentCodeShortId='parent',f=>f.codes[0].ownerId='other']){
  const f=fixture();mutate(f);await assert.rejects(issue(f));assert.deepEqual(f.writes,[]);
 }
 for(const change of [{cloudOwnerId:undefined},{cloudOwnerEmail:'other'},{cloudProjectId:undefined},{publicProjectId:'other'},{legacyOwnerEmail:'playzonest1@gmail.com'},{legacyOwnerId:'other'}]){
  const f=fixture();await assert.rejects(issue(f,selection,{...bindings,...change}));assert.deepEqual(f.writes,[]);
 }
});
test('concurrent and repeated issuance cannot replace or extend a grant; lost response recovers by read only',async()=>{
 const f=fixture();const results=await Promise.allSettled([issue(f),issue(f)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.writes.length,1);
 assert.equal((await service.inspectReadGrant(f.db,'admin',id,false,()=>now)).state,'active');assert.equal(f.writes.length,1);
 await assert.rejects(issue(f,{...selection,keyHash:'c'.repeat(64)}));assert.equal(f.writes.length,1);
 assert.equal((await service.inspectReadGrant(f.db,'admin',id,false,()=>now+3600000)).state,'expired');
});
test('issuer-scoped revocation is idempotent and never restores, deletes or rotates a grant',async()=>{
 const f=fixture();await issue(f);await assert.rejects(service.inspectReadGrant(f.db,'other-admin',id));
 assert.equal((await service.inspectReadGrant(f.db,'admin',id,true,()=>now+1)).state,'revoked');
 await service.inspectReadGrant(f.db,'admin',id,true,()=>now+2);assert.equal(f.writes.length,2);
 await assert.rejects(issue(f));assert.equal(f.docs.get(`fattalCloudConnections/${id}`).revokedAt,now+1);
});
const next=stub('export const NextResponse={json:(body,init)=>new Response(JSON.stringify(body),init)};');
const auth=await loadTs('../../src/lib/auth.ts',{'next/server':next,
 'firebase-admin/auth':stub('export const getAuth=()=>({verifyIdToken:async()=>{if(globalThis.readGrantTest.invalid)throw Error();return {uid:"admin"};}});'),
 '@/lib/firebase-admin':stub('export const getAdminApp=()=>({});export const getAdminDb=()=>globalThis.readGrantTest.f.db;')});
globalThis.readGrantTest.auth=auth;
const route=await loadTs('../../src/app/api/content-intake/dot/read-grant/route.ts',{
 'next/server':next,'@/lib/auth':expose('auth'),'@/lib/content-intake/read-grant':expose('service'),
 '@/lib/content-intake/cloud-policy':expose('policy'),'@/lib/content-intake/setup-review':expose('setup'),
 '@/lib/firebase-admin':stub('export const getAdminApp=()=>({options:{projectId:"fixture"}});export const getAdminDb=()=>globalThis.readGrantTest.f.db;')});
function reset() {
 const f=fixture();globalThis.readGrantTest.f=f;globalThis.readGrantTest.invalid=false;
 for(const k of Object.keys(process.env))if(k.startsWith('FATTAL_'))delete process.env[k];
 Object.assign(process.env,{NEXT_PUBLIC_FIREBASE_PROJECT_ID:'fixture',FATTAL_CLOUD_PROJECT_ID:'fixture',FATTAL_CLOUD_OWNER_ID:'owner',FATTAL_CLOUD_OWNER_EMAIL:selection.ownerEmail});return f;
}
async function call(method='POST',body=selection,headers={},query=''){
 const url=new URL('https://fixture.invalid/api/content-intake/dot/read-grant'+query);
 const req=new Request(url,{method,headers:{Authorization:'Bearer fixture',Origin:url.origin,'Content-Type':'application/json',...headers},...(method==='POST'?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});req.nextUrl=url;
 const res=await route[method](req);assert.equal(res.headers.get('Cache-Control'),'no-store');return {status:res.status,body:await res.json()};
}
const enable=()=>Object.assign(process.env,{FATTAL_CLOUD_READ_GRANTS_ENABLED:'true',FATTAL_CLOUD_ENABLED:'true',FATTAL_CLOUD_WRITES_ENABLED:'false'});
test('actual route denies missing/invalid auth, ordinary role, foreign origin and disabled/read-write flags without mutations',async()=>{
 for(const scenario of ['missing','invalid','ordinary','origin','disabled','writes']){
  const f=reset();if(scenario!=='disabled')enable();if(scenario==='invalid')globalThis.readGrantTest.invalid=true;
  if(scenario==='ordinary')f.docs.set('users/admin',{role:'free'});if(scenario==='writes')process.env.FATTAL_CLOUD_WRITES_ENABLED='true';
  const result=await call('POST',selection,scenario==='missing'?{Authorization:''}:scenario==='origin'?{Origin:'https://evil.invalid'}:{});
  assert.ok([401,403,503].includes(result.status));assert.deepEqual(f.writes,[]);
 }
});
test('route handles issuance, bounded JSON, read-only status and revocation after issuance is disabled',async()=>{
 const f=reset();enable();assert.equal((await call()).status,201);assert.equal(f.writes.length,1);
 assert.equal((await call('POST','x'.repeat(4097))).status,413);assert.equal((await call('POST','{')).status,400);
 delete process.env.FATTAL_CLOUD_READ_GRANTS_ENABLED;
 assert.equal((await call('GET',null,{},'?connectionId='+id)).body.state,'active');assert.equal(f.writes.length,1);
 assert.equal((await call('DELETE',null,{},'?connectionId='+id)).body.state,'revoked');assert.equal(f.writes.length,2);
});
function probeFixture(){
 const env={FATTAL_CLOUD_NETWORK_READ_ENABLED:'true',FATTAL_CLOUD_NETWORK_READ_CONFIG:'nonsecret.json',FATTAL_CLOUD_NETWORK_KEY:'opaque-proxy-placeholder'};
 const config={ownerId:'owner',ownerEmail:'biduratias@gmail.com',projectId:'qrinfo-905c9'};
 const health={...config,protocol:1,scopes:['read'],expiresAt:now+1000,writesEnabled:false,notificationsEnabled:false,cleanupEnabled:false,
 targets:fattal.FATTAL_BOOKLET_TARGETS.map(t=>({shortId:t.shortId,hotel:t.key,expectedVersion:'a'.repeat(64),pending:false}))};
 const output=[];let requests=0;
 const runtime={output:t=>output.push(t),now:()=>now,readFile:async()=>JSON.stringify(config),loadTargets:async()=>fattal,
 fetch:async(url,init)=>{requests++;assert.equal(url,'https://qr.playzones.app/api/content-intake/fattal/cloud/health');
 assert.equal(init.method,'GET');assert.equal(init.redirect,'error');assert.equal(init.headers['x-fattal-cloud-key'],env.FATTAL_CLOUD_NETWORK_KEY);return Response.json(health);}};
 return {env,config,health,output,runtime,requests:()=>requests};
}
test('network-secret health accepts an opaque placeholder and emits only verified read attestation',async()=>{
 const p=probeFixture();p.health.injectedSecret='tq_fc_DO_NOT_PRINT';assert.equal(await healthCheck([],p.env,p.runtime),0);assert.equal(p.requests(),1);
 const out=JSON.parse(p.output[0]);assert.equal(out.targets.length,12);assert.ok(!p.output[0].includes('DO_NOT_PRINT'));assert.ok(!p.output[0].includes('opaque-proxy'));
});
test('network probe defaults off, rejects arguments and never retries failed or malformed attestation',async()=>{
 let p=probeFixture();delete p.env.FATTAL_CLOUD_NETWORK_READ_ENABLED;assert.equal(await healthCheck([],p.env,p.runtime),1);assert.equal(p.requests(),0);
 p=probeFixture();assert.equal(await healthCheck(['upload'],p.env,p.runtime),1);assert.equal(p.requests(),0);
 for(const change of [h=>h.scopes.push('write'),h=>h.writesEnabled=true,h=>h.expiresAt=now,h=>h.ownerId='foreign',h=>h.targets.pop(),h=>h.targets[0]=h.targets[1],h=>h.notificationsEnabled=true,h=>h.targets[0].expectedVersion='bad']){
  p=probeFixture();change(p.health);assert.equal(await healthCheck([],p.env,p.runtime),1);assert.equal(p.requests(),1);assert.equal(p.output[0],'{"error":"Read-only health check failed","retryAllowed":false}\n');
 }
});
