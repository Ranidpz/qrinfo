// QR module grid for printed plaques — the same calls as hardware/thecode-gnomes/qrmatrix.mjs.
import QRCode from 'qrcode';
import jsQR from 'jsqr';

export interface QrMatrix {
  url: string;
  version: number;
  size: number;
  /** rows of booleans, true = black module */
  rows: boolean[][];
}

/** Level M: no centre logo on a printed plaque, so we take the bigger modules over extra repair. */
export function qrMatrix(url: string): QrMatrix {
  const qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const rows: boolean[][] = [];
  for (let r = 0; r < n; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < n; c++) row.push(Boolean(qr.modules.get(r, c)));
    rows.push(row);
  }
  return { url, version: qr.version, size: n, rows };
}

/** The plaque prints face-down, so the model carries the code mirrored left↔right. */
export function mirrored(m: QrMatrix): QrMatrix {
  return { ...m, rows: m.rows.map((r) => [...r].reverse()) };
}

/** Render the grid (4-module quiet zone, 6 px per module) and decode it back. */
export function decodes(m: QrMatrix): boolean {
  const px = 6;
  const q = 4;
  const w = (m.size + 2 * q) * px;
  const data = new Uint8ClampedArray(w * w * 4).fill(255);
  for (let r = 0; r < m.size; r++)
    for (let c = 0; c < m.size; c++)
      if (m.rows[r][c])
        for (let y = 0; y < px; y++)
          for (let x = 0; x < px; x++) {
            const i = (((r + q) * px + y) * w + (c + q) * px + x) * 4;
            data[i] = data[i + 1] = data[i + 2] = 0;
          }
  return readsUpright(jsQR(data, w, w, { inversionAttempts: 'dontInvert' }), m.url);
}

type JsQrResult = ReturnType<typeof jsQR>;

/**
 * jsQR also reads a MIRRORED code (it retries transposed), so "it decodes" is not enough. Our check
 * images are always drawn upright, so the three finder squares must land exactly top-left,
 * top-right and bottom-left. A mirrored code reports them rotated (e.g. "top-left" on the right).
 */
export function readsUpright(res: JsQrResult, url: string): boolean {
  if (!res || res.data !== url) return false;
  const { topLeftFinderPattern: tl, topRightFinderPattern: tr, bottomLeftFinderPattern: bl } = res.location;
  const span = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const tol = span * 0.1;
  return tr.x - tl.x > span * 0.9 && Math.abs(tr.y - tl.y) < tol && bl.y - tl.y > span * 0.9 && Math.abs(bl.x - tl.x) < tol;
}
