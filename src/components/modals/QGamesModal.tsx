'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { X, Gamepad2, Loader2, RotateCcw, ExternalLink, Monitor, Eye, Settings, Copy, Check } from 'lucide-react';
import {
  QGamesConfig,
  QGameType,
  QGamesThemeId,
  DEFAULT_QGAMES_CONFIG,
  DEFAULT_QGAMES_BRANDING,
  GAME_META,
  QGAMES_THEMES,
  resolveTheme,
} from '@/types/qgames';
import QGamesPreviewPhone from '@/components/qgames/QGamesPreviewPhone';

interface QGamesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: QGamesConfig) => Promise<void>;
  loading?: boolean;
  initialConfig?: QGamesConfig;
  codeId?: string;
  shortId?: string;
  onReset?: () => void;
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

  const prevIsOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setConfig(initialConfig || { ...DEFAULT_QGAMES_CONFIG, branding: { ...DEFAULT_QGAMES_BRANDING } });
      setMobileTab('settings');
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
    await onSave(config);
  };

  const currentThemeId = config.branding.theme || 'dark-gaming';
  const resolvedTheme = resolveTheme(config.branding);

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
            </div>

            {/* Games Selection */}
            <div>
              <label className="text-sm font-medium text-text-primary mb-2 block">
                {isRTL ? 'משחקים זמינים' : 'Available Games'}
              </label>
              <div className="space-y-2">
                {(['rps', 'oddoneout', 'tictactoe', 'memory'] as QGameType[]).map((gameType) => {
                  const meta = GAME_META[gameType];
                  const isEnabled = config.enabledGames.includes(gameType);
                  const isAvailable = gameType === 'rps' || gameType === 'oddoneout' || gameType === 'tictactoe' || gameType === 'memory';

                  const nameMap: Record<string, { he: string; en: string }> = {
                    rps: { he: 'אבן נייר ומספריים', en: 'Rock Paper Scissors' },
                    oddoneout: { he: 'משלוש יוצא א....חד!', en: 'Odd One Out' },
                    tictactoe: { he: 'איקס עיגול', en: 'Tic-Tac-Toe' },
                    memory: { he: 'זיכרון', en: 'Memory Challenge' },
                  };
                  const descMap: Record<string, { he: string; en: string }> = {
                    oddoneout: { he: '3 שחקנים · כף או אגרוף', en: '3 players · Palm or Fist' },
                    tictactoe: { he: '2 שחקנים · 3 ברצף', en: '2 players · 3 in a row' },
                    memory: { he: '2-6 שחקנים · זכרו את הסדר', en: '2-6 players · Remember the sequence' },
                  };

                  return (
                    <button
                      key={gameType}
                      onClick={() => isAvailable && toggleGame(gameType)}
                      disabled={!isAvailable}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-start ${
                        isEnabled
                          ? 'bg-accent/10 border-accent/30'
                          : isAvailable
                            ? 'bg-bg-secondary border-border hover:border-accent/20'
                            : 'bg-bg-secondary/50 border-border opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <span className="text-2xl">{meta.emoji}</span>
                      <div className="flex-1">
                        <p className="font-medium text-text-primary text-sm">
                          {nameMap[gameType]?.[isRTL ? 'he' : 'en'] || gameType}
                        </p>
                        {descMap[gameType] && isAvailable && (
                          <p className="text-xs text-text-secondary">{descMap[gameType][isRTL ? 'he' : 'en']}</p>
                        )}
                        {!isAvailable && (
                          <p className="text-xs text-text-secondary">{isRTL ? 'בקרוב' : 'Coming soon'}</p>
                        )}
                      </div>
                      {isAvailable && (
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isEnabled ? 'bg-accent border-accent' : 'border-border'
                        }`}>
                          {isEnabled && <span className="text-white text-xs">✓</span>}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* RPS Settings */}
            {config.enabledGames.includes('rps') && (
              <div>
                <label className="text-sm font-medium text-text-primary mb-2 block">
                  {isRTL ? 'הגדרות אבן נייר ומספריים' : 'Rock Paper Scissors Settings'}
                </label>
                <div className="bg-bg-secondary rounded-xl p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">{isRTL ? 'ראשון ל-' : 'First to'}</span>
                    <div className="flex items-center gap-2">
                      {[3, 5].map(n => (
                        <button
                          key={n}
                          onClick={() => setConfig(prev => ({ ...prev, rpsFirstTo: n }))}
                          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                            config.rpsFirstTo === n
                              ? 'bg-accent text-white'
                              : 'bg-bg-primary text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">{isRTL ? 'טיימר סיבוב ראשון' : 'First round timer'}</span>
                    <span className="text-sm text-text-primary font-mono">{config.rpsFirstRoundTimer}s</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">{isRTL ? 'טיימר סיבובים הבאים' : 'Subsequent timer'}</span>
                    <span className="text-sm text-text-primary font-mono">{config.rpsSubsequentTimer}s</span>
                  </div>
                </div>
              </div>
            )}

            {/* OOO Settings */}
            {config.enabledGames.includes('oddoneout') && (
              <div>
                <label className="text-sm font-medium text-text-primary mb-2 block">
                  {isRTL ? 'הגדרות משלוש יוצא אחד' : 'Odd One Out Settings'}
                </label>
                <div className="bg-bg-secondary rounded-xl p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">{isRTL ? 'סטרייקים להפסד' : 'Strikes to lose'}</span>
                    <div className="flex items-center gap-2">
                      {[3, 5].map(n => (
                        <button
                          key={n}
                          onClick={() => setConfig(prev => ({ ...prev, oooMaxStrikes: n }))}
                          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                            config.oooMaxStrikes === n
                              ? 'bg-accent text-white'
                              : 'bg-bg-primary text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">{isRTL ? 'טיימר סיבוב ראשון' : 'First round timer'}</span>
                    <span className="text-sm text-text-primary font-mono">{config.oooFirstRoundTimer}s</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">{isRTL ? 'טיימר סיבובים הבאים' : 'Subsequent timer'}</span>
                    <span className="text-sm text-text-primary font-mono">{config.oooSubsequentTimer}s</span>
                  </div>
                </div>
              </div>
            )}

            {/* TTT Settings */}
            {config.enabledGames.includes('tictactoe') && (
              <div>
                <label className="text-sm font-medium text-text-primary mb-2 block">
                  {isRTL ? 'הגדרות איקס עיגול' : 'Tic-Tac-Toe Settings'}
                </label>
                <div className="bg-bg-secondary rounded-xl p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">{isRTL ? 'ראשון ל-' : 'First to'}</span>
                    <div className="flex items-center gap-2">
                      {[3, 5].map(n => (
                        <button
                          key={n}
                          onClick={() => setConfig(prev => ({ ...prev, tttFirstTo: n }))}
                          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                            config.tttFirstTo === n
                              ? 'bg-accent text-white'
                              : 'bg-bg-primary text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">{isRTL ? 'טיימר לתור' : 'Turn timer'}</span>
                    <div className="flex items-center gap-2">
                      {[10, 15, 20].map(n => (
                        <button
                          key={n}
                          onClick={() => setConfig(prev => ({ ...prev, tttTurnTimer: n }))}
                          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                            config.tttTurnTimer === n
                              ? 'bg-accent text-white'
                              : 'bg-bg-primary text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          {n}s
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Memory Settings */}
            {config.enabledGames.includes('memory') && (
              <div>
                <label className="text-sm font-medium text-text-primary mb-2 block">
                  {isRTL ? 'הגדרות זיכרון' : 'Memory Settings'}
                </label>
                <div className="bg-bg-secondary rounded-xl p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">{isRTL ? 'טיימר לזכירה' : 'Memorize timer'}</span>
                    <div className="flex items-center gap-2">
                      {[3, 5].map(n => (
                        <button
                          key={n}
                          onClick={() => setConfig(prev => ({ ...prev, memoryMemorizeTimer: n }))}
                          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                            config.memoryMemorizeTimer === n
                              ? 'bg-accent text-white'
                              : 'bg-bg-primary text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          {n}s
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">{isRTL ? 'טיימר לבחירה' : 'Recall timer'}</span>
                    <div className="flex items-center gap-2">
                      {[10, 15].map(n => (
                        <button
                          key={n}
                          onClick={() => setConfig(prev => ({ ...prev, memoryRecallTimer: n }))}
                          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                            config.memoryRecallTimer === n
                              ? 'bg-accent text-white'
                              : 'bg-bg-primary text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          {n}s
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">{isRTL ? 'פסילות להדחה' : 'Strikes to eliminate'}</span>
                    <div className="flex items-center gap-2">
                      {[3, 5].map(n => (
                        <button
                          key={n}
                          onClick={() => setConfig(prev => ({ ...prev, memoryMaxStrikes: n }))}
                          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                            config.memoryMaxStrikes === n
                              ? 'bg-accent text-white'
                              : 'bg-bg-primary text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

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
            {isEditing && onReset && (
              <button
                onClick={onReset}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                {isRTL ? 'אפס את כל הנתונים' : 'Reset All Data'}
              </button>
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
