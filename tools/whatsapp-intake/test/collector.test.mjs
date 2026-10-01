import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { parseMessageDate, parseDividerDate, slotDue, assertPdf } from '../src/messages.mjs';
import { acquireLock, safeFilename } from '../src/storage.mjs';
import { readVisibleMessages, downloadPdf } from '../src/collector.mjs';
import { assertGroup } from '../src/browser.mjs';
import { buildLaunchAgent } from '../src/macos.mjs';
import { assignmentFingerprint } from '../src/assignment.mjs';
import { cycleDay, hasNewFiles, buildGroupUpdate } from '../src/group-report.mjs';
import { findSentMessage } from '../src/group-sender.mjs';

const config = { groupName: 'חוברות QR פתאל', timeZone: 'Asia/Jerusalem', dateOrder: 'MDY', schedule: { weekdays: [0, 4], times: ['10:05', '14:05'] } };
test('message receipt dates respect Israel time, midnight and DST', () => {
  assert.equal(parseMessageDate('[00:39, 9/20/2026] sender:', config), '2026-09-19T21:39:00.000Z');
  assert.equal(parseMessageDate('[12:01 AM, 1/4/2026] sender:', config), '2026-01-03T22:01:00.000Z');
  assert.equal(parseMessageDate('[10:00, 20/9/2026]', config), null);
  assert.equal(parseMessageDate('[10:00, 2/30/2026]', config), null);
  const now = new Date('2026-09-20T08:00:00Z');
  assert.equal(parseDividerDate('Yesterday', '23:22', config, now), '2026-09-19T20:22:00.000Z');
  assert.equal(parseDividerDate('Thursday', '08:00', config, now), '2026-09-17T05:00:00.000Z');
  assert.equal(parseDividerDate('Syncing older messages', '08:00', config, now), null);
});
test('wake catchup uses latest slot once and never replays older slot', () => {
  const now = new Date('2026-09-20T12:00:00Z');
  assert.equal(slotDue(config, now, []), '2026-09-20/14:05');
  assert.equal(slotDue(config, now, ['2026-09-20/14:05']), null);
  assert.equal(slotDue(config, new Date('2026-09-21T12:00:00Z'), []), null);
});
test('followups stay quiet unless a new message arrives, including after an empty morning', () => {
  const day = cycleDay(new Date('2026-09-20T10:00:00Z'), config.timeZone);
  assert.equal(hasNewFiles([{ key: 'a' }], { day, fileKeys: [assignmentFingerprint({key:'a'})] }, day), false);
  assert.equal(hasNewFiles([{ key: 'a' }, { key: 'b' }], { day, fileKeys: [assignmentFingerprint({key:'a'})] }, day), true);
  assert.equal(hasNewFiles([], { day, fileKeys: [] }, day), false);
  assert.equal(hasNewFiles([], { day: '2026-09-17', fileKeys: [] }, day), true);
  const schedule = { ...config, schedule: { ...config.schedule, times: ['10:05', '12:00', '14:00'] } };
  assert.equal(slotDue(schedule, new Date('2026-09-20T09:00:00Z'), ['2026-09-20/10:05']), '2026-09-20/12:00');
  assert.equal(slotDue(schedule, new Date('2026-09-20T11:00:00Z'), ['2026-09-20/12:00']), '2026-09-20/14:00');
});
test('group summary distinguishes received, updated and missing and refuses unconfirmed writes', () => {
  const report = { results: [{ status: 'updated', title: 'הרודס אילת' }, { status: 'skipped_duplicate', title: 'יו קורל' }], preview: { missingTargets: [{ target: { title: 'קלאב טבריה' } }] } };
  const text = buildGroupUpdate(report, { first: true, now: new Date('2026-09-20T08:00:00Z'), timeZone: config.timeZone });
  assert.match(text, /✅ עודכנו: הרודס אילת/);
  assert.match(text, /לא נקלטה חוברת מתאימה: קלאב טבריה/);
  assert.doesNotMatch(text, /ממשק|מזהה|יו קורל/);
  assert.ok(text.length < 200);
  assert.throws(() => buildGroupUpdate({ ...report, results: [{ status: 'failed' }] }, { first: true, timeZone: config.timeZone }), /UNCONFIRMED/);
});
test('local lock excludes concurrent runs and PDF validation rejects HTML', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'theq-lock-'));
  try {
    const release = await acquireLock(dir);
    await assert.rejects(acquireLock(dir), /RUN_LOCKED/);
    await release();
    await (await acquireLock(dir))();
    assert.throws(() => assertPdf(Buffer.from('<html>login</html>')), /INVALID/);
    assert.equal(safeFilename('../../book.pdf'), '_.._book.pdf');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('LaunchAgent quotes paths as separate arguments and contains no secrets', () => {
  const xml = buildLaunchAgent({ nodePath: '/bin/node', appDir: '/A & B/app', dataDir: '/A & B', configPath: '/A & B/config.json', browserPath: '/cache', label: 'app.test' });
  assert.match(xml, /A &amp; B\/app\/src\/cli.mjs/);
  assert.match(xml, /<integer>300<\/integer>/);
  assert.doesNotMatch(xml, /CONTENT_INTAKE_API_KEY/);
});
test('real browser reads attachment date dividers, checks group, saves PDF from preview', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'theq-ui-'));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ acceptDownloads: true });
    await page.setContent(`<div id="main"><header><span data-testid="conversation-info-header-chat-title">חוברות QR פתאל</span></header>
      <div data-tab="8"><div>Yesterday</div><div><div data-id="m1"><button data-testid="document-thumb" title="book.pdf">book.pdf</button><span data-testid="msg-meta">23:22</span></div></div>
      <div>Today</div><div><div data-id="m2"><span data-pre-plain-text="[09:53, 9/20/2026] sender:">hello</span></div></div></div></div>
      <script>document.querySelector('button').onclick=()=>{const v=document.createElement('div');v.dataset.testid='media-viewer-modal';v.innerHTML='book.pdf<button aria-label="Download">download</button><button aria-label="Close">close</button>';document.body.append(v);v.querySelector('[aria-label="Download"]').onclick=()=>{const a=document.createElement('a');a.download='book.pdf';a.href=URL.createObjectURL(new Blob(['%PDF-1.7\\nfixture\\n%%EOF']));a.click()};v.querySelector('[aria-label="Close"]').onclick=()=>v.remove()};</script>`);
    const rows = await readVisibleMessages(page, config, new Date('2026-09-20T08:00:00Z'));
    assert.equal(rows[0].receivedAt, '2026-09-19T20:22:00.000Z');
    assert.equal(rows[1].receivedAt, '2026-09-20T06:53:00.000Z');
    await assert.rejects(assertGroup(page, { groupName: 'other' }), /WRONG_GROUP/);
    const file = await downloadPdf(page, { ...config, runtimeDir: dir }, rows[0], 'message1');
    assert.equal(file.name, 'book.pdf');
    assertPdf(await readFile(file.path));
    assert.equal(await page.locator('[data-testid="media-viewer-modal"]').count(), 0);
    await page.setContent('<div id="main"><div data-id="out1"><div data-pre-plain-text="stamp"><span class="selectable-text">our report</span></div><span data-icon="msg-time"></span></div></div>');
    assert.equal(await findSentMessage(page, 'our report'), null);
    await page.locator('[data-icon]').evaluate(node => node.setAttribute('data-icon', 'msg-check'));
    assert.equal(await findSentMessage(page, 'our report'), 'out1');
    assert.equal(await findSentMessage(page, 'different report'), null);
    await page.locator('[data-icon]').evaluate(node => node.remove());
    await page.locator('[data-id]').evaluate(node => node.insertAdjacentHTML('beforeend', '<div data-testid="msg-meta"><svg><title>wds-ic-read</title></svg></div>'));
    assert.equal(await findSentMessage(page, 'our report'), 'out1');
    await page.locator('.selectable-text').evaluate(node => { node.innerHTML = '<span>our report <img data-plain-text="✅" alt="✅"></span><br><span>done</span>'; });
    assert.equal(await findSentMessage(page, 'our report ✅\ndone'), 'out1');
    assert.equal(await findSentMessage(page, 'our report ❌\ndone'), null);
  } finally { await browser.close(); await rm(dir, { recursive: true, force: true }); }
});

