'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Gift, Sparkles } from 'lucide-react';
import { QGamesInventoryItem, RARITY_CONFIG, QGamesPrizeRarity } from '@/types/qgames';
import { useQGamesTheme } from './QGamesThemeContext';

interface QGamesPackOpeningProps {
  isOpen: boolean;
  onClose: () => void;
  onPrizeReceived: (prize: QGamesInventoryItem, remainingPacks: number) => void;
  codeId: string;
  playerId: string;
  locale?: 'he' | 'en';
}

type Phase = 'idle' | 'shaking' | 'opening' | 'revealing' | 'complete' | 'error';

const translations = {
  he: {
    tapToOpen: 'הקישו לפתיחה!',
    opening: 'פותח...',
    congratulations: 'מזל טוב!',
    youWon: 'זכית ב:',
    equipNow: 'לבוש עכשיו',
    later: 'סגור',
    error: 'שגיאה בפתיחת החבילה',
    tryAgain: 'נסו שוב',
    newPack: 'חבילה חדשה!',
    customPrize: 'פרס אמיתי!',
  },
  en: {
    tapToOpen: 'Tap to open!',
    opening: 'Opening...',
    congratulations: 'Congratulations!',
    youWon: 'You won:',
    equipNow: 'Equip Now',
    later: 'Close',
    error: 'Error opening pack',
    tryAgain: 'Try Again',
    newPack: 'New Pack!',
    customPrize: 'Real Prize!',
  },
};

