'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { QRCodeSVG } from 'qrcode.react';
import {
  UserPlus,
  Check,
  Loader2,
  Users,
  Minus,
  Plus,
  ChevronRight,
  Calendar,
  MapPin,
  Clock,
  X,
} from 'lucide-react';
import type { QTagConfig, QTagPhase } from '@/types/qtag';

interface QTagViewerProps {
  config: QTagConfig;
  codeId: string;
  shortId: string;
  ownerId?: string;
}

type ViewScreen = 'landing' | 'form' | 'verifying' | 'success' | 'closed';

const translations = {
  he: {
    register: 'הרשמה לאירוע',
    registerButton: 'הירשמו עכשיו',
    name: 'שם / כינוי',
    namePlaceholder: 'הכניסו את השם שלכם',
    phone: 'מספר טלפון',
    phonePlaceholder: '050-000-0000',
    plusOne: 'מגיע/ה עם עוד מישהו?',
    plusOneCount: 'כמה אורחים נוספים',
    guestMale: 'בן',
    guestFemale: 'בת',
    guestName: 'שם האורח/ת',
    guestNamePlaceholder: 'שם (אופציונלי)',
    submit: 'שליחה',
    submitting: 'נרשם...',
    successTitle: 'נרשמתם בהצלחה!',
    successMessage: 'שימרו את הQR הזה לכניסה לאירוע',
    saveQR: 'שמור QR',
    registrationClosed: 'ההרשמה סגורה',
    eventEnded: 'האירוע הסתיים',
    eventFull: 'האירוע מלא',
    phoneExists: 'מספר הטלפון הזה כבר רשום',
    invalidPhone: 'מספר טלפון לא תקין',
    nameTooShort: 'שם חייב להכיל לפחות 2 תווים',
    errorGeneric: 'שגיאה בהרשמה, נסו שוב',
    verifyPhone: 'אימות טלפון',
    verifyMessage: 'שלחנו קוד אימות ל',
    enterCode: 'הכניסו את הקוד',
    verify: 'אימות',
    resendCode: 'שלח קוד מחדש',
    resendIn: 'שליחה חוזרת בעוד',
    seconds: 'שניות',
    verifying: 'מאמת...',
    invalidCode: 'קוד לא נכון',
    codeExpired: 'הקוד פג תוקף, שלחו מחדש',
    tooManyAttempts: 'יותר מדי ניסיונות',
    back: 'חזרה',
    guests: 'אורחים',
  },
  en: {
    register: 'Event Registration',
    registerButton: 'Register Now',
    name: 'Name / Nickname',
    namePlaceholder: 'Enter your name',
    phone: 'Phone Number',
    phonePlaceholder: '050-000-0000',
    plusOne: 'Bringing someone?',
    plusOneCount: 'How many additional guests',
    guestMale: 'Male',
    guestFemale: 'Female',
    guestName: 'Guest name',
    guestNamePlaceholder: 'Name (optional)',
    submit: 'Submit',
    submitting: 'Registering...',
    successTitle: 'Successfully Registered!',
    successMessage: 'Save this QR code for event entry',
    saveQR: 'Save QR',
    registrationClosed: 'Registration is closed',
    eventEnded: 'The event has ended',
    eventFull: 'Event is full',
    phoneExists: 'This phone number is already registered',
    invalidPhone: 'Invalid phone number',
    nameTooShort: 'Name must be at least 2 characters',
    errorGeneric: 'Registration failed, please try again',
    verifyPhone: 'Phone Verification',
    verifyMessage: 'We sent a verification code to',
    enterCode: 'Enter the code',
    verify: 'Verify',
    resendCode: 'Resend code',
    resendIn: 'Resend in',
    seconds: 'seconds',
    verifying: 'Verifying...',
    invalidCode: 'Invalid code',
    codeExpired: 'Code expired, please resend',
    tooManyAttempts: 'Too many attempts',
    back: 'Back',
    guests: 'guests',
  },
};

