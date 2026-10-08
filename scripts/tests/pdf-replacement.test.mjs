import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs, stub } from './load-ts.mjs';

const { replaceCodePdfWithBuffer } = await loadTs('../../src/lib/content-intake/pdf-replacement.ts', {
  'firebase-admin/firestore': stub(`export const FieldValue={serverTimestamp:()=>0,increment:n=>({increment:n})};export class Timestamp{static now(){return {toDate:()=>new Date(0)}}}`),
  '@/lib/firebase-admin': stub('export const getAdminDb=()=>globalThis.pdfCleanupFixture.db;'),
  '@/lib/server-storage': stub('export const deleteStoredObjectByUrl=async url=>globalThis.pdfCleanupFixture.remove(url);'),
  '@/lib/r2-storage': stub(`export const R2_STORAGE_PROVIDER='cloudflare-r2';export const buildStorageKey=(_,name)=>name;export const buildUniqueFilename=()=>String(++globalThis.pdfCleanupFixture.sequence);export const uploadBufferToR2=async({key,body})=>globalThis.pdfCleanupFixture.upload(key,body);`),
  'pdfjs-dist/legacy/build/pdf.mjs': stub('export const getDocument=()=>({promise:Promise.resolve({numPages:1,destroy:async()=>{}})});'),
});

const input = extra => ({buffer:Buffer.from('%PDF-1.7\nfixture'),filename:'booklet.pdf',contentType:'application/pdf',...extra});
const size = input().buffer.length;
const copy = value => Array.isArray(value) ? value.map(copy)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key,item])=>[key,copy(item)])) : value;

function fixture({usage=size,limit=size,failDelete=false,failCredit=false}={}) {
  const oldUrl='https://storage.test/old.pdf';
  const records=new Map([
    ['codes/code',{ownerId:'owner',media:[{id:'pdf',url:oldUrl,type:'pdf',size,uploadedBy:'owner'}]}],
    ['users/owner',{storageUsed:usage,storageLimit:limit}],
  ]);
  const objects=new Set([oldUrl]);const deleted=[];const usageAtDelete=[];
  const snapshot=ref=>({exists:records.has(ref.path),data:()=>copy(records.get(ref.path))});
  let queue=Promise.resolve();
  const state={records,objects,deleted,usageAtDelete,sequence:0,failDelete,failCredit,
    db:{collection:collection=>({doc:id=>({path:`${collection}/${id}`,get:async function(){return snapshot(this);}}),
      where:(field,_op,value)=>({limit:limit=>({get:async()=>({docs:[...records].filter(([key,data])=>key.startsWith(`${collection}/`)&&data[field]===value).slice(0,limit).map(([key])=>({ref:{path:key,get:async()=>snapshot({path:key})}}))})})})}),
      runTransaction:fn=>{
        const run=queue.then(async()=>{
          const writes=[];
          const result=await fn({get:async ref=>snapshot(ref),set:(ref,data)=>writes.push(['set',ref.path,data]),
            update:(ref,data)=>writes.push(['update',ref.path,data]),delete:ref=>writes.push(['delete',ref.path])});
          if(state.failCredit&&writes.some(([op])=>op==='delete'))throw Error('credit unavailable');
          for(const [op,key,data]of writes){
            if(op==='delete'){records.delete(key);continue;}
            const next=op==='set'?{}:copy(records.get(key));
            for(const [field,value]of Object.entries(data))next[field]=value&&typeof value==='object'&&'increment'in value?(next[field]||0)+value.increment:value;
            records.set(key,next);
          }
          return result;
        });
        queue=run.catch(()=>{});return run;
      }},
    upload:async(key,body)=>{const url=`https://storage.test/${key}.pdf`;objects.add(url);return{key,url,size:body.length,bucket:'bucket',provider:'cloudflare-r2',contentType:'application/pdf'};},
    remove:async url=>{
      usageAtDelete.push(records.get('users/owner').storageUsed);
      if(url===oldUrl){
        assert.notEqual(records.get('codes/code').media[0].url,oldUrl,'publish new PDF before deleting old');
        if(state.failDelete)throw Error('delete unavailable');
      }
      deleted.push(url);objects.delete(url);
    },
  };
  globalThis.pdfCleanupFixture=state;return state;
}

test('legacy retention flags cannot accumulate uncharged brochures; replacements work at quota',async()=>{
  const s=fixture();
  for(const flag of [false,'false',0,undefined]){
    const result=await replaceCodePdfWithBuffer('code',input({deleteOld:flag}),{expectedOwnerId:'owner'});
    assert.equal(result.storageDelta,0);assert.equal(result.warning,undefined);
    assert.equal(s.records.get('users/owner').storageUsed,size);
    assert.deepEqual([...s.objects],[result.url]);
    assert.equal([...s.records.keys()].filter(k=>k.startsWith('contentIntakePdfCleanup/')).length,0);
  }
  assert.deepEqual(s.usageAtDelete,Array(4).fill(size*2),'old bytes stay charged until deletion');
});

