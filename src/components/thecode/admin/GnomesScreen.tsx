'use client';

import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { BadgeCheck, CircleAlert, CircleHelp, Plus, Printer, Sparkles, Trash2, TriangleAlert, X } from 'lucide-react';
import GnomeFigure, { describeGnome } from '@/components/thecode/GnomeFigure';
import type { TheCodeGnome } from '@/types/thecode';
import type { NewGnomeSpec, ScreenProps } from './model';
import { SILENT_AFTER_DAYS, comboKey, confusableColors, isProbablyMissing, suggestCombos, timeAgo } from './helpers';
import { Button, ColorPicker, Dialog, EmptyState, Field, OutdoorPill, Pill, ScreenHeader, Segmented, Tip, Toggle, cx } from './ui';

/** Plain-words explanations of every status label (Rani: "למה כתוב לי 'כנראה נעלם'?"). */
export const TIPS = {
  notVerified: "עוד לא סימנתם במסך 'מצב התקנה' שהגמד עומד במקום. סמנו אחרי שהדבקתם אותו.",
  verified: 'סימנתם שהגמד הותקן במקום.',
  neverScanned: 'אף קבוצה עוד לא סרקה את הגמד הזה.',
  scans: 'הסריקה האחרונה, וכמה פעמים נסרק.',
  missing: `אומת, אבל אף אחד לא סרק אותו כבר ${SILENT_AFTER_DAYS} ימים. כדאי לבדוק שהוא עדיין במקום.`,
  toggle: 'כבוי = המשחק מדלג על הגמד הזה.',
  noRiddle: 'לגמד אין חידה במשחק, ולכן קבוצות לא יישלחו אליו.',
};
import { allowedGnomeColors } from '@/lib/thecode/engine';

