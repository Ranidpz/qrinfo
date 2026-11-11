'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, MapPin, Plus, ShieldAlert, Trash2, TriangleAlert } from 'lucide-react';
import GnomeFigure from '@/components/thecode/GnomeFigure';
import type { TheCodeSpot } from '@/types/thecode';
import type { ScreenProps } from './model';
import { Button, Card, EmptyState, Field, Pill, ScreenHeader, Toggle, cx } from './ui';

const HINT_LEVELS = [
  { label: 'רמז 1 — אזור', placeholder: 'למשל: בלובי, בצד של הספות' },
  { label: 'רמז 2 — קרוב', placeholder: 'למשל: ליד כלי נגינה גדול' },
  { label: 'רמז 3 — מדויק', placeholder: 'למשל: מאחורי הכורסה הירוקה' },
];

export default function SpotsScreen({ state, actions, navigate, target }: ScreenProps) {
  const { spots, gnomes } = state.config;
  const [selectedId, setSelectedId] = useState<string | null>(target.spotId ?? null);
  useEffect(() => {
    if (target.spotId) setSelectedId(target.spotId);
  }, [target]);

  const selected = spots.find((s) => s.id === selectedId) || null;
  const gnomesAt = (id: string) => gnomes.filter((g) => g.spotId === id);

  const add = () => setSelectedId(actions.addSpot());

  return (
    <div className="mx-auto max-w-5xl">
      <ScreenHeader
        title="מקומות"
        summary={`${spots.length} מקומות במלון. בכל מקום עומדים 2–3 גמדים.`}
        actions={<Button variant="primary" icon={Plus} onClick={add}>הוסיפו מקום</Button>}
      />

      {spots.length === 0 ? (
        <EmptyState icon={MapPin} title="עוד אין מקומות" text="הוסיפו את המקום הראשון שבו יעמדו גמדים — למשל הלובי או הבריכה." action={<Button variant="primary" icon={Plus} onClick={add}>הוסיפו מקום</Button>} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          {/* List — hidden on phones while editing */}
          <Card className={cx('divide-y divide-border self-start', selected && 'hidden lg:block')}>
            {spots.map((s) => {
              const here = gnomesAt(s.id);
              const noHint = !s.hints.some((h) => h.trim());
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={cx(
                    'flex w-full items-center gap-3 px-4 py-3 text-start transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-bg-hover',
                    s.id === selectedId && 'bg-accent/5'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className={cx('truncate font-medium', !s.isActive && 'text-text-secondary line-through')}>{s.name}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-sm text-text-secondary">
                      <span>{here.length === 1 ? 'גמד אחד' : `${here.length} גמדים`}</span>
                      {noHint && here.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <TriangleAlert size={14} aria-hidden /> אין רמזים
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronLeft size={16} className="shrink-0 text-text-secondary" aria-hidden />
                </button>
              );
            })}
          </Card>

          {selected ? (
            <SpotEditor
              key={selected.id}
              spot={selected}
              gnomes={gnomesAt(selected.id)}
              onBack={() => setSelectedId(null)}
              onChange={(patch) => actions.updateSpot(selected.id, patch)}
              onDelete={() => {
                actions.deleteSpot(selected.id);
                setSelectedId(null);
              }}
              onOpenGnome={(id) => navigate({ tab: 'gnomes', gnomeId: id })}
              onAddGnomes={() => navigate({ tab: 'gnomes', spotId: selected.id })}
            />
          ) : (
            <div className="hidden items-center justify-center rounded-xl border border-dashed border-border p-12 text-text-secondary lg:flex">
              בחרו מקום מהרשימה כדי לערוך אותו.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SpotEditor({
  spot,
  gnomes,
  onBack,
  onChange,
  onDelete,
  onOpenGnome,
  onAddGnomes,
}: {
  spot: TheCodeSpot;
  gnomes: ScreenProps['state']['config']['gnomes'];
  onBack: () => void;
  onChange: (patch: Partial<TheCodeSpot>) => void;
  onDelete: () => void;
  onOpenGnome: (id: string) => void;
  onAddGnomes: () => void;
}) {
  const [photo, setPhoto] = useState<string | null>(spot.photoUrl || null);
  const hints = [0, 1, 2].map((i) => spot.hints[i] || '');

  const setHint = (i: number, v: string) => {
    const next = [...hints];
    next[i] = v;
    while (next.length && !next[next.length - 1].trim()) next.pop();
    onChange({ hints: next });
  };

  return (
    <Card className="p-6">
      <button type="button" onClick={onBack} className="-ms-2 mb-4 inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm text-text-secondary hover:bg-bg-hover lg:hidden">
        <ChevronRight size={16} aria-hidden /> כל המקומות
      </button>

      <div className="flex items-start gap-4">
        <Field label="שם המקום" hint="רק אתם רואים את השם הזה. משפחות רואות את הרמזים." className="flex-1">
          <input className="input" value={spot.name} onChange={(e) => onChange({ name: e.target.value })} />
        </Field>
        <div className="flex flex-col items-center gap-1 pt-7">
          <Toggle checked={spot.isActive} onChange={(v) => onChange({ isActive: v })} label="מקום פעיל" />
          <span className="text-xs text-text-secondary">{spot.isActive ? 'פעיל' : 'כבוי'}</span>
        </div>
      </div>

      {/* Photo placeholder — wave 2 uploads to R2 */}
      <div className="mt-6">
        <span className="mb-1.5 block text-sm font-medium">תמונה של המקום</span>
        <label className="flex aspect-[16/7] cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-bg-secondary text-text-secondary hover:bg-bg-hover">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-2 text-sm">
              <ImagePlus size={24} aria-hidden />
              העלו תמונה, כדי שכל הצוות יידע איפה הגמדים עומדים
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setPhoto(URL.createObjectURL(f));
            }}
          />
        </label>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <h3 className="font-semibold">רמזים למשפחות</h3>
          <p className="text-sm text-text-secondary">משפחה מקבלת קודם את רמז האזור, ואם צריך — רמז קרוב יותר ואז מדויק.</p>
        </div>
        {HINT_LEVELS.map((h, i) => (
          <Field key={i} label={h.label}>
            <input className="input" value={hints[i]} placeholder={h.placeholder} onChange={(e) => setHint(i, e.target.value)} />
          </Field>
        ))}
      </div>

      <Field label="הערת בטיחות לצוות" className="mt-6">
        <div className="relative">
          <ShieldAlert size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-text-secondary" aria-hidden />
          <input className="input ps-9" value={spot.safetyNote || ''} placeholder="למשל: קרוב למים — לגשת רק עם מבוגר" onChange={(e) => onChange({ safetyNote: e.target.value })} />
        </div>
      </Field>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">הגמדים שעומדים כאן</h3>
          <Button size="sm" variant="ghost" icon={Plus} onClick={onAddGnomes}>הוסיפו גמדים</Button>
        </div>
        {gnomes.length === 0 ? (
          <p className="text-sm text-text-secondary">עוד אין כאן גמדים.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {gnomes.map((g) => (
              <button key={g.id} type="button" onClick={() => onOpenGnome(g.id)} className="flex flex-col items-center rounded-lg px-3 py-2 hover:bg-bg-hover">
                <GnomeFigure bodyColor={g.bodyColor} hatColor={g.hatColor} size={40} />
                <span className="mt-1 text-sm font-semibold">#{g.number}</span>
                {!g.isActive && <Pill className="mt-1">כבוי</Pill>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-end border-t border-border pt-4">
        <Button
          variant="danger"
          size="sm"
          icon={Trash2}
          disabled={gnomes.length > 0}
          title={gnomes.length ? 'העבירו קודם את הגמדים למקום אחר' : undefined}
          onClick={onDelete}
        >
          {gnomes.length ? 'כדי למחוק, העבירו קודם את הגמדים' : 'מחקו מקום'}
        </Button>
      </div>
    </Card>
  );
}