test('failed deletion preserves live new PDF, charged old bytes and durable cleanup record',async()=>{
  const s=fixture({failDelete:true});
  const result=await replaceCodePdfWithBuffer('code',input());
  assert.match(result.warning,/cleanup is pending/);assert.equal(result.storageDelta,size);
  assert.equal(s.records.get('codes/code').media[0].url,result.url);
  assert.equal(s.records.get('users/owner').storageUsed,size*2);assert.equal(s.objects.size,2);
  const pending=[...s.records].find(([k])=>k.startsWith('contentIntakePdfCleanup/'))[1];
  assert.equal(pending.chargedBytes,size);assert.equal(pending.oldUrl,'https://storage.test/old.pdf');
  await assert.rejects(replaceCodePdfWithBuffer('code',input()),/Storage quota exceeded/);
  assert.equal(s.objects.size,2,'blocked subsequent upload is rolled back');
});

test('accounting failure after deletion never removes the newly published PDF',async()=>{
  const s=fixture({failCredit:true});
  const result=await replaceCodePdfWithBuffer('code',input());
  assert.match(result.warning,/cleanup is pending/);
  assert.deepEqual([...s.objects],[result.url]);assert.equal(s.records.get('users/owner').storageUsed,size*2);
  assert.ok([...s.records.keys()].some(k=>k.startsWith('contentIntakePdfCleanup/')));
});

test('quota rejection preserves old brochure and removes only the rejected upload',async()=>{
  const s=fixture({limit:size-1});
  await assert.rejects(replaceCodePdfWithBuffer('code',input({buffer:Buffer.concat([input().buffer,Buffer.from('more')])})),/Storage quota exceeded/);
  assert.deepEqual([...s.objects],['https://storage.test/old.pdf']);
  assert.equal(s.records.get('users/owner').storageUsed,size);
});

test('next replacement recovers a transient deletion failure and charges only live PDF',async()=>{
  const s=fixture({failDelete:true});
  await replaceCodePdfWithBuffer('code',input());
  s.failDelete=false;
  const result=await replaceCodePdfWithBuffer('code',input());
  assert.equal(result.warning,undefined);assert.equal(s.records.get('users/owner').storageUsed,size);
  assert.deepEqual([...s.objects],[result.url]);
  assert.equal([...s.records.keys()].filter(k=>k.startsWith('contentIntakePdfCleanup/')).length,0);
});

test('next replacement recovers deletion already completed but accounting failed',async()=>{
  const s=fixture({failCredit:true});
  await replaceCodePdfWithBuffer('code',input());
  s.failCredit=false;
  const result=await replaceCodePdfWithBuffer('code',input());
  assert.equal(s.records.get('users/owner').storageUsed,size);
  assert.deepEqual([...s.objects],[result.url]);
});

test('over-quota owner can reduce brochure size without any unresolved cleanup debt',async()=>{
  const s=fixture({usage:size*3,limit:size});
  s.records.get('codes/code').media[0].size=size*2;
  const result=await replaceCodePdfWithBuffer('code',input());
  assert.equal(result.warning,undefined);assert.equal(result.storageDelta,-size);
  assert.equal(s.records.get('users/owner').storageUsed,size*2);
});

test('retained bytes prevent another code from reusing space before deletion completes',async()=>{
  const s=fixture({usage:size*2,limit:size*2,failDelete:true});
  s.records.set('codes/other',{ownerId:'owner',media:[{id:'pdf',url:'https://storage.test/other.pdf',type:'pdf',size,uploadedBy:'owner'}]});
  s.objects.add('https://storage.test/other.pdf');
  const results=await Promise.allSettled(['code','other'].map(id=>replaceCodePdfWithBuffer(id,input())));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.filter(r=>r.status==='rejected'&&/quota/.test(r.reason.message)).length,1);
  assert.equal(s.records.get('users/owner').storageUsed,size*3);
});

test('old media not charged to this owner does not produce a quota credit',async()=>{
  const s=fixture({usage:0,limit:size});
  s.records.get('codes/code').media[0].uploadedBy='another-owner';
  const result=await replaceCodePdfWithBuffer('code',input());
  assert.equal(result.storageDelta,size);assert.equal(s.records.get('users/owner').storageUsed,size);
  assert.deepEqual([...s.objects],[result.url]);
});
