'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Box, CircleAlert, Printer } from 'lucide-react';
import { THECODE_COLORS, describeGnome } from '@/components/thecode/GnomeFigure';
import type { TheCodeGnome } from '@/types/thecode';
import type { ScreenProps } from './model';
import { PUBLIC_ORIGIN, plateUrl } from './helpers';
import { Button, Card, EmptyState, ScreenHeader, Segmented, Toggle } from './ui';
import Print3DModal, { type Print3DItem } from '@/components/print3d/Print3DModal';

/**
 * Print sheet of real stickers, sized in millimetres. The QR ALWAYS encodes the production
 * origin (/g/{code}), even when printed from dev. A gnome the server has not given a code yet
 * prints "ממתין לשמירה" instead of a QR — never a fake one.
 *
 * GNOME sticker (default) — fits the socket of the 3D-printed gnome (socket 37.5 × 43.5 mm,
 * 0.75 mm play on every side for hand cutting). Keep these numbers in sync with the gnome CAD
 * (hardware/thecode-gnomes); change one → change the other.
 *   cut frame      36 × 42 mm, corner radius 1.5 mm (dashed line = the cut, centred on the edge)
 *   QR             34 × 34 mm, 1 mm from the top, left and right edges (white quiet zone)
 *   manual code    6-character mono bold, font 6 mm (cap height ≈ 4.4 mm), centred in the
 *                  6 mm band under the QR (35–41 mm), 1 mm to the bottom edge
 *   installer tag  OUTSIDE the frame, under it (number, colours, spot) — cut off and thrown away
 *   page           A4, 10 mm margins, 4 per row × 5 rows = 20 per page, 8 mm between columns,
 *                  5 mm between rows
 * LARGE sticker — 45 × 60 mm, QR 34 mm, number + colours on it; does NOT fit the gnome.
 */
const G = {
  w: 36, h: 42, radius: 1.5, qr: 34, pad: 1, codeBand: 6, codeFont: 6,
  colGap: 8, rowGap: 5, tag: 8, perRow: 4, perPage: 20, line: 0.25,
} as const;

type Size = 'gnome' | 'large';

