import { requireCloud, sha256 } from './cloud-policy';
import type { ReadCurrentPdf } from './cloud-approval';

// Explicit server-configured storage origins only. No arbitrary URLs, redirects,
// forwarded credentials, retries, or raw network errors in responses.
export function createReviewPdfReader(origins: string[], fetcher: typeof fetch = fetch): ReadCurrentPdf {
  return async media => {
    requireCloud(Array.isArray(origins) && origins.length > 0 && origins.length <= 8, 503, 'Review storage origins are not configured');
    const validOrigin = (origin: string) => {
      try { const url = new URL(origin); return url.protocol === 'https:' && !url.username && !url.password && !url.port && url.origin === origin; }
      catch { return false; }
    };
    requireCloud(origins.every(origin => typeof origin === 'string' && validOrigin(origin)), 503, 'Invalid review storage origin');
    requireCloud(typeof media.url === 'string' && media.type === 'pdf', 409, 'Current PDF metadata is unavailable');
    let url: URL;
    try { url = new URL(media.url); } catch { throw Error('Current PDF metadata is unavailable'); }
    requireCloud(url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash && !url.search
      && origins.includes(url.origin), 409, 'Current PDF is outside configured storage origins');
    const response = await fetcher(url.toString(), { method: 'GET', redirect: 'error', credentials: 'omit',
      cache: 'no-store', signal: AbortSignal.timeout(15000) });
    requireCloud(response.ok && response.body && (!response.url || response.url === url.toString()), 503, 'Current PDF could not be read');
    const reader = response.body.getReader(), chunks: Buffer[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        size += value.length;
        requireCloud(size <= 3 * 1024 * 1024, 413, 'Current PDF exceeds the review limit');
        chunks.push(Buffer.from(value));
      }
    } catch (error) { await reader.cancel(); throw error; }
    finally { reader.releaseLock(); }
    const bytes = Buffer.concat(chunks);
    requireCloud(bytes.subarray(0, 5).toString() === '%PDF-' && size > 5
      && (media.size == null || media.size === size), 409, 'Current PDF bytes do not match metadata');
    return { sha256: sha256(bytes), size };
  };
}
