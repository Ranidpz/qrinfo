'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

const endpoint = '/api/content-intake/dot/read-grant';
type Receipt = { connectionId: string; state: string; expiresAt?: number };
export default function DotReadGrant({ ownerId, ownerEmail, projectId }: { ownerId: string; ownerEmail: string; projectId: string }) {
  const t = useTranslations('contentIntake');
  const locale = useLocale();
  const [enabled, setEnabled] = useState(false), [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null), [attempted, setAttempted] = useState(false);
  const [message, setMessage] = useState('');
  // Never render/store the token, put it in a URL, or send it to the issuing API.
  const secret = useRef<{ token: string; connectionId: string } | null>(null);
  const inFlight = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    fetchWithAuth(endpoint).then(async res => {
      if (!res.ok) throw Error();
      const data = await res.json();
      if (active.current) setEnabled(data.issuanceEnabled === true);
    }).catch(() => { if (active.current) setMessage('readGrantFailed'); });
    return () => { active.current = false; secret.current = null; };
  }, []);
  useEffect(() => {
    if (receipt?.state !== 'active' || !receipt.expiresAt) return;
    const timer = window.setTimeout(() => {
      secret.current = null;
      setReceipt(current => current?.state === 'active' ? { ...current, state: 'expired' } : current);
    }, Math.max(0, receipt.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [receipt]);
  async function issue() {
    if (!enabled || !ready || secret.current || inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setMessage('');
    try {
      const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      const connectionId = hex(crypto.getRandomValues(new Uint8Array(16)));
      const token = `tq_fc_${connectionId}.${hex(crypto.getRandomValues(new Uint8Array(32)))}`;
      const keyHash = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))));
      if (!active.current) return;
      secret.current = { token, connectionId }; setAttempted(true);
      const res = await fetchWithAuth(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, keyHash, ownerId, ownerEmail, projectId, durationHours: 1 }) });
      if (!res.ok) throw Error();
      const result = await res.json();
      if (result.connectionId !== connectionId || result.state !== 'active') throw Error();
      if (active.current) setReceipt(result);
    } catch { if (active.current) setMessage('readGrantUncertain'); }
    finally { inFlight.current = false; if (active.current) setBusy(false); }
  }
  async function inspect(revoke = false) {
    if (!secret.current || inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setMessage('');
    try {
      const res = await fetchWithAuth(`${endpoint}?connectionId=${secret.current.connectionId}`, { method: revoke ? 'DELETE' : 'GET' });
      if (!res.ok) throw Error();
      const result = await res.json();
      if (result.connectionId !== secret.current?.connectionId) throw Error();
      if (active.current) setReceipt(result);
      if (result.state === 'revoked' || result.state === 'expired') secret.current = null;
    } catch {
      if (active.current) {
        if (revoke) setReceipt(null); // Revocation may have succeeded; inspect before copying.
        setMessage('readGrantFailed');
      }
    }
    finally { inFlight.current = false; if (active.current) setBusy(false); }
  }
  async function copy() {
    if (!secret.current || receipt?.state !== 'active' || !receipt.expiresAt || receipt.expiresAt <= Date.now()) return;
    try { await navigator.clipboard.writeText(secret.current.token); setMessage('readGrantCopied'); }
    catch { setMessage('readGrantCopyFailed'); }
  }
  return <div className="space-y-3 rounded-lg border border-border p-4">
    <p>{t('readGrantIntro')}</p>
    {!enabled && <p>{t('readGrantDisabled')}</p>}
    {!attempted && <>
      <label className="flex gap-2"><input type="checkbox" checked={ready} onChange={e => setReady(e.target.checked)} disabled={!enabled || busy} />{t('readGrantReady')}</label>
      <button type="button" disabled={!enabled || !ready || busy} onClick={issue} className="rounded bg-accent px-3 py-2 text-white disabled:opacity-50">{t('readGrantIssue')}</button>
    </>}
    {attempted && <>
      {receipt && <p className="break-all">{t(`readGrantState_${receipt.state}`)} · <span dir="ltr">{receipt.connectionId}</span>{receipt.expiresAt ? ` · ${new Date(receipt.expiresAt).toLocaleString(locale, { timeZone: 'Asia/Jerusalem' })}` : ''}</p>}
      {receipt?.state === 'active' && <button type="button" onClick={copy} disabled={busy} className="rounded border px-3 py-2">{t('readGrantCopy')}</button>}
      <button type="button" onClick={() => inspect()} disabled={busy || !secret.current} className="rounded border px-3 py-2">{t('readGrantInspect')}</button>
      <button type="button" onClick={() => inspect(true)} disabled={busy || !secret.current} className="rounded border px-3 py-2">{t('readGrantRevoke')}</button>
    </>}
    {message && <p role="status">{t(message)}</p>}
  </div>;
}
