// True when the page runs inside a frame - e.g. the public viewer embedded by the TVzone signage
// player (allowed for /v/ in next.config.ts). Things that only make sense in a top-level tab, like
// the "add to home screen" prompt and the PWA service worker, are skipped there.
export function isFramed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true; // a cross-origin parent can make the comparison throw
  }
}
