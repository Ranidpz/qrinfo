import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load-ts.mjs';
const {createIntakeRunTelemetry}=await loadTs('../../src/lib/content-intake/run-telemetry.ts');
const inventory={files:2,bytes:4096};
test('run receipt measures inventory, four operation counters, duration, failures and explicit retries; billing stays unknown',()=>{
 let wall=100000,mono=10;const run=createIntakeRunTelemetry(inventory,{wall:()=>wall,monotonic:()=>mono});
 for(const operation of ['health','preview','commit','recovery'])run.recordOperation({operation,outcome:operation==='commit'?'failed':'completed',durationMs:2,retry:false});
 run.recordOperation({operation:'recovery',outcome:'completed',durationMs:3,retry:true});
 wall+=500;mono+=450;const result=run.finish('uncertain');
 assert.match(result.runId,/^[0-9a-f-]{36}$/);assert.equal(result.durationMs,450);assert.equal(result.files,2);assert.equal(result.bytes,4096);
 assert.equal(result.endedAt,new Date(wall).toISOString());assert.equal(result.operations.commit.failures,1);
 assert.equal(result.operations.recovery.attempts,2);assert.equal(result.retries,1);assert.equal(result.operationFailures,1);
 assert.deepEqual(result.billing,{cost:null,currency:null,status:'unknown'});
});
test('no secret, filename, URL, identity, hash or raw error payload is accepted into receipts',()=>{
 const run=createIntakeRunTelemetry({...inventory,token:'secret',filename:'sensitive.pdf'});
 run.recordOperation({operation:'health',outcome:'failed',durationMs:1,retry:false,error:'secret',ownerEmail:'secret',url:'https://secret.invalid'});
 const result=run.finish('failed');assert.equal(result.runFailures,1);
 assert.ok(!JSON.stringify(result).includes('secret'));assert.ok(!JSON.stringify(result).includes('sensitive'));
});
test('invalid inventory/events/outcomes fail without changing counters',()=>{
 for(const value of [-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>createIntakeRunTelemetry({files:value,bytes:0}));
 const run=createIntakeRunTelemetry(inventory);
 for(const event of [{operation:'email',outcome:'completed',durationMs:1,retry:false},{operation:'health',outcome:'secret-error',durationMs:1,retry:false},
 {operation:'health',outcome:'completed',durationMs:NaN,retry:false},{operation:'health',outcome:'completed',durationMs:1,retry:'yes'}])assert.throws(()=>run.recordOperation(event));
 assert.throws(()=>run.finish('secret'));assert.equal(run.snapshot().operations.health.attempts,0);
});
test('finalization is idempotent, snapshots cannot corrupt state and late events cannot change a receipt',()=>{
 const run=createIntakeRunTelemetry(inventory);const first=run.finish('completed');first.operations.health.attempts=999;
 assert.equal(run.snapshot().operations.health.attempts,0);assert.deepEqual(run.finish('completed'),run.snapshot());
 assert.throws(()=>run.finish('failed'));assert.throws(()=>run.recordOperation({operation:'health',outcome:'completed',durationMs:1,retry:false}));
});
test('clock corrections never produce negative run time; disabled runs report no operations',()=>{
 let wall=100000,mono=50;const run=createIntakeRunTelemetry({files:0,bytes:0},{wall:()=>wall,monotonic:()=>mono});wall-=10000;mono-=10;
 const result=run.finish('disabled');assert.equal(result.durationMs,0);assert.equal(result.endedAt,result.startedAt);
 assert.equal(result.retries,0);assert.equal(result.operationFailures,0);assert.equal(result.operations.commit.attempts,0);
});
