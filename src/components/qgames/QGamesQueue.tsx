'use client';

import { useState, useEffect } from 'react';
import { Share2, ArrowLeft } from 'lucide-react';

interface QGamesQueueProps {
  gameEmoji: string;
  gameName: string;
  playerAvatar: string;
  shortId: string;
  enableWhatsApp: boolean;
  onCancel: () => void;
  onPlayBot?: () => void;
  isRTL: boolean;
  t: (key: string) => string;
}

export default function QGamesQueue({
  gameEmoji,
  gameName,
  playerAvatar,
  shortId,
  enableWhatsApp,
  onCancel,
  onPlayBot,
  isRTL,
  t,
}: QGamesQueueProps) {
  const [dots, setDots] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [showInvite, setShowInvite] = useState(false);

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Track elapsed time & show invite after 10s
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(prev => {
        if (prev + 1 >= 10) setShowInvite(true);
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleWhatsAppInvite = () => {
    const shareUrl = `https://qr.playzones.app/v/${shortId}`;
    const message = isRTL
      ? `🎮 בוא נשחק ${gameName}! ${shareUrl}`
      : `🎮 Let's play ${gameName}! ${shareUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Back button */}
      <button
        onClick={onCancel}
        className="absolute top-4 text-white/40 hover:text-white/60 transition-colors p-2"
        style={{ [isRTL ? 'right' : 'left']: 12 }}
      >
        <ArrowLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
      </button>

      {/* Searching animation */}
      <div className="relative mb-8">
        {/* Pulsing rings */}
        <div className="absolute inset-0 w-24 h-24 rounded-full border-2 border-emerald-400/20 animate-ping" style={{ animationDuration: '2s' }} />
        <div className="absolute inset-0 w-24 h-24 rounded-full border-2 border-emerald-400/10 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />

        <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center text-5xl relative z-10 ring-2 ring-emerald-400/30">
          {playerAvatar}
        </div>
      </div>

      {/* Game info */}
      <div className="text-4xl mb-2">{gameEmoji}</div>
      <h2 className="text-white font-bold text-xl mb-1">{gameName}</h2>

      {/* Searching text */}
      <p className="text-white/50 text-sm mb-8">
        {t('searchingForOpponent')}{dots}
      </p>

      {/* Timer */}
      <div className="text-white/20 text-xs mb-6 tabular-nums">
        {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
      </div>

      {/* Invite + Bot options */}
      {showInvite && (
        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-3">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <p className="text-white/60 text-sm mb-3">{t('noOpponentYet')}</p>

            {/* Play vs Bot */}
            {onPlayBot && (
              <button
                onClick={onPlayBot}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all active:scale-95 bg-gradient-to-r from-purple-600 to-indigo-600 text-white mb-2"
              >
                🤖 {isRTL ? 'שחק נגד בוט' : 'Play vs Bot'}
              </button>
            )}

            {/* WhatsApp invite */}
            {enableWhatsApp && (
              <button
                onClick={handleWhatsAppInvite}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all active:scale-95"
                style={{ background: '#25D366', color: 'white' }}
              >
                <Share2 className="w-4 h-4" />
                {t('inviteViaWhatsApp')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
