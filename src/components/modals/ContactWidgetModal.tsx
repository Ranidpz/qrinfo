'use client';

import { useState, useEffect } from 'react';
import { X, Phone, Mail, MessageCircle, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';

// Widget types
type WidgetType = 'phone' | 'email' | 'sms' | 'navigation';

// Widget configs
interface PhoneWidgetConfig {
  enabled: boolean;
  phoneNumber: string;
}

interface EmailWidgetConfig {
  enabled: boolean;
  email: string;
  subject?: string;
  body?: string;
}

interface SmsWidgetConfig {
  enabled: boolean;
  phoneNumber: string;
  message?: string;
}

interface NavigationWidgetConfig {
  enabled: boolean;
  address: string;
  app: 'google' | 'waze';
}

type WidgetConfig = PhoneWidgetConfig | EmailWidgetConfig | SmsWidgetConfig | NavigationWidgetConfig;

interface ContactWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  widgetType: WidgetType;
  onSave: (config: WidgetConfig | undefined) => Promise<void>;
  currentConfig?: WidgetConfig;
}

// Widget metadata
const widgetMeta: Record<WidgetType, {
  icon: typeof Phone;
  color: string;
  bgColor: string;
  titleKey: string;
  descriptionKey: string;
}> = {
  phone: {
    icon: Phone,
    color: '#3B82F6',
    bgColor: 'bg-blue-500',
    titleKey: 'phoneWidget',
    descriptionKey: 'phoneWidgetDescription',
  },
  email: {
    icon: Mail,
    color: '#EF4444',
    bgColor: 'bg-red-500',
    titleKey: 'emailWidget',
    descriptionKey: 'emailWidgetDescription',
  },
  sms: {
    icon: MessageCircle,
    color: '#8B5CF6',
    bgColor: 'bg-purple-500',
    titleKey: 'smsWidget',
    descriptionKey: 'smsWidgetDescription',
  },
  navigation: {
    icon: MapPin,
    color: '#10B981',
    bgColor: 'bg-emerald-500',
    titleKey: 'navigationWidget',
    descriptionKey: 'navigationWidgetDescription',
  },
};

