import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs, stub } from './load-ts.mjs';
const fattal = await loadTs('../../src/lib/content-intake/fattal.ts');
const state = { authenticated: true, role: 'super_admin', reads: [], codes: [], owner: { email: 'owner@example.invalid' } };
globalThis.setupTest = { fattal, state };
const expose = name => stub(Object.keys(globalThis.setupTest[name]).map(key => `export const ${key}=globalThis.setupTest.${name}.${key};`).join('\n'));
const setup = await loadTs('../../src/lib/content-intake/setup-review.ts', { './fattal': expose('fattal') });
globalThis.setupTest.setup = setup;
const next = stub('export const NextResponse={json:(body,init)=>new Response(JSON.stringify(body),init)};');
const auth = await loadTs('../../src/lib/auth.ts', {
 'next/server': next,
 'firebase-admin/auth': stub(`export const getAuth=()=>({verifyIdToken:async()=>{if(!globalThis.setupTest.state.authenticated)throw Error();return {uid:'admin'};}});`),
 '@/lib/firebase-admin': stub(`export const getAdminApp=()=>({});export const getAdminDb=()=>({collection:name=>{if(name!=='users')throw Error();return {doc:()=>({get:async()=>({data:()=>({role:globalThis.setupTest.state.role})})})};}});`),
});
globalThis.setupTest.auth = auth;
const route = await loadTs('../../src/app/api/content-intake/dot/setup/route.ts', {
 'next/server': next, '@/lib/auth': expose('auth'), '@/lib/content-intake/fattal': expose('fattal'), '@/lib/content-intake/setup-review': expose('setup'),
 '@/lib/firebase-admin': stub(`export const getAdminApp=()=>({options:{projectId:'fixture'}});export const getAdminDb=()=>({collection:name=>{
 const s=globalThis.setupTest.state;s.reads.push(name);if(name==='users')return {doc:id=>{if(id!=='owner')throw Error();return {get:async()=>({exists:!!s.owner,data:()=>s.owner})};}};
 if(name==='codes')return {where:(field,op,ids)=>{if(field!=='shortId'||op!=='in'||ids.length!==12)throw Error();return {get:async()=>({docs:s.codes.map(code=>({data:()=>code}))})};}};
 throw Error('Unexpected access');}});`),
});
const selection = { ownerId:'owner', ownerEmail:'owner@example.invalid', projectId:'fixture', durationHours:1 };
function reset() {
 Object.assign(state,{authenticated:true,role:'super_admin',reads:[],owner:{email:selection.ownerEmail},codes:fattal.FATTAL_BOOKLET_TARGETS.map(t=>({shortId:t.shortId,ownerId:'owner'}))});
 process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID='fixture';
 for(const key of ['FATTAL_CLOUD_PROJECT_ID','FATTAL_CLOUD_OWNER_ID','FATTAL_CLOUD_OWNER_EMAIL','FATTAL_BOOKLETS_OWNER_ID','FATTAL_BOOKLETS_OWNER_EMAIL']) delete process.env[key];
}
async function request(query='',headers={Authorization:'Bearer fixture'}) {
 const url=new URL('https://fixture.invalid/api/content-intake/dot/setup'+query);const req=new Request(url,{headers});req.nextUrl=url;
 const response=await route.GET(req);assert.equal(response.headers.get('Cache-Control'),'no-store');return {status:response.status,body:await response.json()};
}
const query='?'+new URLSearchParams(selection);
test('setup requires actual super-admin auth before target access, including credential-only requests',async()=>{
 for(const scenario of ['missing','invalid','ordinary','cloud']){reset();if(scenario==='invalid')state.authenticated=false;if(scenario==='ordinary')state.role='user';
 const result=await request(query,scenario==='missing'?{}:scenario==='cloud'?{'x-fattal-cloud-key':'fixture'}:undefined);
 assert.equal(result.status,scenario==='ordinary'?403:401);assert.deepEqual(state.reads,[]);}
});
test('metadata does not guess owner or query targets; exact twelve proposal is read-only with no provisioning',async()=>{
 reset();let result=await request();assert.equal(result.status,200);assert.equal(result.body.projectId,'fixture');assert.deepEqual(state.reads,[]);
 result=await request(query);assert.equal(result.body.mappingVerified,true);assert.equal(result.body.targets.length,12);assert.deepEqual(result.body.proposal.scopes,['read']);
 assert.deepEqual(state.reads,['users','codes']);for(const key of ['credentialCreated','persisted','flagsChanged'])assert.equal(result.body[key],false);
 assert.equal(result.body.secretBinding,'unverified');assert.deepEqual(Object.keys(route).sort(),['GET','runtime']);
});
test('missing, duplicate, child and foreign owner target independently block proposal',async()=>{
 for(const [status,change] of [['missing',()=>state.codes.shift()],['duplicate',()=>state.codes.push({...state.codes[0]})],['child',()=>state.codes[0].parentCodeShortId='parent'],['owner_mismatch',()=>state.codes[0].ownerId='other']]){
 reset();change();const result=await request(query);assert.equal(result.status,200);assert.equal(result.body.mappingVerified,false);assert.equal(result.body.proposal,null);assert.ok(result.body.targets.some(t=>t.state===status));}
});
test('owner email, configured legacy/cloud owner and project conflicts fail closed',async()=>{
 for(const change of [()=>state.owner.email='different@example.invalid',()=>state.owner=null,()=>process.env.FATTAL_CLOUD_OWNER_ID='other',()=>process.env.FATTAL_BOOKLETS_OWNER_EMAIL='playzonest1@gmail.com',()=>process.env.FATTAL_CLOUD_PROJECT_ID='other',()=>process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID='other']){
 reset();change();const result=await request(query);assert.equal(result.status,409);assert.equal(result.body.proposal,undefined);}
});
test('untrusted, duplicate or incomplete parameters cannot extend duration, targets, owner or write permissions',async()=>{
 for(const suffix of ['?ownerId=owner',query+'&durationHours=1',query+'&scopes=write',query.replace('durationHours=1','durationHours=48'),query+'&allowedTargets=child',query.replace('projectId=fixture','projectId=other')]){
 reset();const result=await request(suffix);assert.ok([400,409].includes(result.status));assert.equal(state.reads.length,0);}
});
