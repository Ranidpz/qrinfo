'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CircleAlert, Printer } from 'lucide-react';
import { THECODE_COLORS, describeGnome } from '@/components/thecode/GnomeFigure';
import type { TheCodeGnome } from '@/types/thecode';
import type { ScreenProps } from './model';
import { PUBLIC_ORIGIN, plateUrl } from './helpers';
import { Button, Card, EmptyState, ScreenHeader, Segmented, Toggle } from './ui';

/**
 * Print sheet of real stickers, sized in millimetres (A4, 4 per row):
 * QR 34 mm (≥ 30 mm so a phone reads it from a step away) → gnome number + its two colours
 * in words → the manual code in large type. The QR ALWAYS encodes the production origin
 * (/g/{code}), even when printed from dev. A gnome the server has not given a code yet
 * prints "ממתין לשמירה" instead of a QR — never a fake one.
 */
export default function PrintScreen({ state, navigate }: ScreenProps) {
  const { gnomes, spots } = state.config;
  const [which, setWhich] = useState<'all' | 'unverified'>('all');
  const [spotId, setSpotId] = useState('');
  const [labels, setLabels] = useState(true);

  const list = [...gnomes]
    .filter((g) => (which === 'all' ? true : !g.verifiedOnSite))
    .filter((g) => !spotId || g.spotId === spotId)
    .sort((a, b) => a.number - b.number);
  const pending = list.filter((g) => !g.code || !g.manualCode).length;
  const spotName = (id: string) => spots.find((s) => s.id === id)?.name || '';

  return (
    <div className="mx-auto max-w-5xl">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          html, body { background: #fff !important; }
          .thecode-sheet { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="print:hidden">
        <ScreenHeader
          title="הדפסת לוחיות"
          summary="מדבקה לכל גמד: קוד QR בגודל 3.4 ס״מ, מספר הגמד, הצבעים שלו במילים והקוד הידני."
          actions={<Button variant="primary" icon={Printer} onClick={() => window.print()} disabled={!list.length}>הדפיסו</Button>}
        />
        <Card className="mb-4 flex flex-wrap items-center gap-4 p-4">
          <Segmented label="אילו גמדים" value={which} onChange={setWhich} options={[{ value: 'all', label: 'כולם' }, { value: 'unverified', label: 'עוד לא הותקנו' }]} />
          <select className="input select-input w-auto min-w-48" value={spotId} onChange={(e) => setSpotId(e.target.value)} aria-label="מקום">
            <option value="">כל המקומות</option>
            {spots.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <Toggle checked={labels} onChange={setLabels} label="תווית למתקין" size="sm" />
            שם המקום מתחת למדבקה
          </label>
          <span className="ms-auto text-sm text-text-secondary">{list.length} מדבקות</span>
        </Card>
        <p className="mb-4 text-sm text-text-secondary">
          הדפיסו בגודל אמיתי (100%, בלי &quot;התאמה לדף&quot;). כל קוד מוביל לכתובת הקבועה של המשחק:
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
        <div className="thecode-sheet overflow-x-auto rounded-xl bg-white p-6 text-black shadow-sm ring-1 ring-border print:overflow-visible print:rounded-none print:p-0 print:shadow-none print:ring-0">
          <div className="grid w-[189mm] grid-cols-[repeat(4,45mm)] gap-[3mm]" dir="rtl">
            {list.map((g) => (
              <Sticker key={g.id} gnome={g} spot={labels ? spotName(g.spotId) : null} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Sticker({ gnome: g, spot }: { gnome: TheCodeGnome; spot: string | null }) {
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
          {ready ? g.manualCode : '·····'}
        </div>
      </div>
      {spot !== null && <div className="mt-[1mm] w-[45mm] truncate text-center text-[7pt] leading-tight text-gray-500">{spot}</div>}
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block size-[3.5mm] rounded-full border border-gray-500" style={{ background: color }} />;
}
