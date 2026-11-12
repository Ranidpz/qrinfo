'use client';

// SVG previews of a 3D-printed QR plaque, drawn in real millimetres (viewBox units = mm).
// Physical colours are fixed hex on purpose — white and black filament look the same in dark mode.

import type { ReactNode } from 'react';
import type { QrMatrix } from '@/lib/print3d/matrix';
import {
  FILAMENTS, KEYCHAIN, PLATE, baseFor, faceLayout, plateSlots,
  type BaseSpec, type PlaqueSpec, type Print3DMount, type Print3DShape,
} from '@/lib/print3d/presets';

const WHITE = FILAMENTS.white.hex;
const BLACK = FILAMENTS.black.hex;
const EDGE = '#9CA3AF';

export interface FaceProps {
  matrix: QrMatrix;
  plaque: { w: number; h: number; cornerR: number };
  text: string;
  /** Mirror left↔right — the face as it lies on the print bed. */
  mirror?: boolean;
}

/** The plaque face (white body, black modules + text) as a <g> at 0,0 in mm. */
function Face({ matrix, plaque, text, mirror }: FaceProps) {
  const L = faceLayout(plaque.w, plaque.h, matrix.size);
  const rects: ReactNode[] = [];
  matrix.rows.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      if (!row[c]) { c++; continue; }
      let e = c;
      while (e < row.length && row[e]) e++;
      rects.push(<rect key={`${r}-${c}`} x={L.qrX + c * L.module} y={L.qrY + r * L.module} width={(e - c) * L.module + 0.01} height={L.module + 0.01} />);
      c = e;
    }
  });
  return (
    <g transform={mirror ? `translate(${plaque.w} 0) scale(-1 1)` : undefined}>
      <rect width={plaque.w} height={plaque.h} rx={plaque.cornerR} fill={WHITE} stroke={EDGE} strokeWidth={0.15} />
      <g fill={BLACK} shapeRendering="crispEdges">{rects}</g>
      {text && L.textH >= 2 && (
        <text
          x={plaque.w / 2}
          y={L.textY}
          textAnchor="middle"
          dominantBaseline="central"
          fill={BLACK}
          fontSize={L.textH / 0.72}
          fontWeight={700}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          letterSpacing={L.textH * 0.12}
        >
          {text}
        </text>
      )}
    </g>
  );
}

function Base({ base, plaque, showHoles }: { base: BaseSpec; plaque: PlaqueSpec; showHoles: boolean }) {
  const px = (base.w - base.pocketW) / 2;
  const py = (base.h - base.pocketH) / 2;
  const cx = base.w / 2;
  const cy = base.h / 2;
  return (
    <g>
      <rect width={base.w} height={base.h} rx={base.cornerR} fill={BLACK} stroke="#4B5563" strokeWidth={0.3} />
      <rect x={px} y={py} width={base.pocketW} height={base.pocketH} rx={0.4} fill="#2B2B2B" stroke="#555" strokeWidth={0.2} />
      {showHoles && (
        <>
          {plaque.pegs.map((p, i) => (
            <circle key={`h${i}`} cx={cx + p.x} cy={cy - p.y} r={base.holeD / 2} fill="#000" stroke="#666" strokeWidth={0.2} />
          ))}
          {base.screws.map((s, i) => (
            <g key={`s${i}`}>
              <circle cx={cx + s.x} cy={cy - s.y} r={base.screwHeadD / 2} fill="#202020" stroke="#666" strokeWidth={0.2} />
              <circle cx={cx + s.x} cy={cy - s.y} r={base.screwD / 2} fill="#000" />
            </g>
          ))}
        </>
      )}
    </g>
  );
}

