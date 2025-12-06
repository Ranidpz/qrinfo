'use client';

import { useState, useEffect } from 'react';
import { QRSign, QRSignType } from '@/types';
import { ICON_NAMES, ICON_LABELS, EMOJI_OPTIONS } from '@/lib/iconPaths';
import * as LucideIcons from 'lucide-react';
import { LucideIcon } from 'lucide-react';

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

  useEffect(() => {
    setLocalSign(sign || DEFAULT_SIGN);
    setHasChanges(false);
  }, [sign]);

  const updateSign = (updates: Partial<QRSign>) => {
    setLocalSign(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(localSign.enabled && localSign.value ? localSign : undefined);
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

  const tabs: { type: QRSignType; label: string }[] = [
    { type: 'text', label: 'טקסט' },
    { type: 'emoji', label: 'אימוג׳י' },
    { type: 'icon', label: 'אייקון' },
  ];

  // Render the preview of the sign
  const renderPreview = () => {
    if (!localSign.value) {
      return <span className="text-gray-400 text-sm">תצוגה מקדימה</span>;
    }

    if (localSign.type === 'icon') {
      const IconComponent = LucideIcons[localSign.value as keyof typeof LucideIcons] as LucideIcon;
      if (IconComponent) {
        return <IconComponent size={28} color={localSign.color} strokeWidth={2.5} />;
      }
    }

    return (
      <span
        style={{
          color: localSign.color,
          fontFamily: 'var(--font-assistant), Arial, sans-serif',
          fontSize: localSign.type === 'emoji' ? '28px' : '20px',
          fontWeight: 600,
        }}
      >
        {localSign.value}
      </span>
    );
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">✏️</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">סימן QR</span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={localSign.enabled}
            onChange={(e) => updateSign({ enabled: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">הפעל</span>
        </label>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
        {tabs.map(tab => (
          <button
            key={tab.type}
            onClick={() => updateSign({ type: tab.type, value: '' })}
            className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
              localSign.type === tab.type
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Input based on type */}
      <div className="min-h-[80px]">
        {localSign.type === 'text' && (
          <div className="space-y-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">
              טקסט (עד 4 תווים)
            </label>
            <input
              type="text"
              value={localSign.value}
              onChange={(e) => updateSign({ value: e.target.value.slice(0, 4) })}
              placeholder="A, QR, שם..."
              className="w-full px-3 py-2 text-lg font-semibold text-center border rounded-lg
                         dark:bg-gray-700 dark:border-gray-600 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              style={{ fontFamily: 'var(--font-assistant), Arial, sans-serif' }}
              dir="auto"
            />
          </div>
        )}

        {localSign.type === 'emoji' && (
          <div className="space-y-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">
              בחר אימוג׳י
            </label>
            <div className="grid grid-cols-8 gap-1.5">
              {EMOJI_OPTIONS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => updateSign({ value: emoji })}
                  className={`p-2 text-xl rounded-lg transition-colors ${
                    localSign.value === emoji
                      ? 'bg-blue-100 dark:bg-blue-900/50 ring-2 ring-blue-500'
                      : 'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {localSign.type === 'icon' && (
          <div className="space-y-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">
              בחר אייקון
            </label>
            <div className="grid grid-cols-5 gap-1.5 max-h-[160px] overflow-y-auto">
              {ICON_NAMES.map(name => {
                const IconComponent = LucideIcons[name as keyof typeof LucideIcons] as LucideIcon;
                return (
                  <button
                    key={name}
                    onClick={() => updateSign({ value: name })}
                    title={ICON_LABELS[name] || name}
                    className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
                      localSign.value === name
                        ? 'bg-blue-100 dark:bg-blue-900/50 ring-2 ring-blue-500'
                        : 'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    {IconComponent && <IconComponent size={20} className="text-gray-700 dark:text-gray-300" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="flex items-center justify-center">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-md border-2 border-gray-200 dark:border-gray-600"
          style={{ backgroundColor: localSign.backgroundColor }}
        >
          {renderPreview()}
        </div>
      </div>

      {/* Color pickers */}
      <div className="grid grid-cols-2 gap-4">
        {/* Sign color */}
        <div className="space-y-1.5">
          <label className="text-sm text-gray-600 dark:text-gray-400">צבע סימן</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={localSign.color}
              onChange={(e) => updateSign({ color: e.target.value })}
              className="w-10 h-10 rounded-lg border-2 border-gray-300 dark:border-gray-600 cursor-pointer"
            />
            <input
              type="text"
              value={localSign.color}
              onChange={(e) => updateSign({ color: e.target.value })}
              className="flex-1 px-2 py-1 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono"
              placeholder="#000000"
            />
          </div>
        </div>

        {/* Background color */}
        <div className="space-y-1.5">
          <label className="text-sm text-gray-600 dark:text-gray-400">צבע רקע</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={localSign.backgroundColor}
              onChange={(e) => updateSign({ backgroundColor: e.target.value })}
              className="w-10 h-10 rounded-lg border-2 border-gray-300 dark:border-gray-600 cursor-pointer"
            />
            <input
              type="text"
              value={localSign.backgroundColor}
              onChange={(e) => updateSign({ backgroundColor: e.target.value })}
              className="flex-1 px-2 py-1 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono"
              placeholder="#ffffff"
            />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
            hasChanges && !isSaving
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
          }`}
        >
          {isSaving ? 'שומר...' : 'שמור'}
        </button>
        {sign?.enabled && (
          <button
            onClick={handleClear}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg font-medium text-red-600 dark:text-red-400
                       bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40
                       transition-colors"
          >
            הסר
          </button>
        )}
      </div>
    </div>
  );
}
