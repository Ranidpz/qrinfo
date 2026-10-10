'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

type Health = {
  ownerId: string; ownerEmail: string; projectId: string; expiresAt: number;
  targets: { shortId: string; hotel: string; expectedVersion: string; pending: boolean }[];
};
type Recovery = { manifestId: string; shortId: string; sha256: string; status: 'verified' | 'superseded' | 'uncertain' };
const endpoint = '/api/content-intake/dot';
const input = 'mt-1 w-full rounded-lg border border-border bg-bg-primary p-3';
const button = 'rounded-lg bg-accent px-4 py-3 text-white disabled:cursor-not-allowed disabled:opacity-50';

export default function DotConnection() {
  const t = useTranslations('contentIntake');
  const locale = useLocale();
  const [state, setState] = useState<'loading' | 'ready' | 'unconfigured' | 'unavailable'>('loading');
  const [health, setHealth] = useState<Health | null>(null);
  const [receipt, setReceipt] = useState<Recovery | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookupError, setLookupError] = useState(false);
  const [manifestId, setManifestId] = useState('');
  const [sha256, setSha256] = useState('');
  const [shortId, setShortId] = useState('');
  async function refresh(signal?: AbortSignal) {
    setState('loading'); setHealth(null); setReceipt(null); setShortId(''); setLookupError(false);
    try {
      const res = await fetchWithAuth(endpoint, { cache: 'no-store', signal });
      const data = await res.json();
      if (signal?.aborted) return;
      if (res.ok && data.state === 'ready' && data.health) { setHealth(data.health); setState('ready'); }
      else setState(res.ok && data.state === 'unconfigured' ? 'unconfigured' : 'unavailable');
    } catch { if (!signal?.aborted) setState('unavailable'); }
  }
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, []);
  async function lookup(event: FormEvent) {
    event.preventDefault(); setBusy(true); setReceipt(null); setLookupError(false);
    try {
      const params = new URLSearchParams({ manifestId, shortId, sha256 });
      const res = await fetchWithAuth(`${endpoint}?${params}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || data.state !== 'ready' || !data.recovery) throw new Error('LOOKUP_FAILED');
      setReceipt(data.recovery);
    } catch { setLookupError(true); setHealth(null); setState('unavailable'); }
    finally { setBusy(false); }
  }
  const valid = /^[a-f0-9]{64}$/.test(manifestId) && /^[a-f0-9]{64}$/.test(sha256) && !!health?.targets.some(t => t.shortId === shortId);
  return <section aria-labelledby="dot-title" className="rounded-2xl border border-border bg-bg-secondary p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="dot-title" className="text-lg font-semibold">{t('dotConnection')}</h2>
      <button type="button" className="text-accent disabled:opacity-50" disabled={busy || state === 'loading'} onClick={() => void refresh()}>{t('refresh')}</button>
    </div>
    <p role="status" className="mt-4">{t(`dotState_${state}`)}</p>
    <p className="mt-3 text-sm text-text-secondary">{t('dotEffects')}</p>
    {state === 'unconfigured' && <p className="mt-3 text-sm text-text-secondary">{t('dotSetup')}</p>}
    {health && <>
      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <div><dt>{t('owner')}</dt><dd><bdi>{health.ownerEmail}</bdi><br /><bdi>{health.ownerId}</bdi></dd></div>
        <div><dt>{t('dotProject')}</dt><dd><bdi>{health.projectId}</bdi></dd></div>
        <div><dt>{t('dotPermissions')}</dt><dd>{t('dotReadOnly')}</dd></div>
        <div><dt>{t('dotExpiry')}</dt><dd>{new Date(health.expiresAt).toLocaleString(locale === 'he' ? 'he-IL' : 'en-US', { timeZone: 'Asia/Jerusalem' })}</dd></div>
      </dl>
      <h3 className="mt-5 font-medium">{t('dotTargets', { count: health.targets.length })}</h3>
      <ul className="mt-2 divide-y divide-border">{health.targets.map(target => <li key={target.shortId} className="py-3 text-sm">
        <bdi>{target.hotel} · {target.shortId}</bdi> · {t(target.pending ? 'dotPending' : 'dotNoPending')}
        <p className="mt-1 text-text-secondary">{t('dotVersion')}</p><code dir="ltr" className="block break-all">{target.expectedVersion}</code>
      </li>)}</ul>
      <form className="mt-6 space-y-4 border-t border-border pt-5" onSubmit={lookup}>
        <h3 className="font-medium">{t('dotRecovery')}</h3>
        <p className="text-sm text-text-secondary">{t('dotRecoveryHint')}</p>
        <fieldset disabled={busy} className="space-y-4">
          <label className="block" htmlFor="dot-manifest">{t('dotManifest')}<input className={input} id="dot-manifest" dir="ltr" value={manifestId} maxLength={64} pattern="[a-f0-9]{64}" required onChange={e => { setManifestId(e.target.value); setReceipt(null); }} /></label>
          <label className="block" htmlFor="dot-target">{t('dotTarget')}<select className={input} id="dot-target" required value={shortId} onChange={e => { setShortId(e.target.value); setReceipt(null); }}>
            <option value="">{t('dotChooseTarget')}</option>{health.targets.map(target => <option key={target.shortId} value={target.shortId}>{target.hotel} · {target.shortId}</option>)}
          </select></label>
          <label className="block" htmlFor="dot-hash">SHA256<input className={input} id="dot-hash" dir="ltr" value={sha256} maxLength={64} pattern="[a-f0-9]{64}" required onChange={e => { setSha256(e.target.value); setReceipt(null); }} /></label>
          <button className={button} disabled={busy || !valid}>{busy ? t('working') : t('dotLookup')}</button>
        </fieldset>
      </form>
    </>}
    {lookupError && <p role="alert" className="mt-4 text-red-500">{t('dotLookupError')}</p>}
    {receipt && <div role="status" className="mt-4 rounded-lg border border-border p-4">
      <p>{t(`dotReceipt_${receipt.status}`)}</p><p className="mt-2 text-sm">{t('dotNoRetry')}</p>
      <p className="mt-2 break-all" dir="ltr">{receipt.shortId}<br />{receipt.manifestId}<br />{receipt.sha256}</p>
    </div>}
  </section>;
}
