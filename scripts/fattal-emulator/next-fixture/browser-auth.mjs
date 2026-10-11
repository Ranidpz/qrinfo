import { emulatorToken } from './emulator-token.mjs';

// Only the browser's login bootstrap is replaced. The real server auth guard
// verifies this synthetic emulator token and reads its role from real Firestore.
export function fetchWithAuth(url, init = {}) {
  if (!String(url).startsWith('/api/content-intake/dot/approvals')) throw Error('Unexpected fixture request');
  return fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${emulatorToken('synthetic-admin')}` } });
}
