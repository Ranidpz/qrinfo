'use client';

import { useState, useEffect } from 'react';
import { X, QrCode, Type, Grid3X3 } from 'lucide-react';
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
  type: 'text',
  value: '',
  color: '#000000',
  backgroundColor: '#ffffff',
  scale: 1.0,
};

export default function QRSignModal({
  isOpen,
  onClose,
  onSave,
  currentSign,
}: QRSignModalProps) {
  const [localSign, setLocalSign] = useState<QRSign>(currentSign || DEFAULT_SIGN);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'text' | 'icon'>('text');

  const t = useTranslations('modals');
  const tCommon = useTranslations('common');

  useEffect(() => {
    if (isOpen) {
      setLocalSign(currentSign || DEFAULT_SIGN);
      if (currentSign?.type === 'icon') {
        setActiveTab('icon');
      } else {
        setActiveTab('text');
      }
    }
  }, [isOpen, currentSign]);

  if (!isOpen) return null;

  const updateSign = (updates: Partial<QRSign>) => {
    setLocalSign(prev => ({ ...prev, ...updates }));
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

  // Render the preview of the sign
  const renderPreview = () => {
    if (!localSign.value) {
      return null;
    }

    const scale = localSign.scale ?? 1.0;

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
          marginTop: '-0.1em', // Fine-tune vertical centering for font baseline
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
      <div className="relative bg-bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5 max-h-[90vh] overflow-y-auto">
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
        </div>

        {/* Content based on tab */}
        {activeTab === 'text' ? (
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
        ) : (
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">{t('qrSignSelectIcon')}</label>
            <div className="grid grid-cols-6 gap-2 max-h-[200px] overflow-y-auto p-1">
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

        {/* Size slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-text-secondary">{t('qrSignSize')}</label>
            <span className="text-xs text-text-secondary font-mono">
              {Math.round((localSign.scale ?? 1.0) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.05"
            value={localSign.scale ?? 1.0}
            onChange={(e) => updateSign({ scale: parseFloat(e.target.value) })}
            className="w-full h-2 bg-bg-secondary rounded-lg appearance-none cursor-pointer accent-accent"
          />
          <div className="flex justify-between text-xs text-text-secondary">
            <span>{t('qrSignSmall')}</span>
            <span>{t('qrSignLarge')}</span>
          </div>
        </div>

        {/* Color pickers */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">{t('qrSignColor')}</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={localSign.color}
                onChange={(e) => updateSign({ color: e.target.value })}
                className="w-12 h-12 rounded-lg border border-border cursor-pointer"
              />
              <input
                type="text"
                value={localSign.color}
                onChange={(e) => updateSign({ color: e.target.value })}
                className="flex-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-bg-secondary text-text-primary font-mono"
                placeholder="#000000"
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-text-secondary">{t('qrSignBackgroundColor')}</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={localSign.backgroundColor}
                onChange={(e) => updateSign({ backgroundColor: e.target.value })}
                className="w-12 h-12 rounded-lg border border-border cursor-pointer"
              />
              <input
                type="text"
                value={localSign.backgroundColor}
                onChange={(e) => updateSign({ backgroundColor: e.target.value })}
                className="flex-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-bg-secondary text-text-primary font-mono"
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
