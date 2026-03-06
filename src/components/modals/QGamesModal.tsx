'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { X, Gamepad2, Loader2, RotateCcw, ExternalLink, Monitor, Eye, Settings, Copy, Check, AlertTriangle, Plus, Trash2, MessageCircle, RotateCw, Upload, ImageIcon, ChevronDown, Clock, Gift } from 'lucide-react';
import {
  QGamesConfig,
  QGameType,
  QGamesThemeId,
  DEFAULT_QGAMES_CONFIG,
  DEFAULT_QGAMES_BRANDING,
  DEFAULT_CHAT_PHRASES,
  GAME_META,
  QGAMES_THEMES,
  resolveTheme,
  QGamesChatPhrase,
  QGamesScheduleSlot,
  DEFAULT_REWARDS_CONFIG,
  QGamesCustomPrize,
} from '@/types/qgames';
import QGamesPreviewPhone from '@/components/qgames/QGamesPreviewPhone';

interface QGamesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: QGamesConfig, logoFile?: File, backgroundFile?: File) => Promise<void>;
  loading?: boolean;
  initialConfig?: QGamesConfig;
  codeId?: string;
  shortId?: string;
  onReset?: () => Promise<void>;
}

export default function QGamesModal({
  isOpen,
  onClose,
  onSave,
  loading,
  initialConfig,
  codeId,
  shortId,
  onReset,
}: QGamesModalProps) {
  const t = useTranslations('modals');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const isRTL = locale === 'he';
  const isEditing = !!initialConfig;

  const [config, setConfig] = useState<QGamesConfig>(
    initialConfig || { ...DEFAULT_QGAMES_CONFIG, branding: { ...DEFAULT_QGAMES_BRANDING } }
  );
  const [mobileTab, setMobileTab] = useState<'settings' | 'preview'>('settings');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [expandedGame, setExpandedGame] = useState<QGameType | null>(null);

  // Logo upload
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(initialConfig?.branding?.eventLogo || null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Background image upload
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(initialConfig?.branding?.backgroundImage || null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  // Drag & drop state
  const [logoDragging, setLogoDragging] = useState(false);
  const [bgDragging, setBgDragging] = useState(false);

  const handleFileDrop = (e: React.DragEvent, type: 'logo' | 'bg') => {
    e.preventDefault();
    e.stopPropagation();
    type === 'logo' ? setLogoDragging(false) : setBgDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (!f || !f.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (type === 'logo') {
        setLogoFile(f);
        setLogoPreview(reader.result as string);
      } else {
        setBackgroundFile(f);
        setBackgroundPreview(reader.result as string);
      }
    };
    reader.readAsDataURL(f);
  };

  const prevIsOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setConfig(initialConfig || { ...DEFAULT_QGAMES_CONFIG, branding: { ...DEFAULT_QGAMES_BRANDING } });
      setMobileTab('settings');
      setShowResetConfirm(false);
      setResetting(false);
      setExpandedGame(null);
      setLogoFile(null);
      setLogoPreview(initialConfig?.branding?.eventLogo || null);
      setBackgroundFile(null);
      setBackgroundPreview(initialConfig?.branding?.backgroundImage || null);
      setLogoDragging(false);
      setBgDragging(false);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialConfig]);

  if (!isOpen) return null;

  const toggleGame = (gameType: QGameType) => {
    setConfig(prev => {
      const games = prev.enabledGames.includes(gameType)
        ? prev.enabledGames.filter(g => g !== gameType)
        : [...prev.enabledGames, gameType];
      if (games.length === 0) return prev;
      return { ...prev, enabledGames: games };
    });
  };

  const selectTheme = (themeId: QGamesThemeId) => {
    const theme = QGAMES_THEMES[themeId];
    setConfig(prev => ({
      ...prev,
      branding: {
        ...prev.branding,
        theme: themeId,
        backgroundColor: theme.backgroundColor,
        primaryColor: theme.primaryColor,
        accentColor: theme.accentColor,
      },
    }));
  };

  const handleSave = async () => {
    await onSave(config, logoFile || undefined, backgroundFile || undefined);
  };

  const currentThemeId = config.branding.theme || 'dark-gaming';
  const resolvedTheme = resolveTheme(config.branding);
  const isCustomColors = (() => {
    const base = QGAMES_THEMES[currentThemeId];
    return (
      config.branding.backgroundColor !== base.backgroundColor ||
      config.branding.primaryColor !== base.primaryColor ||
      config.branding.accentColor !== base.accentColor
    );
  })();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md md:max-w-4xl max-h-[85vh] bg-bg-primary border border-border rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Left: Settings Panel */}
        <div className={`flex-1 md:w-[420px] md:shrink-0 flex flex-col overflow-hidden ${mobileTab === 'preview' ? 'hidden md:flex' : 'flex'}`}>
          {/* Header */}
          <div className="sticky top-0 bg-bg-primary/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between z-10 shrink-0">
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-bold text-text-primary">
                {isEditing ? 'Q.Games' : (isRTL ? 'יצירת Q.Games' : 'Create Q.Games')}
              </h2>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-bg-secondary rounded-lg transition-colors">
              <X className="w-5 h-5 text-text-secondary" />
            </button>
          </div>

          {/* Mobile tab toggle */}
          <div className="flex md:hidden border-b border-border shrink-0">
            <button
              onClick={() => setMobileTab('settings')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
                mobileTab === 'settings' ? 'text-accent border-b-2 border-accent' : 'text-text-secondary'
              }`}
            >
              <Settings className="w-4 h-4" />
              {isRTL ? 'הגדרות' : 'Settings'}
            </button>
            <button
              onClick={() => setMobileTab('preview')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
                mobileTab === 'preview' ? 'text-accent border-b-2 border-accent' : 'text-text-secondary'
              }`}
            >
              <Eye className="w-4 h-4" />
              {isRTL ? 'תצוגה מקדימה' : 'Preview'}
            </button>
          </div>

          {/* Settings Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Game Name */}
            <div>
              <label className="text-sm font-medium text-text-primary mb-2 block">
                {isRTL ? 'שם המשחק' : 'Game Name'}
              </label>
              <input
                type="text"
                value={config.branding.title || ''}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  branding: { ...prev.branding, title: e.target.value },
                }))}
                placeholder="Q.Games"
                maxLength={30}
                dir="auto"
                className="w-full bg-bg-secondary border border-border rounded-xl py-2.5 px-3 text-text-primary text-sm placeholder:text-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50 transition-colors"
              />
            </div>

            {/* Theme Selection */}
            <div>
              <label className="text-sm font-medium text-text-primary mb-2 block">
                {isRTL ? 'ערכת נושא' : 'Theme'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['dark-gaming', 'light-clean', 'kids-colorful', 'corporate'] as QGamesThemeId[]).map((themeId) => {
                  const theme = QGAMES_THEMES[themeId];
                  const isSelected = currentThemeId === themeId;
                  return (
                    <button
                      key={themeId}
                      onClick={() => selectTheme(themeId)}
                      className={`p-3 rounded-xl border-2 transition-all text-start ${
                        isSelected
                          ? 'border-accent ring-1 ring-accent/30 bg-accent/5'
                          : 'border-border hover:border-text-secondary/30'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className="w-5 h-5 rounded-full border border-border/50 shrink-0" style={{ backgroundColor: theme.backgroundColor }} />
                        <div className="w-5 h-5 rounded-full border border-border/50 shrink-0" style={{ backgroundColor: theme.primaryColor }} />
                        <div className="w-5 h-5 rounded-full border border-border/50 shrink-0" style={{ backgroundColor: theme.accentColor }} />
                      </div>
                      <p className="text-xs font-medium text-text-primary flex items-center gap-1">
                        <span>{theme.emoji}</span>
                        {isRTL ? theme.nameHe : theme.nameEn}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Colors + Logo + Background — single row */}
              <div className="grid grid-cols-3 gap-3 mt-3">
                {/* Column 1: Colors */}
                <div>
                  <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-2">{isRTL ? 'צבעים' : 'Colors'}</p>
                  <div className="space-y-2">
                    <ColorSwatch label={isRTL ? 'רקע' : 'Bg'} value={config.branding.backgroundColor} onChange={(c) => setConfig(prev => ({ ...prev, branding: { ...prev.branding, backgroundColor: c } }))} />
                    <ColorSwatch label={isRTL ? 'ראשי' : 'Primary'} value={config.branding.primaryColor} onChange={(c) => setConfig(prev => ({ ...prev, branding: { ...prev.branding, primaryColor: c } }))} />
                    <ColorSwatch label={isRTL ? 'משני' : 'Accent'} value={config.branding.accentColor} onChange={(c) => setConfig(prev => ({ ...prev, branding: { ...prev.branding, accentColor: c } }))} />
                  </div>
                  {isCustomColors && (
                    <button
                      onClick={() => selectTheme(currentThemeId)}
                      className="text-[10px] text-text-secondary hover:text-accent transition-colors mt-1.5"
                    >
                      {isRTL ? 'איפוס' : 'Reset'}
                    </button>
                  )}
                </div>

                {/* Column 2: Event Logo */}
                <div>
                  <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-2">{isRTL ? 'לוגו' : 'Logo'}</p>
                  <div
                    className={`aspect-square rounded-xl border-2 border-dashed overflow-hidden cursor-pointer transition-all flex items-center justify-center relative ${
                      logoDragging ? 'border-accent bg-accent/10' : 'border-border hover:border-accent/50'
                    }`}
                    onClick={() => logoInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setLogoDragging(true); }}
                    onDragEnter={(e) => { e.preventDefault(); setLogoDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setLogoDragging(false); }}
                    onDrop={(e) => handleFileDrop(e, 'logo')}
                    style={!logoPreview ? { background: 'repeating-conic-gradient(var(--bg-secondary) 0% 25%, transparent 0% 50%) 50% / 12px 12px' } : undefined}
                  >
                    {logoPreview ? (
                      <>
                        <img src={logoPreview} alt="" className="w-full h-full object-contain p-1.5" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setLogoFile(null);
                            setLogoPreview(null);
                            setConfig(prev => ({ ...prev, branding: { ...prev.branding, eventLogo: undefined, eventLogoName: undefined, eventLogoSize: undefined, logoScale: undefined } }));
                          }}
                          className="absolute top-1 end-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center text-white/70 hover:text-red-400 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center text-text-secondary">
                        <Upload className="w-5 h-5 mb-0.5" />
                        <span className="text-[8px]">{isRTL ? 'גרירה/לחיצה' : 'Drop/Click'}</span>
                      </div>
                    )}
                  </div>
                  {logoPreview && (
                    <div className="mt-1.5">
                      <label className="text-[9px] text-text-secondary">
                        {isRTL ? 'גודל' : 'Scale'} {(config.branding.logoScale || 1).toFixed(1)}x
                      </label>
                      <input
                        type="range" min={0.3} max={4} step={0.1}
                        value={config.branding.logoScale || 1}
                        onChange={(e) => setConfig(prev => ({ ...prev, branding: { ...prev.branding, logoScale: Number(e.target.value) } }))}
                        className="w-full" dir="ltr"
                        style={{ accentColor: resolvedTheme.accentColor }}
                      />
                    </div>
                  )}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/svg+xml,image/webp,image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f && f.type.startsWith('image/')) {
                        setLogoFile(f);
                        const r = new FileReader();
                        r.onload = () => setLogoPreview(r.result as string);
                        r.readAsDataURL(f);
                      }
                      e.target.value = '';
                    }}
                  />
                </div>

                {/* Column 3: Background */}
                <div>
                  <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-2">{isRTL ? 'רקע' : 'Background'}</p>
                  <div
                    className={`aspect-square rounded-xl border-2 border-dashed overflow-hidden cursor-pointer transition-all relative ${
                      bgDragging ? 'border-accent bg-accent/10' : 'border-border hover:border-accent/50'
                    }`}
                    onClick={() => bgInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setBgDragging(true); }}
                    onDragEnter={(e) => { e.preventDefault(); setBgDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setBgDragging(false); }}
                    onDrop={(e) => handleFileDrop(e, 'bg')}
                  >
                    {backgroundPreview ? (
                      <>
                        <img src={backgroundPreview} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0" style={{ backgroundColor: `rgba(0, 0, 0, ${(config.branding.imageOverlayOpacity ?? 40) / 100})` }} />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <Upload className="w-5 h-5 text-white" />
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setBackgroundFile(null);
                            setBackgroundPreview(null);
                            setConfig(prev => ({ ...prev, branding: { ...prev.branding, backgroundImage: undefined, backgroundImageName: undefined, backgroundImageSize: undefined, imageOverlayOpacity: undefined, backgroundBlur: undefined } }));
                          }}
                          className="absolute top-1 end-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center text-white/70 hover:text-red-400 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-text-secondary">
                        <ImageIcon className="w-5 h-5 mb-0.5" />
                        <span className="text-[8px]">{isRTL ? 'גרירה/לחיצה' : 'Drop/Click'}</span>
                      </div>
                    )}
                  </div>
                  {backgroundPreview && (
                    <div className="mt-1.5 space-y-1">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-text-secondary shrink-0">{isRTL ? 'כהות' : 'Dim'}</span>
                        <input
                          type="range" min={0} max={80}
                          value={config.branding.imageOverlayOpacity ?? 40}
                          onChange={(e) => setConfig(prev => ({ ...prev, branding: { ...prev.branding, imageOverlayOpacity: Number(e.target.value) } }))}
                          className="flex-1" dir="ltr"
                          style={{ accentColor: resolvedTheme.accentColor }}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-text-secondary shrink-0">{isRTL ? 'טשטוש' : 'Blur'}</span>
                        <input
                          type="range" min={0} max={20}
                          value={config.branding.backgroundBlur ?? 0}
                          onChange={(e) => setConfig(prev => ({ ...prev, branding: { ...prev.branding, backgroundBlur: Number(e.target.value) } }))}
                          className="flex-1" dir="ltr"
                          style={{ accentColor: resolvedTheme.accentColor }}
                        />
                      </div>
                    </div>
                  )}
                  <input
                    ref={bgInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f && f.type.startsWith('image/')) {
                        setBackgroundFile(f);
                        const r = new FileReader();
                        r.onload = () => setBackgroundPreview(r.result as string);
                        r.readAsDataURL(f);
                      }
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Games Selection — inline collapsible settings */}
            <div>
              <label className="text-sm font-medium text-text-primary mb-2 block">
                {isRTL ? 'משחקים זמינים' : 'Available Games'}
              </label>
              <div className="space-y-2">
                {(['rps', 'oddoneout', 'tictactoe', 'connect4', 'memory', 'frogger'] as QGameType[]).map((gameType) => {
                  const meta = GAME_META[gameType];
                  const isEnabled = config.enabledGames.includes(gameType);
                  const isExpanded = expandedGame === gameType && isEnabled;

                  const nameMap: Record<string, { he: string; en: string }> = {
                    rps: { he: 'אבן נייר ומספריים', en: 'Rock Paper Scissors' },
                    oddoneout: { he: 'משלוש יוצא א....חד!', en: 'Odd One Out' },
                    tictactoe: { he: 'איקס עיגול', en: 'Tic-Tac-Toe' },
                    connect4: { he: 'ארבע בשורה', en: 'Connect 4' },
                    memory: { he: 'זיכרון', en: 'Memory Challenge' },
                  };
                  const descMap: Record<string, { he: string; en: string }> = {
                    oddoneout: { he: '3 שחקנים · כף או אגרוף', en: '3 players · Palm or Fist' },
                    tictactoe: { he: '2 שחקנים · 3 ברצף', en: '2 players · 3 in a row' },
                    connect4: { he: '2 שחקנים · 4 ברצף', en: '2 players · 4 in a row' },
                    memory: { he: '2-6 שחקנים · זכרו את הסדר', en: '2-6 players · Remember the sequence' },
                  };

                  return (
                    <div
                      key={gameType}
                      className={`rounded-xl border transition-all overflow-hidden ${
                        isEnabled
                          ? 'bg-accent/10 border-accent/30'
                          : 'bg-bg-secondary border-border'
                      }`}
                    >
                      {/* Game header row */}
                      <div className="flex items-center gap-3 p-3">
                        {/* Toggle circle */}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleGame(gameType); }}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isEnabled ? 'bg-accent border-accent' : 'border-border hover:border-accent/40'
                          }`}
                        >
                          {isEnabled && <span className="text-white text-xs">✓</span>}
                        </button>

                        {/* Clickable area for expand/collapse */}
                        <button
                          className="flex-1 flex items-center gap-3 text-start"
                          onClick={() => {
                            if (!isEnabled) {
                              toggleGame(gameType);
                              setExpandedGame(gameType);
                            } else {
                              setExpandedGame(isExpanded ? null : gameType);
                            }
                          }}
                        >
                          <span className="text-2xl">{meta.emoji}</span>
                          <div className="flex-1">
                            <p className="font-medium text-text-primary text-sm">
                              {nameMap[gameType]?.[isRTL ? 'he' : 'en'] || gameType}
                            </p>
                            {descMap[gameType] && (
                              <p className="text-xs text-text-secondary">{descMap[gameType][isRTL ? 'he' : 'en']}</p>
                            )}
                          </div>
                          {isEnabled && (
                            <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                          )}
                        </button>
                      </div>

                      {/* Inline settings (expanded) */}
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-0">
                          <div className="bg-bg-secondary/60 rounded-lg p-3 space-y-3">
                            {gameType === 'rps' && (
                              <>
                                <SettingRow label={isRTL ? 'ראשון ל-' : 'First to'}>
                                  <SettingButtons values={[1, 3, 5]} current={config.rpsFirstTo} onChange={(n) => setConfig(prev => ({ ...prev, rpsFirstTo: n }))} />
                                </SettingRow>
                                <SettingRow label={isRTL ? 'טיימר סיבוב ראשון' : 'First round timer'}>
                                  <span className="text-sm text-text-primary font-mono">{config.rpsFirstRoundTimer}s</span>
                                </SettingRow>
                                <SettingRow label={isRTL ? 'טיימר סיבובים הבאים' : 'Subsequent timer'}>
                                  <span className="text-sm text-text-primary font-mono">{config.rpsSubsequentTimer}s</span>
                                </SettingRow>
                              </>
                            )}
                            {gameType === 'oddoneout' && (
                              <>
                                <SettingRow label={isRTL ? 'סטרייקים להפסד' : 'Strikes to lose'}>
                                  <SettingButtons values={[3, 5]} current={config.oooMaxStrikes} onChange={(n) => setConfig(prev => ({ ...prev, oooMaxStrikes: n }))} />
                                </SettingRow>
                                <SettingRow label={isRTL ? 'טיימר סיבוב ראשון' : 'First round timer'}>
                                  <span className="text-sm text-text-primary font-mono">{config.oooFirstRoundTimer}s</span>
                                </SettingRow>
                                <SettingRow label={isRTL ? 'טיימר סיבובים הבאים' : 'Subsequent timer'}>
                                  <span className="text-sm text-text-primary font-mono">{config.oooSubsequentTimer}s</span>
                                </SettingRow>
                              </>
                            )}
                            {gameType === 'tictactoe' && (
                              <>
                                <SettingRow label={isRTL ? 'ראשון ל-' : 'First to'}>
                                  <SettingButtons values={[1, 3, 5]} current={config.tttFirstTo} onChange={(n) => setConfig(prev => ({ ...prev, tttFirstTo: n }))} />
                                </SettingRow>
                                <SettingRow label={isRTL ? 'טיימר לתור' : 'Turn timer'}>
                                  <SettingButtons values={[10, 15, 20]} current={config.tttTurnTimer} onChange={(n) => setConfig(prev => ({ ...prev, tttTurnTimer: n }))} suffix="s" />
                                </SettingRow>
                              </>
                            )}
                            {gameType === 'connect4' && (
                              <>
                                <SettingRow label={isRTL ? 'טיימר לתור' : 'Turn timer'}>
                                  <SettingButtons values={[10, 15, 20, 30]} current={config.c4TurnTimer} onChange={(n) => setConfig(prev => ({ ...prev, c4TurnTimer: n }))} suffix="s" />
                                </SettingRow>
                              </>
                            )}
                            {gameType === 'memory' && (
                              <>
                                <SettingRow label={isRTL ? 'טיימר לזכירה' : 'Memorize timer'}>
                                  <SettingButtons values={[3, 5]} current={config.memoryMemorizeTimer} onChange={(n) => setConfig(prev => ({ ...prev, memoryMemorizeTimer: n }))} suffix="s" />
                                </SettingRow>
                                <SettingRow label={isRTL ? 'טיימר לבחירה' : 'Recall timer'}>
                                  <SettingButtons values={[10, 15]} current={config.memoryRecallTimer} onChange={(n) => setConfig(prev => ({ ...prev, memoryRecallTimer: n }))} suffix="s" />
                                </SettingRow>
                                <SettingRow label={isRTL ? 'פסילות להדחה' : 'Strikes to eliminate'}>
                                  <SettingButtons values={[3, 5]} current={config.memoryMaxStrikes} onChange={(n) => setConfig(prev => ({ ...prev, memoryMaxStrikes: n }))} />
                                </SettingRow>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Language */}
            <div>
              <label className="text-sm font-medium text-text-primary mb-2 block">
                {isRTL ? 'שפת ממשק' : 'Interface Language'}
              </label>
              <div className="flex gap-2">
                {[
                  { value: 'he', label: 'עברית' },
                  { value: 'en', label: 'English' },
                  { value: 'auto', label: isRTL ? 'אוטומטי' : 'Auto' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setConfig(prev => ({ ...prev, language: value as 'he' | 'en' | 'auto' }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                      config.language === value
                        ? 'bg-accent text-white'
                        : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <ToggleRow
                label={isRTL ? 'צלילים' : 'Sound Effects'}
                checked={config.enableSound}
                onChange={(v) => setConfig(prev => ({ ...prev, enableSound: v }))}
              />
              <ToggleRow
                label={isRTL ? 'טבלת מובילים' : 'Leaderboard'}
                checked={config.showLeaderboard}
                onChange={(v) => setConfig(prev => ({ ...prev, showLeaderboard: v }))}
              />
              <ToggleRow
                label={isRTL ? 'הזמנה בוואטסאפ' : 'WhatsApp Invite'}
                checked={config.enableWhatsAppInvite}
                onChange={(v) => setConfig(prev => ({ ...prev, enableWhatsAppInvite: v }))}
              />
            </div>

            {/* ── Chat Bubbles ── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <MessageCircle className="w-4 h-4 text-accent" />
                <span className="text-sm font-semibold text-text-primary">
                  {isRTL ? 'בועות צ\'אט' : 'Chat Bubbles'}
                </span>
              </div>
              <ToggleRow
                label={isRTL ? 'צ\'אט בלובי' : 'Lobby Chat'}
                checked={config.chatEnabled ?? true}
                onChange={(v) => setConfig(prev => ({ ...prev, chatEnabled: v }))}
              />
              {(config.chatEnabled ?? true) && (
                <ChatPhrasesEditor
                  phrases={config.chatPhrases ?? DEFAULT_CHAT_PHRASES}
                  isRTL={isRTL}
                  onChange={(phrases) => setConfig(prev => ({ ...prev, chatPhrases: phrases }))}
                  onReset={() => setConfig(prev => ({ ...prev, chatPhrases: [...DEFAULT_CHAT_PHRASES] }))}
                />
              )}
            </div>

            {/* ── Rewards & Packs ── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Gift className="w-4 h-4 text-accent" />
                <span className="text-sm font-semibold text-text-primary">
                  {isRTL ? 'פרסים וחבילות' : 'Rewards & Packs'}
                </span>
              </div>
              <ToggleRow
                label={isRTL ? 'הפעל חבילות מתנה' : 'Enable Gift Packs'}
                checked={config.rewards?.enablePacks ?? true}
                onChange={(v) => setConfig(prev => ({
                  ...prev,
                  rewards: { ...(prev.rewards ?? DEFAULT_REWARDS_CONFIG), enablePacks: v },
                }))}
              />
              {(config.rewards?.enablePacks ?? true) && (
                <>
                  {/* Points per pack */}
                  <SettingRow label={isRTL ? 'נקודות לחבילה' : 'Points per pack'}>
                    <SettingButtons
                      values={[10, 15, 20, 30]}
                      current={config.rewards?.pointsPerPack ?? 15}
                      onChange={(n) => setConfig(prev => ({
                        ...prev,
                        rewards: { ...(prev.rewards ?? DEFAULT_REWARDS_CONFIG), pointsPerPack: n },
                      }))}
                    />
                  </SettingRow>

                  {/* Custom Prizes */}
                  <CustomPrizesEditor
                    prizes={config.rewards?.customPrizes ?? []}
                    isRTL={isRTL}
                    onChange={(prizes) => setConfig(prev => ({
                      ...prev,
                      rewards: { ...(prev.rewards ?? DEFAULT_REWARDS_CONFIG), customPrizes: prizes },
                    }))}
                  />
                </>
              )}
            </div>

            {/* ── Auto-Reset Schedule (edit mode only) ── */}
            {isEditing && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-accent" />
                  <span className="text-sm font-semibold text-text-primary">
                    {isRTL ? 'איפוס אוטומטי' : 'Auto-Reset Schedule'}
                  </span>
                </div>
                <ToggleRow
                  label={isRTL ? 'איפוס מתוזמן' : 'Scheduled Reset'}
                  checked={config.autoReset?.enabled ?? false}
                  onChange={(v) => setConfig(prev => ({
                    ...prev,
                    autoReset: { enabled: v, slots: prev.autoReset?.slots ?? [] },
                  }))}
                />
                {config.autoReset?.enabled && (
                  <AutoResetSlotEditor
                    slots={config.autoReset.slots}
                    isRTL={isRTL}
                    onChange={(slots) => setConfig(prev => ({
                      ...prev,
                      autoReset: { ...prev.autoReset!, enabled: true, slots },
                    }))}
                  />
                )}
                {config.autoReset?.enabled && (
                  <p className="text-[11px] text-text-tertiary">
                    {isRTL
                      ? 'כל השחקנים והתוצאות יימחקו אוטומטית בזמנים שנבחרו'
                      : 'All players and results will be automatically deleted at the selected times'}
                  </p>
                )}
              </div>
            )}

            {/* Play / Preview link (edit mode only) */}
            {isEditing && shortId && (
              <div className="space-y-2">
                <a
                  href={`/v/${shortId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-accent bg-accent/10 border border-accent/20 hover:bg-accent/20 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  {isRTL ? 'פתח משחק' : 'Open Game'}
                </a>
                <a
                  href={`/v/${shortId}?display=wide`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                >
                  <Monitor className="w-4 h-4" />
                  {isRTL ? 'מסך תצוגה (טלוויזיה)' : 'Display Screen (TV)'}
                </a>
              </div>
            )}

            {/* Reset (edit mode only) */}
            {isEditing && onReset && !showResetConfirm && (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                {isRTL ? 'אפס את כל הנתונים' : 'Reset All Data'}
              </button>
            )}

            {/* Reset confirmation */}
            {isEditing && onReset && showResetConfirm && (
              <div className="w-full rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2 text-red-400">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <p className="text-sm font-semibold">
                    {isRTL ? 'האם אתה בטוח?' : 'Are you sure?'}
                  </p>
                </div>
                <p className="text-xs text-text-secondary">
                  {isRTL
                    ? 'פעולה זו תמחק את כל השחקנים, התוצאות וההיסטוריה. לא ניתן לבטל פעולה זו.'
                    : 'This will delete all players, results, and history. This action cannot be undone.'}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    disabled={resetting}
                    className="flex-1 py-2 rounded-lg text-sm font-medium text-text-secondary bg-bg-secondary hover:bg-bg-tertiary transition-colors"
                  >
                    {isRTL ? 'ביטול' : 'Cancel'}
                  </button>
                  <button
                    onClick={async () => {
                      setResetting(true);
                      try {
                        await onReset();
                        setShowResetConfirm(false);
                      } finally {
                        setResetting(false);
                      }
                    }}
                    disabled={resetting}
                    className="flex-1 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {resetting ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {isRTL ? 'מוחק...' : 'Deleting...'}
                      </span>
                    ) : (
                      isRTL ? 'מחק הכל' : 'Delete All'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-bg-primary/95 backdrop-blur-sm border-t border-border p-4 shrink-0">
            <button
              onClick={handleSave}
              disabled={loading || config.enabledGames.length === 0}
              className="w-full py-3 rounded-xl font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: `linear-gradient(135deg, ${resolvedTheme.gradientFrom}, ${resolvedTheme.gradientTo})` }}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isRTL ? 'שומר...' : 'Saving...'}
                </span>
              ) : isEditing ? (
                tCommon('save')
              ) : (
                isRTL ? 'צור Q.Games' : 'Create Q.Games'
              )}
            </button>
          </div>
        </div>

        {/* Right: Preview Panel (desktop always, mobile when tab selected) */}
        <div className={`md:flex md:flex-1 items-center justify-center bg-black/20 border-s border-border md:rounded-e-2xl overflow-hidden ${
          mobileTab === 'preview' ? 'flex flex-1' : 'hidden'
        }`}>
          <div className="p-6 w-full flex flex-col items-center">
            <p className="text-text-secondary text-xs font-medium mb-3 uppercase tracking-wider">
              {isRTL ? 'תצוגה מקדימה' : 'Preview'}
            </p>

            {/* Link with copy */}
            {isEditing && shortId && (
              <LinkCopyRow shortId={shortId} isRTL={isRTL} />
            )}

            <QGamesPreviewPhone config={config} isRTL={isRTL} />
          </div>
          {/* Mobile: close + save button */}
          <div className="md:hidden absolute bottom-0 inset-x-0 bg-bg-primary/95 backdrop-blur-sm border-t border-border p-4">
            <button
              onClick={handleSave}
              disabled={loading || config.enabledGames.length === 0}
              className="w-full py-3 rounded-xl font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: `linear-gradient(135deg, ${resolvedTheme.gradientFrom}, ${resolvedTheme.gradientTo})` }}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isRTL ? 'שומר...' : 'Saving...'}
                </span>
              ) : isEditing ? (
                tCommon('save')
              ) : (
                isRTL ? 'צור Q.Games' : 'Create Q.Games'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LinkCopyRow({ shortId, isRTL }: { shortId: string; isRTL: boolean }) {
  const [copied, setCopied] = useState(false);
  const url = `https://qr.playzones.app/v/${shortId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="w-full max-w-[280px] mb-4">
      <button
        onClick={handleCopy}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-border hover:bg-white/10 transition-colors group"
      >
        <span className="flex-1 text-xs text-text-secondary truncate text-start" dir="ltr">
          qr.playzones.app/v/{shortId}
        </span>
        {copied ? (
          <Check className="w-4 h-4 text-green-400 shrink-0" />
        ) : (
          <Copy className="w-4 h-4 text-text-secondary group-hover:text-text-primary transition-colors shrink-0" />
        )}
      </button>
      {copied && (
        <p className="text-[10px] text-green-400 text-center mt-1">
          {isRTL ? 'הועתק!' : 'Copied!'}
        </p>
      )}
    </div>
  );
}

const DAY_LABELS_HE = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const DAY_LABELS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function AutoResetSlotEditor({
  slots,
  isRTL,
  onChange,
}: {
  slots: QGamesScheduleSlot[];
  isRTL: boolean;
  onChange: (slots: QGamesScheduleSlot[]) => void;
}) {
  const dayLabels = isRTL ? DAY_LABELS_HE : DAY_LABELS_EN;

  const addSlot = () => {
    if (slots.length >= 7) return;
    onChange([...slots, { dayOfWeek: -1, hour: 0, minute: 0 }]);
  };

  const removeSlot = (index: number) => {
    onChange(slots.filter((_, i) => i !== index));
  };

  const updateSlot = (index: number, updates: Partial<QGamesScheduleSlot>) => {
    onChange(slots.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  return (
    <div className="space-y-2">
      {slots.map((slot, index) => (
        <div key={index} className="flex items-center gap-2 bg-bg-secondary rounded-lg p-2">
          {/* Day picker */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-1 mb-1.5">
              <button
                onClick={() => updateSlot(index, { dayOfWeek: -1 })}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  slot.dayOfWeek === -1
                    ? 'bg-accent text-white'
                    : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                }`}
              >
                {isRTL ? 'יומי' : 'Daily'}
              </button>
              {dayLabels.map((label, day) => (
                <button
                  key={day}
                  onClick={() => updateSlot(index, { dayOfWeek: day })}
                  className={`w-7 h-6 rounded text-[11px] font-medium transition-colors ${
                    slot.dayOfWeek === day
                      ? 'bg-accent text-white'
                      : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Time picker */}
            <input
              type="time"
              value={`${String(slot.hour).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number);
                updateSlot(index, { hour: h, minute: m });
              }}
              className="w-full bg-bg-tertiary text-text-primary text-sm rounded-lg px-2 py-1 border border-border focus:outline-none focus:border-accent"
            />
          </div>
          {/* Delete button */}
          <button
            onClick={() => removeSlot(index)}
            className="p-1.5 rounded-lg text-text-tertiary hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      {slots.length < 7 && (
        <button
          onClick={addSlot}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-accent bg-accent/10 hover:bg-accent/20 transition-colors border border-dashed border-accent/30"
        >
          <Plus className="w-3.5 h-3.5" />
          {isRTL ? 'הוסף שעה' : 'Add time slot'}
        </button>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-text-primary">{label}</span>
      <button
        dir="ltr"
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${
          checked ? 'bg-accent' : 'bg-bg-secondary'
        }`}
      >
        <div
          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

// ── Chat Phrases Editor ──

function ChatPhrasesEditor({
  phrases,
  isRTL,
  onChange,
  onReset,
}: {
  phrases: QGamesChatPhrase[];
  isRTL: boolean;
  onChange: (phrases: QGamesChatPhrase[]) => void;
  onReset: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [addMode, setAddMode] = useState(false);
  const [addText, setAddText] = useState('');
  const [addEmoji, setAddEmoji] = useState('');
  const [addType, setAddType] = useState<'text' | 'emoji'>('text');

  const textPhrases = phrases.filter(p => p.type === 'text');
  const emojiPhrases = phrases.filter(p => p.type === 'emoji');

  const handleDelete = (id: string) => {
    onChange(phrases.filter(p => p.id !== id));
  };

  const handleSaveEdit = (id: string) => {
    onChange(phrases.map(p =>
      p.id === id ? (() => { const updated = { ...p, text: editText.trim() }; if (editEmoji) { updated.emoji = editEmoji; } else { delete updated.emoji; } return updated; })() : p
    ));
    setEditingId(null);
  };

  const handleAdd = () => {
    if (addType === 'emoji' && !addText.trim()) return;
    if (addType === 'text' && !addText.trim()) return;
    if (phrases.length >= 40) return;

    const newPhrase: QGamesChatPhrase = {
      id: `custom_${Date.now()}`,
      text: addText.trim(),
      type: addType,
    };
    if (addType === 'text' && addEmoji) newPhrase.emoji = addEmoji;
    onChange([...phrases, newPhrase]);
    setAddText('');
    setAddEmoji('');
    setAddMode(false);
  };

  return (
    <div className="space-y-3">
      {/* Text phrases list */}
      <div>
        <span className="text-xs text-text-secondary mb-1.5 block">
          {isRTL ? `בועות טקסט (${textPhrases.length})` : `Text bubbles (${textPhrases.length})`}
        </span>
        <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto">
          {textPhrases.map((phrase) => (
            <div key={phrase.id} className="group relative">
              {editingId === phrase.id ? (
                <div className="flex items-center gap-1 bg-bg-secondary rounded-full px-2 py-1">
                  <input
                    value={editEmoji}
                    onChange={(e) => setEditEmoji(e.target.value)}
                    className="w-8 text-center bg-transparent text-sm outline-none"
                    placeholder="😀"
                    maxLength={2}
                  />
                  <input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-24 bg-transparent text-sm text-text-primary outline-none"
                    dir={isRTL ? 'rtl' : 'ltr'}
                    maxLength={30}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit(phrase.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <button
                    onClick={() => handleSaveEdit(phrase.id)}
                    className="text-accent text-xs font-medium"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditingId(phrase.id);
                    setEditText(phrase.text);
                    setEditEmoji(phrase.emoji || '');
                  }}
                  className="px-2.5 py-1 rounded-full text-xs bg-bg-secondary text-text-primary hover:bg-bg-tertiary transition-colors"
                >
                  {phrase.emoji && <span className="me-0.5">{phrase.emoji}</span>}
                  {phrase.text}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(phrase.id); }}
                    className="ms-1 opacity-0 group-hover:opacity-100 text-red-400 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3 inline" />
                  </button>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Emoji reactions list */}
      <div>
        <span className="text-xs text-text-secondary mb-1.5 block">
          {isRTL ? `אימוג\'י מהירים (${emojiPhrases.length})` : `Quick emojis (${emojiPhrases.length})`}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {emojiPhrases.map((phrase) => (
            <div key={phrase.id} className="group relative">
              <span className="text-lg cursor-default">{phrase.text}</span>
              <button
                onClick={() => handleDelete(phrase.id)}
                className="absolute -top-1 -end-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <X className="w-2 h-2" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Add phrase */}
      {addMode ? (
        <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-bg-secondary">
          <div className="flex gap-2">
            <button
              onClick={() => setAddType('text')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${addType === 'text' ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-secondary'}`}
            >
              {isRTL ? 'טקסט' : 'Text'}
            </button>
            <button
              onClick={() => setAddType('emoji')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${addType === 'emoji' ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-secondary'}`}
            >
              {isRTL ? 'אימוג\'י' : 'Emoji'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            {addType === 'text' && (
              <input
                value={addEmoji}
                onChange={(e) => setAddEmoji(e.target.value)}
                className="w-10 text-center bg-bg-tertiary rounded-lg py-1.5 text-sm outline-none"
                placeholder="😀"
                maxLength={2}
              />
            )}
            <input
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              className="flex-1 bg-bg-tertiary rounded-lg px-3 py-1.5 text-sm text-text-primary outline-none"
              dir={isRTL ? 'rtl' : 'ltr'}
              placeholder={addType === 'emoji' ? '😎' : (isRTL ? 'טקסט הבועה...' : 'Bubble text...')}
              maxLength={addType === 'emoji' ? 2 : 30}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              autoFocus
            />
            <button
              onClick={handleAdd}
              disabled={!addText.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-white disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={() => { setAddMode(false); setAddText(''); setAddEmoji(''); }}
            className="text-xs text-text-secondary hover:text-text-primary"
          >
            {isRTL ? 'ביטול' : 'Cancel'}
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          {phrases.length < 40 && (
            <button
              onClick={() => setAddMode(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-accent bg-accent/10 hover:bg-accent/20 transition-colors"
            >
              <Plus className="w-3 h-3" />
              {isRTL ? 'הוסיפו בועה' : 'Add bubble'}
            </button>
          )}
          <button
            onClick={onReset}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary bg-bg-secondary hover:bg-bg-tertiary transition-colors"
          >
            <RotateCw className="w-3 h-3" />
            {isRTL ? 'ברירת מחדל' : 'Reset defaults'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Color Swatch with native picker ──

function ColorSwatch({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={() => ref.current?.click()}
        className="w-8 h-8 rounded-full border-2 border-border/50 cursor-pointer hover:scale-110 transition-transform shadow-sm"
        style={{ backgroundColor: value }}
      >
        <input ref={ref} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="sr-only" />
      </button>
      <span className="text-[9px] text-text-secondary">{label}</span>
    </div>
  );
}

// ── Game Settings helpers ──

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-text-secondary">{label}</span>
      {children}
    </div>
  );
}

function SettingButtons({ values, current, onChange, suffix }: { values: number[]; current: number; onChange: (n: number) => void; suffix?: string }) {
  return (
    <div className="flex items-center gap-2">
      {values.map(n => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
            current === n
              ? 'bg-accent text-white'
              : 'bg-bg-primary text-text-secondary hover:text-text-primary'
          }`}
        >
          {n}{suffix || ''}
        </button>
      ))}
    </div>
  );
}

// ── Custom Prizes Editor ──

function CustomPrizesEditor({
  prizes,
  isRTL,
  onChange,
}: {
  prizes: QGamesCustomPrize[];
  isRTL: boolean;
  onChange: (prizes: QGamesCustomPrize[]) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStock, setNewStock] = useState(10);
  const [newDrop, setNewDrop] = useState(5);

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const prize: QGamesCustomPrize = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      totalStock: newStock,
      claimed: 0,
      dropChance: newDrop,
    };
    onChange([...prizes, prize]);
    setNewName('');
    setNewStock(10);
    setNewDrop(5);
    setShowAdd(false);
  };

  const handleDelete = (id: string) => {
    onChange(prizes.filter(p => p.id !== id));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-secondary">
          {isRTL ? 'פרסים מותאמים' : 'Custom Prizes'}
        </span>
        <span className="text-[10px] text-text-tertiary">
          {isRTL ? `${prizes.length} פרסים` : `${prizes.length} prizes`}
        </span>
      </div>

      {/* Existing prizes list */}
      {prizes.map((prize) => (
        <div
          key={prize.id}
          className="flex items-center gap-2 p-2.5 rounded-xl bg-bg-primary border border-border/50"
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-text-primary truncate">{prize.name}</div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[10px] text-text-tertiary">
                {isRTL ? `מלאי: ${prize.claimed}/${prize.totalStock}` : `Stock: ${prize.claimed}/${prize.totalStock}`}
              </span>
              <span className="text-[10px] text-text-tertiary">
                {isRTL ? `סיכוי: ${prize.dropChance}%` : `Drop: ${prize.dropChance}%`}
              </span>
            </div>
          </div>
          <button
            onClick={() => handleDelete(prize.id)}
            className="shrink-0 p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {/* Add form */}
      {showAdd ? (
        <div className="p-3 rounded-xl bg-bg-primary border border-accent/30 space-y-2.5">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={isRTL ? 'שם הפרס' : 'Prize name'}
            className="w-full px-3 py-2 rounded-lg bg-bg-secondary border border-border text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent"
            dir="auto"
          />
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-[10px] text-text-tertiary mb-0.5 block">
                {isRTL ? 'מלאי' : 'Stock'}
              </label>
              <input
                type="number"
                min={1}
                max={9999}
                value={newStock}
                onChange={(e) => setNewStock(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-bg-secondary border border-border text-sm text-text-primary outline-none focus:border-accent text-center"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-text-tertiary mb-0.5 block">
                {isRTL ? 'סיכוי %' : 'Drop %'}
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={newDrop}
                onChange={(e) => setNewDrop(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-bg-secondary border border-border text-sm text-text-primary outline-none focus:border-accent text-center"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-white bg-accent hover:bg-accent/90 transition-colors disabled:opacity-40"
            >
              <Check className="w-3.5 h-3.5" />
              {isRTL ? 'הוסף' : 'Add'}
            </button>
            <button
              onClick={() => { setShowAdd(false); setNewName(''); }}
              className="flex-1 py-2 rounded-lg text-xs font-medium text-text-secondary bg-bg-secondary hover:bg-bg-primary transition-colors"
            >
              {isRTL ? 'ביטול' : 'Cancel'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-accent bg-accent/10 hover:bg-accent/20 transition-colors border border-dashed border-accent/30"
        >
          <Plus className="w-3.5 h-3.5" />
          {isRTL ? 'הוסף פרס' : 'Add prize'}
        </button>
      )}
    </div>
  );
}
