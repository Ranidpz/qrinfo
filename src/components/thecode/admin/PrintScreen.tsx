'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer } from 'lucide-react';
import { THECODE_COLORS } from '@/components/thecode/GnomeFigure';
import type { ScreenProps } from './model';
import { plateUrl } from './helpers';
import { Button, Card, EmptyState, ScreenHeader, Segmented, Toggle } from './ui';

/**
 * Print sheet: one 30×30 mm plate per gnome (QR + short manual code + number), with a cut line.
 * Under each plate, outside the cut line, a label for whoever screws it on (colours + spot).
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
  const spotName = (id: string) => spots.find((s) => s.id === id)?.name || '';

  return (
    <div className="mx-auto max-w-5xl">
      <style>{`@media print { @page { size: A4; margin: 10mm; } html, body { background: #fff !important; } }`}</style>

      <div className="print:hidden">
        <ScreenHeader
          title="הדפסת לוחיות"
          summary="לוחית בגודל 3×3 ס״מ לכל גמד: קוד QR, קוד ידני קצר ומספר הגמד."
          actions={<Button variant="primary" icon={Printer} onClick={() => window.print()} disabled={!list.length}>הדפיסו</Button>}
        />
        <Card className="mb-6 flex flex-wrap items-center gap-4 p-4">
          <Segmented label="אילו גמדים" value={which} onChange={setWhich} options={[{ value: 'all', label: 'כולם' }, { value: 'unverified', label: 'עוד לא הותקנו' }]} />
          <select className="input select-input w-auto min-w-48" value={spotId} onChange={(e) => setSpotId(e.target.value)} aria-label="מקום">
            <option value="">כל המקומות</option>
            {spots.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <Toggle checked={labels} onChange={setLabels} label="תווית למתקין" size="sm" />
            תווית למתקין מתחת ללוחית
          </label>
          <span className="ms-auto text-sm text-text-secondary">{list.length} לוחיות</span>
        </Card>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Printer} title="אין לוחיות להדפסה" text="כל הגמדים שבחרתם כבר הותקנו. בחרו &quot;כולם&quot; או הפיקו גמדים חדשים." action={<Button onClick={() => navigate({ tab: 'gnomes' })}>לגמדים</Button>} />
      ) : (
        <div className="rounded-xl bg-white p-6 text-black shadow-sm ring-1 ring-border print:rounded-none print:p-0 print:shadow-none print:ring-0">
          <div className="flex flex-wrap gap-x-[6mm] gap-y-[6mm]" dir="ltr">
            {list.map((g) => (
              <div key={g.id} className="flex w-[30mm] flex-col items-center break-inside-avoid">
                <div className="flex size-[30mm] flex-col items-center justify-center rounded-[2mm] border border-dashed border-gray-400">
                  <QRCodeSVG value={plateUrl(g.code)} level="M" marginSize={0} style={{ width: '20mm', height: '20mm' }} />
                  <div className="mt-[1mm] flex w-[22mm] items-center justify-between font-mono text-[8pt] font-bold leading-none">
                    <span>{g.manualCode}</span>
                    <span>#{g.number}</span>
                  </div>
                </div>
                {labels && (
                  <div className="mt-[1.5mm] w-[30mm] text-center text-[7pt] leading-tight text-gray-600" dir="rtl">
                    <div className="flex items-center justify-center gap-[1mm]">
                      <span className="inline-block size-[2.5mm] rounded-full border border-gray-500" style={{ background: THECODE_COLORS[g.bodyColor].hex }} />
                      <span className="inline-block size-[2.5mm] rounded-full border border-gray-500" style={{ background: THECODE_COLORS[g.hatColor].hex }} />
                      <span>{THECODE_COLORS[g.bodyColor].he}/{THECODE_COLORS[g.hatColor].he}</span>
                    </div>
                    <div className="truncate">{spotName(g.spotId)}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
