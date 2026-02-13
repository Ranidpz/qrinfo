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
  Navigation,
} from 'lucide-react';
import type { QTagConfig, QTagPhase } from '@/types/qtag';

interface QTagViewerProps {
  config: QTagConfig;
  codeId: string;
  shortId: string;
  ownerId?: string;
  qrTokenFromUrl?: string;
}

type ViewScreen = 'loading' | 'landing' | 'form' | 'verifying' | 'success' | 'closed';

// localStorage helpers
const STORAGE_KEY_PREFIX = 'qtag_guest_';

interface StoredGuest {
  guestId: string;
  qrToken: string;
  name: string;
  plusOneCount: number;
}

function saveGuestToStorage(codeId: string, data: StoredGuest) {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${codeId}`, JSON.stringify(data));
  } catch {
    // localStorage may be unavailable (private browsing, etc.)
  }
}

function loadGuestFromStorage(codeId: string): StoredGuest | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${codeId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearGuestFromStorage(codeId: string) {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${codeId}`);
  } catch {
    // ignore
  }
}

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
    navigate: 'נווט לאירוע',
    loading: 'טוען...',
    welcomeBack: 'ברוכים השבים!',
    alreadyRegistered: 'כבר נרשמתי',
    recoverQR: 'שלחו לי שוב את הQR',
    recoverMessage: 'הכניסו את הטלפון שנרשמתם איתו',
    recoverSent: 'הקוד שלכם לאירוע נשלח שוב בוואטסאפ',
    recoverSendFailed: 'המספר נמצא אך שליחת הוואטסאפ נכשלה',
    recoverNotFound: 'מספר זה לא נמצא במערכת',
    recoverNotFoundHint: 'אפשר להירשם עכשיו',
    recoverSending: 'שולח...',
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
    navigate: 'Navigate to event',
    loading: 'Loading...',
    welcomeBack: 'Welcome back!',
    alreadyRegistered: 'Already registered?',
    recoverQR: 'Send me my QR again',
    recoverMessage: 'Enter the phone number you registered with',
    recoverSent: 'Your event code was resent via WhatsApp',
    recoverSendFailed: 'Number found but WhatsApp send failed',
    recoverNotFound: 'This number was not found in our system',
    recoverNotFoundHint: 'You can register now',
    recoverSending: 'Sending...',
  },
};

