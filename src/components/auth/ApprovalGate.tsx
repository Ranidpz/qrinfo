'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Loader2, Clock, LogOut, RefreshCw, Pencil } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { formatPhoneForDisplay } from '@/lib/phone-utils';
import type { User } from '@/types';

const SUPPORT_WHATSAPP = '972773006306';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

/**
 * What a signed-in user who isn't approved yet sees instead of the app:
 * first a short "who are you" form (sends the join request), then a friendly
 * waiting screen with a WhatsApp shortcut. Nothing else is reachable.
 */
export default function ApprovalGate({ user }: { user: User }) {
  const t = useTranslations('gate');
  const { signOut, refreshUser } = useAuth();

  const requested = !!user.approvalRequestedAt && user.status !== 'rejected';
  const [editing, setEditing] = useState(!requested);
  const [name, setName] = useState(user.displayName || '');
  const [business, setBusiness] = useState(user.businessName || '');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const who = user.email || (user.phone ? formatPhoneForDisplay(user.phone) : '');
  const waText = encodeURIComponent(t('whatsappMessage', { name: user.displayName || name || who }));
  const waHref = `https://wa.me/${SUPPORT_WHATSAPP}?text=${waText}`;

  const submit = async () => {
    if (name.trim().length < 2) {
      setError(t('nameRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/auth/request-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: name, businessName: business }),
      });
      if (!res.ok) throw new Error(String(res.status));
      await refreshUser();
      setEditing(false);
    } catch {
      setError(t('genericError'));
    } finally {
      setBusy(false);
    }
  };

  const checkStatus = async () => {
    setChecking(true);
    await refreshUser();
    setChecking(false);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-8">
      <div className="w-full max-w-md card p-6 sm:p-8 text-center space-y-5">
        <Image src="/theQ.png" alt="The Q" width={64} height={64} className="rounded-2xl mx-auto" />

        {editing ? (
          <form
            className="space-y-4 text-start"
            onSubmit={(e) => { e.preventDefault(); if (!busy) submit(); }}
          >
            <div className="text-center space-y-1">
              <h1 className="text-xl font-bold text-text-primary">{t('detailsTitle')}</h1>
              <p className="text-sm text-text-secondary">{t('detailsBody')}</p>
            </div>
            <div className="space-y-1">
              <label htmlFor="gate-name" className="block text-sm font-medium text-text-primary">{t('nameLabel')}</label>
              <input
                id="gate-name"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(null); }}
                autoComplete="name"
                maxLength={60}
                className="input"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="gate-business" className="block text-sm font-medium text-text-primary">{t('businessLabel')}</label>
              <input
                id="gate-business"
                value={business}
                onChange={(e) => setBusiness(e.target.value)}
                autoComplete="organization"
                maxLength={80}
                className="input"
              />
            </div>
            {error && <p className="text-sm text-danger" role="alert">{error}</p>}
            <button type="submit" disabled={busy} className="btn btn-primary w-full py-3 disabled:opacity-50">
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('submitting')}</> : t('submitRequest')}
            </button>
          </form>
        ) : user.status === 'rejected' ? (
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-text-primary">{t('rejectedTitle')}</h1>
            <p className="text-sm text-text-secondary">{t('rejectedBody')}</p>
            <button type="button" onClick={() => setEditing(true)} className="text-sm text-accent hover:underline">
              {t('sendAgain')}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <span className="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto">
              <Clock className="w-6 h-6" />
            </span>
            <h1 className="text-xl font-bold text-text-primary">{t('pendingTitle')}</h1>
            <p className="text-sm text-text-secondary leading-relaxed">{t('pendingBody')}</p>
            {user.email ? (
              <p className="text-sm text-text-secondary">
                {t('pendingEmailNote')} <span dir="ltr" className="font-medium text-text-primary">{user.email}</span>
              </p>
            ) : (
              <p className="text-sm text-text-secondary">{t('pendingPhoneNote')}</p>
            )}
          </div>
        )}

        {!editing && (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="btn w-full py-3 bg-[#25D366] hover:bg-[#1ebe5a] text-white"
          >
            <WhatsAppIcon className="w-5 h-5" />
            {t('whatsappCta')}
          </a>
        )}

        <div className="pt-3 border-t border-border space-y-2">
          {who && (
            <p className="text-xs text-text-secondary">
              {t('signedInAs')} <span dir="ltr" className="text-text-primary">{who}</span>
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
            {!editing && user.status !== 'rejected' && (
              <>
                <button type="button" onClick={checkStatus} disabled={checking} className="inline-flex items-center gap-1 text-accent hover:underline disabled:opacity-50">
                  <RefreshCw className={checking ? 'w-3.5 h-3.5 animate-spin' : 'w-3.5 h-3.5'} /> {t('refreshStatus')}
                </button>
                <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary hover:underline">
                  <Pencil className="w-3.5 h-3.5" /> {t('editDetails')}
                </button>
              </>
            )}
            <button type="button" onClick={signOut} className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary hover:underline">
              <LogOut className="w-3.5 h-3.5" /> {t('signOut')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
