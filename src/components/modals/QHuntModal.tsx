'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X, Loader2, Plus, Trash2, Palette, Settings, Target, Users, Crosshair,
  Monitor, Copy, Check, ImageIcon, Upload, Timer, Play, Square, RotateCcw
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import {
  QHuntConfig,
  QHuntCode,
  QHuntTeam,
  QHuntPhase,
  DEFAULT_QHUNT_CONFIG,
  CODE_TYPE_CONFIG,
} from '@/types/qhunt';

interface QHuntModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: QHuntConfig, backgroundFile?: File) => Promise<void>;
  onPhaseChange?: (phase: QHuntPhase) => Promise<void>;
  onReset?: () => Promise<void>;
  loading?: boolean;
  initialConfig?: QHuntConfig;
  shortId?: string;
  currentPhase?: QHuntPhase;
}

// Preset colors for neon hunter theme
const presetColors = {
  background: ['#0a0f1a', '#0d1321', '#1a1a2e', '#16213e', '#0f172a', '#1e293b'],
  primary: ['#00d4ff', '#3b82f6', '#8b5cf6', '#ff00aa', '#f59e0b', '#00ff88'],
  success: ['#00ff88', '#22c55e', '#10b981', '#4ade80'],
  warning: ['#ffaa00', '#f59e0b', '#fbbf24', '#facc15'],
};

