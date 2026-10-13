'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { Loader2, Mail, MessageCircle } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { parseLoginIdentity, LAST_IDENTITY_KEY, type LoginIdentityKind } from '@/lib/auth/identity';
import { formatPhoneForDisplay } from '@/lib/phone-utils';
import CodeBoxes, { emptyCode } from './CodeBoxes';

type Step = 'identify' | 'code' | 'link-email' | 'link-working';

function readSaved(): string {
  try {
    return localStorage.getItem(LAST_IDENTITY_KEY) || '';
  } catch {
    return '';
  }
}

function writeSaved(value: string | null) {
  try {
    if (value) localStorage.setItem(LAST_IDENTITY_KEY, value);
    else localStorage.removeItem(LAST_IDENTITY_KEY);
  } catch {
    // private mode / blocked storage — remembering is only a convenience
  }
}

const ERROR_KEYS: Record<string, string> = {
  invalid_identifier: 'invalidIdentifier',
  rate_limited: 'rateLimited',
  cooldown: 'rateLimited',
  blocked: 'blocked',
  delivery_failed: 'deliveryFailed',
  unavailable: 'unavailable',
  expired: 'codeExpired',
};

/**
 * One field (email or Israeli mobile) → 6-digit code by email (Resend) or
 * WhatsApp (INFORU) → signed in. Also finishes Firebase email-link sign-ins
 * when the page is opened from the button in the code email.
 */
