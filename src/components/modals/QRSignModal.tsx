'use client';

import { useState, useEffect, useRef } from 'react';
import { X, QrCode, Type, Grid3X3, Image, Upload, Trash2 } from 'lucide-react';
import { QRSign, QRSignType } from '@/types';
import { ICON_NAMES, ICON_LABELS } from '@/lib/iconPaths';
import * as LucideIcons from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface QRSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sign: QRSign | undefined) => Promise<void>;
  currentSign?: QRSign;
}

const DEFAULT_SIGN: QRSign = {
  enabled: true,
  type: 'logo',
  value: '/theQ.png',
  color: '#000000',
  backgroundColor: '#ffffff',
  scale: 1.0,
};

const MAX_LOGO_SIZE = 200; // Max width/height in pixels
const MAX_FILE_SIZE = 500 * 1024; // 500KB

export default function QRSignModal({
  isOpen,
  onClose,
  onSave,
  currentSign,
}: QRSignModalProps) {
  const [localSign, setLocalSign] = useState<QRSign>(currentSign || DEFAULT_SIGN);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'logo' | 'text' | 'icon'>('logo');
  const [isDragging, setIsDragging] = useState(false);
  const [logoSize, setLogoSize] = useState<{ width: number; height: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = useTranslations('modals');
  const tCommon = useTranslations('common');

  useEffect(() => {
    if (isOpen) {
      setLocalSign(currentSign || DEFAULT_SIGN);
      if (currentSign?.type === 'icon') {
        setActiveTab('icon');
      } else if (currentSign?.type === 'logo') {
        setActiveTab('logo');
      } else {
        setActiveTab('text');
      }
    }
  }, [isOpen, currentSign]);

  // Get logo dimensions when logo changes
  useEffect(() => {
    if (localSign.type === 'logo' && localSign.value) {
      const img = new window.Image();
      img.onload = () => {
        setLogoSize({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.src = localSign.value;
    } else {
      setLogoSize(null);
    }
  }, [localSign.value, localSign.type]);

  if (!isOpen) return null;

  const updateSign = (updates: Partial<QRSign>) => {
    setLocalSign(prev => ({ ...prev, ...updates }));
  };

  // Resize image if needed and convert to base64
  const processImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          // Check if resize is needed
          if (img.width <= MAX_LOGO_SIZE && img.height <= MAX_LOGO_SIZE && file.size <= MAX_FILE_SIZE) {
            // No resize needed, use original
            resolve(e.target?.result as string);
            return;
          }

          // Resize the image
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions maintaining aspect ratio
          if (width > height) {
            if (width > MAX_LOGO_SIZE) {
              height = (height * MAX_LOGO_SIZE) / width;
              width = MAX_LOGO_SIZE;
            }
          } else {
            if (height > MAX_LOGO_SIZE) {
              width = (width * MAX_LOGO_SIZE) / height;
              height = MAX_LOGO_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Export as PNG to preserve transparency
          const dataUrl = canvas.toDataURL('image/png', 0.9);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('יש להעלות קובץ תמונה בלבד');
      return;
    }

    // Only allow PNG for transparency support
    if (file.type !== 'image/png' && file.type !== 'image/jpeg' && file.type !== 'image/webp') {
      alert('יש להעלות קובץ PNG, JPEG או WebP');
      return;
    }

    try {
      const dataUrl = await processImage(file);
      updateSign({ type: 'logo', value: dataUrl });
    } catch (error) {
      console.error('Error processing image:', error);
      alert('שגיאה בעיבוד התמונה');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const resetToDefaultLogo = () => {
    updateSign({ type: 'logo', value: '/theQ.png' });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (localSign.value && localSign.enabled) {
        await onSave(localSign);
      } else if (!localSign.enabled) {
        await onSave(undefined);
      }
      onClose();
    } catch (error) {
      console.error('Error saving sign:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    setIsSaving(true);
    try {
      await onSave(undefined);
      onClose();
    } catch (error) {
      console.error('Error removing sign:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Check if current logo is custom (not default)
  const isCustomLogo = localSign.type === 'logo' && localSign.value !== '/theQ.png';

  // Render the preview of the sign
  const renderPreview = () => {
    if (!localSign.value) {
      return null;
    }

    const scale = localSign.scale ?? 1.0;

    if (localSign.type === 'logo') {
      return (
        <img
          src={localSign.value}
          alt="Logo"
          style={{
            width: 40 * scale,
            height: 40 * scale,
            objectFit: 'contain',
          }}
        />
      );
    }

    if (localSign.type === 'icon') {
      const IconComponent = LucideIcons[localSign.value as keyof typeof LucideIcons] as LucideIcon;
      if (IconComponent) {
        return <IconComponent size={30 * scale} color={localSign.color} strokeWidth={2.5} />;
      }
    }

    const isEmoji = localSign.type === 'emoji';
    const baseFontSize = isEmoji ? 30 : (localSign.value.length === 1 ? 32 : localSign.value.length === 2 ? 24 : 16);
    const fontSize = baseFontSize * scale;
    const fontWeight = isEmoji ? 400 : 700;

    return (
      <span
        style={{
          color: localSign.color,
          fontFamily: 'var(--font-assistant), Arial, sans-serif',
          fontSize,
          fontWeight,
          lineHeight: 1,
          display: 'block',
          marginTop: '-0.1em',
        }}
      >
        {localSign.value}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-bg-card border border-border rounded-2xl shadow-xl w-full max-w-xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <QrCode className="w-5 h-5 text-accent" />
            {t('qrSign')}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Enable toggle */}
        <div className="flex items-center justify-between p-3 bg-bg-secondary rounded-lg">
          <span className="text-sm font-medium text-text-primary">{t('qrSignEnable')}</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={localSign.enabled}
              onChange={(e) => updateSign({ enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
          </label>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setActiveTab('logo');
              if (localSign.type !== 'logo') {
                updateSign({ type: 'logo', value: '/theQ.png' });
              }
            }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'logo'
                ? 'bg-accent text-white'
                : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover'
            }`}
          >
            <Image size={16} />
            {t('qrSignLogo')}
          </button>
          <button
            onClick={() => {
              setActiveTab('icon');
              updateSign({ type: 'icon', value: '' });
            }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'icon'
                ? 'bg-accent text-white'
                : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover'
            }`}
          >
            <Grid3X3 size={16} />
            {t('qrSignIcon')}
          </button>
          <button
            onClick={() => {
              setActiveTab('text');
              updateSign({ type: 'text', value: '' });
            }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'text'
                ? 'bg-accent text-white'
                : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover'
            }`}
          >
            <Type size={16} />
            {t('qrSignText')}
          </button>
        </div>

        {/* Content based on tab */}
        {activeTab === 'logo' && (
          <div className="space-y-3">
            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                isDragging
                  ? 'border-accent bg-accent/10'
                  : 'border-border hover:border-accent/50 hover:bg-bg-secondary'
              }`}
            >
              <div className="p-3 bg-bg-secondary rounded-xl border border-border">
                <img
                  src={localSign.value}
                  alt="Logo"
                  className="w-14 h-14 object-contain"
                />
              </div>

              {logoSize && (
                <span className="text-xs text-text-secondary font-mono">
                  {logoSize.width} × {logoSize.height} px
                </span>
              )}

              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Upload size={16} />
                <span>{t('qrSignUploadLogo')}</span>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {/* Instructions */}
            <p className="text-xs text-text-secondary text-center">
              {t('qrSignLogoInstructions')}
            </p>

            {/* Reset to default button */}
            {isCustomLogo && (
              <button
                onClick={resetToDefaultLogo}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary bg-bg-secondary hover:bg-bg-hover rounded-lg transition-colors"
              >
                <Trash2 size={14} />
                {t('qrSignResetLogo')}
              </button>
            )}
          </div>
        )}
        {activeTab === 'icon' && (
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">{t('qrSignSelectIcon')}</label>
            <div className="grid grid-cols-7 gap-2 max-h-[160px] overflow-y-auto p-1">
              {ICON_NAMES.map(name => {
                const IconComponent = LucideIcons[name as keyof typeof LucideIcons] as LucideIcon;
                return (
                  <button
                    key={name}
                    onClick={() => updateSign({ type: 'icon', value: name })}
                    title={ICON_LABELS[name] || name}
                    className={`p-2.5 rounded-lg transition-colors flex items-center justify-center ${
                      localSign.value === name && localSign.type === 'icon'
                        ? 'bg-accent/20 ring-2 ring-accent'
                        : 'bg-bg-secondary hover:bg-bg-hover'
                    }`}
                  >
                    {IconComponent && <IconComponent size={20} className="text-text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {activeTab === 'text' && (
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">{t('qrSignTextLabel')}</label>
            <input
              type="text"
              value={localSign.type === 'text' || localSign.type === 'emoji' ? localSign.value : ''}
              onChange={(e) => {
                const val = e.target.value.slice(0, 4);
                const hasEmoji = /\p{Emoji}/u.test(val);
                updateSign({
                  type: hasEmoji ? 'emoji' : 'text',
                  value: val,
                });
              }}
              placeholder="A, QR, 🎁..."
              className="w-full px-4 py-3 text-lg font-semibold text-center border border-border rounded-lg
                         bg-bg-secondary text-text-primary placeholder-text-secondary
                         focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              style={{ fontFamily: 'var(--font-assistant), Arial, sans-serif' }}
              dir="auto"
              autoFocus
            />
          </div>
        )}

        {/* Preview */}
        <div className="flex flex-col items-center gap-2 py-4">
          <div
            className="rounded-full border border-border shadow-md overflow-hidden"
            style={{
              width: 70,
              height: 70,
              backgroundColor: localSign.backgroundColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {renderPreview()}
          </div>
          <span className="text-xs text-text-secondary">{t('qrSignPreview')}</span>
        </div>

        {/* Size and Colors - horizontal layout */}
        <div className="grid grid-cols-3 gap-4">
          {/* Size slider */}
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">{t('qrSignSize')}</label>
            <div className="flex flex-col items-center gap-1">
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={localSign.scale ?? 1.0}
                onChange={(e) => updateSign({ scale: parseFloat(e.target.value) })}
                className="w-full h-2 bg-bg-secondary rounded-lg appearance-none cursor-pointer accent-accent"
              />
              <span className="text-xs text-text-secondary font-mono">
                {Math.round((localSign.scale ?? 1.0) * 100)}%
              </span>
            </div>
          </div>

          {/* Sign Color */}
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">{t('qrSignColor')}</label>
            <div className="flex flex-col items-center gap-1">
              <input
                type="color"
                value={localSign.color}
                onChange={(e) => updateSign({ color: e.target.value })}
                className="w-10 h-10 rounded-lg border border-border cursor-pointer"
              />
              <input
                type="text"
                value={localSign.color}
                onChange={(e) => updateSign({ color: e.target.value })}
                className="w-full px-2 py-1 text-xs border border-border rounded-lg bg-bg-secondary text-text-primary font-mono text-center"
                placeholder="#000000"
                dir="ltr"
              />
            </div>
          </div>

          {/* Background Color */}
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">{t('qrSignBackgroundColor')}</label>
            <div className="flex flex-col items-center gap-1">
              <input
                type="color"
                value={localSign.backgroundColor}
                onChange={(e) => updateSign({ backgroundColor: e.target.value })}
                className="w-10 h-10 rounded-lg border border-border cursor-pointer"
              />
              <input
                type="text"
                value={localSign.backgroundColor}
                onChange={(e) => updateSign({ backgroundColor: e.target.value })}
                className="w-full px-2 py-1 text-xs border border-border rounded-lg bg-bg-secondary text-text-primary font-mono text-center"
                placeholder="#ffffff"
                dir="ltr"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          {currentSign?.enabled ? (
            <button
              onClick={handleRemove}
              disabled={isSaving}
              className="btn bg-danger/10 text-danger hover:bg-danger/20 disabled:opacity-50"
            >
              {t('qrSignRemove')}
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
              disabled={isSaving || (!localSign.value && localSign.enabled)}
              className="btn bg-accent text-white hover:bg-accent-hover disabled:opacity-50 min-w-[80px]"
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
