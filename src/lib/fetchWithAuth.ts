import { auth } from '@/lib/firebase';

/**
 * Fetch wrapper that attaches Firebase Auth Bearer token.
 * Use from dashboard components for admin-only API calls.
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Not authenticated');
  }

  const token = await currentUser.getIdToken();
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);

  return fetch(url, { ...options, headers });
}
