import DOMPurify from 'dompurify';

/**
 * Sanitize owner-authored rich text (the weekly-calendar notes editor: headings, bold,
 * lists, rules) before it is rendered with dangerouslySetInnerHTML on public pages.
 * Uses the browser DOMPurify — on the server (no DOM) it returns an empty string, so call
 * it only from code that renders after mount.
 */
const ALLOWED_TAGS = ['p', 'div', 'br', 'span', 'h1', 'h2', 'h3', 'h4', 'b', 'strong', 'i', 'em', 'u', 's', 'ul', 'ol', 'li', 'hr', 'a', 'blockquote'];
const ALLOWED_ATTR = ['href', 'target', 'rel', 'dir'];

export function sanitizeRichText(html: string | undefined | null): string {
  if (!html) return '';
  if (typeof window === 'undefined' || !DOMPurify.isSupported) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|sms:|whatsapp:)/i,
  });
}