export default function PrintScreen({ state, navigate }: ScreenProps) {
  const { gnomes, spots } = state.config;
  const [size, setSize] = useState<Size>('gnome');
  const [which, setWhich] = useState<'all' | 'unverified'>('all');
  const [spotId, setSpotId] = useState('');
  const [labels, setLabels] = useState(true);
  const [print3d, setPrint3d] = useState(false);

  const list = [...gnomes]
    .filter((g) => (which === 'all' ? true : !g.verifiedOnSite))
    .filter((g) => !spotId || g.spotId === spotId)
    .sort((a, b) => a.number - b.number);
  const pending = list.filter((g) => !g.code || !g.manualCode).length;
  const spotName = (id: string) => spots.find((s) => s.id === id)?.name || '';
  // 3D plaques: only gnomes the server already gave a code (same rule as the stickers).
  const items3d: Print3DItem[] = list
    .filter((g) => g.code && g.manualCode)
    .map((g) => ({
      id: g.id, number: g.number, url: plateUrl(g.code), manualCode: g.manualCode,
      label: `גמד ${g.number}${spotName(g.spotId) ? ` · ${spotName(g.spotId)}` : ''}`,
      outdoor: Boolean(spots.find((s) => s.id === g.spotId)?.outdoor),
    }));

  const perPage = size === 'gnome' ? G.perPage : 16;
  const pages: TheCodeGnome[][] = [];
  for (let i = 0; i < list.length; i += perPage) pages.push(list.slice(i, i + perPage));

  return (
    <div className="mx-auto max-w-5xl">
      {print3d && (
        <Print3DModal
          open
          onClose={() => setPrint3d(false)}
          items={items3d}
          title={`${state.config.title || 'קוד הגמדים'} — ${items3d.length} גמדים`}
          shapes={['gnome', 'base']}
          defaultShape="gnome"
        />
      )}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          html, body { background: #fff !important; }
          .thecode-sheet { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .thecode-page { break-after: page; }
          .thecode-page:last-child { break-after: auto; }
        }
      `}</style>

      <div className="print:hidden">
        <ScreenHeader
          title="הדפסת לוחיות"
          summary={
            size === 'gnome'
              ? 'כל הגמדים, מכל המקומות, מודפסים יחד על אותם דפים — 20 בדף. כל מדבקה בגודל 3.6 על 4.2 ס״מ ונכנסת בדיוק לשקע בגמד: קוד QR בגודל 3.4 ס״מ והקוד הידני מתחתיו.'
              : 'כל הגמדים, מכל המקומות, מודפסים יחד על אותם דפים. מדבקה גדולה (4.5 על 6 ס״מ) עם מספר הגמד והצבעים — היא לא נכנסת לשקע בגמד.'
          }
          actions={
            <div className="flex max-w-xs flex-col items-stretch gap-2 sm:items-end">
              <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                הדפיסו בגודל אמיתי — 100%, בלי &quot;התאמה לדף&quot;. אחרי ההדפסה מדדו בסרגל שהקוד יצא 3.4 ס״מ בדיוק.
              </p>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <Button icon={Box} onClick={() => setPrint3d(true)} disabled={!items3d.length}>לוחיות בתלת־ממד</Button>
                <Button variant="primary" icon={Printer} onClick={() => window.print()} disabled={!list.length}>הדפיסו</Button>
              </div>
            </div>
          }
        />
        <Card className="mb-4 flex flex-wrap items-center gap-4 p-4">
          <Segmented label="גודל מדבקה" value={size} onChange={setSize} options={[{ value: 'gnome', label: 'לשקע בגמד' }, { value: 'large', label: 'גדולה' }]} />
          <Segmented label="אילו גמדים" value={which} onChange={setWhich} options={[{ value: 'all', label: 'כולם' }, { value: 'unverified', label: 'עוד לא הותקנו' }]} />
          <select className="input select-input w-auto min-w-48" value={spotId} onChange={(e) => setSpotId(e.target.value)} aria-label="מקום">
            <option value="">כל המקומות יחד</option>
            {spots.map((s) => (
              <option key={s.id} value={s.id}>רק {s.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <Toggle checked={labels} onChange={setLabels} label="תווית למתקין" size="sm" />
            תווית למתקין מתחת למדבקה
          </label>
          <span className="ms-auto text-sm text-text-secondary">
            {list.length} מדבקות{pages.length > 1 ? `, ${pages.length} דפים` : ''}
          </span>
        </Card>
        <p className="mb-4 text-sm text-text-secondary">
          {size === 'gnome' ? 'גזרו על הקו המקווקו. התווית שמתחת לקו היא רק בשביל מי שמתקין, וזורקים אותה. ' : ''}
          כל קוד מוביל לכתובת הקבועה של המשחק:
          <span dir="ltr" className="ms-1 font-mono">{PUBLIC_ORIGIN}/g/…</span>
        </p>
        {pending > 0 && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-warning/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
            <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
            {pending === 1 ? 'לגמד אחד' : `ל־${pending} גמדים`} עוד אין קוד — הוא נקבע ברגע שהשינויים נשמרים. חכו ל&quot;נשמר&quot; ואז הדפיסו.
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Printer} title="אין לוחיות להדפסה" text="כל הגמדים שבחרתם כבר הותקנו. בחרו &quot;כולם&quot; או הפיקו גמדים חדשים." action={<Button onClick={() => navigate({ tab: 'gnomes' })}>לגמדים</Button>} />
      ) : (
        <div className="thecode-sheet space-y-6 overflow-x-auto rounded-xl bg-white p-6 text-black shadow-sm ring-1 ring-border print:space-y-0 print:overflow-visible print:rounded-none print:p-0 print:shadow-none print:ring-0">
          {pages.map((page, pi) => (
            <div key={pi} className="thecode-page" dir="rtl">
              {size === 'gnome' ? (
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: `repeat(${G.perRow}, ${G.w}mm)`,
                    columnGap: `${G.colGap}mm`,
                    rowGap: `${G.rowGap}mm`,
                    width: `${G.perRow * G.w + (G.perRow - 1) * G.colGap}mm`,
                  }}
                >
                  {page.map((g) => (
                    <GnomeSticker key={g.id} gnome={g} spot={labels ? spotName(g.spotId) : null} />
                  ))}
                </div>
              ) : (
                <div className="grid w-[189mm] grid-cols-[repeat(4,45mm)] gap-[3mm]">
                  {page.map((g) => (
                    <LargeSticker key={g.id} gnome={g} spot={labels ? spotName(g.spotId) : null} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const mm = (n: number) => `${n}mm`;

/** 36 × 42 mm — fits the gnome's socket. See the numbers at the top of the file. */
function GnomeSticker({ gnome: g, spot }: { gnome: TheCodeGnome; spot: string | null }) {
  const ready = !!g.code && !!g.manualCode;
  // The dashed border sits INSIDE the 36 × 42 box, so inner offsets subtract its width.
  const inset = `calc(${mm(G.pad)} - ${mm(G.line)})`;
  return (
    <div className="flex break-inside-avoid flex-col items-center" style={{ height: mm(G.h + G.tag) }}>
      <div
        className="relative box-border border-dashed border-gray-500 bg-white"
        style={{ width: mm(G.w), height: mm(G.h), borderWidth: mm(G.line), borderRadius: mm(G.radius) }}
      >
        <div className="absolute flex items-center justify-center" style={{ top: inset, left: inset, width: mm(G.qr), height: mm(G.qr) }}>
          {ready ? (
            <QRCodeSVG value={plateUrl(g.code)} level="M" marginSize={0} style={{ width: mm(G.qr), height: mm(G.qr) }} />
          ) : (
            <div className="flex size-full items-center justify-center rounded-[1mm] border-2 border-dashed border-gray-400 text-center text-[10pt] font-semibold text-gray-500">
              ממתין לשמירה
            </div>
          )}
        </div>
        <div
          className="absolute flex items-center justify-center font-mono font-extrabold"
          dir="ltr"
          style={{
            top: `calc(${mm(G.pad + G.qr)} - ${mm(G.line)})`,
            left: inset,
            width: mm(G.qr),
            height: mm(G.codeBand),
            fontSize: mm(G.codeFont),
            lineHeight: mm(G.codeBand),
            letterSpacing: '0.08em',
          }}
        >
          {ready ? g.manualCode : '······'}
        </div>
      </div>
      {spot !== null && (
        <div className="mt-[0.8mm] text-center text-[6.5pt] leading-[1.25] text-gray-500" style={{ width: mm(G.w + G.colGap - 1) }}>
          <div className="truncate">
            <b className="text-gray-700" dir="ltr">#{g.number}</b> · {describeGnome(g.bodyColor, g.hatColor)}
          </div>
          <div className="truncate">{spot}</div>
        </div>
      )}
    </div>
  );
}

/** 45 × 60 mm — the earlier large plate. Does not fit the gnome's socket. */
function LargeSticker({ gnome: g, spot }: { gnome: TheCodeGnome; spot: string | null }) {
  const ready = !!g.code && !!g.manualCode;
  return (
    <div className="flex break-inside-avoid flex-col items-center">
      <div className="flex h-[60mm] w-[45mm] flex-col items-center rounded-[2.5mm] border border-dashed border-gray-400 px-[2mm] pt-[2.5mm]">
        <div className="flex w-full items-center justify-between leading-none">
          <span className="text-[15pt] font-extrabold tabular-nums" dir="ltr">#{g.number}</span>
          <span className="flex items-center gap-[1mm]">
            <Dot color={THECODE_COLORS[g.bodyColor].hex} />
            <Dot color={THECODE_COLORS[g.hatColor].hex} />
          </span>
        </div>
        <div className="mt-[2mm] flex size-[34mm] items-center justify-center">
          {ready ? (
            <QRCodeSVG value={plateUrl(g.code)} level="M" marginSize={0} style={{ width: '34mm', height: '34mm' }} />
          ) : (
            <div className="flex size-full items-center justify-center rounded-[2mm] border-2 border-dashed border-gray-400 text-center text-[10pt] font-semibold text-gray-500">
              ממתין לשמירה
            </div>
          )}
        </div>
        <div className="mt-[2mm] w-full truncate text-center text-[7.5pt] leading-tight text-gray-700">{describeGnome(g.bodyColor, g.hatColor)}</div>
        <div className="mt-[1mm] font-mono text-[17pt] font-extrabold leading-none tracking-[0.12em]" dir="ltr">
          {ready ? g.manualCode : '······'}
        </div>
      </div>
      {spot !== null && <div className="mt-[1mm] w-[45mm] truncate text-center text-[7pt] leading-tight text-gray-500">{spot}</div>}
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block size-[3.5mm] rounded-full border border-gray-500" style={{ background: color }} />;
}
