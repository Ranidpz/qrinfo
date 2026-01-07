'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Phone, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface PhoneVerificationModalProps {
  codeId: string;
  locale: 'he' | 'en';
  onVerified: (sessionData: { phone: string; sessionToken: string; votesRemaining: number; maxVotes: number }) => void;
  onClose: () => void;
  isOpen?: boolean;
  branding?: {
    colors?: {
      buttonBackground?: string;
      buttonText?: string;
      background?: string;
      text?: string;
    };
  };
}

type VerificationState = 'phone_input' | 'code_input' | 'verified' | 'blocked';

const translations = {
  he: {
    title: 'אימות מספר טלפון',
    subtitle: 'נדרש אימות כדי להצביע',
    enterPhone: 'הזן מספר טלפון',
    phonePlaceholder: '050-123-4567',
    sendCode: 'שלח קוד אימות',
    enterCode: 'הזן את הקוד שנשלח אליך',
    codePlaceholder: '0000',
    verify: 'אמת',
    resend: 'שלח שוב',
    resendIn: 'שלח שוב בעוד',
    seconds: 'שניות',
    wrongCode: 'קוד שגוי, נסה שוב',
    expired: 'הקוד פג תוקף',
    blocked: 'חרגת ממספר הניסיונות',
    tryAgainLater: 'נסה שוב מאוחר יותר',
    success: 'האימות הצליח!',
    sentViaWhatsapp: 'הקוד נשלח בוואטסאפ',
    sentViaSms: 'הקוד נשלח ב-SMS',
    invalidPhone: 'מספר טלפון לא תקין',
    quotaExceeded: 'נגמרו ההודעות, פנה למנהל',
    alreadyVoted: 'מספר זה כבר הצביע',
    alreadyVotedAll: 'מספר זה כבר הצביע בכל הקטגוריות',
    networkError: 'שגיאת רשת, נסה שוב',
    verifyFailed: 'האימות נכשל, נסה שוב',
    noCodeFound: 'לא נמצא קוד אימות פעיל',
    sendCodeFailed: 'שליחת הקוד נכשלה, נסה שוב',
    attemptsRemaining: 'נותרו {count} ניסיונות',
    cancel: 'ביטול',
    votesRemaining: 'נותרו לך {count} הצבעות',
  },
  en: {
    title: 'Phone Verification',
    subtitle: 'Verification required to vote',
    enterPhone: 'Enter phone number',
    phonePlaceholder: '050-123-4567',
    sendCode: 'Send verification code',
    enterCode: 'Enter the code sent to you',
    codePlaceholder: '0000',
    verify: 'Verify',
    resend: 'Resend',
    resendIn: 'Resend in',
    seconds: 'seconds',
    wrongCode: 'Wrong code, try again',
    expired: 'Code expired',
    blocked: 'Too many attempts',
    tryAgainLater: 'Try again later',
    success: 'Verified successfully!',
    sentViaWhatsapp: 'Code sent via WhatsApp',
    sentViaSms: 'Code sent via SMS',
    invalidPhone: 'Invalid phone number',
    quotaExceeded: 'No messages left, contact admin',
    alreadyVoted: 'This phone has already voted',
    alreadyVotedAll: 'This phone has already voted in all categories',
    networkError: 'Network error, try again',
    verifyFailed: 'Verification failed, try again',
    noCodeFound: 'No active verification code found',
    sendCodeFailed: 'Failed to send code, try again',
    attemptsRemaining: '{count} attempts remaining',
    cancel: 'Cancel',
    votesRemaining: 'You have {count} votes remaining',
  },
};