test('unquoted sibling labels identify real PDFs, while quotes and text-only filenames do not', async () => {
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage();
  await page.setContent(`<div id="main">
   <div data-id="one"><button data-testid="document-thumb"><img></button><div><span>תוכנית בידור </span><span>240926.pdf</span></div><div data-testid="msg-meta">01:24</div></div>
   <div data-id="two"><div data-testid="quoted-message"><button data-testid="document-thumb" title="quoted.pdf"></button></div><button data-testid="document-thumb"></button><div>actual.pdf</div><span class="selectable-text">קלאב טבריה</span></div>
   <div data-id="three"><div data-testid="quoted-message"><button data-testid="document-thumb" title="quoted.pdf"></button></div><span class="selectable-text">קלאב טבריה</span></div>
   <div data-id="four"><button data-testid="document-thumb"><img></button></div>
   <div data-id="five"><span class="selectable-text">please rename.pdf</span></div>
  </div>`);
  const rows=await readVisibleMessages(page,config);
  assert.equal(rows[0].filename,'תוכנית בידור 240926.pdf');
  assert.equal(rows[1].filename,'actual.pdf');assert.equal(rows[1].ambiguousPdf,false);
  assert.equal(rows[2].filename,null);assert.equal(rows[2].text,'קלאב טבריה');
  assert.equal(rows[3].attachmentUnreadable,true);assert.equal(rows[4].filename,null);
 }finally{await browser.close();}
});

