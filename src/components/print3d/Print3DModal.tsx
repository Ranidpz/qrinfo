'use client';

// "הדפסה בתלת־ממד" — one modal for every surface that prints a QR (plan: docs/QR_3D_PRINT_PLAN.md).
// The download builds Bambu-ready .3mf files IN THE BROWSER (src/lib/print3d/job.ts): plaques on H2D
// plates with the filament of every part pre-assigned, plus black bases. Nothing goes to a server.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle, Box, CheckCircle2, ChevronDown, Download, KeyRound, Layers, Loader2, Presentation, Square, Tag, X, XCircle,
  type LucideIcon,
} from 'lucide-react';
import { Button, Pill, Segmented, Toggle, cx } from '@/components/thecode/admin/ui';
import { decodes, qrMatrix } from '@/lib/print3d/matrix';
import { instructionsFor } from '@/lib/print3d/instructions';
import { addressLines, faceDesign } from '@/lib/print3d/face';
import { printableText } from '@/lib/print3d/font';
import { buildJob, packForDownload } from '@/lib/print3d/job';
import {
  KEYCHAIN, PLAQUES, SHAPES, SIZE_LABEL, baseFor, checksFor, perPlate, standFor,
  type Check, type Print3DMount, type Print3DShape, type Print3DSize, type Print3DText,
} from '@/lib/print3d/presets';
import { AssembledView, PlateView, PrintedView, SideView } from './PlaquePreview';

export interface Print3DItem {
  id: string;
  number: number;
  /** Shown in the picker, e.g. "גמד 3 · לובי". */
  label: string;
  /** Always the production URL — a permanent plaque must never carry a dev / preview host. */
  url: string;
  manualCode?: string;
  outdoor?: boolean;
}

const SHAPE_ICON: Record<Print3DShape, LucideIcon> = { gnome: Tag, base: Square, stand: Presentation, keychain: KeyRound };

