'use client';

// Two mock surfaces with the new "הדפסה בתלת־ממד" button next to the existing print button:
// the code page QR panel (one code) and הקוד's print screen (all gnomes of an adventure).

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Box, Copy, Eye, Link as LinkIcon, Printer } from 'lucide-react';
import Print3DModal, { type Print3DItem } from '@/components/print3d/Print3DModal';
import { Button, Card, Pill, Segmented, cx } from '@/components/thecode/admin/ui';
import { SITE_URL } from '@/lib/landing/site';

const CODE_ITEM: Print3DItem = {
  id: 'room', number: 1, label: 'תפריט חדר', url: `${SITE_URL}/v/dMo3Dq`,
};

// Sample gnomes (fake codes in the real format: 12-char plate code + 6-char manual code).
const GNOMES: (Print3DItem & { spot: string })[] = [
  { id: 'g1', number: 1, spot: 'לובי', manualCode: 'K7MP2Q', url: `${SITE_URL}/g/Dm0LobbyA1x9`, label: '' },
  { id: 'g2', number: 2, spot: 'לובי', manualCode: 'R4XH8N', url: `${SITE_URL}/g/Dm0LobbyB7k2`, label: '' },
  { id: 'g3', number: 3, spot: 'חדר אוכל', manualCode: 'T9BW3E', url: `${SITE_URL}/g/Dm0DiningC4p` , label: '' },
  { id: 'g4', number: 4, spot: 'מועדון ילדים', manualCode: 'F2JV6Y', url: `${SITE_URL}/g/Dm0KidsClD8q`, label: '' },
  { id: 'g5', number: 5, spot: 'מועדון ילדים', manualCode: 'M8CZ5S', url: `${SITE_URL}/g/Dm0KidsClE3w`, label: '' },
  { id: 'g6', number: 6, spot: 'בריכה', manualCode: 'P3QA7L', url: `${SITE_URL}/g/Dm0PoolF5r1z`, label: '', outdoor: true },
].map((g) => ({ ...g, label: `גמד ${g.number} · ${g.spot}` }));

type Surface = 'code' | 'thecode';

export default function Print3DDemo() {
  const [surface, setSurface] = useState<Surface>('code');
  const [open, setOpen] = useState(false);

  return (
    <div dir="rtl" className="min-h-dvh bg-bg-primary text-text-primary">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border bg-bg-card/95 px-4 py-3 backdrop-blur sm:px-6">
        <span className="inline-flex size-9 items-center justify-center rounded-lg bg-accent/12 text-accent"><Box size={18} aria-hidden /></span>
        <h1 className="text-lg font-bold">הדפסה בתלת־ממד</h1>
        <Pill tone="warning">הדגמה — שום דבר לא נשמר ולא יורד</Pill>
        <div className="ms-auto">
          <Segmented
            label="איפה הכפתור"
            value={surface}
            onChange={(v) => { setSurface(v); setOpen(false); }}
            options={[{ value: 'code', label: 'בדף קוד' }, { value: 'thecode', label: 'בהקוד — הדפסת לוחיות' }]}
          />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {surface === 'code' ? <CodePanel onOpen={() => setOpen(true)} /> : <TheCodePrint onOpen={() => setOpen(true)} />}
      </main>

      {surface === 'code' ? (
        <Print3DModal key="code" open={open} onClose={() => setOpen(false)} demo items={[CODE_ITEM]} title="תפריט חדר — מלון לדוגמה" shapes={['base', 'stand', 'keychain']} defaultShape="base" />
      ) : (
        <Print3DModal key="thecode" open={open} onClose={() => setOpen(false)} demo items={GNOMES} title="מלון לדוגמה — 6 גמדים" shapes={['gnome', 'base']} defaultShape="gnome" />
      )}
    </div>
  );
}

/** Mock of the QR panel on the code page (src/app/[locale]/code/[id]/page.tsx). */
function CodePanel({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="grid gap-6 md:grid-cols-[22rem_1fr]">
      <Card className="space-y-5 p-5">
        <h2 className="text-lg font-semibold">קוד QR</h2>
        <div className="flex justify-center rounded-xl bg-white p-4">
          <QRCodeSVG value={CODE_ITEM.url} size={200} level="M" marginSize={1} />
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-bg-secondary p-3">
          <LinkIcon size={16} className="shrink-0 text-text-secondary" aria-hidden />
          <span className="flex-1 truncate text-sm" dir="ltr">{CODE_ITEM.url}</span>
          <Copy size={16} className="text-text-secondary" aria-hidden />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button icon={Eye}>תצוגה</Button>
          <Button icon={Printer}>הדפסת QR</Button>
        </div>
        <NewButton onOpen={onOpen} text="לוחית קבועה לקיר, לשולחן או למפתחות" />
      </Card>
      <Explainer
        lines={[
          'בדף של כל קוד, ליד "הדפסת QR", יש כפתור חדש.',
          'הוא פותח חלון אחד: בוחרים צורה, רואים איך זה ייראה, ומורידים קובץ מוכן לבמבו.',
          'הלוחית הלבנה זהה לזו שבגמד. הבסיס השחור מחזיק אותה בפינים.',
        ]}
      />
    </div>
  );
}

/** Mock of הקוד's print screen header (src/components/thecode/admin/PrintScreen.tsx). */
function TheCodePrint({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">הדפסת לוחיות</h2>
          <p className="mt-1 text-text-secondary">כל הגמדים, מכל המקומות, יחד.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={Printer}>הדפיסו מדבקות</Button>
          <Button variant="primary" icon={Box} onClick={onOpen}>לוחיות בתלת־ממד</Button>
        </div>
      </div>
      <Card className="divide-y divide-border">
        {GNOMES.map((g) => (
          <div key={g.id} className="flex items-center gap-3 px-4 py-3">
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-bg-secondary font-semibold">{g.number}</span>
            <span className="flex-1">
              <span className="block font-medium">{g.spot}</span>
              <span className="block text-sm text-text-secondary"><span dir="ltr">{g.manualCode}</span></span>
            </span>
            {g.outdoor && <Pill tone="warning">בחוץ</Pill>}
          </div>
        ))}
      </Card>
      <Explainer
        lines={[
          'במסך ההדפסה של הקוד יש כפתור חדש ליד המדבקות.',
          'כל הגמדים יוצאים בקובץ אחד, מסודרים על הפלטה, עם המספר בגב כל לוחית.',
          'אפשר לבחור גם בסיס שחור, לגמדים שתלויים על הקיר בלי גוף.',
        ]}
      />
    </div>
  );
}

function NewButton({ onOpen, text }: { onOpen: () => void; text: string }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-start transition-colors hover:bg-accent/15"
    >
      <Box size={20} className="text-accent" aria-hidden />
      <span>
        <span className="block font-medium text-accent">הדפסה בתלת־ממד</span>
        <span className="block text-sm text-text-secondary">{text}</span>
      </span>
    </button>
  );
}

function Explainer({ lines }: { lines: string[] }) {
  return (
    <Card className={cx('h-fit space-y-2 p-5')}>
      <h3 className="font-semibold">מה רואים כאן</h3>
      <ul className="list-disc space-y-1 ps-5 text-text-secondary">
        {lines.map((l) => <li key={l}>{l}</li>)}
      </ul>
    </Card>
  );
}
