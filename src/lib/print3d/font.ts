// Block pixel font for text printed INTO a plaque (manual code, short text, back number).
// Every glyph is 5 × 7 cells; a cell becomes a printed square, so the stroke width is one cell. At the
// sizes we use a cell is 0.55–0.7 mm, wider than a 0.4 mm nozzle line → crisp, no thin strokes.
// The same glyphs draw the on-screen preview AND the 3D geometry, so what you see is what prints.

const G: Record<string, string> = {
  A: '01110 10001 10001 11111 10001 10001 10001',
  B: '11110 10001 10001 11110 10001 10001 11110',
  C: '01110 10001 10000 10000 10000 10001 01110',
  D: '11110 10001 10001 10001 10001 10001 11110',
  E: '11111 10000 10000 11110 10000 10000 11111',
  F: '11111 10000 10000 11110 10000 10000 10000',
  G: '01110 10001 10000 10111 10001 10001 01111',
  H: '10001 10001 10001 11111 10001 10001 10001',
  I: '01110 00100 00100 00100 00100 00100 01110',
  J: '00111 00010 00010 00010 00010 10010 01100',
  K: '10001 10010 10100 11000 10100 10010 10001',
  L: '10000 10000 10000 10000 10000 10000 11111',
  M: '10001 11011 10101 10101 10001 10001 10001',
  N: '10001 10001 11001 10101 10011 10001 10001',
  O: '01110 10001 10001 10001 10001 10001 01110',
  P: '11110 10001 10001 11110 10000 10000 10000',
  Q: '01110 10001 10001 10001 10101 10010 01101',
  R: '11110 10001 10001 11110 10100 10010 10001',
  S: '01111 10000 10000 01110 00001 00001 11110',
  T: '11111 00100 00100 00100 00100 00100 00100',
  U: '10001 10001 10001 10001 10001 10001 01110',
  V: '10001 10001 10001 10001 10001 01010 00100',
  W: '10001 10001 10001 10101 10101 10101 01010',
  X: '10001 10001 01010 00100 01010 10001 10001',
  Y: '10001 10001 01010 00100 00100 00100 00100',
  Z: '11111 00001 00010 00100 01000 10000 11111',
  a: '00000 00000 01110 00001 01111 10001 01111',
  b: '10000 10000 10110 11001 10001 10001 11110',
  c: '00000 00000 01110 10000 10000 10001 01110',
  d: '00001 00001 01101 10011 10001 10001 01111',
  e: '00000 00000 01110 10001 11111 10000 01110',
  f: '00110 01001 01000 11100 01000 01000 01000',
  g: '00000 01111 10001 10001 01111 00001 01110',
  h: '10000 10000 10110 11001 10001 10001 10001',
  i: '00100 00000 01100 00100 00100 00100 01110',
  j: '00010 00000 00110 00010 00010 10010 01100',
  k: '10000 10000 10010 10100 11000 10100 10010',
  l: '01100 00100 00100 00100 00100 00100 01110',
  m: '00000 00000 11010 10101 10101 10001 10001',
  n: '00000 00000 10110 11001 10001 10001 10001',
  o: '00000 00000 01110 10001 10001 10001 01110',
  p: '00000 00000 11110 10001 11110 10000 10000',
  q: '00000 00000 01101 10011 01111 00001 00001',
  r: '00000 00000 10110 11001 10000 10000 10000',
  s: '00000 00000 01110 10000 01110 00001 11110',
  t: '01000 01000 11100 01000 01000 01001 00110',
  u: '00000 00000 10001 10001 10001 10011 01101',
  v: '00000 00000 10001 10001 10001 01010 00100',
  w: '00000 00000 10001 10001 10101 10101 01010',
  x: '00000 00000 10001 01010 00100 01010 10001',
  y: '00000 00000 10001 10001 01111 00001 01110',
  z: '00000 00000 11111 00010 00100 01000 11111',
  '0': '01110 10001 10011 10101 11001 10001 01110',
  '1': '00100 01100 00100 00100 00100 00100 01110',
  '2': '01110 10001 00001 00010 00100 01000 11111',
  '3': '11111 00010 00100 00010 00001 10001 01110',
  '4': '00010 00110 01010 10010 11111 00010 00010',
  '5': '11111 10000 11110 00001 00001 10001 01110',
  '6': '00110 01000 10000 11110 10001 10001 01110',
  '7': '11111 00001 00010 00100 01000 01000 01000',
  '8': '01110 10001 10001 01110 10001 10001 01110',
  '9': '01110 10001 10001 01111 00001 00010 01100',
  ' ': '00000 00000 00000 00000 00000 00000 00000',
  '-': '00000 00000 00000 11111 00000 00000 00000',
  '.': '00000 00000 00000 00000 00000 01100 01100',
  '/': '00001 00001 00010 00100 01000 10000 10000',
  ':': '00000 01100 01100 00000 01100 01100 00000',
  '!': '00100 00100 00100 00100 00100 00000 00100',
  '?': '01110 10001 00001 00010 00100 00000 00100',
  '#': '01010 01010 11111 01010 11111 01010 01010',
};

export const GLYPH_W = 5;
export const GLYPH_H = 7;
export const GLYPH_GAP = 1;
export const LINE_GAP = 2;

/** Keep only characters the font can print. */
export function printableText(s: string): string {
  return [...s].filter((ch) => G[ch] !== undefined).join('');
}

/** Width of one line in cells. */
export function lineCells(line: string): number {
  return line.length ? line.length * (GLYPH_W + GLYPH_GAP) - GLYPH_GAP : 0;
}

export interface CellRect { x: number; y: number; w: number; h: number }

/**
 * Text lines → filled rectangles in CELL units (x right, y down from the top-left of the block).
 * Lines are centred on the widest line. Each glyph row is merged into horizontal runs.
 */
export function textCells(lines: string[]): { rects: CellRect[]; w: number; h: number } {
  const w = Math.max(0, ...lines.map(lineCells));
  const h = lines.length ? lines.length * GLYPH_H + (lines.length - 1) * LINE_GAP : 0;
  const rects: CellRect[] = [];
  lines.forEach((line, li) => {
    const x0 = (w - lineCells(line)) / 2;
    const y0 = li * (GLYPH_H + LINE_GAP);
    [...line].forEach((ch, ci) => {
      const rows = (G[ch] ?? G[' ']).split(' ');
      const gx = x0 + ci * (GLYPH_W + GLYPH_GAP);
      rows.forEach((row, ry) => {
        let c = 0;
        while (c < GLYPH_W) {
          if (row[c] !== '1') { c++; continue; }
          let e = c;
          while (e < GLYPH_W && row[e] === '1') e++;
          rects.push({ x: gx + c, y: y0 + ry, w: e - c, h: 1 });
          c = e;
        }
      });
    });
  });
  return { rects, w, h };
}

/** Cell size (mm) that fits the lines into a box, capped so short codes don't grow huge. */
export function cellSizeFor(lines: string[], boxW: number, boxH: number, maxCell: number): number {
  const { w, h } = textCells(lines);
  if (!w || !h) return 0;
  return Math.min(boxW / w, boxH / h, maxCell);
}
