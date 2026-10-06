import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { loadTs, stub } from './load-ts.mjs';

const { buildFattalPreview, FATTAL_BOOKLET_TARGETS } = await loadTs('../../src/lib/content-intake/fattal.ts');
const { selectBatchMatches } = await loadTs('../../src/lib/content-intake/batch-preview.ts');
const { collectBatchResults } = await loadTs('../../src/lib/content-intake/batch-results.ts');
const { buildDedupeId } = await loadTs('../../src/lib/content-intake/file-dedupe.ts');
const target = { ...FATTAL_BOOKLET_TARGETS.find(t => t.shortId === '7KRYAj'), codeId:'plaza-dead-sea', ownerId:'owner', currentUrl:'https://pdf.test/old.pdf' };
const old = { id:'old', name:'לאונרדו פלאזה ים המלח אמצש 041026.pdf', source:'whatsapp', sourceMessageId:'morning-message', receivedAt:'2026-10-04T06:30:00Z', sha256:'a'.repeat(64), size:331000 };
const correction = { ...old, id:'correction', sourceMessageId:'13-47-message', receivedAt:'2026-10-04T10:47:00Z', sha256:'b'.repeat(64) };
const receipt = { ownerId:'owner', codeId:target.codeId, filename:old.name, fileHash:old.sha256, sourceMessageId:old.sourceMessageId, detectedDate:'2026-10-04', updatedAt:'2026-10-04T10:15:00Z', url:target.currentUrl };
const params = { files:[old,correction], targets:[target], generatedAt:new Date('2026-10-04T11:07:00Z'), confirmedUpdates:[receipt] };
const statuses = p => buildFattalPreview(p).matches.map(m => m.status);

test('Oct 4 correction after confirmed upload is selected without uploading the old bytes again', () => {
  const result = buildFattalPreview(params);
  assert.deepEqual(statuses(params), ['matched','matched']);
  assert.equal(result.matches[0].replacesConfirmedUrl, undefined);
  assert.equal(result.matches[1].replacesConfirmedUrl, target.currentUrl);
  assert.match(result.matches[1].reasons.join(' '), /גרסה חדשה/);
  assert.equal(result.missingTargets.length,0);
  assert.equal(selectBatchMatches(result,[correction]).matches[0].replacesConfirmedUrl,target.currentUrl);
  const results = collectBatchResults(result,[
    {fileId:old.id,filename:old.name,codeId:target.codeId,status:'skipped_duplicate',updatedAt:receipt.updatedAt},
    {fileId:correction.id,filename:correction.name,codeId:target.codeId,status:'updated',updatedAt:'2026-10-04T11:07:10Z'},
  ]);
  assert.deepEqual(results.map(r=>r.status),['skipped_duplicate','updated']);
  assert.equal(results[0].updatedAt,receipt.updatedAt);
});

test('timestamps alone, unconfirmed baselines, earlier posts and changed live PDFs cannot authorize correction', () => {
  for (const change of [
    {confirmedUpdates:[]},
    {confirmedUpdates:[{...receipt,ownerId:'other'}]},
    {confirmedUpdates:[{...receipt,codeId:'other'}]},
    {confirmedUpdates:[{...receipt,fileHash:'c'.repeat(64)}]},
    {confirmedUpdates:[{...receipt,sourceMessageId:'other'}]},
    {confirmedUpdates:[{...receipt,detectedDate:'2026-10-01'}]},
    {confirmedUpdates:[{...receipt,updatedAt:'invalid'}]},
    {targets:[{...target,currentUrl:'https://pdf.test/manual-newer.pdf'}]},
    {files:[old,{...correction,receivedAt:'2026-10-04T10:14:00Z'}]},
    {files:[old,{...correction,receivedAt:'2026-10-04T12:00:00Z'}]},
    {files:[old,{...correction,sourceMessageId:old.sourceMessageId}]},
    {files:[old,{...correction,source:'manual'}]},
    {files:[old,{...correction,name:'לאונרדו פלאזה ים המלח סופש 041026.pdf'}]},
    {files:[old,{...correction,name:'לאונרדו פלאזה ים המלח אמצש 051026.pdf'}]},
    {files:[{...old,name:'לאונרדו פלאזה ים המלח.pdf'},{...correction,name:'לאונרדו פלאזה ים המלח.pdf'}]},
  ]) assert.deepEqual(statuses({...params,...change}),['duplicate','duplicate'],JSON.stringify(change));
});

test('two unconfirmed revisions remain ambiguous, including split uploads', () => {
  const files=[old,correction,{...correction,id:'third',sourceMessageId:'third-message',sha256:'c'.repeat(64),receivedAt:'2026-10-04T10:55:00Z'}];
  const result=buildFattalPreview({...params,files});
  assert.deepEqual(result.matches.map(m=>m.status),['duplicate','duplicate','duplicate']);
  assert.equal(selectBatchMatches(result,[correction]).matches[0].status,'duplicate');
});

