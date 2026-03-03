'use client';

import { useState } from 'react';
import { User, Camera } from 'lucide-react';
import { QGamesConfig, DEFAULT_QGAMES_EMOJI_PALETTE } from '@/types/qgames';

interface QGamesRegistrationProps {
  config: QGamesConfig;
  onRegister: (nickname: string, avatarType: 'emoji' | 'selfie', avatarValue: string) => Promise<void>;
  isRTL: boolean;
  t: (key: string) => string;
}

export default function QGamesRegistration({
  config,
  onRegister,
  isRTL,
  t,
}: QGamesRegistrationProps) {
  const [nickname, setNickname] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState(
    config.emojiPalette?.[0] || DEFAULT_QGAMES_EMOJI_PALETTE[0]
  );
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emojiPalette = config.emojiPalette?.length
    ? config.emojiPalette
    : DEFAULT_QGAMES_EMOJI_PALETTE;

  const handleSubmit = async () => {
    const trimmed = nickname.trim();
    if (trimmed.length < 2) {
      setError(t('nicknameMinLength'));
      return;
    }

    setIsRegistering(true);
    setError(null);

    try {
      await onRegister(trimmed, 'emoji', selectedEmoji);
    } catch (err) {
      setError(t('registrationError'));
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Title */}
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">🎮</div>
        <h1 className="text-2xl font-bold text-white mb-1">Q.Games</h1>
        <p className="text-white/50 text-sm">{t('joinToPlay')}</p>
      </div>

      {/* Avatar Selection */}
      <div className="w-full max-w-sm mb-6">
        <p className="text-white/60 text-xs text-center mb-3 uppercase tracking-wider">
          {t('chooseAvatar')}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {emojiPalette.slice(0, 12).map((emoji) => (
            <button
              key={emoji}
              onClick={() => setSelectedEmoji(emoji)}
              className={`w-12 h-12 text-2xl rounded-xl transition-all duration-200 ${
                selectedEmoji === emoji
                  ? 'bg-white/20 scale-110 ring-2 ring-emerald-400/60 shadow-lg shadow-emerald-500/20'
                  : 'bg-white/5 hover:bg-white/10 active:scale-95'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Avatar Preview */}
      <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center text-4xl mb-4 ring-2 ring-white/10">
        {selectedEmoji}
      </div>

      {/* Nickname Input */}
      <div className="w-full max-w-sm mb-4">
        <div className="relative">
          <User className="absolute top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" style={{ [isRTL ? 'right' : 'left']: 12 }} />
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isRegistering && handleSubmit()}
            placeholder={t('enterNickname')}
            maxLength={20}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 text-white placeholder-white/30 text-center focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-transparent transition-all"
            style={{ paddingLeft: 40, paddingRight: 40 }}
            dir="auto"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-red-400 text-sm mb-3 text-center">{error}</p>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={isRegistering || nickname.trim().length < 2}
        className="w-full max-w-sm py-3.5 rounded-xl font-bold text-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: 'white',
        }}
      >
        {isRegistering ? (
          <span className="inline-flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            {t('registering')}
          </span>
        ) : (
          t('letsPlay')
        )}
      </button>
    </div>
  );
}