export default function PhoneVerificationModal({
  codeId,
  locale,
  onVerified,
  onClose,
  branding,
}: PhoneVerificationModalProps) {
  const t = translations[locale];
  const isRTL = locale === 'he';

  const [state, setState] = useState<VerificationState>('phone_input');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [blockedUntil, setBlockedUntil] = useState<Date | null>(null);
  const [votesRemaining, setVotesRemaining] = useState<number>(0);

  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Colors from branding or defaults
  const colors = {
    buttonBg: branding?.colors?.buttonBackground || '#3b82f6',
    buttonText: branding?.colors?.buttonText || '#ffffff',
    background: branding?.colors?.background || '#ffffff',
    text: branding?.colors?.text || '#1f2937',
  };

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Format phone for display
  const formatPhoneInput = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  // Handle phone input
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneInput(e.target.value);
    setPhone(formatted);
    setError(null);
  };

  // Handle code input
  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError(null);

    // Auto-focus next input
    if (value && index < 3) {
      codeInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (value && index === 3 && newCode.every((d) => d)) {
      handleVerifyCode(newCode.join(''));
    }
  };

  // Handle backspace
  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  // Send OTP
  const handleSendCode = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/verification/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId, phone, locale }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errorCode === 'INVALID_PHONE') {
          setError(t.invalidPhone);
        } else if (data.errorCode === 'QUOTA_EXCEEDED') {
          setError(t.quotaExceeded);
        } else if (data.errorCode === 'RATE_LIMITED') {
          setError(t.tryAgainLater);
        } else if (data.errorCode === 'ALREADY_VOTED') {
          setError(t.alreadyVoted);
        } else if (data.errorCode === 'ALREADY_VOTED_ALL') {
          setError(t.alreadyVotedAll);
        } else {
          // Use Hebrew translation for generic errors
          setError(t.sendCodeFailed);
        }
        return;
      }

      setMethod(data.method);
      setExpiresAt(new Date(data.expiresAt));
      setResendCooldown(60); // 60 second cooldown
      setState('code_input');

      // Focus first code input
      setTimeout(() => codeInputRefs.current[0]?.focus(), 100);
    } catch {
      setError(t.networkError);
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyCode = async (codeValue?: string) => {
    const codeToVerify = codeValue || code.join('');
    if (codeToVerify.length !== 4) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/verification/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId, phone, code: codeToVerify }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errorCode === 'INVALID_CODE') {
          setError(t.wrongCode);
          setAttemptsRemaining(data.attemptsRemaining);
          setCode(['', '', '', '']);
          codeInputRefs.current[0]?.focus();
        } else if (data.errorCode === 'EXPIRED') {
          setError(t.expired);
          setState('phone_input');
        } else if (data.errorCode === 'BLOCKED') {
          setBlockedUntil(new Date(data.blockedUntil));
          setState('blocked');
        } else if (data.errorCode === 'NO_CODE') {
          setError(t.noCodeFound);
          setState('phone_input');
        } else {
          // Use Hebrew translation for generic errors
          setError(t.verifyFailed);
        }
        return;
      }

      // Success!
      setVotesRemaining(data.votesRemaining);
      setState('verified');

      // Call onVerified after brief delay to show success
      setTimeout(() => {
        onVerified({
          phone,
          sessionToken: data.sessionToken,
          votesRemaining: data.votesRemaining,
          maxVotes: data.maxVotes || 1,
        });
      }, 1500);
    } catch {
      setError(t.networkError);
    } finally {
      setLoading(false);
    }
  };

  // Resend code
  const handleResend = () => {
    setCode(['', '', '', '']);
    handleSendCode();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: colors.background }}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors z-10"
          style={{ color: colors.text }}
        >
          <X size={20} />
        </button>

        <div className="p-6 pt-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: `${colors.buttonBg}20` }}
            >
              {state === 'verified' ? (
                <CheckCircle2 size={32} style={{ color: '#22c55e' }} />
              ) : state === 'blocked' ? (
                <AlertCircle size={32} style={{ color: '#ef4444' }} />
              ) : (
                <Phone size={32} style={{ color: colors.buttonBg }} />
              )}
            </div>
            <h2 className="text-xl font-bold mb-1" style={{ color: colors.text }}>
              {t.title}
            </h2>
            <p className="text-sm text-gray-500">{t.subtitle}</p>
          </div>

          {/* Phone Input State */}
          {state === 'phone_input' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>
                  {t.enterPhone}
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder={t.phonePlaceholder}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-lg text-center focus:outline-none focus:ring-2 transition-shadow"
                  style={{
                    direction: 'ltr',
                    color: colors.text,
                    backgroundColor: '#ffffff',
                  }}
                  disabled={loading}
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-red-500 text-sm text-center">{error}</p>
              )}

              <button
                onClick={handleSendCode}
                disabled={loading || phone.replace(/\D/g, '').length < 9}
                className="w-full py-3 rounded-xl font-medium text-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  backgroundColor: colors.buttonBg,
                  color: colors.buttonText,
                }}
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  t.sendCode
                )}
              </button>

              <button
                onClick={onClose}
                className="w-full py-2 text-gray-500 text-sm hover:underline"
              >
                {t.cancel}
              </button>
            </div>
          )}

          {/* Code Input State */}
          {state === 'code_input' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-center" style={{ color: colors.text }}>
                  {t.enterCode}
                </label>
                <p className="text-xs text-center mb-3" style={{ color: colors.buttonBg }}>
                  {method === 'whatsapp' ? t.sentViaWhatsapp : t.sentViaSms}
                </p>

                {/* Code input boxes */}
                <div className="flex gap-3 justify-center" dir="ltr">
                  {code.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { codeInputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      value={digit}
                      onChange={(e) => handleCodeChange(index, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(index, e)}
                      className="w-14 h-14 text-2xl font-bold text-center rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-colors"
                      style={{
                        borderColor: digit ? colors.buttonBg : undefined,
                        color: colors.text,
                        backgroundColor: '#ffffff',
                      }}
                      disabled={loading}
                      maxLength={1}
                    />
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-red-500 text-sm text-center">
                  {error}
                  {attemptsRemaining !== null && (
                    <span className="block mt-1">
                      {t.attemptsRemaining.replace('{count}', String(attemptsRemaining))}
                    </span>
                  )}
                </p>
              )}

              <button
                onClick={() => handleVerifyCode()}
                disabled={loading || code.some((d) => !d)}
                className="w-full py-3 rounded-xl font-medium text-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  backgroundColor: colors.buttonBg,
                  color: colors.buttonText,
                }}
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  t.verify
                )}
              </button>

              {/* Resend button */}
              <div className="text-center">
                {resendCooldown > 0 ? (
                  <p className="text-sm text-gray-500">
                    {t.resendIn} {resendCooldown} {t.seconds}
                  </p>
                ) : (
                  <button
                    onClick={handleResend}
                    disabled={loading}
                    className="text-sm flex items-center gap-1 mx-auto hover:underline"
                    style={{ color: colors.buttonBg }}
                  >
                    <RefreshCw size={14} />
                    {t.resend}
                  </button>
                )}
              </div>

              <button
                onClick={onClose}
                className="w-full py-2 text-gray-500 text-sm hover:underline"
              >
                {t.cancel}
              </button>
            </div>
          )}

          {/* Verified State */}
          {state === 'verified' && (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle2 size={48} className="text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-green-600">{t.success}</h3>
              <p className="text-gray-500">
                {t.votesRemaining.replace('{count}', String(votesRemaining))}
              </p>
            </div>
          )}

          {/* Blocked State */}
          {state === 'blocked' && (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                <AlertCircle size={48} className="text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-red-600">{t.blocked}</h3>
              <p className="text-gray-500">{t.tryAgainLater}</p>
              {blockedUntil && (
                <p className="text-sm text-gray-400">
                  {blockedUntil.toLocaleTimeString(locale === 'he' ? 'he-IL' : 'en-US')}
                </p>
              )}
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl font-medium border border-gray-200 hover:bg-gray-50 transition-colors"
                style={{ color: colors.text }}
              >
                {t.cancel}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
