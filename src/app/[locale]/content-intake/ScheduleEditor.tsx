'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarDays, Check, Clock3, Plus, Trash2, X } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { validateChecks, type IntakeCheck, type IntakeSchedule } from '@/lib/content-intake/schedule';

type Agent = { id: string; scheduleRevision?: string | null; scheduleSyncedAt?: string | null };
type DayGroup = { days: number[]; times: string[] };
// Preserve independent schedules already saved by grouping only identical sets of times.
function groupChecks(checks: IntakeCheck[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (let day = 0; day < 7; day++) {
    const times = checks.filter(c => c.weekday === day).map(c => c.time).sort();
    if (!times.length) continue;
    const existing = groups.find(g => JSON.stringify(g.times) === JSON.stringify(times));
    if (existing) existing.days.push(day); else groups.push({ days: [day], times });
  }
  return groups;
}
export default function ScheduleEditor({ ownerId, agents }: { ownerId: string; agents: Agent[] }) {
  const t = useTranslations('contentIntake');
  const locale = useLocale();
  const [saved, setSaved] = useState<IntakeSchedule | null>(null);
  const [groups, setGroups] = useState<DayGroup[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const endpoint = `/api/content-intake/settings?ownerId=${encodeURIComponent(ownerId)}`;
  useEffect(() => {
    const controller = new AbortController();
    fetchWithAuth(endpoint, { signal: controller.signal }).then(async res => {
      if (!res.ok) throw new Error('LOAD_FAILED');
      const data: IntakeSchedule = await res.json();
      if (!controller.signal.aborted) { setSaved(data); setGroups(groupChecks(data.checks)); }
    }).catch(() => { if (!controller.signal.aborted) setError('error'); });
    return () => controller.abort();
  }, [endpoint]);
  function change(index: number, patch: Partial<DayGroup>) {
    setGroups(previous => previous.map((g, i) => i === index ? { ...g, ...patch } : g)); setSuccess(false);
  }
  const checks = groups.flatMap(g => g.days.flatMap(weekday => g.times.map(time => ({ weekday, time }))));
  const valid = groups.every(g => g.days.length && g.times.length) ? validateChecks(checks) : null;
  const changed = JSON.stringify(valid) !== JSON.stringify(saved && validateChecks(saved.checks));
  async function save() {
    if (!valid) return;
    setBusy(true); setError(''); setSuccess(false);
    try {
      const res = await fetchWithAuth(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ checks: valid, revision: saved?.revision }) });
      if (!res.ok) { setError(res.status === 409 ? 'scheduleConflict' : 'error'); return; }
      const data: IntakeSchedule = await res.json(); setSaved(data); setGroups(groupChecks(data.checks)); setSuccess(true);
    } catch { setError('error'); } finally { setBusy(false); }
  }
  function addTime(index: number) {
    const times = groups[index].times;
    const next = ['10:05', '12:00', '14:00', '16:00', ...Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`)].find(time => !times.includes(time));
    if (next) change(index, { times: [...times, next] });
  }
  return <section aria-labelledby="weekly-schedule-title" className="rounded-2xl border border-border bg-bg-secondary p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="weekly-schedule-title" className="flex items-center gap-2 text-lg font-semibold"><CalendarDays size={20} className="text-accent" />{t('scheduleTitle')}</h2>
      <span className="rounded-full bg-bg-primary px-3 py-1 text-xs text-text-secondary">{t('israelTime')}</span>
    </div>
    <p className="mt-3 text-sm text-text-secondary">{t('scheduleIntro')}</p>
    {error && <p role="alert" className="my-3 text-red-500">{t(error)}</p>}
    {!saved ? <p className="mt-4">{t('loading')}</p> : <>
      <div className="mt-6 space-y-6">{groups.map((group, i) => <div key={i} className={groups.length > 1 ? 'rounded-xl border border-border p-3 sm:p-4' : ''}>
        {groups.length > 1 && <div className="mb-4 flex items-center justify-between"><h3 className="font-medium">{t('scheduleGroup', { number: i + 1 })}</h3><button disabled={busy} className="rounded-lg p-2 text-text-secondary hover:bg-red-500/10 hover:text-red-500" aria-label={t('removeScheduleGroup', { number: i + 1 })} onClick={() => { setGroups(groups.filter((_, n) => n !== i)); setSuccess(false); }}><Trash2 size={16} /></button></div>}
        <fieldset disabled={busy}>
          <legend className="mb-3 text-sm font-medium">{t('chooseDays')}</legend>
          <div className="grid grid-cols-7 gap-1.5 sm:gap-3">{[0,1,2,3,4,5,6].map(day => {
            const selected = group.days.includes(day);
            const occupied = groups.some((g, n) => n !== i && g.days.includes(day));
            return <button key={day} type="button" aria-label={t(`weekday${day}`)} aria-pressed={selected} disabled={occupied} title={occupied ? t('dayInOtherGroup') : t(`weekday${day}`)} onClick={() => change(i, { days: selected ? group.days.filter(d => d !== day) : [...group.days, day].sort() })} className={`flex min-h-20 min-w-0 flex-col items-center justify-center gap-2 rounded-xl border px-1 py-3 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-30 ${selected ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-bg-primary text-text-secondary hover:border-accent/50'}`}>
              <span className="text-sm font-medium sm:hidden">{t(`weekdayShort${day}`)}</span><span className="hidden text-sm font-medium sm:inline">{t(`weekday${day}`)}</span>
              <span aria-hidden="true" className={`flex h-5 w-5 items-center justify-center rounded-full ${selected ? 'bg-accent text-white' : 'border border-border'}`}>{selected && <Check size={13} strokeWidth={3} />}</span>
            </button>;
          })}</div>
        </fieldset>
        <fieldset disabled={busy} className="mt-6">
          <legend className="mb-3 flex items-center gap-2 text-sm font-medium"><Clock3 size={16} className="text-text-secondary" />{t('chooseTimes')}</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{group.times.map((time, n) => <div key={n} className="flex min-w-0 items-center gap-1 rounded-xl border border-border bg-bg-primary px-2 py-2 sm:px-3">
            <label className="sr-only" htmlFor={`time-${i}-${n}`}>{t('groupTime', { group: i + 1, number: n + 1 })}</label>
            <input id={`time-${i}-${n}`} type="time" dir="ltr" required value={time} onChange={e => change(i, { times: group.times.map((value, k) => k === n ? e.target.value : value) })} className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-2 text-center text-base font-medium tabular-nums text-text-primary outline-none focus:ring-2 focus:ring-accent [color-scheme:light] dark:[color-scheme:dark]" />
            <button type="button" disabled={group.times.length === 1} className="shrink-0 rounded-md p-1.5 text-text-secondary hover:bg-red-500/10 hover:text-red-500 disabled:opacity-25" aria-label={t('removeTime', { group: i + 1, number: n + 1 })} onClick={() => change(i, { times: group.times.filter((_, k) => k !== n) })}><X size={16} /></button>
          </div>)}<button type="button" disabled={checks.length + group.days.length > 28 || group.times.length >= 27} className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-dashed border-accent/40 px-3 py-3 text-sm text-accent hover:bg-accent/10 disabled:opacity-40" onClick={() => addTime(i)}><Plus size={17} />{t('addTime')}</button></div>
          <p className="mt-3 text-xs text-text-secondary">{t('sameTimesForDays')}</p>
        </fieldset>
      </div>)}</div>
      <div className="mt-5"><button disabled={busy || new Set(groups.flatMap(g => g.days)).size === 7 || groups.some(g => !g.days.length)} className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent disabled:opacity-40" onClick={() => { setGroups([...groups, { days: [], times: ['10:05'] }]); setSuccess(false); }}><Plus size={15} />{t('addDayGroup')}</button></div>
      {!valid && <p role="alert" className="mt-3 text-sm text-red-500">{t('invalidGroupedSchedule')}</p>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
        <p className="max-w-xl text-xs leading-relaxed text-text-secondary">{t('scheduleSyncHint')}</p>
        <button disabled={busy || !valid || !changed} className="w-full shrink-0 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white disabled:opacity-40 sm:w-auto" onClick={save}>{busy ? t('working') : t('saveSchedule')}</button>
      </div>
      {success && <p role="status" className="mt-3 text-sm text-accent">{t('scheduleSaved')}</p>}
      <div className="mt-4 space-y-2 text-xs text-text-secondary">{!agents.length && <p>{t('scheduleNoAck')}</p>}{agents.map(a => <p key={a.id}><bdi>{a.id}</bdi> · {t(a.scheduleRevision === saved.revision ? 'scheduleApplied' : 'schedulePending')}{a.scheduleSyncedAt && <> · {new Date(a.scheduleSyncedAt).toLocaleString(locale === 'he' ? 'he-IL' : 'en-US', { timeZone: 'Asia/Jerusalem' })}</>}</p>)}</div>
    </>}
  </section>;
}
