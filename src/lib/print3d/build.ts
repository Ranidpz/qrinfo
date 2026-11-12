// Plaque + base geometry for the 3D file. Same numbers as the preview (presets.ts / face.ts).
//
// PLAQUE — printed FACE-DOWN: z = 0 is the face on the bed. Front view (u right, v down from the top)
// maps to model space MIRRORED: x = w − u, y = h − v, so the face reads correctly once lifted off.
//   z 0 … ink        face slab: "black" = modules + text, "white" = the rest of the outline
//   z ink … t        white body (top 0.6 mm minus the engraved back number, when asked)
//   z t … t + pegH   two pegs (white), asymmetric → the plaque fits one way only
// BASE — printed POCKET-UP, black only. Front view maps straight: x = u, y = h − v.

import type { QrMatrix } from './matrix';
import { faceDesign } from './face';
import { textCells } from './font';
import { Mesh, slab, type Circle, type Rect } from './mesh';
import { KEYCHAIN, baseFor, type BaseSpec, type PlaqueSpec, type Print3DMount } from './presets';

export const PEG_TIP = 0.4;
export const ENGRAVE = 0.6;
export const COUNTERBORE = 2.4;   // screw-head recess depth in the base floor (fits pan AND flat heads)

export interface PlaqueParts { white: Mesh; black: Mesh; w: number; h: number }

export function buildPlaque(spec: PlaqueSpec, matrix: QrMatrix, lines: string[], backNumber: number | null, opts: { keychain?: boolean } = {}): PlaqueParts {
  const w = opts.keychain ? KEYCHAIN.w : spec.w;
  const h = opts.keychain ? KEYCHAIN.h : spec.h;
  const t = opts.keychain ? KEYCHAIN.t : spec.t;
  const r = opts.keychain ? KEYCHAIN.cornerR : spec.cornerR;
  const ink = spec.inkDepth;
  const d = faceDesign(w, h, matrix, lines);

  // face rectangles, mirrored into model space
  const black: Rect[] = d.black.map((b) => ({ x0: w - (b.x + b.w), x1: w - b.x, y0: h - (b.y + b.h), y1: h - b.y }));
  const whiteMesh = new Mesh();
  const blackMesh = new Mesh();
  for (const b of black) blackMesh.box(b.x0, b.y0, b.x1, b.y1, 0, ink);
  slab(whiteMesh, w, h, r, 0, ink, black);

  // body, with the number engraved into the top of the back (read from above → not mirrored)
  const numberRects: Rect[] = [];
  if (backNumber !== null) {
    const txt = textCells([String(backNumber)]);
    const cell = Math.min(0.6, (w * 0.5) / txt.w);
    const nx = (w - txt.w * cell) / 2;
    const ny = (h - txt.h * cell) / 2;
    for (const c of txt.rects) numberRects.push({ x0: nx + c.x * cell, x1: nx + (c.x + c.w) * cell, y0: h - (ny + (c.y + c.h) * cell), y1: h - (ny + c.y * cell) });
  }
  if (numberRects.length) {
    slab(whiteMesh, w, h, r, ink, t - ENGRAVE);
    slab(whiteMesh, w, h, r, t - ENGRAVE, t, numberRects);
  } else {
    slab(whiteMesh, w, h, r, ink, t);
  }

  if (opts.keychain) {
    // ring tab above the top edge (front view) = +y in model space, centred
    const tabW = 12;
    const tab: Rect = { x0: (w - tabW) / 2, x1: (w + tabW) / 2, y0: h - 2, y1: h + KEYCHAIN.tab };
    const hole: Circle = { cx: w / 2, cy: h + KEYCHAIN.tab / 2 - 0.5, r: KEYCHAIN.holeD / 2 };
    // the tab is its own small slab (rounded 3 mm) with the ring hole
    const tabMesh = new Mesh();
    slab(tabMesh, tabW, tab.y1 - tab.y0, 3, 0, t, [], [{ cx: tabW / 2, cy: hole.cy - tab.y0, r: hole.r }]);
    appendMoved(whiteMesh, tabMesh, tab.x0, tab.y0);
  } else {
    for (const p of spec.pegs) {
      const x = w / 2 - p.x;          // mirrored
      const y = h / 2 + p.y;
      const rr = spec.pegD / 2;
      whiteMesh.frustum(x, y, rr, rr, t - 0.01, t + spec.pegH - PEG_TIP);
      whiteMesh.frustum(x, y, rr, rr - PEG_TIP, t + spec.pegH - PEG_TIP, t + spec.pegH);
    }
  }
  return { white: whiteMesh, black: blackMesh, w, h };
}

/** The black base (or the plaque socket of a stand-in): pocket, peg holes, hidden screws. */
export function buildBase(spec: PlaqueSpec, mount: Print3DMount): { mesh: Mesh; base: BaseSpec } {
  const b = baseFor(spec, mount);
  const m = new Mesh();
  const cx = b.w / 2;
  const cy = b.h / 2;
  const floor = b.t - b.pocketDepth;
  const pegHoles: Circle[] = spec.pegs.map((p) => ({ cx: cx + p.x, cy: cy + p.y, r: b.holeD / 2 }));
  const shanks: Circle[] = b.screws.map((s) => ({ cx: cx + s.x, cy: cy + s.y, r: b.screwD / 2 }));
  const heads: Circle[] = b.screws.map((s) => ({ cx: cx + s.x, cy: cy + s.y, r: b.screwHeadD / 2 }));

  // floor, in bands of constant holes
  const headBottom = floor - COUNTERBORE;
  const holeBottom = floor - b.holeDepth;
  const cuts = [...new Set([0, floor, holeBottom, ...(heads.length ? [headBottom] : [])])].filter((z) => z >= 0 && z <= floor).sort((a, c) => a - c);
  for (let i = 0; i < cuts.length - 1; i++) {
    const z0 = cuts[i];
    const z1 = cuts[i + 1];
    const mid = (z0 + z1) / 2;
    const circles: Circle[] = [];
    if (heads.length) circles.push(...(mid > headBottom ? heads : shanks));
    if (mid > holeBottom) circles.push(...pegHoles);
    slab(m, b.w, b.h, b.cornerR, z0, z1, [], circles);
  }
  // frame around the pocket
  const pocket: Rect = { x0: cx - b.pocketW / 2, x1: cx + b.pocketW / 2, y0: cy - b.pocketH / 2, y1: cy + b.pocketH / 2 };
  slab(m, b.w, b.h, b.cornerR, floor, b.t, [pocket]);
  return { mesh: m, base: b };
}

function appendMoved(into: Mesh, from: Mesh, dx: number, dy: number): void {
  const off = into.vertexCount;
  for (let i = 0; i < from.v.length; i += 3) into.v.push(from.v[i] + dx, from.v[i + 1] + dy, from.v[i + 2]);
  for (const i of from.t) into.t.push(i + off);
}
