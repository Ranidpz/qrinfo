'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import DotConnection from './DotConnection';

import ComputerList, { type IntakeComputer } from './ComputerList';

type Owner = { id: string; name: string; email: string; targets: { shortId: string; title: string }[] };
type Connection = { id: string; name: string; disabled?: boolean; revoked: boolean };
type Agent = IntakeComputer;
type Data = { owners: Owner[]; connections: Connection[]; agents: Agent[] };
const endpoint = '/api/content-intake/connections';
const panel = 'rounded-2xl border border-border bg-bg-secondary p-5 sm:p-6';

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
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
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
  async function revoke(id: string) {
    setBusy(true); setError(false);
    try {
      const res = await fetchWithAuth(endpoint, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (!res.ok) throw new Error('REVOKE_FAILED');
      setRevoking(null); await refresh();
    } catch { setError(true); } finally { setBusy(false); }
  }
  return <div className="mx-auto max-w-5xl space-y-6 text-text-primary">
    <header>
      <h1 className="text-2xl font-bold">{t('dotTitle')}</h1><p className="mt-2 text-text-secondary">{t('dotIntro')}</p>
    </header>
    <DotConnection />
    {error && <p role="alert" className="rounded-lg bg-red-500/10 p-4 text-red-500">{t('error')}</p>}
    <section className={panel}>
      <div className="mb-4 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck size={20} />{t('legacyTitle')}</h2><button disabled={busy || loading} className="inline-flex items-center gap-2 text-accent" onClick={() => { setError(false); refresh().catch(() => setError(true)); }}><RefreshCw size={16} />{t('refresh')}</button></div>
      <p className="mb-4 text-sm text-text-secondary">{t('legacyCaution')}</p>
      {loading ? <p role="status">{t('loading')}</p> : data.owners.length === 0 ? <p>{t('noOwners')}</p> : <>
        <label className="block text-sm" htmlFor="intake-owner">{t('owner')}</label>
        <div className="relative mt-2"><select id="intake-owner" value={ownerId} disabled={busy} onChange={e => { setOwnerId(e.target.value); setRevoking(null); setData(d => ({ ...d, agents: [], connections: [] })); }} className="w-full appearance-none rounded-lg border border-border bg-bg-primary py-3 ps-3 pe-10">
          {data.owners.map(o => <option key={o.id} value={o.id}>{o.name} — {o.email}</option>)}
        </select><ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-text-secondary" /></div>
        <details className="my-4 text-sm text-text-secondary"><summary className="cursor-pointer">{t('scope', { count: owner?.targets.length || 0 })}</summary><ul className="mt-2 space-y-1">{owner?.targets.map(v => <li key={v.shortId}>{v.title}</li>)}</ul></details>
      </>}
      <ComputerList computers={data.agents} refresh={refresh} />
      <ul className="mt-4 divide-y divide-border">{data.connections.map(c => <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span>{c.name} · {c.revoked ? t('revoked') : c.disabled ? t('connectionPaused') : t('active')}</span>{!c.revoked && (revoking === c.id ? <div className="flex flex-wrap items-center gap-3 text-sm"><span>{t('revokeWarning')}</span><button disabled={busy} className="text-red-500" onClick={() => revoke(c.id)}>{t('confirmRevoke')}</button><button disabled={busy} onClick={() => setRevoking(null)}>{t('cancel')}</button></div> : <button disabled={busy} className="text-sm text-red-500" onClick={() => setRevoking(c.id)}>{t('revoke')}</button>)}</li>)}</ul>
    </section>

  </div>;
}