test('recovery acknowledges an existing outgoing report without sending Enter again', async () => {
 const {sendGroupUpdate}=await import('../src/group-sender.mjs');
 const {writeJson,readJson}=await import('../src/storage.mjs');
 const {createHash}=await import('node:crypto');
 const dir=await mkdtemp(path.join(tmpdir(),'theq-outbox-'));
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext(),page=await context.newPage();
  await page.setContent('<div id="main"><div style="height:250px;overflow-y:auto"><div style="height:800px"><div data-id="sent-report"><div data-pre-plain-text="stamp"><span class="selectable-text">legacy exact report</span></div><span data-icon="msg-check"></span></div></div></div><footer><div contenteditable="true" role="textbox"></div></footer></div><script>window.enters=0;document.addEventListener("keydown",e=>{if(e.key==="Enter")window.enters++})</script>');
  const file=path.join(dir,'outbox',createHash('sha256').update('batch').digest('hex')+'.json');
  await writeJson(file,{id:'batch',text:'legacy exact report',groupName:config.groupName,state:'sending'});
  let enters;
  const result=await sendGroupUpdate({...config,runtimeDir:dir,sendGroupReports:true},{id:'batch',text:'legacy exact report',reconcileOnly:true},{requirePairedProfile:async()=>{},openGroup:async()=>{},openWhatsApp:async()=>({page,context:{close:async()=>{enters=await page.evaluate(()=>window.enters);}}})});
  assert.equal(result.sent,true);assert.equal(result.alreadySent,true);assert.equal(enters,0);
  assert.equal((await readJson(file)).state,'sent');await context.close();
 }finally{await browser.close();await rm(dir,{recursive:true,force:true});}
});