test('confirmed correction remains idempotent during full-manifest replay', () => {
  const newReceipt={...receipt,fileHash:correction.sha256,sourceMessageId:correction.sourceMessageId,updatedAt:'2026-10-04T11:07:10Z',url:'https://pdf.test/new.pdf'};
  const result=buildFattalPreview({...params,generatedAt:new Date('2026-10-04T11:08:00Z'),targets:[{...target,currentUrl:newReceipt.url}],confirmedUpdates:[receipt,newReceipt]});
  assert.deepEqual(result.matches.map(m=>m.status),['matched','matched']);
  assert.ok(result.matches.every(m=>!m.replacesConfirmedUrl));
});

test('server preview reads only successful owner-scoped receipts and fails closed on unavailable storage', async () => {
  const actualModule = async relative => stub(ts.transpileModule(await readFile(new URL(relative,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
  const reads=[];
  let record={...receipt,replacedAt:receipt.updatedAt,workflow:'fattal-booklets',status:'updated',source:'whatsapp'};
  let fail=false;
  globalThis.correctionDb={collection:name=>{assert.equal(name,'contentIntakeFileUpdates');return {doc:id=>({get:async()=>{reads.push(id);if(fail)throw Error('storage unavailable');return {data:()=>id===buildDedupeId(target.codeId,old.sha256)?record:undefined};}})};}};
  try {
    const {buildVerifiedFattalPreview}=await loadTs('../../src/lib/content-intake/verified-preview.ts',{
      '@/lib/firebase-admin':stub('export const getAdminDb=()=>globalThis.correctionDb;'),
      './fattal':await actualModule('../../src/lib/content-intake/fattal.ts'),
      './file-dedupe':await actualModule('../../src/lib/content-intake/file-dedupe.ts'),
    });
    const {confirmedUpdates,...input}=params;
    assert.deepEqual((await buildVerifiedFattalPreview(input)).matches.map(m=>m.status),['matched','matched']);
    assert.deepEqual(new Set(reads),new Set([buildDedupeId(target.codeId,old.sha256),buildDedupeId(target.codeId,correction.sha256)]));
    for(const invalid of [{status:'failed'},{ownerId:'other'},{source:'manual'},{workflow:'other'}]) {
      const original=record;record={...record,...invalid};
      assert.deepEqual((await buildVerifiedFattalPreview(input)).matches.map(m=>m.status),['duplicate','duplicate']);
      record=original;
    }
    fail=true;await assert.rejects(buildVerifiedFattalPreview(input),/storage unavailable/);
  }finally{delete globalThis.correctionDb;}
});

test('changed baseline during commit rolls back upload without modifying the target', async () => {
  const deleted=[];let writes=0;
  globalThis.correctionCommitDb={
    collection:name=>({doc:id=>({name,id,get:async()=>({exists:true,data:()=>({ownerId:'owner'})})})}),
    runTransaction:async fn=>fn({get:async ref=>({exists:true,data:()=>ref.name==='codes'?{ownerId:'owner',media:[{type:'pdf',url:'https://pdf.test/manual.pdf'}]}:{}}),update:()=>writes++}),
  };
  globalThis.correctionDeleted=deleted;
  try {
    const {replaceCodePdfWithBuffer}=await loadTs('../../src/lib/content-intake/pdf-replacement.ts',{
      'firebase-admin/firestore':stub('export const FieldValue={}; export class Timestamp {}'),
      '@/lib/firebase-admin':stub('export const getAdminDb=()=>globalThis.correctionCommitDb;'),
      '@/lib/server-storage':stub('export const deleteStoredObjectByUrl=async url=>globalThis.correctionDeleted.push(url);'),
      '@/lib/r2-storage':stub('export const buildStorageKey=()=>"key"; export const buildUniqueFilename=()=>"name.pdf"; export const R2_STORAGE_PROVIDER="cloudflare-r2"; export const uploadBufferToR2=async()=>({url:"https://pdf.test/upload.pdf",size:10});'),
      'pdfjs-dist/legacy/build/pdf.mjs':stub('export const getDocument=()=>({promise:Promise.resolve({numPages:1,destroy:async()=>{}})});'),
    });
    await assert.rejects(replaceCodePdfWithBuffer(target.codeId,{buffer:Buffer.from('%PDF-1.7\nfixture'),filename:old.name,contentType:'application/pdf'},{expectedOwnerId:'owner',expectedCurrentUrl:target.currentUrl}),/Confirmed booklet changed/);
    assert.equal(writes,0);assert.deepEqual(deleted,['https://pdf.test/upload.pdf']);
  }finally{delete globalThis.correctionCommitDb;delete globalThis.correctionDeleted;}
});
