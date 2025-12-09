'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Gift, Sparkles } from 'lucide-react';
import { PendingPack, PackOpening, RARITY_CONFIG, PrizeRarity } from '@/types';
import { claimPrize } from '@/lib/lottery';

interface PackOpeningModalProps {
  pendingPack: PendingPack;
  isOpen: boolean;
  onClose: () => void;
  onOpened: (opening: PackOpening) => void;
  locale?: 'he' | 'en';
}

const translations = {
  he: {
    tapToOpen: 'הקש לפתיחה!',
    opening: 'פותח...',
    congratulations: 'מזל טוב!',
    youWon: 'זכית ב:',
    claimPrize: 'קבל פרס',
    error: 'שגיאה בפתיחת החבילה',
    tryAgain: 'נסה שוב',
    levelUp: 'עלית רמה!',
    routeComplete: 'השלמת את המסלול!',
  },
  en: {
    tapToOpen: 'Tap to open!',
    opening: 'Opening...',
    congratulations: 'Congratulations!',
    youWon: 'You won:',
    claimPrize: 'Claim Prize',
    error: 'Error opening pack',
    tryAgain: 'Try Again',
    levelUp: 'Level Up!',
    routeComplete: 'Route Complete!',
  },
};

type Phase = 'idle' | 'shaking' | 'opening' | 'revealing' | 'complete' | 'error';

