'use client';

import { Upload, Image, Video, FileText, Link, Cloud, Gamepad2, Camera, Vote, CalendarDays, MessageCircle, Phone, Mail, ChevronDown } from 'lucide-react';
import { useState, useRef, DragEvent } from 'react';
import { clsx } from 'clsx';
import { useTranslations } from 'next-intl';

// Link mode types
type LinkMode = 'url' | 'whatsapp' | 'phone' | 'sms' | 'email';

// WhatsApp icon component
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
);

// Link mode options with icons and labels
const linkModeOptions: { mode: LinkMode; icon: React.ReactNode; label: string; labelKey: string }[] = [
  { mode: 'url', icon: <Link className="w-4 h-4" />, label: 'לינק רגיל', labelKey: 'linkModeUrl' },
  { mode: 'whatsapp', icon: <WhatsAppIcon className="w-4 h-4" />, label: 'WhatsApp', labelKey: 'linkModeWhatsapp' },
  { mode: 'phone', icon: <Phone className="w-4 h-4" />, label: 'שיחת טלפון', labelKey: 'linkModePhone' },
  { mode: 'sms', icon: <MessageCircle className="w-4 h-4" />, label: 'SMS', labelKey: 'linkModeSms' },
  { mode: 'email', icon: <Mail className="w-4 h-4" />, label: 'אימייל', labelKey: 'linkModeEmail' },
];

interface MediaUploaderProps {
  onFileSelect: (file: File) => void;
  onLinkAdd?: (url: string) => void;
  onRiddleCreate?: () => void;
  onWordCloudCreate?: () => void;
  onSelfiebeamCreate?: () => void;
  onQVoteCreate?: () => void;
  onWeeklyCalendarCreate?: () => void;
  maxSize?: number; // bytes
  accept?: string[];
  disabled?: boolean;
}

