import { setTimeout as sleep } from 'node:timers/promises';

// Inspect all message ancestors: data-id also appears in headers, quotes and
// transient anchors. Never select a sidebar, composer or arbitrary page scroller.
async function historyPosition(page, direction) {
  return page.locator('#main').evaluate((main, direction) => {
    const visible = node => { const r=node.getBoundingClientRect();return r.height>0 && r.width>0 && getComputedStyle(node).visibility !== 'hidden'; };
    const excluded = 'header, footer, [role="dialog"], [data-testid="quoted-message"], [data-testid="quoted"], [data-testid="quoted-message-container"], [data-quoted-message-id]';
    const anchors = [...main.querySelectorAll('[data-id]')].filter(n => visible(n) && !n.closest(excluded));
    const candidates = new Map();
    for (const anchor of anchors) {
      let node=anchor.parentElement, depth=0;
      while (node && main.contains(node)) {
        const style=getComputedStyle(node);
        if (visible(node) && node.clientHeight>=80 && ['auto','scroll','hidden'].includes(style.overflowY)) {
          let item=candidates.get(node);
          if (!item) {item={node,count:0,depth:0,overflow:style.overflowY};candidates.set(node,item);}
          item.count++;item.depth+=depth;
        }
        if (node===main) break;
        node=node.parentElement;depth++;
      }
    }
    const describe = c => ({tag:c.node.tagName,role:c.node.getAttribute('role'),testId:c.node.getAttribute('data-testid'),
      overflow:c.overflow,messages:c.count,clientHeight:c.node.clientHeight,scrollHeight:c.node.scrollHeight,
      direction:getComputedStyle(c.node).flexDirection,depth:c.depth/c.count});
    const diagnostics = {anchorCount:anchors.length,rawIdCount:main.querySelectorAll('[data-id]').length,candidates:[...candidates.values()].slice(0,25).map(describe)};
    if (direction==='diagnostics') return diagnostics;
    // Prefer native scroll containers, including a short chat with no overflow yet.
    // Hidden overflow is accepted only with real vertical scroll range.
    const native=[...candidates.values()].filter(c=>c.overflow!=='hidden');
    const eligible=native.length?native:[...candidates.values()].filter(c=>c.node.scrollHeight>c.node.clientHeight+2);
    eligible.sort((a,b)=>b.count-a.count || a.depth/a.count-b.depth/b.count);
    if (!eligible.length) return {missing:true,diagnostics};
    const chosen=eligible[0];
    if (eligible.some(c=>c!==chosen && c.count===chosen.count && !chosen.node.contains(c.node) && !c.node.contains(chosen.node))) {
      return {ambiguous:true,diagnostics};
    }
    const scroller=chosen.node, reverse=getComputedStyle(scroller).flexDirection==='column-reverse';
    const limit=scroller.scrollHeight-scroller.clientHeight;
    if(direction==='latest')scroller.scrollTop=reverse?0:limit;
    if(direction==='older')scroller.scrollTop-=scroller.clientHeight*0.5;
    const top=scroller.scrollTop;
    return {reverse,top,height:scroller.scrollHeight,viewport:scroller.clientHeight,
      atLatest:reverse?Math.abs(top)<3:Math.abs(limit-top)<3};
  },direction);
}
export const inspectHistory = page => historyPosition(page,'diagnostics');
export async function moveHistory(page,direction) {
  const result=await historyPosition(page,direction);
  if(result.missing)throw Error('WHATSAPP_SCROLL_CONTAINER_MISSING');
  if(result.ambiguous)throw Error('WHATSAPP_SCROLL_CONTAINER_AMBIGUOUS');
  return result;
}

export async function settleLatest(page, readRows, { wait = sleep, attempts = 30, delay = 500 } = {}) {
  let previous = '', stable = 0, lastMissing = false;
  for (let i = 0; i < attempts; i++) {
    let position;
    try {
      await moveHistory(page, 'latest');
      await wait(delay);
      position = await moveHistory(page, 'inspect');
      lastMissing=false;
    } catch (error) {
      if (!error.message.includes('WHATSAPP_SCROLL_CONTAINER_MISSING')) throw error;
      lastMissing=true;stable=0;previous='';await wait(delay);continue;
    }
    const rows = await readRows();
    const fingerprint = JSON.stringify([position.top, position.height, rows.map(r => r.id)]);
    stable = position.atLatest && rows.length && fingerprint === previous ? stable + 1 : 0;
    previous = fingerprint;
    // Allow initial sync/anchor restoration to finish; one scroll plus 800ms is insufficient.
    if (i >= 4 && stable >= 3) return {rows, position, attempts:i + 1};
  }
  if(lastMissing)throw Error('WHATSAPP_SCROLL_CONTAINER_MISSING');
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
