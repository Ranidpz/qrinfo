/**
 * קוד הגמדים — AWS SigV4 query presigning for a single R2 (S3 API) PUT. Pure Node
 * `crypto`, no SDK: the signed headers pin the exact Content-Type AND Content-Length, so
 * the browser can only upload the file it declared (type + size ≤ the cap checked
 * before signing). R2: region `auto`, service `s3`.
 */

import { createHash, createHmac } from 'crypto';

export interface PresignInput {
  method: 'PUT' | 'GET';
  host: string;                 // e.g. {account}.r2.cloudflarestorage.com
  path: string;                 // "/bucket/key/with/slashes" (unencoded)
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service?: string;
  /** Lower-case header name → value; `host` is always signed. */
  headers?: Record<string, string>;
  expiresSeconds: number;
  now: Date;
}

const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const hmac = (key: Buffer | string, data: string) => createHmac('sha256', key).update(data, 'utf8').digest();
const sha = (data: string) => createHash('sha256').update(data, 'utf8').digest('hex');

export function amzDate(d: Date): { date: string; stamp: string } {
  const iso = d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return { stamp: iso, date: iso.slice(0, 8) };
}

/** Full presigned URL (https). */
export function presignUrl(input: PresignInput): string {
  const service = input.service || 's3';
  const { stamp, date } = amzDate(input.now);
  const scope = `${date}/${input.region}/${service}/aws4_request`;
  const headers: Record<string, string> = { host: input.host };
  for (const [k, v] of Object.entries(input.headers || {})) headers[k.toLowerCase()] = String(v).trim();
  const names = Object.keys(headers).sort();
  const signedHeaders = names.join(';');
  const canonicalHeaders = names.map((n) => `${n}:${headers[n]}\n`).join('');
  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${input.accessKeyId}/${scope}`,
    'X-Amz-Date': stamp,
    'X-Amz-Expires': String(input.expiresSeconds),
    'X-Amz-SignedHeaders': signedHeaders,
  };
  const canonicalQuery = Object.keys(query).sort().map((k) => `${enc(k)}=${enc(query[k])}`).join('&');
  const canonicalPath = input.path.split('/').map(enc).join('/');
  const canonicalRequest = [input.method, canonicalPath, canonicalQuery, canonicalHeaders, signedHeaders, 'UNSIGNED-PAYLOAD'].join('\n');
  const toSign = ['AWS4-HMAC-SHA256', stamp, scope, sha(canonicalRequest)].join('\n');
  const kDate = hmac(`AWS4${input.secretAccessKey}`, date);
  const kSigning = hmac(hmac(hmac(kDate, input.region), service), 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(toSign, 'utf8').digest('hex');
  return `https://${input.host}${canonicalPath}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