export default function PasswordlessLogin({ onBusyChange }: { onBusyChange?: (busy: boolean) => void }) {
  const t = useTranslations('gate');
  const locale = useLocale();
  const { signInWithLoginToken } = useAuth();

  const [step, setStep] = useState<Step>('identify');
  const [input, setInput] = useState('');
  const [savedShown, setSavedShown] = useState(false);
  const [sentTo, setSentTo] = useState<{ kind: LoginIdentityKind; value: string } | null>(null);
  const [digits, setDigits] = useState<string[]>(emptyCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const submitted = useRef<string | null>(null);

  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);

  // --- Email-link landing ---
  const finishEmailLink = useCallback(async (email: string) => {
    setStep('link-working');
    setError(null);
    try {
      await signInWithEmailLink(auth, email, window.location.href);
      writeSaved(email);
      // Drop the one-time code from the address bar / history.
      window.history.replaceState(null, '', window.location.pathname);
    } catch (err) {
      console.error('[Login] email link failed:', err);
      window.history.replaceState(null, '', window.location.pathname);
      setError(t('linkFailed'));
      setStep('identify');
    }
  }, [t]);

  useEffect(() => {
    const saved = readSaved();
    if (isSignInWithEmailLink(auth, window.location.href)) {
      if (saved.includes('@')) {
        finishEmailLink(saved);
      } else {
        setStep('link-email');
      }
      return;
    }
    if (saved) {
      setInput(saved.startsWith('+972') ? formatPhoneForDisplay(saved) : saved);
      setSavedShown(true);
    }
  }, [finishEmailLink]);

  // Resend countdown tick
  useEffect(() => {
    if (step !== 'code' || resendAt <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [step, resendAt]);

  // --- Send ---
  const sendCode = async () => {
    const identity = parseLoginIdentity(input);
    if (!identity) {
      setError(t('invalidIdentifier'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identity.value, locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(t(ERROR_KEYS[data.error] || 'genericError'));
        return;
      }
      writeSaved(data.identifier);
      try { localStorage.setItem('terms_accepted', 'true'); } catch { /* ignore */ }
      setSentTo({ kind: data.kind, value: data.identifier });
      setDigits(emptyCode());
      submitted.current = null;
      setResendAt(Date.now() + (data.resendInMs || 45000));
      setNow(Date.now());
      setStep('code');
    } catch {
      setError(t('genericError'));
    } finally {
      setBusy(false);
    }
  };

  // --- Verify ---
  const verify = async (code: string) => {
    if (!sentTo || submitted.current === code) return;
    submitted.current = code;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: sentTo.value, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) {
        setDigits(emptyCode());
        submitted.current = null;
        if (data.error === 'invalid' && typeof data.attemptsLeft === 'number') {
          setError(t('wrongCodeLeft', { count: data.attemptsLeft }));
        } else {
          setError(t(ERROR_KEYS[data.error] || 'wrongCode'));
        }
        return;
      }
      await signInWithLoginToken(data.token);
      // The login page redirects once the auth context has the user.
    } catch (err) {
      console.error('[Login] verify failed:', err);
      setDigits(emptyCode());
      submitted.current = null;
      setError(t('genericError'));
    } finally {
      setBusy(false);
    }
  };

  const clearSaved = () => {
    writeSaved(null);
    setInput('');
    setSavedShown(false);
  };

  // --- Render ---
  if (step === 'link-working') {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-text-secondary">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
        <p className="text-sm">{t('linkSigningIn')}</p>
      </div>
    );
  }

  if (step === 'link-email') {
    return (
      <form
        className="space-y-3 text-start"
        onSubmit={(e) => {
          e.preventDefault();
          const identity = parseLoginIdentity(input);
          if (identity?.kind === 'email') finishEmailLink(identity.value);
          else setError(t('invalidIdentifier'));
        }}
      >
        <p className="text-sm text-text-secondary">{t('linkNeedsEmail')}</p>
        <input
          type="email"
          dir="ltr"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(null); }}
          autoComplete="email"
          className="input text-start"
          autoFocus
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button type="submit" className="btn btn-primary w-full py-3">{t('linkContinue')}</button>
      </form>
    );
  }

  if (step === 'code' && sentTo) {
    const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));
    const shown = sentTo.kind === 'phone' ? formatPhoneForDisplay(sentTo.value) : sentTo.value;
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="w-10 h-10 rounded-full bg-accent/10 text-accent flex items-center justify-center">
            {sentTo.kind === 'email' ? <Mail className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
          </span>
          <p className="text-sm text-text-secondary">
            {sentTo.kind === 'email' ? t('codeSentEmail') : t('codeSentPhone')}
          </p>
          <p dir="ltr" className="text-sm font-semibold text-text-primary">{shown}</p>
        </div>

        <CodeBoxes
          value={digits}
          onChange={(next) => { setDigits(next); if (error) setError(null); }}
          onComplete={verify}
          disabled={busy}
          error={!!error}
          label={t('codeLabel')}
          digitLabel={(n) => t('digitLabel', { n })}
        />

        <div className="min-h-5 text-center text-sm" aria-live="polite">
          {busy ? (
            <span className="inline-flex items-center gap-2 text-text-secondary">
              <Loader2 className="w-4 h-4 animate-spin" /> {t('verifying')}
            </span>
          ) : error ? (
            <span className="text-danger">{error}</span>
          ) : sentTo.kind === 'email' ? (
            <span className="text-text-secondary">{t('emailLinkHint')}</span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
          {secondsLeft > 0 ? (
            <span className="text-text-secondary">{t('resendIn', { seconds: secondsLeft })}</span>
          ) : (
            <button type="button" onClick={sendCode} disabled={busy} className="text-accent hover:underline disabled:opacity-50">
              {t('resend')}
            </button>
          )}
          <button
            type="button"
            onClick={() => { setStep('identify'); setError(null); setSavedShown(false); }}
            className="text-text-secondary hover:text-text-primary hover:underline"
          >
            {t('changeIdentifier')}
          </button>
        </div>
        {sentTo.kind === 'email' && (
          <p className="text-xs text-center text-text-secondary">{t('checkSpam')}</p>
        )}
      </div>
    );
  }

  return (
    <form
      className="space-y-2 text-start"
      onSubmit={(e) => { e.preventDefault(); if (!busy) sendCode(); }}
    >
      <label htmlFor="login-identifier" className="block text-sm font-medium text-text-primary">
        {t('identifierLabel')}
      </label>
      <input
        id="login-identifier"
        type="text"
        dir="ltr"
        value={input}
        onChange={(e) => { setInput(e.target.value); setSavedShown(false); if (error) setError(null); }}
        placeholder={t('identifierPlaceholder')}
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="send"
        className="input text-start"
        aria-invalid={!!error}
      />
      {savedShown && (
        <button type="button" onClick={clearSaved} className="text-xs text-text-secondary hover:text-text-primary hover:underline">
          {t('notYou')}
        </button>
      )}
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <button
        type="submit"
        disabled={busy || !input.trim()}
        className="btn btn-primary w-full py-3 mt-1 disabled:opacity-50"
      >
        {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('sending')}</> : t('sendCode')}
      </button>
    </form>
  );
}
