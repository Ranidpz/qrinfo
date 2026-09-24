import { setTimeout as sleep } from 'node:timers/promises';

// Select the scrollable ancestor of actual messages, not a larger sidebar/wrapper.
// WhatsApp may use column-reverse, whose older history has negative scrollTop.
export async function moveHistory(page, direction) {
  return page.locator('#main').evaluate((main, direction) => {
    const message = [...main.querySelectorAll('[data-id]')].find(n => n.getBoundingClientRect().height > 0);
    let scroller = message?.parentElement;
    while (scroller && scroller !== main.parentElement) {
      const style = getComputedStyle(scroller);
      if (scroller.clientHeight > 100 && ['auto', 'scroll'].includes(style.overflowY)
          && scroller.scrollHeight > scroller.clientHeight) break;
      scroller = scroller.parentElement;
    }
    if (!scroller || scroller === main.parentElement) throw Error('WHATSAPP_SCROLL_CONTAINER_MISSING');
    const reverse = getComputedStyle(scroller).flexDirection === 'column-reverse';
    const limit = scroller.scrollHeight - scroller.clientHeight;
    if (direction === 'latest') scroller.scrollTop = reverse ? 0 : limit;
    if (direction === 'older') scroller.scrollTop += -scroller.clientHeight * 0.5;
    const top = scroller.scrollTop;
    return {reverse, top, height:scroller.scrollHeight, viewport:scroller.clientHeight,
      atLatest:reverse ? Math.abs(top) < 3 : Math.abs(limit - top) < 3};
  }, direction);
}

export async function settleLatest(page, readRows, { wait = sleep, attempts = 20, delay = 500 } = {}) {
  let previous = '', stable = 0;
  for (let i = 0; i < attempts; i++) {
    await moveHistory(page, 'latest');
    await wait(delay);
    const position = await moveHistory(page, 'inspect');
    const rows = await readRows();
    const fingerprint = JSON.stringify([position.top, position.height, rows.map(r => r.id)]);
    stable = position.atLatest && rows.length && fingerprint === previous ? stable + 1 : 0;
    previous = fingerprint;
    // Allow initial sync/anchor restoration to finish; one scroll plus 800ms is insufficient.
    if (i >= 4 && stable >= 3) return {rows, position, attempts:i + 1};
  }
  throw Error('LATEST_MESSAGES_NOT_VERIFIED: ההודעות האחרונות עדיין נטענות; נסו בדיקה נוספת.');
}

export function assertHistoryOverlap(previous, current) {
  if (previous.length && !current.some(row => previous.some(old => old.id === row.id))) {
    throw Error('HISTORY_GAP_DETECTED: הסריקה דילגה על מקטע הודעות; לא בוצעה העלאה.');
  }
}

export function assertKnownMessagesObserved(files, observed, cutoff) {
  const missing = Object.values(files).filter(file => Date.parse(file.receivedAt) >= cutoff && !observed.has(file.messageId));
  if (missing.length) throw Error(`HISTORY_KNOWN_MESSAGES_MISSING: ${missing.length} הודעות קובץ מסריקה קודמת לא נראו בסריקה הנוכחית; לא בוצעה העלאה.`);
}
