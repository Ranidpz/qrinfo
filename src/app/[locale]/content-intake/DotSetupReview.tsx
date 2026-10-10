'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import type { buildSetupReview } from '@/lib/content-intake/setup-review';

type Review = ReturnType<typeof buildSetupReview>;
const endpoint = '/api/content-intake/dot/setup';
export default function DotSetupReview({ owners }: { owners: { id: string; email: string; name: string }[] }) {
  const t = useTranslations('contentIntake');
  const locale = useLocale();
  const [project, setProject] = useState('');
  const [ownerId, setOwner] = useState('');
  const [email, setEmail] = useState('');
  const [duration, setDuration] = useState('1');
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    const requestGeneration = generation;
    fetchWithAuth(endpoint, { signal: controller.signal }).then(async res => {
      if (!res.ok) throw Error();
      const data = await res.json();
      if (!controller.signal.aborted) setProject(data.projectId);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => { controller.abort(); requestGeneration.current++; };
  }, []);
  function invalidate() { generation.current++; setReview(null); setError(false); setBusy(false); }
  async function inspect(event: React.FormEvent) {
    event.preventDefault();
    const request = ++generation.current;
    setBusy(true); setReview(null); setError(false);
    try {
      const params = new URLSearchParams({ ownerId, ownerEmail: email, projectId: project, durationHours: duration });
      const res = await fetchWithAuth(`${endpoint}?${params}`);
      if (!res.ok) throw Error();
      const result = await res.json();
      if (generation.current === request) setReview(result);
    } catch { if (generation.current === request) setError(true); }
    finally { if (generation.current === request) setBusy(false); }
  }
  return <section aria-labelledby="dot-setup-title" className="rounded-2xl border border-border bg-bg-secondary p-5 sm:p-6">
    <h2 id="dot-setup-title" className="text-lg font-semibold">{t('setupTitle')}</h2>
    <p className="my-3 text-sm text-text-secondary">{t('setupIntro')}</p>
    <p className="mb-3 break-all text-sm">{t('setupProject')}: <span dir="ltr">{project || '—'}</span></p>
    <form id="dot-setup-form" onSubmit={inspect} className="space-y-3">
      <label className="block" htmlFor="setup-owner">{t('owner')}</label>
      <select id="setup-owner" value={ownerId} onChange={e => { invalidate(); setOwner(e.target.value); setEmail(''); }} className="w-full rounded-lg border border-border bg-bg-primary p-3">
        <option value="">{t('setupChoose')}</option>
        {owners.map(o => <option key={o.id} value={o.id}>{o.name} · {o.email} · {o.id}</option>)}
      </select>
      <label className="block" htmlFor="setup-email">{t('setupEmail')}</label>
      <input id="setup-email" type="email" autoComplete="off" dir="ltr" required value={email} onChange={e => { invalidate(); setEmail(e.target.value); }} className="w-full rounded-lg border border-border bg-bg-primary p-3" />
      <label className="block" htmlFor="setup-duration">{t('setupDuration')}</label>
      <select id="setup-duration" value={duration} onChange={e => { invalidate(); setDuration(e.target.value); }} className="rounded-lg border border-border bg-bg-primary p-3">
        {[1, 4, 24].map(hours => <option key={hours} value={hours}>{t('setupHours', { hours })}</option>)}
      </select>
      <button type="submit" disabled={busy || !project || !ownerId || !email} className="block rounded-lg bg-accent px-4 py-2 text-white disabled:opacity-50">{busy ? t('loading') : t('setupCheck')}</button>
    </form>
    {error && <p role="alert" className="mt-3 text-red-500">{t('setupError')}</p>}
    {review && <div role="status" className="mt-4 space-y-3">
      <p>{t(review.mappingVerified ? 'setupVerified' : 'setupBlocked')}</p>
      <p dir="ltr" className="break-all text-sm">{review.ownerEmail} · {review.ownerId} · {review.projectId}</p>
      <ul className="space-y-1 text-sm">{review.targets.map(target => <li key={target.shortId}>{target.title} · <span dir="ltr">{target.shortId}</span> · {t(`setupTarget_${target.state}`)}</li>)}</ul>
      {review.proposal && <p>{t('setupProposal', { expires: new Date(review.proposal.expiresAt).toLocaleString(locale, { timeZone: 'Asia/Jerusalem' }) })}</p>}
      <p className="text-sm text-text-secondary">{t('setupNoChanges')}</p>
    </div>}
  </section>;
}
