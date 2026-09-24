import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { moveHistory, settleLatest, assertHistoryOverlap, assertKnownMessagesObserved } from '../src/history.mjs';

test('latest boundary survives delayed new messages and scroll-anchor restoration, ignoring larger wrappers', async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  await page.setContent(`<div id="main"><div style="height:700px;overflow:auto"><div style="height:900px">unrelated</div></div><div id="history" style="height:250px;overflow:auto">${Array.from({length:10},(_,i)=>`<div data-id="m${i}" style="height:100px">${i}</div>`).join('')}</div></div>`);
  let polls=0;
  const readRows=()=>page.locator('#history [data-id]').evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect(),p=n.parentElement.getBoundingClientRect();return r.bottom>p.top&&r.top<p.bottom;}).map(n=>({id:n.dataset.id})));
  const latest=await settleLatest(page,readRows,{wait:async()=>{
   polls++;
   if(polls===3)await page.evaluate(()=>{const history=document.querySelector('#history');history.insertAdjacentHTML('beforeend','<div data-id="club" style="height:100px">club</div><div data-id="royal1" style="height:100px">Royal</div><div data-id="royal2" style="height:100px">Royal</div>');history.scrollTop=350;});
  }});
  assert.ok(polls>=6);assert.equal(latest.rows.at(-1).id,'royal2');assert.equal(latest.position.atLatest,true);
  const before=latest.position.top;assert.ok((await moveHistory(page,'older')).top<before);
  assert.equal(await page.locator('#main > div').first().evaluate(n=>n.scrollTop),0);
 }finally{await browser.close();}
});
test('column-reverse chat uses negative offsets for older history and zero for latest',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  await page.setContent(`<div id="main"><div style="height:250px;overflow:auto;display:flex;flex-direction:column-reverse">${Array.from({length:10},(_,i)=>`<div data-id="m${i}" style="height:100px;flex-shrink:0">${i}</div>`).join('')}</div></div>`);
  assert.equal((await moveHistory(page,'latest')).atLatest,true);
  const older=await moveHistory(page,'older');assert.equal(older.reverse,true);assert.ok(older.top<0);
  assert.equal((await moveHistory(page,'latest')).top,0);
 }finally{await browser.close();}
});
test('unstable latest messages cannot be declared complete',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();await page.setContent('<div id="main"><div style="height:200px;overflow:auto"><div data-id="a" style="height:1000px">a</div></div></div>');
  let i=0;
  await assert.rejects(settleLatest(page,async()=>[{id:String(i++)}],{wait:async()=>{},attempts:6}),/LATEST_MESSAGES_NOT_VERIFIED/);
 }finally{await browser.close();}
});
test('known files cannot silently disappear; explicitly observed deleted rows and expired files are allowed',()=>{
 const files={club:{messageId:'club',receivedAt:'2026-09-24T01:25:00Z'},royal1:{messageId:'royal1',receivedAt:'2026-09-24T02:55:00Z'},royal2:{messageId:'royal2',receivedAt:'2026-09-24T02:55:00Z'}};
 assert.throws(()=>assertKnownMessagesObserved(files,new Map(),Date.parse('2026-09-23')),/HISTORY_KNOWN_MESSAGES_MISSING: 3/);
 assert.doesNotThrow(()=>assertKnownMessagesObserved(files,new Map(Object.keys(files).map(id=>[id,{id,filename:null}])),Date.parse('2026-09-23')));
 assert.doesNotThrow(()=>assertKnownMessagesObserved(files,new Map(),Date.parse('2026-09-25')));
 assert.throws(()=>assertHistoryOverlap([{id:'one'}],[{id:'three'}]),/HISTORY_GAP_DETECTED/);
 assert.doesNotThrow(()=>assertHistoryOverlap([{id:'one'},{id:'two'}],[{id:'two'},{id:'three'}]));
});
