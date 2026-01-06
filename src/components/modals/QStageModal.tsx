'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X, Loader2, Plus, Trash2, Palette, Settings, Crown, Sliders, Volume2,
  Monitor, Smartphone, Copy, Check, ImageIcon, Video, Upload, Link, ExternalLink,
  Play, Square, RotateCcw
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import {
  QStageConfig,
  QStagePhase,
  QStageThreshold,
  QStageJudge,
  DEFAULT_QSTAGE_CONFIG,
  DEFAULT_QSTAGE_THRESHOLDS,
  DEFAULT_EMOJI_PALETTE,
} from '@/types/qstage';
import { generateJudgeToken } from '@/lib/qstage';

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface QStageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: QStageConfig, backgroundFile?: File) => Promise<void>;
  loading?: boolean;
  initialConfig?: QStageConfig;
  shortId?: string;
}

// Preset colors
const presetColors = {
  background: ['#0a0f1a', '#0d1321', '#1a1a2e', '#16213e', '#0f172a', '#1e293b'],
  primary: ['#00d4ff', '#3b82f6', '#8b5cf6', '#ff00aa', '#f59e0b', '#00ff88'],
  success: ['#00ff88', '#22c55e', '#10b981', '#4ade80'],
};

export default function QStageModal({
  isOpen,
  onClose,
  onSave,
  loading = false,
  initialConfig,
  shortId,
}: QStageModalProps) {
  const t = useTranslations('modals');
  const locale = useLocale();
  const isRTL = locale === 'he';

  // Tab state
  const [activeTab, setActiveTab] = useState<'branding' | 'display' | 'thresholds' | 'judges' | 'advanced'>('branding');

  // Config state
  const [config, setConfig] = useState<QStageConfig>(initialConfig || DEFAULT_QSTAGE_CONFIG);

  // Background file state
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Judge link copied state
  const [copiedJudgeId, setCopiedJudgeId] = useState<string | null>(null);

  // Initialize from initialConfig
  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig);
      if (initialConfig.display.backgroundImageUrl) {
        setBackgroundPreview(initialConfig.display.backgroundImageUrl);
      }
    }
  }, [initialConfig]);

  // Update config helper
  const updateConfig = <K extends keyof QStageConfig>(key: K, value: QStageConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const updateDisplay = <K extends keyof QStageConfig['display']>(key: K, value: QStageConfig['display'][K]) => {
    setConfig(prev => ({
      ...prev,
      display: { ...prev.display, [key]: value },
    }));
  };

  const updateBranding = <K extends keyof QStageConfig['branding']>(key: K, value: QStageConfig['branding'][K]) => {
    setConfig(prev => ({
      ...prev,
      branding: { ...prev.branding, [key]: value },
    }));
  };

  // Handle background file
  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isVideo = file.type.startsWith('video/');
      setBackgroundFile(file);
      setBackgroundPreview(URL.createObjectURL(file));
      updateDisplay('backgroundType', isVideo ? 'video' : 'image');
    }
  };

  // Add judge
  const addJudge = () => {
    const newJudge: QStageJudge = {
      id: `judge_${Date.now()}`,
      name: '',
      voteWeight: 5,
      accessToken: generateJudgeToken(),
      hasVoted: false,
    };
    updateConfig('judges', [...config.judges, newJudge]);
  };

  // Update judge
  const updateJudge = (id: string, updates: Partial<QStageJudge>) => {
    updateConfig('judges', config.judges.map(j =>
      j.id === id ? { ...j, ...updates } : j
    ));
  };

  // Remove judge
  const removeJudge = (id: string) => {
    updateConfig('judges', config.judges.filter(j => j.id !== id));
  };

  // Copy judge link
  const copyJudgeLink = async (judge: QStageJudge) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${baseUrl}/v/${shortId}?judge=${judge.accessToken}`;
    await navigator.clipboard.writeText(link);
    setCopiedJudgeId(judge.id);
    setTimeout(() => setCopiedJudgeId(null), 2000);
  };

  // Update threshold
  const updateThreshold = (index: number, updates: Partial<QStageThreshold>) => {
    const newThresholds = [...config.thresholds];
    newThresholds[index] = { ...newThresholds[index], ...updates };
    updateConfig('thresholds', newThresholds);
  };

  // Handle save
  const handleSave = async () => {
    await onSave(config, backgroundFile || undefined);
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
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-cyan-500 to-purple-600">
              <Monitor className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                QStage {isRTL ? 'הגדרות' : 'Settings'}
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {isRTL ? 'הצבעה חיה על המסך הגדול' : 'Live voting on the big screen'}
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

        {/* Voting Control Panel - Show when shortId is available */}
        {shortId && (
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
            {/* Phase Control */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-sm text-gray-400 me-2">
                {isRTL ? 'שלב:' : 'Phase:'}
              </span>

              {/* Start Voting */}
              <button
                onClick={() => updateConfig('currentPhase', 'voting')}
                disabled={config.currentPhase === 'voting'}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  config.currentPhase === 'voting'
                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                    : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                }`}
              >
                <Play className="w-4 h-4" />
                {isRTL ? 'התחל הצבעה' : 'Start Voting'}
              </button>

              {/* Stop Voting */}
              <button
                onClick={() => updateConfig('currentPhase', 'results')}
                disabled={config.currentPhase === 'results'}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  config.currentPhase === 'results'
                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                    : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                }`}
              >
                <Square className="w-4 h-4" />
                {isRTL ? 'עצור' : 'Stop'}
              </button>

              {/* Reset */}
              <button
                onClick={() => updateConfig('currentPhase', 'standby')}
                disabled={config.currentPhase === 'standby'}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  config.currentPhase === 'standby'
                    ? 'bg-gray-500 text-white'
                    : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
                {isRTL ? 'איפוס' : 'Reset'}
              </button>

              {/* Current status indicator */}
              <div className={`ms-auto px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                config.currentPhase === 'voting' ? 'bg-green-500/20 text-green-400' :
                config.currentPhase === 'results' ? 'bg-red-500/20 text-red-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {config.currentPhase === 'voting' ? (isRTL ? '🔴 LIVE' : '🔴 LIVE') :
                 config.currentPhase === 'results' ? (isRTL ? 'הסתיים' : 'Ended') :
                 (isRTL ? 'המתנה' : 'Standby')}
              </div>
            </div>

            {/* Quick Links */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-400 flex items-center gap-1 me-2">
                <Link className="w-4 h-4" />
                {isRTL ? 'קישורים:' : 'Links:'}
              </span>

              {/* Mobile Voting Link */}
              <button
                onClick={async () => {
                  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                  const url = `${baseUrl}/v/${shortId}`;
                  await navigator.clipboard.writeText(url);
                  setCopiedJudgeId('mobile');
                  setTimeout(() => setCopiedJudgeId(null), 2000);
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-green-500/20 text-green-400 hover:bg-green-500/30"
              >
                <Smartphone className="w-4 h-4" />
                {isRTL ? 'שלט הצבעה' : 'Voting Remote'}
                {copiedJudgeId === 'mobile' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </button>

              {/* Display Screen Link */}
              <button
                onClick={async () => {
                  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                  const url = `${baseUrl}/v/${shortId}?display=true`;
                  await navigator.clipboard.writeText(url);
                  setCopiedJudgeId('display');
                  setTimeout(() => setCopiedJudgeId(null), 2000);
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
              >
                <Monitor className="w-4 h-4" />
                {isRTL ? 'מסך תצוגה' : 'Display Screen'}
                {copiedJudgeId === 'display' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </button>

              {/* Open in new tab */}
              <button
                onClick={() => {
                  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                  window.open(`${baseUrl}/v/${shortId}?display=true`, '_blank');
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
              >
                <ExternalLink className="w-4 h-4" />
                {isRTL ? 'פתח תצוגה' : 'Open Display'}
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
          {[
            { id: 'branding', icon: Palette, label: isRTL ? 'מיתוג' : 'Branding' },
            { id: 'display', icon: Monitor, label: isRTL ? 'תצוגה' : 'Display' },
            { id: 'thresholds', icon: Sliders, label: isRTL ? 'סיפים' : 'Thresholds' },
            { id: 'judges', icon: Crown, label: isRTL ? 'שופטים' : 'Judges' },
            { id: 'advanced', icon: Settings, label: isRTL ? 'מתקדם' : 'Advanced' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-b-2 border-cyan-500 text-cyan-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* BRANDING TAB */}
          {activeTab === 'branding' && (
            <div className="space-y-6">
              {/* Event Name */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                    {isRTL ? 'שם האירוע (עברית)' : 'Event Name (Hebrew)'}
                  </label>
                  <input
                    type="text"
                    value={config.branding.eventName || ''}
                    onChange={(e) => updateBranding('eventName', e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border bg-white/5"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    placeholder={isRTL ? 'תחרות הכישרונות' : 'Talent Competition'}
                    dir="rtl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                    {isRTL ? 'שם האירוע (אנגלית)' : 'Event Name (English)'}
                  </label>
                  <input
                    type="text"
                    value={config.branding.eventNameEn || ''}
                    onChange={(e) => updateBranding('eventNameEn', e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border bg-white/5"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    placeholder="Talent Competition"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Background */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  {isRTL ? 'רקע' : 'Background'}
                </label>
                <div className="flex gap-2 mb-3">
                  {['color', 'image', 'video'].map((type) => (
                    <button
                      key={type}
                      onClick={() => updateDisplay('backgroundType', type as 'color' | 'image' | 'video')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        config.display.backgroundType === type
                          ? 'bg-cyan-500 text-white'
                          : 'bg-white/10 text-gray-400 hover:bg-white/20'
                      }`}
                    >
                      {type === 'color' ? (isRTL ? 'צבע' : 'Color') :
                       type === 'image' ? (isRTL ? 'תמונה' : 'Image') :
                       (isRTL ? 'וידאו' : 'Video')}
                    </button>
                  ))}
                </div>

                {config.display.backgroundType === 'color' ? (
                  <div className="flex flex-wrap gap-2">
                    {presetColors.background.map((color) => (
                      <button
                        key={color}
                        onClick={() => updateDisplay('backgroundColor', color)}
                        className={`w-10 h-10 rounded-lg border-2 transition-transform hover:scale-110 ${
                          config.display.backgroundColor === color ? 'border-cyan-500' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    <input
                      type="color"
                      value={config.display.backgroundColor || '#0a0f1a'}
                      onChange={(e) => updateDisplay('backgroundColor', e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer"
                    />
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-cyan-500/50 transition-colors"
                    style={{ borderColor: 'var(--border)' }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {backgroundPreview ? (
                      config.display.backgroundType === 'video' ? (
                        <video src={backgroundPreview} className="max-h-32 mx-auto rounded-lg" muted loop autoPlay />
                      ) : (
                        <img src={backgroundPreview} alt="" className="max-h-32 mx-auto rounded-lg" />
                      )
                    ) : (
                      <>
                        {config.display.backgroundType === 'video' ? (
                          <Video className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        ) : (
                          <ImageIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        )}
                        <p className="text-sm text-gray-400">
                          {isRTL ? 'לחצו להעלאה' : 'Click to upload'}
                        </p>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={config.display.backgroundType === 'video' ? 'video/*' : 'image/*'}
                      onChange={handleBackgroundUpload}
                      className="hidden"
                    />
                  </div>
                )}
              </div>

              {/* Colors */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                    {isRTL ? 'צבע ראשי' : 'Primary Color'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {presetColors.primary.map((color) => (
                      <button
                        key={color}
                        onClick={() => updateBranding('primaryColor', color)}
                        className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 ${
                          config.branding.primaryColor === color ? 'border-white' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}40` }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                    {isRTL ? 'צבע הצלחה' : 'Success Color'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {presetColors.success.map((color) => (
                      <button
                        key={color}
                        onClick={() => updateBranding('successColor', color)}
                        className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 ${
                          config.branding.successColor === color ? 'border-white' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}40` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DISPLAY TAB */}
          {activeTab === 'display' && (
            <div className="space-y-6">
              {/* Bar Position */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  {isRTL ? 'מיקום הבר' : 'Bar Position'}
                </label>
                <div className="flex gap-2">
                  {['left', 'right'].map((pos) => (
                    <button
                      key={pos}
                      onClick={() => updateDisplay('barPosition', pos as 'left' | 'right')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        config.display.barPosition === pos
                          ? 'bg-cyan-500 text-white'
                          : 'bg-white/10 text-gray-400 hover:bg-white/20'
                      }`}
                    >
                      {pos === 'left' ? (isRTL ? 'שמאל' : 'Left') : (isRTL ? 'ימין' : 'Right')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid Position */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  {isRTL ? 'גריד מצביעים' : 'Voter Grid'}
                </label>
                <div className="flex gap-2">
                  {['left', 'right', 'hidden'].map((pos) => (
                    <button
                      key={pos}
                      onClick={() => updateDisplay('gridPosition', pos as 'left' | 'right' | 'hidden')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        config.display.gridPosition === pos
                          ? 'bg-cyan-500 text-white'
                          : 'bg-white/10 text-gray-400 hover:bg-white/20'
                      }`}
                    >
                      {pos === 'left' ? (isRTL ? 'שמאל' : 'Left') :
                       pos === 'right' ? (isRTL ? 'ימין' : 'Right') :
                       (isRTL ? 'מוסתר' : 'Hidden')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                {[
                  { key: 'showPercentageText', label: isRTL ? 'הצג אחוזים' : 'Show Percentage' },
                  { key: 'barGlowEnabled', label: isRTL ? 'אפקט זוהר' : 'Glow Effect' },
                  { key: 'showVoterCount', label: isRTL ? 'הצג מספר מצביעים' : 'Show Voter Count' },
                  { key: 'showLikeDislikeCount', label: isRTL ? 'הצג ספירה' : 'Show Like/Dislike Count' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-primary)' }}>{label}</span>
                    <button
                      onClick={() => updateDisplay(key as keyof typeof config.display, !config.display[key as keyof typeof config.display])}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        config.display[key as keyof typeof config.display] ? 'bg-cyan-500' : 'bg-gray-600'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${
                          config.display[key as keyof typeof config.display] ? 'left-[22px]' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* THRESHOLDS TAB */}
          {activeTab === 'thresholds' && (
            <div className="space-y-6">
              {/* Success Threshold */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  {isRTL ? 'סף הצלחה (%)' : 'Success Threshold (%)'}
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="50"
                    max="90"
                    value={config.successThreshold ?? 70}
                    onChange={(e) => updateConfig('successThreshold', parseInt(e.target.value) || 70)}
                    className="flex-1"
                  />
                  <span className="text-2xl font-bold text-cyan-400 w-16 text-center">
                    {config.successThreshold}%
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  {isRTL ? 'אפקט הצלחה יופעל כשהאחוזים יעברו סף זה' : 'Success effect triggers when percentage crosses this threshold'}
                </p>
              </div>

              {/* Color Thresholds */}
              <div>
                <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
                  {isRTL ? 'צבעי סף' : 'Threshold Colors'}
                </label>
                <div className="space-y-3">
                  {config.thresholds.map((threshold, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={threshold.percentage ?? 0}
                        onChange={(e) => updateThreshold(index, { percentage: parseInt(e.target.value) || 0 })}
                        className="w-16 px-2 py-1 rounded border bg-white/10 text-center"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                      />
                      <span className="text-gray-400">%</span>
                      <input
                        type="color"
                        value={threshold.color || '#ff0000'}
                        onChange={(e) => updateThreshold(index, { color: e.target.value })}
                        className="w-10 h-8 rounded cursor-pointer"
                      />
                      <div
                        className="flex-1 h-4 rounded-full"
                        style={{
                          background: threshold.color,
                          boxShadow: `0 0 10px ${threshold.color}60`,
                        }}
                      />
                      <input
                        type="text"
                        value={threshold.label || ''}
                        onChange={(e) => updateThreshold(index, { label: e.target.value })}
                        className="w-24 px-2 py-1 rounded border bg-white/10 text-sm"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                        placeholder={isRTL ? 'תווית' : 'Label'}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* JUDGES TAB */}
          {activeTab === 'judges' && (
            <div className="space-y-6">
              {/* Enable Judges */}
              <label className="flex items-center justify-between">
                <span style={{ color: 'var(--text-primary)' }}>
                  {isRTL ? 'אפשר שופטים' : 'Enable Judges'}
                </span>
                <button
                  onClick={() => updateConfig('judgeVotingEnabled', !config.judgeVotingEnabled)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    config.judgeVotingEnabled ? 'bg-cyan-500' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${
                      config.judgeVotingEnabled ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </label>

              {config.judgeVotingEnabled && (
                <>
                  {/* Judges can vote after audience */}
                  <label className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-primary)' }}>
                      {isRTL ? 'שופטים יכולים להצביע אחרי הקהל' : 'Judges can vote after audience'}
                    </span>
                    <button
                      onClick={() => updateConfig('judgesCanVoteAfterAudience', !config.judgesCanVoteAfterAudience)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        config.judgesCanVoteAfterAudience ? 'bg-cyan-500' : 'bg-gray-600'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${
                          config.judgesCanVoteAfterAudience ? 'left-[22px]' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </label>

                  {/* Judges List */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {isRTL ? 'רשימת שופטים' : 'Judges List'}
                      </label>
                      <button
                        onClick={addJudge}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-600 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        {isRTL ? 'הוסף שופט' : 'Add Judge'}
                      </button>
                    </div>

                    <div className="space-y-3">
                      {config.judges.map((judge) => (
                        <div
                          key={judge.id}
                          className="p-4 rounded-xl border"
                          style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <Crown className="w-5 h-5 text-yellow-400" />
                            <input
                              type="text"
                              value={judge.name || ''}
                              onChange={(e) => updateJudge(judge.id, { name: e.target.value })}
                              className="flex-1 px-3 py-1.5 rounded-lg border bg-white/5"
                              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                              placeholder={isRTL ? 'שם השופט' : 'Judge name'}
                            />
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-400">x</span>
                              <input
                                type="number"
                                min="1"
                                max="10"
                                value={judge.voteWeight ?? 5}
                                onChange={(e) => updateJudge(judge.id, { voteWeight: parseInt(e.target.value) || 1 })}
                                className="w-14 px-2 py-1.5 rounded-lg border bg-white/5 text-center"
                                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                              />
                            </div>
                            <button
                              onClick={() => removeJudge(judge.id)}
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Judge link */}
                          {shortId && (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                readOnly
                                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/v/${shortId}?judge=${judge.accessToken}`}
                                className="flex-1 px-3 py-1.5 rounded-lg border bg-white/5 text-sm text-gray-400"
                                style={{ borderColor: 'var(--border)' }}
                              />
                              <button
                                onClick={() => copyJudgeLink(judge)}
                                className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
                              >
                                {copiedJudgeId === judge.id ? (
                                  <Check className="w-4 h-4" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}

                      {config.judges.length === 0 && (
                        <p className="text-center text-gray-400 py-8">
                          {isRTL ? 'אין שופטים. לחצו על "הוסף שופט" להוספה.' : 'No judges. Click "Add Judge" to add one.'}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ADVANCED TAB */}
          {activeTab === 'advanced' && (
            <div className="space-y-6">
              {/* Countdown Duration */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  {isRTL ? 'ספירה לאחור (שניות)' : 'Countdown Duration (seconds)'}
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={config.countdownDurationSeconds ?? 3}
                  onChange={(e) => updateConfig('countdownDurationSeconds', parseInt(e.target.value) || 3)}
                  className="w-20 px-3 py-2 rounded-lg border bg-white/5"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              {/* Language */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  {isRTL ? 'שפה' : 'Language'}
                </label>
                <div className="flex gap-2">
                  {[
                    { value: 'he', label: 'עברית' },
                    { value: 'en', label: 'English' },
                    { value: 'auto', label: isRTL ? 'אוטומטי' : 'Auto' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => updateConfig('language', value as 'he' | 'en' | 'auto')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        config.language === value
                          ? 'bg-cyan-500 text-white'
                          : 'bg-white/10 text-gray-400 hover:bg-white/20'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sound Settings */}
              <div>
                <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
                  <Volume2 className="w-4 h-4 inline me-2" />
                  {isRTL ? 'צלילים' : 'Sounds'}
                </label>
                <div className="space-y-3">
                  {[
                    { key: 'enabled', label: isRTL ? 'צלילים מופעלים' : 'Sounds Enabled' },
                    { key: 'countdownSound', label: isRTL ? 'צליל ספירה לאחור' : 'Countdown Sound' },
                    { key: 'thresholdSound', label: isRTL ? 'צליל חציית סף' : 'Threshold Sound' },
                    { key: 'successSound', label: isRTL ? 'צליל הצלחה' : 'Success Sound' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center justify-between">
                      <span className="text-gray-400">{label}</span>
                      <button
                        onClick={() => updateConfig('sound', { ...config.sound, [key]: !config.sound[key as keyof typeof config.sound] })}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          config.sound[key as keyof typeof config.sound] ? 'bg-cyan-500' : 'bg-gray-600'
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${
                            config.sound[key as keyof typeof config.sound] ? 'left-[22px]' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </label>
                  ))}
                </div>
              </div>

              {/* Avatar Settings */}
              <div>
                <label className="flex items-center justify-between mb-3">
                  <span style={{ color: 'var(--text-primary)' }}>
                    {isRTL ? 'אפשר סלפי' : 'Allow Selfie'}
                  </span>
                  <button
                    onClick={() => updateConfig('allowSelfie', !config.allowSelfie)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      config.allowSelfie ? 'bg-cyan-500' : 'bg-gray-600'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${
                        config.allowSelfie ? 'left-[22px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 p-4 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-medium transition-colors hover:bg-white/10"
            style={{ color: 'var(--text-secondary)' }}
          >
            {isRTL ? 'ביטול' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 rounded-lg font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #0099cc)' }}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {isRTL ? 'שמור' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
