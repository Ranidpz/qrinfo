/**
 * Per-photo delete tokens handed out by /api/gallery POST. A participant (no account) keeps the
 * token for each photo they uploaded and sends it back to delete exactly that photo.
 * localStorage so it survives a tab close; every access is guarded (private mode / blocked storage).
 */
const PREFIX = 'gallery-del-';

export function saveGalleryDeleteToken(imageId: string, token?: string | null): void {
  if (!token) return;
  try {
    localStorage.setItem(PREFIX + imageId, token);
  } catch {
    // storage unavailable — the photo just can't be self-deleted later
  }
}

export function getGalleryDeleteToken(imageId: string): string | undefined {
  try {
    return localStorage.getItem(PREFIX + imageId) || undefined;
  } catch {
    return undefined;
  }
}

export function forgetGalleryDeleteToken(imageId: string): void {
  try {
    localStorage.removeItem(PREFIX + imageId);
  } catch {
    // ignore
  }
}
