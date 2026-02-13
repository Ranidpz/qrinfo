import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

/**
 * Wait for Firebase Auth to finish initializing.
 * On mobile devices, auth.currentUser can be null for a brief period
 * after page load while Firebase restores the session from storage.
 */
function waitForAuth(timeoutMs = 5000): Promise<typeof auth.currentUser> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error('Not authenticated'));
    }, timeoutMs);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      clearTimeout(timer);
      unsubscribe();
      if (user) {
        resolve(user);
      } else {
        reject(new Error('Not authenticated'));
      }
    });
  });
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
