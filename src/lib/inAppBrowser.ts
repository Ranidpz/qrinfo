// Shared in-app browser detection + escape helpers.
//
// In-app browsers (notably SFSafariViewController on iOS, opened when a link is tapped inside
// WhatsApp / Instagram / Facebook) isolate localStorage and have flaky camera + upload support.
// A Selfie Beam or Q.Games link shared over WhatsApp therefore breaks: uploads fail and the
// photographer `?pk=` token can't persist. Detect these browsers so we can nudge the user to
// reopen the page in the real system browser.
//
// Used by both QGamesRegistration and SelfiebeamViewer — keep the two in sync via this module.

/** True when running inside a known in-app browser. Detect ONLY via UA strings — avoid fragile
 *  heuristics like the `window.safari` check, which false-positives in regular Safari. */
export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/FBAN|FBAV/i.test(ua)) return true;             // Facebook
  if (/Instagram/i.test(ua)) return true;             // Instagram
  if (/WhatsApp/i.test(ua)) return true;              // WhatsApp
  if (/TelegramBot|Telegram/i.test(ua)) return true;  // Telegram
  if (/\bLine\//i.test(ua)) return true;              // Line
  if (/; wv\b/.test(ua)) return true;                 // Android WebView (generic)
  return false;
}

/** Open the current URL in the system browser. Trick: clicking a `target="_blank"` anchor breaks
 *  out of SFSafariViewController into Safari (iOS) and out of Custom Tabs into Chrome (Android). */
export function openCurrentUrlInBrowser(): void {
  if (typeof window === 'undefined') return;
  const a = document.createElement('a');
  a.href = window.location.href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