test('quoted message IDs and header IDs cannot become attachments or old boundary dates', async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage();
  await page.setContent(`<div id="main"><header><div data-id="header">group</div></header><div data-id="reply" data-pre-plain-text="[10:00, 9/24/2026] sender:"><div data-testid="quoted-message"><div data-id="old-file" data-pre-plain-text="[10:00, 9/1/2026] sender:"><button data-testid="document-thumb" title="old.pdf">old.pdf</button></div></div><span class="selectable-text">reply</span></div></div>`);
  const rows=await readVisibleMessages(page,config);
  assert.equal(rows.length,1);assert.equal(rows[0].id,'reply');assert.equal(rows[0].filename,null);assert.equal(rows[0].receivedAt,'2026-09-24T07:00:00.000Z');
 }finally{await browser.close();}
});
test('incomplete scan retries once in a fresh scan; permanent missing history still blocks and never reuses results',async()=>{
 const {collect}=await import('../src/collector.mjs');const {readJson}=await import('../src/storage.mjs');
 const dir=await mkdtemp(path.join(tmpdir(),'theq-retry-'));
 try {
  let calls=0;
  const result=await collect({runtimeDir:dir},{since:'2026-09-23'},{wait:async()=>{},scan:async(c,o)=>{
   calls++;if(calls===1){const e=Error('HISTORY_KNOWN_MESSAGES_MISSING');e.missingMessages=[{name:'missing.pdf',messageId:'one'}];throw e;}
   assert.equal(o.retry,true);return {files:[{name:'fresh.pdf'}]};
  }});
  assert.equal(calls,2);assert.equal(result.files[0].name,'fresh.pdf');assert.equal((await readJson(path.join(dir,'scan-retry.json'))).missingMessages[0].name,'missing.pdf');
  calls=0;await assert.rejects(collect({runtimeDir:dir},{},{wait:async()=>{},scan:async()=>{calls++;throw Error('HISTORY_KNOWN_MESSAGES_MISSING');}}),/HISTORY_KNOWN/);assert.equal(calls,2);
  calls=0;await assert.rejects(collect({runtimeDir:dir},{},{wait:async()=>{},scan:async()=>{calls++;throw Error('WRONG_GROUP');}}),/WRONG_GROUP/);assert.equal(calls,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('attachment identity handles whitespace, delayed labels and quoted sources but rejects another PDF', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'theq-preview-'));
  const browser = await chromium.launch({ headless:true });
  const expected = 'תוכניית בידור אמצש לאונרדו קלאב טבריה  210926.pdf';
  const shown = '\u200fתוכניית בידור אמצש לאונרדו קלאב טבריה 210926.pdf\u200e';
  try {
    const page = await browser.newPage({ acceptDownloads:true });
    async function fixture({ preview = shown, download = expected, delayed = false } = {}) {
      await page.setContent(`<div id="main"><header><span data-testid="conversation-info-header-chat-title">חוברות QR פתאל</span></header>
        <div data-testid="quoted-message"><div data-id="source"><button data-testid="document-thumb" id="quoted">wrong.pdf</button></div></div>
        <div data-id="source"><div data-testid="quoted-document"><button data-testid="document-thumb" id="nested">wrong.pdf</button></div><button data-testid="document-thumb" id="actual">PDF</button></div></div>`);
      await page.evaluate(({preview,download,delayed}) => {
        window.wrongClicks = 0; window.downloadClicks = 0;
        for (const id of ['quoted','nested']) document.getElementById(id).onclick = () => { window.wrongClicks++; };
        document.getElementById('actual').onclick = () => {
          const v = document.createElement('div'); v.dataset.testid = 'media-viewer-modal';
          const label = document.createElement('span'); v.append(label);
          if (delayed) setTimeout(() => { label.textContent = preview; }, 300); else label.textContent = preview;
          const dl = document.createElement('button'); dl.setAttribute('aria-label','Download'); dl.textContent = 'download'; v.append(dl);
          dl.onclick = () => { window.downloadClicks++; const a = document.createElement('a'); a.download = download; a.href = URL.createObjectURL(new Blob(['%PDF-1.7\nverified source\n%%EOF'])); a.click(); };
          const close = document.createElement('button'); close.setAttribute('aria-label','Close'); close.textContent = 'close'; close.onclick = () => v.remove(); v.append(close);
          document.body.append(v);
        };
      }, {preview,download,delayed});
    }
    const row = {id:'source',filename:expected,receivedAt:'2026-09-26T20:48:00.000Z'};
    await fixture({delayed:true});
    const file = await downloadPdf(page, {...config,runtimeDir:dir}, row, 'verified', {previewTimeoutMs:1500});
    assert.equal(file.name, expected);
    assert.match((await readFile(file.path)).toString(), /verified source/);
    assert.equal(await page.evaluate(() => window.wrongClicks), 0);
    assert.equal(await page.locator('[data-testid="media-viewer-modal"]').count(), 0);
    await fixture({preview:'other-' + expected});
    await assert.rejects(downloadPdf(page, {...config,runtimeDir:dir}, row, 'wrong-preview', {previewTimeoutMs:50}), error => {
      assert.equal(error.message, 'WRONG_ATTACHMENT_PREVIEW');
      assert.equal(error.attachment.expectedName, expected);
      assert.ok(error.attachment.visibleNames.includes('other-' + expected));
      return true;
    });
    assert.equal(await page.evaluate(() => window.downloadClicks), 0);
    assert.equal(await page.locator('[data-testid="media-viewer-modal"]').count(), 0);
    await fixture({download:'wrong.pdf'});
    await assert.rejects(downloadPdf(page, {...config,runtimeDir:dir}, row, 'wrong-download', {previewTimeoutMs:50}), error => {
      assert.equal(error.message, 'WRONG_ATTACHMENT_DOWNLOAD');
      assert.equal(error.attachment.downloadName, 'wrong.pdf');
      return true;
    });
    await assert.rejects(readFile(path.join(dir,'downloads','wrong-download','download.part')), /ENOENT/);
    assert.equal(await page.locator('[data-testid="media-viewer-modal"]').count(), 0);
  } finally { await browser.close(); await rm(dir,{recursive:true,force:true}); }
});

test('semantic document buttons are collected and downloaded with strict identity; quotes and text stay excluded', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'theq-card-'));
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({acceptDownloads:true});
    await page.setContent(`<div id="main"><header><span data-testid="conversation-info-header-chat-title">חוברות QR פתאל</span></header>
      <div data-id="real" data-pre-plain-text="[02:03, 10/1/2026] sender:"><div role="button" id="card"><span data-icon="document"></span><div>\u200fקלאב טבריה 011026.PDF\u200e</div><div>2 pages · 871 KB</div></div></div>
      <div data-id="quote"><div data-testid="quoted-message"><div role="button"><span data-icon="document"></span><div>quoted.pdf</div></div></div><span class="selectable-text">אילת</span></div>
      <div data-id="plain"><span class="selectable-text">please rename.pdf</span><button>OK</button></div>
      <div data-id="icon-only"><span data-icon="document"></span><div>unknown.pdf</div></div>
      <div data-id="two"><button data-testid="document-thumb" title="one.pdf"></button><div role="button"><span data-icon="document-pdf"></span><div>two.pdf</div></div></div>
      <div data-id="nested"><div role="button"><div role="button"><span data-icon="document"></span><div>nested.pdf</div></div></div></div>
      <div data-id="text"><span class="selectable-text">ספלאש אין</span></div>
    </div>`);
    const rows = await readVisibleMessages(page, config);
    assert.equal(rows[0].filename,'\u200fקלאב טבריה 011026.PDF\u200e');
    assert.equal(rows[0].attachmentKind,'document_button');
    assert.equal(rows[0].receivedAt,'2026-09-30T23:03:00.000Z');
    assert.equal(rows[1].filename,null); assert.equal(rows[1].documentCardCount,0);
    assert.equal(rows[2].filename,null); assert.equal(rows[3].filename,null);
    assert.equal(rows[3].documentIconCount,1); assert.deepEqual(rows[3].pdfLabelCandidates,['unknown.pdf']);
    assert.equal(rows[4].ambiguousPdf,true); assert.equal(rows[5].documentCardCount,1);
    assert.equal(rows[6].text,'ספלאש אין');
    await page.evaluate(() => {
      window.downloads = 0;
      document.getElementById('card').onclick = () => {
        const viewer = document.createElement('div'); viewer.dataset.testid='media-viewer-modal';
        viewer.innerHTML='<div>קלאב טבריה 011026.pdf</div><button aria-label="Download">Download</button><button aria-label="Close">Close</button>';
        viewer.querySelector('[aria-label="Download"]').onclick=()=>{window.downloads++;const a=document.createElement('a');a.download='קלאב טבריה 011026.pdf';a.href=URL.createObjectURL(new Blob(['%PDF-1.7\nfixture\n%%EOF']));a.click();};
        viewer.querySelector('[aria-label="Close"]').onclick=()=>viewer.remove();document.body.append(viewer);
      };
    });
    const file = await downloadPdf(page,{...config,runtimeDir:dir},rows[0],'semantic');
    assertPdf(await readFile(file.path)); assert.equal(await page.evaluate(()=>window.downloads),1);
    await assert.rejects(downloadPdf(page,{...config,runtimeDir:dir},{...rows[4],filename:'one.pdf'},'ambiguous'),/ATTACHMENT_AMBIGUOUS/);
    // A changed card must be rejected before opening any preview or downloading.
    await page.locator('#card div').first().evaluate(node=>node.textContent='other.pdf');
    await assert.rejects(downloadPdf(page,{...config,runtimeDir:dir},rows[0],'changed'),/WRONG_ATTACHMENT_PREVIEW/);
    assert.equal(await page.evaluate(()=>window.downloads),1);
  } finally {await browser.close();await rm(dir,{recursive:true,force:true});}
});