export default function QTagViewer({ config: initialConfig, codeId, shortId, qrTokenFromUrl }: QTagViewerProps) {
  const [config, setConfig] = useState<QTagConfig>(initialConfig);
  const [screen, setScreen] = useState<ViewScreen>('loading');
  const [isReturningGuest, setIsReturningGuest] = useState(false);
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

  // Recovery state (already registered flow)
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryPhone, setRecoveryPhone] = useState('');
  const [recoverySending, setRecoverySending] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
  const [recoveryFound, setRecoveryFound] = useState(false);
  const [recoveryWhatsappSent, setRecoveryWhatsappSent] = useState(false);

  // Check URL token or localStorage for returning guest on mount
  useEffect(() => {
    const stored = loadGuestFromStorage(codeId);
    const tokenToCheck = qrTokenFromUrl || stored?.qrToken;

    if (!tokenToCheck) {
      // No token available - show appropriate screen based on phase
      setScreen(initialConfig.currentPhase === 'registration' ? 'landing' : 'closed');
      return;
    }

    // Verify guest still exists via API
    fetch(`/api/qtag/guest-status?codeId=${encodeURIComponent(codeId)}&token=${encodeURIComponent(tokenToCheck)}`)
      .then(res => res.json())
      .then(data => {
        if (data.exists) {
          // Guest still exists - restore their data and show success
          setName(data.name);
          setQrToken(data.qrToken);
          setGuestId(data.guestId || stored?.guestId || '');
          setPlusOneCount(data.plusOneCount || 0);
          setHasPlusOne((data.plusOneCount || 0) > 0);
          setIsReturningGuest(true);
          setScreen('success');

          // Save to localStorage for future visits (especially when coming from WhatsApp link)
          if (!stored || stored.qrToken !== tokenToCheck) {
            saveGuestToStorage(codeId, {
              guestId: data.guestId || stored?.guestId || '',
              qrToken: tokenToCheck,
              name: data.name,
              plusOneCount: data.plusOneCount || 0,
            });
          }
        } else {
          // Guest was deleted - clear storage and show landing
          clearGuestFromStorage(codeId);
          setScreen(initialConfig.currentPhase === 'registration' ? 'landing' : 'closed');
        }
      })
      .catch(() => {
        // Network error - try to show with stored data if available
        if (stored) {
          setName(stored.name);
          setQrToken(stored.qrToken);
          setGuestId(stored.guestId);
          setPlusOneCount(stored.plusOneCount || 0);
          setHasPlusOne((stored.plusOneCount || 0) > 0);
          setIsReturningGuest(true);
          setScreen('success');
        } else {
          setScreen(initialConfig.currentPhase === 'registration' ? 'landing' : 'closed');
        }
      });
  }, [codeId, initialConfig.currentPhase, qrTokenFromUrl]);

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

  // Handle phase changes (only when not on success screen)
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
          locale,
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
        } else if (data.errorCode === 'SEND_FAILED') {
          setError(t.errorGeneric);
        } else {
          setError(data.error || t.errorGeneric);
        }
        return;
      }

      // If verification is needed, go to verify screen
      // Note: when verification is enabled, register sends the first OTP inline
      // so we don't need to call sendVerificationCode() here
      if (config.verification?.enabled && !data.isVerified) {
        setScreen('verifying');
        setVerificationSent(true);
        setResendCooldown(60);
      } else {
        // No verification: guest was created immediately
        setGuestId(data.guestId);
        setQrToken(data.qrToken);
        saveGuestToStorage(codeId, {
          guestId: data.guestId,
          qrToken: data.qrToken,
          name: name.trim(),
          plusOneCount: hasPlusOne ? plusOneCount : 0,
        });
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
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.errorCode === 'INVALID_CODE') setVerifyError(t.invalidCode);
        else if (data.errorCode === 'EXPIRED') setVerifyError(t.codeExpired);
        else if (data.errorCode === 'BLOCKED') setVerifyError(t.tooManyAttempts);
        else if (data.errorCode === 'CAPACITY_FULL') setVerifyError(t.eventFull);
        else if (data.errorCode === 'PHONE_EXISTS') setVerifyError(t.phoneExists);
        else if (data.errorCode === 'NO_PENDING_DATA') setVerifyError(t.errorGeneric);
        else setVerifyError(data.error || t.errorGeneric);
        return;
      }

      // Guest was created by the verify endpoint — extract guestId and qrToken
      const verifiedGuestId = data.guestId;
      const verifiedQrToken = data.qrToken;

      setGuestId(verifiedGuestId);
      setQrToken(verifiedQrToken);

      // Save to localStorage for returning guests
      if (verifiedGuestId && verifiedQrToken) {
        saveGuestToStorage(codeId, {
          guestId: verifiedGuestId,
          qrToken: verifiedQrToken,
          name: name.trim(),
          plusOneCount: hasPlusOne ? plusOneCount : 0,
        });
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

  // Resend QR to WhatsApp (recovery flow)
  const handleRecoverQR = async () => {
    const rawPhone = recoveryPhone.replace(/\D/g, '');
    if (rawPhone.length < 9 || rawPhone.length > 10) return;

    setRecoverySending(true);
    try {
      const res = await fetch('/api/qtag/resend-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId, phone: rawPhone }),
      });
      const data = await res.json();
      setRecoveryFound(!!data.found);
      setRecoveryWhatsappSent(!!data.whatsappSent);
      setRecoverySent(true);
    } catch {
      setRecoveryFound(false);
      setRecoveryWhatsappSent(false);
      setRecoverySent(true);
    } finally {
      setRecoverySending(false);
    }
  };

  // QR data for the guest - URL format so regular cameras open the registration page
  const qrData = qrToken && shortId
    ? `${process.env.NEXT_PUBLIC_BASE_URL || 'https://qr.playzones.app'}/v/${shortId}?token=${qrToken}`
    : '';

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

        {/* Already registered? Recovery flow */}
        {!showRecovery ? (
          <button
            onClick={() => { setShowRecovery(true); setRecoverySent(false); setRecoveryFound(false); setRecoveryPhone(''); }}
            className="mt-4 text-sm underline opacity-60 hover:opacity-100 transition-opacity font-assistant"
            style={{ color: branding.backgroundImageUrl ? '#ffffff' : branding.colors.text }}
          >
            {t.alreadyRegistered}
          </button>
        ) : (
          <div
            className="mt-4 w-full max-w-xs rounded-2xl p-4 space-y-3"
            style={{ backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)' }}
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {recoverySent ? (
              <div className="space-y-3 text-center">
                {recoveryFound && recoveryWhatsappSent ? (
                  <p className="text-sm font-assistant" style={{ color: '#22c55e' }}>
                    <Check className="w-4 h-4 inline-block mb-0.5 me-1" />
                    {t.recoverSent}
                  </p>
                ) : recoveryFound && !recoveryWhatsappSent ? (
                  <p className="text-sm font-assistant" style={{ color: '#f59e0b' }}>
                    {t.recoverSendFailed}
                  </p>
                ) : (
                  <>
                    <p className="text-sm font-assistant" style={{ color: '#f87171' }}>
                      {t.recoverNotFound}
                    </p>
                    <button
                      onClick={() => { setShowRecovery(false); setRecoverySent(false); setScreen('form'); }}
                      className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-all hover:scale-105 active:scale-95 font-assistant"
                      style={{ backgroundColor: branding.colors.buttonBackground, color: branding.colors.buttonText }}
                    >
                      {t.recoverNotFoundHint}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                <p className="text-sm text-center opacity-80 font-assistant" style={{ color: branding.backgroundImageUrl ? '#ffffff' : branding.colors.text }}>
                  {t.recoverMessage}
                </p>
                <input
                  type="tel"
                  value={recoveryPhone}
                  onChange={(e) => setRecoveryPhone(formatPhoneInput(e.target.value))}
                  placeholder={t.phonePlaceholder}
                  maxLength={12}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:border-transparent font-assistant text-sm text-center"
                  dir="ltr"
                />
                <button
                  onClick={handleRecoverQR}
                  disabled={recoverySending || recoveryPhone.replace(/\D/g, '').length < 9}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-assistant"
                  style={{ backgroundColor: branding.colors.buttonBackground, color: branding.colors.buttonText }}
                >
                  {recoverySending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {recoverySending ? t.recoverSending : t.recoverQR}
                </button>
              </>
            )}
          </div>
        )}
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
      className="min-h-dvh flex flex-col items-center justify-center px-6 py-8"
      style={{ backgroundColor: branding.colors.background }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-sm space-y-5 text-center">
        {/* Success icon */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
          style={{ backgroundColor: '#22c55e' }}
        >
          <Check className="w-8 h-8 text-white" />
        </div>

        <h2 className="text-2xl font-bold font-assistant" style={{ color: branding.colors.text }}>
          {isReturningGuest ? t.welcomeBack : t.successTitle}
        </h2>

        <p className="text-sm opacity-70 font-assistant" style={{ color: branding.colors.text }}>
          {t.successMessage}
        </p>

        {/* QR Code - first, for immediate scanning */}
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

        {/* Event details card */}
        {(config.eventName || branding.title || config.eventDate || config.eventTime || config.eventLocation) && (
          <div
            className="rounded-xl px-4 py-3 space-y-2"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
          >
            {/* Event name */}
            {(branding.title || config.eventName) && (
              <p className="font-bold text-base font-assistant" style={{ color: branding.colors.text }}>
                {branding.title || config.eventName}
              </p>
            )}

            {/* Date & Time */}
            {(config.eventDate || config.eventTime) && (
              <div className="flex items-center justify-center gap-3 text-sm" style={{ color: branding.colors.text, opacity: 0.8 }}>
                {config.eventDate && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(config.eventDate).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </span>
                )}
                {config.eventDate && config.eventTime && (
                  <span style={{ opacity: 0.4 }}>|</span>
                )}
                {config.eventTime && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {config.eventTime}
                  </span>
                )}
              </div>
            )}

            {/* Location + Waze navigation */}
            {config.eventLocation && (
              <div className="flex items-center justify-center gap-2 text-sm" style={{ color: branding.colors.text, opacity: 0.8 }}>
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="font-assistant">{config.eventLocation}</span>
              </div>
            )}

            {config.eventLocation && (
              <a
                href={`https://waze.com/ul?q=${encodeURIComponent(config.eventLocation)}&navigate=yes`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all hover:scale-[1.02] active:scale-[0.98] font-assistant mt-1"
                style={{
                  backgroundColor: branding.colors.buttonBackground,
                  color: branding.colors.buttonText,
                }}
              >
                <Navigation className="w-4 h-4" />
                {t.navigate}
              </a>
            )}
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

  // ── Loading Screen ──
  const renderLoading = () => (
    <div
      className="min-h-dvh flex flex-col items-center justify-center"
      style={{ backgroundColor: branding.colors.background }}
    >
      <Loader2 className="w-10 h-10 animate-spin" style={{ color: branding.colors.buttonBackground }} />
      <p className="mt-4 text-sm opacity-60 font-assistant" style={{ color: branding.colors.text }}>
        {t.loading}
      </p>
    </div>
  );

  // ── Main Render ──
  switch (screen) {
    case 'loading':
      return renderLoading();
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
      return renderLoading();
  }
}