/** Assembled, as people will see it on the wall / gnome / table. */
export function AssembledView({ shape, matrix, plaque, mount, text }: { shape: Print3DShape; matrix: QrMatrix; plaque: PlaqueSpec; mount: Print3DMount; text: string }) {
  if (shape === 'keychain') {
    const k = KEYCHAIN;
    const pad = 2;
    return (
      <svg viewBox={`${-pad} ${-k.tab - pad} ${k.w + 2 * pad} ${k.h + k.tab + 2 * pad}`} className="h-full w-full" role="img" aria-label="מחזיק מפתחות עם קוד">
        <rect x={k.w / 2 - 6} y={-k.tab} width={12} height={k.tab + 4} rx={4} fill={WHITE} stroke={EDGE} strokeWidth={0.15} />
        <circle cx={k.w / 2} cy={-k.tab / 2 + 0.5} r={k.holeD / 2} fill="#E5E7EB" stroke={EDGE} strokeWidth={0.15} />
        <Face matrix={matrix} plaque={{ w: k.w, h: k.h, cornerR: k.cornerR }} text={text} />
      </svg>
    );
  }
  if (shape === 'gnome') {
    const pad = 3;
    return (
      <svg viewBox={`${-pad} ${-pad} ${plaque.w + 2 * pad} ${plaque.h + 2 * pad}`} className="h-full w-full" role="img" aria-label="לוחית לגמד">
        <rect x={-pad + 0.6} y={-pad + 0.6} width={plaque.w + 2 * pad - 1.2} height={plaque.h + 2 * pad - 1.2} rx={1.5} fill="#3B82F6" opacity={0.25} />
        <Face matrix={matrix} plaque={plaque} text={text} />
      </svg>
    );
  }
  const base = baseFor(plaque, mount);
  const ox = (base.w - plaque.w) / 2;
  const oy = (base.h - plaque.h) / 2;
  return (
    <svg viewBox={`-1 -1 ${base.w + 2} ${base.h + 2}`} className="h-full w-full" role="img" aria-label="לוחית על בסיס שחור">
      <Base base={base} plaque={plaque} showHoles={false} />
      <g transform={`translate(${ox} ${oy})`}>
        <Face matrix={matrix} plaque={plaque} text={text} />
      </g>
    </svg>
  );
}

/** What goes on the print bed: plaque face-down (mirrored) + its back, and the base pocket-up. */
export function PrintedView({ shape, matrix, plaque, mount, text, number }: { shape: Print3DShape; matrix: QrMatrix; plaque: PlaqueSpec; mount: Print3DMount; text: string; number: number | null }) {
  const isKey = shape === 'keychain';
  const p = isKey ? { ...plaque, w: KEYCHAIN.w, h: KEYCHAIN.h, cornerR: KEYCHAIN.cornerR, pegs: [] } : plaque;
  const base = shape === 'base' || shape === 'stand' ? baseFor(plaque, shape === 'stand' ? 'tape' : mount) : null;
  const gap = 8;
  const w = p.w * 2 + gap + (base ? base.w + gap : 0);
  const h = Math.max(p.h, base?.h ?? 0) + 9;
  const cx = p.w / 2;
  const cy = p.h / 2;
  return (
    <svg viewBox={`-1 -1 ${w + 2} ${h + 2}`} className="h-full w-full" role="img" aria-label="כך זה מונח על פלטת ההדפסה">
      {/* right → left, the reading order: face, back, then the base */}
      <g transform={`translate(${w - p.w} 0)`}>
        <Face matrix={matrix} plaque={p} text={text} mirror />
        <Label x={p.w / 2} y={p.h + 6}>הפנים, על הפלטה</Label>
      </g>
      <g transform={`translate(${w - 2 * p.w - gap} 0)`}>
        <rect width={p.w} height={p.h} rx={p.cornerR} fill={WHITE} stroke={EDGE} strokeWidth={0.15} />
        {p.pegs.map((g, i) => (
          <g key={i}>
            <circle cx={cx - g.x} cy={cy - g.y} r={p.pegD / 2} fill="#E5E7EB" stroke="#6B7280" strokeWidth={0.25} />
            <circle cx={cx - g.x} cy={cy - g.y} r={p.pegD / 2 - 0.4} fill="none" stroke="#9CA3AF" strokeWidth={0.15} />
          </g>
        ))}
        {number !== null && (
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={6} fontWeight={700} fill="#B8B8B4" fontFamily="ui-monospace, Menlo, monospace">
            {number}
          </text>
        )}
        <Label x={p.w / 2} y={p.h + 6}>{p.pegs.length ? 'הגב, עם הפינים' : 'הגב'}</Label>
      </g>
      {base && (
        <g>
          <Base base={base} plaque={plaque} showHoles />
          <Label x={base.w / 2} y={base.h + 6}>{shape === 'stand' ? 'השקע במעמד' : 'הבסיס, השקע למעלה'}</Label>
        </g>
      )}
    </svg>
  );
}

function Label({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={3.4} fill="currentColor" className="text-text-secondary">
      {children}
    </text>
  );
}

