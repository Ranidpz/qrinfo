import {errorCode} from './errors.mjs';
import { inspectDocumentCard } from './document-card.mjs';
import { moveHistory, settleLatest, inspectHistory, assertHistoryOverlap, assertKnownMessagesObserved, assertLatestUnchanged, settleViewport } from './history.mjs';
import { attachEvidence, senderFromMessageId } from './assignment.mjs';
import { mkdir, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { openWhatsApp, openGroup, assertGroup, requirePairedProfile } from './browser.mjs';
import { readJson, writeJson, safeFilename } from './storage.mjs';
import { parseMessageDate, parseDividerDate, messageKey, assertPdf } from './messages.mjs';

// Retry only a failed read/scan, never commit, report delivery or an uncertain write.
export async function collect(config, options = {}, services = {}) {
  const scan = services.scan || collectOnce;
  try { return await scan(config, options, services); }
  catch (error) {
    if (!['HISTORY_KNOWN_MESSAGES_MISSING','HISTORY_GAP_DETECTED','LATEST_MESSAGES_CHANGED'].includes(errorCode(error))) throw error;
    await writeJson(path.join(config.runtimeDir, 'scan-retry.json'), {at:new Date().toISOString(), reason:errorCode(error), missingMessages:error.missingMessages || [], attachment:error.attachment || null});
    await (services.wait || sleep)(1500);
    // Fresh browser context and observed set; the cache cannot stand in for unseen messages.
    return await scan(config, {...options, retry: true}, services);
  }
}
async function collectOnce(config, { since, headed = false, retry = false } = {}, services = {}) {
  await (services.requirePairedProfile || requirePairedProfile)(config);
  if (!since || Number.isNaN(Date.parse(since))) throw new Error('EXPLICIT_SCAN_START_REQUIRED');
  const cutoff = Date.parse(since);
  const statePath = path.join(config.runtimeDir, 'messages.json');
  const state = await readJson(statePath, { schemaVersion: 1, files: {} });
  const { context, page } = await (services.openWhatsApp || openWhatsApp)(config, { headed });
  const observed = new Map();
  let complete = false;
  let previousTop = '';
  let unchanged = 0;
  try {
    await writeJson(path.join(config.runtimeDir, 'last-scan.json'), {startedAt:new Date().toISOString(), latestVerified:false, complete:false, retry});
    await (services.openGroup || openGroup)(page, config);
    await page.locator('#main [data-id]').first().waitFor({ state: 'attached', timeout: 60000 });
    // Start at latest messages, then walk virtualized history backwards.
    const latest = await settleLatest(page, () => readVisibleMessages(page, config));
    await writeJson(path.join(config.runtimeDir, 'last-scan.json'), {startedAt:new Date().toISOString(), latestVerified:true, latestIds:latest.rows.map(r => r.id), position:latest.position, complete:false});
    let previousRows = latest.rows;
    for (let scroll = 0; scroll < config.maxScrolls; scroll++) {
      await assertGroup(page, config);
      const rows = await settleViewport(() => readVisibleMessages(page, config));
      assertHistoryOverlap(previousRows, rows);
      previousRows = rows;
      for (const row of rows) observed.set(row.id, row);
      // Retain bounded extraction diagnostics even if a later download or scan fails.
      await writeJson(path.join(config.runtimeDir, 'last-message-evidence.json'), [...observed.values()].slice(-500)
        .map(({id, filename, quoteDetected, quoteId, text, senderId, receivedAt, thumbnailCount, attachmentUnreadable, documentCardCount, documentIconCount, pdfLabelCandidates, attachmentKind, classification, materialized}) =>
          ({id, filename, quoteDetected, quoteId, text, senderId, receivedAt, thumbnailCount, attachmentUnreadable, documentCardCount, documentIconCount, pdfLabelCandidates, attachmentKind, classification, materialized})));

      const dates = rows.map((row) => row.receivedAt).filter(Boolean);
      for (const row of rows) {
        if (row.attachmentUnreadable && (!row.receivedAt || Date.parse(row.receivedAt) >= cutoff)) throw new Error('ATTACHMENT_LABEL_UNREADABLE: לא ניתן לקרוא את פרטי הקובץ בוואטסאפ. יצאו דוח בדיקה.');
        if (row.ambiguousPdf) throw new Error('AMBIGUOUS_PDF_ATTACHMENT');
        if (!row.filename) continue;
        const receivedAt = row.receivedAt;
        if (!receivedAt) throw new Error(`MESSAGE_DATE_UNREADABLE: ${row.filename}`);
        if (Date.parse(receivedAt) < cutoff) continue;
        if (Date.parse(receivedAt) > Date.now() + 300000) throw new Error('MESSAGE_DATE_IN_FUTURE');
        const key = messageKey(config.groupName, row.id);
        const existing = state.files[key];
        if (existing) {
          const bytes = await readFile(existing.path);
          if (createHash('sha256').update(bytes).digest('hex') !== existing.sha256) throw new Error('LOCAL_PDF_CHANGED');
          continue;
        }
        const saved = await downloadPdf(page, config, row, key);
        state.files[key] = { ...saved, messageId: row.id, key, receivedAt, collectedAt: new Date().toISOString() };
        await writeJson(statePath, state);
      }
      if (dates.some((value) => Date.parse(value) < cutoff)) { complete = true; break; }
      const top = rows[0]?.id || '';
      unchanged = top && top === previousTop ? unchanged + 1 : 0;
      previousTop = top;
      // Do not claim a complete scan merely because network/history stopped loading.
      if (unchanged >= 30) throw new Error('HISTORY_BOUNDARY_NOT_VERIFIED: choose a later explicit start or inspect chat history');
      await moveHistory(page, 'older');
      await sleep(1000);
    }
    if (!complete) throw new Error('SCAN_LIMIT_REACHED: no upload was attempted');
    // Revisit the newest boundary: late sync must not silently disappear from a completed scan.
    const finalLatest = await settleLatest(page, () => readVisibleMessages(page, config));
    assertLatestUnchanged(latest.rows, finalLatest.rows, observed);
    assertKnownMessagesObserved(state.files, observed, cutoff);
    await writeJson(path.join(config.runtimeDir, 'last-scan.json'), { finishedAt:new Date().toISOString(), latestVerified:true, latestIds:finalLatest.rows.map(r => r.id), position:finalLatest.position, observedCount:observed.size, complete:true});
    const decisions = await readJson(path.join(config.runtimeDir, 'assignments.json'), {});
    // Require a real attachment in this complete scan; old quoted/deleted rows must not re-enter the batch.
    const files = attachEvidence(Object.values(state.files).filter(file => Date.parse(file.receivedAt) >= cutoff && observed.get(file.messageId)?.filename)
      .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt) || a.key.localeCompare(b.key)), [...observed.values()], decisions);
    const result = { schemaVersion: 1, integrationId: config.id, groupName: config.groupName, since, scannedAt: new Date().toISOString(), complete, files };
    await writeJson(path.join(config.runtimeDir, 'last-collection.json'), result);
    return result;
  } catch (error) {
    const scan = await readJson(path.join(config.runtimeDir, 'last-scan.json'), {});
    await writeJson(path.join(config.runtimeDir, 'last-scan.json'), {...scan, complete:false, failedAt:new Date().toISOString(), errorCode:errorCode(error), historyLayout:await inspectHistory(page).catch(()=>null), observedCount:observed.size, missingMessages:error.missingMessages || [], attachment:error.attachment || null, boundaryChanges:error.boundaryChanges || []});
    await page.screenshot({ path: path.join(config.runtimeDir, 'last-error.png') }).catch(() => {});
    throw error;
  } finally { await context.close(); }
}
export async function readVisibleMessages(page, config, now = new Date()) {
  const handles = await page.locator('#main [data-id]').elementHandles();
  try {
    const rows = await page.evaluate((elements) => {
      const seen = new Set();
      return elements.flatMap((element, index) => {
        // Quoted IDs are references, never independent timeline messages or boundary dates.
        if (element.closest('header, footer, [role="dialog"], [data-testid="quoted-message"], [data-testid="quoted"], [data-testid="quoted-message-container"], [data-testid="quoted-document"], [data-quoted-message-id]')) return [];
        // WhatsApp retains data-id shells while unloading offscreen contents.
        // Only the actual viewport can prove a message or a history boundary.
        const rect = element.getBoundingClientRect();
        if (!element.isConnected || rect.width <= 0 || rect.height <= 0 || getComputedStyle(element).visibility === 'hidden') return [];
        let top = Math.max(0, rect.top), bottom = Math.min(innerHeight, rect.bottom);
        for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
          if (['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(ancestor).overflowY)) {
            const clip = ancestor.getBoundingClientRect();
            top = Math.max(top, clip.top + ancestor.clientTop);
            bottom = Math.min(bottom, clip.top + ancestor.clientTop + ancestor.clientHeight);
          }
        }
        if (bottom <= top) return [];
        const id = element.getAttribute('data-id');
        if (!id || seen.has(id)) return [];
        seen.add(id);
        const timestamp = element.getAttribute('data-pre-plain-text') || [...element.querySelectorAll('[data-pre-plain-text]')].find(node => !node.closest('[data-testid="quoted-message"], [data-testid="quoted"], [data-testid="quoted-message-container"], [data-testid="quoted-document"], [data-quoted-message-id]'))?.getAttribute('data-pre-plain-text') || '';
        const timeline = element.closest('[data-tab="8"]');
        let block = element;
        while (timeline && block.parentElement !== timeline) block = block.parentElement;
        let divider = '';
        if (timeline) {
          for (let sibling = block.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
            if (!sibling.querySelector('[data-id]') && sibling.textContent.trim()) { divider = sibling.textContent.trim(); break; }
          }
        }
        const time = element.querySelector('[data-testid="msg-meta"]')?.textContent.trim() || '';
        const quotedSelector = '[data-testid="quoted-message"], [data-testid="quoted"], [data-testid="quoted-message-container"], [data-testid="quoted-document"], [data-quoted-message-id]';
        const quote = element.querySelector(quotedSelector);
        // Only an explicit full source-message identity is accepted. Never infer from filename, order, or time.
        const quoteId = quote?.getAttribute('data-quoted-message-id') || quote?.getAttribute('data-message-id') || quote?.getAttribute('data-id') || null;
        const copy = element.cloneNode(true);
        for (const node of copy.querySelectorAll(quotedSelector)) node.remove();
        const materialized = !!(copy.textContent.trim() || copy.querySelector('img, video, audio, [data-testid="document-thumb"], [data-icon="document"], [data-icon="document-pdf"], [data-icon="recalled"], [data-icon="revoked"]'));
        for (const thumb of copy.querySelectorAll('[data-testid="document-thumb"], [data-testid="msg-meta"]')) thumb.remove();
        const text = [...copy.querySelectorAll('[data-testid="selectable-text"], .selectable-text')].filter(n => !n.parentElement?.closest('.selectable-text, [data-testid="selectable-text"]')).map(n => n.textContent).join(' ').trim().slice(0, 500);
        return [{ index, id, timestamp, divider, time, quoteDetected: !!quote, quoteId, text, materialized }];
      });
    }, handles);
    return await Promise.all(rows.map(async ({ index, ...row }) => ({ ...row,
      ...await handles[index].evaluate(inspectDocumentCard),
      senderId: senderFromMessageId(row.id), receivedAt: parseMessageDate(row.timestamp, config) || parseDividerDate(row.divider, row.time, config, now) })));
  } finally { await Promise.all(handles.map(handle => handle.dispose())); }
}
// Compare complete filenames; only presentation whitespace and bidi marks may differ.
export function normalizeAttachmentName(value) {
  return String(value).normalize('NFC').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu, '').replace(/\s+/gu, ' ').trim().replace(/\.pdf$/iu, '.pdf');
}
async function previewNames(viewer) {
  return viewer.evaluate(root => {
    const values = root.innerText.split('\n');
    for (const node of [root, ...root.querySelectorAll('*')]) {
      for (const child of node.childNodes) if (child.nodeType === Node.TEXT_NODE) values.push(child.textContent);
      for (const attr of ['title', 'aria-label']) if (node.hasAttribute(attr)) values.push(node.getAttribute(attr));
      if (node.textContent.length <= 300) values.push(node.textContent);
    }
    return [...new Set(values.filter(value => value && value.length <= 300 && /\.pdf[\s\u200e\u200f\u202a-\u202e\u2066-\u2069]*$/iu.test(value)).map(value => value.trim()))].slice(0, 30);
  });
}
export async function downloadPdf(page, config, row, key, { previewTimeoutMs = 8000 } = {}) {
  const filename = safeFilename(normalizeAttachmentName(row.filename));
  const dir = path.join(config.runtimeDir, 'downloads', key);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const destination = path.join(dir, filename);
  const temporary = path.join(dir, 'download.part');
  const quoted = 'header, footer, [role="dialog"], [data-testid="quoted-message"], [data-testid="quoted"], [data-testid="quoted-message-container"], [data-testid="quoted-document"], [data-quoted-message-id]';
  // Quoted message IDs and thumbnails are references, never downloadable sources.
  const candidates = await page.locator('#main [data-id]').all();
  let container;
  for (const item of candidates) {
    if (await item.getAttribute('data-id') === row.id && await item.evaluate((el, selector) => !el.closest(selector), quoted)) { container = item; break; }
  }
  if (!container) throw new Error('MESSAGE_DISAPPEARED');
  await assertGroup(page, config);
  const cardInfo = await container.evaluate(inspectDocumentCard);
  if (cardInfo.documentCardCount !== 1 || cardInfo.ambiguousPdf) throw new Error('ATTACHMENT_AMBIGUOUS');
  if (cardInfo.filename && normalizeAttachmentName(cardInfo.filename) !== normalizeAttachmentName(row.filename)) throw new Error('WRONG_ATTACHMENT_PREVIEW');
  const cardHandle = await container.evaluateHandle(inspectDocumentCard, { select:true });
  const card = cardHandle.asElement();
  if (!card) { await cardHandle.dispose(); throw new Error('ATTACHMENT_AMBIGUOUS'); }
  const attachment = { messageId:row.id, expectedName:row.filename, receivedAt:row.receivedAt, visibleNames:[] };
  const viewer = page.locator('[data-testid="media-viewer-modal"]');
  let downloadPromise;
  try {
    await card.click();
    await viewer.waitFor({ state:'visible', timeout:45000 });
    const until = Date.now() + previewTimeoutMs;
    let verified = false;
    do {
      attachment.visibleNames = await previewNames(viewer);
      verified = attachment.visibleNames.some(name => normalizeAttachmentName(name) === normalizeAttachmentName(row.filename));
      if (verified || Date.now() >= until) break;
      await page.waitForTimeout(100);
    } while (true);
    if (!verified) throw new Error('WRONG_ATTACHMENT_PREVIEW');
    downloadPromise = page.waitForEvent('download', { timeout:45000 });
    downloadPromise.catch(() => {});
    await viewer.getByRole('button', { name:/^(Download|הורדה)$/ }).click();
    const download = await downloadPromise;
    attachment.downloadName = download.suggestedFilename();
    if (normalizeAttachmentName(attachment.downloadName) !== normalizeAttachmentName(row.filename)) {
      await download.cancel();
      throw new Error('WRONG_ATTACHMENT_DOWNLOAD');
    }
    await download.saveAs(temporary);
    const buffer = await readFile(temporary);
    assertPdf(buffer);
    await rename(temporary, destination);
    return { path:destination, name:row.filename, size:buffer.length, sha256:createHash('sha256').update(buffer).digest('hex') };
  } catch (error) {
    error.attachment = attachment;
    if (downloadPromise) await downloadPromise.catch(() => {});
    await rm(temporary, { force:true });
    throw error;
  } finally {
    await cardHandle.dispose();
    if (!page.isClosed() && await viewer.isVisible().catch(() => false)) await viewer.getByRole('button', { name:/^(Close|סגירה)$/ }).click().catch(() => {});
  }
}
