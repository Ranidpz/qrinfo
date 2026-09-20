import path from 'node:path';
import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { openWhatsApp, openGroup, assertGroup, requirePairedProfile } from './browser.mjs';
import { readJson, writeJson } from './storage.mjs';

// The user explicitly enables reporting for this paired business group.
// Persist before Enter; an uncertain send is reconciled, never blindly repeated.
export async function sendGroupUpdate(config, { id, text, headed = false }) {
  if (config.sendGroupReports !== true) return { skipped: true };
  await requirePairedProfile(config);
  const file = path.join(config.runtimeDir, 'outbox', `${createHash('sha256').update(id).digest('hex')}.json`);
  let entry = await readJson(file, null);
  if (entry?.state === 'sent') return { sent: true, alreadySent: true, messageId: entry.messageId };
  if (entry && (entry.text !== text || entry.groupName !== config.groupName)) throw new Error('OUTBOX_CONTENT_CHANGED');
  if (!entry) {
    entry = { id, groupName: config.groupName, text, state: 'prepared', at: new Date().toISOString() };
    await writeJson(file, entry);
  }
  const { context, page } = await openWhatsApp(config, { headed });
  try {
    await openGroup(page, config);
    await page.locator('#main footer [contenteditable="true"][role="textbox"]').waitFor({ state: 'visible', timeout: 60000 });
    const found = await findSentMessage(page, text);
    if (found) {
      await writeJson(file, { ...entry, state: 'sent', messageId: found, confirmedAt: new Date().toISOString() });
      return { sent: true, alreadySent: true, messageId: found };
    }
    if (entry.state !== 'prepared') throw new Error('WHATSAPP_SEND_UNCONFIRMED: inspect the group before retrying');
    const editor = page.locator('#main footer [contenteditable="true"][role="textbox"]');
    if ((await editor.innerText()).trim()) throw new Error('WHATSAPP_DRAFT_PRESENT');
    await editor.fill(text);
    await assertGroup(page, config);
    await writeJson(file, { ...entry, state: 'sending' });
    await editor.press('Enter');
    for (let attempt = 0; attempt < 60; attempt++) {
      const messageId = await findSentMessage(page, text);
      if (messageId) {
        await writeJson(file, { ...entry, state: 'sent', messageId, confirmedAt: new Date().toISOString() });
        return { sent: true, messageId };
      }
      await sleep(1000);
    }
    throw new Error('WHATSAPP_SEND_UNCONFIRMED: no sent acknowledgment; do not resend automatically');
  } finally { await context.close(); }
}

export async function findSentMessage(page, text) {
  return page.locator('#main [data-id]').evaluateAll((rows, expected) => {
    const normalize = (value) => value.replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim();
    for (const row of rows) {
      const body = row.querySelector('[data-pre-plain-text] [data-testid="selectable-text"], [data-pre-plain-text] .selectable-text');
      if (!body || normalize(body.innerText) !== normalize(expected)) continue;
      // A checkmark is an outgoing send acknowledgment; a clock alone is not.
      const legacy = row.querySelector('[data-icon="msg-check"], [data-icon="msg-dblcheck"], [data-testid="msg-check"], [data-testid="msg-dblcheck"]');
      const modern = [...row.querySelectorAll('[data-testid="msg-meta"] svg title')].some(icon => icon.textContent === 'wds-ic-read');
      if (legacy || modern) return row.getAttribute('data-id');
    }
    return null;
  }, text);
}
