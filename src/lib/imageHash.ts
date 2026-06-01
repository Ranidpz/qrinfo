/**
 * Content hashing for gallery dedup.
 *
 * The dedup key for Selfie Beam uploads is the SHA-256 of the file's ORIGINAL
 * bytes — NOT its name or timestamp. This means:
 *   - the same image dropped again (even renamed to "photo(1).jpg") is skipped,
 *   - a different image that happens to share a filename still uploads.
 *
 * Hashing runs client-side via the Web Crypto API (available in all modern
 * browsers over HTTPS/localhost), so no bytes leave the device just to dedup.
 */

/** Compute the SHA-256 hex digest of a File/Blob's raw bytes. */
export async function hashFile(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  return hashArrayBuffer(buffer);
}

/** Compute the SHA-256 hex digest of an ArrayBuffer. */
export async function hashArrayBuffer(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return bufferToHex(digest);
}

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}
