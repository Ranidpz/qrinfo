'use client';

import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useQGamesTheme } from './QGamesThemeContext';

interface ExitGameButtonProps {
  onConfirm: () => void;
  isRTL: boolean;
  t: (key: string) => string;
}

export default function ExitGameButton({ onConfirm, isRTL, t }: ExitGameButtonProps) {
  const theme = useQGamesTheme();
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <>
      {/* Small exit icon — top corner, opposite side from game UI */}
      <button
        onClick={() => setShowConfirm(true)}
        className="absolute top-3 z-40 p-2.5 rounded-full transition-colors"
        style={{
          [isRTL ? 'right' : 'left']: 12,
          backgroundColor: `${theme.surfaceColor}cc`,
          color: theme.textSecondary,
        }}
        aria-label={t('exitGame')}
      >
        <LogOut className="w-5 h-5" />
      </button>

      {/* Confirmation overlay */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="rounded-2xl w-full max-w-[260px] p-5 text-center"
            dir={isRTL ? 'rtl' : 'ltr'}
            style={{ backgroundColor: theme.surfaceColor, border: `1px solid ${theme.borderColor}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-bold text-base mb-1" style={{ color: theme.textColor }}>
              {t('exitGameTitle')}
            </p>
            <p className="text-sm mb-5" style={{ color: theme.textSecondary }}>
              {t('exitGameMessage')}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors"
                style={{ backgroundColor: theme.surfaceHover, color: theme.textColor }}
              >
                {t('stayInGame')}
              </button>
              <button
                onClick={() => {
                  setShowConfirm(false);
                  onConfirm();
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors bg-red-500/20 text-red-400"
              >
                {t('exitGame')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
