// Tiny mesh kit for printed plaques — no CSG library. Every solid is a PRISM over a polygon that is
// convex or star-shaped from its first vertex (so a fan from vertex 0 triangulates its caps), or a
// frustum. Pieces that touch share faces; slicers union all closed shells of a part per layer.
// Model space: millimetres, x right, y away from the viewer (Bambu "up" in top view), z up.

export type Pt = [number, number];

export class Mesh {
  readonly v: number[] = [];   // x,y,z triples
  readonly t: number[] = [];   // index triples, counter-clockwise seen from outside

  get vertexCount() { return this.v.length / 3; }
  get triangleCount() { return this.t.length / 3; }

  private vert(x: number, y: number, z: number): number {
    this.v.push(x, y, z);
    return this.v.length / 3 - 1;
  }

  /** Prism between z0 and z1 over `poly` (any winding; caps fanned from poly[0]). */
  prism(poly: Pt[], z0: number, z1: number): void {
    if (poly.length < 3 || z1 - z0 <= 1e-6) return;
    const p = signedArea(poly) < 0 ? [poly[0], ...poly.slice(1).reverse()] : poly; // CCW, keep the fan vertex first
    const n = p.length;
    const lo = p.map(([x, y]) => this.vert(x, y, z0));
    const hi = p.map(([x, y]) => this.vert(x, y, z1));
    for (let i = 1; i < n - 1; i++) {
      this.t.push(hi[0], hi[i], hi[i + 1]);
      this.t.push(lo[0], lo[i + 1], lo[i]);
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      this.t.push(lo[i], lo[j], hi[j], lo[i], hi[j], hi[i]);
    }
  }

  box(x0: number, y0: number, x1: number, y1: number, z0: number, z1: number): void {
    this.prism([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z0, z1);
  }

  /** Round pin / cone: radius r0 at z0, r1 at z1. */
  frustum(cx: number, cy: number, r0: number, r1: number, z0: number, z1: number, seg = 32): void {
    const lo: number[] = [];
    const hi: number[] = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      lo.push(this.vert(cx + r0 * Math.cos(a), cy + r0 * Math.sin(a), z0));
      hi.push(this.vert(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a), z1));
    }
    for (let i = 1; i < seg - 1; i++) {
      this.t.push(hi[0], hi[i], hi[i + 1]);
      this.t.push(lo[0], lo[i + 1], lo[i]);
    }
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      this.t.push(lo[i], lo[j], hi[j], lo[i], hi[j], hi[i]);
    }
  }
}

