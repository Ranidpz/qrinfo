// The plaque face as black rectangles in millimetres — shared by the SVG preview and the 3D file,
// so the preview is exactly what prints. Front view: origin at the plaque's top-left, x right, y DOWN.
import type { QrMatrix } from './matrix';
import { faceLayout, type FaceLayout } from './presets';
import { textCells } from './font';

export interface MmRect { x: number; y: number; w: number; h: number }

/** Below this a text cell is thinner than what a 0.4 mm nozzle can draw cleanly. */
export const MIN_TEXT_CELL = 0.45;

export interface FaceDesign {
  w: number;
  h: number;
  layout: FaceLayout;
  black: MmRect[];
  /** mm per font cell, 0 when there is no text */
  textCell: number;
  textTooSmall: boolean;
}

/** QR modules → as few rectangles as possible (row runs, then identical runs merged downwards). */
export function qrRects(m: QrMatrix, x0: number, y0: number, mod: number): MmRect[] {
  const out: MmRect[] = [];
  let open = new Map<string, MmRect>();
  for (let r = 0; r < m.size; r++) {
    const next = new Map<string, MmRect>();
    const row = m.rows[r];
    let c = 0;
    while (c < row.length) {
      if (!row[c]) { c++; continue; }
      let e = c;
      while (e < row.length && row[e]) e++;
      const key = `${c}-${e}`;
      const prev = open.get(key);
      if (prev) { prev.h += mod; next.set(key, prev); open.delete(key); }
      else next.set(key, { x: x0 + c * mod, y: y0 + r * mod, w: (e - c) * mod, h: mod });
      c = e;
    }
    for (const rect of open.values()) out.push(rect);
    open = next;
  }
  for (const rect of open.values()) out.push(rect);
  return out;
}

export function faceDesign(w: number, h: number, matrix: QrMatrix, lines: string[]): FaceDesign {
  const layout = faceLayout(w, h, matrix.size);
  const black = qrRects(matrix, layout.qrX, layout.qrY, layout.module);
  const usable = lines.filter((l) => l.length);
  let textCell = 0;
  if (usable.length && layout.band > 1) {
    const t = textCells(usable);
    const boxW = w - 2 * layout.qrX;
    const maxCell = (w * 0.13) / 7;
    textCell = Math.min(boxW / t.w, layout.band / t.h, maxCell);
    const tx = (w - t.w * textCell) / 2;
    const ty = layout.bandTop + (layout.band - t.h * textCell) / 2;
    for (const r of t.rects) black.push({ x: tx + r.x * textCell, y: ty + r.y * textCell, w: r.w * textCell, h: r.h * textCell });
  }
  return { w, h, layout, black, textCell, textTooSmall: textCell > 0 && textCell < MIN_TEXT_CELL };
}

/** Web address split for printing under the code: "qr.playzones.app" / "v/AbC123". */
export function addressLines(url: string): string[] {
  const bare = url.replace(/^https?:\/\//, '');
  const i = bare.indexOf('/');
  return i < 0 ? [bare] : [bare.slice(0, i), bare.slice(i + 1)];
}
