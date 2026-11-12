// The only place server code may import sharp from (enforced by `npm run security:check`).
//
// SVG decoding is blocked process-wide. We never accept SVG uploads, and librsvg (sharp's SVG
// decoder) is where its worst advisories live — e.g. GHSA-wq5f-xc86-pv6w, a use-after-free that
// can reach code execution. sharp picks the decoder from the BYTES, not the declared mime type,
// so without this block an SVG sent as "image/png" to a public upload route would still be
// decoded as SVG. With it, sharp rejects the input as an unsupported format and every caller
// already handles that path (avatar → 400, upload → stores the original, Social Wall → BAD_IMAGE).
import sharp from 'sharp';

sharp.block({ operation: ['VipsForeignLoadSvg'] });

export default sharp;
export type { Metadata } from 'sharp';
