import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { readJson, writeJson } from './storage.mjs';

export async function openWhatsApp(config, { headed = false, debugPort } = {}) {
  await mkdir(config.profileDir, { recursive: true, mode: 0o700 });
  const context = await chromium.launchPersistentContext(config.profileDir, {
    headless: !headed, locale: config.locale, timezoneId: config.timeZone,
    // WhatsApp's browser-version check does not recognize HeadlessChrome.
    // Version matches the pinned Playwright 1.63 Chromium distribution.
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 }, acceptDownloads: true,
    ...(debugPort ? { args: [`--remote-debugging-port=${debugPort}`, '--remote-debugging-address=127.0.0.1'] } : {}),
  });
  const page = context.pages()[0] || await context.newPage();
  page.setDefaultTimeout(15000);
  await page.goto('https://web.whatsapp.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  return { context, page };
}
export async function isLoggedIn(page) {
  return page.locator('#pane-side').isVisible().catch(() => false);
}
export async function waitForLogin(page, timeout = 45000) {
  try { await page.locator('#pane-side').waitFor({ state: 'visible', timeout }); }
  catch {
    if (await page.getByText(/WhatsApp works with Google Chrome/).count()) throw new Error('BROWSER_UNSUPPORTED: update the collector browser');
    throw new Error('LOGIN_REQUIRED: connect the business WhatsApp account using the Connect command.');
  }
}
export async function requirePairedProfile(config) {
  const approval = await readJson(path.join(config.runtimeDir, 'account.json'), null);
  if (!approval || approval.integrationId !== config.id || approval.groupName !== config.groupName || approval.accountLabel !== config.accountLabel) {
    throw new Error('ACCOUNT_CONFIRMATION_REQUIRED: use Connect and explicitly confirm the business account.');
  }
}
export async function confirmBusinessProfile(config) {
  await writeJson(path.join(config.runtimeDir, 'account.json'), {
    integrationId: config.id, groupName: config.groupName, accountLabel: config.accountLabel,
    confirmedAt: new Date().toISOString(),
  });
}
export async function openGroup(page, config) {
  await waitForLogin(page);
  const news = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: /What.s new on WhatsApp Web|מה חדש ב.*WhatsApp/i }) });
  if (await news.count()) await news.getByRole('button', { name: /^(Close|סגירה)$/ }).click();
  const side = page.locator('#pane-side');
  let title = side.locator('[title]').filter({ hasText: config.groupName });
  // Prefer exact title attributes; group-name substrings must never select another chat.
  title = side.locator('span[title]').filter({ hasText: new RegExp(`^${escapeRegex(config.groupName)}$`) });
  if (!(await title.count())) {
    const search = page.getByRole('textbox', { name: /Search or start a new chat|חיפוש או התחלת צ.*אט חדש/ }).first();
    if (!(await search.count())) throw new Error('WHATSAPP_UI_CHANGED: search box unavailable');
    await search.fill(config.groupName);
    await title.first().waitFor({ state: 'visible', timeout: 15000 });
  }
  const exact = [];
  for (const candidate of await title.all()) if (await candidate.getAttribute('title') === config.groupName) exact.push(candidate);
  if (exact.length !== 1) throw new Error('GROUP_AMBIGUOUS_OR_MISSING');
  await exact[0].click();
  await page.locator('#main [data-testid="conversation-info-header-chat-title"]').waitFor({ state: 'visible' });
  await assertGroup(page, config);
}
export async function assertGroup(page, config) {
  const current = page.locator('#main [data-testid="conversation-info-header-chat-title"]');
  if (await current.count()) {
    if ((await current.innerText()).trim() !== config.groupName) throw new Error('WRONG_GROUP: expected business booklet group');
    return;
  }
  const names = await page.locator('#main header [title]').evaluateAll((items) => items.map((item) => item.getAttribute('title')));
  if (!names.includes(config.groupName)) throw new Error('WRONG_GROUP: expected business booklet group');
}
function escapeRegex(text) { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
