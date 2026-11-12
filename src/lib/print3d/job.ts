// One click → the files to print: plaques (two colours) laid out on H2D plates, plus black bases.
// Runs in the browser. Every plaque is decoded from its REAL face geometry before it is written.
import jsQR from 'jsqr';
import { zipSync } from 'fflate';
import { qrMatrix, readsUpright } from './matrix';
import { buildBase, buildPlaque, type PlaqueParts } from './build';
import { make3mf, type PrintObject } from './threemf';
import { KEYCHAIN, PLAQUES, PLATE, perPlate, plateSlots, type Print3DMount, type Print3DShape, type Print3DSize } from './presets';

/** Filament slots in the file. Rani's AMS: slot 1 black, slot 2 white. */
export const FILAMENT_BLACK = 1;
export const FILAMENT_WHITE = 2;

/** H2D bed (single-nozzle reach); our plate area is centred on it. */
const BED = { w: 350, h: 320 };

export interface JobItem { number: number; url: string; lines: string[]; name: string }
export interface JobFile { name: string; bytes: Uint8Array; pieces: number; kind: 'plaques' | 'bases' }
export interface JobResult { files: JobFile[]; failed: number[] }

export function buildJob(opts: { shape: Print3DShape; size: Print3DSize; mount: Print3DMount; backNumber: boolean; items: JobItem[]; title: string }): JobResult {
  const spec = PLAQUES[opts.shape === 'gnome' ? 'standard' : opts.size];
  const keychain = opts.shape === 'keychain';
  const failed: number[] = [];
  const plaques: { item: JobItem; parts: PlaqueParts }[] = [];
  for (const item of opts.items) {
    const parts = buildPlaque(spec, qrMatrix(item.url), item.lines, opts.backNumber ? item.number : null, { keychain });
    if (!faceDecodes(parts, item.url)) { failed.push(item.number); continue; }
    plaques.push({ item, parts });
  }

  const files: JobFile[] = [];
  const footW = keychain ? KEYCHAIN.w : spec.w;
  const footH = keychain ? KEYCHAIN.h + KEYCHAIN.tab : spec.h;
  const per = Math.max(1, perPlate(footW, footH, true));
  const plateCount = Math.ceil(plaques.length / per);
  for (let p = 0; p < plateCount; p++) {
    const chunk = plaques.slice(p * per, (p + 1) * per);
    const slots = plateSlots(footW, footH, chunk.length, true);
    const objects: PrintObject[] = chunk.map(({ item, parts }, i) => ({
      name: item.name,
      x: bedX(slots[i].x),
      y: bedY(slots[i].y, footH),
      parts: [
        { name: 'לבן', mesh: parts.white, filament: FILAMENT_WHITE },
        { name: 'שחור', mesh: parts.black, filament: FILAMENT_BLACK },
      ],
    }));
    files.push({ name: `qr-plaques${plateCount > 1 ? `-${p + 1}of${plateCount}` : ''}.3mf`, bytes: make3mf(objects, { title: opts.title }), pieces: chunk.length, kind: 'plaques' });
  }

  if (opts.shape === 'base' && plaques.length) {
    const { mesh, base } = buildBase(spec, opts.mount);
    const perBase = Math.max(1, perPlate(base.w, base.h, false));
    const n = plaques.length;
    const plates = Math.ceil(n / perBase);
    for (let p = 0; p < plates; p++) {
      const count = Math.min(perBase, n - p * perBase);
      const slots = plateSlots(base.w, base.h, count, false);
      const objects: PrintObject[] = slots.map((s, i) => ({
        name: `בסיס ${p * perBase + i + 1}`,
        x: bedX(s.x),
        y: bedY(s.y, base.h),
        parts: [{ name: 'שחור', mesh, filament: FILAMENT_BLACK }],
      }));
      files.push({ name: `qr-bases${plates > 1 ? `-${p + 1}of${plates}` : ''}.3mf`, bytes: make3mf(objects, { title: `${opts.title} — בסיסים` }), pieces: count, kind: 'bases' });
    }
  }
  return { files, failed };
}

/** One file → itself; several → one zip (browsers block a burst of downloads). */
export function packForDownload(files: JobFile[], zipName: string): { name: string; blob: Blob } {
  if (files.length === 1) return { name: files[0].name, blob: new Blob([files[0].bytes as BlobPart], { type: 'model/3mf' }) };
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) entries[f.name] = f.bytes;
  return { name: zipName, blob: new Blob([zipSync(entries, { level: 0 }) as BlobPart], { type: 'application/zip' }) };
}

function bedX(slotX: number): number {
  return (BED.w - PLATE.w) / 2 + slotX;
}
function bedY(slotY: number, itemH: number): number {
  // slots run top→bottom as seen in Bambu's top view; the bed's y grows towards the back
  return (BED.h - PLATE.h) / 2 + (PLATE.h - slotY - itemH);
}

/**
 * Decode the plaque from its black geometry as a phone would see it: look at the face from below
 * (that un-mirrors x), rasterise, jsQR. Proves matrix + mirroring + layout together.
 */
export function faceDecodes(parts: PlaqueParts, url: string): boolean {
  const pxPerMm = 8;
  const pad = 6;
  const W = Math.ceil((parts.w + 2 * pad) * pxPerMm);
  const H = Math.ceil((parts.h + 2 * pad) * pxPerMm);
  const data = new Uint8ClampedArray(W * H * 4).fill(255);
  const v = parts.black.v;
  // every box is 8 consecutive vertices (prism over 4 corners); fill its x/y extent
  for (let b = 0; b < v.length; b += 24) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let k = 0; k < 24; k += 3) {
      x0 = Math.min(x0, v[b + k]); x1 = Math.max(x1, v[b + k]);
      y0 = Math.min(y0, v[b + k + 1]); y1 = Math.max(y1, v[b + k + 1]);
    }
    // seen from below: front-view u = w − x; front-view v (down) = h − y
    const u0 = Math.round((parts.w - x1 + pad) * pxPerMm);
    const u1 = Math.round((parts.w - x0 + pad) * pxPerMm);
    const r0 = Math.round((parts.h - y1 + pad) * pxPerMm);
    const r1 = Math.round((parts.h - y0 + pad) * pxPerMm);
    for (let yy = Math.max(0, r0); yy < Math.min(H, r1); yy++)
      for (let xx = Math.max(0, u0); xx < Math.min(W, u1); xx++) {
        const i = (yy * W + xx) * 4;
        data[i] = data[i + 1] = data[i + 2] = 0;
      }
  }
  return readsUpright(jsQR(data, W, H, { inversionAttempts: 'dontInvert' }), url);
}
