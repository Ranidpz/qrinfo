import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { buildFattalPreview, FATTAL_BOOKLET_TARGETS } = await loadTs('../../src/lib/content-intake/fattal.ts');
const { selectBatchMatches } = await loadTs('../../src/lib/content-intake/batch-preview.ts');
const { parseEvidence } = await loadTs('../../src/lib/content-intake/evidence.ts');
const targets = FATTAL_BOOKLET_TARGETS.map(t=>({...t, codeId:t.key, ownerId:'owner', currentMediaType:'pdf'}));
const file = {id:'one', sourceMessageId:'attachment', name:'תוכניית בידור סופש 240926.pdf', sha256:'a'.repeat(64), size:100, contentType:'application/pdf', receivedAt:'2026-09-24T01:00:00+03:00'};
const reply = {kind:'reply', text:'קלאב טבריה', targetMessageId:'attachment', messageId:'reply', senderId:'sender', attachmentSenderId:'sender', at:'2026-09-24T01:01:00+03:00'};
const preview = files => buildFattalPreview({files,targets});
test('explicit same-sender reply resolves generic filename without renaming original',()=>{
 const match=preview([{...file,evidence:[reply]}]).matches[0];
 assert.equal(match.status,'matched');assert.equal(match.target.shortId,'fjcVpn');assert.equal(match.file.name,file.name);assert.match(match.reasons[0],/קלאב טבריה/);
});
test('same generic filename may refer to different hotels via distinct message identities',()=>{
 const result=preview([{...file,evidence:[reply]}, {...file,id:'two',sourceMessageId:'attachment2',sha256:'b'.repeat(64),evidence:[{...reply,text:'פלאזה ים המלח',targetMessageId:'attachment2'}]}]);
 assert.deepEqual(result.matches.map(m=>[m.status,m.target?.shortId]),[['matched','fjcVpn'],['matched','7KRYAj']]);
});
test('wrong reply, sender, ambiguous prose, conflicting reply or filename stays unresolved',()=>{
 for (const patch of [{targetMessageId:'other'}, {senderId:'other'}, {text:'זה לא קלאב טבריה'}, {at:'2026-09-23T00:00:00Z'}]) {
  assert.notEqual(preview([{...file,evidence:[{...reply,...patch}]}]).matches[0].status,'matched');
 }
 assert.notEqual(preview([{...file,evidence:[reply,{...reply,messageId:'r2',text:'פלאזה ים המלח'}]}]).matches[0].status,'matched');
 assert.notEqual(preview([{...file,name:'הרודס אילת.pdf',evidence:[reply]}]).matches[0].status,'matched');
 assert.notEqual(preview([{...file,name:'תוכניית ים המלח.pdf',evidence:[reply]}]).matches[0].status,'matched');
});
test('caption uses original file date checks and requires same message identity',()=>{
 const caption={...reply,kind:'caption',messageId:'attachment'};
 assert.equal(preview([{...file,evidence:[caption]}]).matches[0].status,'matched');
 assert.notEqual(preview([{...file,name:'תוכניית 01.01.2026.pdf',evidence:[caption]}]).matches[0].status,'matched');
 assert.notEqual(preview([{...file,evidence:[{...caption,messageId:'other'}]}]).matches[0].status,'matched');
});
test('identical hashes for one target are safe, differing or missing hashes block both, other targets continue',()=>{
 const a={...file,name:'רויאל 24.9.pdf'}, b={...a,id:'two',sourceMessageId:'second'};
 assert.deepEqual(preview([a,b]).matches.map(m=>m.status),['matched','matched']);
 for(const sha256 of ['b'.repeat(64),undefined]) {
  assert.deepEqual(preview([a,{...b,sha256},{...file,id:'three',name:'הרודס אילת.pdf'}]).matches.map(m=>m.status),['duplicate','duplicate','matched']);
 }
});
test('manual assignment is scoped and may exclude one conflicting version but cannot bypass stale dates',()=>{
 const manual={...reply,kind:'manual',targetCodeId:'leonardo-club-tiberias',messageId:'attachment',text:'Explicit local choice'};
 assert.equal(preview([{...file,evidence:[manual]}]).matches[0].status,'matched');
 assert.notEqual(preview([{...file,evidence:[{...manual,targetCodeId:'another-owner-code'}]}]).matches[0].status,'matched');
 assert.notEqual(preview([{...file,name:'תוכניה 1.1.2026.pdf',evidence:[manual]}]).matches[0].status,'matched');
 const other={...file,id:'two',sourceMessageId:'other',name:'לאונרדו קלאב טבריה.pdf',sha256:'b'.repeat(64)};
 const result=preview([{...file,evidence:[{...manual,exclude:true}]},other]);
 assert.equal(result.matches[1].status,'matched');assert.equal(result.matches[0].target,undefined);
});
test('saved batch pins exact bytes and source identity while preserving assignment evidence',()=>{
 const p=preview([{...file,evidence:[reply]}]);
 assert.throws(()=>selectBatchMatches(p,[{...file,sha256:'b'.repeat(64)}]));
 assert.throws(()=>selectBatchMatches(p,[{...file,sourceMessageId:'another'}]));
 assert.deepEqual(selectBatchMatches(p,[file]).matches[0].file.evidence,[reply]);
});
test('evidence input is bounded and strips unrecognized fields',()=>{
 assert.deepEqual(parseEvidence([{...reply,secret:'omit'}]),[reply]);
 assert.throws(()=>parseEvidence([{...reply,text:'a'.repeat(501)}]));
 assert.throws(()=>parseEvidence(Array(17).fill(reply)));
});
