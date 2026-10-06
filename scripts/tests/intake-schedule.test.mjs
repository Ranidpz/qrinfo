import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadTs, stub } from './load-ts.mjs';
const scheduleUrl = stub((await import('typescript')).default.transpileModule(await readFile('src/lib/content-intake/schedule.ts', 'utf8'), {compilerOptions:{module:99,target:9}}).outputText);
const schedule = await import(scheduleUrl);
const responseStub = stub('export const NextResponse={json:(value,init)=>new Response(JSON.stringify(value),init)};');
const firestoreStub = stub('export const FieldValue={serverTimestamp:()=>123};');

test('schedule rejects duplicates, empty or malformed times and days', () => {
  for (const bad of [[],[{weekday:7,time:'12:00'}],[{weekday:0,time:'24:00'}],[{weekday:1,time:'2:05'}],[{weekday:0,time:'10:00'},{weekday:0,time:'10:00'}], Array(29).fill({weekday:0,time:'10:00'})]) assert.equal(schedule.validateChecks(bad),null);
  assert.deepEqual(schedule.validateChecks([{weekday:4,time:'14:00'},{weekday:0,time:'10:05'}]),[{weekday:0,time:'10:05'},{weekday:4,time:'14:00'}]);
});

test('settings requires super admin and prevents lost updates; runner key can only read/ack its owner', async () => {
  const settings = new Map(); const agents = new Map();
  const db = { collection(name) { return { doc(id) { const map = name === 'contentIntakeSettings' ? settings : agents; return { get:async()=>({data:()=>map.get(id)}),set:async value=>map.set(id,value), map,id }; } }; }, runTransaction:async fn=>fn({get:ref=>ref.get(),set:(ref,v)=>ref.map.set(ref.id,v)}) };
  globalThis.__scheduleDb = db;
  const management = await loadTs('../../src/app/api/content-intake/settings/route.ts',{
    'next/server':responseStub, 'firebase-admin/firestore':firestoreStub,
    '@/lib/auth':stub('export const requireSuperAdmin=async r=>r.headers.get("authorization")==="admin"?{uid:"admin-id"}:{response:new Response("Forbidden",{status:403})}; export const isAuthError=a=>!!a.response;'),
    '@/lib/firebase-admin':stub('export const getAdminDb=()=>globalThis.__scheduleDb;'),
    '@/lib/content-intake/fattal-server':stub('export const loadMappedFattalTargets=async id=>id==="owner-a"?[{}]:[];'),
    '@/lib/content-intake/schedule':scheduleUrl,
  });
  const req = (body,auth='admin',owner='owner-a') => { const r=new Request(`https://example.com/settings?ownerId=${owner}`,{method:body?'PATCH':'GET',headers:{authorization:auth},...(body?{body:JSON.stringify(body)}:{})});r.nextUrl=new URL(r.url);return r; };
  assert.equal((await management.GET(req(null,'producer'))).status,403);
  assert.equal((await management.PATCH(req({checks:schedule.DEFAULT_CHECKS,revision:'default-v1'},'producer'))).status,403);
  assert.equal((await management.GET(req(null,'admin','unmapped'))).status,400);
  const initial=await (await management.GET(req())).json();
  const changed=await (await management.PATCH(req({checks:[{weekday:2,time:'11:45'}],revision:initial.revision}))).json();
  assert.ok(changed.revision!==initial.revision); assert.ok(Date.parse(changed.effectiveAfter));
  assert.equal((await management.PATCH(req({checks:schedule.DEFAULT_CHECKS,revision:initial.revision}))).status,409);
  const runner=await loadTs('../../src/app/api/content-intake/fattal/config/route.ts',{
    'next/server':responseStub, 'firebase-admin/firestore':firestoreStub,
    '@/lib/firebase-admin':stub('export const getAdminDb=()=>globalThis.__scheduleDb;'),
    '@/lib/content-intake/fattal-server':stub('export const authenticateIntakeKey=async r=>r.headers.get("authorization")==="key"?{ownerId:"owner-a"}:false; export const resolveFattalOwnerId=async({integrationAuth})=>integrationAuth.ownerId;'),
    '@/lib/content-intake/schedule':scheduleUrl,
  });
  assert.equal((await runner.GET(req())).status,401);
  assert.deepEqual(await (await runner.GET(req(null,'key','other-owner'))).json(),changed);
  assert.equal((await runner.POST(req({agentId:'mac-test',revision:initial.revision},'key'))).status,409);
  assert.equal((await runner.POST(req({agentId:'mac-test',revision:changed.revision,ownerId:'other-owner'},'key'))).status,200);
  assert.equal([...agents.values()][0].ownerId,'owner-a');
  assert.equal([...agents.values()][0].scheduleRevision,changed.revision);
  delete globalThis.__scheduleDb;
});

