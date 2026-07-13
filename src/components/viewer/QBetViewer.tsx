'use client';

// QBet ("הימור") participant viewer.
// Flow: full-screen poster (whole screen = tap target) → register (full name +
// phone) → WhatsApp OTP → score prediction with country flags → "bet received,
// wait for the final whistle". Once the owner publishes the final result the
// done screen flips to a win/lose screen (it polls /api/qbet/status).
//
// Mobile-first + minimalist by design; backgroundColor/fontColor come from the
// owner's config, buttons render inverted (bg=fontColor, text=backgroundColor).

import { useState, useEffect, useRef, useCallback } from 'react';
import { Check, Loader2, Lock, Minus, Plus, Trophy } from 'lucide-react';
import type { QBetConfig, QBetResult, QBetTeam } from '@/lib/qbet/types';
import { isBettingLocked, isWinningPrediction, DEFAULT_QBET_GRADIENT } from '@/lib/qbet/types';
import { isValidIsraeliMobile, formatPhoneForDisplay } from '@/lib/phone-utils';
import { getBrowserLocale, qbetTranslations, type PublicLocale } from '@/lib/publicTranslations';

interface QBetViewerProps {
  config: QBetConfig;
  codeId: string;
  shortId: string;
  ownerId: string;
}

type Step = 'landing' | 'register' | 'otp' | 'predict' | 'done' | 'locked';

interface StoredCreds {
  phone: string;
  token: string;
  name: string;
}

interface LiveState {
  locked: boolean;
  finalResult: QBetResult | null;
}

const OTP_LENGTH = 4;

