import { timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';

export function hasValidServerApiKey(
  request: NextRequest,
  envName: string,
  headerNames: string[]
): boolean {
  const expected = process.env[envName];
  if (!expected) return false;

  const provided = headerNames
    .map((name) => request.headers.get(name))
    .find((value): value is string => !!value);

  if (!provided) return false;

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}
