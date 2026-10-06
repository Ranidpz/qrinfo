// Self-contained browser function, shared by extraction and clicking. A filename
// in ordinary chat text or a quoted message is never a downloadable attachment.
export function inspectDocumentCard(element, { select = false } = {}) {
  const excluded = 'header, footer, [role="dialog"], [data-testid="quoted-message"], [data-testid="quoted"], [data-testid="quoted-message-container"], [data-testid="quoted-document"], [data-quoted-message-id]';
  const own = node => !node.closest(excluded);
  const normalize = value => String(value || '').normalize('NFC').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu, '').replace(/\s+/gu, ' ').trim().replace(/\.pdf$/iu, '.pdf');
  const namesIn = root => {
    const copy = root.cloneNode(true);
    for (const node of copy.querySelectorAll(excluded)) node.remove();
    const labelText = node => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent;
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      const value = [...node.childNodes].map(labelText).join('');
      return /^(DIV|P|BUTTON|BR|LI|SECTION)$/.test(node.tagName) ? `\n${value}\n` : value;
    };
    const values = labelText(copy).split('\n');
    for (const node of [copy, ...copy.querySelectorAll('[title], [aria-label]')]) {
      for (const attr of ['title', 'aria-label']) if (node.hasAttribute(attr)) values.push(node.getAttribute(attr));
    }
    const names = new Map();
    for (const value of values) {
      const key = normalize(value);
      if (key.length <= 300 && /\.pdf$/iu.test(key) && !names.has(key)) names.set(key, String(value).trim());
    }
    return [...names.values()];
  };
  const thumbs = [...element.querySelectorAll('[data-testid="document-thumb"]')].filter(own);
  const iconSelector = '[data-icon="document"], [data-icon="document-pdf"], [data-testid="document-icon"]';
  // Newer cards may expose a semantic button rather than document-thumb.
  // Require both a document icon and a complete PDF label; generic buttons,
  // download controls, text, image thumbnails and quoted cards do not qualify.
  const buttons = [...element.querySelectorAll('button, [role="button"]')].filter(node => own(node)
    && [...node.querySelectorAll(iconSelector)].some(own) && namesIn(node).length > 0
    && !/^(download|הורדה)$/iu.test((node.getAttribute('aria-label') || '').trim()));
  const fallback = buttons.filter(node => !thumbs.some(thumb => node.contains(thumb) || thumb.contains(node))
    && !buttons.some(other => other !== node && node.contains(other)));
  const cards = [...thumbs, ...fallback];
  const names = cards.length ? namesIn(element) : [];
  const ambiguousPdf = cards.length > 1 || (cards.length > 0 && names.length > 1);
  if (select) return cards.length === 1 && names.length <= 1 ? cards[0] : null;
  const filename = cards.length === 1 && names.length === 1 ? names[0] : null;
  return {
    filename, ambiguousPdf, thumbnailCount: thumbs.length, documentCardCount: cards.length,
    attachmentUnreadable: cards.length > 0 && names.length === 0,
    documentIconCount: [...element.querySelectorAll(iconSelector)].filter(own).length,
    pdfLabelCandidates: namesIn(element).slice(0, 6),
    attachmentKind: filename ? (thumbs.length ? 'thumbnail' : 'document_button') : null,
    classification: filename ? 'pdf' : ambiguousPdf ? 'ambiguous_pdf' : cards.length ? 'unreadable_pdf' : 'no_verified_document_card',
  };
}
