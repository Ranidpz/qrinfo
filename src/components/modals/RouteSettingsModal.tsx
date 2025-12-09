'use client';

import { useState, useEffect } from 'react';
import { X, Route, Trophy, Target, Sparkles, Gift, Monitor, ChevronRight, HelpCircle } from 'lucide-react';
import { Folder, RouteConfig, Prize } from '@/types';
import { updateFolderRouteConfig, getRoutePrizes } from '@/lib/db';
import PrizeManagementModal from './PrizeManagementModal';
import PrizeSystemGuideModal from './PrizeSystemGuideModal';

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
    // Prize system
    prizesSection: 'מערכת פרסים',
    enablePrizes: 'הפעל מערכת פרסים',
    enablePrizesDesc: 'כשמופעל, מבקרים מקבלים חבילות עם פרסים בעליית רמה והשלמת מסלול',
    lobbyDisplay: 'הצגה על מסך לובי',
    lobbyDisplayDesc: 'הצג זכיות אפיות ואגדיות על מסך גדול בלובי',
    managePrizes: 'נהל פרסים',
    prizesCount: '{count} פרסים',
    noPrizes: 'אין פרסים',
    viewLobby: 'צפה במסך לובי',
    prizeGuide: 'מדריך מערכת הפרסים',
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
    // Prize system
    prizesSection: 'Prize System',
    enablePrizes: 'Enable Prize System',
    enablePrizesDesc: 'When enabled, visitors receive packs with prizes on level up and route completion',
    lobbyDisplay: 'Lobby Display',
    lobbyDisplayDesc: 'Show epic and legendary wins on big screen in lobby',
    managePrizes: 'Manage Prizes',
    prizesCount: '{count} prizes',
    noPrizes: 'No prizes',
    viewLobby: 'View Lobby Screen',
    prizeGuide: 'Prize System Guide',
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
  const [prizesEnabled, setPrizesEnabled] = useState(folder.routeConfig?.prizesEnabled || false);
  const [lobbyDisplayEnabled, setLobbyDisplayEnabled] = useState(folder.routeConfig?.lobbyDisplayEnabled || false);
  const [saving, setSaving] = useState(false);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Reset form when folder changes
  useEffect(() => {
    setIsRoute(folder.routeConfig?.isRoute || false);
    setRouteTitle(folder.routeConfig?.routeTitle || folder.name);
    setBonusXP(folder.routeConfig?.bonusXP || 50);
    setBonusThreshold(folder.routeConfig?.bonusThreshold || 0);
    setPrizesEnabled(folder.routeConfig?.prizesEnabled || false);
    setLobbyDisplayEnabled(folder.routeConfig?.lobbyDisplayEnabled || false);
  }, [folder]);

  // Load prizes when modal opens
  useEffect(() => {
    if (isOpen && folder.id) {
      getRoutePrizes(folder.id).then(setPrizes).catch(console.error);
    }
  }, [isOpen, folder.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const config: RouteConfig = {
        isRoute,
        routeTitle: routeTitle || folder.name,
        bonusXP,
        bonusThreshold,
        prizesEnabled,
        lobbyDisplayEnabled,
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

  const handlePrizesUpdated = () => {
    // Refresh prizes list
    getRoutePrizes(folder.id).then(setPrizes).catch(console.error);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className={`
          relative w-full max-w-md bg-bg-card border border-border rounded-xl shadow-xl
          p-6 space-y-5
          ${isRTL ? 'text-right' : 'text-left'}
        `}
        dir={isRTL ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
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
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsRoute(!isRoute);
              }}
              className={`
                relative w-12 h-6 rounded-full transition-colors cursor-pointer
                ${isRoute ? 'bg-accent' : 'bg-bg-tertiary'}
              `}
            >
              <div
                className={`
                  absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 pointer-events-none
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
                  className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to ${isRTL ? 'left' : 'right'}, #3b82f6 0%, #3b82f6 ${(bonusXP / 200) * 100}%, #374151 ${(bonusXP / 200) * 100}%, #374151 100%)`
                  }}
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
                  className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to ${isRTL ? 'left' : 'right'}, #3b82f6 0%, #3b82f6 ${(bonusThreshold / 20) * 100}%, #374151 ${(bonusThreshold / 20) * 100}%, #374151 100%)`
                  }}
                />
                <span className="w-16 text-center font-medium text-text-primary">
                  {bonusThreshold === 0 ? t.allStations : bonusThreshold}
                </span>
              </div>
            </div>

            {/* Prize System Section */}
            <div className="pt-4 border-t border-border space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-purple-500" />
                  <h3 className="font-medium text-text-primary">{t.prizesSection}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuideModal(true)}
                  className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>{t.prizeGuide}</span>
                </button>
              </div>

              {/* Enable Prizes Toggle */}
              <div className="p-3 rounded-lg bg-bg-tertiary space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-primary">{t.enablePrizes}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPrizesEnabled(!prizesEnabled);
                    }}
                    className={`
                      relative w-10 h-5 rounded-full transition-colors cursor-pointer
                      ${prizesEnabled ? 'bg-purple-500' : 'bg-bg-secondary'}
                    `}
                  >
                    <div
                      className={`
                        absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 pointer-events-none
                        ${prizesEnabled ? (isRTL ? 'left-0.5' : 'right-0.5') : (isRTL ? 'right-0.5' : 'left-0.5')}
                      `}
                    />
                  </button>
                </div>
                <p className="text-xs text-text-secondary">{t.enablePrizesDesc}</p>
              </div>

              {/* Lobby Display Toggle (only show when prizes enabled) */}
              {prizesEnabled && (
                <div className="p-3 rounded-lg bg-bg-tertiary space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-text-secondary" />
                      <span className="text-sm text-text-primary">{t.lobbyDisplay}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setLobbyDisplayEnabled(!lobbyDisplayEnabled);
                      }}
                      className={`
                        relative w-10 h-5 rounded-full transition-colors cursor-pointer
                        ${lobbyDisplayEnabled ? 'bg-purple-500' : 'bg-bg-secondary'}
                      `}
                    >
                      <div
                        className={`
                          absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 pointer-events-none
                          ${lobbyDisplayEnabled ? (isRTL ? 'left-0.5' : 'right-0.5') : (isRTL ? 'right-0.5' : 'left-0.5')}
                        `}
                      />
                    </button>
                  </div>
                  <p className="text-xs text-text-secondary">{t.lobbyDisplayDesc}</p>
                  {lobbyDisplayEnabled && (
                    <a
                      href={`/lobby/${folder.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
                    >
                      {t.viewLobby}
                      <ChevronRight className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}

              {/* Manage Prizes Button */}
              {prizesEnabled && (
                <button
                  type="button"
                  onClick={() => setShowPrizeModal(true)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Gift className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-medium text-purple-300">{t.managePrizes}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-purple-400">
                      {prizes.length > 0
                        ? t.prizesCount.replace('{count}', String(prizes.length))
                        : t.noPrizes}
                    </span>
                    <ChevronRight className="w-4 h-4 text-purple-400" />
                  </div>
                </button>
              )}
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

      {/* Prize Management Modal */}
      {showPrizeModal && (
        <PrizeManagementModal
          routeId={folder.id}
          isOpen={showPrizeModal}
          onClose={() => setShowPrizeModal(false)}
          onUpdate={handlePrizesUpdated}
          locale={locale}
        />
      )}

      {/* Prize System Guide Modal */}
      <PrizeSystemGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        locale={locale}
      />
    </div>
  );
}