export default function PackOpeningModal({
  pendingPack,
  isOpen,
  onClose,
  onOpened,
  locale = 'he',
}: PackOpeningModalProps) {
  const t = translations[locale];
  const isRTL = locale === 'he';

  const [phase, setPhase] = useState<Phase>('idle');
  const [opening, setOpening] = useState<PackOpening | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPhase('idle');
      setOpening(null);
      setError(null);
    }
  }, [isOpen]);

  const handleOpen = useCallback(async () => {
    if (phase !== 'idle') return;

    setPhase('shaking');

    // Shake animation for 1 second
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setPhase('opening');

    try {
      const result = await claimPrize(pendingPack.visitorId, pendingPack.id);

      if (!result) {
        throw new Error('No prize available');
      }

      setOpening(result);
      setPhase('revealing');

      // Reveal animation for 1.5 seconds
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setPhase('complete');
    } catch (err) {
      console.error('Error opening pack:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPhase('error');
    }
  }, [phase, pendingPack]);

  const handleComplete = () => {
    if (opening) {
      onOpened(opening);
    }
    onClose();
  };

  if (!isOpen) return null;

  const reasonText = pendingPack.reason === 'level_up' ? t.levelUp : t.routeComplete;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Close button - only show before opening */}
      {phase === 'idle' && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Content */}
      <div className="text-center px-6">
        {/* Reason badge */}
        {phase === 'idle' && (
          <div className="mb-6 animate-bounce">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/20 text-purple-300 text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              {reasonText}
            </span>
          </div>
        )}

        {/* Pack */}
        {(phase === 'idle' || phase === 'shaking' || phase === 'opening') && (
          <div
            className={`
              relative w-48 h-64 mx-auto cursor-pointer
              ${phase === 'shaking' ? 'animate-shake' : ''}
              ${phase === 'opening' ? 'animate-open' : ''}
              ${phase === 'idle' ? 'hover:scale-105 transition-transform' : ''}
            `}
            onClick={handleOpen}
          >
            {/* Pack visual */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-600 via-purple-500 to-pink-500 shadow-2xl shadow-purple-500/50">
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-transparent to-white/20" />

              {/* Gift icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <Gift className="w-20 h-20 text-white/90" />
              </div>

              {/* Sparkles */}
              <div className="absolute -top-2 -right-2 text-2xl animate-pulse">✨</div>
              <div className="absolute -bottom-2 -left-2 text-2xl animate-pulse" style={{ animationDelay: '0.5s' }}>✨</div>
              <div className="absolute top-1/4 -left-3 text-xl animate-pulse" style={{ animationDelay: '0.3s' }}>⭐</div>
              <div className="absolute bottom-1/4 -right-3 text-xl animate-pulse" style={{ animationDelay: '0.7s' }}>⭐</div>
            </div>
          </div>
        )}

        {/* Tap instruction */}
        {phase === 'idle' && (
          <p className="mt-8 text-lg text-white/80 animate-pulse">
            {t.tapToOpen}
          </p>
        )}

        {/* Opening text */}
        {phase === 'opening' && (
          <p className="mt-8 text-lg text-purple-300">
            {t.opening}
          </p>
        )}

        {/* Prize reveal */}
        {(phase === 'revealing' || phase === 'complete') && opening && (
          <div className="animate-scale-in">
            {/* Congratulations */}
            <h2 className="text-3xl font-bold text-white mb-2">
              {t.congratulations}
            </h2>
            <p className="text-lg text-white/70 mb-6">{t.youWon}</p>

            {/* Prize card */}
            <PrizeCard
              prizeName={locale === 'he' ? opening.prizeName : opening.prizeNameEn}
              rarity={opening.prizeRarity}
              imageUrl={opening.prizeImageUrl}
            />

            {/* Claim button */}
            {phase === 'complete' && (
              <button
                onClick={handleComplete}
                className="mt-8 px-8 py-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-lg hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg shadow-green-500/30"
              >
                {t.claimPrize}
              </button>
            )}
          </div>
        )}

        {/* Error state */}
        {phase === 'error' && (
          <div className="animate-scale-in">
            <div className="text-6xl mb-4">😢</div>
            <h2 className="text-2xl font-bold text-red-400 mb-2">{t.error}</h2>
            <p className="text-white/60 mb-6">{error}</p>
            <button
              onClick={() => setPhase('idle')}
              className="px-6 py-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              {t.tryAgain}
            </button>
          </div>
        )}
      </div>

      {/* Particles for epic/legendary */}
      {phase === 'revealing' && opening && (opening.prizeRarity === 'epic' || opening.prizeRarity === 'legendary') && (
        <Particles rarity={opening.prizeRarity} />
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px) rotate(-2deg); }
          20%, 40%, 60%, 80% { transform: translateX(5px) rotate(2deg); }
        }

        @keyframes open {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); }
          100% { transform: scale(0); opacity: 0; }
        }

        @keyframes scale-in {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }

        .animate-shake {
          animation: shake 0.5s ease-in-out infinite;
        }

        .animate-open {
          animation: open 0.5s ease-in forwards;
        }

        .animate-scale-in {
          animation: scale-in 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

// Prize Card Component
function PrizeCard({
  prizeName,
  rarity,
  imageUrl,
}: {
  prizeName: string;
  rarity: PrizeRarity;
  imageUrl?: string;
}) {
  const config = RARITY_CONFIG[rarity];

  return (
    <div
      className={`
        relative w-64 mx-auto p-6 rounded-2xl
        ${rarity === 'legendary' ? 'animate-legendary-glow' : ''}
        ${rarity === 'epic' ? 'animate-epic-glow' : ''}
      `}
      style={{
        background: `linear-gradient(135deg, ${config.bgColor}33, ${config.color}33)`,
        border: `2px solid ${config.color}`,
        boxShadow: `0 0 30px ${config.color}66`,
      }}
    >
      {/* Rarity badge */}
      <div
        className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-sm font-bold"
        style={{ backgroundColor: config.color, color: 'white' }}
      >
        {config.emoji} {config.nameEn}
      </div>

      {/* Prize image or emoji */}
      <div className="w-24 h-24 mx-auto mb-4 rounded-xl bg-white/10 flex items-center justify-center">
        {imageUrl ? (
          <img src={imageUrl} alt={prizeName} className="w-full h-full object-cover rounded-xl" />
        ) : (
          <span className="text-5xl">{config.emoji}</span>
        )}
      </div>

      {/* Prize name */}
      <h3 className="text-xl font-bold text-white text-center">
        {prizeName}
      </h3>

      <style jsx>{`
        @keyframes legendary-glow {
          0%, 100% { box-shadow: 0 0 30px #F59E0B66, 0 0 60px #F59E0B33; }
          50% { box-shadow: 0 0 50px #F59E0B99, 0 0 80px #F59E0B66; }
        }

        @keyframes epic-glow {
          0%, 100% { box-shadow: 0 0 20px #8B5CF666, 0 0 40px #8B5CF633; }
          50% { box-shadow: 0 0 35px #8B5CF699, 0 0 60px #8B5CF666; }
        }

        .animate-legendary-glow {
          animation: legendary-glow 1.5s ease-in-out infinite;
        }

        .animate-epic-glow {
          animation: epic-glow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

// Particles Component
function Particles({ rarity }: { rarity: PrizeRarity }) {
  const count = rarity === 'legendary' ? 30 : 15;
  const particles = Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 2 + Math.random() * 2,
    size: rarity === 'legendary' ? 10 + Math.random() * 15 : 8 + Math.random() * 10,
  }));

  const emoji = rarity === 'legendary' ? '🌟' : '✨';

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute animate-fall"
          style={{
            left: `${particle.left}%`,
            top: '-20px',
            fontSize: `${particle.size}px`,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
          }}
        >
          {emoji}
        </div>
      ))}

      <style jsx>{`
        @keyframes fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }

        .animate-fall {
          animation: fall linear forwards;
        }
      `}</style>
    </div>
  );
}