test('computer registration binds a key once; disconnect stops sync and cannot undo a revoked key', async () => {
  const store = new Map([['contentIntakeConnections/connection-a',{ownerId:'owner-a',name:'Michal Mac'}]]);
  const db = {collection(name){return{doc(id){return{key:`${name}/${id}`,get:async()=>({data:()=>store.get(`${name}/${id}`)})};}}},runTransaction:async fn=>fn({get:ref=>ref.get(),set:(ref,v)=>store.set(ref.key,{...store.get(ref.key),...v})})};
  globalThis.__computerDb=db;
  const deps={'next/server':responseStub,'firebase-admin/firestore':firestoreStub,'@/lib/firebase-admin':stub('export const getAdminDb=()=>globalThis.__computerDb;')};
  const runner=await loadTs('../../src/app/api/content-intake/fattal/config/route.ts',{
    ...deps,'@/lib/content-intake/schedule':scheduleUrl,
    '@/lib/content-intake/fattal-server':stub('export const authenticateIntakeKey=async()=>({ownerId:"owner-a",connectionId:"connection-a"}); export const resolveFattalOwnerId=async()=>"owner-a";'),
  });
  const control=await loadTs('../../src/app/api/content-intake/computers/route.ts',{
    ...deps,'@/lib/auth':stub('export const requireSuperAdmin=async r=>r.headers.get("authorization")==="admin"?{uid:"admin-a"}:{response:new Response("Forbidden",{status:403})};export const isAuthError=a=>!!a.response;'),
  });
  const body={agentId:'mac-michal',revision:'default-v1',computerName:'Mac-mini',runnerVersion:'0.5.0',scheduleEnabled:true,autoCommit:true};
  const req=(body,auth='admin')=>new Request('https://example.com/config',{method:'POST',headers:{authorization:auth},body:JSON.stringify(body)});
  assert.equal((await runner.POST(req(body))).status,200);
  const [key,agent]=[...store].find(([key])=>key.startsWith('contentIntakeAgents/'));
  assert.equal(agent.computerName,'Michal Mac');assert.equal(agent.remoteControl,true);assert.equal(agent.lastSeenAt,123);
  assert.equal(store.get('contentIntakeConnections/connection-a').agentId,'mac-michal');
  assert.equal((await runner.POST(req({...body,agentId:'mac-other'}))).status,403);
  assert.equal((await runner.GET(new Request('https://example.com/config?agentId=mac-other'))).status,409);
  const command={id:key.split('/')[1],action:'disconnect'};
  assert.equal((await control.PATCH(req(command,'producer'))).status,403);
  assert.equal((await control.PATCH(req(command))).status,200);
  assert.equal(store.get('contentIntakeConnections/connection-a').disabledAt,123);
  assert.equal((await runner.GET(new Request('https://example.com/config?agentId=mac-michal'))).status,403);
  assert.equal((await runner.POST(req(body))).status,403);
  assert.equal((await control.PATCH(req({...command,action:'reconnect'}))).status,200);
  assert.equal((await runner.POST(req(body))).status,200);
  store.get('contentIntakeConnections/connection-a').revokedAt=123;
  assert.equal((await control.PATCH(req({...command,action:'reconnect'}))).status,409);
  delete globalThis.__computerDb;
});