export default function QTagViewer({ config: initialConfig, codeId, shortId }: QTagViewerProps) {
  const [config, setConfig] = useState<QTagConfig>(initialConfig);
  const [screen, setScreen] = useState<ViewScreen>('landing');
  const locale = 'he'; // Default Hebrew
  const t = translations[locale];
  const isRTL = locale === 'he';

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [hasPlusOne, setHasPlusOne] = useState(false);
  const [plusOneCount, setPlusOneCount] = useState(1);
  const [plusOneGender, setPlusOneGender] = useState<'male' | 'female' | null>(null);
  const [plusOneName, setPlusOneName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Registration result
  const [guestId, setGuestId] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);

  // Verification state
  const [otpCode, setOtpCode] = useState(['', '', '', '']);
  const [verificationSent, setVerificationSent] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Real-time config updates
  useEffect(() => {
    if (!db || !codeId) return;

    const unsubscribe = onSnapshot(doc(db, 'codes', codeId), (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      const qtagMedia = data.media?.find((m: { type: string }) => m.type === 'qtag');
      if (qtagMedia?.qtagConfig) {
        setConfig(qtagMedia.qtagConfig);
      }
    });

    return () => unsubscribe();
  }, [codeId]);

  // Determine initial screen based on phase
  useEffect(() => {
    if (config.currentPhase !== 'registration' && screen === 'landing') {
      setScreen('closed');
    }
  }, [config.currentPhase, screen]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const branding = config.branding;
  const overlayOpacity = branding.imageOverlayOpacity ?? 40;

  // Format phone as user types
  const formatPhoneInput = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneInput(e.target.value);
    setPhone(formatted);
  };

  // Submit registration
  const handleSubmit = async () => {
    setError(null);

    // Validate
    if (name.trim().length < 2) {
      setError(t.nameTooShort);
      return;
    }

    const rawPhone = phone.replace(/\D/g, '');
    if (rawPhone.length < 9 || rawPhone.length > 10) {
      setError(t.invalidPhone);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/qtag/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeId,
          name: name.trim(),
          phone: rawPhone,
          plusOneCount: hasPlusOne ? plusOneCount : 0,
          plusOneDetails: hasPlusOne ? [{
            name: plusOneName.trim() || undefined,
            gender: plusOneGender || undefined,
          }] : [],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.errorCode === 'PHONE_EXISTS') {
          setError(t.phoneExists);
        } else if (data.errorCode === 'INVALID_PHONE') {
          setError(t.invalidPhone);
        } else if (data.errorCode === 'CAPACITY_FULL') {
          setError(t.eventFull);
        } else if (data.errorCode === 'REGISTRATION_CLOSED') {
          setError(t.registrationClosed);
        } else {
          setError(data.error || t.errorGeneric);
        }
        return;
      }

      setGuestId(data.guestId);
      setQrToken(data.qrToken);

      // If verification is needed, go to verify screen
      if (config.verification?.enabled && !data.isVerified) {
        setScreen('verifying');
        await sendVerificationCode();
      } else {
        setScreen('success');
      }
    } catch {
      setError(t.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  };

  // Send verification code
  const sendVerificationCode = useCallback(async () => {
    try {
      const res = await fetch('/api/qtag/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeId,
          phone: phone.replace(/\D/g, ''),
          action: 'send',
          locale,
        }),
      });

      if (res.ok) {
        setVerificationSent(true);
        setResendCooldown(60);
      }
    } catch {
      // Silently fail - user can resend
    }
  }, [codeId, phone, locale]);

  // Verify OTP code
  const handleVerify = async () => {
    const code = otpCode.join('');
    if (code.length !== 4) return;

    setVerifyError(null);
    setVerifyingCode(true);

    try {
      const res = await fetch('/api/qtag/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeId,
          phone: phone.replace(/\D/g, ''),
          action: 'verify',
          code,
          guestId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.errorCode === 'INVALID_CODE') setVerifyError(t.invalidCode);
        else if (data.errorCode === 'EXPIRED') setVerifyError(t.codeExpired);
        else if (data.errorCode === 'BLOCKED') setVerifyError(t.tooManyAttempts);
        else setVerifyError(data.error || t.errorGeneric);
        return;
      }

      setScreen('success');
    } catch {
      setVerifyError(t.errorGeneric);
    } finally {
      setVerifyingCode(false);
    }
  };

  // OTP input handling
  const handleOTPChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otpCode];
    newOtp[index] = value.slice(-1);
    setOtpCode(newOtp);

    // Auto-focus next input
    if (value && index < 3) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }

    // Auto-submit when all filled
    if (value && index === 3 && newOtp.every(d => d)) {
      setTimeout(() => handleVerify(), 100);
    }
  };

  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  // QR data for the guest
  const qrData = qrToken ? JSON.stringify({ t: 'qtag', c: codeId, tk: qrToken }) : '';

  // ── Landing Screen ──
  const renderLanding = () => (
    <div className="min-h-dvh flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background image */}
      {branding.backgroundImageUrl && (
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={branding.backgroundImageUrl}
            alt=""
            className="w-full h-full object-cover"
            style={{ animation: 'landingZoom 8s ease-out forwards' }}
          />
          <div
            className="absolute inset-0"
            style={{ backgroundColor: `rgba(0, 0, 0, ${overlayOpacity / 100})` }}
          />
        </div>
      )}

      {/* Fallback gradient background */}
      {!branding.backgroundImageUrl && (
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${branding.colors.background} 0%, ${branding.colors.accent || '#2d1b69'} 100%)` }}
        />
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-md mx-auto">
        {/* Logo */}
        {branding.logoUrl && (
          <img
            src={branding.logoUrl}
            alt=""
            className="object-contain drop-shadow-lg mb-6"
            style={{
              maxHeight: `${120 * (branding.logoScale ?? 1)}px`,
              animation: 'bounceIn 0.6s ease-out',
            }}
          />
        )}

        {/* Title */}
        {(branding.title || config.eventName) && (
          <h1
            className="text-3xl sm:text-4xl font-bold mb-3 font-assistant"
            style={{ color: branding.backgroundImageUrl ? '#ffffff' : branding.colors.text }}
          >
            {branding.title || config.eventName}
          </h1>
        )}

        {/* Subtitle */}
        {branding.subtitle && (
          <p
            className="text-lg mb-2 opacity-90 font-assistant"
            style={{ color: branding.backgroundImageUrl ? '#ffffff' : branding.colors.text }}
          >
            {branding.subtitle}
          </p>
        )}

        {/* Event info */}
        <div className="flex flex-wrap justify-center gap-3 mt-2 mb-8">
          {config.eventDate && (
            <span
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full"
              style={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(8px)',
                color: branding.backgroundImageUrl ? '#ffffff' : branding.colors.text,
              }}
            >
              <Calendar className="w-3.5 h-3.5" />
              {new Date(config.eventDate).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </span>
          )}
          {config.eventTime && (
            <span
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full"
              style={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(8px)',
                color: branding.backgroundImageUrl ? '#ffffff' : branding.colors.text,
              }}
            >
              <Clock className="w-3.5 h-3.5" />
              {config.eventTime}
            </span>
          )}
          {config.eventLocation && (
            <span
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full"
              style={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(8px)',
                color: branding.backgroundImageUrl ? '#ffffff' : branding.colors.text,
              }}
            >
              <MapPin className="w-3.5 h-3.5" />
              {config.eventLocation}
            </span>
          )}
        </div>

        {/* Register button */}
        <button
          onClick={() => setScreen('form')}
          className="px-8 py-4 rounded-2xl font-semibold text-lg transition-all hover:scale-105 active:scale-95 shadow-xl flex items-center gap-2 font-assistant"
          style={{
            backgroundColor: branding.colors.buttonBackground,
            color: branding.colors.buttonText,
          }}
        >
          <UserPlus className="w-5 h-5" />
          {branding.registerButtonText || t.registerButton}
        </button>
      </div>

      <style jsx>{`
        @keyframes landingZoom {
          0% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes bounceIn {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.95); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );

  // ── Registration Form ──
  const renderForm = () => (
    <div
      className="min-h-dvh flex flex-col"
      style={{ backgroundColor: branding.colors.background }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header with back button */}
      <div className="flex items-center p-4 gap-3">
        <button
          onClick={() => setScreen('landing')}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
        >
          <ChevronRight className={`w-5 h-5 ${isRTL ? '' : 'rotate-180'}`} style={{ color: branding.colors.text }} />
        </button>
        <h2 className="text-xl font-bold font-assistant" style={{ color: branding.colors.text }}>
          {t.register}
        </h2>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 pb-8 space-y-5">
        {/* Name input */}
        <div className="space-y-2">
          <label className="text-sm font-medium font-assistant" style={{ color: branding.colors.text, opacity: 0.8 }}>
            {t.name} <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.namePlaceholder}
            maxLength={50}
            className="w-full px-4 py-3.5 rounded-xl border border-white/10 bg-white/5 focus:outline-none focus:ring-2 focus:border-transparent transition-all font-assistant text-base"
            style={{
              color: branding.colors.text,
              // @ts-expect-error -- Tailwind CSS custom property for ring color
              '--tw-ring-color': branding.colors.buttonBackground,
            }}
            dir={isRTL ? 'rtl' : 'ltr'}
          />
        </div>

        {/* Phone input */}
        <div className="space-y-2">
          <label className="text-sm font-medium font-assistant" style={{ color: branding.colors.text, opacity: 0.8 }}>
            {t.phone} <span className="text-red-400">*</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={handlePhoneChange}
            placeholder={t.phonePlaceholder}
            maxLength={12}
            className="w-full px-4 py-3.5 rounded-xl border border-white/10 bg-white/5 focus:outline-none focus:ring-2 focus:border-transparent transition-all font-assistant text-base"
            style={{ color: branding.colors.text }}
            dir="ltr"
          />
        </div>

        {/* +1 Toggle */}
        {config.allowPlusOne && (
          <div className="space-y-3">
            <button
              onClick={() => setHasPlusOne(!hasPlusOne)}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all font-assistant"
              style={{
                borderColor: hasPlusOne ? branding.colors.buttonBackground : 'rgba(255,255,255,0.1)',
                backgroundColor: hasPlusOne ? `${branding.colors.buttonBackground}15` : 'rgba(255,255,255,0.05)',
                color: branding.colors.text,
              }}
            >
              <span className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                {t.plusOne}
              </span>
              <div
                className="w-12 h-7 rounded-full relative transition-colors"
                style={{
                  backgroundColor: hasPlusOne ? branding.colors.buttonBackground : 'rgba(255,255,255,0.2)',
                }}
              >
                <div
                  className="absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-sm"
                  style={{ [isRTL ? 'right' : 'left']: hasPlusOne ? '1.5rem' : '0.25rem' }}
                />
              </div>
            </button>

            {/* +1 Details */}
            {hasPlusOne && (
              <div className="space-y-3 ps-2 border-s-2 ms-3" style={{ borderColor: `${branding.colors.buttonBackground}40` }}>
                {/* Guest count */}
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-sm font-assistant" style={{ color: branding.colors.text, opacity: 0.8 }}>
                    {t.plusOneCount}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setPlusOneCount(Math.max(1, plusOneCount - 1))}
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                      disabled={plusOneCount <= 1}
                    >
                      <Minus className="w-4 h-4" style={{ color: branding.colors.text }} />
                    </button>
                    <span className="text-lg font-bold w-6 text-center" style={{ color: branding.colors.text }}>
                      {plusOneCount}
                    </span>
                    <button
                      onClick={() => setPlusOneCount(Math.min(config.maxGuestsPerRegistration || 1, plusOneCount + 1))}
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                      disabled={plusOneCount >= (config.maxGuestsPerRegistration || 1)}
                    >
                      <Plus className="w-4 h-4" style={{ color: branding.colors.text }} />
                    </button>
                  </div>
                </div>

                {/* Guest gender */}
                {config.requireGuestGender && (
                  <div className="flex gap-2 px-4">
                    {(['male', 'female'] as const).map((gender) => (
                      <button
                        key={gender}
                        onClick={() => setPlusOneGender(gender)}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all font-assistant"
                        style={{
                          backgroundColor: plusOneGender === gender ? branding.colors.buttonBackground : 'rgba(255,255,255,0.05)',
                          color: plusOneGender === gender ? branding.colors.buttonText : branding.colors.text,
                          border: `1px solid ${plusOneGender === gender ? branding.colors.buttonBackground : 'rgba(255,255,255,0.1)'}`,
                        }}
                      >
                        {gender === 'male' ? t.guestMale : t.guestFemale}
                      </button>
                    ))}
                  </div>
                )}

                {/* Guest name */}
                <div className="px-4">
                  <input
                    type="text"
                    value={plusOneName}
                    onChange={(e) => setPlusOneName(e.target.value)}
                    placeholder={t.guestNamePlaceholder}
                    maxLength={50}
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 focus:outline-none focus:ring-2 focus:border-transparent transition-all font-assistant text-sm"
                    style={{ color: branding.colors.text }}
                    dir={isRTL ? 'rtl' : 'ltr'}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-red-400 text-sm font-assistant">{error}</p>
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !name.trim() || !phone.replace(/\D/g, '')}
          className="w-full py-4 rounded-2xl font-semibold text-lg transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 font-assistant mt-4"
          style={{
            backgroundColor: branding.colors.buttonBackground,
            color: branding.colors.buttonText,
          }}
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t.submitting}
            </>
          ) : (
            t.submit
          )}
        </button>
      </div>
    </div>
  );

  // ── Verification Screen ──
  const renderVerification = () => (
    <div
      className="min-h-dvh flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: branding.colors.background }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-sm space-y-6 text-center">
        {/* Back button */}
        <button
          onClick={() => {
            setScreen('form');
            setOtpCode(['', '', '', '']);
            setVerifyError(null);
          }}
          className="absolute top-4 start-4 w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
        >
          <X className="w-5 h-5" style={{ color: branding.colors.text }} />
        </button>

        <h2 className="text-2xl font-bold font-assistant" style={{ color: branding.colors.text }}>
          {t.verifyPhone}
        </h2>
        <p className="text-sm opacity-70 font-assistant" style={{ color: branding.colors.text }}>
          {t.verifyMessage} {phone}
        </p>

        {/* OTP Inputs */}
        <div className="flex justify-center gap-3" dir="ltr">
          {otpCode.map((digit, i) => (
            <input
              key={i}
              id={`otp-${i}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOTPChange(i, e.target.value)}
              onKeyDown={(e) => handleOTPKeyDown(i, e)}
              className="w-14 h-16 text-center text-2xl font-bold rounded-xl border-2 bg-white/5 focus:outline-none transition-all"
              style={{
                color: branding.colors.text,
                borderColor: digit ? branding.colors.buttonBackground : 'rgba(255,255,255,0.2)',
              }}
              autoFocus={i === 0}
            />
          ))}
        </div>

        {/* Error */}
        {verifyError && (
          <p className="text-red-400 text-sm font-assistant">{verifyError}</p>
        )}

        {/* Verify button */}
        <button
          onClick={handleVerify}
          disabled={verifyingCode || otpCode.some(d => !d)}
          className="w-full py-4 rounded-2xl font-semibold text-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-assistant"
          style={{
            backgroundColor: branding.colors.buttonBackground,
            color: branding.colors.buttonText,
          }}
        >
          {verifyingCode ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t.verifying}
            </>
          ) : (
            t.verify
          )}
        </button>

        {/* Resend */}
        <button
          onClick={sendVerificationCode}
          disabled={resendCooldown > 0}
          className="text-sm underline opacity-70 hover:opacity-100 transition-opacity font-assistant"
          style={{ color: branding.colors.text }}
        >
          {resendCooldown > 0
            ? `${t.resendIn} ${resendCooldown} ${t.seconds}`
            : t.resendCode}
        </button>
      </div>
    </div>
  );

  // ── Success Screen ──
  const renderSuccess = () => (
    <div
      className="min-h-dvh flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: branding.colors.background }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-sm space-y-6 text-center">
        {/* Success icon */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
          style={{ backgroundColor: '#22c55e' }}
        >
          <Check className="w-10 h-10 text-white" />
        </div>

        <h2 className="text-2xl font-bold font-assistant" style={{ color: branding.colors.text }}>
          {t.successTitle}
        </h2>

        <p className="text-sm opacity-70 font-assistant" style={{ color: branding.colors.text }}>
          {t.successMessage}
        </p>

        {/* Guest info summary */}
        <div
          className="rounded-xl px-4 py-3 text-start space-y-1"
          style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
        >
          <p className="font-semibold font-assistant" style={{ color: branding.colors.text }}>
            {name}
          </p>
          {hasPlusOne && plusOneCount > 0 && (
            <p className="text-sm opacity-70 font-assistant" style={{ color: branding.colors.text }}>
              +{plusOneCount} {t.guests}
              {plusOneName && ` (${plusOneName})`}
            </p>
          )}
        </div>

        {/* QR Code */}
        {qrData && (
          <div className="bg-white rounded-2xl p-6 mx-auto w-fit shadow-lg">
            <QRCodeSVG
              value={qrData}
              size={200}
              level="M"
              includeMargin={false}
            />
          </div>
        )}
      </div>
    </div>
  );

  // ── Closed Screen ──
  const renderClosed = () => {
    const phase = config.currentPhase as QTagPhase;
    const message = phase === 'ended' ? t.eventEnded : t.registrationClosed;

    return (
      <div
        className="min-h-dvh flex flex-col items-center justify-center px-6"
        style={{ backgroundColor: branding.colors.background }}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Logo */}
        {branding.logoUrl && (
          <img
            src={branding.logoUrl}
            alt=""
            className="object-contain mb-6"
            style={{ maxHeight: `${100 * (branding.logoScale ?? 1)}px` }}
          />
        )}

        <h2 className="text-2xl font-bold font-assistant" style={{ color: branding.colors.text }}>
          {branding.title || config.eventName}
        </h2>
        <p className="mt-4 text-lg opacity-70 font-assistant" style={{ color: branding.colors.text }}>
          {message}
        </p>
      </div>
    );
  };

  // ── Main Render ──
  switch (screen) {
    case 'landing':
      return renderLanding();
    case 'form':
      return renderForm();
    case 'verifying':
      return renderVerification();
    case 'success':
      return renderSuccess();
    case 'closed':
      return renderClosed();
    default:
      return renderLanding();
  }
}
