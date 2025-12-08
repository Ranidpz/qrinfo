'use client';

import { useState, useEffect } from 'react';
import { X, Route, Trophy, Target, Sparkles } from 'lucide-react';
import { Folder, RouteConfig } from '@/types';
import { updateFolderRouteConfig } from '@/lib/db';

interface RouteSettingsModalProps {
  folder: Folder;
  isOpen: boolean;
  onClose: () => void;
  onSave: (routeConfig: RouteConfig) => void;
  locale?: 'he' | 'en';
}

const translations = {
  he: {
    title: 'הגדרות מסלול',
    enableRoute: 'הפעל מסלול XP',
    enableRouteDesc: 'כשמופעל, מבקרים יכולים לצבור נקודות XP בסריקת קודים והעלאת תמונות',
    routeTitle: 'שם המסלול',
    routeTitlePlaceholder: 'למשל: המירוץ למלון',
    bonusXP: 'בונוס השלמה',
    bonusXPDesc: 'נקודות XP עבור השלמת כל התחנות',
    bonusThreshold: 'סף להשלמה',
    bonusThresholdDesc: 'כמה תחנות צריך לבקר לקבלת הבונוס (0 = כולן)',
    allStations: 'כל התחנות',
    save: 'שמור',
    cancel: 'ביטול',
    routeActive: 'המסלול פעיל',
    routeInactive: 'המסלול לא פעיל',
  },
  en: {
    title: 'Route Settings',
    enableRoute: 'Enable XP Route',
    enableRouteDesc: 'When enabled, visitors can earn XP by scanning codes and uploading photos',
    routeTitle: 'Route Name',
    routeTitlePlaceholder: 'e.g., Hotel Race',
    bonusXP: 'Completion Bonus',
    bonusXPDesc: 'XP points for completing all stations',
    bonusThreshold: 'Completion Threshold',
    bonusThresholdDesc: 'How many stations to visit for bonus (0 = all)',
    allStations: 'All stations',
    save: 'Save',
    cancel: 'Cancel',
    routeActive: 'Route is active',
    routeInactive: 'Route is not active',
  },
};

export default function RouteSettingsModal({
  folder,
  isOpen,
  onClose,
  onSave,
  locale = 'he',
}: RouteSettingsModalProps) {
  const t = translations[locale];
  const isRTL = locale === 'he';

  const [isRoute, setIsRoute] = useState(folder.routeConfig?.isRoute || false);
  const [routeTitle, setRouteTitle] = useState(folder.routeConfig?.routeTitle || folder.name);
  const [bonusXP, setBonusXP] = useState(folder.routeConfig?.bonusXP || 50);
  const [bonusThreshold, setBonusThreshold] = useState(folder.routeConfig?.bonusThreshold || 0);
  const [saving, setSaving] = useState(false);

  // Reset form when folder changes
  useEffect(() => {
    setIsRoute(folder.routeConfig?.isRoute || false);
    setRouteTitle(folder.routeConfig?.routeTitle || folder.name);
    setBonusXP(folder.routeConfig?.bonusXP || 50);
    setBonusThreshold(folder.routeConfig?.bonusThreshold || 0);
  }, [folder]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const config: RouteConfig = {
        isRoute,
        routeTitle: routeTitle || folder.name,
        bonusXP,
        bonusThreshold,
      };

      await updateFolderRouteConfig(folder.id, config);
      onSave(config);
      onClose();
    } catch (error) {
      console.error('Error saving route settings:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`
          relative w-full max-w-md bg-bg-card border border-border rounded-xl shadow-xl
          p-6 space-y-5
          ${isRTL ? 'text-right' : 'text-left'}
        `}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className={`
            absolute top-4 ${isRTL ? 'left-4' : 'right-4'}
            p-2 rounded-full hover:bg-bg-secondary transition-colors
          `}
          aria-label="Close"
        >
          <X className="w-5 h-5 text-text-secondary" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent/10">
            <Route className="w-5 h-5 text-accent" />
          </div>
          <h2 className="text-xl font-bold text-text-primary">
            {t.title}
          </h2>
        </div>

        {/* Enable Route Toggle */}
        <div className="p-4 rounded-xl bg-bg-secondary space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className={`w-5 h-5 ${isRoute ? 'text-accent' : 'text-text-secondary'}`} />
              <span className="font-medium text-text-primary">{t.enableRoute}</span>
            </div>
            <button
              onClick={() => setIsRoute(!isRoute)}
              className={`
                relative w-12 h-6 rounded-full transition-colors
                ${isRoute ? 'bg-accent' : 'bg-bg-tertiary'}
              `}
            >
              <div
                className={`
                  absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200
                  ${isRoute ? (isRTL ? 'left-1' : 'right-1') : (isRTL ? 'right-1' : 'left-1')}
                `}
              />
            </button>
          </div>
          <p className="text-sm text-text-secondary">
            {t.enableRouteDesc}
          </p>
          <div className={`
            text-xs font-medium px-2 py-1 rounded-full w-fit
            ${isRoute ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}
          `}>
            {isRoute ? t.routeActive : t.routeInactive}
          </div>
        </div>

        {/* Route Settings (only show when enabled) */}
        {isRoute && (
          <div className="space-y-4 animate-fadeIn">
            {/* Route Title */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-primary">
                {t.routeTitle}
              </label>
              <input
                type="text"
                value={routeTitle}
                onChange={(e) => setRouteTitle(e.target.value)}
                placeholder={t.routeTitlePlaceholder}
                className={`
                  w-full px-4 py-2.5 rounded-lg border border-border bg-bg-secondary
                  focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent
                  text-text-primary placeholder-text-secondary
                  ${isRTL ? 'text-right' : 'text-left'}
                `}
              />
            </div>

            {/* Bonus XP */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <label className="text-sm font-medium text-text-primary">
                  {t.bonusXP}
                </label>
              </div>
              <p className="text-xs text-text-secondary">{t.bonusXPDesc}</p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="200"
                  step="10"
                  value={bonusXP}
                  onChange={(e) => setBonusXP(Number(e.target.value))}
                  className="flex-1 h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer accent-accent"
                />
                <span className="w-16 text-center font-bold text-accent">
                  {bonusXP} XP
                </span>
              </div>
            </div>

            {/* Bonus Threshold */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-500" />
                <label className="text-sm font-medium text-text-primary">
                  {t.bonusThreshold}
                </label>
              </div>
              <p className="text-xs text-text-secondary">{t.bonusThresholdDesc}</p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  value={bonusThreshold}
                  onChange={(e) => setBonusThreshold(Number(e.target.value))}
                  className="flex-1 h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer accent-accent"
                />
                <span className="w-16 text-center font-medium text-text-primary">
                  {bonusThreshold === 0 ? t.allStations : bonusThreshold}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border text-text-secondary hover:bg-bg-secondary transition-colors"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {saving ? '...' : t.save}
          </button>
        </div>

        {/* Animation styles */}
        <style jsx>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeIn {
            animation: fadeIn 0.2s ease-out;
          }
        `}</style>
      </div>
    </div>
  );
}
