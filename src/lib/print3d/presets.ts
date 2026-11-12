// הדפסה בתלת־ממד — shapes, sizes and rules for 3D-printed QR plaques (plan: docs/QR_3D_PRINT_PLAN.md).
// Pure numbers + pure functions only (no React, no DOM) so the file generator can reuse them.
//
// ONE plaque standard fits everything: the gnome socket, the wall gnome and the black base. The
// standard numbers come from the gnome CAD — keep them in sync with hardware/thecode-gnomes
// (plaque.py PLAQUE_W/H/T + PEG_*, gnome.py PLAQUE_PEGS / HOLE_* / SCREW_*). Change one → change both.

export type Print3DShape = 'gnome' | 'base' | 'stand' | 'keychain';
export type Print3DSize = 'standard' | 'large' | 'xl';
export type Print3DMount = 'screws' | 'tape';
export type Print3DText = 'none' | 'manual' | 'address' | 'custom';

/** Peg / hole / screw positions are in FRONT-VIEW coordinates: mm from the plaque centre, x right, y up. */
export type Point = { x: number; y: number };

export interface PlaqueSpec {
  size: Print3DSize;
  /** Outer plaque, mm. */
  w: number;
  h: number;
  t: number;
  cornerR: number;
  /** Black (modules + text) depth from the face — the only two-colour layers. */
  inkDepth: number;
  pegs: Point[];
  pegD: number;
  pegH: number;
  /** True only for the size that was checked against the real gnome socket. */
  verified: boolean;
}

export interface BaseSpec {
  w: number;
  h: number;
  t: number;
  cornerR: number;
  /** Pocket the plaque drops into (plaque + play), same depth as the plaque. */
  pocketW: number;
  pocketH: number;
  pocketDepth: number;
  holeD: number;
  holeDepth: number;
  /** Hidden screws under the plaque, heads sunk in a recess (mount 'screws' only). */
  screws: Point[];
  screwD: number;
  screwHeadD: number;
}

// ---------------------------------------------------------------------------- the standard plaque
// From the gnome CAD (12.11.2026): socket 37.5 × 43.5 × 1.2, plaque 0.2 smaller per side,
// pegs Ø3.0 × 1.6 at socket (-12, +14) and (+8, -14) — asymmetric, so it goes in one way only.
const STANDARD: PlaqueSpec = {
  size: 'standard', w: 37.1, h: 43.1, t: 1.2, cornerR: 0.6, inkDepth: 0.4,
  pegs: [{ x: -12, y: 14 }, { x: 8, y: -14 }], pegD: 3.0, pegH: 1.6, verified: true,
};
const PLAY = 0.2;            // per side, plaque ↔ pocket
const HOLE_D = 3.3;          // peg hole (Ø3.0 peg + play)
const HOLE_DEPTH = 2.0;
const SCREW_D = 4.4;         // 3.5–4 mm wood screws
const SCREW_HEAD_D = 8.6;    // screw-head recess (counterbore)
const SCREW_FLOOR = 3.6;     // material under the pocket: 2.4 screw-head recess + 1.2 under the head
const TAPE_FLOOR = 2.4;

/** Larger plaques keep the same layout, scaled; only the standard size was checked on a gnome. */
function scaled(size: Print3DSize, w: number, h: number, t: number): PlaqueSpec {
  const kx = w / STANDARD.w;
  const ky = h / STANDARD.h;
  return {
    ...STANDARD, size, w, h, t, cornerR: 1.0, verified: false,
    pegs: STANDARD.pegs.map((p) => ({ x: round(p.x * kx), y: round(p.y * ky) })),
    pegD: 4.0, pegH: 2.0,
  };
}

export const PLAQUES: Record<Print3DSize, PlaqueSpec> = {
  standard: STANDARD,
  large: scaled('large', 60, 70, 2.0),
  xl: scaled('xl', 100, 116, 2.4),
};

