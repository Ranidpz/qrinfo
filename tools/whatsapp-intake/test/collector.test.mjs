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
  } finally { await browser.close(); await rm(dir, { recursive: true, force: true }); }
});
