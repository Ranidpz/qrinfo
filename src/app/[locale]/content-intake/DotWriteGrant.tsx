'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

const endpoint = '/api/content-intake/dot/write-grant';
const idPattern = /^[a-f0-9]{32}$/;
type Receipt = { connectionId: string; state: 'active' | 'revoked' | 'expired' | 'missing'; expiresAt?: number };
export default function DotWriteGrant({ ownerId, ownerEmail, projectId, targets }: {
  ownerId: string; ownerEmail: string; projectId: string; targets: { shortId: string; title: string }[];
}) {
  const t = useTranslations('contentIntake'), locale = useLocale();
  const [enabled, setEnabled] = useState(false), [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [id, setId] = useState(''), [shortId, setShortId] = useState(''), [message, setMessage] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const secret = useRef<string | null>(null), inFlight = useRef(false), active = useRef(true);
  const storageKey = `fattal-writer-attempt:${projectId}:${ownerId}`;
  useEffect(() => {
    active.current = true;
    try { const saved = localStorage.getItem(storageKey); if (saved && idPattern.test(saved)) setId(saved); }
    catch { setMessage('writerStorageRequired'); }
    fetchWithAuth(endpoint).then(async r => { if (!r.ok) throw Error(); const body = await r.json(); if (active.current) setEnabled(body.issuanceEnabled === true); })
      .catch(() => { if (active.current) setMessage('writerUncertain'); });
    return () => { active.current = false; secret.current = null; };
  }, [storageKey]);
  useEffect(() => {
    if (receipt?.state !== 'active' || !receipt.expiresAt) return;
    const timer = window.setTimeout(() => { secret.current = null; setReceipt(r => r ? { ...r, state: 'expired' } : r); }, Math.max(0, receipt.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [receipt]);
  async function issue() {
    if (!enabled || !ready || !shortId || id || inFlight.current) return;
    inFlight.current = true; setBusy(true); setMessage(''); setReceipt(null);
    try {
      const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      const connectionId = hex(crypto.getRandomValues(new Uint8Array(16)));
      const token = `tq_fc_${connectionId}.${hex(crypto.getRandomValues(new Uint8Array(32)))}`;
      const keyHash = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))));
      if (!active.current) return;
      // Persist only the cancellation handle before POST. Never persist/render the credential.
      setId(connectionId); localStorage.setItem(storageKey, connectionId); secret.current = token;
      const response = await fetchWithAuth(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, keyHash, ownerId, ownerEmail, projectId, shortId, durationMinutes: 15 }) });
      if (!response.ok) throw Error();
      const result = await response.json();
      if (result.connectionId !== connectionId || result.state !== 'active' || !Number.isSafeInteger(result.expiresAt)) throw Error();
      if (active.current) setReceipt(result);
    } catch { if (active.current) setMessage('writerUncertain'); }
    finally { inFlight.current = false; if (active.current) setBusy(false); }
  }
  async function inspect(revoke = false) {
    if (!idPattern.test(id) || inFlight.current) return;
    inFlight.current = true; setBusy(true); setReceipt(null); setMessage('');
    try {
      const response = await fetchWithAuth(`${endpoint}?connectionId=${id}`, { method: revoke ? 'DELETE' : 'GET' });
      if (!response.ok) throw Error();
      const result = await response.json();
      if (result.connectionId !== id || !['active', 'revoked', 'expired', 'missing'].includes(result.state)) throw Error();
      if (active.current) setReceipt(result);
      if (result.state === 'revoked' || result.state === 'expired') secret.current = null;
    } catch { if (active.current) setMessage('writerUncertain'); }
    finally { inFlight.current = false; if (active.current) setBusy(false); }
  }
  async function copy() {
    if (busy || !secret.current || receipt?.state !== 'active' || !receipt.expiresAt || receipt.expiresAt <= Date.now()) return;
    try { await navigator.clipboard.writeText(secret.current); setMessage('writerCopied'); }
    catch { setMessage('writerCopyFailed'); }
  }
  function newAttempt() {
    if (busy || !receipt || !['revoked', 'expired'].includes(receipt.state)) return;
    try { localStorage.removeItem(storageKey); secret.current = null; setId(''); setReceipt(null); setReady(false); setMessage(''); }
    catch { setMessage('writerStorageRequired'); }
  }
  return <section aria-labelledby="writer-grant-title" className="rounded-lg border border-border p-4 space-y-3">
    <h3 id="writer-grant-title" className="font-semibold">{t('writerTitle')}</h3>
    <p>{t('writerIntro')}</p>
    {!enabled && <p>{t('writerDisabled')}</p>}
    {!id && <>
      <label htmlFor="writer-target">{t('writerTarget')}</label>
      <select id="writer-target" value={shortId} disabled={busy || !enabled} onChange={e => setShortId(e.target.value)} className="block w-full rounded border p-2 bg-bg-primary">
        <option value="">{t('writerChooseTarget')}</option>
        {targets.filter(target => target.shortId !== '5ubXFS').map(target => <option key={target.shortId} value={target.shortId}>{target.title} · {target.shortId}</option>)}
      </select>
      <label className="flex gap-2"><input type="checkbox" checked={ready} disabled={busy || !enabled} onChange={e => setReady(e.target.checked)} />{t('writerConfirm')}</label>
      <button type="button" disabled={busy || !enabled || !ready || !shortId} onClick={issue} className="rounded border px-3 py-2 disabled:opacity-50">{t('writerIssue')}</button>
    </>}
    <label className="block" htmlFor="writer-attempt-id">{t('writerAttemptId')}</label>
    <input id="writer-attempt-id" dir="ltr" value={id} disabled={busy || !!secret.current} onChange={e => { setId(e.target.value); setReceipt(null); setMessage(''); }} className="w-full rounded border p-2 bg-bg-primary" />
    <p>{t('writerRecoverHelp')}</p>
    {receipt && <p role="status">{t(`writerState_${receipt.state}`)}{receipt.expiresAt ? ` · ${new Date(receipt.expiresAt).toLocaleString(locale, { timeZone: 'Asia/Jerusalem' })}` : ''}</p>}
    {receipt?.state === 'active' && secret.current && <button type="button" disabled={busy} onClick={copy} className="rounded border px-3 py-2">{t('writerCopy')}</button>}
    <button type="button" disabled={busy || !idPattern.test(id)} onClick={() => inspect()} className="rounded border px-3 py-2">{t('writerInspect')}</button>
    <button type="button" disabled={busy || !idPattern.test(id)} onClick={() => inspect(true)} className="rounded border px-3 py-2">{t('writerRevoke')}</button>
    {receipt && ['revoked', 'expired'].includes(receipt.state) && <button type="button" disabled={busy} onClick={newAttempt} className="rounded border px-3 py-2">{t('writerNew')}</button>}
    {message && <p role="status">{t(message)}</p>}
  </section>;
}