/** Keychain: its own small plaque with a ring tab, no pegs. Under the 1 mm module rule → experimental. */
export const KEYCHAIN = { w: 30, h: 40, t: 2.0, cornerR: 3, holeD: 4.5, tab: 7 } as const;

export const SIZE_LABEL: Record<Print3DSize, string> = { standard: 'סטנדרטית', large: 'גדולה', xl: 'ענקית' };

export const SHAPES: { id: Print3DShape; label: string; hint: string }[] = [
  { id: 'gnome', label: 'לוחית לגמד', hint: 'נכנסת לשקע בגמד' },
  { id: 'base', label: 'לוחית + בסיס שחור', hint: 'לקיר, בברגים או במדבקה' },
  { id: 'stand', label: 'לוחית + מעמד', hint: 'עומד על שולחן' },
  { id: 'keychain', label: 'מחזיק מפתחות', hint: 'קטן, ניסיוני' },
];

// ----------------------------------------------------------------------------------- black base
export function baseFor(plaque: PlaqueSpec, mount: Print3DMount): BaseSpec {
  const frame = Math.max(5, round(plaque.w * 0.13));
  const pocketW = round(plaque.w + 2 * PLAY);
  const pocketH = round(plaque.h + 2 * PLAY);
  const floor = mount === 'screws' ? SCREW_FLOOR : TAPE_FLOOR;
  const k = plaque.w / STANDARD.w;
  return {
    w: round(pocketW + 2 * frame), h: round(pocketH + 2 * frame), t: round(floor + plaque.t), cornerR: 3,
    pocketW, pocketH, pocketDepth: plaque.t,
    holeD: plaque.size === 'standard' ? HOLE_D : plaque.pegD + 0.3, holeDepth: HOLE_DEPTH,
    // Standard: the screws of the gnome CAD (x = ±11, just above the middle); both clear the pegs.
    screws: mount === 'screws' ? [{ x: round(-11 * k), y: round(2 * k) }, { x: round(11 * k), y: round(2 * k) }] : [],
    screwD: SCREW_D, screwHeadD: SCREW_HEAD_D,
  };
}

/** Table stand: a black wedge with the same pocket on its front face, leaning back 15°. */
export function standFor(plaque: PlaqueSpec) {
  const base = baseFor(plaque, 'tape');
  const lean = 15;
  const height = round(base.h * Math.cos((lean * Math.PI) / 180));
  const depth = round(base.h * 0.55);
  return { w: base.w, h: height, depth, lean, faceH: base.h };
}

// ---------------------------------------------------------------------------- QR layout on a face
export const QUIET_MODULES = 2;      // white quiet zone inside the plaque (spec says 4; the gnome size allows 2)
export const MIN_MODULE_MM = 1.0;    // under this a 0.4 nozzle bleeds the black
export const TEXT_BAND_MIN = 5.0;

export interface FaceLayout {
  modules: number;     // matrix size (29 for version 3)
  module: number;      // mm per module
  qr: number;          // QR side, mm
  qrX: number;         // QR top-left from the plaque top-left, mm
  qrY: number;
  textY: number;       // centre line of the text band from the top, mm
  textH: number;       // cap height
  bandTop: number;     // text band, from the top, mm
  band: number;
}

/** Square QR across the full width (minus the quiet zone), text band under it. */
export function faceLayout(w: number, h: number, modules: number): FaceLayout {
  const mod = round(w / (modules + 2 * QUIET_MODULES), 3);
  const qr = round(mod * modules, 2);
  const qrX = round(mod * QUIET_MODULES, 2);
  const qrY = qrX;
  const bandTop = qrY + qr + mod;             // one module of white under the code
  const band = Math.max(0, h - bandTop - 1);
  return { modules, module: mod, qr, qrX, qrY, textY: round(bandTop + band / 2, 2), textH: round(Math.min(band * 0.8, w * 0.13), 1), bandTop: round(bandTop, 2), band: round(band, 2) };
}

// -------------------------------------------------------------------------------- plate (H2D)
// Bambu Lab H2D: 325 × 320 single nozzle, 300 × 320 when both nozzles print. We keep a margin and,
// for two-colour plates, a corner for the prime tower.
export const PLATE = { w: 290, h: 300, gap: 5, tower: 40 } as const;

