'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  Palette,
  Map,
  Timer,
  UserPlus,
  Trophy,
  Settings,
  Eye,
  ImageIcon,
  Video,
  ChevronDown,
  QrCode,
  Copy,
  Printer,
  ExternalLink,
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import {
  QTreasureConfig,
  QTreasureStation,
  QTreasureBranding,
  QTreasureTimerConfig,
  QTreasureRegistrationConfig,
  QTreasureCompletionConfig,
  QTreasurePhase,
  DEFAULT_QTREASURE_CONFIG,
  DEFAULT_QTREASURE_EMOJI_PALETTE,
  createNewStation,
} from '@/types/qtreasure';
import MobilePreviewModal from './MobilePreviewModal';

// Helper function to remove undefined/null values from objects (Firestore doesn't accept undefined)
function cleanUndefinedValues<T extends object>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) {
      continue; // Skip undefined/null values
    }
    if (Array.isArray(value)) {
      result[key] = value.map(item =>
        typeof item === 'object' && item !== null ? cleanUndefinedValues(item) : item
      );
    } else if (typeof value === 'object' && value !== null) {
      result[key] = cleanUndefinedValues(value as object);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

interface QTreasureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: QTreasureConfig) => Promise<void>;
  loading?: boolean;
  initialConfig?: QTreasureConfig;
  shortId?: string;
  existingStationQRs?: { shortId: string; title: string }[];
  // Required for auto-creating station QR codes
  ownerId?: string;
  folderId?: string | null;
}

