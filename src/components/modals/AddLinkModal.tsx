'use client';

import { useState, useEffect } from 'react';
import { X, Link as LinkIcon, Phone, Mail, MessageCircle, ChevronDown, MapPin, Star, CreditCard } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';

// Link mode types
type LinkMode = 'url' | 'whatsapp' | 'phone' | 'sms' | 'email' | 'navigation' | 'social' | 'payment';

// WhatsApp icon component
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
);

interface AddLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (linkUrl: string, title?: string) => void;
  loading?: boolean;
  // For edit mode - pre-populate with existing URL
  initialUrl?: string;
  editMode?: boolean;
}

export default function AddLinkModal({
  isOpen,
  onClose,
  onSave,
  loading = false,
  initialUrl,
  editMode = false,
}: AddLinkModalProps) {
  const [linkMode, setLinkMode] = useState<LinkMode>('url');
  const [showLinkModeDropdown, setShowLinkModeDropdown] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [messageText, setMessageText] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [navAddress, setNavAddress] = useState('');
  const [navApp, setNavApp] = useState<'google' | 'waze'>('google');
  const [socialUrl, setSocialUrl] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  const t = useTranslations('modals');
  const tUploader = useTranslations('uploader');
  const tCommon = useTranslations('common');

  // Link mode options
  const linkModeOptions: { mode: LinkMode; icon: React.ReactNode; label: string }[] = [
    { mode: 'url', icon: <LinkIcon className="w-4 h-4" />, label: tUploader('linkModeUrl') || 'לינק רגיל' },
    { mode: 'whatsapp', icon: <WhatsAppIcon className="w-4 h-4" />, label: 'WhatsApp' },
    { mode: 'phone', icon: <Phone className="w-4 h-4" />, label: tUploader('linkModePhone') || 'שיחת טלפון' },
    { mode: 'sms', icon: <MessageCircle className="w-4 h-4" />, label: tUploader('linkModeSms') || 'SMS' },
    { mode: 'email', icon: <Mail className="w-4 h-4" />, label: tUploader('linkModeEmail') || 'אימייל' },
    { mode: 'navigation', icon: <MapPin className="w-4 h-4" />, label: tUploader('linkModeNavigation') || 'ניווט' },
    { mode: 'social', icon: <Star className="w-4 h-4" />, label: tUploader('linkModeSocial') || 'פרגנו לנו' },
    { mode: 'payment', icon: <CreditCard className="w-4 h-4" />, label: tUploader('linkModePayment') || 'תשלום' },
  ];

  // Detect link type from URL and pre-populate fields
  const detectAndPopulateFromUrl = (url: string) => {
    if (!url) return;

    try {
      if (url.startsWith('tel:')) {
        setLinkMode('phone');
        setPhoneNumber(url.replace('tel:', '').split('?')[0]);
        return;
      }
      if (url.startsWith('sms:')) {
        setLinkMode('sms');
        const parts = url.replace('sms:', '').split('?');
        setPhoneNumber(parts[0]);
        if (parts[1]) {
          const params = new URLSearchParams(parts[1]);
          setMessageText(params.get('body') || '');
        }
        return;
      }
      if (url.startsWith('mailto:')) {
        setLinkMode('email');
        const parts = url.replace('mailto:', '').split('?');
        setEmailAddress(parts[0]);
        if (parts[1]) {
          const params = new URLSearchParams(parts[1]);
          setEmailSubject(params.get('subject') || '');
          setEmailBody(params.get('body') || '');
        }
        return;
      }

      const urlObj = new URL(url);
      if (urlObj.hostname === 'wa.me' || urlObj.hostname === 'api.whatsapp.com') {
        setLinkMode('whatsapp');
        if (urlObj.hostname === 'wa.me') {
          setPhoneNumber(urlObj.pathname.slice(1) || '');
        } else {
          setPhoneNumber(urlObj.searchParams.get('phone') || '');
        }
        setMessageText(urlObj.searchParams.get('text') || '');
        return;
      }

      // Navigation URLs (Google Maps / Waze)
      if (urlObj.hostname.includes('google.com/maps') || urlObj.hostname === 'maps.google.com') {
        setLinkMode('navigation');
        setNavApp('google');
        const query = urlObj.searchParams.get('query') || urlObj.searchParams.get('q') || '';
        setNavAddress(decodeURIComponent(query));
        return;
      }
      if (urlObj.hostname === 'waze.com' || urlObj.hostname === 'www.waze.com') {
        setLinkMode('navigation');
        setNavApp('waze');
        const query = urlObj.searchParams.get('q') || '';
        setNavAddress(decodeURIComponent(query));
        return;
      }

      // Social/Review URLs (Facebook, Google Reviews, TripAdvisor)
      if (urlObj.hostname.includes('facebook.com') ||
          urlObj.hostname.includes('google.com/maps/place') ||
          urlObj.hostname.includes('tripadvisor')) {
        setLinkMode('social');
        setSocialUrl(url);
        return;
      }

      // Payment URLs (PayPal, Paybox)
      if (urlObj.hostname.includes('paypal') ||
          urlObj.hostname.includes('paybox')) {
        setLinkMode('payment');
        setPaymentUrl(url);
        return;
      }

      // Regular URL
      setLinkMode('url');
      setLinkUrl(url);
    } catch {
      setLinkMode('url');
      setLinkUrl(url);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setError('');
      setShowLinkModeDropdown(false);

      if (editMode && initialUrl) {
        detectAndPopulateFromUrl(initialUrl);
      } else {
        // Reset all fields
        setLinkMode('url');
        setLinkUrl('');
        setPhoneNumber('');
        setMessageText('');
        setEmailAddress('');
        setEmailSubject('');
        setEmailBody('');
        setNavAddress('');
        setNavApp('google');
        setSocialUrl('');
        setPaymentUrl('');
        setTitle('');
      }
    }
  }, [isOpen, initialUrl, editMode]);

  if (!isOpen) return null;

  // Format phone number (remove spaces, dashes, etc.)
  const formatPhoneNumber = (number: string, keepPlus = false): string => {
    let cleaned = number.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '972' + cleaned.slice(1);
    }
    if (!keepPlus && cleaned.startsWith('+')) {
      cleaned = cleaned.slice(1);
    }
    return cleaned;
  };

  // Validate phone number
  const isValidPhoneNumber = (number: string): boolean => {
    const cleaned = formatPhoneNumber(number);
    return /^\d{10,15}$/.test(cleaned);
  };

  // Validate email
  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const handleSave = () => {
    setError('');
    let finalUrl = '';

    switch (linkMode) {
      case 'whatsapp': {
        if (!phoneNumber.trim()) {
          setError(tUploader('phoneNumberRequired') || 'יש להזין מספר טלפון');
          return;
        }
        if (!isValidPhoneNumber(phoneNumber)) {
          setError(tUploader('invalidPhoneNumber') || 'מספר טלפון לא תקין');
          return;
        }
        const formattedNumber = formatPhoneNumber(phoneNumber);
        finalUrl = `https://wa.me/${formattedNumber}`;
        if (messageText.trim()) {
          finalUrl += `?text=${encodeURIComponent(messageText.trim())}`;
        }
        break;
      }

      case 'phone': {
        if (!phoneNumber.trim()) {
          setError(tUploader('phoneNumberRequired') || 'יש להזין מספר טלפון');
          return;
        }
        if (!isValidPhoneNumber(phoneNumber)) {
          setError(tUploader('invalidPhoneNumber') || 'מספר טלפון לא תקין');
          return;
        }
        const formattedNumber = formatPhoneNumber(phoneNumber, true);
        finalUrl = `tel:+${formattedNumber.replace('+', '')}`;
        break;
      }

      case 'sms': {
        if (!phoneNumber.trim()) {
          setError(tUploader('phoneNumberRequired') || 'יש להזין מספר טלפון');
          return;
        }
        if (!isValidPhoneNumber(phoneNumber)) {
          setError(tUploader('invalidPhoneNumber') || 'מספר טלפון לא תקין');
          return;
        }
        const formattedNumber = formatPhoneNumber(phoneNumber, true);
        finalUrl = `sms:+${formattedNumber.replace('+', '')}`;
        if (messageText.trim()) {
          finalUrl += `?body=${encodeURIComponent(messageText.trim())}`;
        }
        break;
      }

      case 'email': {
        if (!emailAddress.trim()) {
          setError(tUploader('emailRequired') || 'יש להזין כתובת אימייל');
          return;
        }
        if (!isValidEmail(emailAddress)) {
          setError(tUploader('invalidEmail') || 'כתובת אימייל לא תקינה');
          return;
        }
        finalUrl = `mailto:${emailAddress.trim()}`;
        const params: string[] = [];
        if (emailSubject.trim()) {
          params.push(`subject=${encodeURIComponent(emailSubject.trim())}`);
        }
        if (emailBody.trim()) {
          params.push(`body=${encodeURIComponent(emailBody.trim())}`);
        }
        if (params.length > 0) {
          finalUrl += `?${params.join('&')}`;
        }
        break;
      }

      case 'navigation': {
        if (!navAddress.trim()) {
          setError(tUploader('addressRequired') || 'יש להזין כתובת');
          return;
        }
        const encodedAddress = encodeURIComponent(navAddress.trim());
        if (navApp === 'waze') {
          finalUrl = `https://waze.com/ul?q=${encodedAddress}&navigate=yes`;
        } else {
          finalUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
        }
        break;
      }

      case 'social': {
        const trimmedUrl = socialUrl.trim();
        if (!trimmedUrl) {
          setError(tUploader('socialUrlRequired') || 'יש להזין לינק');
          return;
        }
        finalUrl = trimmedUrl;
        if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
          finalUrl = 'https://' + trimmedUrl;
        }
        try {
          new URL(finalUrl);
        } catch {
          setError(t('addLinkInvalidUrl'));
          return;
        }
        break;
      }

      case 'payment': {
        const trimmedUrl = paymentUrl.trim();
        if (!trimmedUrl) {
          setError(tUploader('paymentUrlRequired') || 'יש להזין לינק');
          return;
        }
        finalUrl = trimmedUrl;
        if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
          finalUrl = 'https://' + trimmedUrl;
        }
        try {
          new URL(finalUrl);
        } catch {
          setError(t('addLinkInvalidUrl'));
          return;
        }
        break;
      }

      case 'url':
      default: {
        const trimmedUrl = linkUrl.trim();
        if (!trimmedUrl) {
          setError(t('addLinkUrlRequired'));
          return;
        }
        finalUrl = trimmedUrl;
        if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
          finalUrl = 'https://' + trimmedUrl;
        }
        try {
          new URL(finalUrl);
        } catch {
          setError(t('addLinkInvalidUrl'));
          return;
        }
        break;
      }
    }

    onSave(finalUrl, title.trim() || undefined);
  };

  const isSubmitDisabled =
    loading ||
    (linkMode === 'url' && !linkUrl.trim()) ||
    ((linkMode === 'whatsapp' || linkMode === 'phone' || linkMode === 'sms') && !phoneNumber.trim()) ||
    (linkMode === 'email' && !emailAddress.trim()) ||
    (linkMode === 'navigation' && !navAddress.trim()) ||
    (linkMode === 'social' && !socialUrl.trim()) ||
    (linkMode === 'payment' && !paymentUrl.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-accent" />
            {editMode ? t('editLinkSettings') || 'עריכת לינק' : t('addLink')}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        {/* Link Mode Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowLinkModeDropdown(!showLinkModeDropdown)}
            className="w-full flex items-center justify-between gap-2 p-3 bg-bg-secondary rounded-xl text-sm font-medium text-text-primary hover:bg-bg-hover transition-colors"
          >
            <div className="flex items-center gap-2">
              {linkModeOptions.find(o => o.mode === linkMode)?.icon}
              <span>{linkModeOptions.find(o => o.mode === linkMode)?.label}</span>
            </div>
            <ChevronDown className={clsx('w-4 h-4 transition-transform', showLinkModeDropdown && 'rotate-180')} />
          </button>
          {showLinkModeDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
              {linkModeOptions.map((option) => (
                <button
                  key={option.mode}
                  onClick={() => {
                    setLinkMode(option.mode);
                    setShowLinkModeDropdown(false);
                    setError('');
                  }}
                  className={clsx(
                    'w-full flex items-center gap-2 p-3 text-sm text-start hover:bg-bg-hover transition-colors',
                    linkMode === option.mode && 'bg-accent/10 text-accent'
                  )}
                >
                  {option.icon}
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Form Fields based on mode */}
        <div className="space-y-4">
          {linkMode === 'url' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                URL <span className="text-danger">*</span>
              </label>
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => {
                  setLinkUrl(e.target.value);
                  setError('');
                }}
                placeholder="https://example.com"
                className="input w-full"
                dir="ltr"
                autoFocus
              />
            </div>
          )}

          {(linkMode === 'whatsapp' || linkMode === 'phone' || linkMode === 'sms') && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  {tUploader('linkModePhone') || 'מספר טלפון'} <span className="text-danger">*</span>
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    setError('');
                  }}
                  placeholder={tUploader('phoneNumberPlaceholder') || '050-1234567 או +972501234567'}
                  className="input w-full"
                  dir="ltr"
                  autoFocus
                />
              </div>
              {(linkMode === 'whatsapp' || linkMode === 'sms') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary">
                    {tUploader('messagePlaceholder') || 'הודעה'} <span className="text-text-secondary font-normal">({t('optional')})</span>
                  </label>
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={tUploader('messagePlaceholder') || 'הודעה (אופציונלי)'}
                    className="input w-full"
                  />
                </div>
              )}
              <p className="text-xs text-text-secondary">
                {linkMode === 'whatsapp' && (tUploader('whatsappDescription') || 'סורקי הקוד יועברו לשיחת וואטסאפ')}
                {linkMode === 'phone' && (tUploader('phoneDescription') || 'סורקי הקוד יחייגו למספר הטלפון')}
                {linkMode === 'sms' && (tUploader('smsDescription') || 'סורקי הקוד יפתחו הודעת SMS')}
              </p>
            </>
          )}

          {linkMode === 'email' && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  {tUploader('linkModeEmail') || 'אימייל'} <span className="text-danger">*</span>
                </label>
                <input
                  type="email"
                  value={emailAddress}
                  onChange={(e) => {
                    setEmailAddress(e.target.value);
                    setError('');
                  }}
                  placeholder={tUploader('emailAddressPlaceholder') || 'example@email.com'}
                  className="input w-full"
                  dir="ltr"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  נושא <span className="text-text-secondary font-normal">({t('optional')})</span>
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder={tUploader('emailSubjectPlaceholder') || 'נושא (אופציונלי)'}
                  className="input w-full"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  תוכן <span className="text-text-secondary font-normal">({t('optional')})</span>
                </label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder={tUploader('emailBodyPlaceholder') || 'תוכן ההודעה (אופציונלי)'}
                  className="input w-full min-h-[60px] resize-none"
                  rows={2}
                />
              </div>
              <p className="text-xs text-text-secondary">
                {tUploader('emailDescription') || 'סורקי הקוד יפתחו את תוכנת המייל שלהם'}
              </p>
            </>
          )}

          {linkMode === 'navigation' && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  {tUploader('addressPlaceholder') || 'כתובת'} <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={navAddress}
                  onChange={(e) => {
                    setNavAddress(e.target.value);
                    setError('');
                  }}
                  placeholder={tUploader('addressPlaceholder') || 'רחוב, עיר או שם מקום'}
                  className="input w-full"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  {tUploader('navigationApp') || 'אפליקציית ניווט'}
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNavApp('google')}
                    className={clsx(
                      'flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2',
                      navApp === 'google'
                        ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/50'
                        : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover'
                    )}
                  >
                    <MapPin className="w-4 h-4" />
                    Google Maps
                  </button>
                  <button
                    type="button"
                    onClick={() => setNavApp('waze')}
                    className={clsx(
                      'flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2',
                      navApp === 'waze'
                        ? 'bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/50'
                        : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover'
                    )}
                  >
                    <MapPin className="w-4 h-4" />
                    Waze
                  </button>
                </div>
              </div>
              <p className="text-xs text-text-secondary">
                {tUploader('navigationDescription') || 'סורקי הקוד יועברו לניווט'}
              </p>
            </>
          )}

          {linkMode === 'social' && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  {tUploader('linkModeSocial') || 'לינק לביקורות'} <span className="text-danger">*</span>
                </label>
                <input
                  type="url"
                  value={socialUrl}
                  onChange={(e) => {
                    setSocialUrl(e.target.value);
                    setError('');
                  }}
                  placeholder={tUploader('socialUrlPlaceholder') || 'לינק לפייסבוק, גוגל ביקורות, TripAdvisor...'}
                  className="input w-full"
                  dir="ltr"
                  autoFocus
                />
              </div>
              <p className="text-xs text-text-secondary">
                {tUploader('socialDescription') || 'סורקי הקוד יועברו להשאיר לכם ביקורת'}
              </p>
            </>
          )}

          {linkMode === 'payment' && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  {tUploader('linkModePayment') || 'לינק לתשלום'} <span className="text-danger">*</span>
                </label>
                <input
                  type="url"
                  value={paymentUrl}
                  onChange={(e) => {
                    setPaymentUrl(e.target.value);
                    setError('');
                  }}
                  placeholder={tUploader('paymentUrlPlaceholder') || 'לינק ל-PayPal, Paybox או כל דף תשלום'}
                  className="input w-full"
                  dir="ltr"
                  autoFocus
                />
              </div>
              <p className="text-xs text-text-secondary">
                {tUploader('paymentDescription') || 'סורקי הקוד יועברו לדף התשלום שלכם'}
              </p>
            </>
          )}

          {/* Title - only for regular URL mode and not in edit mode */}
          {linkMode === 'url' && !editMode && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                {t('addLinkTitle')} <span className="text-text-secondary font-normal">({t('optional')})</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('addLinkTitlePlaceholder')}
                className="input w-full"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="btn bg-bg-secondary text-text-primary hover:bg-bg-hover disabled:opacity-50"
          >
            {tCommon('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitDisabled}
            className={clsx(
              'btn text-white disabled:opacity-50 min-w-[80px]',
              linkMode === 'whatsapp' ? 'bg-[#25D366] hover:bg-[#20BA5C]' : 'bg-accent hover:bg-accent-hover'
            )}
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : editMode ? (
              tCommon('save')
            ) : (
              tCommon('add')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