export default function MediaUploader({
  onFileSelect,
  onLinkAdd,
  onRiddleCreate,
  onWordCloudCreate,
  onSelfiebeamCreate,
  onQVoteCreate,
  onWeeklyCalendarCreate,
  maxSize = 5 * 1024 * 1024, // 5MB default
  disabled = false,
}: MediaUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'link' | 'riddle' | 'wordcloud' | 'selfiebeam' | 'qvote' | 'weeklycal' | 'minigames'>('upload');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkMode, setLinkMode] = useState<LinkMode>('url');
  const [showLinkModeDropdown, setShowLinkModeDropdown] = useState(false);
  // Shared fields for phone-based modes (whatsapp, phone, sms)
  const [phoneNumber, setPhoneNumber] = useState('');
  const [messageText, setMessageText] = useState('');
  // Email fields
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = useTranslations('uploader');
  const tMedia = useTranslations('media');

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFile = (file: File) => {
    setError(null);

    // Check file size
    if (file.size > maxSize) {
      setError(`${t('fileTooLarge')} ${formatBytes(maxSize)}`);
      return;
    }

    // Check file type
    const validTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/webm',
      'application/pdf'
    ];

    if (!validTypes.includes(file.type)) {
      setError(t('unsupportedFileType'));
      return;
    }

    onFileSelect(file);
  };

  // Format phone number (remove spaces, dashes, etc.)
  const formatPhoneNumber = (number: string, keepPlus = false): string => {
    // Remove all non-digit characters except +
    let cleaned = number.replace(/[^\d+]/g, '');

    // If starts with 0, assume Israeli number and replace with 972
    if (cleaned.startsWith('0')) {
      cleaned = '972' + cleaned.slice(1);
    }

    // Remove leading + if not needed
    if (!keepPlus && cleaned.startsWith('+')) {
      cleaned = cleaned.slice(1);
    }

    return cleaned;
  };

  // Validate phone number
  const isValidPhoneNumber = (number: string): boolean => {
    const cleaned = formatPhoneNumber(number);
    // Should be between 10-15 digits
    return /^\d{10,15}$/.test(cleaned);
  };

  // Validate email
  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  // Reset all link fields
  const resetLinkFields = () => {
    setLinkUrl('');
    setPhoneNumber('');
    setMessageText('');
    setEmailAddress('');
    setEmailSubject('');
    setEmailBody('');
    setLinkMode('url');
  };

  const handleLinkSubmit = () => {
    setError(null);

    switch (linkMode) {
      case 'whatsapp': {
        if (!phoneNumber.trim()) {
          setError(t('phoneNumberRequired') || 'יש להזין מספר טלפון');
          return;
        }
        if (!isValidPhoneNumber(phoneNumber)) {
          setError(t('invalidPhoneNumber') || 'מספר טלפון לא תקין');
          return;
        }
        const formattedNumber = formatPhoneNumber(phoneNumber);
        let url = `https://wa.me/${formattedNumber}`;
        if (messageText.trim()) {
          url += `?text=${encodeURIComponent(messageText.trim())}`;
        }
        onLinkAdd?.(url);
        resetLinkFields();
        break;
      }

      case 'phone': {
        if (!phoneNumber.trim()) {
          setError(t('phoneNumberRequired') || 'יש להזין מספר טלפון');
          return;
        }
        if (!isValidPhoneNumber(phoneNumber)) {
          setError(t('invalidPhoneNumber') || 'מספר טלפון לא תקין');
          return;
        }
        const formattedNumber = formatPhoneNumber(phoneNumber, true);
        const url = `tel:+${formattedNumber.replace('+', '')}`;
        onLinkAdd?.(url);
        resetLinkFields();
        break;
      }

      case 'sms': {
        if (!phoneNumber.trim()) {
          setError(t('phoneNumberRequired') || 'יש להזין מספר טלפון');
          return;
        }
        if (!isValidPhoneNumber(phoneNumber)) {
          setError(t('invalidPhoneNumber') || 'מספר טלפון לא תקין');
          return;
        }
        const formattedNumber = formatPhoneNumber(phoneNumber, true);
        let url = `sms:+${formattedNumber.replace('+', '')}`;
        if (messageText.trim()) {
          url += `?body=${encodeURIComponent(messageText.trim())}`;
        }
        onLinkAdd?.(url);
        resetLinkFields();
        break;
      }

      case 'email': {
        if (!emailAddress.trim()) {
          setError(t('emailRequired') || 'יש להזין כתובת אימייל');
          return;
        }
        if (!isValidEmail(emailAddress)) {
          setError(t('invalidEmail') || 'כתובת אימייל לא תקינה');
          return;
        }
        let url = `mailto:${emailAddress.trim()}`;
        const params: string[] = [];
        if (emailSubject.trim()) {
          params.push(`subject=${encodeURIComponent(emailSubject.trim())}`);
        }
        if (emailBody.trim()) {
          params.push(`body=${encodeURIComponent(emailBody.trim())}`);
        }
        if (params.length > 0) {
          url += `?${params.join('&')}`;
        }
        onLinkAdd?.(url);
        resetLinkFields();
        break;
      }

      case 'url':
      default: {
        if (!linkUrl.trim()) return;
        let url = linkUrl.trim();
        // Add https:// if no protocol specified
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }
        try {
          new URL(url);
          onLinkAdd?.(url);
          resetLinkFields();
        } catch {
          setError(t('invalidUrl'));
        }
        break;
      }
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
  };

  // Tab button component for cleaner code
  const TabButton = ({
    tab,
    label,
    icon: Icon,
    badge,
    tooltip
  }: {
    tab: typeof activeTab;
    label: string;
    icon: React.ElementType;
    badge?: string;
    tooltip?: string;
  }) => (
    <div className="relative">
      {badge && (
        <span className="absolute -top-1 -right-1 sm:-top-2 sm:-left-2 sm:right-auto z-20 px-1.5 sm:px-3 py-0.5 text-[10px] sm:text-[15px] font-bold rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 text-white shadow-lg whitespace-nowrap animate-pulse border border-white/20">
          ✨{badge}
        </span>
      )}
      <button
        onClick={() => setActiveTab(tab)}
        title={tooltip}
        className={clsx(
          'w-full flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-lg text-xs font-medium transition-all border',
          activeTab === tab
            ? 'bg-accent text-white border-accent shadow-md'
            : 'bg-white dark:bg-bg-secondary text-gray-600 dark:text-text-secondary border-gray-200 dark:border-border hover:border-accent/50 hover:text-accent'
        )}
      >
        <Icon className="w-4 h-4" />
        <span className="truncate">{label}</span>
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Tab buttons - 4 columns grid on desktop, 3 on mobile */}
      {(onLinkAdd || onRiddleCreate || onWordCloudCreate) && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2 overflow-visible pt-3">
          <TabButton tab="upload" label={tMedia('imageOrBooklet')} icon={Upload} tooltip={t('tooltipUpload')} />
          {onLinkAdd && <TabButton tab="link" label={tMedia('link')} icon={Link} tooltip={t('tooltipLink')} />}
          {onRiddleCreate && <TabButton tab="riddle" label={tMedia('riddle')} icon={FileText} badge="XP" tooltip={t('tooltipRiddle')} />}
          {onWordCloudCreate && <TabButton tab="wordcloud" label={tMedia('wordcloud')} icon={Cloud} tooltip={t('tooltipWordcloud')} />}
          {onSelfiebeamCreate && <TabButton tab="selfiebeam" label={tMedia('selfiebeam')} icon={Camera} tooltip={t('tooltipSelfiebeam')} />}
          {onQVoteCreate && <TabButton tab="qvote" label="Q.Vote" icon={Vote} badge="NEW" tooltip={t('tooltipQVote') || 'Create a voting experience'} />}
          {onWeeklyCalendarCreate && <TabButton tab="weeklycal" label={tMedia('weeklycal') || 'Weekly'} icon={CalendarDays} tooltip={t('tooltipWeeklyCal') || 'Create a weekly schedule'} />}
          <TabButton tab="minigames" label={tMedia('minigames')} icon={Gamepad2} tooltip={t('tooltipMinigames')} />
        </div>
      )}

      {activeTab === 'upload' ? (
        <>
          {/* Mobile: Compact upload button */}
          <div className="sm:hidden">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              accept="image/*,video/*,.pdf"
              className="hidden"
              disabled={disabled}
            />
            <button
              onClick={() => !disabled && fileInputRef.current?.click()}
              disabled={disabled}
              className={clsx(
                'w-full flex items-center justify-center gap-3 py-4 px-4 rounded-xl border-2 border-dashed transition-all',
                'border-border hover:border-accent/50 hover:bg-accent/5',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <Upload className="w-5 h-5 text-accent" />
              </div>
              <div className="text-start">
                <p className="font-medium text-text-primary">{t('uploadFile')}</p>
                <p className="text-xs text-text-secondary">{t('imageVideoOrPdf')} ({t('upTo')} {formatBytes(maxSize)})</p>
              </div>
            </button>
          </div>

          {/* Desktop: Full drag & drop area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !disabled && fileInputRef.current?.click()}
            className={clsx(
              'hidden sm:block border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
              isDragging
                ? 'border-accent bg-accent/10'
                : 'border-border hover:border-accent/50',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <input
              type="file"
              onChange={handleFileChange}
              accept="image/*,video/*,.pdf"
              className="hidden"
              disabled={disabled}
            />

            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                <Upload className="w-6 h-6 text-accent" />
              </div>

              <div>
                <h3 className="text-base font-medium text-text-primary mb-1">
                  {t('uploadContent')}
                </h3>
                <p className="text-sm text-text-secondary">
                  {t('dragOrClickToUpload')}
                </p>
              </div>

              <div className="flex items-center gap-4 text-text-secondary">
                <span className="flex items-center gap-1 text-xs">
                  <Image className="w-4 h-4" />
                  {t('images')}
                </span>
                <span className="flex items-center gap-1 text-xs">
                  <Video className="w-4 h-4" />
                  {tMedia('video')}
                </span>
                <span className="flex items-center gap-1 text-xs">
                  <FileText className="w-4 h-4" />
                  {tMedia('pdf')}
                </span>
              </div>

              <p className="text-xs text-text-secondary">
                {t('upTo')} {formatBytes(maxSize)} · JPG, PNG, WebP, GIF, MP4, WebM, PDF
              </p>
            </div>
          </div>
        </>
      ) : activeTab === 'link' ? (
        /* Link input with button selector for all link types */
        <div className="space-y-3">
          {/* Link mode buttons - grid of options */}
          <div className="grid grid-cols-5 gap-1.5">
            {linkModeOptions.map((option) => (
              <button
                key={option.mode}
                onClick={() => setLinkMode(option.mode)}
                className={clsx(
                  'flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg text-xs font-medium transition-all border',
                  linkMode === option.mode
                    ? option.mode === 'whatsapp'
                      ? 'bg-[#25D366] text-white border-[#25D366]'
                      : 'bg-accent text-white border-accent'
                    : 'bg-white dark:bg-bg-secondary text-gray-600 dark:text-text-secondary border-gray-200 dark:border-border hover:border-accent/50'
                )}
              >
                <span className={clsx(
                  linkMode === option.mode && option.mode === 'whatsapp' ? 'text-white' : ''
                )}>
                  {option.icon}
                </span>
                <span className="truncate text-[10px]">{t(option.labelKey) || option.label}</span>
              </button>
            ))}
          </div>

          {/* Fields based on selected mode */}
          {linkMode === 'url' && (
            <div className="flex items-center gap-3 p-3 bg-bg-secondary rounded-xl">
              <Link className="w-5 h-5 text-text-secondary flex-shrink-0" />
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder={t('enterUrl')}
                className="input flex-1 text-sm"
                dir="ltr"
              />
            </div>
          )}

          {(linkMode === 'whatsapp' || linkMode === 'phone' || linkMode === 'sms') && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-bg-secondary rounded-xl">
                <Phone className="w-5 h-5 text-text-secondary flex-shrink-0" />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder={t('phoneNumberPlaceholder') || '050-1234567 או +972501234567'}
                  className="input flex-1 text-sm"
                  dir="ltr"
                />
              </div>
              {(linkMode === 'whatsapp' || linkMode === 'sms') && (
                <div className="flex items-center gap-3 p-3 bg-bg-secondary rounded-xl">
                  <MessageCircle className="w-5 h-5 text-text-secondary flex-shrink-0" />
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={t('messagePlaceholder') || 'הודעה (אופציונלי)'}
                    className="input flex-1 text-sm"
                  />
                </div>
              )}
              <p className="text-xs text-text-secondary text-center">
                {linkMode === 'whatsapp' && (t('whatsappDescription') || 'סורקי הקוד יועברו לשיחת וואטסאפ')}
                {linkMode === 'phone' && (t('phoneDescription') || 'סורקי הקוד יחייגו למספר הטלפון')}
                {linkMode === 'sms' && (t('smsDescription') || 'סורקי הקוד יפתחו הודעת SMS')}
              </p>
            </div>
          )}

          {linkMode === 'email' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-bg-secondary rounded-xl">
                <Mail className="w-5 h-5 text-text-secondary flex-shrink-0" />
                <input
                  type="email"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  placeholder={t('emailAddressPlaceholder') || 'example@email.com'}
                  className="input flex-1 text-sm"
                  dir="ltr"
                />
              </div>
              <div className="flex items-center gap-3 p-3 bg-bg-secondary rounded-xl">
                <span className="text-xs text-text-secondary flex-shrink-0 w-5">נושא</span>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder={t('emailSubjectPlaceholder') || 'נושא (אופציונלי)'}
                  className="input flex-1 text-sm"
                />
              </div>
              <div className="flex items-start gap-3 p-3 bg-bg-secondary rounded-xl">
                <span className="text-xs text-text-secondary flex-shrink-0 w-5 pt-1">תוכן</span>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder={t('emailBodyPlaceholder') || 'תוכן ההודעה (אופציונלי)'}
                  className="input flex-1 text-sm min-h-[60px] resize-none"
                  rows={2}
                />
              </div>
              <p className="text-xs text-text-secondary text-center">
                {t('emailDescription') || 'סורקי הקוד יפתחו את תוכנת המייל שלהם'}
              </p>
            </div>
          )}

          <button
            onClick={handleLinkSubmit}
            disabled={
              (linkMode === 'url' && !linkUrl.trim()) ||
              ((linkMode === 'whatsapp' || linkMode === 'phone' || linkMode === 'sms') && !phoneNumber.trim()) ||
              (linkMode === 'email' && !emailAddress.trim())
            }
            className={clsx(
              'btn w-full disabled:opacity-50',
              linkMode === 'whatsapp' ? 'bg-[#25D366] hover:bg-[#20BA5C] text-white' : 'btn-primary'
            )}
          >
            {t('createExperience')}
          </button>
        </div>
      ) : activeTab === 'riddle' ? (
        /* Riddle creation */
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-4 bg-bg-secondary rounded-xl">
            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
              <img
                src="/media/riddle.jpg"
                alt={tMedia('riddle')}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-start">
              <h3 className="font-medium text-text-primary mb-1">
                {tMedia('riddle')}
              </h3>
              <p className="text-xs text-text-secondary">
                {t('riddleDescription')}
              </p>
            </div>
          </div>
          <button
            onClick={onRiddleCreate}
            disabled={disabled}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            {t('createRiddle')}
          </button>
        </div>
      ) : activeTab === 'wordcloud' ? (
        /* Word Cloud creation */
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-4 bg-bg-secondary rounded-xl">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Cloud className="w-6 h-6 text-accent" />
            </div>
            <div className="text-start">
              <h3 className="font-medium text-text-primary mb-1">
                {tMedia('wordcloud')}
              </h3>
              <p className="text-xs text-text-secondary">
                {t('wordCloudDescription')}
              </p>
            </div>
          </div>
          <button
            onClick={onWordCloudCreate}
            disabled={disabled}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            {t('createWordCloud')}
          </button>
        </div>
      ) : activeTab === 'selfiebeam' ? (
        /* Selfiebeam creation */
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-4 bg-bg-secondary rounded-xl">
            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
              <img
                src="/media/SELFIEBEAM.jpg"
                alt={tMedia('selfiebeam')}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-start">
              <h3 className="font-medium text-text-primary mb-1">
                {tMedia('selfiebeam')}
              </h3>
              <p className="text-xs text-text-secondary">
                {t('selfiebeamDescription')}
              </p>
            </div>
          </div>
          <button
            onClick={onSelfiebeamCreate}
            disabled={disabled}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            {t('createSelfiebeam')}
          </button>
        </div>
      ) : activeTab === 'qvote' ? (
        /* Q.Vote creation */
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-4 bg-bg-secondary rounded-xl">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
              <Vote className="w-6 h-6 text-white" />
            </div>
            <div className="text-start">
              <h3 className="font-medium text-text-primary mb-1">
                Q.Vote
              </h3>
              <p className="text-xs text-text-secondary">
                {t('qvoteDescription') || 'Create a digital voting experience for events'}
              </p>
            </div>
          </div>
          <button
            onClick={onQVoteCreate}
            disabled={disabled}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            {t('createQVote') || 'Create Q.Vote'}
          </button>
        </div>
      ) : activeTab === 'weeklycal' ? (
        /* Weekly Calendar creation */
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-4 bg-bg-secondary rounded-xl">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0">
              <CalendarDays className="w-6 h-6 text-white" />
            </div>
            <div className="text-start">
              <h3 className="font-medium text-text-primary mb-1">
                {tMedia('weeklycal') || 'Weekly Calendar'}
              </h3>
              <p className="text-xs text-text-secondary">
                {t('weeklyCalDescription') || 'Create a weekly schedule with activities and events'}
              </p>
            </div>
          </div>
          <button
            onClick={onWeeklyCalendarCreate}
            disabled={disabled}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            {t('createWeeklyCal') || 'Create Weekly Calendar'}
          </button>
        </div>
      ) : activeTab === 'minigames' ? (
        /* Minigames - coming soon */
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-4 bg-bg-secondary rounded-xl">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Gamepad2 className="w-6 h-6 text-accent" />
            </div>
            <div className="text-start">
              <h3 className="font-medium text-text-primary mb-1">
                {tMedia('minigames')}
              </h3>
              <p className="text-xs text-text-secondary">
                {t('minigamesDescription')}
              </p>
            </div>
          </div>
          <button
            disabled
            className="btn w-full bg-bg-secondary text-text-secondary cursor-not-allowed"
          >
            {t('comingSoon')}
          </button>
        </div>
      ) : null}

      {/* Error message */}
      {error && (
        <p className="text-sm text-danger text-center">{error}</p>
      )}
    </div>
  );
}