export function signedArea(p: Pt[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x0, y0] = p[i];
    const [x1, y1] = p[(i + 1) % p.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

export interface Rect { x0: number; y0: number; x1: number; y1: number }
export interface Circle { cx: number; cy: number; r: number }

/**
 * A slab z0..z1 covering a rounded rectangle [0,w]×[0,h] (corner radius r) MINUS rectangular holes
 * and round holes. Built from: grid cells (merged into row runs), four quarter-disc corners, and four
 * star-shaped pieces around each round hole. Holes must stay clear of the corner squares, and the
 * square around each round hole (side 2·(r+margin)) must not touch another hole.
 */
export function slab(mesh: Mesh, w: number, h: number, r: number, z0: number, z1: number, rects: Rect[] = [], circles: Circle[] = [], seg = 32): void {
  const margin = 0.6;
  const squares = circles.map((c) => ({ c, s: c.r + margin }));
  const xs = new Set<number>([0, w, r, w - r]);
  const ys = new Set<number>([0, h, r, h - r]);
  for (const q of rects) { xs.add(q.x0); xs.add(q.x1); ys.add(q.y0); ys.add(q.y1); }
  for (const { c, s } of squares) { xs.add(c.cx - s); xs.add(c.cx + s); ys.add(c.cy - s); ys.add(c.cy + s); }
  const X = [...xs].map(q).filter((x) => x >= 0 && x <= w).sort((a, b) => a - b).filter(uniq);
  const Y = [...ys].map(q).filter((y) => y >= 0 && y <= h).sort((a, b) => a - b).filter(uniq);

  const inCorner = (x: number, y: number) => (x < r || x > w - r) && (y < r || y > h - r);
  const inRect = (x: number, y: number) => rects.some((k) => x > k.x0 && x < k.x1 && y > k.y0 && y < k.y1);
  const inSquare = (x: number, y: number) => squares.some(({ c, s }) => x > c.cx - s && x < c.cx + s && y > c.cy - s && y < c.cy + s);

  // row runs, merged downwards while the same run repeats in the next band → far fewer boxes
  let open = new Map<string, Rect>();
  const flush = (m: Map<string, Rect>) => { for (const k of m.values()) mesh.box(k.x0, k.y0, k.x1, k.y1, z0, z1); };
  for (let j = 0; j < Y.length - 1; j++) {
    const ya = Y[j];
    const yb = Y[j + 1];
    const my = (ya + yb) / 2;
    const next = new Map<string, Rect>();
    let runStart: number | null = null;
    for (let i = 0; i <= X.length - 1; i++) {
      const filled = i < X.length - 1 && (() => {
        const mx = (X[i] + X[i + 1]) / 2;
        return !inCorner(mx, my) && !inRect(mx, my) && !inSquare(mx, my);
      })();
      if (filled && runStart === null) runStart = X[i];
      if (!filled && runStart !== null) {
        const key = `${runStart}|${X[i]}`;
        const prev = open.get(key);
        if (prev) { prev.y1 = yb; open.delete(key); next.set(key, prev); }
        else next.set(key, { x0: runStart, x1: X[i], y0: ya, y1: yb });
        runStart = null;
      }
    }
    flush(open);
    open = next;
  }
  flush(open);

  if (r > 0) {
    const corners: [number, number, number][] = [[r, r, Math.PI], [w - r, r, -Math.PI / 2], [w - r, h - r, 0], [r, h - r, Math.PI / 2]];
    const n = Math.max(4, Math.round(seg / 4));
    for (const [cx, cy, a0] of corners) {
      const poly: Pt[] = [[cx, cy]];
      for (let i = 0; i <= n; i++) {
        const a = a0 + (i / n) * (Math.PI / 2);
        poly.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      mesh.prism(poly, z0, z1);
    }
  }

  for (const { c, s } of squares) {
    const n = Math.max(4, Math.round(seg / 4));
    // four quadrants; each = square corner + quarter arc, star-shaped from the corner
    for (let k = 0; k < 4; k++) {
      const a0 = (k * Math.PI) / 2;
      const sx = Math.cos(a0 + Math.PI / 4) >= 0 ? 1 : -1;
      const sy = Math.sin(a0 + Math.PI / 4) >= 0 ? 1 : -1;
      const corner: Pt = [c.cx + sx * s, c.cy + sy * s];
      const poly: Pt[] = [corner];
      const a1 = a0 + Math.PI / 2;
      // edge points of the square on the two axes of this quadrant
      poly.push([c.cx + Math.round(Math.cos(a1)) * s, c.cy + Math.round(Math.sin(a1)) * s]);
      for (let i = n; i >= 0; i--) {
        const a = a0 + (i / n) * (Math.PI / 2);
        poly.push([c.cx + c.r * Math.cos(a), c.cy + c.r * Math.sin(a)]);
      }
      poly.push([c.cx + Math.round(Math.cos(a0)) * s, c.cy + Math.round(Math.sin(a0)) * s]);
      mesh.prism(poly, z0, z1);
    }
  }
}

function q(n: number): number {
  return Math.round(n * 10000) / 10000;
}
function uniq(n: number, i: number, a: number[]): boolean {
  return i === 0 || n - a[i - 1] > 1e-6;
}