export function perPlate(itemW: number, itemH: number, twoColour: boolean): number {
  const cols = Math.floor((PLATE.w + PLATE.gap) / (itemW + PLATE.gap));
  const rows = Math.floor((PLATE.h + PLATE.gap) / (itemH + PLATE.gap));
  if (!twoColour) return cols * rows;
  const lost = Math.ceil(PLATE.tower / (itemW + PLATE.gap)) * Math.ceil(PLATE.tower / (itemH + PLATE.gap));
  return Math.max(0, cols * rows - lost);
}

/** Positions (mm, top-left of each item) for n items on one plate, row-major. */
export function plateSlots(itemW: number, itemH: number, n: number, twoColour: boolean): { x: number; y: number }[] {
  const cols = Math.floor((PLATE.w + PLATE.gap) / (itemW + PLATE.gap));
  const out: { x: number; y: number }[] = [];
  for (let i = 0; out.length < n && i < 400; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = c * (itemW + PLATE.gap);
    const y = r * (itemH + PLATE.gap);
    if (y + itemH > PLATE.h) break;
    if (twoColour && x + itemW > PLATE.w - PLATE.tower && y < PLATE.tower) continue; // prime tower corner
    out.push({ x, y });
  }
  return out;
}

// -------------------------------------------------------------------------------------- colours
/** Only spools that really exist. QR = black on white, always (never inverted). */
export const FILAMENTS = {
  white: { label: 'לבן', hex: '#F4F4F2', material: 'PLA' },
  black: { label: 'שחור', hex: '#1A1A1A', material: 'PLA' },
  blackOutdoor: { label: 'שחור לחוץ', hex: '#1A1A1A', material: 'ASA' },
} as const;

// ---------------------------------------------------------------------------------------- checks
export type CheckTone = 'ok' | 'warn' | 'bad';
export interface Check { tone: CheckTone; text: string }

export function checksFor(opts: { shape: Print3DShape; module: number; version: number; outdoor: boolean; verified: boolean; decoded: boolean | null; url: string }): Check[] {
  const out: Check[] = [];
  const mm = opts.module.toFixed(2);
  if (opts.module >= MIN_MODULE_MM) out.push({ tone: 'ok', text: `כל ריבוע בקוד ${mm} מ״מ — מספיק גדול למדפסת` });
  else out.push({ tone: 'warn', text: `כל ריבוע בקוד רק ${mm} מ״מ — קטן מדי לבטוח, הדפיסו קודם ניסיון` });
  out.push({ tone: 'ok', text: `שוליים לבנים של ${QUIET_MODULES} ריבועים מסביב לקוד` });
  if (opts.decoded === true) out.push({ tone: 'ok', text: 'הקוד נסרק בבדיקה ומוביל לכתובת הנכונה' });
  if (opts.decoded === false) out.push({ tone: 'bad', text: 'הקוד לא נסרק בבדיקה — אל תדפיסו אותו' });
  if (opts.version > 3) out.push({ tone: 'warn', text: 'הכתובת ארוכה, ולכן הריבועים קטנים יותר. כדאי גודל גדול יותר' });
  if (!opts.url.startsWith('https://qr.playzones.app/')) out.push({ tone: 'bad', text: 'הכתובת לא של האתר הקבוע — לוחית כזו לא תעבוד לאורך זמן' });
  if (opts.shape !== 'keychain' && !opts.verified) out.push({ tone: 'warn', text: 'הגודל הזה עוד לא נבדק בהדפסה אמיתית' });
  if (opts.outdoor) out.push({ tone: 'warn', text: 'בחוץ: לבן רגיל מתרכך בשמש. עד שיהיה גליל לבן לחוץ — מדבקה מתחת לניילון שקוף' });
  return out;
}

function round(n: number, digits = 1): number {
  const k = 10 ** digits;
  return Math.round(n * k) / k;
}
