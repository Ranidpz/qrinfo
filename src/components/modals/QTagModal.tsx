'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Palette,
  Settings,
  Image as ImageIcon,
  Loader2,
  Upload,
  ExternalLink,
  ScanLine,
  UserPlus,
  Users,
  MoreVertical,
} from 'lucide-react';
import type { QTagConfig, QTagSkin } from '@/types/qtag';
import { DEFAULT_QTAG_CONFIG, DEFAULT_QTAG_BRANDING, QTAG_SKINS } from '@/types/qtag';

interface QTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: QTagConfig, backgroundImageFile?: File, logoFile?: File) => Promise<void>;
  loading?: boolean;
  initialConfig?: QTagConfig;
  codeId?: string;
  shortId?: string;
  onManageGuests?: () => void;
}

type Tab = 'details' | 'branding' | 'settings';

export default function QTagModal({ isOpen, onClose, onSave, loading, initialConfig, codeId, shortId, onManageGuests }: QTagModalProps) {
  const t = useTranslations('modals');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const isRTL = locale === 'he';
  const isEditing = !!initialConfig;

  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [actionsOpen, setActionsOpen] = useState(false);
  const [config, setConfig] = useState<QTagConfig>(initialConfig || {
    ...DEFAULT_QTAG_CONFIG,
    branding: { ...DEFAULT_QTAG_BRANDING },
  });

  // Image files
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(
    initialConfig?.branding?.backgroundImageUrl || null
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(
    initialConfig?.branding?.logoUrl || null
  );

  // Drag-and-drop state
  const [isDraggingBg, setIsDraggingBg] = useState(false);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);

  // Refs for file inputs
  const bgInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Drag-and-drop counters (prevent flickering from child elements)
  const dragCounterBg = useRef(0);
  const dragCounterLogo = useRef(0);

  // Reset state only when modal opens (not while already open)
  const prevIsOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setConfig(initialConfig || {
        ...DEFAULT_QTAG_CONFIG,
        branding: { ...DEFAULT_QTAG_BRANDING },
      });
      setBackgroundPreview(initialConfig?.branding?.backgroundImageUrl || null);
      setLogoPreview(initialConfig?.branding?.logoUrl || null);
      setBackgroundFile(null);
      setLogoFile(null);
      setActiveTab('details');
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialConfig]);

  if (!isOpen) return null;

  const updateConfig = (updates: Partial<QTagConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const updateBranding = (updates: Partial<QTagConfig['branding']>) => {
    setConfig(prev => ({
      ...prev,
      branding: { ...prev.branding, ...updates },
    }));
  };

  const updateColors = (updates: Partial<QTagConfig['branding']['colors']>) => {
    setConfig(prev => ({
      ...prev,
      branding: {
        ...prev.branding,
        colors: { ...prev.branding.colors, ...updates },
      },
    }));
  };

  // Process image file (shared between click & drag)
  const processFile = (file: File, target: 'background' | 'logo') => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    if (target === 'background') {
      setBackgroundFile(file);
      reader.onload = () => setBackgroundPreview(reader.result as string);
    } else {
      setLogoFile(file);
      reader.onload = () => setLogoPreview(reader.result as string);
    }
    reader.readAsDataURL(file);
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file, 'background');
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file, 'logo');
  };

  // Drag-and-drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent, target: 'background' | 'logo') => {
    e.preventDefault();
    e.stopPropagation();
    if (target === 'background') {
      dragCounterBg.current++;
      setIsDraggingBg(true);
    } else {
      dragCounterLogo.current++;
      setIsDraggingLogo(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent, target: 'background' | 'logo') => {
    e.preventDefault();
    e.stopPropagation();
    if (target === 'background') {
      dragCounterBg.current--;
      if (dragCounterBg.current === 0) setIsDraggingBg(false);
    } else {
      dragCounterLogo.current--;
      if (dragCounterLogo.current === 0) setIsDraggingLogo(false);
    }
  };

  const handleDrop = (e: React.DragEvent, target: 'background' | 'logo') => {
    e.preventDefault();
    e.stopPropagation();
    if (target === 'background') {
      dragCounterBg.current = 0;
      setIsDraggingBg(false);
    } else {
      dragCounterLogo.current = 0;
      setIsDraggingLogo(false);
    }

    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file, target);
  };

  const handleSave = async () => {
    await onSave(config, backgroundFile || undefined, logoFile || undefined);
  };

  const tabs: { id: Tab; label: string; icon: typeof Calendar }[] = [
    { id: 'details', label: t('qtagEventDetails'), icon: Calendar },
    { id: 'branding', label: t('qtagBranding'), icon: Palette },
    { id: 'settings', label: t('qtagSettingsTab'), icon: Settings },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <div className="bg-[#1a1a2e] rounded-t-2xl sm:rounded-2xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] flex flex-col shadow-2xl border border-white/10 border-b-0 sm:border-b">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10">
          <h2 className="text-lg sm:text-xl font-bold text-white font-assistant">
            {isEditing ? t('qtagSettings') : t('qtagCreate')}
          </h2>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Desktop: inline buttons */}
            {isEditing && codeId && onManageGuests && (
              <button
                onClick={() => { onClose(); onManageGuests(); }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-all text-sm font-assistant"
              >
                <Users className="w-4 h-4" />
                {t('qtagManageGuests')}
              </button>
            )}
            {isEditing && codeId && (
              <button
                onClick={() => window.open(`/${locale}/dashboard/qtag/${codeId}/scanner`, '_blank')}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all text-sm font-assistant"
              >
                <ScanLine className="w-4 h-4" />
                {t('qtagOpenScanner')}
              </button>
            )}
            {isEditing && shortId && (
              <button
                onClick={() => window.open(`/v/${shortId}`, '_blank')}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-all text-sm font-assistant"
              >
                <ExternalLink className="w-4 h-4" />
                {t('qtagOpenRegistration')}
              </button>
            )}
            {/* Mobile: dropdown menu */}
            {isEditing && codeId && (
              <div className="relative sm:hidden">
                <button
                  onClick={() => setActionsOpen(!actionsOpen)}
                  className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                {actionsOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setActionsOpen(false)} />
                    <div className={`absolute top-full ${isRTL ? 'left-0' : 'right-0'} mt-1 z-20 min-w-[200px] bg-[#1e1e3a] rounded-xl border border-white/10 shadow-2xl overflow-hidden`}>
                      {onManageGuests && (
                        <button
                          onClick={() => { setActionsOpen(false); onClose(); onManageGuests(); }}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-purple-400 hover:bg-white/5 transition-colors text-sm font-assistant"
                        >
                          <Users className="w-4 h-4" />
                          {t('qtagManageGuests')}
                        </button>
                      )}
                      <button
                        onClick={() => { setActionsOpen(false); window.open(`/${locale}/dashboard/qtag/${codeId}/scanner`, '_blank'); }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-emerald-400 hover:bg-white/5 transition-colors text-sm font-assistant"
                      >
                        <ScanLine className="w-4 h-4" />
                        {t('qtagOpenScanner')}
                      </button>
                      {shortId && (
                        <button
                          onClick={() => { setActionsOpen(false); window.open(`/v/${shortId}`, '_blank'); }}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-blue-400 hover:bg-white/5 transition-colors text-sm font-assistant"
                        >
                          <ExternalLink className="w-4 h-4" />
                          {t('qtagOpenRegistration')}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-3 sm:px-6 pt-2 sm:pt-3 gap-0.5 sm:gap-1 border-b border-white/5">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 flex-1 sm:flex-none px-2 sm:px-4 py-2 sm:py-2.5 rounded-t-lg text-xs sm:text-sm font-medium transition-all font-assistant ${
                activeTab === tab.id
                  ? 'bg-white/10 text-white border-b-2 border-blue-400'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content: Form + Phone Preview side by side */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {/* Form */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4 space-y-4 sm:space-y-5" dir="rtl">
            {/* Event Details Tab */}
            {activeTab === 'details' && (
              <>
                <Field label={t('qtagEventName')} required>
                  <input
                    type="text"
                    value={config.eventName}
                    onChange={(e) => updateConfig({ eventName: e.target.value })}
                    placeholder={t('qtagEventNamePlaceholder')}
                    className="input-field"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('qtagDate')} icon={<Calendar className="w-4 h-4" />}>
                    <input
                      type="date"
                      value={config.eventDate || ''}
                      onChange={(e) => updateConfig({ eventDate: e.target.value })}
                      className="input-field"
                      dir="ltr"
                    />
                  </Field>
                  <Field label={t('qtagTime')} icon={<Clock className="w-4 h-4" />}>
                    <input
                      type="time"
                      value={config.eventTime || ''}
                      onChange={(e) => updateConfig({ eventTime: e.target.value })}
                      className="input-field"
                      dir="ltr"
                    />
                  </Field>
                </div>

                <Field label={t('qtagLocation')} icon={<MapPin className="w-4 h-4" />}>
                  <input
                    type="text"
                    value={config.eventLocation || ''}
                    onChange={(e) => updateConfig({ eventLocation: e.target.value })}
                    placeholder={t('qtagLocationPlaceholder')}
                    className="input-field"
                  />
                </Field>

                <Field label={t('qtagPageTitle')}>
                  <input
                    type="text"
                    value={config.branding.title || ''}
                    onChange={(e) => updateBranding({ title: e.target.value })}
                    placeholder={t('qtagPageTitlePlaceholder')}
                    className="input-field"
                  />
                </Field>

                <Field label={t('qtagSubtitle')}>
                  <input
                    type="text"
                    value={config.branding.subtitle || ''}
                    onChange={(e) => updateBranding({ subtitle: e.target.value })}
                    placeholder={t('qtagSubtitlePlaceholder')}
                    className="input-field"
                  />
                </Field>
              </>
            )}

            {/* Branding Tab */}
            {activeTab === 'branding' && (
              <>
                {/* Background Image + Logo — side by side */}
                <div className="flex gap-2.5 sm:gap-3">
                  {/* Background Image */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <label className="text-xs text-white/50 font-assistant">{t('qtagBackgroundImage')}</label>
                    <div
                      className={`relative w-full h-24 rounded-xl border-2 border-dashed overflow-hidden cursor-pointer transition-all ${
                        isDraggingBg
                          ? 'border-blue-400 bg-blue-500/10 scale-[1.02]'
                          : 'border-white/20 hover:border-white/40'
                      }`}
                      onClick={() => bgInputRef.current?.click()}
                      onDragOver={handleDragOver}
                      onDragEnter={(e) => handleDragEnter(e, 'background')}
                      onDragLeave={(e) => handleDragLeave(e, 'background')}
                      onDrop={(e) => handleDrop(e, 'background')}
                    >
                      {backgroundPreview ? (
                        <>
                          <img src={backgroundPreview} alt="" className="w-full h-full object-cover" />
                          <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isDraggingBg ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}>
                            <Upload className="w-5 h-5 text-white" />
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-white/40">
                          <ImageIcon className="w-6 h-6 mb-1" />
                          <span className="text-[10px] font-assistant">{t('qtagDragOrClickBackground')}</span>
                        </div>
                      )}
                      {isDraggingBg && !backgroundPreview && (
                        <div className="absolute inset-0 flex items-center justify-center bg-blue-500/10">
                          <Upload className="w-6 h-6 text-blue-400 animate-bounce" />
                        </div>
                      )}
                    </div>
                    <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={handleBackgroundUpload} />
                    {backgroundPreview && (
                      <div className="flex items-center justify-between text-[10px] text-white/40 font-assistant">
                        <span className="truncate max-w-[120px]">{backgroundFile?.name || config.branding.backgroundImageName || ''}</span>
                        <span dir="ltr">
                          {backgroundFile
                            ? `${(backgroundFile.size / 1024).toFixed(0)}KB`
                            : config.branding.backgroundImageSize
                              ? `${(config.branding.backgroundImageSize / 1024).toFixed(0)}KB`
                              : ''
                          }
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Logo */}
                  <div className="shrink-0 space-y-1.5">
                    <label className="text-xs text-white/50 font-assistant">{t('qtagLogo')}</label>
                    <div
                      className={`w-20 h-24 sm:w-24 rounded-xl border-2 border-dashed overflow-hidden cursor-pointer transition-all flex items-center justify-center ${
                        isDraggingLogo
                          ? 'border-blue-400 bg-blue-500/10 scale-105'
                          : 'border-white/20 hover:border-white/40'
                      }`}
                      onClick={() => logoInputRef.current?.click()}
                      onDragOver={handleDragOver}
                      onDragEnter={(e) => handleDragEnter(e, 'logo')}
                      onDragLeave={(e) => handleDragLeave(e, 'logo')}
                      onDrop={(e) => handleDrop(e, 'logo')}
                      style={!isDraggingLogo ? { background: 'repeating-conic-gradient(#1f1f3a 0% 25%, #2a2a4a 0% 50%) 50% / 16px 16px' } : undefined}
                    >
                      {logoPreview ? (
                        <img src={logoPreview} alt="" className="w-full h-full object-contain p-1" />
                      ) : (
                        <Upload className={`w-5 h-5 text-white/40 ${isDraggingLogo ? 'text-blue-400 animate-bounce' : ''}`} />
                      )}
                    </div>
                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </div>
                </div>

                {/* Overlay + Logo scale — compact row */}
                {(backgroundPreview || logoPreview) && (
                  <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:gap-4 min-[420px]:items-end">
                    {backgroundPreview && (
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] text-white/50 font-assistant">{t('qtagOverlay')} {config.branding.imageOverlayOpacity || 40}%</label>
                        <input
                          type="range"
                          min={0}
                          max={80}
                          value={config.branding.imageOverlayOpacity || 40}
                          onChange={(e) => updateBranding({ imageOverlayOpacity: Number(e.target.value) })}
                          className="w-full accent-blue-500"
                          dir="ltr"
                        />
                      </div>
                    )}
                    {logoPreview && (
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] text-white/50 font-assistant">{t('qtagScale')} {(config.branding.logoScale || 1).toFixed(1)}x</label>
                        <input
                          type="range"
                          min={0.3}
                          max={2}
                          step={0.1}
                          value={config.branding.logoScale || 1}
                          onChange={(e) => updateBranding({ logoScale: Number(e.target.value) })}
                          className="w-full accent-blue-500"
                          dir="ltr"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Skin Presets + Colors */}
                <div className="space-y-3">
                  <SkinSelector
                    currentColors={config.branding.colors}
                    onSelect={(skin) => updateBranding({
                      colors: { ...skin.colors },
                      imageOverlayOpacity: skin.imageOverlayOpacity,
                    })}
                    t={t}
                  />
                  <div className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 min-[420px]:gap-3">
                    <ColorPicker label={t('qtagColorBackground')} value={config.branding.colors.background} onChange={(v) => updateColors({ background: v })} />
                    <ColorPicker label={t('qtagColorText')} value={config.branding.colors.text} onChange={(v) => updateColors({ text: v })} />
                    <ColorPicker label={t('qtagColorButton')} value={config.branding.colors.buttonBackground} onChange={(v) => updateColors({ buttonBackground: v })} />
                    <ColorPicker label={t('qtagColorButtonText')} value={config.branding.colors.buttonText} onChange={(v) => updateColors({ buttonText: v })} />
                  </div>
                </div>

                {/* Register button text */}
                <Field label={t('qtagRegisterButtonText')}>
                  <input
                    type="text"
                    value={config.branding.registerButtonText || ''}
                    onChange={(e) => updateBranding({ registerButtonText: e.target.value })}
                    placeholder={t('qtagRegisterButtonPlaceholder')}
                    className="input-field"
                  />
                </Field>
              </>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <>
                <ToggleField
                  label={t('qtagAllowPlusOne')}
                  checked={config.allowPlusOne}
                  onChange={(v) => updateConfig({ allowPlusOne: v })}
                />

                {config.allowPlusOne && (
                  <Field label={t('qtagMaxGuests')}>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={config.maxGuestsPerRegistration}
                      onChange={(e) => updateConfig({ maxGuestsPerRegistration: Math.max(1, Math.min(10, Number(e.target.value))) })}
                      className="input-field w-24"
                      dir="ltr"
                    />
                  </Field>
                )}

                {config.allowPlusOne && (
                  <ToggleField
                    label={t('qtagAskGuestGender')}
                    checked={config.requireGuestGender}
                    onChange={(v) => updateConfig({ requireGuestGender: v })}
                  />
                )}

                <Field label={t('qtagMaxRegistrations')}>
                  <input
                    type="number"
                    min={0}
                    value={config.maxRegistrations || 0}
                    onChange={(e) => updateConfig({ maxRegistrations: Math.max(0, Number(e.target.value)) })}
                    className="input-field w-24"
                    dir="ltr"
                  />
                </Field>

                <ToggleField
                  label={t('qtagPhoneVerification')}
                  checked={config.verification?.enabled ?? true}
                  onChange={(v) => updateConfig({
                    verification: { ...config.verification, enabled: v },
                  })}
                />

                <ToggleField
                  label={t('qtagEnableScanner')}
                  checked={config.scannerEnabled}
                  onChange={(v) => updateConfig({ scannerEnabled: v })}
                />

                {config.scannerEnabled && (
                  <>
                    <Field label={t('qtagScannerPin')}>
                      <input
                        type="text"
                        value={config.scannerPin || ''}
                        onChange={(e) => updateConfig({ scannerPin: e.target.value })}
                        placeholder={t('qtagScannerPinPlaceholder')}
                        className="input-field"
                        maxLength={6}
                        dir="ltr"
                      />
                    </Field>
                    <ScannerCalculator t={t} />
                  </>
                )}
              </>
            )}
          </div>

          {/* Phone Preview */}
          <div className="hidden lg:flex w-72 border-s border-white/10 items-center justify-center p-4 bg-black/20">
            <PhonePreview
              config={config}
              backgroundPreview={backgroundPreview}
              logoPreview={logoPreview}
              t={t}
              locale={locale}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all font-assistant text-sm sm:text-base"
          >
            {tCommon('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !config.eventName.trim()}
            className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-blue-500 text-white font-semibold hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-assistant text-sm sm:text-base"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isEditing ? t('qtagUpdating') : t('qtagCreating')}
              </>
            ) : (
              isEditing ? t('qtagUpdate') : t('qtagCreate')
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        .input-field {
          width: 100%;
          padding: 0.625rem 1rem;
          border-radius: 0.75rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.05);
          color: white;
          font-family: var(--font-assistant), sans-serif;
          font-size: 0.875rem;
          outline: none;
          transition: all 0.2s;
        }
        .input-field:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
        }
        .input-field::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  );
}

// ── Phone Preview Component ──
function PhonePreview({
  config,
  backgroundPreview,
  logoPreview,
  t,
  locale,
}: {
  config: QTagConfig;
  backgroundPreview: string | null;
  logoPreview: string | null;
  t: (key: string) => string;
  locale: string;
}) {
  const branding = config.branding;
  const overlayOpacity = branding.imageOverlayOpacity ?? 40;

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-xs text-white/40 font-assistant">{t('qtagPreview')}</span>

      {/* Phone frame */}
      <div className="relative w-[210px] h-[420px] rounded-[32px] border-[3px] border-white/20 bg-black overflow-hidden shadow-2xl">
        {/* Dynamic Island / Notch */}
        <div className="absolute top-2 inset-x-0 flex justify-center z-20">
          <div className="w-20 h-5 bg-black rounded-full" />
        </div>

        {/* Screen content */}
        <div className="absolute inset-[3px] rounded-[28px] overflow-hidden">
          {/* Background */}
          {backgroundPreview ? (
            <>
              <img src={backgroundPreview} alt="" className="w-full h-full object-cover" />
              <div
                className="absolute inset-0"
                style={{ backgroundColor: `rgba(0, 0, 0, ${overlayOpacity / 100})` }}
              />
            </>
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(135deg, ${branding.colors.background} 0%, ${branding.colors.accent || '#2d1b69'} 100%)` }}
            />
          )}

          {/* Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 z-10">
            {/* Logo */}
            {logoPreview && (
              <img
                src={logoPreview}
                alt=""
                className="max-h-14 object-contain mb-3 drop-shadow-md"
                style={{ transform: `scale(${branding.logoScale || 1})` }}
              />
            )}

            {/* Event name (small label when custom title is set) */}
            {branding.title && config.eventName && (
              <p
                className="text-[9px] mb-0.5 font-assistant opacity-60 line-clamp-1"
                style={{ color: backgroundPreview ? '#ffffff' : branding.colors.text }}
              >
                {config.eventName}
              </p>
            )}

            {/* Title */}
            <h3
              className="text-sm font-bold mb-1 line-clamp-2 font-assistant leading-tight"
              style={{ color: backgroundPreview ? '#ffffff' : branding.colors.text }}
            >
              {branding.title || config.eventName || t('qtagEventNamePlaceholder')}
            </h3>

            {/* Subtitle */}
            {branding.subtitle && (
              <p
                className="text-[10px] mb-2 line-clamp-1 font-assistant opacity-80"
                style={{ color: backgroundPreview ? '#ffffff' : branding.colors.text }}
              >
                {branding.subtitle}
              </p>
            )}

            {/* Event info pills */}
            <div className="flex flex-wrap justify-center gap-1 mb-4">
              {config.eventDate && (
                <span className="text-[8px] px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
                  <Calendar className="w-2 h-2 inline mr-0.5" />
                  {new Date(config.eventDate).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', { day: 'numeric', month: 'short' })}
                </span>
              )}
              {config.eventTime && (
                <span className="text-[8px] px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
                  <Clock className="w-2 h-2 inline mr-0.5" />
                  {config.eventTime}
                </span>
              )}
              {config.eventLocation && (
                <span className="text-[8px] px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
                  <MapPin className="w-2 h-2 inline mr-0.5" />
                  <span className="max-w-[60px] truncate inline-block align-bottom">{config.eventLocation}</span>
                </span>
              )}
            </div>

            {/* Register button */}
            <div
              className="px-5 py-2 rounded-xl text-[11px] font-semibold shadow-lg font-assistant flex items-center gap-1.5"
              style={{
                backgroundColor: branding.colors.buttonBackground,
                color: branding.colors.buttonText,
              }}
            >
              <UserPlus className="w-3 h-3" />
              {branding.registerButtonText || t('qtagRegisterNow')}
            </div>
          </div>
        </div>

        {/* Home indicator */}
        <div className="absolute bottom-1.5 inset-x-0 flex justify-center z-20">
          <div className="w-16 h-1 bg-white/30 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// ── Helper components ──
function Field({ label, icon, required, children }: {
  label: string;
  icon?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-sm font-medium text-white/70 font-assistant">
        {icon}
        {label}
        {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

function ColorPicker({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const colorRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-1.5">
      <label className="text-xs text-white/50 font-assistant">{label}</label>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => colorRef.current?.click()}
          className="shrink-0 w-10 h-10 rounded-xl border-2 border-white/15 shadow-inner cursor-pointer transition-all hover:border-white/30 hover:scale-105 active:scale-95"
          style={{ backgroundColor: value }}
        >
          <input
            ref={colorRef}
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="sr-only"
          />
        </button>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white text-sm font-mono"
          dir="ltr"
        />
      </div>
    </div>
  );
}

function SkinSelector({ currentColors, onSelect, t }: {
  currentColors: QTagConfig['branding']['colors'];
  onSelect: (skin: QTagSkin) => void;
  t: (key: string) => string;
}) {
  const skinLabels: Record<string, string> = {
    dark: t('qtagSkinDark'),
    light: t('qtagSkinLight'),
  };

  const isActive = (skin: QTagSkin) =>
    skin.colors.background === currentColors.background &&
    skin.colors.text === currentColors.text &&
    skin.colors.buttonBackground === currentColors.buttonBackground &&
    skin.colors.buttonText === currentColors.buttonText;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-white/50 font-assistant">{t('qtagSkins')}</span>
      {QTAG_SKINS.map((skin) => {
        const active = isActive(skin);
        return (
          <button
            key={skin.id}
            type="button"
            onClick={() => onSelect(skin)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-xs font-medium font-assistant ${
              active
                ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-400/50'
                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80'
            }`}
          >
            <div
              className="w-3 h-3 rounded-full border border-white/20"
              style={{
                background: `linear-gradient(135deg, ${skin.colors.background}, ${skin.colors.accent || skin.colors.background})`,
              }}
            />
            {skinLabels[skin.id]}
          </button>
        );
      })}
    </div>
  );
}

function ScannerCalculator({ t }: { t: (key: string) => string }) {
  const [open, setOpen] = useState(false);
  const [guests, setGuests] = useState(500);
  const [scanners, setScanners] = useState(2);

  const SCANS_PER_MIN = 15; // ~4 sec per scan
  const PEAK_FACTOR = 0.7;  // 70% arrive in peak window

  const peakGuests = Math.round(guests * PEAK_FACTOR);
  const totalScansPerMin = scanners * SCANS_PER_MIN;
  const peakMinutes = Math.ceil(peakGuests / totalScansPerMin);
  const recommended = Math.ceil(peakGuests / (20 * SCANS_PER_MIN)); // target: 20 min peak

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-xs text-white/50 font-assistant font-medium hover:bg-white/[0.03] transition-colors"
      >
        <span>{t('qtagScannerCalc')}</span>
        <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-white/5">
          <div className="flex gap-3 mt-3">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] text-white/40 font-assistant">{t('qtagScannerCalcGuests')}</label>
              <input
                type="number"
                value={guests}
                onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono text-center"
                dir="ltr"
                min={1}
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-[10px] text-white/40 font-assistant">{t('qtagScannerCalcScanners')}</label>
              <input
                type="number"
                value={scanners}
                onChange={(e) => setScanners(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono text-center"
                dir="ltr"
                min={1}
                max={20}
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs font-assistant">
            <div className="flex items-center gap-2">
              <span className="text-white/40">{t('qtagScannerCalcPeakTime')}:</span>
              <span className={`font-bold ${peakMinutes <= 20 ? 'text-green-400' : peakMinutes <= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                {peakMinutes} {t('qtagScannerCalcMinutes')}
              </span>
            </div>
            <span className="text-white/30">{totalScansPerMin} {t('qtagScannerCalcPerMin')}</span>
          </div>
          {recommended > scanners && (
            <div className="text-[11px] text-amber-400/80 font-assistant">
              {t('qtagScannerCalcRecommend').replace('{count}', String(recommended))}
            </div>
          )}
          <p className="text-[10px] text-white/25 font-assistant leading-relaxed">{t('qtagScannerCalcDisclaimer')}</p>
        </div>
      )}
    </div>
  );
}

function ToggleField({ label, checked, onChange }: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-white/80 font-assistant">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className="w-12 h-7 rounded-full relative transition-colors"
        style={{ backgroundColor: checked ? '#3b82f6' : 'rgba(255,255,255,0.2)' }}
      >
        <div
          className="absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-sm"
          style={{ right: checked ? '0.25rem' : '1.5rem' }}
        />
      </button>
    </div>
  );
}
