'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowLeft, MessageCircle } from 'lucide-react';
import type { ResolvedSocialWallConfig } from '@/types/socialwall';
import { accessNeedsOtp } from '@/types/socialwall';
import { SwApiError, swApi, type JoinResult } from './api';
import { errorText, type SocialWallStrings } from './i18n';
import { Field, PrimaryButton, inputClass } from './ui';

type Step = 'form' | 'code';

export function GroupSelect({
  config, value, onChange, t,
}: {
  config: ResolvedSocialWallConfig; value: string; onChange: (v: string) => void; t: SocialWallStrings;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {config.groups.map((g) => {
        const active = value === g.id;
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => onChange(g.id)}
            aria-pressed={active}
            className={`min-h-[44px] px-4 rounded-full text-[15px] font-semibold border transition-all active:scale-95 ${
              active ? 'text-white border-transparent shadow-md' : 'bg-white text-gray-800 border-gray-200'
            }`}
            style={active ? { background: 'linear-gradient(135deg, var(--sw-primary), var(--sw-secondary))' } : undefined}
          >
            {g.label}
          </button>
        );
      })}
      {!config.groups.length && <span className="text-sm text-gray-500">{t.chooseGroup}</span>}
    </div>
  );
}

/** First-time name/group (allowlist rows without them) and "edit details" later. */
export function ProfileForm({
  config, t, initialName, initialGroup, onSave, saveLabel,
}: {
  config: ResolvedSocialWallConfig;
  t: SocialWallStrings;
  initialName: string;
  initialGroup: string | null;
  saveLabel: string;
  onSave: (name: string, groupId: string | null) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [group, setGroup] = useState(initialGroup || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groupLabel = config.groupLabel || t.yourGroup;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError(t.invalidName);
    if (config.groups.length && !group) return setError(t.chooseGroupError);
    setBusy(true);
    setError(null);
    try {
      await onSave(name.trim(), group || null);
    } catch (err) {
      setError(errorText(t, err instanceof SwApiError ? err.code : undefined));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label={t.yourName}>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder} maxLength={40} autoComplete="name" enterKeyHint="next" />
      </Field>
      {config.groups.length > 0 && (
        <Field label={groupLabel} group>
          <GroupSelect config={config} value={group} onChange={setGroup} t={t} />
        </Field>
      )}
      {error && <p className="text-sm text-red-600 sw-fade">{error}</p>}
      <PrimaryButton type="submit" loading={busy}>{saveLabel}</PrimaryButton>
    </form>
  );
}

export default function JoinFlow({
  codeId, config, t, dir, onJoined,
}: {
  codeId: string;
  config: ResolvedSocialWallConfig;
  t: SocialWallStrings;
  dir: 'rtl' | 'ltr';
  onJoined: (result: JoinResult) => void;
}) {
  const access = config.access;
  const needsOtp = accessNeedsOtp(access);
  const asksProfileFirst = access === 'open' || access === 'whatsapp';
  const [step, setStep] = useState<Step>('form');
  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeLength, setCodeLength] = useState(6);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const verifying = useRef(false);
  const groupLabel = config.groupLabel || t.yourGroup;
  const Back = dir === 'rtl' ? ArrowRight : ArrowLeft;

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  useEffect(() => {
    if (step === 'code') setTimeout(() => codeRef.current?.focus(), 250);
  }, [step]);

  const fail = (err: unknown) => {
    const e = err instanceof SwApiError ? err : null;
    let msg = errorText(t, e?.code);
    if (e?.code === 'WRONG_CODE' && typeof e.extra.attemptsLeft === 'number') msg += ` · ${e.extra.attemptsLeft} ${t.attemptsLeft}`;
    if (e?.code === 'COOLDOWN' && typeof e.extra.secondsLeft === 'number') setCooldown(e.extra.secondsLeft);
    setError(msg);
  };

  const validateProfile = () => {
    if (!asksProfileFirst) return true;
    if (name.trim().length < 2) {
      setError(t.invalidName);
      return false;
    }
    if (config.groups.length && !group) {
      setError(t.chooseGroupError);
      return false;
    }
    return true;
  };

  const base = () => ({ codeId, locale: config.locale, name: name.trim() || undefined, groupId: group || undefined });

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validateProfile()) return;
    if (access !== 'open' && phone.replace(/\D/g, '').length < 9) return setError(t.invalidPhone);
    setBusy(true);
    try {
      if (access === 'open') onJoined(await swApi.join({ ...base(), action: 'open' }));
      else if (!needsOtp) onJoined(await swApi.join({ ...base(), action: 'phone', phone }));
      else {
        const res = await swApi.join({ ...base(), action: 'send', phone });
        setCodeLength(res.codeLength || 6);
        setCooldown(res.cooldownSeconds || 45);
        setCode('');
        setStep('code');
      }
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value: string) => {
    if (verifying.current) return;
    verifying.current = true;
    setBusy(true);
    setError(null);
    try {
      onJoined(await swApi.join({ ...base(), action: 'verify', phone, code: value }));
    } catch (err) {
      fail(err);
      setCode('');
      codeRef.current?.focus();
    } finally {
      verifying.current = false;
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await swApi.join({ ...base(), action: 'send', phone });
      setCooldown(res.cooldownSeconds || 45);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  if (step === 'code') {
    return (
      <div className="space-y-6 sw-enter">
        <button type="button" onClick={() => { setStep('form'); setError(null); }} className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 min-h-[44px]">
          <Back className="w-4 h-4" />
          {t.changePhone}
        </button>
        <div className="flex items-center gap-3 rounded-2xl bg-green-50 border border-green-100 p-4">
          <MessageCircle className="w-6 h-6 text-green-600 shrink-0" />
          <p className="text-[15px] text-gray-800">
            {t.codeSentTo}
            <span dir="ltr" className="font-bold">{phone}</span>
          </p>
        </div>
        <Field label={t.enterCode}>
          <input
            ref={codeRef}
            value={code}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, codeLength);
              setCode(v);
              if (v.length === codeLength) void verify(v);
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            className={`${inputClass} text-center text-3xl font-bold tracking-[.6em] min-h-[64px]`}
            maxLength={codeLength}
            aria-label={t.enterCode}
          />
        </Field>
        {error && <p className="text-sm text-red-600 text-center sw-fade">{error}</p>}
        <PrimaryButton onClick={() => verify(code)} disabled={code.length !== codeLength} loading={busy}>{t.verify}</PrimaryButton>
        <div className="text-center">
          {cooldown > 0 ? (
            <span className="text-sm text-gray-500">{t.resendIn} {cooldown} {t.seconds}</span>
          ) : (
            <button type="button" onClick={resend} className="text-sm font-bold min-h-[44px] px-3" style={{ color: 'var(--sw-primary)' }}>
              {t.resend}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submitForm} className="space-y-5 sw-enter">
      {asksProfileFirst && (
        <>
          <Field label={t.yourName}>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder} maxLength={40} autoComplete="name" enterKeyHint="next" />
          </Field>
          {config.groups.length > 0 && (
            <Field label={groupLabel} group>
              <GroupSelect config={config} value={group} onChange={setGroup} t={t} />
            </Field>
          )}
        </>
      )}
      {access !== 'open' && (
        <Field label={t.phone}>
          <input
            className={inputClass}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d+\-\s]/g, ''))}
            placeholder={t.phonePlaceholder}
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            maxLength={16}
          />
        </Field>
      )}
      {error && <p className="text-sm text-red-600 sw-fade">{error}</p>}
      <PrimaryButton type="submit" loading={busy}>
        {needsOtp ? (
          <>
            <MessageCircle className="w-5 h-5" />
            {t.sendCode}
          </>
        ) : (
          t.join
        )}
      </PrimaryButton>
    </form>
  );
}
