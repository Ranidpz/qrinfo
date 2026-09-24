'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Download, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

import ScheduleEditor from './ScheduleEditor';
import ComputerList, { type IntakeComputer } from './ComputerList';

type Owner = { id: string; name: string; email: string; targets: { shortId: string; title: string }[] };
type Connection = { id: string; name: string; disabled?: boolean; revoked: boolean };
type Agent = IntakeComputer;
type Data = { owners: Owner[]; connections: Connection[]; agents: Agent[] };
const endpoint = '/api/content-intake/connections';
const panel = 'rounded-2xl border border-border bg-bg-secondary p-5 sm:p-6';
const button = 'inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-white disabled:opacity-50 disabled:cursor-not-allowed';

export default function ContentIntakePage() {
  const { user, loading: authLoading } = useAuth();
  const t = useTranslations('contentIntake');
  if (authLoading) return <p role="status">{t('loading')}</p>;
  if (!user) return <p>{t('signIn')}</p>;
  if (user.role !== 'super_admin') return <p role="alert">{t('adminOnly')}</p>;
  return <ContentIntake key={user.id} />;
}
function ContentIntake() {
  const { user } = useAuth();
  const t = useTranslations('contentIntake');
  const [data, setData] = useState<Data>({ owners: [], connections: [], agents: [] });
  const [ownerId, setOwnerId] = useState('');
  const [name, setName] = useState('');
  const [secret, setSecret] = useState<{ key: string; ownerEmail: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const owner = data.owners.find(o => o.id === ownerId);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const res = await fetchWithAuth(`${endpoint}${ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : ''}`, { signal });
    if (!res.ok) throw new Error('LOAD_FAILED');
    const result: Data = await res.json();
    if (signal?.aborted) return;
    setData(result);
    if (!ownerId && result.owners.length) setOwnerId(result.owners[0].id);
  }, [ownerId]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    refresh(controller.signal).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [user, refresh]);
  async function create() {
    setBusy(true); setError(false); setCopied(false);
    try {
      const res = await fetchWithAuth(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ownerId, name }) });
      if (!res.ok) throw new Error('CREATE_FAILED');
      setSecret(await res.json());
      await refresh();
    } catch { setError(true); } finally { setBusy(false); }
  }
  async function revoke(id: string) {
    setBusy(true); setError(false);
    try {
      const res = await fetchWithAuth(endpoint, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (!res.ok) throw new Error('REVOKE_FAILED');
      setSecret(null); setRevoking(null); await refresh();
    } catch { setError(true); } finally { setBusy(false); }
  }
  function downloadConnection() {
    if (!secret) return;
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, ownerEmail: secret.ownerEmail, contentIntakeApiKey: secret.key }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'TheQ-connection.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="mx-auto max-w-5xl space-y-6 text-text-primary">
    <header>
      <h1 className="text-2xl font-bold">{t('title')}</h1><p className="mt-2 text-text-secondary">{t('intro')}</p>
    </header>
    <section className={panel} aria-labelledby="workflow-title">
      <h2 id="workflow-title" className="mb-4 text-lg font-semibold">{t('flowTitle')}</h2>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {['Group', 'Mapping', 'Schedule', 'Report'].map((step, index) => <li key={step} className="rounded-xl border border-border bg-bg-primary p-4">
          <span aria-hidden="true" className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 font-semibold text-accent">{index + 1}</span>
          <h3 className="mb-2 font-semibold">{t(`flow${step}Title`)}</h3><p className="text-sm leading-relaxed text-text-secondary">{t(`flow${step}Text`)}</p>
        </li>)}
      </ol>
      <p className="mt-4 text-sm leading-relaxed text-text-secondary">{t('flowRequirements')}</p>
      <p className="mt-3 rounded-lg bg-accent/10 p-3 text-sm leading-relaxed">{t('flowFollowups')}</p>
    </section>
    {error && <p role="alert" className="rounded-lg bg-red-500/10 p-4 text-red-500">{t('error')}</p>}
    <div className="grid gap-6 lg:grid-cols-2">
      <section className={panel} aria-labelledby="connection-title">
        <h2 id="connection-title" className="mb-4 flex items-center gap-2 text-lg font-semibold"><KeyRound size={20} />{t('connectionTitle')}</h2>
        <p className="mb-4 text-sm leading-relaxed text-text-secondary">{t('currentAvailability')}</p>
        {loading ? <p role="status">{t('loading')}</p> : data.owners.length === 0 ? <p>{t('noOwners')}</p> : <>
          <label className="block text-sm" htmlFor="intake-owner">{t('owner')}</label>
          <div className="relative mt-2"><select id="intake-owner" value={ownerId} disabled={busy || !!secret} onChange={e => setOwnerId(e.target.value)} className="w-full appearance-none rounded-lg border border-border bg-bg-primary py-3 ps-3 pe-10">
            {data.owners.map(o => <option key={o.id} value={o.id}>{o.name} — {o.email}</option>)}
          </select><ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-text-secondary" /></div>
          <details className="my-4 text-sm text-text-secondary"><summary className="cursor-pointer">{t('scope', { count: owner?.targets.length || 0 })}</summary><ul className="mt-2 space-y-1">{owner?.targets.map(v => <li key={v.shortId}>{v.title}</li>)}</ul></details>
          <label htmlFor="intake-name" className="block text-sm">{t('computerName')}</label>
          <input id="intake-name" maxLength={80} value={name} disabled={busy || !!secret} onChange={e => setName(e.target.value)} placeholder={t('computerPlaceholder')} className="mt-2 mb-4 w-full rounded-lg border border-border bg-bg-primary p-3" />
          {!secret && <button className={button} disabled={busy || !name.trim() || !owner} onClick={create}>{busy ? t('working') : t('create')}</button>}
        </>}
        {secret && <div className="mt-4 space-y-3 rounded-xl border border-accent/40 p-4">
          <p className="text-sm">{t('once')}</p>
          <label htmlFor="intake-key" className="sr-only">{t('key')}</label><input id="intake-key" type="password" readOnly value={secret.key} dir="ltr" autoComplete="off" className="w-full rounded border border-border bg-bg-primary p-2 font-mono" />
          <div className="flex flex-wrap gap-3"><button className={button} onClick={downloadConnection}><Download size={16} />{t('downloadConnection')}</button>
          <button className="text-accent" onClick={async () => { try { await navigator.clipboard.writeText(secret.key); setCopied(true); } catch { setError(true); } }}>{copied ? t('copied') : t('copy')}</button>
          <button className="text-text-secondary" onClick={() => setSecret(null)}>{t('saved')}</button></div>
        </div>}
      </section>
      <section className={panel} aria-labelledby="download-title">
        <h2 id="download-title" className="mb-4 flex items-center gap-2 text-lg font-semibold"><Download size={20} />{t('downloadTitle')}</h2>
        <p className="mb-5 text-text-secondary">{t('downloadDescription')}</p>
        <a className={button} href="/downloads/TheQ-WhatsApp-Agent-0.7.2.zip" download>{t('downloadMac')}</a>
        <p className="mt-3 text-xs text-text-secondary">{t('requirements')}</p>
        <a className="mt-3 block text-sm text-accent underline" href="/downloads/TheQ-WhatsApp-Agent-0.7.2.zip.sha256" download>{t('checksum')}</a>
      </section>
    </div>
    {ownerId && <ScheduleEditor key={ownerId} ownerId={ownerId} agents={data.agents} />}
    <section className={panel}>
      <div className="mb-4 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck size={20} />{t('statusTitle')}</h2><button disabled={busy || loading} className="inline-flex items-center gap-2 text-accent" onClick={() => { setError(false); refresh().catch(() => setError(true)); }}><RefreshCw size={16} />{t('refresh')}</button></div>
      <p className="mb-4 text-sm text-text-secondary">{t('statusHint')}</p>
      <ComputerList computers={data.agents} refresh={refresh} />
      <ul className="mt-4 divide-y divide-border">{data.connections.map(c => <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span>{c.name} · {c.revoked ? t('revoked') : c.disabled ? t('connectionPaused') : t('active')}</span>{!c.revoked && (revoking === c.id ? <div className="flex flex-wrap items-center gap-3 text-sm"><span>{t('revokeWarning')}</span><button disabled={busy} className="text-red-500" onClick={() => revoke(c.id)}>{t('confirmRevoke')}</button><button disabled={busy} onClick={() => setRevoking(null)}>{t('cancel')}</button></div> : <button disabled={busy} className="text-sm text-red-500" onClick={() => setRevoking(c.id)}>{t('revoke')}</button>)}</li>)}</ul>
    </section>
    <section className={panel}><h2 className="mb-3 text-lg font-semibold">{t('filenameTitle')}</h2><p className="text-text-secondary">{t('filenameStandard')}</p><p className="my-3 break-words rounded-lg bg-bg-primary p-3">{t('filenameExample')}</p><p className="text-sm text-text-secondary">{t('filenameCompatibility')}</p></section>
    <section className={panel}><h2 className="mb-4 text-lg font-semibold">{t('instructions')}</h2>
      <ol className="list-decimal space-y-4 ps-5 text-text-secondary">{['nativeStep1','nativeStep2','nativeStep3'].map(k => <li key={k}>{t(k)}</li>)}</ol>
      <p className="mt-5 rounded-lg bg-accent/10 p-4 text-sm">{t('nativePower')}</p>
      <p className="mt-3 text-sm text-text-secondary">{t('nativeSigning')}</p>
      <p className="mt-3 text-sm text-text-secondary">{t('nativeUpgrade')}</p>
    </section>

  </div>;
}
