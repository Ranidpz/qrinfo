import { attachEvidence, senderFromMessageId } from './assignment.mjs';
import { mkdir, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { openWhatsApp, openGroup, assertGroup, requirePairedProfile } from './browser.mjs';
import { readJson, writeJson, safeFilename } from './storage.mjs';
import { parseMessageDate, parseDividerDate, messageKey, assertPdf } from './messages.mjs';

export async function collect(config, { since, headed = false } = {}) {
  await requirePairedProfile(config);
  if (!since || Number.isNaN(Date.parse(since))) throw new Error('EXPLICIT_SCAN_START_REQUIRED');
  const cutoff = Date.parse(since);
  const statePath = path.join(config.runtimeDir, 'messages.json');
  const state = await readJson(statePath, { schemaVersion: 1, files: {} });
  const { context, page } = await openWhatsApp(config, { headed });
  const observed = new Map();
  let complete = false;
  let previousTop = '';
  let unchanged = 0;
  try {
    await openGroup(page, config);
    await page.locator('#main [data-id]').first().waitFor({ state: 'attached', timeout: 60000 });
    // Start at latest messages, then walk virtualized history backwards.
    await scrollHistory(page, true);
    await sleep(800);
    for (let scroll = 0; scroll < config.maxScrolls; scroll++) {
      await assertGroup(page, config);
      const rows = await readVisibleMessages(page, config);
      for (const row of rows) observed.set(row.id, row);
      // Retain bounded extraction diagnostics even if a later download or scan fails.
      await writeJson(path.join(config.runtimeDir, 'last-message-evidence.json'), [...observed.values()]
        .filter(r => r.filename || r.quoteDetected || r.attachmentUnreadable)
        .map(({id, filename, quoteDetected, quoteId, text, senderId, receivedAt, thumbnailCount, attachmentUnreadable}) =>
          ({id, filename, quoteDetected, quoteId, text, senderId, receivedAt, thumbnailCount, attachmentUnreadable})));

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
      await scrollHistory(page);
      await sleep(1000);
    }
    if (!complete) throw new Error('SCAN_LIMIT_REACHED: no upload was attempted');
    const decisions = await readJson(path.join(config.runtimeDir, 'assignments.json'), {});
    // Require a real attachment in this complete scan; old quoted/deleted rows must not re-enter the batch.
    const files = attachEvidence(Object.values(state.files).filter(file => Date.parse(file.receivedAt) >= cutoff && observed.get(file.messageId)?.filename)
      .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt) || a.key.localeCompare(b.key)), [...observed.values()], decisions);
    const result = { schemaVersion: 1, integrationId: config.id, groupName: config.groupName, since, scannedAt: new Date().toISOString(), complete, files };
    await writeJson(path.join(config.runtimeDir, 'last-collection.json'), result);
    return result;
  } catch (error) {
    await page.screenshot({ path: path.join(config.runtimeDir, 'last-error.png') }).catch(() => {});
    throw error;
  } finally { await context.close(); }
}
export async function readVisibleMessages(page, config, now = new Date()) {
  const rows = await page.locator('#main [data-id]').evaluateAll((elements) => {
    const seen = new Set();
    return elements.flatMap((element) => {
      const id = element.getAttribute('data-id');
      if (!id || seen.has(id)) return [];
      seen.add(id);
      const timestamp = element.getAttribute('data-pre-plain-text') || element.querySelector('[data-pre-plain-text]')?.getAttribute('data-pre-plain-text') || '';
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
      const thumbs = [...copy.querySelectorAll('[data-testid="document-thumb"]')];
      // Preserve inline filename spans, but keep block labels separate from size/time metadata.
      // Quoted documents have already been removed from this detached copy.
      const pdfName = value => typeof value === 'string' && /\.pdf$/i.test(value.trim());
      const labelText = node => {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent;
        if (node.nodeType !== Node.ELEMENT_NODE) return '';
        const block = /^(DIV|P|BUTTON|BR|LI|SECTION)$/.test(node.tagName);
        const value = [...node.childNodes].map(labelText).join('');
        return block ? `\n${value}\n` : value;
      };
      const labels = labelText(copy).split('\n');
      const names = [...new Set([...copy.querySelectorAll('[title]')].map(node => node.getAttribute('title'))
        .concat(labels).filter(pdfName).map(value => value.trim()))];
      const attachmentUnreadable = thumbs.length > 0 && names.length === 0;
      for (const thumb of copy.querySelectorAll('[data-testid="document-thumb"], [data-testid="msg-meta"]')) thumb.remove();
      const text = [...copy.querySelectorAll('[data-testid="selectable-text"], .selectable-text')].filter(n => !n.parentElement?.closest('.selectable-text, [data-testid="selectable-text"]')).map(n => n.textContent).join(' ').trim().slice(0, 500);
      return [{ id, timestamp, divider, time, quoteDetected: !!quote, quoteId, text, filename: thumbs.length && names.length === 1 ? names[0] : null, attachmentUnreadable, thumbnailCount: thumbs.length, ambiguousPdf: thumbs.length > 1 || (thumbs.length > 0 && names.length > 1) }];
    });
  });
  return rows.map((row) => ({ ...row, senderId: senderFromMessageId(row.id), receivedAt: parseMessageDate(row.timestamp, config) || parseDividerDate(row.divider, row.time, config, now) }));
}
async function scrollHistory(page, bottom = false) {
  await page.locator('#main').evaluate((main, bottom) => {
    const candidates = [...main.querySelectorAll('*')].filter((node) => node.clientHeight > 150
      && ['auto', 'scroll'].includes(getComputedStyle(node).overflowY));
    const scroller = candidates.sort((a, b) => b.clientHeight - a.clientHeight)[0];
    if (!scroller) throw new Error('WHATSAPP_SCROLL_CONTAINER_MISSING');
    scroller.scrollTop = bottom ? scroller.scrollHeight : Math.max(0, scroller.scrollTop - scroller.clientHeight * 0.75);
  }, bottom);
}
export async function downloadPdf(page, config, row, key) {
  const filename = safeFilename(row.filename);
  const dir = path.join(config.runtimeDir, 'downloads', key);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const destination = path.join(dir, filename);
  const temporary = path.join(dir, 'download.part');
  // Attribute comparison avoids interpolating message IDs into selectors.
  const candidates = await page.locator('#main [data-id]').all();
  let container;
  for (const item of candidates) if (await item.getAttribute('data-id') === row.id) { container = item; break; }
  if (!container) throw new Error('MESSAGE_DISAPPEARED');
  await assertGroup(page, config);
  const thumb = container.locator('[data-testid="document-thumb"]');
  await thumb.click();
  const viewer = page.locator('[data-testid="media-viewer-modal"]');
  await viewer.waitFor({ state: 'visible', timeout: 45000 });
  if (!(await viewer.innerText()).includes(row.filename)) throw new Error('WRONG_ATTACHMENT_PREVIEW');
  const downloadPromise = page.waitForEvent('download', { timeout: 45000 });
  // Attach rejection immediately; UI click errors must not leave an unhandled timer.
  downloadPromise.catch(() => {});
  try {
    await viewer.getByRole('button', { name: /^(Download|הורדה)$/ }).click();
    const download = await downloadPromise;
    await download.saveAs(temporary);
    const buffer = await readFile(temporary);
    assertPdf(buffer);
    await rename(temporary, destination);
    return { path: destination, name: row.filename, size: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex') };
  } catch (error) {
    await downloadPromise.catch(() => {});
    await rm(temporary, { force: true });
    throw error;
  } finally {
    if (!page.isClosed()) await viewer.getByRole('button', { name: /^(Close|סגירה)$/ }).click().catch(() => {});
  }
}
