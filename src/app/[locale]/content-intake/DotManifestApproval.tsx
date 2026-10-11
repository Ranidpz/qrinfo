'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import type { CloudManifest } from '@/lib/content-intake/cloud-policy';

const endpoint = '/api/content-intake/dot/approvals';
type Review = { connectionId: string; manifestId: string; manifest: CloudManifest; expiresAt: number;
  predecessor: { sha256: string; size: number; expectedVersion: string } | null };
export default function DotManifestApproval() {
  const t = useTranslations('contentIntake'), locale = useLocale();
  const [enabled, setEnabled] = useState(false), [connectionId, setConnectionId] = useState('');
  const [candidate, setCandidate] = useState<unknown>(null), [review, setReview] = useState<Review | null>(null);
  const [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState(''), [error, setError] = useState(false);
  const generation = useRef(0), inFlight = useRef(false), mounted = useRef(false);
  useEffect(() => {
    let active = true; mounted.current = true;
    fetchWithAuth(endpoint).then(async response => {
      if (!response.ok) return;
      const data = await response.json(); if (active) setEnabled(data.approvalEnabled === true);
    }).catch(() => {});
    return () => { active = false; mounted.current = false; };
  }, []);
  function invalidate() { generation.current++; setReview(null); setConfirmed(false); setAttempted(false); setStatus(''); setError(false); }
  async function loadFile(file?: File) {
    if (attempted || inFlight.current) return;
    invalidate(); setCandidate(null);
    const current = generation.current;
    try {
      if (!file || file.size > 65536) throw Error();
      const text = await file.text(); if (/tq_(?:fc|ci)_/i.test(text)) throw Error();
      const value = JSON.parse(text);
      if (mounted.current && generation.current === current) setCandidate(value);
    } catch { if (mounted.current && generation.current === current) setError(true); }
  }
  async function action(operation: 'preview' | 'approve' | 'inspect' | 'revoke') {
    if (inFlight.current || (operation === 'approve' && (!review || !confirmed || attempted))) return;
    if (operation !== 'preview' && !review) return;
    inFlight.current = true; setBusy(true); setError(false);
    const current = generation.current;
    if (operation === 'approve') { setAttempted(true); setStatus('uncertain'); }
    if (operation === 'revoke') setStatus('uncertain');
    try {
      const mutation = operation === 'preview' || operation === 'approve';
      const response = await fetchWithAuth(mutation ? endpoint : `${endpoint}?manifestId=${review!.manifestId}`, {
        method: mutation ? 'POST' : operation === 'revoke' ? 'DELETE' : 'GET',
        ...(mutation ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(operation === 'preview'
          ? { action: 'preview', connectionId, manifest: candidate }
          : { action: 'approve', connectionId: review!.connectionId, manifest: review!.manifest, manifestId: review!.manifestId }) } : {}),
      });
      if (!response.ok) throw Error();
      const result = await response.json();
      if (!mounted.current || generation.current !== current) return;
      if (operation === 'preview') {
        if (result.persisted !== false || result.connectionId !== connectionId || !/^[a-f0-9]{64}$/.test(result.manifestId)) throw Error();
        setReview(result); setConfirmed(false); setStatus('');
      } else {
        if (result.manifestId !== review!.manifestId || !['approved', 'revoked', 'expired', 'missing'].includes(result.state)) throw Error();
        setStatus(result.state);
      }
    } catch { if (mounted.current && generation.current === current) setError(true); }
    finally { inFlight.current = false; if (mounted.current && generation.current === current) setBusy(false); }
  }
  function exportManifest() {
    if (!review) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(review.manifest, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `fattal-review-${review.manifestId}.json`; link.click(); URL.revokeObjectURL(url);
  }
  if (!enabled) return null;
  return <section aria-labelledby="manifest-approval-title" className="rounded-2xl border border-border bg-bg-secondary p-5 sm:p-6 space-y-5">
    <h2 id="manifest-approval-title" className="text-lg font-semibold">{t('approvalTitle')}</h2>
    <p className="text-sm text-text-secondary">{t('approvalIntro')}</p>
    <label className="block" htmlFor="approval-writer">{t('approvalWriter')}</label>
    <input id="approval-writer" dir="ltr" value={connectionId} disabled={busy || attempted} onChange={event => { invalidate(); setConnectionId(event.target.value); }} className="w-full rounded border border-border bg-bg-primary p-2" />
    <label className="block" htmlFor="approval-file">{t('approvalFile')}</label>
    <input id="approval-file" type="file" accept="application/json,.json" disabled={busy || attempted} onChange={event => { void loadFile(event.target.files?.[0]); }} />
    <button type="button" onClick={() => action('preview')} disabled={busy || attempted || !candidate || !/^[a-f0-9]{32}$/.test(connectionId)} className="rounded border px-3 py-2 disabled:opacity-50">{t('approvalPreview')}</button>
    {review && <div className="space-y-5 break-words border-t border-border pt-5">
      <p>{review.manifest.hotel} · {review.manifest.shortId} · {review.manifest.filename}</p>
      <p>{review.manifest.period.kind} · {review.manifest.period.startDate} — {review.manifest.period.endDate}</p>
      <p className="break-all" dir="ltr">SHA256: {review.manifest.sha256}</p>
      <p className="break-all" dir="ltr">{t('approvalPredecessor')}: {review.predecessor?.sha256 || '—'}</p>
      <p className="break-all" dir="ltr">{t('approvalVersion')}: {review.manifest.expectedVersion}</p>
      <p className="break-all">{t('approvalGroup')}: {review.manifest.sourceGroupId}</p>
      <ul className="text-sm break-all">{review.manifest.sources.map(source => <li key={`${source.messageId}:${source.fileId}`}>{source.messageId} · {source.fileId} · {source.sha256}</li>)}</ul>
      <p>{t('approvalSupersedes')}</p>
      <ul className="text-sm break-all">{review.manifest.supersedes.map(source => <li key={`${source.messageId}:${source.fileId}`}>{source.messageId} · {source.fileId} · {source.sha256}</li>)}</ul>
      <p>{review.manifest.review.evidence}</p>
      <p>{t('approvalExpires', { time: new Date(review.expiresAt).toLocaleString(locale, { timeZone: 'Asia/Jerusalem' }) })}</p>
      <button type="button" onClick={exportManifest} className="rounded border px-3 py-2">{t('approvalExport')}</button>
      {!attempted && <>
        <label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} />{t('approvalConfirm')}</label>
        <button type="button" onClick={() => action('approve')} disabled={busy || !confirmed || review.expiresAt <= Date.now()} className="rounded bg-accent text-white px-3 py-2 disabled:opacity-50">{t('approvalApprove')}</button>
      </>}
      {attempted && <>
        <div className="intake-actions">
          <button type="button" onClick={() => action('inspect')} disabled={busy} className="rounded border px-3 py-2">{t('approvalInspect')}</button>
          <button type="button" onClick={() => action('revoke')} disabled={busy || status !== 'approved'} className="intake-danger rounded border px-3 py-2">{t('approvalRevoke')}</button>
        </div>
        <p className="break-all" dir="ltr">{review.manifestId}</p>
      </>}
    </div>}
    {status && <p role="status">{t(`approvalState_${status}`)}</p>}
    {error && <p role="alert">{t('approvalError')}</p>}
  </section>;
}