export default function GnomesScreen({ state, report, actions, navigate, target, now }: ScreenProps) {
  const { config, riddles, gnomeStats } = state;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [producing, setProducing] = useState<string | null>(null); // spot id, '' = choose
  const [filter, setFilter] = useState<'all' | 'attention'>('all');
  // Rani 14.11.2026: the list is grouped by place, but a long adventure is easier to scan by number.
  const [view, setView] = useState<'spot' | 'number'>('spot');
  // Dragging a card onto another place's section moves the gnome there (the editor's place
  // selector stays the way to do it with a finger — HTML drag does not work on touch).
  const [dragId, setDragId] = useState<string | null>(null);
  const [overSpot, setOverSpot] = useState<string | null>(null);
  const [created, setCreated] = useState<number[] | null>(null);

  useEffect(() => {
    // A gnome target opens its editor; a spot-only target opens "produce gnomes" for that spot.
    if (target.gnomeId) setEditingId(target.gnomeId);
    else if (target.spotId) setProducing(target.spotId);
  }, [target]);

  const issuesBySpot = useMemo(() => {
    const m = new Map<string, typeof report.issues>();
    for (const i of report.issues) {
      if ((i.code === 'DUPLICATE_COLORS_AT_SPOT' || i.code === 'CONFUSABLE_COLORS_AT_SPOT' || i.code === 'GNOME_COLOR_UNAVAILABLE') && i.spotId) m.set(i.spotId, [...(m.get(i.spotId) || []), i]);
    }
    return m;
  }, [report]);

  const riddleCount = (id: string) => riddles.filter((r) => r.gnomeId === id && r.status === 'published').length;
  const needsAttention = (g: TheCodeGnome) =>
    !g.isActive || !g.verifiedOnSite || riddleCount(g.id) === 0 || isProbablyMissing(g, gnomeStats[g.id], config.status, now) ||
    report.issues.some((i) => i.gnomeId === g.id && (i.code === 'DUPLICATE_COLORS_AT_SPOT' || i.code === 'CONFUSABLE_COLORS_AT_SPOT' || i.code === 'GNOME_COLOR_UNAVAILABLE'));

  /** Same-place colour clash: an identical pair is an error, a confusable pair a warning. */
  const flagOf = (g: TheCodeGnome): 'error' | 'warning' | null => {
    if (!g.isActive) return null;
    const others = config.gnomes.filter((o) => o.spotId === g.spotId && o.id !== g.id && o.isActive);
    if (others.some((o) => comboKey(o) === comboKey(g))) return 'error';
    if (others.some((o) => confusableColors(o, g))) return 'warning';
    return null;
  };
  const moveTo = (gnomeId: string, spotId: string) => {
    const g = config.gnomes.find((x) => x.id === gnomeId);
    if (g && g.spotId !== spotId) actions.updateGnome(gnomeId, { spotId });
    setDragId(null);
    setOverSpot(null);
  };
  const dragProps = (g: TheCodeGnome) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', g.id); setDragId(g.id); },
    onDragEnd: () => { setDragId(null); setOverSpot(null); },
  });

  const editing = config.gnomes.find((g) => g.id === editingId) || null;
  const orphans = config.gnomes.filter((g) => !config.spots.some((s) => s.id === g.spotId));
  const groups = [
    ...config.spots.map((s) => ({ id: s.id, name: s.name, active: s.isActive, outdoor: !!s.outdoor, noHint: !s.hints.some((h) => h.trim()), gnomes: config.gnomes.filter((g) => g.spotId === s.id) })),
    ...(orphans.length ? [{ id: '', name: 'בלי מקום', active: true, outdoor: false, noHint: false, gnomes: orphans }] : []),
  ];
  const attentionCount = config.gnomes.filter(needsAttention).length;

  return (
    <div className="mx-auto max-w-5xl">
      <ScreenHeader
        title="גמדים"
        summary={`${config.gnomes.length} גמדים ב־${config.spots.length} מקומות`}
        actions={
          <>
            <Segmented
              label="תצוגה"
              value={view}
              onChange={setView}
              options={[{ value: 'spot', label: 'לפי מקום' }, { value: 'number', label: 'לפי מספר' }]}
            />
            <Segmented
              label="סינון"
              value={filter}
              onChange={setFilter}
              options={[{ value: 'all', label: 'כולם' }, { value: 'attention', label: `דורשים טיפול (${attentionCount})` }]}
            />
            <Button variant="primary" icon={Sparkles} onClick={() => setProducing('')} disabled={!config.spots.length}>הפקת גמדים</Button>
          </>
        }
      />

      {created && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl bg-success/10 px-4 py-3">
          <BadgeCheck size={20} className="text-success" aria-hidden />
          <span className="font-medium">
            {created.length === 1 ? `נוצר גמד ${created[0]}.` : `נוצרו ${created.length} גמדים: ${created[0]}–${created[created.length - 1]}.`} הדפיסו להם לוחיות והוסיפו חידה לכל אחד.
          </span>
          <div className="ms-auto flex gap-2">
            <Button size="sm" icon={Printer} onClick={() => navigate({ tab: 'print' })}>להדפסה</Button>
            <button type="button" aria-label="סגירה" onClick={() => setCreated(null)} className="inline-flex size-9 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover">
              <X size={16} aria-hidden />
            </button>
          </div>
        </div>
      )}

      {config.gnomes.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="עוד אין גמדים"
          text={config.spots.length ? 'הפיקו גמדים: בחרו מקום, כמה גמדים ואיזה צבעים. כל גמד מקבל מספר וקוד QR.' : 'הוסיפו קודם מקום, ואז הפיקו גמדים שיעמדו בו.'}
          action={config.spots.length ? <Button variant="primary" icon={Sparkles} onClick={() => setProducing('')}>הפקת גמדים</Button> : <Button variant="primary" onClick={() => navigate({ tab: 'spots' })}>למקומות</Button>}
        />
      ) : view === 'number' ? (
        <NumbersView
          gnomes={[...config.gnomes].sort((a, b) => a.number - b.number).filter((g) => filter === 'all' || needsAttention(g))}
          spotNameOf={(id) => config.spots.find((x) => x.id === id)?.name || 'בלי מקום'}
          riddleCount={riddleCount}
          gnomeStats={gnomeStats}
          missingOf={(g) => isProbablyMissing(g, gnomeStats[g.id], config.status, now)}
          flagOf={flagOf}
          now={now}
          onOpen={setEditingId}
          onToggle={(id, v) => actions.updateGnome(id, { isActive: v })}
        />
      ) : (
        <div className="space-y-8">
          {config.spots.length > 1 && (
            <p className="text-sm text-text-secondary">גררו גמד אל מקום אחר כדי להעביר אותו. בטלפון או בטאבלט פתחו את הגמד ובחרו מקום.</p>
          )}
          {groups.map((grp) => {
            const shown = filter === 'all' ? grp.gnomes : grp.gnomes.filter(needsAttention);
            if (!shown.length && (filter === 'attention' || !grp.id)) return null;
            const spotIssues = issuesBySpot.get(grp.id) || [];
            return (
              <section
                key={grp.id || 'none'}
                id={`spot-${grp.id}`}
                onDragOver={(e) => { if (dragId && grp.id) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOverSpot(grp.id); } }}
                onDragLeave={() => setOverSpot((cur) => (cur === grp.id ? null : cur))}
                onDrop={(e) => { if (dragId && grp.id) { e.preventDefault(); moveTo(dragId, grp.id); } }}
                className={cx('scroll-mt-32 rounded-xl', overSpot === grp.id && grp.id && 'outline-2 outline-dashed outline-offset-8 outline-accent')}
              >
                <div className="mb-3 flex items-center gap-2">
                  <h2 className={cx('font-semibold', !grp.active && 'text-text-secondary line-through')}>{grp.name}</h2>
                  {!grp.active && <Pill>מקום כבוי</Pill>}
                  {grp.outdoor && <OutdoorPill />}
                  {grp.id && grp.active && grp.noHint && (
                    <button
                      type="button"
                      onClick={() => navigate({ tab: 'spots', spotId: grp.id, hint: true })}
                      className="inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 text-sm font-medium text-amber-700 hover:bg-warning/10 dark:text-amber-400"
                    >
                      <TriangleAlert size={14} aria-hidden /> הוסיפו רמז למקום
                    </button>
                  )}
                  {grp.id && (
                    <button type="button" onClick={() => setProducing(grp.id)} className="ms-auto inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary">
                      <Plus size={16} aria-hidden /> גמד כאן
                    </button>
                  )}
                </div>
                {spotIssues.map((i, n) => (
                  <div key={n} className={cx('mb-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm', i.severity === 'error' ? 'bg-danger/10 text-red-700 dark:text-red-400' : 'bg-warning/10 text-amber-700 dark:text-amber-400')}>
                    {i.severity === 'error' ? <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden /> : <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />}
                    {i.message}
                  </div>
                ))}
                {shown.length === 0 ? (
                  <p className="text-sm text-text-secondary">אין כאן גמדים.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {shown.map((g) => (
                      <GnomeCard
                        key={g.id}
                        gnome={g}
                        riddles={riddleCount(g.id)}
                        stats={gnomeStats[g.id]}
                        missing={isProbablyMissing(g, gnomeStats[g.id], config.status, now)}
                        flagged={flagOf(g)}
                        now={now}
                        dragging={dragId === g.id}
                        drag={dragProps(g)}
                        onOpen={() => setEditingId(g.id)}
                        onToggle={(v) => actions.updateGnome(g.id, { isActive: v })}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {editing && (
        <GnomeEditor
          gnome={editing}
          spots={config.spots}
          neighbours={config.gnomes.filter((g) => g.spotId === editing.spotId && g.id !== editing.id && g.isActive)}
          riddles={riddleCount(editing.id)}
          onClose={() => setEditingId(null)}
          onChange={(patch) => actions.updateGnome(editing.id, patch)}
          onDelete={() => {
            actions.deleteGnome(editing.id);
            setEditingId(null);
          }}
          onRiddles={() => navigate({ tab: 'riddles', gnomeId: editing.id })}
        />
      )}

      {producing !== null && (
        <ProduceDialog
          spots={config.spots}
          gnomes={config.gnomes}
          initialSpotId={producing || config.spots[0]?.id || ''}
          onClose={() => setProducing(null)}
          onCreate={(spotId, specs) => {
            const before = Math.max(0, ...config.gnomes.map((g) => g.number));
            actions.addGnomes(spotId, specs);
            setCreated(specs.map((_, i) => before + i + 1));
            setProducing(null);
          }}
        />
      )}
    </div>
  );
}

/** All the gnomes in one grid, ordered by their number (Rani 14.11.2026). Each card says where it stands. */
function NumbersView({
  gnomes, spotNameOf, riddleCount, gnomeStats, missingOf, flagOf, now, onOpen, onToggle,
}: {
  gnomes: TheCodeGnome[];
  spotNameOf: (spotId: string) => string;
  riddleCount: (id: string) => number;
  gnomeStats: Record<string, { scans: number; lastScanAt?: number } | undefined>;
  missingOf: (g: TheCodeGnome) => boolean;
  flagOf: (g: TheCodeGnome) => 'error' | 'warning' | null;
  now: number;
  onOpen: (id: string) => void;
  onToggle: (id: string, v: boolean) => void;
}) {
  if (!gnomes.length) return <p className="text-sm text-text-secondary">אין גמדים להצגה.</p>;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {gnomes.map((g) => (
        <GnomeCard
          key={g.id}
          gnome={g}
          riddles={riddleCount(g.id)}
          stats={gnomeStats[g.id]}
          missing={missingOf(g)}
          flagged={flagOf(g)}
          now={now}
          spotName={spotNameOf(g.spotId)}
          onOpen={() => onOpen(g.id)}
          onToggle={(v) => onToggle(g.id, v)}
        />
      ))}
    </div>
  );
}

export interface GnomeDragProps {
  draggable: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
}

function GnomeCard({
  gnome: g,
  riddles,
  stats,
  missing,
  flagged,
  now,
  spotName,
  dragging,
  drag,
  onOpen,
  onToggle,
}: {
  gnome: TheCodeGnome;
  riddles: number;
  stats?: { scans: number; lastScanAt?: number };
  missing: boolean;
  flagged: 'error' | 'warning' | null;
  now: number;
  /** Shown only in the by-number view, where the places are not the headings. */
  spotName?: string;
  dragging?: boolean;
  drag?: GnomeDragProps;
  onOpen: () => void;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen()}
      {...drag}
      className={cx(
        'flex cursor-pointer items-center gap-3 rounded-xl border bg-bg-card p-3 transition-colors hover:bg-bg-hover',
        flagged === 'error' ? 'border-danger/70' : flagged === 'warning' ? 'border-warning/60' : 'border-border',
        !g.isActive && 'opacity-60',
        dragging && 'opacity-40'
      )}
    >
      <GnomeFigure bodyColor={g.bodyColor} hatColor={g.hatColor} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">#{g.number}</span>
          {g.verifiedOnSite ? (
            <Tip text={TIPS.verified}>
              <Pill tone="success"><BadgeCheck size={14} className="me-0.5 inline" aria-hidden /> אומת</Pill>
            </Tip>
          ) : (
            <Tip text={TIPS.notVerified}>
              <Pill tone="neutral">לא אומת</Pill>
            </Tip>
          )}
        </div>
        <div className="text-sm leading-snug text-text-secondary">{describeGnome(g.bodyColor, g.hatColor)}</div>
        {spotName && <div className="text-sm leading-snug text-text-secondary">{spotName}</div>}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
          {!g.isActive ? (
            <span>כבוי</span>
          ) : (
            stats?.lastScanAt ? (
              <Tip text={TIPS.scans}>
                <span className="flex flex-wrap gap-x-3">
                  <span className="whitespace-nowrap">{stats.scans === 1 ? 'סריקה אחת' : `${stats.scans} סריקות`}</span>
                  <span className="whitespace-nowrap">{timeAgo(stats.lastScanAt, now)}</span>
                </span>
              </Tip>
            ) : (
              <Tip text={TIPS.neverScanned}>
                <span>עוד לא נסרק</span>
              </Tip>
            )
          )}
          {missing && (
            <Tip text={TIPS.missing}>
              <Pill tone="warning">כנראה נעלם</Pill>
            </Tip>
          )}
          {g.isActive && riddles === 0 && (
            <Tip text={TIPS.noRiddle}>
              <Pill tone="warning">בלי חידה</Pill>
            </Tip>
          )}
        </div>
      </div>
      <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <Tip text={TIPS.toggle} interactive>
          <Toggle checked={g.isActive} onChange={onToggle} label={g.isActive ? `כבו את גמד ${g.number}` : `הפעילו את גמד ${g.number}`} size="sm" />
        </Tip>
      </span>
    </div>
  );
}

function GnomeEditor({
  gnome: g,
  spots,
  neighbours,
  riddles,
  onClose,
  onChange,
  onDelete,
  onRiddles,
}: {
  gnome: TheCodeGnome;
  spots: ScreenProps['state']['config']['spots'];
  neighbours: TheCodeGnome[];
  riddles: number;
  onClose: () => void;
  onChange: (patch: Partial<TheCodeGnome>) => void;
  onDelete: () => void;
  onRiddles: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const mySpot = spots.find((s) => s.id === g.spotId);
  const allowed = allowedGnomeColors(mySpot);
  const twin = neighbours.find((n) => comboKey(n) === comboKey(g));
  const alike = neighbours.find((n) => confusableColors(n, g));

  return (
    <Dialog
      open
      onClose={onClose}
      title={`גמד ${g.number}`}
      footer={
        <>
          {confirmDelete ? (
            <>
              <span className="me-auto text-sm text-danger">
                {riddles > 0
                  ? `למחוק את הגמד ואת ${riddles === 1 ? 'החידה שלו' : `${riddles} החידות שלו`}? קבוצות שנשלחו אליו יקבלו את האות מגמד אחר, והלוחית שלו תפסיק לעבוד.`
                  : 'למחוק את הגמד? הלוחית שלו תפסיק לעבוד.'}
              </span>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>ביטול</Button>
              <Button variant="danger" icon={Trash2} onClick={onDelete}>מחקו</Button>
            </>
          ) : (
            <>
              <Button variant="danger" icon={Trash2} className="me-auto" onClick={() => setConfirmDelete(true)}>מחקו</Button>
              <Button variant="primary" onClick={onClose}>סיום</Button>
            </>
          )}
        </>
      }
    >
      <div className="flex items-center gap-6">
        <GnomeFigure bodyColor={g.bodyColor} hatColor={g.hatColor} size={88} number={g.number} />
        <div className="min-w-0">
          <div className="text-lg font-semibold">{describeGnome(g.bodyColor, g.hatColor)}</div>
          <div className="mt-2 space-y-1 text-sm text-text-secondary">
            <div>
              קוד ידני:{' '}
              {g.manualCode ? <span className="font-mono font-semibold text-text-primary" dir="ltr">{g.manualCode}</span> : <span>ממתין לשמירה</span>}
            </div>
            {g.code && <div className="truncate" dir="ltr">/g/{g.code}</div>}
          </div>
        </div>
      </div>

      {(twin || alike) && (
        <div className={cx('mt-4 flex items-start gap-2 rounded-lg px-3 py-2 text-sm', twin ? 'bg-danger/10 text-red-700 dark:text-red-400' : 'bg-warning/10 text-amber-700 dark:text-amber-400')}>
          {twin ? <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden /> : <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />}
          {twin ? `גמד ${twin.number} שעומד לידו נראה בדיוק אותו דבר. בחרו צבעים אחרים.` : `גמד ${alike!.number} שלידו נבדל רק באדום וירוק — עדיף צבע אחר.`}
        </div>
      )}

      <div className="mt-6 space-y-6">
        <Field label="צבע הגוף">
          <ColorPicker label="צבע הגוף" allowed={allowed} value={g.bodyColor} onChange={(c) => onChange({ bodyColor: c })} />
        </Field>
        <Field label="צבע המצנפת">
          <ColorPicker label="צבע המצנפת" allowed={allowed} value={g.hatColor} onChange={(c) => onChange({ hatColor: c })} />
        </Field>
        <Field label="מקום" hint="הקוד של הגמד לא משתנה כשמעבירים אותו.">
          <select className="input select-input" value={g.spotId} onChange={(e) => onChange({ spotId: e.target.value })}>
            {!spots.some((s) => s.id === g.spotId) && <option value={g.spotId}>בחרו מקום</option>}
            {spots.map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.outdoor ? ' (בחוץ)' : ''}</option>
            ))}
          </select>
        </Field>

        <div className="divide-y divide-border rounded-xl border border-border px-4">
          <div className="flex items-center justify-between gap-4 py-3">
            <div>
              <div className="font-medium">פעיל</div>
              <div className="text-sm text-text-secondary">כבוי = שבור או חסר. קבוצות באמצע משחק יקבלו את האות ממקום אחר.</div>
            </div>
            <Toggle checked={g.isActive} onChange={(v) => onChange({ isActive: v })} label="פעיל" />
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <div>
              <div className="font-medium">אומת במקום</div>
              <div className="text-sm text-text-secondary">סומן כשסרקתם אותו במקום שבו הוא עומד.</div>
            </div>
            <Toggle checked={!!g.verifiedOnSite} onChange={(v) => onChange({ verifiedOnSite: v })} label="אומת במקום" />
          </div>
          <button type="button" onClick={onRiddles} className="flex min-h-12 w-full items-center justify-between gap-4 py-3 text-start">
            <span className="flex items-center gap-2 font-medium">
              <CircleHelp size={18} className="text-text-secondary" aria-hidden />
              חידות
            </span>
            <span className={cx('text-sm', riddles ? 'text-text-secondary' : 'text-amber-600 dark:text-amber-400')}>
              {riddles === 0 ? 'אין חידה במשחק — הוסיפו' : riddles === 1 ? 'חידה אחת' : `${riddles} חידות`}
            </span>
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function ProduceDialog({
  spots,
  gnomes,
  initialSpotId,
  onClose,
  onCreate,
}: {
  spots: ScreenProps['state']['config']['spots'];
  gnomes: TheCodeGnome[];
  initialSpotId: string;
  onClose: () => void;
  onCreate: (spotId: string, specs: NewGnomeSpec[]) => void;
}) {
  const [spotId, setSpotId] = useState(initialSpotId);
  const standing = gnomes.filter((g) => g.spotId === spotId && g.isActive);
  const spot = spots.find((s) => s.id === spotId);
  const allowed = allowedGnomeColors(spot);
  /** How many more distinct-looking gnomes a spot can take with the printable colours (max 6 per batch). */
  const capacityAt = (sid: string) =>
    suggestCombos(6, gnomes.filter((g) => g.spotId === sid && g.isActive), false, allowedGnomeColors(spots.find((s) => s.id === sid))).length;
  const capacity = capacityAt(spotId);
  const [count, setCount] = useState(() => Math.max(1, Math.min(capacityAt(initialSpotId), 3 - standing.length)));
  const [specs, setSpecs] = useState<NewGnomeSpec[]>(() => suggestCombos(count, standing, false, allowed));
  const [editRow, setEditRow] = useState<number | null>(null);

  const regenerate = (n: number, sid: string, shuffle = false) => {
    const there = gnomes.filter((g) => g.spotId === sid && g.isActive);
    const take = Math.max(0, Math.min(n, capacityAt(sid)));
    setCount(Math.max(1, take));
    setSpecs(suggestCombos(take, there, shuffle, allowedGnomeColors(spots.find((s) => s.id === sid))));
    setEditRow(null);
  };

  const rowProblem = (i: number): { tone: 'error' | 'warning'; text: string } | null => {
    const s = specs[i];
    const others = [...standing, ...specs.filter((_, j) => j !== i)];
    if (others.some((o) => comboKey(o) === comboKey(s))) return { tone: 'error', text: 'זהה לגמד אחר במקום' };
    if (others.some((o) => confusableColors(o, s))) return { tone: 'warning', text: 'אדום/ירוק ליד גמד אחר' };
    if (s.bodyColor === s.hatColor) return { tone: 'warning', text: 'גוף ומצנפת באותו צבע' };
    return null;
  };
  const blocked = specs.some((_, i) => rowProblem(i)?.tone === 'error');
  const nextNumber = Math.max(0, ...gnomes.map((g) => g.number)) + 1;

  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title="הפקת גמדים"
      footer={
        <>
          {blocked && <span className="me-auto text-sm text-danger">יש שני גמדים זהים באותו מקום.</span>}
          <Button variant="ghost" onClick={onClose}>ביטול</Button>
          <Button variant="primary" disabled={blocked || !specs.length || !spotId || capacity === 0} onClick={() => onCreate(spotId, specs)}>
            {specs.length === 1 ? 'צרו גמד' : `צרו ${specs.length} גמדים`}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <Field label="איפה הם יעמדו">
          <select
            className="input select-input"
            value={spotId}
            onChange={(e) => {
              setSpotId(e.target.value);
              regenerate(count, e.target.value);
            }}
          >
            {spots.map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.outdoor ? ' (בחוץ)' : ''}</option>
            ))}
          </select>
        </Field>
        <Field label="כמה גמדים">
          <Segmented
            label="כמה גמדים"
            value={count}
            onChange={(n) => regenerate(n, spotId)}
            options={[1, 2, 3, 4, 5, 6].slice(0, Math.max(1, capacity)).map((n) => ({ value: n, label: String(n) }))}
          />
        </Field>
      </div>

      {(spot?.outdoor || capacity < 6) && (
        <div className={cx('mt-4 rounded-lg px-3 py-2 text-sm', capacity === 0 ? 'bg-danger/10 text-red-700 dark:text-red-400' : 'bg-bg-secondary text-text-secondary')}>
          {capacity === 0
            ? spot?.outdoor
              ? 'במקום בחוץ מדפיסים רק בשחור ובאפור, וכבר עומדים כאן כל השילובים שאפשר להבדיל ביניהם. העבירו גמד למקום אחר או הוסיפו מקום חדש.'
              : 'כבר עומדים כאן כל השילובים שאפשר להבדיל ביניהם. הוסיפו מקום חדש.'
            : spot?.outdoor
            ? `גמדים בחוץ מודפסים מחומר עמיד לשמש ולגשם, שיש כרגע רק בשחור ובאפור — לכן אפשר להעמיד כאן עוד ${capacity === 1 ? 'גמד אחד' : `${capacity} גמדים`} שנראים שונים.`
            : `עם הצבעים שאפשר להדפיס, אפשר להעמיד כאן עוד ${capacity === 1 ? 'גמד אחד' : `${capacity} גמדים`} שנראים שונים.`}
        </div>
      )}

      {standing.length > 0 && (
        <div className="mt-4 flex items-center gap-2 text-sm text-text-secondary">
          כבר עומדים שם:
          {standing.map((g) => (
            <span key={g.id} className="inline-flex items-center gap-1">
              <GnomeFigure bodyColor={g.bodyColor} hatColor={g.hatColor} size={20} />#{g.number}
            </span>
          ))}
        </div>
      )}

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">הצבעים — הצענו שילובים שקל להבדיל ביניהם</span>
          <button type="button" onClick={() => regenerate(count, spotId, true)} className="text-sm font-medium text-accent hover:underline">הציעו שוב</button>
        </div>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {specs.map((s, i) => {
            const problem = rowProblem(i);
            return (
              <li key={i} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <GnomeFigure bodyColor={s.bodyColor} hatColor={s.hatColor} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">גמד {nextNumber + i}</div>
                    <div className="truncate text-sm text-text-secondary">{describeGnome(s.bodyColor, s.hatColor)}</div>
                  </div>
                  {problem && <Pill tone={problem.tone === 'error' ? 'danger' : 'warning'}>{problem.text}</Pill>}
                  <Button size="sm" variant="ghost" onClick={() => setEditRow(editRow === i ? null : i)}>{editRow === i ? 'סגרו' : 'שנו צבעים'}</Button>
                </div>
                {editRow === i && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="גוף">
                      <ColorPicker label="גוף" allowed={allowed} value={s.bodyColor} onChange={(c) => setSpecs(specs.map((x, j) => (j === i ? { ...x, bodyColor: c } : x)))} />
                    </Field>
                    <Field label="מצנפת">
                      <ColorPicker label="מצנפת" allowed={allowed} value={s.hatColor} onChange={(c) => setSpecs(specs.map((x, j) => (j === i ? { ...x, hatColor: c } : x)))} />
                    </Field>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-sm text-text-secondary">כל גמד יקבל מספר, קוד QR קבוע וקוד ידני קצר להדפסה.</p>
      </div>
    </Dialog>
  );
}
