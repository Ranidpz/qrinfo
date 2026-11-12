'use client';

import { useState } from 'react';
import { Check, Eye, EyeOff, Luggage, Pencil, RefreshCw, Search, Trash2, Trophy, X } from 'lucide-react';
import type { AdminPlayer, ScreenProps } from './model';
import { timeAgo } from './helpers';
import { Button, Card, EmptyState, IconButton, Pill, ScreenHeader, Segmented, cx } from './ui';

export default function PlayersScreen({ state, actions, now, refresh }: ScreenProps) {
  const [removing, setRemoving] = useState<{ id: string; step: 1 | 2 } | null>(null);
  const [period, setPeriod] = useState<'week' | 'all'>('week');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

  const pts = (p: AdminPlayer) => (period === 'week' ? p.weekPoints : p.points);
  const bags = (p: AdminPlayer) => (period === 'week' ? p.weekSuitcases : p.suitcases);
  const q = query.trim();
  const list = state.players
    .filter((p) => (period === 'all' ? true : p.weekPoints > 0))
    .filter((p) => !q || p.familyName.includes(q) || p.originalName?.includes(q))
    .sort((a, b) => pts(b) - pts(a));
  const hidden = state.players.filter((p) => p.hidden).length;

  // Board rank skips hidden players, like the public leaderboard will.
  let rank = 0;

  return (
    <div className="mx-auto max-w-3xl">
      <ScreenHeader
        title="קבוצות"
        summary={`${state.players.length} קבוצות שיחקו${hidden ? `, ${hidden} מוסתרות מהלוח` : ''}. רק כינוי ואימוג׳י — בלי שמות מלאים ובלי טלפונים.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {refresh && (
              <Button icon={RefreshCw} onClick={refresh.run} disabled={refresh.busy} className={refresh.busy ? '[&_svg]:animate-spin' : ''}>
                {refresh.busy ? 'מרעננים…' : 'רעננו'}
              </Button>
            )}
            <Segmented label="תקופה" value={period} onChange={setPeriod} options={[{ value: 'week', label: 'השבוע' }, { value: 'all', label: 'מאז ומעולם' }]} />
          </div>
        }
      />

      {state.players.length > 0 && (
        <div className="relative mb-4">
          <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-text-secondary" aria-hidden />
          <input className="input ps-9" placeholder="חפשו קבוצה" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title={state.players.length ? (q ? 'לא נמצאה קבוצה' : 'אף קבוצה לא שיחקה השבוע') : 'עוד אף קבוצה לא שיחקה'}
          text={state.players.length ? undefined : 'אחרי שתפרסמו וקבוצות יסרקו את הגמד הראשון, הן יופיעו כאן.'}
        />
      ) : (
        <Card className="divide-y divide-border">
          {list.map((p) => {
            const r = p.hidden ? null : ++rank;
            return (
              <div key={p.id} className={cx('flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap', p.hidden && 'bg-bg-secondary')}>
                <span className={cx('w-6 shrink-0 text-center font-semibold tabular-nums', r && r <= 3 ? 'text-accent' : 'text-text-secondary')}>{r ?? '–'}</span>
                <span className={cx('text-2xl', p.hidden && 'opacity-40')} aria-hidden>{p.emoji}</span>
                <div className="min-w-0 flex-1">
                  {editing === p.id ? (
                    <RenameInput
                      initial={p.familyName}
                      onSave={(name) => {
                        if (name.trim()) actions.updatePlayer(p.id, { familyName: name.trim() });
                        setEditing(null);
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <>
                      <div className={cx('flex flex-wrap items-center gap-x-2 gap-y-1 font-medium', p.hidden && 'text-text-secondary')}>
                        <span className="min-w-0 break-words">{p.familyName}</span>
                        {p.hidden && <Pill>מוסתר מהלוח</Pill>}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 text-sm text-text-secondary">
                        <span className="inline-flex items-center gap-1"><Luggage size={14} aria-hidden />{bags(p)}</span>
                        <span>{timeAgo(p.lastSeenAt, now)}</span>
                        {p.originalName && <span className="truncate">נרשמו בשם: {p.originalName}</span>}
                      </div>
                    </>
                  )}
                </div>
                <span className="shrink-0 text-xl font-bold tabular-nums">{pts(p)}</span>
                {editing !== p.id && removing?.id !== p.id && (
                  <div className="flex shrink-0">
                    <IconButton icon={Pencil} label="שנו שם" onClick={() => setEditing(p.id)} />
                    <IconButton icon={p.hidden ? Eye : EyeOff} label={p.hidden ? 'הציגו בלוח' : 'הסתירו מהלוח'} onClick={() => actions.updatePlayer(p.id, { hidden: !p.hidden })} />
                    <IconButton icon={Trash2} label="הסירו קבוצה" onClick={() => setRemoving({ id: p.id, step: 1 })} />
                  </div>
                )}
                {removing?.id === p.id && (
                  <div className="basis-full rounded-lg bg-danger/5 px-3 py-2 text-sm sm:basis-auto">
                    <div className="text-red-700 dark:text-red-400">
                      {removing.step === 1
                        ? `להסיר את "${p.familyName}"? הנקודות, המזוודות וההתקדמות שלה יימחקו.`
                        : 'בטוחים? אי אפשר לבטל את זה, והקבוצה תצטרך להירשם מחדש.'}
                    </div>
                    <div className="mt-2 flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setRemoving(null)}>ביטול</Button>
                      {removing.step === 1 ? (
                        <Button size="sm" variant="danger" onClick={() => setRemoving({ id: p.id, step: 2 })}>הסירו</Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="danger"
                          icon={Trash2}
                          onClick={() => {
                            actions.deletePlayer(p.id);
                            setRemoving(null);
                          }}
                        >
                          כן, הסירו לתמיד
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

function RenameInput({ initial, onSave, onCancel }: { initial: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [v, setV] = useState(initial);
  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        className="input py-2"
        value={v}
        maxLength={24}
        aria-label="שם חדש"
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(v);
          if (e.key === 'Escape') onCancel();
        }}
      />
      <IconButton icon={Check} label="שמרו" onClick={() => onSave(v)} />
      <IconButton icon={X} label="ביטול" onClick={onCancel} />
    </div>
  );
}
