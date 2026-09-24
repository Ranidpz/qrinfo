import test from 'node:test';
import assert from 'node:assert/strict';
import { attachEvidence, assignmentFingerprint, senderFromMessageId } from '../src/assignment.mjs';
import { hasNewFiles, buildGroupUpdate } from '../src/group-report.mjs';
import { readVisibleMessages } from '../src/collector.mjs';
import { chromium } from 'playwright';
const id='false_123@g.us_ONE_456@lid';
const file={key:'key',messageId:id,sha256:'a'.repeat(64),name:'book.pdf'};
const rows=[{id,filename:'book.pdf',senderId:'456@lid',text:'',receivedAt:'2026-09-24T01:00:00Z'}, {id:'reply',quoteId:id,senderId:'456@lid',text:'קלאב טבריה',receivedAt:'2026-09-24T01:01:00Z'}];
test('reply matching needs exact message identity and sender; filename/time proximity is insufficient',()=>{
 assert.equal(senderFromMessageId(id),'456@lid');assert.equal(senderFromMessageId('123@g.us_ONE'),'');
 assert.equal(attachEvidence([file],rows)[0].evidence.length,1);
 assert.equal(attachEvidence([file],[rows[0],{...rows[1],quoteId:null}])[0].evidence.length,0);
 assert.equal(attachEvidence([file],[rows[0],{...rows[1],senderId:'other'}])[0].evidence.length,0);
 assert.equal(attachEvidence([file],[rows[0],{...rows[1],quoteId:'different'}])[0].evidence.length,0);
});
test('new clarification and manual decisions requeue same message, unchanged evidence stays quiet',()=>{
 const original=attachEvidence([file],[rows[0]])[0];
 const day='2026-09-24', checkpoint={day,fileKeys:[assignmentFingerprint(original)]};
 assert.equal(hasNewFiles([original],checkpoint,day),false);
 assert.equal(hasNewFiles([],checkpoint,day),true);
 const clarified=attachEvidence([file],rows)[0];assert.equal(hasNewFiles([clarified],checkpoint,day),true);
 const decisions={key:{sha256:file.sha256,messageId:id,reason:'chosen',targetCodeId:'target',at:'2026-09-24T01:05:00Z'}};
 assert.equal(attachEvidence([file],rows,decisions)[0].evidence.length,2);
 assert.equal(attachEvidence([{...file,sha256:'b'.repeat(64)}],rows,decisions)[0].evidence.length,1);
});
test('partial group report describes actual updates and generic correction, failed write cannot claim success',()=>{
 const preview={matches:[{file:{id:'b',receivedAt:'2026-09-24T01:00:00Z'},status:'unmatched'}],missingTargets:[]};
 const report={preview,results:[{status:'updated',title:'Experience'}, {status:'skipped',fileId:'b',filename:'book.pdf'}]};
 const text=buildGroupUpdate(report,{first:true,timeZone:'Asia/Jerusalem'});
 assert.match(text,/עודכנו: Experience/);assert.match(text,/נא לשלוח מחדש עם שם החוויה והמיקום בשם הקובץ/);assert.doesNotMatch(text,/מלון|ממשק|מזהה/);
 assert.throws(()=>buildGroupUpdate({...report,results:[{status:'failed'}]},{first:true,timeZone:'Asia/Jerusalem'}));
 assert.throws(()=>buildGroupUpdate({...report,results:[{status:'skipped',fileId:'unknown'}]},{first:true,timeZone:'Asia/Jerusalem'}));
});
test('browser distinguishes real attachment from quoted document, including two identical filenames',async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage();
  await page.setContent(`<div id="main"><div data-id="${id}" data-pre-plain-text="[04:00, 9/24/2026] sender:"><button data-testid="document-thumb" title="book.pdf">book.pdf</button></div>
  <div data-id="false_123@g.us_REPLY_456@lid" data-pre-plain-text="[04:01, 9/24/2026] sender:"><div data-testid="quoted-message" data-quoted-message-id="${id}"><span class="selectable-text">book.pdf</span><button data-testid="document-thumb" title="book.pdf">book.pdf</button></div><span class="selectable-text">קלאב טבריה</span></div>
  <div data-id="false_123@g.us_TWO_456@lid" data-pre-plain-text="[04:02, 9/24/2026] sender:"><button data-testid="document-thumb" title="book.pdf">book.pdf</button></div></div>`);
  const read=await readVisibleMessages(page,{dateOrder:'MDY',timeZone:'Asia/Jerusalem'});
  assert.equal(read.filter(r=>r.filename).length,2);assert.equal(read[1].filename,null);assert.equal(read[1].text,'קלאב טבריה');assert.equal(read[1].quoteId,id);
  await page.locator('[data-quoted-message-id]').evaluate(e=>e.removeAttribute('data-quoted-message-id'));
  const noId=await readVisibleMessages(page,{dateOrder:'MDY',timeZone:'Asia/Jerusalem'});
  assert.equal(noId[1].quoteId,null);assert.equal(noId[1].filename,null);
 }finally{await browser.close();}
});