export default function Print3DModal({
  open,
  onClose,
  items,
  title,
  shapes = ['gnome', 'base', 'stand', 'keychain'],
  defaultShape,
  demo,
}: {
  open: boolean;
  onClose: () => void;
  items: Print3DItem[];
  title: string;
  shapes?: Print3DShape[];
  defaultShape?: Print3DShape;
  demo?: boolean;
}) {
  const batch = items.length > 1;
  const hasManual = items.some((i) => i.manualCode);
  const [shape, setShape] = useState<Print3DShape>(defaultShape ?? shapes[0]);
  const [size, setSize] = useState<Print3DSize>('standard');
  const [mount, setMount] = useState<Print3DMount>('screws');
  const [textMode, setTextMode] = useState<Print3DText>(hasManual ? 'manual' : 'none');
  const [customText, setCustomText] = useState('SCAN ME');
  const [backNumber, setBackNumber] = useState(batch);
  const [view, setView] = useState<'seen' | 'printed' | 'side'>('seen');
  const [index, setIndex] = useState(0);
  const [howOpen, setHowOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const item = items[Math.min(index, items.length - 1)];
  const plaque = PLAQUES[shape === 'gnome' ? 'standard' : size];
  const matrix = useMemo(() => qrMatrix(item.url), [item.url]);
  // Self-check: every code of the batch must decode back to its own URL before anything prints.
  const decodeResults = useMemo(() => (open ? items.map((i) => decodes(qrMatrix(i.url))) : []), [open, items]);
  const allDecode = decodeResults.length ? decodeResults.every(Boolean) : null;

  const linesFor = (it: Print3DItem): string[] =>
    textMode === 'manual' ? [it.manualCode ?? ''] : textMode === 'address' ? addressLines(it.url) : textMode === 'custom' ? [printableText(customText.trim()).slice(0, 12)] : [];
  const lines = linesFor(item);
  const faceW = shape === 'keychain' ? KEYCHAIN.w : plaque.w;
  const faceH = shape === 'keychain' ? KEYCHAIN.h : plaque.h;
  const design = faceDesign(faceW, faceH, matrix, lines);
  const layout = design.layout;
  const outdoorCount = items.filter((i) => i.outdoor).length;
  const checks: Check[] = checksFor({
    shape, module: layout.module, version: matrix.version, outdoor: outdoorCount > 0,
    verified: plaque.verified, decoded: allDecode, url: item.url,
  });
  if (design.textTooSmall) checks.push({ tone: 'warn', text: textMode === 'address' ? 'הכתובת יוצאת קטנה מדי לקריאה בגודל הזה — בחרו לוחית גדולה' : 'הטקסט יוצא קטן מדי לקריאה — קצרו אותו או בחרו לוחית גדולה' });
  const blocked = checks.some((c) => c.tone === 'bad');

  const download = () => {
    setBusy(true);
    setResult(null);
    // let the spinner paint before the (synchronous, ~1 s for a full plate) build
    window.setTimeout(() => {
      try {
        const job = buildJob({
          shape, size, mount, backNumber, title,
          items: items.map((it) => ({ number: it.number, url: it.url, lines: linesFor(it), name: `#${it.number}${it.manualCode ? ` ${it.manualCode}` : ''}` })),
        });
        if (!job.files.length) {
          setResult({ tone: 'bad', text: 'לא נוצר קובץ — אף קוד לא עבר את בדיקת הסריקה.' });
          return;
        }
        const pack = packForDownload(job.files, 'qr-3d-print.zip');
        const url = URL.createObjectURL(pack.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = pack.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
        const plaquesN = job.files.filter((f) => f.kind === 'plaques').reduce((s, f) => s + f.pieces, 0);
        const failed = job.failed.length ? ` ${job.failed.length} קודים לא עברו את בדיקת הסריקה ולא נכנסו: ${job.failed.join(', ')}.` : '';
        setResult({
          tone: job.failed.length ? 'bad' : 'ok',
          text: `ירד ${job.files.length === 1 ? 'קובץ אחד' : `קובץ דחוס עם ${job.files.length} קבצים`}: ${plaquesN} לוחיות${job.files.some((f) => f.kind === 'bases') ? ' ובסיסים' : ''}.${failed}`,
        });
      } catch (e) {
        console.error('print3d build failed', e);
        setResult({ tone: 'bad', text: 'משהו השתבש בבניית הקובץ. נסו שוב.' });
      } finally {
        setBusy(false);
      }
    }, 30);
  };

  // Plates: plaques are two-colour (prime tower), bases/stands one colour.
  const plaqueFoot = shape === 'keychain' ? { w: KEYCHAIN.w, h: KEYCHAIN.h + KEYCHAIN.tab } : { w: plaque.w, h: plaque.h };
  const plaquePer = perPlate(plaqueFoot.w, plaqueFoot.h, true);
  const holder = shape === 'base' ? baseFor(plaque, mount) : shape === 'stand' ? baseFor(plaque, 'tape') : null;
  const stand = shape === 'stand' ? standFor(plaque) : null;
  const holderFoot = stand ? { w: stand.w, h: stand.depth } : holder ? { w: holder.w, h: holder.h } : null;
  const holderPer = holderFoot ? perPlate(holderFoot.w, holderFoot.h, false) : 0;
  const n = items.length;

  if (!open) return null;

  const groups = instructionsFor(shape, mount, { batch, backNumber });
  const cm = (mm: number) => (mm / 10).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()} dir="rtl">
      <div role="dialog" aria-modal="true" aria-label="הדפסה בתלת־ממד" className="flex max-h-[94dvh] w-full max-w-5xl flex-col rounded-t-2xl bg-bg-card text-text-primary shadow-xl sm:rounded-2xl">
        {/* header */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-4 sm:px-6">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent"><Box size={20} aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">הדפסה בתלת־ממד</h2>
            <p className="truncate text-sm text-text-secondary">{title}</p>
          </div>
          {demo && <span className="hidden sm:block"><Pill tone="warning">הדגמה — קודים לדוגמה</Pill></span>}
          <button type="button" onClick={onClose} aria-label="סגירה" className="inline-flex size-10 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover">
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          {/* controls */}
          <div className="space-y-6 border-border p-5 sm:p-6 lg:border-e">
            <section>
              <h3 className="mb-2 text-sm font-medium text-text-secondary">מה מדפיסים</h3>
              <div className="grid grid-cols-2 gap-2">
                {SHAPES.filter((s) => shapes.includes(s.id)).map((s) => {
                  const Icon = SHAPE_ICON[s.id];
                  const on = shape === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setShape(s.id)}
                      aria-pressed={on}
                      className={cx(
                        'flex min-h-16 items-center gap-3 rounded-xl border px-3 py-2.5 text-start transition-colors',
                        on ? 'border-accent bg-accent/10 ring-1 ring-accent/40' : 'border-border hover:bg-bg-hover'
                      )}
                    >
                      <Icon size={20} className={on ? 'text-accent' : 'text-text-secondary'} aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-[15px] font-medium">{s.label}</span>
                        <span className="block text-sm text-text-secondary">{s.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {shape !== 'gnome' && shape !== 'keychain' && (
              <section className="space-y-2">
                <h3 className="text-sm font-medium text-text-secondary">גודל</h3>
                <Segmented
                  label="גודל"
                  value={size}
                  onChange={setSize}
                  options={(['standard', 'large', 'xl'] as Print3DSize[]).map((s) => ({ value: s, label: SIZE_LABEL[s] }))}
                />
                <p className="text-sm text-text-secondary">
                  קוד בגודל {cm(layout.qr)} ס״מ, לוחית {cm(plaque.w)} על {cm(plaque.h)} ס״מ
                  {size === 'standard' ? ' — אותה לוחית שנכנסת לגמד.' : '.'}
                </p>
              </section>
            )}
            {shape === 'gnome' && (
              <p className="rounded-lg bg-bg-secondary px-3 py-2 text-sm text-text-secondary">
                בגודל השקע בגמד: לוחית {cm(plaque.w)} על {cm(plaque.h)} ס״מ, קוד {cm(layout.qr)} ס״מ. אותה לוחית מתאימה גם לבסיס השחור.
              </p>
            )}

            {shape === 'base' && (
              <section className="space-y-2">
                <h3 className="text-sm font-medium text-text-secondary">איך מחברים את הבסיס</h3>
                <Segmented
                  label="חיבור"
                  value={mount}
                  onChange={setMount}
                  options={[{ value: 'screws', label: 'ברגים מוסתרים' }, { value: 'tape', label: 'מדבקה דו־צדדית' }]}
                />
                <p className="text-sm text-text-secondary">
                  {mount === 'screws'
                    ? 'שני ברגים בתוך השקע. הלוחית נכנסת מעליהם ומסתירה אותם.'
                    : 'גב שטוח לסרט דו־צדדי. בלי קדיחה בקיר.'}
                  {holder && ` בסיס ${cm(holder.w)} על ${cm(holder.h)} ס״מ, בעובי ${holder.t} מ״מ.`}
                </p>
              </section>
            )}

            <section className="space-y-2">
              <h3 className="text-sm font-medium text-text-secondary">מתחת לקוד</h3>
              <Segmented
                label="מתחת לקוד"
                value={textMode}
                onChange={setTextMode}
                options={[
                  { value: 'none', label: 'כלום' },
                  ...(hasManual ? [{ value: 'manual' as Print3DText, label: 'הקוד הידני' }] : [{ value: 'address' as Print3DText, label: 'הכתובת' }]),
                  { value: 'custom', label: 'טקסט קצר' },
                ]}
              />
              {textMode === 'custom' && (
                <input
                  className="input mt-2 w-full"
                  dir="ltr"
                  maxLength={12}
                  value={customText}
                  onChange={(e) => setCustomText(printableText(e.target.value))}
                  aria-label="טקסט מתחת לקוד"
                />
              )}
              {textMode === 'manual' && <p className="text-sm text-text-secondary">משפחה שהמצלמה שלה לא עובדת מקלידה את הקוד הזה במשחק.</p>}
              {textMode === 'address' && <p className="text-sm text-text-secondary">מי שלא מצליח לסרוק מקליד את הכתובת בדפדפן. בלוחית גדולה היא קריאה בנוחות.</p>}
              {textMode === 'custom' && <p className="text-sm text-text-secondary">אותיות באנגלית, ספרות וסימנים פשוטים. עברית תגיע בהמשך.</p>}
            </section>

            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-[15px] font-medium">מספר בגב הלוחית</span>
                <span className="block text-sm text-text-secondary">כדי לדעת איזו לוחית שייכת לאיזה מקום</span>
              </span>
              <Toggle checked={backNumber} onChange={setBackNumber} label="מספר בגב הלוחית" />
            </label>

            <section>
              <h3 className="mb-2 text-sm font-medium text-text-secondary">בדיקות</h3>
              <ul className="space-y-1.5">
                {checks.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    {c.tone === 'ok' ? (
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" aria-hidden />
                    ) : c.tone === 'warn' ? (
                      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden />
                    ) : (
                      <XCircle size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden />
                    )}
                    <span>{c.text}{c.tone === 'warn' && c.text.startsWith('בחוץ') && outdoorCount < n ? ` (${outdoorCount} מתוך ${n})` : ''}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* preview */}
          <div className="order-first space-y-4 bg-bg-secondary/50 p-5 sm:p-6 lg:order-none">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Segmented
                label="תצוגה"
                value={view}
                onChange={setView}
                options={[{ value: 'seen', label: 'כך זה נראה' }, { value: 'printed', label: 'על הפלטה' }, { value: 'side', label: 'מהצד' }]}
              />
              {batch && (
                <select className="input select-input w-auto min-w-40" value={index} onChange={(e) => setIndex(Number(e.target.value))} aria-label="איזה קוד להציג">
                  {items.map((it, i) => (
                    <option key={it.id} value={i}>{it.label}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex h-72 items-center justify-center rounded-xl bg-[#E9EAEC] p-4 text-gray-600 sm:h-80 dark:bg-[#2A2D33] dark:text-gray-300">
              {view === 'seen' && <AssembledView shape={shape} matrix={matrix} plaque={plaque} mount={mount} lines={lines} />}
              {view === 'printed' && <PrintedView shape={shape} matrix={matrix} plaque={plaque} mount={mount} lines={lines} number={backNumber ? item.number : null} />}
              {view === 'side' && <SideView shape={shape} plaque={plaque} mount={mount} />}
            </div>
            <p className="text-sm text-text-secondary">
              {view === 'seen' && 'כך הלוחית תיראה אחרי ההרכבה, בגודל יחסי אמיתי.'}
              {view === 'printed' && 'הלוחית שוכבת עם הקוד על הפלטה, ולכן הוא הפוך. רק שתי השכבות הראשונות בשני צבעים.'}
              {view === 'side' && (shape === 'keychain' ? 'מחזיק המפתחות מודפס בחתיכה אחת, בלי פינים.' : 'הפינים בגב הלוחית נכנסים לחורים. הם לא סימטריים, אז יש רק כיוון אחד נכון. העובי מוגדל בציור.')}
            </p>

            {/* what the download gives */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-text-secondary">מה תקבלו</h3>
              <FileRow
                icon={Layers}
                title={`${shape === 'keychain' ? 'מחזיקי מפתחות' : 'לוחיות'} — לבן ושחור`}
                text={`${n} ${n === 1 ? 'יחידה' : 'יחידות'}, ${plates(n, plaquePer)} · עד ${plaquePer} בפלטה`}
                plate={<PlateView itemW={plaqueFoot.w} itemH={plaqueFoot.h} count={Math.min(n, plaquePer)} twoColour tone="plaque" />}
              />
              {holderFoot && (
                <FileRow
                  icon={shape === 'stand' ? Presentation : Square}
                  title={`${shape === 'stand' ? 'מעמדים' : 'בסיסים'} — שחור בלבד`}
                  text={shape === 'stand' ? 'קובץ המעמד יתווסף בשלב הבא. הלוחיות כבר מוכנות.' : `${n} ${n === 1 ? 'יחידה' : 'יחידות'}, ${plates(n, holderPer)} · עד ${holderPer} בפלטה`}
                  plate={<PlateView itemW={holderFoot.w} itemH={holderFoot.h} count={Math.min(n, holderPer)} twoColour={false} tone="base" />}
                />
              )}
            </div>
          </div>
        </div>

        {/* instructions */}
        <div className="border-t border-border">
          <button type="button" onClick={() => setHowOpen((v) => !v)} aria-expanded={howOpen} className="flex w-full items-center justify-between px-5 py-3 text-start sm:px-6">
            <span className="font-medium">איך מדפיסים ומרכיבים</span>
            <ChevronDown size={18} className={cx('text-text-secondary transition-transform', howOpen && 'rotate-180')} aria-hidden />
          </button>
          {howOpen && (
            <div className="grid gap-4 px-5 pb-5 sm:px-6 md:grid-cols-2">
              {groups.map((g) => (
                <div key={g.title}>
                  <h4 className="mb-1 text-sm font-semibold">{g.title}</h4>
                  <ol className="list-decimal space-y-1 ps-5 text-sm text-text-secondary">
                    {g.steps.map((s) => <li key={s}>{s}</li>)}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </div>

        </div>

        {/* footer */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4 sm:px-6">
          {result ? (
            <span className={cx('me-auto text-sm', result.tone === 'ok' ? 'text-green-700 dark:text-green-400' : 'text-danger')}>{result.text}</span>
          ) : (
            demo && <span className="me-auto hidden text-sm text-text-secondary sm:block">קודים לדוגמה — הלוחית נסרקת, אבל מובילה לדף שלא קיים.</span>
          )}
          <Button onClick={onClose}>סגירה</Button>
          <Button variant="primary" icon={busy ? Loader2 : Download} disabled={busy || blocked} onClick={download} className={busy ? '[&_svg]:animate-spin' : undefined}>
            {busy ? 'בונים את הקובץ…' : 'הורידו קובץ לבמבו'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function plates(n: number, per: number): string {
  if (!per) return 'לא נכנס בפלטה';
  const p = Math.ceil(n / per);
  return p === 1 ? 'פלטה אחת' : `${p} פלטות`;
}

function FileRow({ icon: Icon, title, text, plate }: { icon: LucideIcon; title: string; text: string; plate: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-bg-card p-3">
      <div className="size-16 shrink-0">{plate}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[15px] font-medium">
          <Icon size={16} className="text-text-secondary" aria-hidden />
          {title}
        </div>
        <div className="text-sm text-text-secondary">{text}</div>
      </div>
    </div>
  );
}
