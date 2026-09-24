import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
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
  assert.match(text, /התקבלו 2 חוברות; 1 הועלו/);
  assert.match(text, /חסרות: קלאב טבריה/);
  assert.match(text, /1 כבר היו מעודכנות/);
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
