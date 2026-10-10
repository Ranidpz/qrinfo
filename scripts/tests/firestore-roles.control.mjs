import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadTs, stub } from './load-ts.mjs';

// Explicit local emulator only: no SDK default project, ADC or production endpoint.
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8088');
const deps = createRequire(process.env.RULES_TEST_DEPENDENCY_ROOT ? resolve(process.env.RULES_TEST_DEPENDENCY_ROOT, 'package.json') : new URL('../security-rules/package.json', import.meta.url));
const { initializeTestEnvironment, assertFails, assertSucceeds } = deps('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, getDoc, serverTimestamp } = deps('firebase/firestore');
let env;
const profile = (email, role = 'free') => ({email, role, displayName:'Fixture', storageLimit:25*1024*1024,storageUsed:0,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
const client = (uid = 'alice', claims = {}) => env.authenticatedContext(uid,{email:`${uid}@example.invalid`,email_verified:true,...claims}).firestore();
before(async()=>{
 const path=process.env.RULES_TEST_SOURCE || new URL('../../firestore.rules',import.meta.url);
 env=await initializeTestEnvironment({projectId:'demo-qrinfo-role-review',firestore:{host:'127.0.0.1',port:8088,rules:await readFile(path,'utf8')}});
});
after(async()=>{await env?.cleanup();});
beforeEach(async()=>{
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async context=>{
  const db=context.firestore();
  for(const [uid,role] of [['alice','free'],['bob','producer'],['root','super_admin']])await setDoc(doc(db,'users',uid),profile(`${uid}@example.invalid`,role));
  await setDoc(doc(db,'codes','bob-code'),{ownerId:'bob',collaborators:[],name:'Original'});
 });
});
// Exercise the actual server guard with only token verification and database transport
// stubbed. Its document lookup reads the actual emulator state with admin privileges.
async function readFixture(collection, id) {
 let snapshot;
 await env.withSecurityRulesDisabled(async context => {
  snapshot = await getDoc(doc(context.firestore(), collection, id));
 });
 return { exists: snapshot.exists(), data: () => snapshot.data() };
}
globalThis.rulesAuthFixture={
 uid:'alice',
 getUser:uid=>readFixture('users',uid),
 getCode:id=>readFixture('codes',id),
};
const auth=await loadTs('../../src/lib/auth.ts',{
 'next/server':stub('export const NextResponse={json:(body,init)=>new Response(JSON.stringify(body),init)};'),
 'firebase-admin/auth':stub('export const getAuth=()=>({verifyIdToken:async()=>({uid:globalThis.rulesAuthFixture.uid})});'),
 '@/lib/firebase-admin':stub('export const getAdminApp=()=>({});export const getAdminDb=()=>({collection:name=>({doc:id=>({get:()=>name==="users"?globalThis.rulesAuthFixture.getUser(id):globalThis.rulesAuthFixture.getCode(id)})})});'),
});
const request=()=>new Request('http://127.0.0.1/admin',{headers:{Authorization:'Bearer emulator-fixture'}});
test('baseline permits self-promotion and actual server guard bypass; candidate denies both',async()=>{
 const baseline=process.env.RULES_TEST_EXPECT_VULNERABLE === '1';
 globalThis.rulesAuthFixture.uid='alice';
 assert.equal((await auth.requireSuperAdmin(request())).response.status,403);
 assert.equal((await auth.requireCodeOwner(request(),'bob-code')).response.status,403);
 const promotion=updateDoc(doc(client(),'users','alice'),{role:'super_admin'});
 if(baseline){
  await assertSucceeds(promotion);
  assert.equal((await auth.requireSuperAdmin(request())).isSuperAdmin,true);
  assert.equal((await auth.requireCodeOwner(request(),'bob-code')).isSuperAdmin,true);
  await assertSucceeds(updateDoc(doc(client(),'codes','bob-code'),{name:'Fixture unauthorized update'}));
 }else{
  await assertFails(promotion);
  assert.equal((await auth.requireSuperAdmin(request())).response.status,403);
  assert.equal((await auth.requireCodeOwner(request(),'bob-code')).response.status,403);
  await assertFails(updateDoc(doc(client(),'codes','bob-code'),{name:'Fixture unauthorized update'}));
 }
});