function RarityGlow({ rarity, children }: { rarity: QGamesPrizeRarity; children: React.ReactNode }) {
  const config = RARITY_CONFIG[rarity];
  return (
    <div className="relative">
      <div
        className="absolute -inset-3 rounded-2xl blur-lg opacity-50"
        style={{ backgroundColor: config.color }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

export default function QGamesPackOpening({
  isOpen,
  onClose,
  onPrizeReceived,
  codeId,
  playerId,
  locale = 'he',
}: QGamesPackOpeningProps) {
  const theme = useQGamesTheme();
  const t = translations[locale];
  const isRTL = locale === 'he';

  const [phase, setPhase] = useState<Phase>('idle');
  const [prize, setPrize] = useState<QGamesInventoryItem | null>(null);
  const [isCustomPrize, setIsCustomPrize] = useState(false);
  const [remainingPacks, setRemainingPacks] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setPhase('idle');
      setPrize(null);
      setIsCustomPrize(false);
      setError(null);
    }
  }, [isOpen]);

  const handleOpen = useCallback(async () => {
    if (phase !== 'idle') return;

    setPhase('shaking');
    await new Promise(r => setTimeout(r, 800));
    setPhase('opening');

    try {
      const res = await fetch('/api/qgames/pack/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId, playerId }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed');

      setPrize(data.prize);
      setIsCustomPrize(data.isCustomPrize || false);
      setRemainingPacks(data.remainingPacks || 0);
      setPhase('revealing');

      await new Promise(r => setTimeout(r, 1500));
      setPhase('complete');
    } catch (err) {
      console.error('Pack open error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPhase('error');
    }
  }, [phase, codeId, playerId]);

  const handleEquip = async () => {
    if (!prize) return;
    try {
      await fetch('/api/qgames/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId, playerId, prizeId: prize.prizeId, action: 'equip' }),
      });
    } catch (err) {
      console.error('Equip error:', err);
    }
    onPrizeReceived(prize, remainingPacks);
    onClose();
  };

  const handleClose = () => {
    if (prize) {
      onPrizeReceived(prize, remainingPacks);
    }
    onClose();
  };

  if (!isOpen) return null;

  const rarityConfig = prize ? RARITY_CONFIG[prize.rarity] : null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{ backgroundColor: `${theme.backgroundColor}f5` }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Close button - only before opening */}
      {phase === 'idle' && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full transition-colors"
          style={{ backgroundColor: `${theme.textColor}15` }}
        >
          <X className="w-6 h-6" style={{ color: theme.textColor }} />
        </button>
      )}

      <div className="text-center px-6 w-full max-w-sm">
        {/* Badge */}
        {phase === 'idle' && (
          <div className="mb-6 animate-bounce">
            <span
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
              style={{
                backgroundColor: `${theme.accentColor}20`,
                color: theme.accentColor,
              }}
            >
              <Sparkles className="w-4 h-4" />
              {t.newPack}
            </span>
          </div>
        )}

        {/* Pack visual */}
        {(phase === 'idle' || phase === 'shaking' || phase === 'opening') && (
          <div
            className={`
              relative w-48 h-64 mx-auto cursor-pointer
              ${phase === 'shaking' ? 'animate-shake' : ''}
              ${phase === 'opening' ? 'animate-pack-open' : ''}
              ${phase === 'idle' ? 'hover:scale-105 transition-transform' : ''}
            `}
            onClick={handleOpen}
          >
            <div
              className="absolute inset-0 rounded-2xl shadow-2xl"
              style={{
                background: `linear-gradient(135deg, ${theme.accentColor}, ${theme.primaryColor || '#8B5CF6'})`,
                boxShadow: `0 20px 60px ${theme.accentColor}40`,
              }}
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-transparent to-white/20" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Gift className="w-20 h-20 text-white/90" />
              </div>
              <div className="absolute -top-2 -right-2 text-2xl animate-pulse">✨</div>
              <div className="absolute -bottom-2 -left-2 text-2xl animate-pulse" style={{ animationDelay: '0.5s' }}>✨</div>
              <div className="absolute top-1/4 -left-3 text-xl animate-pulse" style={{ animationDelay: '0.3s' }}>⭐</div>
              <div className="absolute bottom-1/4 -right-3 text-xl animate-pulse" style={{ animationDelay: '0.7s' }}>⭐</div>
            </div>
          </div>
        )}

        {/* Tap instruction */}
        {phase === 'idle' && (
          <p className="mt-8 text-lg animate-pulse" style={{ color: `${theme.textColor}cc` }}>
            {t.tapToOpen}
          </p>
        )}

        {/* Opening text */}
        {phase === 'opening' && (
          <p className="mt-8 text-lg" style={{ color: theme.accentColor }}>
            {t.opening}
          </p>
        )}

        {/* Prize reveal */}
        {(phase === 'revealing' || phase === 'complete') && prize && rarityConfig && (
          <div className="animate-scale-in">
            <h2 className="text-3xl font-bold mb-2" style={{ color: theme.textColor }}>
              {t.congratulations}
            </h2>
            <p className="text-lg mb-6" style={{ color: theme.textSecondary }}>
              {isCustomPrize ? t.customPrize : t.youWon}
            </p>

            {/* Prize card */}
            <RarityGlow rarity={prize.rarity}>
              <div
                className="p-6 rounded-2xl border"
                style={{
                  backgroundColor: `${rarityConfig.color}15`,
                  borderColor: `${rarityConfig.color}40`,
                }}
              >
                {/* Rarity label */}
                <span
                  className="inline-block px-3 py-0.5 rounded-full text-xs font-bold mb-3"
                  style={{
                    backgroundColor: `${rarityConfig.color}30`,
                    color: rarityConfig.color,
                  }}
                >
                  {rarityConfig.emoji} {locale === 'he' ? rarityConfig.nameHe : rarityConfig.nameEn}
                </span>

                {/* Prize name */}
                <h3
                  className="text-2xl font-bold"
                  style={{ color: rarityConfig.color }}
                >
                  {locale === 'he' ? prize.nameHe : prize.nameEn}
                </h3>

                {/* Prize type icon */}
                <div className="mt-3 text-4xl">
                  {prize.type === 'avatar_border' && '🔲'}
                  {prize.type === 'title' && '🏷️'}
                  {prize.type === 'celebration' && '🎉'}
                </div>
              </div>
            </RarityGlow>

            {/* Action buttons */}
            {phase === 'complete' && (
              <div className="flex gap-3 mt-8 justify-center">
                {!isCustomPrize && (
                  <button
                    onClick={handleEquip}
                    className="px-6 py-3 rounded-full font-bold text-white transition-all active:scale-95"
                    style={{
                      background: `linear-gradient(135deg, ${theme.accentColor}, ${theme.primaryColor || '#8B5CF6'})`,
                      boxShadow: `0 4px 15px ${theme.accentColor}40`,
                    }}
                  >
                    {t.equipNow}
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className="px-6 py-3 rounded-full font-bold transition-all active:scale-95"
                  style={{
                    backgroundColor: `${theme.textColor}15`,
                    color: theme.textColor,
                  }}
                >
                  {t.later}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div className="animate-scale-in">
            <p className="text-xl mb-4" style={{ color: '#EF4444' }}>
              {t.error}
            </p>
            <button
              onClick={() => setPhase('idle')}
              className="px-6 py-3 rounded-full font-bold transition-all active:scale-95"
              style={{
                backgroundColor: `${theme.textColor}15`,
                color: theme.textColor,
              }}
            >
              {t.tryAgain}
            </button>
          </div>
        )}
      </div>

      {/* Reveal particles */}
      {(phase === 'revealing' || phase === 'complete') && prize && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                left: `${50 + (Math.random() - 0.5) * 60}%`,
                top: '50%',
                backgroundColor: RARITY_CONFIG[prize.rarity].color,
                animation: `pack-particle ${1 + Math.random() * 1.5}s ease-out ${Math.random() * 0.3}s forwards`,
              }}
            />
          ))}
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-5deg); }
          75% { transform: rotate(5deg); }
        }
        .animate-shake {
          animation: shake 0.15s ease-in-out infinite;
        }
        @keyframes pack-open {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.8; }
          100% { transform: scale(0); opacity: 0; }
        }
        .animate-pack-open {
          animation: pack-open 0.6s ease-in forwards;
        }
        @keyframes scale-in {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in {
          animation: scale-in 0.5s ease-out forwards;
        }
        @keyframes pack-particle {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(${Math.random() > 0.5 ? '' : '-'}${60 + Math.random() * 80}px, ${-80 - Math.random() * 120}px) scale(0); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