// #rrggbb + alpha suffix; leaves other color formats untouched.
function withAlpha(hex: string, alphaHex: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}${alphaHex}` : hex;
}

// Shared keyframes: done-screen pop + animated CTA border (flowing gradient +
// shine sweep). Rendered on both the landing screen and the step screens.
const QBET_STYLE = `
@keyframes qbetPop{0%{transform:scale(.5);opacity:0}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
@keyframes qbetFlow{0%{background-position:0% 50%}100%{background-position:300% 50%}}
@keyframes qbetShine{0%{transform:translateX(-160%) skewX(-18deg)}55%,100%{transform:translateX(320%) skewX(-18deg)}}
.qbet-cta{animation:qbetFlow 5s linear infinite}
.qbet-cta-shine{position:absolute;top:0;bottom:0;left:0;width:45%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.35),transparent);animation:qbetShine 3.2s ease-in-out infinite;pointer-events:none}
`;

export default function QBetViewer({ config, codeId }: QBetViewerProps) {
  const [locale, setLocale] = useState<PublicLocale>('he');
  const t = qbetTranslations[locale];

  const [step, setStep] = useState<Step>('landing');
  const [liveState, setLiveState] = useState<LiveState>({
    locked: isBettingLocked(config),
    finalResult: config.finalResult ?? null,
  });

  // Registration
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  // OTP
  const [otpCode, setOtpCode] = useState('');
  const [resendLeft, setResendLeft] = useState(0);

  // Prediction
  const maxGoals = config.maxGoals ?? 15;
  const [predHome, setPredHome] = useState(0);
  const [predAway, setPredAway] = useState(0);
  const [savedPrediction, setSavedPrediction] = useState<QBetResult | null>(null);

  const [creds, setCreds] = useState<StoredCreds | null>(null);
  const [verifiedResume, setVerifiedResume] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const credsRef = useRef<StoredCreds | null>(null);
  credsRef.current = creds;
  const verifyingRef = useRef(false);

  const storageKey = `qbet_${codeId}`;
  const bg = config.backgroundColor || '#0b0f1a';
  const font = config.fontColor || '#ffffff';

  const persistCreds = useCallback(
    (next: StoredCreds | null) => {
      setCreds(next);
      try {
        if (next) localStorage.setItem(storageKey, JSON.stringify(next));
        else localStorage.removeItem(storageKey);
      } catch {
        /* private mode — session-only */
      }
    },
    [storageKey]
  );

  // Resume state + live lock/result. Safe to call without creds (state only).
  const refreshStatus = useCallback(
    async (stored: StoredCreds | null) => {
      try {
        const res = await fetch('/api/qbet/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codeId,
            phone: stored?.phone,
            token: stored?.token,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.state) {
          setLiveState({
            locked: !!data.state.locked,
            finalResult: data.state.finalResult ?? null,
          });
        }
        if (data.entry) {
          setVerifiedResume(true);
          if (data.entry.fullName) setFullName(data.entry.fullName);
          if (data.entry.prediction) {
            setSavedPrediction(data.entry.prediction);
            setPredHome(data.entry.prediction.home);
            setPredAway(data.entry.prediction.away);
          } else {
            setSavedPrediction(null);
          }
        }
      } catch {
        /* offline — keep config-provided state */
      }
    },
    [codeId]
  );

  useEffect(() => {
    setLocale(getBrowserLocale());
    let stored: StoredCreds | null = null;
    try {
      stored = JSON.parse(localStorage.getItem(storageKey) || 'null');
    } catch {
      stored = null;
    }
    if (stored?.phone && stored?.token) {
      setCreds(stored);
      setFullName(stored.name || '');
      setPhone(stored.phone);
      void refreshStatus(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resend cooldown ticker
  useEffect(() => {
    if (resendLeft <= 0) return;
    const iv = setInterval(() => setResendLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(iv);
  }, [resendLeft > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // While waiting for the final result, poll so the screen flips on its own.
  useEffect(() => {
    if (step !== 'done' || liveState.finalResult) return;
    const iv = setInterval(() => void refreshStatus(credsRef.current), 60 * 1000);
    return () => clearInterval(iv);
  }, [step, liveState.finalResult, refreshStatus]);

  // ---------- actions ----------

  const enterFromLanding = () => {
    setError(null);
    setInfo(null);
    if (verifiedResume && savedPrediction) {
      setStep('done');
    } else if (verifiedResume && !liveState.locked) {
      setStep('predict');
    } else if (liveState.locked) {
      setStep(savedPrediction ? 'done' : 'locked');
    } else {
      setStep('register');
    }
  };

  const requestCode = async (): Promise<void> => {
    setError(null);
    setInfo(null);
    const name = fullName.trim();
    if (name.length < 2) {
      setError(t.invalidName);
      return;
    }
    if (!isValidIsraeliMobile(phone)) {
      setError(t.invalidPhone);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/qbet/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId, phone, fullName: name, locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setOtpCode('');
        setResendLeft(45);
        setStep('otp');
        return;
      }
      switch (data.errorCode) {
        case 'LOCKED':
          setLiveState((s) => ({ ...s, locked: true }));
          setStep('locked');
          break;
        case 'COOLDOWN':
          // A code is already on its way — go type it.
          setOtpCode('');
          setResendLeft(data.secondsLeft || 30);
          setInfo(t.cooldown.replace('{seconds}', String(data.secondsLeft || 30)));
          setStep('otp');
          break;
        case 'RATE_LIMITED':
          setError(t.rateLimited);
          break;
        case 'SEND_FAILED':
          setError(t.sendFailed);
          break;
        case 'INVALID_PHONE':
          setError(t.invalidPhone);
          break;
        default:
          setError(t.genericError);
      }
    } catch {
      setError(t.genericError);
    } finally {
      setSubmitting(false);
    }
  };

  const verifyCode = async (code: string): Promise<void> => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/qbet/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId, phone, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.token) {
        const name = data.fullName || fullName.trim();
        persistCreds({ phone, token: data.token, name });
        setVerifiedResume(true);
        if (data.prediction) {
          setSavedPrediction(data.prediction);
          setPredHome(data.prediction.home);
          setPredAway(data.prediction.away);
          setStep('done');
        } else {
          setStep('predict');
        }
        return;
      }
      switch (data.errorCode) {
        case 'INVALID_CODE':
          setOtpCode('');
          setError(t.invalidCode);
          break;
        case 'EXPIRED':
          setOtpCode('');
          setError(t.codeExpired);
          break;
        case 'BLOCKED':
          setError(t.blocked);
          break;
        default:
          setError(t.genericError);
      }
    } catch {
      setError(t.genericError);
    } finally {
      setSubmitting(false);
      verifyingRef.current = false;
    }
  };

  const handleOtpChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setOtpCode(digits);
    if (digits.length === OTP_LENGTH) void verifyCode(digits);
  };

  const submitPrediction = async (): Promise<void> => {
    const stored = credsRef.current;
    if (!stored) {
      setStep('register');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/qbet/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeId,
          phone: stored.phone,
          token: stored.token,
          home: predHome,
          away: predAway,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSavedPrediction({ home: predHome, away: predAway });
        setStep('done');
        return;
      }
      switch (data.errorCode) {
        case 'LOCKED':
          setLiveState((s) => ({ ...s, locked: true }));
          setStep(savedPrediction ? 'done' : 'locked');
          break;
        case 'NOT_VERIFIED':
          // Token rotated (verified again elsewhere) — re-prove phone ownership.
          persistCreds(null);
          setVerifiedResume(false);
          setStep('register');
          setError(t.genericError);
          break;
        default:
          setError(t.genericError);
      }
    } catch {
      setError(t.genericError);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- UI pieces ----------

  const buttonStyle: React.CSSProperties = {
    background: font,
    color: bg,
  };
  const inputStyle: React.CSSProperties = {
    background: withAlpha(font, '14'),
    border: `1px solid ${withAlpha(font, '33')}`,
    color: font,
    caretColor: font,
  };

  const FlagImg = ({ team, size }: { team: QBetTeam; size: 'sm' | 'lg' }) => (
    <img
      src={team.flag}
      alt={team.name}
      className={
        size === 'lg'
          ? 'w-16 h-11 object-cover rounded-md shadow-lg'
          : 'w-9 h-6 object-cover rounded shadow'
      }
    />
  );

  const MatchHeader = () => (
    <div className="text-center mb-8">
      <h1 className="text-2xl font-bold leading-tight">{config.title}</h1>
      {config.matchLabel ? (
        <p className="mt-1 text-sm" style={{ color: withAlpha(font, 'B3') }}>
          {config.matchLabel}
        </p>
      ) : null}
      <div className="mt-4 flex items-center justify-center gap-3">
        <div className="flex items-center gap-2">
          <FlagImg team={config.teamHome} size="sm" />
          <span className="text-sm font-semibold">{config.teamHome.name}</span>
        </div>
        <span className="text-xs" style={{ color: withAlpha(font, '80') }}>
          VS
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{config.teamAway.name}</span>
          <FlagImg team={config.teamAway} size="sm" />
        </div>
      </div>
    </div>
  );

  const Feedback = () =>
    error || info ? (
      <p
        className="text-sm text-center mt-3"
        style={{ color: error ? '#f87171' : withAlpha(font, 'B3') }}
      >
        {error || info}
      </p>
    ) : null;

  const ScoreLine = ({ result }: { result: QBetResult }) => (
    <div className="flex items-center justify-center gap-4">
      <div className="flex flex-col items-center gap-1.5">
        <FlagImg team={config.teamHome} size="sm" />
        <span className="text-xs font-medium" style={{ color: withAlpha(font, 'B3') }}>
          {config.teamHome.name}
        </span>
      </div>
      <span className="text-3xl font-bold tabular-nums" dir="ltr">
        {result.home} : {result.away}
      </span>
      <div className="flex flex-col items-center gap-1.5">
        <FlagImg team={config.teamAway} size="sm" />
        <span className="text-xs font-medium" style={{ color: withAlpha(font, 'B3') }}>
          {config.teamAway.name}
        </span>
      </div>
    </div>
  );

  const Stepper = ({
    team,
    value,
    onChange,
  }: {
    team: QBetTeam;
    value: number;
    onChange: (v: number) => void;
  }) => (
    <div className="flex-1 flex flex-col items-center gap-3">
      <FlagImg team={team} size="lg" />
      <span className="text-base font-semibold text-center leading-tight">{team.name}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(maxGoals, value + 1))}
        disabled={value >= maxGoals}
        aria-label={`+ ${team.name}`}
        className="w-12 h-12 rounded-full flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40"
        style={{ border: `1px solid ${withAlpha(font, '44')}`, color: font }}
      >
        <Plus className="w-5 h-5" />
      </button>
      <span className="text-5xl font-bold tabular-nums leading-none">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
        aria-label={`- ${team.name}`}
        className="w-12 h-12 rounded-full flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40"
        style={{ border: `1px solid ${withAlpha(font, '44')}`, color: font }}
      >
        <Minus className="w-5 h-5" />
      </button>
    </div>
  );

  // ---------- screens ----------

  // Animated CTA: flowing multi-color gradient border + glow + shine sweep.
  const gradient =
    config.buttonGradient && config.buttonGradient.length >= 2
      ? config.buttonGradient
      : DEFAULT_QBET_GRADIENT;
  const CtaButton = () => (
    <span
      className="qbet-cta relative block rounded-full p-[3px] mx-auto w-full max-w-xs"
      style={{
        backgroundImage: `linear-gradient(90deg, ${[...gradient, gradient[0]].join(', ')})`,
        backgroundSize: '300% 100%',
        boxShadow: `0 0 26px ${withAlpha(gradient[0], '66')}, 0 0 12px ${withAlpha(gradient[gradient.length - 1], '4D')}`,
      }}
    >
      <span className="relative block overflow-hidden rounded-full">
        <span
          className="flex items-center justify-center h-14 px-6 rounded-full text-lg font-bold whitespace-nowrap"
          style={{
            background: 'rgba(6, 9, 18, 0.72)',
            color: config.buttonTextColor || '#ffffff',
            backdropFilter: 'blur(4px)',
          }}
        >
          {config.buttonText || t.registerTitle}
        </span>
        <span className="qbet-cta-shine" aria-hidden="true" />
      </span>
    </span>
  );

  // Landing: the poster IS the page; the whole screen is the tap target.
  // Composition: bg image + optional transparent-PNG logo (top) + optional
  // title text overlay + the animated CTA button pinned near the bottom.
  if (step === 'landing') {
    return (
      <button
        type="button"
        onClick={enterFromLanding}
        aria-label={t.enterAria}
        className="relative block w-full min-h-[100dvh] cursor-pointer text-start"
        style={{ background: bg, color: font }}
        dir={locale === 'he' ? 'rtl' : 'ltr'}
      >
        <style>{QBET_STYLE}</style>
        {config.backgroundImageUrl ? (
          <>
            <img
              src={config.backgroundImageUrl}
              alt={config.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {(config.logoUrl || config.landingTitle) && (
              <span className="absolute inset-x-0 top-0 pt-[5dvh] px-8 flex flex-col items-center gap-4 pointer-events-none">
                {config.logoUrl && (
                  <img
                    src={config.logoUrl}
                    alt=""
                    className="max-h-[13dvh] max-w-[65%] object-contain"
                    style={{ filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.5))' }}
                  />
                )}
                {config.landingTitle && (
                  <span
                    className="text-[2.6rem] font-extrabold text-center leading-tight"
                    style={{ color: font, textShadow: '0 2px 18px rgba(0,0,0,0.65)' }}
                  >
                    {config.landingTitle}
                  </span>
                )}
              </span>
            )}
            <span className="absolute inset-x-6 bottom-[6dvh] pointer-events-none">
              <CtaButton />
            </span>
          </>
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-8 text-center">
            {config.logoUrl && (
              <img
                src={config.logoUrl}
                alt=""
                className="max-h-[13dvh] max-w-[65%] object-contain"
                style={{ filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.5))' }}
              />
            )}
            <span className="text-3xl font-bold">{config.landingTitle || config.title}</span>
            <span className="flex items-center gap-4">
              <FlagImg team={config.teamHome} size="lg" />
              <span className="text-lg font-semibold" style={{ color: withAlpha(font, '80') }}>
                VS
              </span>
              <FlagImg team={config.teamAway} size="lg" />
            </span>
            <span className="block w-full mt-2 pointer-events-none">
              <CtaButton />
            </span>
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className="min-h-[100dvh] w-full flex flex-col items-center justify-center px-6 py-10"
      style={{ background: bg, color: font }}
      dir={locale === 'he' ? 'rtl' : 'ltr'}
    >
      <style>{QBET_STYLE}</style>
      <div className="w-full max-w-sm">
        {step === 'register' && (
          <>
            <MatchHeader />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void requestCode();
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="block text-sm font-medium" htmlFor="qbet-name">
                  {t.fullNameLabel}
                </label>
                <input
                  id="qbet-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t.fullNamePlaceholder}
                  autoComplete="name"
                  maxLength={60}
                  className="w-full h-12 px-4 rounded-xl text-base outline-none placeholder:opacity-50"
                  style={inputStyle}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium" htmlFor="qbet-phone">
                  {t.phoneLabel}
                </label>
                <input
                  id="qbet-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t.phonePlaceholder}
                  autoComplete="tel"
                  inputMode="tel"
                  dir="ltr"
                  className="w-full h-12 px-4 rounded-xl text-base outline-none text-center placeholder:opacity-50"
                  style={inputStyle}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 rounded-xl text-base font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
                style={buttonStyle}
              >
                {submitting && <Loader2 className="w-5 h-5 animate-spin" />}
                {submitting ? t.sending : t.sendCode}
              </button>
              <Feedback />
            </form>
          </>
        )}

        {step === 'otp' && (
          <>
            <MatchHeader />
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <h2 className="text-lg font-semibold">{t.otpTitle}</h2>
                <p className="text-sm" style={{ color: withAlpha(font, 'B3') }}>
                  {t.otpSentTo}{' '}
                  <span dir="ltr" className="font-semibold whitespace-nowrap">
                    {formatPhoneForDisplay(phone)}
                  </span>
                </p>
              </div>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => handleOtpChange(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={OTP_LENGTH}
                dir="ltr"
                autoFocus
                aria-label={t.otpTitle}
                className="w-full h-14 rounded-xl text-center text-3xl font-bold tracking-[0.5em] outline-none"
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => void verifyCode(otpCode)}
                disabled={submitting || otpCode.length < OTP_LENGTH}
                className="w-full h-12 rounded-xl text-base font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
                style={buttonStyle}
              >
                {submitting && <Loader2 className="w-5 h-5 animate-spin" />}
                {submitting ? t.verifying : t.verify}
              </button>
              <Feedback />
              <div className="flex items-center justify-between text-sm pt-1">
                {resendLeft > 0 ? (
                  <span style={{ color: withAlpha(font, '80') }}>
                    {t.resendIn.replace('{seconds}', String(resendLeft))}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void requestCode()}
                    disabled={submitting}
                    className="underline underline-offset-4 disabled:opacity-50"
                  >
                    {t.resend}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setStep('register');
                    setError(null);
                    setInfo(null);
                  }}
                  className="underline underline-offset-4"
                  style={{ color: withAlpha(font, 'B3') }}
                >
                  {t.changePhone}
                </button>
              </div>
            </div>
          </>
        )}

        {step === 'predict' && (
          <>
            <MatchHeader />
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-center">{t.predictTitle}</h2>
              <div
                className="rounded-2xl p-5"
                style={{
                  background: withAlpha(font, '0D'),
                  border: `1px solid ${withAlpha(font, '22')}`,
                }}
              >
                <div className="flex items-start justify-center gap-2">
                  <Stepper team={config.teamHome} value={predHome} onChange={setPredHome} />
                  <span className="text-4xl font-bold self-center pb-2">:</span>
                  <Stepper team={config.teamAway} value={predAway} onChange={setPredAway} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => void submitPrediction()}
                disabled={submitting}
                className="w-full h-12 rounded-xl text-base font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
                style={buttonStyle}
              >
                {submitting && <Loader2 className="w-5 h-5 animate-spin" />}
                {submitting ? t.savingPrediction : t.sendPrediction}
              </button>
              <Feedback />
            </div>
          </>
        )}

        {step === 'done' && (
          <div className="text-center space-y-8">
            <div
              className="mx-auto w-20 h-20 rounded-full flex items-center justify-center"
              style={{
                border: `2px solid ${font}`,
                animation: 'qbetPop .45s ease-out',
              }}
            >
              {liveState.finalResult &&
              isWinningPrediction(savedPrediction, liveState.finalResult) ? (
                <Trophy className="w-9 h-9" />
              ) : (
                <Check className="w-10 h-10" />
              )}
            </div>

            {liveState.finalResult ? (
              <>
                <div className="space-y-4">
                  <h2 className="text-sm font-medium uppercase tracking-wide" style={{ color: withAlpha(font, '80') }}>
                    {t.finalResultTitle}
                  </h2>
                  <ScoreLine result={liveState.finalResult} />
                </div>
                <div className="space-y-1">
                  {isWinningPrediction(savedPrediction, liveState.finalResult) ? (
                    <>
                      <h3 className="text-2xl font-bold">{t.youWon}</h3>
                      <p className="text-sm" style={{ color: withAlpha(font, 'B3') }}>
                        {t.youWonSub}
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-2xl font-bold">{t.youLost}</h3>
                      <p className="text-sm" style={{ color: withAlpha(font, 'B3') }}>
                        {t.youLostSub}
                      </p>
                    </>
                  )}
                </div>
                {savedPrediction && (
                  <div className="space-y-2">
                    <p className="text-xs" style={{ color: withAlpha(font, '80') }}>
                      {t.yourPick}
                    </p>
                    <span className="text-xl font-bold tabular-nums" dir="ltr">
                      {savedPrediction.home} : {savedPrediction.away}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold">{t.doneTitle}</h2>
                {savedPrediction && (
                  <div className="space-y-3">
                    <p className="text-xs" style={{ color: withAlpha(font, '80') }}>
                      {t.yourPick}
                    </p>
                    <ScoreLine result={savedPrediction} />
                  </div>
                )}
                <div
                  className="flex items-center justify-center gap-2 text-sm"
                  style={{ color: withAlpha(font, 'B3') }}
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t.waitingForResult}</span>
                </div>
                {!liveState.locked && (
                  <button
                    type="button"
                    onClick={() => {
                      if (savedPrediction) {
                        setPredHome(savedPrediction.home);
                        setPredAway(savedPrediction.away);
                      }
                      setError(null);
                      setStep('predict');
                    }}
                    className="text-sm underline underline-offset-4"
                    style={{ color: withAlpha(font, 'B3') }}
                  >
                    {t.editPrediction}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {step === 'locked' && (
          <div className="text-center space-y-6">
            <div
              className="mx-auto w-20 h-20 rounded-full flex items-center justify-center"
              style={{ border: `2px solid ${withAlpha(font, '66')}` }}
            >
              <Lock className="w-9 h-9" />
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold">{t.lockedTitle}</h2>
              <p className="text-sm" style={{ color: withAlpha(font, 'B3') }}>
                {t.lockedText}
              </p>
            </div>
            {liveState.finalResult && (
              <div className="space-y-4 pt-2">
                <h3 className="text-sm font-medium" style={{ color: withAlpha(font, '80') }}>
                  {t.finalResultTitle}
                </h3>
                <ScoreLine result={liveState.finalResult} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