test('held target is not also reported as absent', () => {
  const report={results:[{status:'skipped',fileId:'one',filename:'one.pdf',codeId:'club',reason:'duplicate'}],preview:{matches:[{file:{id:'one'},status:'duplicate'}],missingTargets:[{target:{codeId:'club',title:'קלאב טבריה'}},{target:{codeId:'other',title:'פלאזה'}}]}};
  const text=buildGroupUpdate(report,{first:true,timeZone:config.timeZone});
  assert.match(text,/לא עודכנו:.*one.pdf/);assert.match(text,/לא נקלטה חוברת מתאימה: פלאזה/);assert.doesNotMatch(text,/כל החוברות מעודכנות|לא נקלטה חוברת מתאימה: קלאב/);
});

test('complete scan verifies an undated known PDF and downloads new PDFs through virtualized history', async () => {
 const {collect} = await import('../src/collector.mjs');
 const dir=await mkdtemp(path.join(tmpdir(),'theq-virtual-'));
 const browser=await chromium.launch({headless:true});
 try {
  const context=await browser.newContext({acceptDownloads:true}), page=await context.newPage();
  await page.setContent(`<div id="main"><header><span data-testid="conversation-info-header-chat-title">חוברות QR פתאל</span></header><div id="history" style="height:300px;overflow:auto">${Array.from({length:12},(_,i)=>`<div data-id="m${i}" style="height:130px"></div>`).join('')}</div></div>`);
  await page.evaluate(()=>{
   const history=document.querySelector('#history');
   function render() {
    const bounds=history.getBoundingClientRect();
    for(const node of history.children) {
     const i=Number(node.dataset.id.slice(1)),rect=node.getBoundingClientRect();
     if(rect.bottom<=bounds.top||rect.top>=bounds.bottom){node.innerHTML='';continue;}
     node.innerHTML=`<div data-pre-plain-text="[10:00, ${i===0?'9/24':'10/1'}/2026] sender:">${[4,7,10].includes(i)?`<button data-testid="document-thumb" title="book-${i}.pdf">book-${i}.pdf</button>`:`<span class="selectable-text">message ${i}</span>`}</div>`;
     const button=node.querySelector('button');
     if(button) button.onclick=()=>{
      const viewer=document.createElement('div');viewer.dataset.testid='media-viewer-modal';viewer.style.cssText='position:fixed;inset:0;background:white';
      viewer.innerHTML=`<span>book-${i}.pdf</span><button aria-label="Download">Download</button><button aria-label="Close">Close</button>`;
      viewer.querySelector('[aria-label="Download"]').onclick=()=>{const a=document.createElement('a');a.download=`book-${i}.pdf`;a.href=URL.createObjectURL(new Blob([`%PDF-1.7\nfixture ${i}\n%%EOF`]));a.click();};
      viewer.querySelector('[aria-label="Close"]').onclick=()=>viewer.remove();document.body.append(viewer);
     };
    }
   }
   history.addEventListener('scroll',render);render();
  });
  // Reproduce the Oct 1 report: a live known file loses its date in the DOM.
  // Its original receipt is available, but only a fresh matching download can recover it.
  await page.evaluate(()=>{
   const observer=new MutationObserver(()=>{
    const stamp=document.querySelector('[data-id="m4"] [data-pre-plain-text]');
    if(stamp)stamp.removeAttribute('data-pre-plain-text');
   });
   observer.observe(document.querySelector('#history'),{childList:true,subtree:true});
  });
  const {messageKey}=await import('../src/messages.mjs');
  const {createHash}=await import('node:crypto');
  const key=messageKey(config.groupName,'m4'), bytes=Buffer.from('%PDF-1.7\nfixture 4\n%%EOF');
  const cachedPath=path.join(dir,'known-book-4.pdf');await writeFile(cachedPath,bytes);
  const receipt={key,messageId:'m4',name:'book-4.pdf',receivedAt:'2026-09-30T19:42:00.000Z',path:cachedPath,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  await writeFile(path.join(dir,'messages.json'),JSON.stringify({schemaVersion:1,files:{[key]:receipt}}));
  const result=await collect({...config,runtimeDir:dir,maxScrolls:30},{since:'2026-09-25T00:00:00.000Z'},{requirePairedProfile:async()=>{},openGroup:async()=>{},openWhatsApp:async()=>({page,context})});
  assert.equal(result.complete,true);assert.deepEqual(result.files.map(file=>file.name).sort(),['book-10.pdf','book-4.pdf','book-7.pdf']);
  for(const file of result.files) assertPdf(await readFile(file.path));
  const scan=JSON.parse(await readFile(path.join(dir,'last-scan.json'),'utf8'));
  assert.equal(scan.complete,true);assert.equal(scan.observedCount,12);
  const evidence=JSON.parse(await readFile(path.join(dir,'last-message-evidence.json'),'utf8'));
  assert.equal(evidence.filter(row=>row.filename).length,3);assert.ok(evidence.every(row=>row.materialized));
  assert.equal(evidence.find(row=>row.id==='m4').dateSource,'verified_same_message_pdf');
  assert.equal(result.files.find(file=>file.messageId==='m4').receivedAt,receipt.receivedAt);
  assert.deepEqual(await readFile(cachedPath),bytes);
 } finally {await browser.close();await rm(dir,{recursive:true,force:true});}
});


test('date recovery requires the same live message, exact name and freshly verified bytes', async () => {
 const {recoverMessageDate}=await import('../src/collector.mjs');
 const {messageKey}=await import('../src/messages.mjs');
 const {createHash}=await import('node:crypto');
 const dir=await mkdtemp(path.join(tmpdir(),'theq-date-proof-'));
 try {
  const bytes=Buffer.from('%PDF-1.7\nknown PDF'),filePath=path.join(dir,'known.pdf');await writeFile(filePath,bytes);
  const row={id:'known',filename:'known.pdf',materialized:true,documentCardCount:1,receivedAt:null};
  const receipt={key:messageKey(config.groupName,row.id),messageId:row.id,name:row.filename,path:filePath,receivedAt:'2026-09-30T19:42:00.000Z',sha256:createHash('sha256').update(bytes).digest('hex')};
  let downloads=0;
  const services={wait:async()=>{},readRows:async()=>[row],download:async()=>{downloads++;return {sha256:receipt.sha256};}};
  const recovered=await recoverMessageDate(null,{...config,runtimeDir:dir},row,receipt,services);
  assert.equal(recovered.receivedAt,receipt.receivedAt);assert.equal(recovered.dateSource,'verified_same_message_pdf');assert.equal(downloads,1);
  for(const invalid of [null,{...receipt,messageId:'another'},{...receipt,key:'wrong-group-key'},{...receipt,name:'other.pdf'},{...receipt,receivedAt:'invalid'}]) {
   await assert.rejects(recoverMessageDate(null,{...config,runtimeDir:dir},row,invalid,services),/MESSAGE_DATE_UNREADABLE/);
  }
  assert.equal(downloads,1);
  await assert.rejects(recoverMessageDate(null,{...config,runtimeDir:dir},row,receipt,{...services,download:async()=>({sha256:'0'.repeat(64)})}),/MESSAGE_DATE_UNREADABLE/);
  assert.deepEqual(await readFile(filePath),bytes);
  const dated={...row,receivedAt:'2026-10-01T10:33:00.000Z',dateSource:'message_timestamp'};
  let reads=0;
  assert.equal((await recoverMessageDate(null,{...config,runtimeDir:dir},row,null,{...services,readRows:async()=>++reads>=3?[dated]:[row]})).receivedAt,dated.receivedAt);
  assert.equal(downloads,1);
  // Neither a quoted card nor an empty shell can authorize saved-date recovery.
  for(const invalid of [{...row,materialized:false},{...row,documentCardCount:0},{...row,ambiguousPdf:true}])
   await assert.rejects(recoverMessageDate(null,{...config,runtimeDir:dir},invalid,receipt,services),/MESSAGE_DATE_UNREADABLE/);
 } finally {await rm(dir,{recursive:true,force:true});}
});
