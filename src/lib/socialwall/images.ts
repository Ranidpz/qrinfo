// Social Wall image pipeline (server). The phone already shrinks the photo, but nothing it sends
// is trusted: the format is detected from the bytes (not the declared mime), oversized pixel
// counts are refused before decoding (decompression bombs), the EXIF orientation is applied and
// ALL metadata is dropped — phone photos carry GPS, and nobody's home address goes on the feed.

import sharp from 'sharp';
import { SocialWallError } from './store';

const ACCEPTED = new Set(['jpeg', 'png', 'webp', 'heif']);
const MAX_INPUT_PIXELS = 50_000_000; // ~8K x 6K
const FULL_EDGE = 1600;
const CARD_EDGE = 720;

export interface ProcessedImage {
  full: Buffer;
  card: Buffer;
  width: number;
  height: number;
}

export async function processPostImage(input: Buffer): Promise<ProcessedImage> {
  let meta: sharp.Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new SocialWallError('BAD_IMAGE', 400);
  }
  if (!meta.format || !ACCEPTED.has(meta.format)) throw new SocialWallError('BAD_IMAGE', 400);

  try {
    // .rotate() with no angle = apply the EXIF orientation; sharp writes no metadata unless asked.
    const base = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' }).rotate();
    const { data: full, info } = await base
      .clone()
      .resize({ width: FULL_EDGE, height: FULL_EDGE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    const card = await base
      .clone()
      .resize({ width: CARD_EDGE, height: CARD_EDGE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    return { full, card, width: info.width, height: info.height };
  } catch {
    throw new SocialWallError('BAD_IMAGE', 400);
  }
}
