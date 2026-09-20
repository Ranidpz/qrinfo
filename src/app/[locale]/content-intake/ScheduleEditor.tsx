'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { validateChecks, type IntakeCheck, type IntakeSchedule } from '@/lib/content-intake/schedule';

type Agent = { id: string; scheduleRevision?: string | null; scheduleSyncedAt?: string | null };
export default function ScheduleEditor({ ownerId, agents }: { ownerId: string; agents: Agent[] }) {
  const t = useTranslations('contentIntake');
  const locale = useLocale();
  const [saved, setSaved] = useState<IntakeSchedule | null>(null);
  const [checks, setChecks] = useState<IntakeCheck[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const endpoint = `/api/content-intake/settings?ownerId=${encodeURIComponent(ownerId)}`;
  useEffect(() => {
    const controller = new AbortController();
    fetchWithAuth(endpoint, { signal: controller.signal }).then(async res => {
      if (!res.ok) throw new Error('LOAD_FAILED');
      const data: IntakeSchedule = await res.json();
      if (!controller.signal.aborted) { setSaved(data); setChecks(data.checks); }
    }).catch(() => { if (!controller.signal.aborted) setError('error'); });
    return () => controller.abort();
  }, [endpoint]);
  function change(index: number, patch: Partial<IntakeCheck>) {
    setChecks(previous => previous.map((c, i) => i === index ? { ...c, ...patch } : c)); setSuccess(false);
  }
  async function save() {
    setBusy(true); setError(''); setSuccess(false);
    try {
      const res = await fetchWithAuth(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ checks, revision: saved?.revision }) });
      if (!res.ok) { setError(res.status === 409 ? 'scheduleConflict' : 'error'); return; }
      const data: IntakeSchedule = await res.json(); setSaved(data); setChecks(data.checks); setSuccess(true);
    } catch { setError('error'); } finally { setBusy(false); }
  }
  const valid = validateChecks(checks);
  const changed = JSON.stringify(valid) !== JSON.stringify(saved?.checks);
  return <section className="rounded-2xl border border-border bg-bg-secondary p-5 sm:p-6">
    <h2 className="text-lg font-semibold">{t('scheduleTitle')}</h2>
    <p className="my-3 text-sm text-text-secondary">{t('scheduleHint')}</p>
    {error && <p role="alert" className="my-3 text-red-500">{t(error)}</p>}
    {!saved ? <p>{t('loading')}</p> : <>
      <div className="space-y-3">{checks.map((check, i) => <div key={i} className="flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor={`check-day-${i}`}>{t('checkDay', { number: i + 1 })}</label>
        <select id={`check-day-${i}`} disabled={busy} className="rounded-lg border border-border bg-bg-primary p-3" value={check.weekday} onChange={e => change(i, { weekday: Number(e.target.value) })}>
          {[0,1,2,3,4,5,6].map(day => <option value={day} key={day}>{t(`weekday${day}`)}</option>)}
        </select>
        <label className="sr-only" htmlFor={`check-time-${i}`}>{t('checkTime', { number: i + 1 })}</label>
        <input id={`check-time-${i}`} type="time" dir="ltr" required disabled={busy} value={check.time} onChange={e => change(i, { time: e.target.value })} className="min-w-0 rounded-lg border border-border bg-bg-primary p-3" />
        <button disabled={busy || checks.length === 1} className="text-sm text-red-500 disabled:opacity-40" aria-label={t('removeCheckNumber', { number: i + 1 })} onClick={() => { setChecks(checks.filter((_, n) => n !== i)); setSuccess(false); }}>{t('removeCheck')}</button>
      </div>)}</div>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button disabled={busy || checks.length >= 28} className="text-accent disabled:opacity-40" onClick={() => { setChecks([...checks, { weekday: 0, time: '10:05' }]); setSuccess(false); }}>{t('addCheck')}</button>
        <button disabled={busy || !valid || !changed} className="rounded-lg bg-accent px-4 py-3 text-white disabled:opacity-40" onClick={save}>{busy ? t('working') : t('saveSchedule')}</button>
      </div>
      {!valid && <p role="alert" className="mt-3 text-red-500">{t('invalidSchedule')}</p>}
      {success && <p role="status" className="mt-3 text-accent">{t('scheduleSaved')}</p>}
      <div className="mt-4 space-y-2 text-sm text-text-secondary">{!agents.length && <p>{t('scheduleNoAck')}</p>}{agents.map(a => <p key={a.id}><bdi>{a.id}</bdi> · {t(a.scheduleRevision === saved.revision ? 'scheduleApplied' : 'schedulePending')}{a.scheduleSyncedAt && <> · {new Date(a.scheduleSyncedAt).toLocaleString(locale === 'he' ? 'he-IL' : 'en-US', { timeZone: 'Asia/Jerusalem' })}</>}</p>)}</div>
    </>}
  </section>;
}
