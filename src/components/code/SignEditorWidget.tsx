'use client';

import { useState, useEffect } from 'react';
import { QRSign, QRSignType } from '@/types';
import { ICON_NAMES, ICON_LABELS } from '@/lib/iconPaths';
import * as LucideIcons from 'lucide-react';
import { LucideIcon, Type, Grid3X3 } from 'lucide-react';

interface SignEditorWidgetProps {
  sign?: QRSign;
  onSave: (sign: QRSign | undefined) => Promise<void>;
}

const DEFAULT_SIGN: QRSign = {
  enabled: false,
  type: 'text',
  value: '',
  color: '#000000',
  backgroundColor: '#ffffff',
};

export default function SignEditorWidget({ sign, onSave }: SignEditorWidgetProps) {
  const [localSign, setLocalSign] = useState<QRSign>(sign || DEFAULT_SIGN);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'text' | 'icon'>('text');

  useEffect(() => {
    setLocalSign(sign || DEFAULT_SIGN);
    setHasChanges(false);
    // Set active tab based on sign type
    if (sign?.type === 'icon') {
      setActiveTab('icon');
    } else {
      setActiveTab('text');
    }
  }, [sign]);

  const updateSign = (updates: Partial<QRSign>) => {
    setLocalSign(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save the sign if it has a value, preserving enabled state
      if (localSign.value) {
        await onSave(localSign);
      } else {
        await onSave(undefined);
      }
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving sign:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsSaving(true);
    try {
      await onSave(undefined);
      setLocalSign(DEFAULT_SIGN);
      setHasChanges(false);
    } catch (error) {
      console.error('Error clearing sign:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Render the preview of the sign - matches QR overlay styling
  const renderPreview = () => {
    if (!localSign.value) {
      return <span className="text-gray-400 text-xs">תצוגה מקדימה</span>;
    }

    if (localSign.type === 'logo') {
      return (
        <img
          src={localSign.value}
          alt="Logo"
          style={{
            width: 35,
            height: 35,
            objectFit: 'contain',
          }}
        />
      );
    }

    if (localSign.type === 'icon') {
      const IconComponent = LucideIcons[localSign.value as keyof typeof LucideIcons] as LucideIcon;
      if (IconComponent) {
        return <IconComponent size={30} color={localSign.color} strokeWidth={2.5} />;
      }
    }

    // Match the QR overlay text styling exactly
    const isEmoji = localSign.type === 'emoji';
    const fontSize = isEmoji ? 30 : (localSign.value.length <= 2 ? 24 : 16);
    const fontWeight = isEmoji ? 400 : 700;

    return (
      <span
        style={{
          color: localSign.color,
          fontFamily: 'var(--font-assistant), Arial, sans-serif',
          fontSize,
          fontWeight,
          lineHeight: 1,
        }}
      >
        {localSign.value}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with enable toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">סימן QR</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm text-text-secondary">הפעל</span>
          <input
            type="checkbox"
            checked={localSign.enabled}
            onChange={(e) => updateSign({ enabled: e.target.checked })}
            className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
          />
        </label>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setActiveTab('text');
            updateSign({ type: 'text', value: '' });
          }}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
            activeTab === 'text'
              ? 'bg-accent text-white'
              : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover'
          }`}
        >
          <Type size={16} />
          טקסט
        </button>
        <button
          onClick={() => {
            setActiveTab('icon');
            updateSign({ type: 'icon', value: '' });
          }}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
            activeTab === 'icon'
              ? 'bg-accent text-white'
              : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover'
          }`}
        >
          <Grid3X3 size={16} />
          אייקון
        </button>
      </div>

      {/* Content based on tab */}
      {activeTab === 'text' ? (
        <div className="space-y-2">
          <label className="text-sm text-text-secondary">טקסט (עד 4 תווים)</label>
          <input
            type="text"
            value={localSign.type === 'text' || localSign.type === 'emoji' ? localSign.value : ''}
            onChange={(e) => {
              const val = e.target.value.slice(0, 4);
              // Check if it contains emoji
              const hasEmoji = /\p{Emoji}/u.test(val);
              updateSign({
                type: hasEmoji ? 'emoji' : 'text',
                value: val,
                enabled: val.length > 0 ? true : localSign.enabled, // Auto-enable when typing
              });
            }}
            placeholder="A, QR, 🎁..."
            className="w-full px-4 py-3 text-lg font-semibold text-center border border-border rounded-lg
                       bg-bg-secondary text-text-primary placeholder-text-secondary
                       focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            style={{ fontFamily: 'var(--font-assistant), Arial, sans-serif' }}
            dir="auto"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-sm text-text-secondary">בחרו אייקון</label>
          <div className="grid grid-cols-5 gap-2 max-h-[140px] overflow-y-auto p-1">
            {ICON_NAMES.map(name => {
              const IconComponent = LucideIcons[name as keyof typeof LucideIcons] as LucideIcon;
              return (
                <button
                  key={name}
                  onClick={() => updateSign({ type: 'icon', value: name, enabled: true })}
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

      {/* Preview - matches QR overlay size (55px) */}
      <div className="flex items-center justify-center py-2">
        <div
          className="rounded-full flex items-center justify-center border border-border shadow-md"
          style={{
            width: 55,
            height: 55,
            backgroundColor: localSign.backgroundColor
          }}
        >
          {renderPreview()}
        </div>
      </div>

      {/* Color pickers - stacked */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-sm text-text-secondary">צבע סימן</label>
          <div className="flex items-center gap-3">
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
              className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-bg-secondary text-text-primary font-mono"
              placeholder="#000000"
              dir="ltr"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm text-text-secondary">צבע רקע</label>
          <div className="flex items-center gap-3">
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
              className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-bg-secondary text-text-primary font-mono"
              placeholder="#ffffff"
              dir="ltr"
            />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className={`flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
            hasChanges && !isSaving
              ? 'bg-accent text-white hover:bg-accent-hover'
              : 'bg-bg-secondary text-text-secondary cursor-not-allowed'
          }`}
        >
          {isSaving ? 'שומר...' : 'שמור'}
        </button>
        {sign?.enabled && (
          <button
            onClick={handleClear}
            disabled={isSaving}
            className="px-4 py-2.5 rounded-lg font-medium text-sm text-danger
                       bg-danger/10 hover:bg-danger/20 transition-colors"
          >
            הסר
          </button>
        )}
      </div>
    </div>
  );
}
