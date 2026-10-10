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
const { doc, setDoc, updateDoc, deleteDoc, getDoc, serverTimestamp, deleteField, writeBatch } = deps('firebase/firestore');
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
test('ordinary authenticated user cannot change own role via update, merge, replacement or field deletion',async()=>{
 const db=client(),ref=doc(db,'users','alice');
 for(const role of ['super_admin','producer']){
  await assertFails(updateDoc(ref,{role}));await assertFails(setDoc(ref,{role},{merge:true}));
  await assertFails(setDoc(ref,profile('alice@example.invalid',role)));
 }
 await assertFails(updateDoc(ref,{role:deleteField()}));
});
test('first registration permits only own free profile with bound email and baseline storage',async()=>{
 const db=client('new'),ref=doc(db,'users','new');
 for(const change of [{role:'super_admin'},{role:'producer'},{email:'other@example.invalid'},{storageLimit:1e12},{storageUsed:-1},{admin:true}])await assertFails(setDoc(ref,{...profile('new@example.invalid'),...change}));
 await assertFails(setDoc(doc(db,'users','someone-else'),profile('new@example.invalid')));
 await assertSucceeds(setDoc(ref,profile('new@example.invalid')));
});
test('email, storageLimit and createdAt cannot be forged or deleted; ordinary profile/storage accounting remains compatible',async()=>{
 const ref=doc(client(),'users','alice');
 for(const change of [{email:'other@example.invalid'},{storageLimit:1e12},{createdAt:serverTimestamp()},{email:deleteField()},{storageLimit:deleteField()}])await assertFails(updateDoc(ref,change));
 await assertSucceeds(updateDoc(ref,{displayName:'Updated',storageUsed:120,updatedAt:serverTimestamp()}));
 assert.equal((await getDoc(ref)).data().role,'free');
});
test('delete/recreate and batched promotion plus foreign code update are denied atomically',async()=>{
 const db=client();await assertFails(deleteDoc(doc(db,'users','alice')));
 const batch=writeBatch(db);batch.update(doc(db,'users','alice'),{role:'super_admin'});batch.update(doc(db,'codes','bob-code'),{name:'Unauthorized'});
 await assertFails(batch.commit());assert.equal((await getDoc(doc(db,'users','alice'))).data().role,'free');
 assert.equal((await getDoc(doc(db,'codes','bob-code'))).data().name,'Original');
});
test('ordinary/unauthenticated clients cannot manage foreign profiles; existing trusted admin management still works',async()=>{
 await assertFails(updateDoc(doc(client(),'users','bob'),{role:'super_admin'}));
 await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(),'users','anonymous'),profile('anonymous@example.invalid')));
 const db=client('root');await assertSucceeds(updateDoc(doc(db,'users','bob'),{role:'free',storageLimit:25*1024*1024}));
 await assertSucceeds(setDoc(doc(db,'users','new-admin'),profile('new-admin@example.invalid','super_admin')));
 await assertSucceeds(deleteDoc(doc(db,'users','new-admin')));
});
test('denied promotion cannot turn actual server super-admin or foreign-owner guard into success',async()=>{
 globalThis.rulesAuthFixture.uid='alice';
 assert.equal((await auth.requireSuperAdmin(request())).response.status,403);
 await assertFails(updateDoc(doc(client(),'users','alice'),{role:'super_admin'}));
 assert.equal((await auth.requireSuperAdmin(request())).response.status,403);
 assert.equal((await auth.requireCodeOwner(request(),'bob-code')).response.status,403);
 globalThis.rulesAuthFixture.uid='root';assert.equal((await auth.requireSuperAdmin(request())).isSuperAdmin,true);
 assert.equal((await auth.requireCodeOwner(request(),'bob-code')).isSuperAdmin,true);
});
test('email claims and forged role claims never bootstrap administrator documents',async()=>{
 const db=client('unprovisioned',{email:'root@example.invalid',role:'super_admin'});
 await assertFails(setDoc(doc(db,'users','unprovisioned'),profile('root@example.invalid','super_admin')));
 await assertSucceeds(setDoc(doc(db,'users','unprovisioned'),profile('root@example.invalid')));
 globalThis.rulesAuthFixture.uid='unprovisioned';assert.equal((await auth.requireSuperAdmin(request())).response.status,403);
});
