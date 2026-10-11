'use client';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

type Result = { manifestId: string; status: 'verified' | 'uncertain' | 'superseded'; retryAllowed: false; uploadAllowed: false };
export default function DotSupervisedRecovery() {
  const t = useTranslations('contentIntake');
  const [id, setId] = useState(''), [result, setResult] = useState<Result | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const inFlight = useRef(false);
  async function inspect() {
    if (inFlight.current || !/^[a-f0-9]{64}$/.test(id)) return;
    inFlight.current = true; setBusy(true); setError(false); setResult(null);
    try {
      const response = await fetchWithAuth(`/api/content-intake/dot/supervised?manifestId=${id}`, { method: 'GET' });
      if (!response.ok) throw Error();
      const data = await response.json();
      if (data.manifestId !== id || data.retryAllowed !== false || data.uploadAllowed !== false
        || !['verified', 'uncertain', 'superseded'].includes(data.status)) throw Error();
      setResult(data);
    } catch { setError(true); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <section aria-labelledby="supervised-recovery-title" className="rounded-2xl border border-border bg-bg-secondary p-5 sm:p-6 space-y-5">
    <h2 id="supervised-recovery-title" className="text-lg font-semibold">{t('supervisedRecoveryTitle')}</h2>
    <p className="text-sm text-text-secondary">{t('supervisedRecoveryIntro')}</p>
    <label className="block" htmlFor="supervised-manifest-id">{t('supervisedManifestId')}</label>
    <input id="supervised-manifest-id" dir="ltr" value={id} disabled={busy} onChange={e => { setId(e.target.value); setResult(null); setError(false); }} className="w-full rounded border p-2 bg-bg-primary" />
    <button type="button" disabled={busy || !/^[a-f0-9]{64}$/.test(id)} onClick={inspect} className="rounded border px-3 py-2 disabled:opacity-50">{t('supervisedInspect')}</button>
    {result && <p role="status">{t(`supervisedState_${result.status}`)}</p>}
    {error && <p role="alert">{t('supervisedUnavailable')}</p>}
  </section>;
}
