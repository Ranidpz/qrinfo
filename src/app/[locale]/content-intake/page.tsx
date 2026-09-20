'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Download, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

type Owner = { id: string; name: string; email: string; targets: { shortId: string; title: string }[] };
type Connection = { id: string; name: string; revoked: boolean };
type Agent = { id: string; state: string; updatedAt: string | null };
type Data = { owners: Owner[]; connections: Connection[]; agents: Agent[] };
const endpoint = '/api/content-intake/connections';
const panel = 'rounded-2xl border border-border bg-bg-secondary p-5 sm:p-6';
const button = 'inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-white disabled:opacity-50 disabled:cursor-not-allowed';

export default function ContentIntakePage() {
  const { user, loading: authLoading } = useAuth();
  const t = useTranslations('contentIntake');
  const locale = useLocale();
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
  if (authLoading) return <p role="status">{t('loading')}</p>;
  if (!user) return <p>{t('signIn')}</p>;
  return <div className="mx-auto max-w-5xl space-y-6 text-text-primary">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-bold">{t('title')}</h1><p className="mt-2 max-w-2xl text-text-secondary">{t('intro')}</p></div>
      <span className="rounded-full bg-accent/10 px-3 py-1 text-sm text-accent">{t('workflow')}</span>
    </header>
    {error && <p role="alert" className="rounded-lg bg-red-500/10 p-4 text-red-500">{t('error')}</p>}
    <div className="grid gap-6 lg:grid-cols-2">
      <section className={panel} aria-labelledby="connection-title">
        <h2 id="connection-title" className="mb-4 flex items-center gap-2 text-lg font-semibold"><KeyRound size={20} />{t('connectionTitle')}</h2>
        {loading ? <p role="status">{t('loading')}</p> : data.owners.length === 0 ? <p>{t('noOwners')}</p> : <>
          <label className="block text-sm" htmlFor="intake-owner">{t('owner')}</label>
          <select id="intake-owner" value={ownerId} disabled={busy || !!secret} onChange={e => setOwnerId(e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-bg-primary p-3">
            {data.owners.map(o => <option key={o.id} value={o.id}>{o.name} — {o.email}</option>)}
          </select>
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
        <a className={button} href="/downloads/TheQ-WhatsApp-Intake-0.3.1.zip" download>{t('downloadMac')}</a>
        <p className="mt-3 text-xs text-text-secondary">{t('requirements')}</p>
        <a className="mt-3 block text-sm text-accent underline" href="/downloads/TheQ-WhatsApp-Intake-0.3.1.zip.sha256" download>{t('checksum')}</a>
      </section>
    </div>
    <section className={panel}><h2 className="mb-4 text-lg font-semibold">{t('instructions')}</h2>
      <ol className="list-decimal space-y-4 ps-5 text-text-secondary">{['step1','step2','step3','step4','step5','step6'].map(k => <li key={k}>{t(k)}</li>)}</ol>
      <p className="mt-5 rounded-lg bg-accent/10 p-4 text-sm">{t('schedule')}</p>
    </section>
    <section className={panel}>
      <div className="mb-4 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck size={20} />{t('statusTitle')}</h2><button disabled={busy || loading} className="inline-flex items-center gap-2 text-accent" onClick={() => { setError(false); refresh().catch(() => setError(true)); }}><RefreshCw size={16} />{t('refresh')}</button></div>
      <p className="mb-4 text-sm text-text-secondary">{t('statusHint')}</p>
      {!data.agents.length && <p className="text-text-secondary">{t('noAgent')}</p>}
      {data.agents.map(a => <p key={a.id} className="mb-3 break-words text-sm"><bdi>{a.id}</bdi> · {t(['ready','no_files','run_failed','login_required'].includes(a.state) ? `state_${a.state}` : 'state_unknown')} · {a.updatedAt ? new Date(a.updatedAt).toLocaleString(locale === 'he' ? 'he-IL' : 'en-US', { timeZone: 'Asia/Jerusalem' }) : '—'}</p>)}
      <ul className="mt-4 divide-y divide-border">{data.connections.map(c => <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span>{c.name} · {c.revoked ? t('revoked') : t('active')}</span>{!c.revoked && (revoking === c.id ? <div className="flex flex-wrap items-center gap-3 text-sm"><span>{t('revokeWarning')}</span><button disabled={busy} className="text-red-500" onClick={() => revoke(c.id)}>{t('confirmRevoke')}</button><button disabled={busy} onClick={() => setRevoking(null)}>{t('cancel')}</button></div> : <button disabled={busy} className="text-sm text-red-500" onClick={() => setRevoking(c.id)}>{t('revoke')}</button>)}</li>)}</ul>
    </section>
  </div>;
}