// Preset colors for Q.Treasure (forest/gold theme)
const presetColors = {
  background: ['#0d1f17', '#0a1810', '#1a2e23', '#0f172a', '#1e293b', '#16213e'],
  primary: ['#d4af37', '#00d4ff', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6'],
  accent: ['#f5d670', '#ff00aa', '#ef4444', '#fbbf24', '#ec4899', '#14b8a6'],
  success: ['#00ff88', '#22c55e', '#4ade80', '#10b981'],
  warning: ['#ffaa00', '#f59e0b', '#fbbf24', '#facc15'],
};

export default function QTreasureModal({
  isOpen,
  onClose,
  onSave,
  loading = false,
  initialConfig,
  shortId,
  existingStationQRs = [],
  ownerId,
  folderId,
}: QTreasureModalProps) {
  const t = useTranslations('modals');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const isRTL = locale === 'he';

  // Tab state
  const [activeTab, setActiveTab] = useState<'branding' | 'stations' | 'timer' | 'registration' | 'completion' | 'advanced'>('branding');

  // Preview modal
  const [showPreview, setShowPreview] = useState(false);

  // Current phase
  const [currentPhase, setCurrentPhase] = useState<QTreasurePhase>('registration');

  // Branding state
  const [branding, setBranding] = useState<QTreasureBranding>(DEFAULT_QTREASURE_CONFIG.branding);
  const [gameTitle, setGameTitle] = useState('');
  const [gameTitleEn, setGameTitleEn] = useState('');

  // Stations state
  const [stations, setStations] = useState<QTreasureStation[]>([]);
  const [expandedStation, setExpandedStation] = useState<string | null>(null);

  // Timer state
  const [timerConfig, setTimerConfig] = useState<QTreasureTimerConfig>(DEFAULT_QTREASURE_CONFIG.timer);

  // Registration state
  const [registrationConfig, setRegistrationConfig] = useState<QTreasureRegistrationConfig>(DEFAULT_QTREASURE_CONFIG.registration);

  // Completion state
  const [completionConfig, setCompletionConfig] = useState<QTreasureCompletionConfig>(DEFAULT_QTREASURE_CONFIG.completion);
  const [customMessage, setCustomMessage] = useState('');
  const [customMessageEn, setCustomMessageEn] = useState('');

  // XP state
  const [xpPerStation, setXpPerStation] = useState(DEFAULT_QTREASURE_CONFIG.xpPerStation);
  const [completionBonusXP, setCompletionBonusXP] = useState(DEFAULT_QTREASURE_CONFIG.completionBonusXP);

  // Out-of-order state
  const [allowOutOfOrder, setAllowOutOfOrder] = useState(DEFAULT_QTREASURE_CONFIG.allowOutOfOrder);
  const [outOfOrderWarning, setOutOfOrderWarning] = useState(DEFAULT_QTREASURE_CONFIG.outOfOrderWarning);
  const [outOfOrderWarningEn, setOutOfOrderWarningEn] = useState(DEFAULT_QTREASURE_CONFIG.outOfOrderWarningEn);

  // Language
  const [language, setLanguage] = useState<'he' | 'en' | 'auto'>(DEFAULT_QTREASURE_CONFIG.language);

  // Drag state for stations
  const [draggedStation, setDraggedStation] = useState<string | null>(null);

  // Station QR creation state
  const [creatingQRForStation, setCreatingQRForStation] = useState<string | null>(null);

  // Create QR code for a station
  const createStationQR = async (stationId: string) => {
    if (!ownerId || !shortId) {
      alert(isRTL ? 'יש לשמור את הקוד הראשי קודם' : 'Please save the main code first');
      return;
    }

    const station = stations.find(s => s.id === stationId);
    if (!station) return;

    setCreatingQRForStation(stationId);
    try {
      const response = await fetch('/api/qtreasure/create-station-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId,
          stationTitle: station.title || `תחנה ${station.order}`,
          stationOrder: station.order,
          parentCodeShortId: shortId,
          folderId: folderId || undefined,
        }),
      });

      const result = await response.json();
      if (result.success) {
        // Update station with the new shortId
        updateStation(stationId, { stationShortId: result.shortId });
      } else {
        alert(isRTL ? `שגיאה ביצירת QR: ${result.error}` : `Error creating QR: ${result.error}`);
      }
    } catch (error) {
      console.error('Error creating station QR:', error);
      alert(isRTL ? 'שגיאה ביצירת QR לתחנה' : 'Error creating station QR');
    } finally {
      setCreatingQRForStation(null);
    }
  };

  // Load initial config
  useEffect(() => {
    if (initialConfig) {
      setCurrentPhase(initialConfig.currentPhase);
      setBranding(initialConfig.branding);
      setGameTitle(initialConfig.branding.gameTitle || '');
      setGameTitleEn(initialConfig.branding.gameTitleEn || '');
      setStations(initialConfig.stations);
      setTimerConfig(initialConfig.timer);
      setRegistrationConfig(initialConfig.registration);
      setCompletionConfig(initialConfig.completion);
      setCustomMessage(initialConfig.completion.customMessage || '');
      setCustomMessageEn(initialConfig.completion.customMessageEn || '');
      setXpPerStation(initialConfig.xpPerStation);
      setCompletionBonusXP(initialConfig.completionBonusXP);
      setAllowOutOfOrder(initialConfig.allowOutOfOrder);
      setOutOfOrderWarning(initialConfig.outOfOrderWarning);
      setOutOfOrderWarningEn(initialConfig.outOfOrderWarningEn);
      setLanguage(initialConfig.language);
    } else {
      // Reset to defaults
      setCurrentPhase('registration');
      setBranding(DEFAULT_QTREASURE_CONFIG.branding);
      setGameTitle('');
      setGameTitleEn('');
      setStations([]);
      setTimerConfig(DEFAULT_QTREASURE_CONFIG.timer);
      setRegistrationConfig(DEFAULT_QTREASURE_CONFIG.registration);
      setCompletionConfig(DEFAULT_QTREASURE_CONFIG.completion);
      setCustomMessage('');
      setCustomMessageEn('');
      setXpPerStation(DEFAULT_QTREASURE_CONFIG.xpPerStation);
      setCompletionBonusXP(DEFAULT_QTREASURE_CONFIG.completionBonusXP);
      setAllowOutOfOrder(DEFAULT_QTREASURE_CONFIG.allowOutOfOrder);
      setOutOfOrderWarning(DEFAULT_QTREASURE_CONFIG.outOfOrderWarning);
      setOutOfOrderWarningEn(DEFAULT_QTREASURE_CONFIG.outOfOrderWarningEn);
      setLanguage(DEFAULT_QTREASURE_CONFIG.language);
    }
  }, [initialConfig, isOpen]);

  // Add new station
  const addStation = () => {
    const newOrder = stations.length + 1;
    const station = createNewStation(newOrder);
    setStations([...stations, station]);
    setExpandedStation(station.id);
  };

  // Update station
  const updateStation = (stationId: string, updates: Partial<QTreasureStation>) => {
    setStations(stations.map(s =>
      s.id === stationId ? { ...s, ...updates } : s
    ));
  };

  // Delete station
  const deleteStation = (stationId: string) => {
    const filtered = stations.filter(s => s.id !== stationId);
    // Reorder remaining stations
    const reordered = filtered.map((s, i) => ({ ...s, order: i + 1 }));
    setStations(reordered);
  };

  // Move station up/down
  const moveStation = (stationId: string, direction: 'up' | 'down') => {
    const index = stations.findIndex(s => s.id === stationId);
    if (direction === 'up' && index > 0) {
      const newStations = [...stations];
      [newStations[index - 1], newStations[index]] = [newStations[index], newStations[index - 1]];
      // Update order numbers
      const reordered = newStations.map((s, i) => ({ ...s, order: i + 1 }));
      setStations(reordered);
    } else if (direction === 'down' && index < stations.length - 1) {
      const newStations = [...stations];
      [newStations[index], newStations[index + 1]] = [newStations[index + 1], newStations[index]];
      const reordered = newStations.map((s, i) => ({ ...s, order: i + 1 }));
      setStations(reordered);
    }
  };

  // Handle save
  const handleSave = async () => {
    const config: QTreasureConfig = {
      currentPhase,
      stations,
      timer: timerConfig,
      registration: registrationConfig,
      xpPerStation,
      completionBonusXP,
      allowOutOfOrder,
      outOfOrderWarning,
      outOfOrderWarningEn,
      completion: {
        ...completionConfig,
        ...(customMessage ? { customMessage } : {}),
        ...(customMessageEn ? { customMessageEn } : {}),
      },
      branding: {
        ...branding,
        ...(gameTitle ? { gameTitle } : {}),
        ...(gameTitleEn ? { gameTitleEn } : {}),
      },
      language,
      stats: initialConfig?.stats || {
        totalPlayers: 0,
        playersPlaying: 0,
        playersCompleted: 0,
        avgCompletionTimeMs: 0,
        fastestTimeMs: 0,
        lastUpdated: Date.now(),
      },
      ...(initialConfig?.gameStartedAt ? { gameStartedAt: initialConfig.gameStartedAt } : {}),
      ...(initialConfig?.lastResetAt ? { lastResetAt: initialConfig.lastResetAt } : {}),
    };

    // Clean undefined values before saving to Firestore
    const cleanedConfig = cleanUndefinedValues(config);
    await onSave(cleanedConfig);
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'branding' as const, label: isRTL ? 'מיתוג' : 'Branding', icon: Palette },
    { id: 'stations' as const, label: isRTL ? 'תחנות' : 'Stations', icon: Map },
    { id: 'timer' as const, label: isRTL ? 'טיימר' : 'Timer', icon: Timer },
    { id: 'registration' as const, label: isRTL ? 'הרשמה' : 'Registration', icon: UserPlus },
    { id: 'completion' as const, label: isRTL ? 'סיום' : 'Completion', icon: Trophy },
    { id: 'advanced' as const, label: isRTL ? 'מתקדם' : 'Advanced', icon: Settings },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Map className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {isRTL ? 'הגדרות Q.Treasure' : 'Q.Treasure Settings'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {isRTL ? 'ציד אוצרות עם תחנות ורמזים' : 'Treasure hunt with stations and hints'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <Eye className="w-4 h-4" />
                {isRTL ? 'תצוגה מקדימה' : 'Preview'}
              </button>

              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-800 px-6 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Branding Tab */}
            {activeTab === 'branding' && (
              <div className="flex gap-6" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                {/* Phone Preview - Left Side */}
                <div className="flex-shrink-0">
                  <div className="sticky top-0">
                    {/* Phone Frame */}
                    <div
                      className="relative mx-auto"
                      style={{
                        width: '220px',
                        height: '440px',
                        borderRadius: '32px',
                        background: '#1a1a1a',
                        padding: '8px',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1)',
                      }}
                    >
                      {/* Notch */}
                      <div
                        className="absolute top-2 left-1/2 -translate-x-1/2 z-10"
                        style={{
                          width: '80px',
                          height: '24px',
                          background: '#1a1a1a',
                          borderRadius: '0 0 16px 16px',
                        }}
                      />
                      {/* Screen */}
                      <div
                        className="relative w-full h-full overflow-hidden"
                        style={{
                          borderRadius: '24px',
                          backgroundColor: branding.backgroundColor,
                          backgroundImage: branding.backgroundImage ? `url(${branding.backgroundImage})` : 'none',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                      >
                        {/* Decorative pattern overlay - Ancient/Quest style */}
                        <div
                          className="absolute inset-0 pointer-events-none opacity-10"
                          style={{
                            backgroundImage: `
                              radial-gradient(circle at 20% 80%, ${branding.primaryColor}40 0%, transparent 50%),
                              radial-gradient(circle at 80% 20%, ${branding.accentColor}30 0%, transparent 40%)
                            `,
                          }}
                        />

                        {/* Content */}
                        <div className="relative flex flex-col items-center h-full p-4 pt-10 text-center" dir={isRTL ? 'rtl' : 'ltr'}>
                          {/* Logo */}
                          {branding.eventLogo && (
                            <img
                              src={branding.eventLogo}
                              alt="Logo"
                              className="h-8 object-contain mb-2"
                            />
                          )}

                          {/* Game Title */}
                          <h3
                            className="text-lg font-bold mb-1"
                            style={{ color: branding.primaryColor }}
                          >
                            {gameTitle || (isRTL ? 'ציד האוצר' : 'Treasure Hunt')}
                          </h3>

                          {/* Subtitle */}
                          <p className="text-xs mb-4 opacity-80" style={{ color: '#fff' }}>
                            {isRTL ? 'הצטרפו להרפתקה' : 'Join the adventure'}
                          </p>

                          {/* Progress indicator */}
                          <div className="flex items-center gap-2 mb-4">
                            <span className="text-xs" style={{ color: branding.accentColor }}>
                              {isRTL ? `${stations.length || 5} תחנות` : `${stations.length || 5} stations`}
                            </span>
                          </div>

                          {/* Name Input Preview */}
                          <div
                            className="w-full rounded-lg py-2.5 px-3 mb-3 text-xs text-center"
                            style={{
                              background: 'rgba(255,255,255,0.1)',
                              border: `2px solid ${branding.primaryColor}40`,
                              color: '#ffffff80',
                            }}
                          >
                            {isRTL ? 'הכניסו את שמכם...' : 'Enter your name...'}
                          </div>

                          {/* Emoji Grid Preview */}
                          <div className="grid grid-cols-4 gap-1.5 mb-4 w-full">
                            {(registrationConfig.emojiPalette || DEFAULT_QTREASURE_EMOJI_PALETTE).slice(0, 8).map((emoji, i) => (
                              <div
                                key={i}
                                className="aspect-square flex items-center justify-center rounded-lg text-base"
                                style={{
                                  background: i === 0 ? `${branding.primaryColor}30` : 'rgba(255,255,255,0.08)',
                                  border: i === 0 ? `2px solid ${branding.primaryColor}` : '2px solid rgba(255,255,255,0.1)',
                                }}
                              >
                                {emoji}
                              </div>
                            ))}
                          </div>

                          {/* Start Button */}
                          <button
                            className="w-full py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
                            style={{
                              background: `linear-gradient(135deg, ${branding.successColor}, ${branding.successColor}dd)`,
                              color: '#000',
                              boxShadow: `0 4px 15px ${branding.successColor}40`,
                            }}
                          >
                            <span>🗺️</span>
                            <span>{isRTL ? 'התחילו את המסע!' : 'Start the Quest!'}</span>
                          </button>

                          {/* XP indicator */}
                          <div
                            className="flex items-center gap-1 mt-3 text-xs"
                            style={{ color: branding.warningColor }}
                          >
                            <span>✨</span>
                            <span>{isRTL ? `+${xpPerStation} XP לתחנה` : `+${xpPerStation} XP per station`}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Preview label */}
                    <p className="text-center mt-3 text-xs text-gray-500 dark:text-gray-400">
                      {isRTL ? 'תצוגה מקדימה' : 'Live Preview'}
                    </p>
                  </div>
                </div>

                {/* Controls - Right Side */}
                <div className="flex-1 space-y-5 min-w-0">
                  {/* Preset Themes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {isRTL ? 'ערכות נושא מוכנות' : 'Color Themes'}
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { name: isRTL ? 'יער' : 'Forest', bg: '#0d1f17', primary: '#d4af37', accent: '#f5d670', success: '#00ff88', warning: '#ffaa00' },
                        { name: isRTL ? 'מדבר' : 'Desert', bg: '#1a150a', primary: '#f59e0b', accent: '#fbbf24', success: '#84cc16', warning: '#ef4444' },
                        { name: isRTL ? 'אוקיינוס' : 'Ocean', bg: '#0a1a1a', primary: '#06b6d4', accent: '#22d3ee', success: '#10b981', warning: '#f59e0b' },
                        { name: isRTL ? 'לילה' : 'Night', bg: '#0f0a1a', primary: '#a855f7', accent: '#c084fc', success: '#22c55e', warning: '#fbbf24' },
                        { name: isRTL ? 'שקיעה' : 'Sunset', bg: '#1a0a0a', primary: '#ef4444', accent: '#f97316', success: '#84cc16', warning: '#fbbf24' },
                        { name: isRTL ? 'אמרלד' : 'Emerald', bg: '#0a1a0f', primary: '#10b981', accent: '#34d399', success: '#22c55e', warning: '#f59e0b' },
                        { name: isRTL ? 'רויאל' : 'Royal', bg: '#0f172a', primary: '#3b82f6', accent: '#60a5fa', success: '#22c55e', warning: '#f59e0b' },
                        { name: isRTL ? 'ורוד' : 'Rose', bg: '#1a0a14', primary: '#ec4899', accent: '#f472b6', success: '#a3e635', warning: '#fbbf24' },
                      ].map((theme) => (
                        <button
                          key={theme.name}
                          onClick={() => setBranding({
                            ...branding,
                            backgroundColor: theme.bg,
                            primaryColor: theme.primary,
                            accentColor: theme.accent,
                            successColor: theme.success,
                            warningColor: theme.warning,
                          })}
                          className="relative p-2 rounded-lg border-2 transition-all hover:scale-105"
                          style={{
                            background: theme.bg,
                            borderColor: branding.primaryColor === theme.primary ? theme.primary : 'transparent',
                          }}
                        >
                          <div className="flex gap-0.5 mb-1 justify-center">
                            <div className="w-3 h-3 rounded-full" style={{ background: theme.primary }} />
                            <div className="w-3 h-3 rounded-full" style={{ background: theme.accent }} />
                            <div className="w-3 h-3 rounded-full" style={{ background: theme.success }} />
                          </div>
                          <span className="text-xs font-medium" style={{ color: theme.primary }}>
                            {theme.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Game Title */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {isRTL ? 'שם המשחק (עברית)' : 'Game Title (Hebrew)'}
                      </label>
                      <input
                        type="text"
                        value={gameTitle}
                        onChange={(e) => setGameTitle(e.target.value)}
                        placeholder={isRTL ? 'ציד אוצרות' : 'Treasure Hunt'}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {isRTL ? 'שם המשחק (אנגלית)' : 'Game Title (English)'}
                      </label>
                      <input
                        type="text"
                        value={gameTitleEn}
                        onChange={(e) => setGameTitleEn(e.target.value)}
                        placeholder="Treasure Hunt"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Background Color */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {isRTL ? 'צבע רקע' : 'Background Color'}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={branding.backgroundColor}
                        onChange={(e) => setBranding({ ...branding, backgroundColor: e.target.value })}
                        className="w-10 h-10 rounded-lg cursor-pointer flex-shrink-0"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {presetColors.background.map(color => (
                          <button
                            key={color}
                            onClick={() => setBranding({ ...branding, backgroundColor: color })}
                            className="w-7 h-7 rounded-md border-2 transition-transform hover:scale-110"
                            style={{
                              background: color,
                              borderColor: branding.backgroundColor === color ? '#d4af37' : 'transparent',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Primary Color */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {isRTL ? 'צבע ראשי (זהב)' : 'Primary Color (Gold)'}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={branding.primaryColor}
                        onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                        className="w-10 h-10 rounded-lg cursor-pointer flex-shrink-0"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {presetColors.primary.map(color => (
                          <button
                            key={color}
                            onClick={() => setBranding({ ...branding, primaryColor: color })}
                            className="w-7 h-7 rounded-md border-2 transition-transform hover:scale-110"
                            style={{
                              background: color,
                              borderColor: branding.primaryColor === color ? '#fff' : 'transparent',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Accent Color */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {isRTL ? 'צבע משני' : 'Accent Color'}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={branding.accentColor}
                        onChange={(e) => setBranding({ ...branding, accentColor: e.target.value })}
                        className="w-10 h-10 rounded-lg cursor-pointer flex-shrink-0"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {presetColors.accent.map(color => (
                          <button
                            key={color}
                            onClick={() => setBranding({ ...branding, accentColor: color })}
                            className="w-7 h-7 rounded-md border-2 transition-transform hover:scale-110"
                            style={{
                              background: color,
                              borderColor: branding.accentColor === color ? '#fff' : 'transparent',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Success Color */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {isRTL ? 'צבע הצלחה' : 'Success Color'}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={branding.successColor}
                        onChange={(e) => setBranding({ ...branding, successColor: e.target.value })}
                        className="w-10 h-10 rounded-lg cursor-pointer flex-shrink-0"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {presetColors.success.map(color => (
                          <button
                            key={color}
                            onClick={() => setBranding({ ...branding, successColor: color })}
                            className="w-7 h-7 rounded-md border-2 transition-transform hover:scale-110"
                            style={{
                              background: color,
                              borderColor: branding.successColor === color ? '#fff' : 'transparent',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Warning Color */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {isRTL ? 'צבע אזהרה' : 'Warning Color'}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={branding.warningColor}
                        onChange={(e) => setBranding({ ...branding, warningColor: e.target.value })}
                        className="w-10 h-10 rounded-lg cursor-pointer flex-shrink-0"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {presetColors.warning.map(color => (
                          <button
                            key={color}
                            onClick={() => setBranding({ ...branding, warningColor: color })}
                            className="w-7 h-7 rounded-md border-2 transition-transform hover:scale-110"
                            style={{
                              background: color,
                              borderColor: branding.warningColor === color ? '#fff' : 'transparent',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Background Image */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {isRTL ? 'תמונת רקע (URL)' : 'Background Image (URL)'}
                    </label>
                    <input
                      type="url"
                      value={branding.backgroundImage || ''}
                      onChange={(e) => setBranding(prev => {
                        const { backgroundImage, ...rest } = prev;
                        return e.target.value ? { ...prev, backgroundImage: e.target.value } : rest;
                      })}
                      placeholder="https://..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>

                  {/* Event Logo */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {isRTL ? 'לוגו אירוע (URL)' : 'Event Logo (URL)'}
                    </label>
                    <input
                      type="url"
                      value={branding.eventLogo || ''}
                      onChange={(e) => setBranding(prev => {
                        const { eventLogo, ...rest } = prev;
                        return e.target.value ? { ...prev, eventLogo: e.target.value } : rest;
                      })}
                      placeholder="https://..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Stations Tab */}
            {activeTab === 'stations' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {isRTL ? `${stations.length} תחנות` : `${stations.length} Stations`}
                  </h3>
                  <div className="flex items-center gap-2">
                    {/* Print all QR codes button */}
                    {stations.filter(s => s.stationShortId).length > 0 && (
                      <button
                        onClick={() => {
                          const stationsWithQR = stations.filter(s => s.stationShortId);
                          const printWindow = window.open('', '_blank');
                          if (printWindow) {
                            const baseUrl = window.location.origin;
                            printWindow.document.write(`
                              <!DOCTYPE html>
                              <html dir="${isRTL ? 'rtl' : 'ltr'}">
                              <head>
                                <title>${isRTL ? 'קודי QR לתחנות' : 'Station QR Codes'}</title>
                                <style>
                                  body { font-family: Arial, sans-serif; padding: 20px; }
                                  .station { page-break-after: always; text-align: center; padding: 40px; }
                                  .station:last-child { page-break-after: avoid; }
                                  .station-title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
                                  .station-order { font-size: 48px; color: #d4af37; margin-bottom: 20px; }
                                  .qr-code { margin: 20px auto; }
                                  .station-url { font-size: 14px; color: #666; margin-top: 10px; }
                                  @media print { .no-print { display: none; } }
                                </style>
                              </head>
                              <body>
                                <button class="no-print" onclick="window.print()" style="padding: 10px 20px; font-size: 16px; margin-bottom: 20px;">
                                  ${isRTL ? 'הדפס' : 'Print'}
                                </button>
                                ${stationsWithQR.map(s => `
                                  <div class="station">
                                    <div class="station-order">${isRTL ? 'תחנה' : 'Station'} ${s.order}</div>
                                    <div class="station-title">${s.title || ''}</div>
                                    <div class="qr-code">
                                      <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`${baseUrl}/v/${s.stationShortId}`)}" alt="QR Code" />
                                    </div>
                                    <div class="station-url">${baseUrl}/v/${s.stationShortId}</div>
                                  </div>
                                `).join('')}
                              </body>
                              </html>
                            `);
                            printWindow.document.close();
                          }
                        }}
                        className="flex items-center gap-2 px-3 py-2 border border-amber-500 text-amber-600 dark:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                      >
                        <Printer className="w-4 h-4" />
                        {isRTL ? 'הדפס QR' : 'Print QRs'}
                      </button>
                    )}
                    <button
                      onClick={addStation}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      {isRTL ? 'הוסף תחנה' : 'Add Station'}
                    </button>
                  </div>
                </div>

                {stations.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <Map className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      {isRTL ? 'אין תחנות עדיין. הוסיפו את התחנה הראשונה!' : 'No stations yet. Add your first station!'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stations.map((station, index) => (
                      <div
                        key={station.id}
                        draggable
                        onDragStart={(e) => {
                          setDraggedStation(station.id);
                          e.dataTransfer.effectAllowed = 'move';
                          // Add visual feedback
                          (e.currentTarget as HTMLElement).style.opacity = '0.5';
                        }}
                        onDragEnd={(e) => {
                          setDraggedStation(null);
                          (e.currentTarget as HTMLElement).style.opacity = '1';
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (!draggedStation || draggedStation === station.id) return;

                          // Find indices
                          const fromIndex = stations.findIndex(s => s.id === draggedStation);
                          const toIndex = stations.findIndex(s => s.id === station.id);

                          if (fromIndex === -1 || toIndex === -1) return;

                          // Reorder
                          const newStations = [...stations];
                          const [removed] = newStations.splice(fromIndex, 1);
                          newStations.splice(toIndex, 0, removed);

                          // Update order numbers
                          const reordered = newStations.map((s, i) => ({ ...s, order: i + 1 }));
                          setStations(reordered);
                          setDraggedStation(null);
                        }}
                        className={`border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden transition-all ${
                          !station.isActive ? 'opacity-60' : ''
                        } ${draggedStation === station.id ? 'ring-2 ring-amber-500' : ''} ${
                          draggedStation && draggedStation !== station.id ? 'border-dashed border-amber-400' : ''
                        }`}
                      >
                        {/* Station header */}
                        <div
                          className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50"
                        >
                          {/* Drag handle */}
                          <div
                            className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                            title={isRTL ? 'גרור לשינוי סדר' : 'Drag to reorder'}
                          >
                            <GripVertical className="w-5 h-5 text-gray-400" />
                          </div>

                          <span className="w-8 h-8 flex items-center justify-center bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full font-bold text-sm flex-shrink-0">
                            {station.order}
                          </span>

                          {/* Station title - clickable to expand */}
                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => setExpandedStation(expandedStation === station.id ? null : station.id)}
                          >
                            <p className="font-medium text-gray-900 dark:text-white truncate">
                              {station.title || `${isRTL ? 'תחנה' : 'Station'} ${station.order}`}
                            </p>
                          </div>

                          {/* QR Code preview in row */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {station.stationShortId ? (
                              <div className="flex items-center gap-2">
                                {/* Small QR preview */}
                                <img
                                  src={`https://api.qrserver.com/v1/create-qr-code/?size=48x48&data=${encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : ''}/v/${station.stationShortId}`)}`}
                                  alt="QR"
                                  className="w-12 h-12 rounded border border-gray-200 dark:border-gray-600 bg-white"
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(`${window.location.origin}/v/${station.stationShortId}`);
                                  }}
                                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500"
                                  title={isRTL ? 'העתק קישור' : 'Copy link'}
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); createStationQR(station.id); }}
                                disabled={creatingQRForStation === station.id || !ownerId}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors disabled:opacity-50 text-sm"
                                title={!ownerId ? (isRTL ? 'שמור קודם' : 'Save first') : ''}
                              >
                                {creatingQRForStation === station.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <QrCode className="w-4 h-4" />
                                    <span>{isRTL ? 'צור QR' : 'Create QR'}</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>

                          <button
                            onClick={(e) => { e.stopPropagation(); deleteStation(station.id); }}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex-shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Station details (expanded) */}
                        {expandedStation === station.id && (
                          <div className="p-4 space-y-4 border-t border-gray-200 dark:border-gray-700">
                            {/* Title */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                  {isRTL ? 'כותרת (עברית)' : 'Title (Hebrew)'}
                                </label>
                                <input
                                  type="text"
                                  value={station.title}
                                  onChange={(e) => updateStation(station.id, { title: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                  {isRTL ? 'כותרת (אנגלית)' : 'Title (English)'}
                                </label>
                                <input
                                  type="text"
                                  value={station.titleEn || ''}
                                  onChange={(e) => updateStation(station.id, { titleEn: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                                />
                              </div>
                            </div>

                            {/* Content */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                  {isRTL ? 'תוכן (עברית)' : 'Content (Hebrew)'}
                                </label>
                                <textarea
                                  value={station.content || ''}
                                  onChange={(e) => updateStation(station.id, { content: e.target.value })}
                                  rows={3}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm resize-none"
                                />
                              </div>
                              <div>
                                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                  {isRTL ? 'תוכן (אנגלית)' : 'Content (English)'}
                                </label>
                                <textarea
                                  value={station.contentEn || ''}
                                  onChange={(e) => updateStation(station.id, { contentEn: e.target.value })}
                                  rows={3}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm resize-none"
                                />
                              </div>
                            </div>

                            {/* Video URL */}
                            <div>
                              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-2">
                                <Video className="w-4 h-4" />
                                {isRTL ? 'קישור לסרטון (YouTube)' : 'Video URL (YouTube)'}
                              </label>
                              <input
                                type="url"
                                value={station.videoUrl || ''}
                                onChange={(e) => updateStation(station.id, { videoUrl: e.target.value })}
                                placeholder="https://youtube.com/watch?v=..."
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                              />
                            </div>

                            {/* Hint to next */}
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                              <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                <Map className="w-4 h-4" />
                                {isRTL ? 'רמז לתחנה הבאה' : 'Hint for Next Station'}
                              </h4>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                    {isRTL ? 'רמז (עברית)' : 'Hint (Hebrew)'}
                                  </label>
                                  <textarea
                                    value={station.hintText || ''}
                                    onChange={(e) => updateStation(station.id, { hintText: e.target.value })}
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm resize-none"
                                    placeholder={isRTL ? 'חפשו ליד העץ הגדול...' : 'Look near the big tree...'}
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                    {isRTL ? 'רמז (אנגלית)' : 'Hint (English)'}
                                  </label>
                                  <textarea
                                    value={station.hintTextEn || ''}
                                    onChange={(e) => updateStation(station.id, { hintTextEn: e.target.value })}
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm resize-none"
                                  />
                                </div>
                              </div>

                              <div className="mt-3">
                                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-2">
                                  <ImageIcon className="w-4 h-4" />
                                  {isRTL ? 'תמונת רמז (URL)' : 'Hint Image (URL)'}
                                </label>
                                <input
                                  type="url"
                                  value={station.hintImageUrl || ''}
                                  onChange={(e) => updateStation(station.id, { hintImageUrl: e.target.value })}
                                  placeholder="https://..."
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                                />
                              </div>
                            </div>

                            {/* Station QR Code */}
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                <QrCode className="w-4 h-4" />
                                {isRTL ? 'קוד QR של התחנה' : 'Station QR Code'}
                              </label>

                              {station.stationShortId ? (
                                /* QR exists - show it with actions */
                                <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                                  <QrCode className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                                  <code className="flex-1 text-sm font-mono text-emerald-700 dark:text-emerald-300">
                                    {station.stationShortId}
                                  </code>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(`${window.location.origin}/v/${station.stationShortId}`);
                                    }}
                                    className="p-1.5 hover:bg-emerald-200 dark:hover:bg-emerald-800 rounded text-emerald-600 dark:text-emerald-400"
                                    title={isRTL ? 'העתק קישור' : 'Copy link'}
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                  <a
                                    href={`/v/${station.stationShortId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 hover:bg-emerald-200 dark:hover:bg-emerald-800 rounded text-emerald-600 dark:text-emerald-400"
                                    title={isRTL ? 'פתח בחלון חדש' : 'Open in new tab'}
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                </div>
                              ) : (
                                /* No QR - show create button */
                                <div className="space-y-2">
                                  <button
                                    onClick={() => createStationQR(station.id)}
                                    disabled={creatingQRForStation === station.id || !ownerId}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full justify-center"
                                  >
                                    {creatingQRForStation === station.id ? (
                                      <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        {isRTL ? 'יוצר QR...' : 'Creating QR...'}
                                      </>
                                    ) : (
                                      <>
                                        <QrCode className="w-4 h-4" />
                                        {isRTL ? 'צור QR לתחנה' : 'Create Station QR'}
                                      </>
                                    )}
                                  </button>
                                  {!ownerId && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400">
                                      {isRTL ? 'שמור את הקוד הראשי קודם' : 'Save the main code first'}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* XP and Active */}
                            <div className="flex items-center gap-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                              <div className="flex-1">
                                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                  {isRTL ? 'נקודות XP' : 'XP Points'}
                                </label>
                                <input
                                  type="number"
                                  value={station.xpReward}
                                  onChange={(e) => updateStation(station.id, { xpReward: parseInt(e.target.value) || 0 })}
                                  min={0}
                                  className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                                />
                              </div>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={station.isActive}
                                  onChange={(e) => updateStation(station.id, { isActive: e.target.checked })}
                                  className="w-4 h-4 text-amber-500 rounded"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                  {isRTL ? 'פעיל' : 'Active'}
                                </span>
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Timer Tab */}
            {activeTab === 'timer' && (
              <div className="space-y-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={timerConfig.enabled}
                    onChange={(e) => setTimerConfig({ ...timerConfig, enabled: e.target.checked })}
                    className="w-5 h-5 text-amber-500 rounded"
                  />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {isRTL ? 'הפעל טיימר' : 'Enable Timer'}
                  </span>
                </label>

                {timerConfig.enabled && (
                  <>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={timerConfig.showToPlayer}
                        onChange={(e) => setTimerConfig({ ...timerConfig, showToPlayer: e.target.checked })}
                        className="w-5 h-5 text-amber-500 rounded"
                      />
                      <span className="text-gray-700 dark:text-gray-300">
                        {isRTL ? 'הצג טיימר לשחקן' : 'Show Timer to Player'}
                      </span>
                    </label>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {isRTL ? 'מגבלת זמן (שניות)' : 'Time Limit (seconds)'}
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={timerConfig.maxTimeSeconds}
                          onChange={(e) => setTimerConfig({ ...timerConfig, maxTimeSeconds: parseInt(e.target.value) || 0 })}
                          min={0}
                          step={60}
                          className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                        <span className="text-gray-500 dark:text-gray-400 text-sm">
                          {timerConfig.maxTimeSeconds === 0
                            ? (isRTL ? '(ללא הגבלה)' : '(unlimited)')
                            : `= ${Math.floor(timerConfig.maxTimeSeconds / 60)}:${(timerConfig.maxTimeSeconds % 60).toString().padStart(2, '0')}`
                          }
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {isRTL ? '0 = ללא הגבלת זמן' : '0 = No time limit'}
                      </p>
                    </div>

                    {/* Quick presets */}
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {isRTL ? 'הגדרות מהירות' : 'Quick Presets'}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: isRTL ? 'ללא הגבלה' : 'Unlimited', value: 0 },
                          { label: '5 min', value: 300 },
                          { label: '10 min', value: 600 },
                          { label: '15 min', value: 900 },
                          { label: '30 min', value: 1800 },
                          { label: '60 min', value: 3600 },
                        ].map(preset => (
                          <button
                            key={preset.value}
                            onClick={() => setTimerConfig({ ...timerConfig, maxTimeSeconds: preset.value })}
                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                              timerConfig.maxTimeSeconds === preset.value
                                ? 'bg-amber-500 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Registration Tab */}
            {activeTab === 'registration' && (
              <div className="space-y-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={registrationConfig.requireConsent}
                    onChange={(e) => setRegistrationConfig({ ...registrationConfig, requireConsent: e.target.checked })}
                    className="w-5 h-5 text-amber-500 rounded"
                  />
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white block">
                      {isRTL ? 'דרוש אישור להצגה בלידרבורד' : 'Require Consent for Leaderboard'}
                    </span>
                    <span className="text-sm text-gray-500">
                      {isRTL ? 'השחקן יאשר הצגת השם והתמונה' : 'Player confirms showing name and photo'}
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={registrationConfig.allowSelfie}
                    onChange={(e) => setRegistrationConfig({ ...registrationConfig, allowSelfie: e.target.checked })}
                    className="w-5 h-5 text-amber-500 rounded"
                  />
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white block">
                      {isRTL ? 'אפשר צילום סלפי' : 'Allow Selfie'}
                    </span>
                    <span className="text-sm text-gray-500">
                      {isRTL ? 'בנוסף לאפשרות האימוג\'י' : 'In addition to emoji option'}
                    </span>
                  </div>
                </label>

                {/* Emoji palette preview */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {isRTL ? 'פלטת אימוג\'ים' : 'Emoji Palette'}
                  </label>
                  <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    {registrationConfig.emojiPalette.map((emoji, i) => (
                      <span key={i} className="text-2xl">{emoji}</span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {isRTL ? 'אימוג\'ים ברירת מחדל למשחק' : 'Default game emojis'}
                  </p>
                </div>
              </div>
            )}

            {/* Completion Tab */}
            {activeTab === 'completion' && (
              <div className="space-y-6">
                {/* Custom message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {isRTL ? 'הודעת סיום מותאמת (עברית)' : 'Custom Completion Message (Hebrew)'}
                  </label>
                  <textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={2}
                    placeholder={isRTL ? 'כל הכבוד! סיימתם את המסע בהצלחה' : 'Congratulations! You completed the journey'}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {isRTL ? 'הודעת סיום מותאמת (אנגלית)' : 'Custom Completion Message (English)'}
                  </label>
                  <textarea
                    value={customMessageEn}
                    onChange={(e) => setCustomMessageEn(e.target.value)}
                    rows={2}
                    placeholder="Congratulations! You completed the journey"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                  />
                </div>

                {/* Display options */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {isRTL ? 'מה להציג במסך הסיום' : 'Show on Completion Screen'}
                  </h4>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={completionConfig.showTotalTime}
                      onChange={(e) => setCompletionConfig({ ...completionConfig, showTotalTime: e.target.checked })}
                      className="w-5 h-5 text-amber-500 rounded"
                    />
                    <span className="text-gray-700 dark:text-gray-300">
                      {isRTL ? 'זמן כולל' : 'Total Time'}
                    </span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={completionConfig.showStationTimes}
                      onChange={(e) => setCompletionConfig({ ...completionConfig, showStationTimes: e.target.checked })}
                      className="w-5 h-5 text-amber-500 rounded"
                    />
                    <span className="text-gray-700 dark:text-gray-300">
                      {isRTL ? 'זמני תחנות' : 'Station Times'}
                    </span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={completionConfig.showLeaderboard}
                      onChange={(e) => setCompletionConfig({ ...completionConfig, showLeaderboard: e.target.checked })}
                      className="w-5 h-5 text-amber-500 rounded"
                    />
                    <span className="text-gray-700 dark:text-gray-300">
                      {isRTL ? 'לידרבורד' : 'Leaderboard'}
                    </span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={completionConfig.showConfetti}
                      onChange={(e) => setCompletionConfig({ ...completionConfig, showConfetti: e.target.checked })}
                      className="w-5 h-5 text-amber-500 rounded"
                    />
                    <span className="text-gray-700 dark:text-gray-300">
                      {isRTL ? 'קונפטי' : 'Confetti Animation'}
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Advanced Tab */}
            {activeTab === 'advanced' && (
              <div className="space-y-6">
                {/* Phase control */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {isRTL ? 'שלב נוכחי' : 'Current Phase'}
                  </label>
                  <select
                    value={currentPhase}
                    onChange={(e) => setCurrentPhase(e.target.value as QTreasurePhase)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="registration">{isRTL ? 'הרשמה' : 'Registration'}</option>
                    <option value="playing">{isRTL ? 'משחק פעיל' : 'Playing'}</option>
                    <option value="completed">{isRTL ? 'הסתיים' : 'Completed'}</option>
                  </select>
                </div>

                {/* Language */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {isRTL ? 'שפה' : 'Language'}
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as 'he' | 'en' | 'auto')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="auto">{isRTL ? 'אוטומטי (לפי הדפדפן)' : 'Auto (by browser)'}</option>
                    <option value="he">{isRTL ? 'עברית' : 'Hebrew'}</option>
                    <option value="en">{isRTL ? 'אנגלית' : 'English'}</option>
                  </select>
                </div>

                {/* XP Settings */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {isRTL ? 'XP לתחנה' : 'XP per Station'}
                    </label>
                    <input
                      type="number"
                      value={xpPerStation}
                      onChange={(e) => setXpPerStation(parseInt(e.target.value) || 0)}
                      min={0}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {isRTL ? 'בונוס השלמה' : 'Completion Bonus'}
                    </label>
                    <input
                      type="number"
                      value={completionBonusXP}
                      onChange={(e) => setCompletionBonusXP(parseInt(e.target.value) || 0)}
                      min={0}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Out-of-order handling */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <label className="flex items-center gap-3 cursor-pointer mb-4">
                    <input
                      type="checkbox"
                      checked={allowOutOfOrder}
                      onChange={(e) => setAllowOutOfOrder(e.target.checked)}
                      className="w-5 h-5 text-amber-500 rounded"
                    />
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white block">
                        {isRTL ? 'אפשר סריקה לא בסדר' : 'Allow Out-of-Order Scanning'}
                      </span>
                      <span className="text-sm text-gray-500">
                        {isRTL ? 'עדיין יוצג אזהרה אבל יתקבל' : 'Will show warning but accept'}
                      </span>
                    </div>
                  </label>

                  {allowOutOfOrder && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          {isRTL ? 'הודעת אזהרה (עברית)' : 'Warning Message (Hebrew)'}
                        </label>
                        <input
                          type="text"
                          value={outOfOrderWarning}
                          onChange={(e) => setOutOfOrderWarning(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          {isRTL ? 'הודעת אזהרה (אנגלית)' : 'Warning Message (English)'}
                        </label>
                        <input
                          type="text"
                          value={outOfOrderWarningEn}
                          onChange={(e) => setOutOfOrderWarningEn(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-800">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              {tCommon('cancel')}
            </button>

            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {tCommon('save')}
            </button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && shortId && (
        <MobilePreviewModal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          url={`${typeof window !== 'undefined' ? window.location.origin : ''}/v/${shortId}`}
        />
      )}
    </>
  );
}
