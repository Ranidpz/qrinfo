'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Monitor, Unplug } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
export type IntakeComputer = { id: string; recordId: string; computerName?: string; state?: string; updatedAt: string | null; lastSeenAt?: string | null; runnerVersion?: string | null; scheduleEnabled?: boolean; autoCommit?: boolean; disabled?: boolean; remoteControl?: boolean; scheduleRevision?: string | null; scheduleSyncedAt?: string | null };
export default function ComputerList({ computers, refresh }: { computers: IntakeComputer[]; refresh: () => Promise<void> }) {
  const t = useTranslations('contentIntake');
  const locale = useLocale();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function control(computer: IntakeComputer) {
    setBusy(true); setError(false);
    try {
      const res = await fetchWithAuth('/api/content-intake/computers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: computer.recordId, action: computer.disabled ? 'reconnect' : 'disconnect' }) });
      if (!res.ok) throw new Error('CONTROL_FAILED');
      await refresh(); setConfirming(null);
    } catch { setError(true); } finally { setBusy(false); }
  }
  const format = (value: string) => new Date(value).toLocaleString(locale === 'he' ? 'he-IL' : 'en-US', { timeZone: 'Asia/Jerusalem' });
  return <div className="space-y-3">
    {error && <p role="alert" className="text-sm text-red-500">{t('computerControlError')}</p>}
    {!computers.length && <p className="text-text-secondary">{t('noAgent')}</p>}
    {computers.map(a => {
      const recent = !!a.lastSeenAt && Date.now() - Date.parse(a.lastSeenAt) < 10 * 60 * 1000;
      const status = a.disabled ? 'computerDisconnected' : !recent ? 'computerStale' : !a.scheduleEnabled ? 'computerPaused' : a.autoCommit ? 'computerAutomatic' : 'computerPreview';
      return <article key={a.id} aria-label={a.computerName || a.id} className="rounded-xl border border-border bg-bg-primary p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3"><Monitor className="mt-1 shrink-0 text-text-secondary" size={22} /><div className="min-w-0"><h3 className="break-words font-medium"><bdi>{a.computerName || a.id}</bdi></h3><p className={`mt-1 text-xs ${a.disabled ? 'text-red-400' : recent ? 'text-accent' : 'text-text-secondary'}`}>{t(status)}</p></div></div>
          {a.remoteControl ? <button disabled={busy} className={`inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm ${a.disabled ? 'text-accent' : 'text-red-400 hover:bg-red-500/10'}`} onClick={() => setConfirming(a.recordId)}><Unplug size={15} />{t(a.disabled ? 'reconnectComputer' : 'disconnectComputer')}</button> : <p className="text-xs text-text-secondary">{t('computerUpgradeRequired')}</p>}
        </div>
        <dl className="mt-4 grid gap-3 text-xs text-text-secondary sm:grid-cols-3"><div><dt>{t('computerLastContact')}</dt><dd className="mt-1 text-text-primary">{a.lastSeenAt ? format(a.lastSeenAt) : '—'}</dd></div><div><dt>{t('computerVersion')}</dt><dd className="mt-1 text-text-primary">{a.runnerVersion || '—'}</dd></div><div><dt>{t('computerLastRun')}</dt><dd className="mt-1 text-text-primary">{a.updatedAt ? `${t(['ready','review_required','no_files','run_failed','login_required'].includes(a.state || '') ? `state_${a.state}` : 'state_unknown')} · ${format(a.updatedAt)}` : '—'}</dd></div></dl>
        <div className="mt-4 border-t border-border pt-3 text-xs"><p className="mb-2 text-text-secondary">{t('downloadFolder')}</p><code dir="ltr" className="block break-all rounded-lg bg-bg-secondary p-2 text-text-primary">{`~/Library/Application Support/TheQContentIntake/${a.id}/downloads`}</code><p className="mt-2 text-text-secondary">{t('downloadRetention')}</p></div>
        {confirming === a.recordId && <div className="mt-4 space-y-3 rounded-lg border border-border p-3 text-sm"><p>{t(a.disabled ? 'reconnectComputerWarning' : 'disconnectComputerWarning')}</p><div className="flex flex-wrap gap-4"><button disabled={busy} className={a.disabled ? 'text-accent' : 'text-red-400'} onClick={() => control(a)}>{t(a.disabled ? 'confirmReconnectComputer' : 'confirmDisconnectComputer')}</button><button disabled={busy} className="text-text-secondary" onClick={() => setConfirming(null)}>{t('cancel')}</button></div></div>}
      </article>;
    })}
  </div>;
}
