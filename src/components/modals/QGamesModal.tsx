'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { X, Gamepad2, Loader2, RotateCcw } from 'lucide-react';
import {
  QGamesConfig,
  QGameType,
  DEFAULT_QGAMES_CONFIG,
  DEFAULT_QGAMES_BRANDING,
  GAME_META,
} from '@/types/qgames';

interface QGamesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: QGamesConfig) => Promise<void>;
  loading?: boolean;
  initialConfig?: QGamesConfig;
  codeId?: string;
  onReset?: () => void;
}

export default function QGamesModal({
  isOpen,
  onClose,
  onSave,
  loading,
  initialConfig,
  codeId,
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

  const prevIsOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setConfig(initialConfig || { ...DEFAULT_QGAMES_CONFIG, branding: { ...DEFAULT_QGAMES_BRANDING } });
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialConfig]);

  if (!isOpen) return null;

  const toggleGame = (gameType: QGameType) => {
    setConfig(prev => {
      const games = prev.enabledGames.includes(gameType)
        ? prev.enabledGames.filter(g => g !== gameType)
        : [...prev.enabledGames, gameType];
      // Must have at least 1 game
      if (games.length === 0) return prev;
      return { ...prev, enabledGames: games };
    });
  };

  const handleSave = async () => {
    await onSave(config);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md max-h-[85vh] overflow-y-auto bg-bg-primary border border-border rounded-2xl shadow-2xl"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="sticky top-0 bg-bg-primary/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between z-10">
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

        <div className="p-4 space-y-5">
          {/* Games Selection */}
          <div>
            <label className="text-sm font-medium text-text-primary mb-2 block">
              {isRTL ? 'משחקים זמינים' : 'Available Games'}
            </label>
            <div className="space-y-2">
              {(['rps', 'tictactoe', 'memory'] as QGameType[]).map((gameType) => {
                const meta = GAME_META[gameType];
                const isEnabled = config.enabledGames.includes(gameType);
                const isAvailable = gameType === 'rps'; // Only RPS for now

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
                        {isRTL
                          ? (gameType === 'rps' ? 'אבן נייר ומספריים' : gameType === 'tictactoe' ? 'איקס מיקס דריקס' : 'זיכרון')
                          : (gameType === 'rps' ? 'Rock Paper Scissors' : gameType === 'tictactoe' ? 'Tic-Tac-Toe' : 'Memory Match')
                        }
                      </p>
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
        <div className="sticky bottom-0 bg-bg-primary/95 backdrop-blur-sm border-t border-border p-4">
          <button
            onClick={handleSave}
            disabled={loading || config.enabledGames.length === 0}
            className="w-full py-3 rounded-xl font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}
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
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors ${
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