export default function QHuntModal({
  isOpen,
  onClose,
  onSave,
  onPhaseChange,
  onReset,
  loading = false,
  initialConfig,
  shortId,
  currentPhase = 'registration',
}: QHuntModalProps) {
  const t = useTranslations('modals');
  const locale = useLocale();
  const isRTL = locale === 'he';

  // Tab state
  const [activeTab, setActiveTab] = useState<'general' | 'codes' | 'teams' | 'branding' | 'advanced'>('general');

  // Config state
  const [config, setConfig] = useState<QHuntConfig>(initialConfig || DEFAULT_QHUNT_CONFIG);

  // Background file state
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Copy state
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Initialize from initialConfig
  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig);
      if (initialConfig.branding.backgroundImage) {
        setBackgroundPreview(initialConfig.branding.backgroundImage);
      }
      if (initialConfig.branding.eventLogo) {
        setLogoPreview(initialConfig.branding.eventLogo);
      }
    }
  }, [initialConfig]);

  // Update config helpers
  const updateConfig = <K extends keyof QHuntConfig>(key: K, value: QHuntConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const updateBranding = <K extends keyof QHuntConfig['branding']>(key: K, value: QHuntConfig['branding'][K]) => {
    setConfig(prev => ({
      ...prev,
      branding: { ...prev.branding, [key]: value },
    }));
  };

  // Code management
  const addCode = () => {
    const availableTypes = Object.keys(CODE_TYPE_CONFIG) as Array<keyof typeof CODE_TYPE_CONFIG>;
    const typeIndex = config.codes.length % availableTypes.length;
    const newCode: QHuntCode = {
      id: `code_${Date.now()}`,
      codeValue: generateCodeValue(),
      codeType: availableTypes[typeIndex],
      points: 10,
      label: '',
      isActive: true,
      createdAt: Date.now(),
    };
    updateConfig('codes', [...config.codes, newCode]);
  };

  const updateCode = (id: string, updates: Partial<QHuntCode>) => {
    updateConfig('codes', config.codes.map(c =>
      c.id === id ? { ...c, ...updates } : c
    ));
  };

  const removeCode = (id: string) => {
    updateConfig('codes', config.codes.filter(c => c.id !== id));
  };

  // Team management
  const addTeam = () => {
    const colors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff'];
    const emojis = ['🔴', '🟢', '🔵', '🟡', '🟣', '🔵'];
    const newTeam: QHuntTeam = {
      id: `team_${Date.now()}`,
      name: isRTL ? `קבוצה ${config.teams.length + 1}` : `Team ${config.teams.length + 1}`,
      color: colors[config.teams.length % colors.length],
      emoji: emojis[config.teams.length % emojis.length],
      order: config.teams.length,
    };
    updateConfig('teams', [...config.teams, newTeam]);
  };

  const updateTeam = (id: string, updates: Partial<QHuntTeam>) => {
    updateConfig('teams', config.teams.map(t =>
      t.id === id ? { ...t, ...updates } : t
    ));
  };

  const removeTeam = (id: string) => {
    updateConfig('teams', config.teams.filter(t => t.id !== id));
  };

  // Generate random code value
  const generateCodeValue = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Handle file uploads
  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBackgroundFile(file);
      setBackgroundPreview(URL.createObjectURL(file));
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  // Copy link
  const copyLink = async (type: 'player' | 'display') => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const url = type === 'display'
      ? `${baseUrl}/v/${shortId}?display=1`
      : `${baseUrl}/v/${shortId}`;
    await navigator.clipboard.writeText(url);
    setCopiedLink(type);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  // Handle save
  const handleSave = async () => {
    await onSave(config, backgroundFile || undefined);
  };

  // Phase control
  const handlePhaseChange = async (phase: QHuntPhase) => {
    if (onPhaseChange) {
      await onPhaseChange(phase);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl flex flex-col"
        style={{ background: 'var(--bg-card)' }}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-cyan-500 to-pink-500">
              <Crosshair className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                QHunt {isRTL ? 'הגדרות' : 'Settings'}
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {isRTL ? 'ציד קודים בזמן אמת' : 'Real-time code hunting game'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-black/10"
          >
            <X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* Quick Links */}
        {shortId && (
          <div className="px-4 py-3 border-b flex flex-wrap gap-2" style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
            <span className="text-sm text-gray-400 flex items-center gap-1 me-2">
              {isRTL ? 'קישורים:' : 'Links:'}
            </span>

            {/* Player Link */}
            <button
              onClick={() => copyLink('player')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all"
              style={{
                background: copiedLink === 'player' ? '#00ff8830' : '#ffffff10',
                color: copiedLink === 'player' ? '#00ff88' : 'var(--text-secondary)',
              }}
            >
              {copiedLink === 'player' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {isRTL ? 'קישור שחקנים' : 'Player Link'}
            </button>

            {/* Display Link */}
            <button
              onClick={() => copyLink('display')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all"
              style={{
                background: copiedLink === 'display' ? '#00ff8830' : '#ffffff10',
                color: copiedLink === 'display' ? '#00ff88' : 'var(--text-secondary)',
              }}
            >
              {copiedLink === 'display' ? <Check className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
              {isRTL ? 'תצוגה גדולה' : 'Display Screen'}
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
          {[
            { id: 'general', icon: Settings, label: isRTL ? 'כללי' : 'General' },
            { id: 'codes', icon: Target, label: isRTL ? 'קודים' : 'Codes' },
            { id: 'teams', icon: Users, label: isRTL ? 'קבוצות' : 'Teams' },
            { id: 'branding', icon: Palette, label: isRTL ? 'מיתוג' : 'Branding' },
            { id: 'advanced', icon: Settings, label: isRTL ? 'מתקדם' : 'Advanced' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-cyan-500 text-cyan-500'
                  : 'border-transparent hover:bg-black/5'
              }`}
              style={{
                color: activeTab === tab.id ? '#00d4ff' : 'var(--text-secondary)',
              }}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Game Title */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  {isRTL ? 'שם המשחק' : 'Game Title'}
                </label>
                <input
                  type="text"
                  value={config.branding.gameTitle || ''}
                  onChange={(e) => updateBranding('gameTitle', e.target.value)}
                  placeholder={isRTL ? 'ציד הקודים' : 'Code Hunt'}
                  className="w-full px-4 py-3 rounded-xl border transition-colors"
                  style={{
                    background: 'var(--bg-secondary)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              {/* Game Mode */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  {isRTL ? 'מצב משחק' : 'Game Mode'}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => updateConfig('mode', 'individual')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      config.mode === 'individual' ? 'border-cyan-500' : 'border-gray-600'
                    }`}
                    style={{ background: config.mode === 'individual' ? '#00d4ff20' : 'var(--bg-secondary)' }}
                  >
                    <div className="text-2xl mb-2">👤</div>
                    <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {isRTL ? 'אישי' : 'Individual'}
                    </div>
                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {isRTL ? 'כל שחקן לעצמו' : 'Every player for themselves'}
                    </div>
                  </button>
                  <button
                    onClick={() => updateConfig('mode', 'teams')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      config.mode === 'teams' ? 'border-cyan-500' : 'border-gray-600'
                    }`}
                    style={{ background: config.mode === 'teams' ? '#00d4ff20' : 'var(--bg-secondary)' }}
                  >
                    <div className="text-2xl mb-2">👥</div>
                    <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {isRTL ? 'קבוצות' : 'Teams'}
                    </div>
                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {isRTL ? 'תחרות בין קבוצות' : 'Competition between teams'}
                    </div>
                  </button>
                </div>
              </div>

              {/* Game Duration */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  {isRTL ? 'משך המשחק (דקות)' : 'Game Duration (minutes)'}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={Math.floor(config.gameDurationSeconds / 60)}
                    onChange={(e) => updateConfig('gameDurationSeconds', parseInt(e.target.value || '0') * 60)}
                    min={0}
                    max={180}
                    className="w-32 px-4 py-3 rounded-xl border"
                    style={{
                      background: 'var(--bg-secondary)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {isRTL ? '(0 = ללא הגבלה)' : '(0 = unlimited)'}
                  </span>
                </div>
              </div>

              {/* Language */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  {isRTL ? 'שפה' : 'Language'}
                </label>
                <div className="flex gap-3">
                  {[
                    { value: 'he', label: 'עברית' },
                    { value: 'en', label: 'English' },
                    { value: 'auto', label: isRTL ? 'אוטומטי' : 'Auto' },
                  ].map(lang => (
                    <button
                      key={lang.value}
                      onClick={() => updateConfig('language', lang.value as 'he' | 'en' | 'auto')}
                      className={`px-4 py-2 rounded-lg border transition-all ${
                        config.language === lang.value ? 'border-cyan-500' : 'border-gray-600'
                      }`}
                      style={{
                        background: config.language === lang.value ? '#00d4ff20' : 'transparent',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Show Leaderboard to Players */}
              <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
                <div>
                  <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {isRTL ? 'הצג טבלה לשחקנים' : 'Show Leaderboard to Players'}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {isRTL ? 'שחקנים יראו את הטבלה המלאה בזמן משחק' : 'Players see full leaderboard during game'}
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showLeaderboardToPlayers}
                    onChange={(e) => updateConfig('showLeaderboardToPlayers', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>

              {/* Enable Sound */}
              <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
                <div>
                  <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {isRTL ? 'אפקטי צליל' : 'Sound Effects'}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {isRTL ? 'צלילים בעת סריקה ואירועים' : 'Sounds on scan and events'}
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enableSound}
                    onChange={(e) => updateConfig('enableSound', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>
            </div>
          )}

          {/* Codes Tab */}
          {activeTab === 'codes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {isRTL ? `${config.codes.length} קודים` : `${config.codes.length} Codes`}
                </h3>
                <button
                  onClick={addCode}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-black font-medium hover:bg-cyan-400 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {isRTL ? 'הוסף קוד' : 'Add Code'}
                </button>
              </div>

              {config.codes.length === 0 ? (
                <div className="text-center py-12 rounded-xl border-2 border-dashed" style={{ borderColor: 'var(--border)' }}>
                  <Target className="w-12 h-12 mx-auto mb-3 opacity-40" style={{ color: 'var(--text-secondary)' }} />
                  <p style={{ color: 'var(--text-secondary)' }}>
                    {isRTL ? 'אין קודים. הוסף קודים לציד!' : 'No codes. Add codes to hunt!'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {config.codes.map((code) => {
                    const typeConfig = CODE_TYPE_CONFIG[code.codeType];
                    return (
                      <div
                        key={code.id}
                        className="flex items-center gap-3 p-4 rounded-xl border"
                        style={{
                          background: 'var(--bg-secondary)',
                          borderColor: code.isActive ? typeConfig?.color || '#666' : 'var(--border)',
                          opacity: code.isActive ? 1 : 0.5,
                        }}
                      >
                        {/* Type indicator */}
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                          style={{ background: typeConfig?.color + '30', color: typeConfig?.color }}
                        >
                          {typeConfig?.emoji || '🎯'}
                        </div>

                        {/* Code value */}
                        <div className="flex-1">
                          <input
                            type="text"
                            value={code.codeValue}
                            onChange={(e) => updateCode(code.id, { codeValue: e.target.value.toUpperCase() })}
                            className="font-mono text-lg font-bold bg-transparent border-none outline-none w-full"
                            style={{ color: 'var(--text-primary)' }}
                          />
                          <input
                            type="text"
                            value={code.label || ''}
                            onChange={(e) => updateCode(code.id, { label: e.target.value })}
                            placeholder={isRTL ? 'תווית (אופציונלי)' : 'Label (optional)'}
                            className="text-sm bg-transparent border-none outline-none w-full"
                            style={{ color: 'var(--text-secondary)' }}
                          />
                        </div>

                        {/* Type selector */}
                        <select
                          value={code.codeType}
                          onChange={(e) => updateCode(code.id, { codeType: e.target.value as QHuntCode['codeType'] })}
                          className="px-3 py-2 rounded-lg border text-sm"
                          style={{
                            background: 'var(--bg-card)',
                            borderColor: 'var(--border)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          {Object.entries(CODE_TYPE_CONFIG).map(([key, cfg]) => (
                            <option key={key} value={key}>
                              {cfg.emoji} {isRTL ? cfg.labelHe : cfg.labelEn}
                            </option>
                          ))}
                        </select>

                        {/* Points */}
                        <input
                          type="number"
                          value={code.points}
                          onChange={(e) => updateCode(code.id, { points: parseInt(e.target.value) || 0 })}
                          min={1}
                          max={100}
                          className="w-16 px-2 py-2 rounded-lg border text-center"
                          style={{
                            background: 'var(--bg-card)',
                            borderColor: 'var(--border)',
                            color: 'var(--text-primary)',
                          }}
                        />
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {isRTL ? 'נק\'' : 'pts'}
                        </span>

                        {/* Active toggle */}
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={code.isActive}
                            onChange={(e) => updateCode(code.id, { isActive: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                        </label>

                        {/* Delete */}
                        <button
                          onClick={() => removeCode(code.id)}
                          className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bulk add */}
              <div className="mt-6 p-4 rounded-xl border-2 border-dashed" style={{ borderColor: 'var(--border)' }}>
                <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                  {isRTL ? 'הוסף קודים מהירים (10 קודים אקראיים)' : 'Quick add (10 random codes)'}
                </p>
                <button
                  onClick={() => {
                    for (let i = 0; i < 10; i++) {
                      setTimeout(() => addCode(), i * 50);
                    }
                  }}
                  className="px-4 py-2 rounded-lg border hover:bg-white/5 transition-colors"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  <Plus className="w-4 h-4 inline me-2" />
                  {isRTL ? 'הוסף 10 קודים' : 'Add 10 Codes'}
                </button>
              </div>
            </div>
          )}

          {/* Teams Tab */}
          {activeTab === 'teams' && (
            <div className="space-y-4">
              {config.mode !== 'teams' && (
                <div className="p-4 rounded-xl bg-amber-500/20 border border-amber-500/50 mb-4">
                  <p className="text-amber-400 text-sm">
                    {isRTL ? 'מצב קבוצות מושבת. הפעל אותו בלשונית "כללי".' : 'Teams mode is disabled. Enable it in the "General" tab.'}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {isRTL ? `${config.teams.length} קבוצות` : `${config.teams.length} Teams`}
                </h3>
                <button
                  onClick={addTeam}
                  disabled={config.mode !== 'teams'}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-black font-medium hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  {isRTL ? 'הוסף קבוצה' : 'Add Team'}
                </button>
              </div>

              {config.teams.length === 0 ? (
                <div className="text-center py-12 rounded-xl border-2 border-dashed" style={{ borderColor: 'var(--border)' }}>
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-40" style={{ color: 'var(--text-secondary)' }} />
                  <p style={{ color: 'var(--text-secondary)' }}>
                    {isRTL ? 'אין קבוצות. הוסף קבוצות למשחק!' : 'No teams. Add teams for the game!'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {config.teams.map((team) => (
                    <div
                      key={team.id}
                      className="p-4 rounded-xl border-2"
                      style={{
                        background: team.color + '15',
                        borderColor: team.color,
                      }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        {/* Color picker */}
                        <input
                          type="color"
                          value={team.color}
                          onChange={(e) => updateTeam(team.id, { color: e.target.value })}
                          className="w-10 h-10 rounded-lg cursor-pointer"
                        />
                        {/* Name */}
                        <input
                          type="text"
                          value={team.name}
                          onChange={(e) => updateTeam(team.id, { name: e.target.value })}
                          className="flex-1 px-3 py-2 rounded-lg bg-black/20 border-none outline-none font-medium"
                          style={{ color: 'var(--text-primary)' }}
                        />
                        {/* Delete */}
                        <button
                          onClick={() => removeTeam(team.id)}
                          className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                      {/* Team emoji */}
                      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        <span>{isRTL ? 'אימוג\'י:' : 'Emoji:'}</span>
                        <span className="text-xl">{team.emoji || '👥'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Branding Tab */}
          {activeTab === 'branding' && (
            <div className="space-y-6">
              {/* Background Color */}
              <div>
                <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
                  {isRTL ? 'צבע רקע' : 'Background Color'}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.branding.backgroundColor || '#0a0f1a'}
                    onChange={(e) => updateBranding('backgroundColor', e.target.value)}
                    className="w-12 h-12 rounded-xl cursor-pointer"
                  />
                  <div className="flex flex-wrap gap-2">
                    {presetColors.background.map((color) => (
                      <button
                        key={color}
                        onClick={() => updateBranding('backgroundColor', color)}
                        className="w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110"
                        style={{
                          background: color,
                          borderColor: config.branding.backgroundColor === color ? '#00d4ff' : 'transparent',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Primary Color */}
              <div>
                <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
                  {isRTL ? 'צבע ראשי' : 'Primary Color'}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.branding.primaryColor || '#00d4ff'}
                    onChange={(e) => updateBranding('primaryColor', e.target.value)}
                    className="w-12 h-12 rounded-xl cursor-pointer"
                  />
                  <div className="flex flex-wrap gap-2">
                    {presetColors.primary.map((color) => (
                      <button
                        key={color}
                        onClick={() => updateBranding('primaryColor', color)}
                        className="w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110"
                        style={{
                          background: color,
                          borderColor: config.branding.primaryColor === color ? '#fff' : 'transparent',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Secondary Color */}
              <div>
                <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
                  {isRTL ? 'צבע משני' : 'Secondary Color'}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.branding.secondaryColor || '#ff00aa'}
                    onChange={(e) => updateBranding('secondaryColor', e.target.value)}
                    className="w-12 h-12 rounded-xl cursor-pointer"
                  />
                </div>
              </div>

              {/* Success Color */}
              <div>
                <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
                  {isRTL ? 'צבע הצלחה' : 'Success Color'}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.branding.successColor || '#00ff88'}
                    onChange={(e) => updateBranding('successColor', e.target.value)}
                    className="w-12 h-12 rounded-xl cursor-pointer"
                  />
                  <div className="flex flex-wrap gap-2">
                    {presetColors.success.map((color) => (
                      <button
                        key={color}
                        onClick={() => updateBranding('successColor', color)}
                        className="w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110"
                        style={{
                          background: color,
                          borderColor: config.branding.successColor === color ? '#fff' : 'transparent',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Background Image */}
              <div>
                <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
                  {isRTL ? 'תמונת רקע' : 'Background Image'}
                </label>
                <input
                  type="file"
                  ref={backgroundInputRef}
                  accept="image/*"
                  onChange={handleBackgroundUpload}
                  className="hidden"
                />
                {backgroundPreview ? (
                  <div className="relative">
                    <img
                      src={backgroundPreview}
                      alt="Background"
                      className="w-full h-40 object-cover rounded-xl"
                    />
                    <button
                      onClick={() => {
                        setBackgroundFile(null);
                        setBackgroundPreview(null);
                        updateBranding('backgroundImage', '');
                      }}
                      className="absolute top-2 end-2 p-2 rounded-lg bg-red-500/80 hover:bg-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => backgroundInputRef.current?.click()}
                    className="w-full h-32 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors hover:border-cyan-500"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  >
                    <ImageIcon className="w-8 h-8" />
                    <span>{isRTL ? 'העלה תמונת רקע' : 'Upload Background Image'}</span>
                  </button>
                )}
              </div>

              {/* Event Logo */}
              <div>
                <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
                  {isRTL ? 'לוגו אירוע' : 'Event Logo'}
                </label>
                <input
                  type="file"
                  ref={logoInputRef}
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                {logoPreview ? (
                  <div className="flex items-center gap-4">
                    <img
                      src={logoPreview}
                      alt="Logo"
                      className="h-20 object-contain rounded-lg"
                    />
                    <button
                      onClick={() => {
                        setLogoFile(null);
                        setLogoPreview(null);
                        updateBranding('eventLogo', '');
                      }}
                      className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="px-6 py-3 rounded-xl border-2 border-dashed flex items-center gap-2 transition-colors hover:border-cyan-500"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  >
                    <Upload className="w-5 h-5" />
                    <span>{isRTL ? 'העלה לוגו' : 'Upload Logo'}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Advanced Tab */}
          {activeTab === 'advanced' && (
            <div className="space-y-6">
              {/* Game Control */}
              <div>
                <h3 className="font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
                  {isRTL ? 'שליטה במשחק' : 'Game Control'}
                </h3>
                <div className="flex items-center gap-3 mb-4 p-4 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {isRTL ? 'שלב נוכחי:' : 'Current Phase:'}
                  </span>
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-cyan-500/20 text-cyan-400">
                    {currentPhase}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    onClick={() => handlePhaseChange('registration')}
                    disabled={!onPhaseChange}
                    className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                      currentPhase === 'registration' ? 'border-cyan-500 bg-cyan-500/20' : 'border-gray-600 hover:border-gray-500'
                    }`}
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <Users className="w-5 h-5" />
                    <span className="text-sm">{isRTL ? 'הרשמה' : 'Registration'}</span>
                  </button>
                  <button
                    onClick={() => handlePhaseChange('countdown')}
                    disabled={!onPhaseChange}
                    className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                      currentPhase === 'countdown' ? 'border-amber-500 bg-amber-500/20' : 'border-gray-600 hover:border-gray-500'
                    }`}
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <Timer className="w-5 h-5" />
                    <span className="text-sm">{isRTL ? 'ספירה' : 'Countdown'}</span>
                  </button>
                  <button
                    onClick={() => handlePhaseChange('playing')}
                    disabled={!onPhaseChange}
                    className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                      currentPhase === 'playing' ? 'border-green-500 bg-green-500/20' : 'border-gray-600 hover:border-gray-500'
                    }`}
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <Play className="w-5 h-5" />
                    <span className="text-sm">{isRTL ? 'משחק' : 'Playing'}</span>
                  </button>
                  <button
                    onClick={() => handlePhaseChange('finished')}
                    disabled={!onPhaseChange}
                    className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                      currentPhase === 'finished' ? 'border-pink-500 bg-pink-500/20' : 'border-gray-600 hover:border-gray-500'
                    }`}
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <Square className="w-5 h-5" />
                    <span className="text-sm">{isRTL ? 'סיום' : 'Finished'}</span>
                  </button>
                </div>
              </div>

              {/* Allow Same Code Multiple Times */}
              <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
                <div>
                  <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {isRTL ? 'אפשר סריקת קוד יותר מפעם אחת' : 'Allow Scanning Same Code Multiple Times'}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {isRTL ? 'שחקנים יכולים לסרוק את אותו קוד כמה פעמים' : 'Players can scan the same code multiple times'}
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.allowSameCodeMultipleTimes}
                    onChange={(e) => updateConfig('allowSameCodeMultipleTimes', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>

              {/* Require All Codes */}
              <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
                <div>
                  <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {isRTL ? 'חובה למצוא את כל הקודים' : 'Require All Codes to Finish'}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {isRTL ? 'שחקנים מסיימים רק כשמצאו את כל הקודים' : 'Players only finish when all codes are found'}
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.requireAllCodesToFinish}
                    onChange={(e) => updateConfig('requireAllCodesToFinish', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>

              {/* Minimum Codes */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  {isRTL ? 'מינימום קודים לסיום' : 'Minimum Codes to Finish'}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={config.minCodesToFinish}
                    onChange={(e) => updateConfig('minCodesToFinish', parseInt(e.target.value) || 0)}
                    min={0}
                    className="w-24 px-4 py-3 rounded-xl border"
                    style={{
                      background: 'var(--bg-secondary)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {isRTL ? '(0 = ללא מינימום)' : '(0 = no minimum)'}
                  </span>
                </div>
              </div>

              {/* Reset Session */}
              <div className="pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
                <h3 className="font-medium mb-4 text-red-400">
                  {isRTL ? 'אזור מסוכן' : 'Danger Zone'}
                </h3>
                <button
                  onClick={onReset}
                  disabled={!onReset}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-500 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-5 h-5" />
                  {isRTL ? 'אפס משחק (מחק שחקנים וסריקות)' : 'Reset Game (Delete Players & Scans)'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl border transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >
            {isRTL ? 'ביטול' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-pink-500 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isRTL ? 'שמור' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