export default function ContactWidgetModal({
  isOpen,
  onClose,
  widgetType,
  onSave,
  currentConfig,
}: ContactWidgetModalProps) {
  // Common state
  const [enabled, setEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Phone state
  const [phoneNumber, setPhoneNumber] = useState('');

  // Email state
  const [email, setEmail] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  // SMS state
  const [smsMessage, setSmsMessage] = useState('');

  // Navigation state
  const [navAddress, setNavAddress] = useState('');
  const [navApp, setNavApp] = useState<'google' | 'waze'>('google');

  const t = useTranslations('modals');
  const tUploader = useTranslations('uploader');
  const tCommon = useTranslations('common');

  const meta = widgetMeta[widgetType];
  const Icon = meta.icon;

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setError('');

      if (currentConfig && 'enabled' in currentConfig) {
        setEnabled(currentConfig.enabled);

        if (widgetType === 'phone' && 'phoneNumber' in currentConfig) {
          setPhoneNumber((currentConfig as PhoneWidgetConfig).phoneNumber || '');
        } else if (widgetType === 'email' && 'email' in currentConfig) {
          const cfg = currentConfig as EmailWidgetConfig;
          setEmail(cfg.email || '');
          setEmailSubject(cfg.subject || '');
          setEmailBody(cfg.body || '');
        } else if (widgetType === 'sms' && 'phoneNumber' in currentConfig) {
          const cfg = currentConfig as SmsWidgetConfig;
          setPhoneNumber(cfg.phoneNumber || '');
          setSmsMessage(cfg.message || '');
        } else if (widgetType === 'navigation' && 'address' in currentConfig) {
          const cfg = currentConfig as NavigationWidgetConfig;
          setNavAddress(cfg.address || '');
          setNavApp(cfg.app || 'google');
        }
      } else {
        // Reset to defaults
        setEnabled(false);
        setPhoneNumber('');
        setEmail('');
        setEmailSubject('');
        setEmailBody('');
        setSmsMessage('');
        setNavAddress('');
        setNavApp('google');
      }
    }
  }, [isOpen, currentConfig, widgetType]);

  if (!isOpen) return null;

  // Format phone number
  const formatPhoneNumber = (number: string): string => {
    let cleaned = number.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '972' + cleaned.slice(1);
    }
    if (cleaned.startsWith('+')) {
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
  const isValidEmail = (emailStr: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr.trim());
  };

  const handleSave = async () => {
    setError('');

    if (enabled) {
      // Validate based on type
      switch (widgetType) {
        case 'phone':
        case 'sms':
          if (!phoneNumber.trim()) {
            setError(tUploader('phoneNumberRequired') || 'יש להזין מספר טלפון');
            return;
          }
          if (!isValidPhoneNumber(phoneNumber)) {
            setError(tUploader('invalidPhoneNumber') || 'מספר טלפון לא תקין');
            return;
          }
          break;
        case 'email':
          if (!email.trim()) {
            setError(tUploader('emailRequired') || 'יש להזין כתובת אימייל');
            return;
          }
          if (!isValidEmail(email)) {
            setError(tUploader('invalidEmail') || 'כתובת אימייל לא תקינה');
            return;
          }
          break;
        case 'navigation':
          if (!navAddress.trim()) {
            setError(tUploader('addressRequired') || 'יש להזין כתובת');
            return;
          }
          break;
      }
    }

    setIsSaving(true);
    try {
      if (enabled) {
        let config: WidgetConfig;

        switch (widgetType) {
          case 'phone':
            config = {
              enabled: true,
              phoneNumber: formatPhoneNumber(phoneNumber),
            };
            break;
          case 'email':
            config = {
              enabled: true,
              email: email.trim(),
              ...(emailSubject.trim() ? { subject: emailSubject.trim() } : {}),
              ...(emailBody.trim() ? { body: emailBody.trim() } : {}),
            };
            break;
          case 'sms':
            config = {
              enabled: true,
              phoneNumber: formatPhoneNumber(phoneNumber),
              ...(smsMessage.trim() ? { message: smsMessage.trim() } : {}),
            };
            break;
          case 'navigation':
            config = {
              enabled: true,
              address: navAddress.trim(),
              app: navApp,
            };
            break;
        }

        await onSave(config);
      } else {
        await onSave(undefined);
      }
      onClose();
    } catch (err) {
      console.error(`Error saving ${widgetType} widget:`, err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    setIsSaving(true);
    try {
      await onSave(undefined);
      onClose();
    } catch (err) {
      console.error(`Error removing ${widgetType} widget:`, err);
    } finally {
      setIsSaving(false);
    }
  };

  const isCurrentlyEnabled = currentConfig && 'enabled' in currentConfig && currentConfig.enabled;

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
            <Icon className="w-5 h-5" style={{ color: meta.color }} />
            {t(meta.titleKey) || widgetType}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-text-secondary">
          {t(meta.descriptionKey) || 'הוידג\'ט יופיע כאייקון בפינת המסך ויפנה את הסורקים ליעד שתבחרו.'}
        </p>

        {/* Enable toggle */}
        <div className="flex items-center justify-between p-3 bg-bg-secondary rounded-lg">
          <span className="text-sm font-medium text-text-primary">{t('widgetEnable') || 'הפעל וידג\'ט'}</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => {
                setEnabled(e.target.checked);
                setError('');
              }}
              className="sr-only peer"
            />
            <div
              className="w-11 h-6 bg-bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"
              style={{ backgroundColor: enabled ? meta.color : undefined }}
            ></div>
          </label>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        {/* Phone Widget Fields */}
        {enabled && widgetType === 'phone' && (
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
            />
            <p className="text-xs text-text-secondary">
              {tUploader('phoneDescription') || 'סורקי הקוד יחייגו למספר הטלפון'}
            </p>
          </div>
        )}

        {/* Email Widget Fields */}
        {enabled && widgetType === 'email' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                {tUploader('linkModeEmail') || 'כתובת אימייל'} <span className="text-danger">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder={tUploader('emailAddressPlaceholder') || 'example@email.com'}
                className="input w-full"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                {t('emailSubject') || 'נושא'} <span className="text-text-secondary font-normal">({t('optional')})</span>
              </label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder={tUploader('emailSubjectPlaceholder') || 'נושא האימייל'}
                className="input w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                {t('emailBody') || 'תוכן'} <span className="text-text-secondary font-normal">({t('optional')})</span>
              </label>
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder={tUploader('emailBodyPlaceholder') || 'תוכן ההודעה'}
                className="input w-full min-h-[60px] resize-none"
                rows={2}
              />
            </div>
            <p className="text-xs text-text-secondary">
              {tUploader('emailDescription') || 'סורקי הקוד יפתחו את תוכנת המייל שלהם'}
            </p>
          </div>
        )}

        {/* SMS Widget Fields */}
        {enabled && widgetType === 'sms' && (
          <div className="space-y-4">
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
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                {t('smsMessage') || 'הודעה מוכנה'} <span className="text-text-secondary font-normal">({t('optional')})</span>
              </label>
              <input
                type="text"
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                placeholder={t('smsMessagePlaceholder') || 'היי, סרקתי את הקוד...'}
                className="input w-full"
              />
            </div>
            <p className="text-xs text-text-secondary">
              {tUploader('smsDescription') || 'סורקי הקוד יפתחו הודעת SMS'}
            </p>
          </div>
        )}

        {/* Navigation Widget Fields */}
        {enabled && widgetType === 'navigation' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                {t('navigationAddress') || 'כתובת'} <span className="text-danger">*</span>
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
          </div>
        )}

        {/* Preview */}
        {enabled && (
          <div className="flex items-center justify-center py-4">
            <div
              className={clsx(
                'flex items-center justify-center w-14 h-14 rounded-full text-white shadow-lg',
                meta.bgColor
              )}
            >
              <Icon className="w-7 h-7" />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          {isCurrentlyEnabled ? (
            <button
              onClick={handleRemove}
              disabled={isSaving}
              className="btn bg-danger/10 text-danger hover:bg-danger/20 disabled:opacity-50"
            >
              {t('removeWidget') || 'הסר וידג\'ט'}
            </button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="btn bg-bg-secondary text-text-primary hover:bg-bg-hover disabled:opacity-50"
            >
              {tCommon('cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="btn text-white disabled:opacity-50 min-w-[80px]"
              style={{ backgroundColor: meta.color }}
            >
              {isSaving ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                tCommon('save')
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
