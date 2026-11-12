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
  const res = jsQR(data, w, w, { inversionAttempts: 'dontInvert' });
  return res?.data === m.url;
}
