import { auth } from '@/lib/firebase';

/**
 * Wait for Firebase Auth to finish initializing.
 * On mobile devices (especially Android), auth.currentUser can be null
 * while Firebase restores the session from IndexedDB.
 * Uses authStateReady() which resolves only after the state is fully determined.
 */
async function waitForAuth(timeoutMs = 5000) {
  if (auth.currentUser) return auth.currentUser;

  await Promise.race([
    auth.authStateReady(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Not authenticated')), timeoutMs)
    ),
  ]);

  if (!auth.currentUser) {
    throw new Error('Not authenticated');
  }
  return auth.currentUser;
}

/**
 * Fetch wrapper that attaches Firebase Auth Bearer token.
 * Use from dashboard components for admin-only API calls.
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const currentUser = await waitForAuth();
  if (!currentUser) {
    throw new Error('Not authenticated');
  }

  const token = await currentUser.getIdToken();
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);

  return fetch(url, { ...options, headers });
}
