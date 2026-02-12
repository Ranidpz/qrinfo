'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import type { QTagConfig } from '@/types/qtag';
import { DEFAULT_QTAG_CONFIG, DEFAULT_QTAG_BRANDING } from '@/types/qtag';

interface QTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: QTagConfig, backgroundImageFile?: File, logoFile?: File) => Promise<void>;
  loading?: boolean;
  initialConfig?: QTagConfig;
}

type Tab = 'details' | 'branding' | 'settings';

export default function QTagModal({ isOpen, onClose, onSave, loading, initialConfig }: QTagModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('details');
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

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackgroundFile(file);
    const reader = new FileReader();
    reader.onload = () => setBackgroundPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    await onSave(config, backgroundFile || undefined, logoFile || undefined);
  };

  const tabs: { id: Tab; label: string; icon: typeof Calendar }[] = [
    { id: 'details', label: 'Event Details', icon: Calendar },
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a2e] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-xl font-bold text-white font-assistant">Create Q.Tag</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 pt-3 gap-1 border-b border-white/5">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium transition-all font-assistant ${
                activeTab === tab.id
                  ? 'bg-white/10 text-white border-b-2 border-blue-400'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5" dir="rtl">
          {/* Event Details Tab */}
          {activeTab === 'details' && (
            <>
              <Field label="Event Name" required>
                <input
                  type="text"
                  value={config.eventName}
                  onChange={(e) => updateConfig({ eventName: e.target.value })}
                  placeholder="Event name..."
                  className="input-field"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Date" icon={<Calendar className="w-4 h-4" />}>
                  <input
                    type="date"
                    value={config.eventDate || ''}
                    onChange={(e) => updateConfig({ eventDate: e.target.value })}
                    className="input-field"
                    dir="ltr"
                  />
                </Field>
                <Field label="Time" icon={<Clock className="w-4 h-4" />}>
                  <input
                    type="time"
                    value={config.eventTime || ''}
                    onChange={(e) => updateConfig({ eventTime: e.target.value })}
                    className="input-field"
                    dir="ltr"
                  />
                </Field>
              </div>

              <Field label="Location" icon={<MapPin className="w-4 h-4" />}>
                <input
                  type="text"
                  value={config.eventLocation || ''}
                  onChange={(e) => updateConfig({ eventLocation: e.target.value })}
                  placeholder="Location..."
                  className="input-field"
                />
              </Field>

              <Field label="Title (displayed on page)">
                <input
                  type="text"
                  value={config.branding.title || ''}
                  onChange={(e) => updateBranding({ title: e.target.value })}
                  placeholder="Page title..."
                  className="input-field"
                />
              </Field>

              <Field label="Subtitle / Slogan">
                <input
                  type="text"
                  value={config.branding.subtitle || ''}
                  onChange={(e) => updateBranding({ subtitle: e.target.value })}
                  placeholder="Subtitle..."
                  className="input-field"
                />
              </Field>
            </>
          )}

          {/* Branding Tab */}
          {activeTab === 'branding' && (
            <>
              {/* Background Image */}
              <Field label="Background Image">
                <div
                  className="relative w-full h-32 rounded-xl border-2 border-dashed border-white/20 overflow-hidden cursor-pointer hover:border-white/40 transition-colors"
                  onClick={() => document.getElementById('bg-upload')?.click()}
                >
                  {backgroundPreview ? (
                    <>
                      <img src={backgroundPreview} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <Upload className="w-6 h-6 text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-white/40">
                      <ImageIcon className="w-8 h-8 mb-2" />
                      <span className="text-sm font-assistant">Upload background</span>
                    </div>
                  )}
                </div>
                <input id="bg-upload" type="file" accept="image/*" className="hidden" onChange={handleBackgroundUpload} />
              </Field>

              {/* Overlay opacity */}
              {backgroundPreview && (
                <Field label={`Overlay ${config.branding.imageOverlayOpacity || 40}%`}>
                  <input
                    type="range"
                    min={0}
                    max={80}
                    value={config.branding.imageOverlayOpacity || 40}
                    onChange={(e) => updateBranding({ imageOverlayOpacity: Number(e.target.value) })}
                    className="w-full accent-blue-500"
                    dir="ltr"
                  />
                </Field>
              )}

              {/* Logo */}
              <Field label="Logo">
                <div className="flex items-center gap-4">
                  <div
                    className="w-20 h-20 rounded-xl border-2 border-dashed border-white/20 overflow-hidden cursor-pointer hover:border-white/40 transition-colors flex items-center justify-center"
                    onClick={() => document.getElementById('logo-upload')?.click()}
                    style={{ background: 'repeating-conic-gradient(#1f1f3a 0% 25%, #2a2a4a 0% 50%) 50% / 16px 16px' }}
                  >
                    {logoPreview ? (
                      <img src={logoPreview} alt="" className="w-full h-full object-contain p-1" />
                    ) : (
                      <Upload className="w-5 h-5 text-white/40" />
                    )}
                  </div>
                  {logoPreview && (
                    <div className="flex-1">
                      <label className="text-xs text-white/50 font-assistant">Scale: {(config.branding.logoScale || 1).toFixed(1)}x</label>
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
                <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </Field>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-3">
                <ColorPicker label="Background" value={config.branding.colors.background} onChange={(v) => updateColors({ background: v })} />
                <ColorPicker label="Text" value={config.branding.colors.text} onChange={(v) => updateColors({ text: v })} />
                <ColorPicker label="Button" value={config.branding.colors.buttonBackground} onChange={(v) => updateColors({ buttonBackground: v })} />
                <ColorPicker label="Button Text" value={config.branding.colors.buttonText} onChange={(v) => updateColors({ buttonText: v })} />
              </div>

              {/* Register button text */}
              <Field label="Register Button Text">
                <input
                  type="text"
                  value={config.branding.registerButtonText || ''}
                  onChange={(e) => updateBranding({ registerButtonText: e.target.value })}
                  placeholder="Register Now"
                  className="input-field"
                />
              </Field>
            </>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <>
              <ToggleField
                label="Allow +1 Guests"
                checked={config.allowPlusOne}
                onChange={(v) => updateConfig({ allowPlusOne: v })}
              />

              {config.allowPlusOne && (
                <Field label="Max Guests Per Registration">
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
                  label="Ask Guest Gender"
                  checked={config.requireGuestGender}
                  onChange={(v) => updateConfig({ requireGuestGender: v })}
                />
              )}

              <Field label="Max Registrations (0 = unlimited)">
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
                label="Phone Verification (WhatsApp)"
                checked={config.verification?.enabled ?? true}
                onChange={(v) => updateConfig({
                  verification: { ...config.verification, enabled: v },
                })}
              />

              <ToggleField
                label="Enable Scanner"
                checked={config.scannerEnabled}
                onChange={(v) => updateConfig({ scannerEnabled: v })}
              />

              {config.scannerEnabled && (
                <Field label="Scanner PIN (optional)">
                  <input
                    type="text"
                    value={config.scannerPin || ''}
                    onChange={(e) => updateConfig({ scannerPin: e.target.value })}
                    placeholder="Leave empty for open access"
                    className="input-field"
                    maxLength={6}
                    dir="ltr"
                  />
                </Field>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all font-assistant"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !config.eventName.trim()}
            className="px-6 py-2.5 rounded-xl bg-blue-500 text-white font-semibold hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-assistant"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Q.Tag'
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

// Helper components
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
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-white/50 font-assistant">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white text-xs font-mono"
          dir="ltr"
        />
      </div>
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