/** Exploded side cut: plaque above, pegs pointing down into the holes of the base / gnome. */
export function SideView({ shape, plaque, mount }: { shape: Print3DShape; plaque: PlaqueSpec; mount: Print3DMount }) {
  const S = 4; // vertical exaggeration so 1–4 mm layers are readable
  const isKey = shape === 'keychain';
  const pw = isKey ? KEYCHAIN.w : plaque.w;
  const pt = (isKey ? KEYCHAIN.t : plaque.t) * S;
  const ink = plaque.inkDepth * S;
  const holder = shape === 'base' ? baseFor(plaque, mount) : shape === 'stand' ? baseFor(plaque, 'tape') : null;
  const width = holder ? holder.w : pw + 10;
  const ox = (width - pw) / 2;
  const plaqueY = 4;
  const pegs = isKey ? [] : plaque.pegs.map((g) => ox + pw / 2 + g.x);
  const holderY = plaqueY + pt + plaque.pegH * S + 8;
  const H = holder ? holderY + holder.t * S + 14 : plaqueY + pt + plaque.pegH * S + 16;
  return (
    <svg viewBox={`-6 0 ${width + 34} ${H}`} className="h-full w-full" role="img" aria-label="חתך מהצד: הלוחית והפינים מעל הבסיס">
      {/* plaque: face (black layers) at the top in this drawing = the side that faces people */}
      <rect x={ox} y={plaqueY} width={pw} height={pt} fill={WHITE} stroke={EDGE} strokeWidth={0.3} />
      <rect x={ox + 2} y={plaqueY} width={pw - 4} height={ink} fill={BLACK} opacity={0.85} />
      {pegs.map((x, i) => (
        <rect key={i} x={x - plaque.pegD / 2} y={plaqueY + pt} width={plaque.pegD} height={plaque.pegH * S} rx={0.6} fill={WHITE} stroke={EDGE} strokeWidth={0.3} />
      ))}
      <SideNote x={width + 3} y={plaqueY + pt / 2}>לוחית</SideNote>
      {holder && (
        <g>
          <path
            d={`M0 ${holderY} H${(width - holder.pocketW) / 2} V${holderY + holder.pocketDepth * S} H${(width + holder.pocketW) / 2} V${holderY} H${width} V${holderY + holder.t * S} H0 Z`}
            fill={BLACK}
            stroke="#4B5563"
            strokeWidth={0.3}
          />
          {pegs.map((x, i) => (
            <rect key={i} x={x - holder.holeD / 2} y={holderY + holder.pocketDepth * S} width={holder.holeD} height={holder.holeDepth * S} fill="#4B5563" />
          ))}
          {holder.screws.map((s, i) => {
            const x = width / 2 + s.x;
            const top = holderY + holder.pocketDepth * S;
            return (
              <path key={`s${i}`} d={`M${x - holder.screwHeadD / 2} ${top} L${x - holder.screwD / 2} ${top + 2.1 * S} V${holderY + holder.t * S} H${x + holder.screwD / 2} V${top + 2.1 * S} L${x + holder.screwHeadD / 2} ${top} Z`} fill="#6B7280" />
            );
          })}
          <SideNote x={width + 3} y={holderY + (holder.t * S) / 2}>{shape === 'stand' ? 'מעמד' : 'בסיס'}</SideNote>
          <line x1={width / 2} y1={plaqueY + pt + plaque.pegH * S + 1} x2={width / 2} y2={holderY - 1} stroke="#9CA3AF" strokeWidth={0.4} strokeDasharray="1 1" />
        </g>
      )}
    </svg>
  );
}

function SideNote({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <text x={x} y={y} textAnchor="start" dominantBaseline="central" fontSize={3.6} fill="currentColor" className="text-text-secondary" style={{ direction: 'ltr' }}>
      {children}
    </text>
  );
}

/** The H2D plate with the items laid out (one plate). */
export function PlateView({ itemW, itemH, count, twoColour, tone }: { itemW: number; itemH: number; count: number; twoColour: boolean; tone: 'plaque' | 'base' }) {
  const slots = plateSlots(itemW, itemH, count, twoColour);
  return (
    <svg viewBox={`-6 -6 ${PLATE.w + 12} ${PLATE.h + 12}`} className="h-full w-full" role="img" aria-label="פלטת ההדפסה">
      <rect x={-6} y={-6} width={PLATE.w + 12} height={PLATE.h + 12} rx={6} fill="#6B6F76" />
      <rect width={PLATE.w} height={PLATE.h} fill="none" stroke="#9AA0A8" strokeWidth={0.8} strokeDasharray="4 3" />
      {twoColour && <rect x={PLATE.w - 30} y={4} width={26} height={26} rx={2} fill="#A78BFA" opacity={0.7} />}
      {slots.map((s, i) => (
        <rect key={i} x={s.x} y={s.y} width={itemW} height={itemH} rx={tone === 'base' ? 3 : 1} fill={tone === 'base' ? BLACK : WHITE} stroke={tone === 'base' ? '#4B5563' : '#D1D5DB'} strokeWidth={0.6} />
      ))}
    </svg>
  );
}
