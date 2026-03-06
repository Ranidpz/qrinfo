'use client';

import { X } from 'lucide-react';
import { useQGamesTheme } from './QGamesThemeContext';
import { OnlineViewerInfo, QGameType, GAME_META } from '@/types/qgames';

interface OnlinePlayersModalProps {
  viewers: OnlineViewerInfo[];
  viewerCount: number;
  isRTL: boolean;
  onClose: () => void;
}

function getTimeAgo(timestamp: number, isRTL: boolean): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return isRTL ? 'עכשיו' : 'now';
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    return isRTL ? `${m} דק׳` : `${m}m`;
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    return isRTL ? `${h} שע׳` : `${h}h`;
  }
  const d = Math.floor(seconds / 86400);
  return isRTL ? `${d} ימים` : `${d}d`;
}

export default function OnlinePlayersModal({
  viewers,
  viewerCount,
  isRTL,
  onClose,
}: OnlinePlayersModalProps) {
  const theme = useQGamesTheme();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl relative animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 max-h-[70vh] flex flex-col overflow-hidden"
        style={{ backgroundColor: theme.backgroundColor }}
        dir={isRTL ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-3">
          <div className="w-10 h-1 rounded-full bg-white/15" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center">
              <div
                className="w-3 h-3 rounded-full animate-pulse"
                style={{ backgroundColor: theme.accentColor }}
              />
              <div
                className="absolute w-3 h-3 rounded-full animate-ping opacity-30"
                style={{ backgroundColor: theme.accentColor }}
              />
            </div>
            <h2 className="text-lg font-bold tabular-nums" style={{ color: theme.textColor }}>
              {viewerCount} {isRTL ? 'מחוברים' : 'Online'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: theme.textSecondary }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Divider */}
        <div className="mx-4 h-px" style={{ backgroundColor: theme.borderColor }} />

        {/* Player list */}
        <div
          className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5"
          style={{ scrollbarWidth: 'none' }}
        >
          {viewers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <span className="text-3xl">👥</span>
              <span className="text-sm" style={{ color: theme.textSecondary }}>
                {isRTL ? 'אף אחד עוד לא הצטרף' : 'No players yet'}
              </span>
            </div>
          )}

          {viewers.map((viewer, i) => (
            <ViewerRow
              key={viewer.visitorId}
              viewer={viewer}
              theme={theme}
              isRTL={isRTL}
              index={i}
            />
          ))}

          {viewerCount > viewers.length && (
            <div className="text-center py-3">
              <span
                className="text-xs px-3 py-1 rounded-full"
                style={{ color: theme.textSecondary, backgroundColor: 'rgba(255,255,255,0.05)' }}
              >
                +{viewerCount - viewers.length} {isRTL ? 'נוספים' : 'more'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ViewerRow({
  viewer,
  theme,
  isRTL,
  index,
}: {
  viewer: OnlineViewerInfo;
  theme: ReturnType<typeof useQGamesTheme>;
  isRTL: boolean;
  index: number;
}) {
  const timeAgo = getTimeAgo(viewer.joinedAt, isRTL);
  const gameEmoji = viewer.playingGame ? GAME_META[viewer.playingGame]?.emoji : null;

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/[0.03]"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-lg shrink-0"
        style={{
          backgroundColor: 'rgba(255,255,255,0.08)',
          border: `2px solid ${viewer.status === 'playing' ? '#fbbf24' : theme.accentColor}`,
        }}
      >
        {viewer.avatarType === 'selfie' && viewer.avatarValue.startsWith('http') ? (
          <img src={viewer.avatarValue} alt="" className="w-full h-full object-cover" />
        ) : (
          <span>{viewer.avatarValue}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium truncate block" style={{ color: theme.textColor }}>
          {viewer.nickname}
        </span>
        <div className="flex items-center gap-1 mt-0.5">
          {viewer.status === 'playing' ? (
            <span className="text-[11px] truncate" style={{ color: '#fbbf24' }}>
              {gameEmoji} {isRTL ? `משחק נגד ${viewer.playingVs}` : `vs ${viewer.playingVs}`}
            </span>
          ) : (
            <span className="text-[11px]" style={{ color: theme.textSecondary }}>
              {isRTL ? 'בלובי' : 'In lobby'}
            </span>
          )}
        </div>
      </div>

      {/* Time + status dot */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] tabular-nums" style={{ color: theme.textSecondary, opacity: 0.6 }}>
          {timeAgo}
        </span>
        <div
          className="w-2 h-2 rounded-full"
          style={{
            backgroundColor: viewer.status === 'playing' ? '#fbbf24' : theme.accentColor,
            ...(viewer.status === 'idle' ? { opacity: 0.7 } : {}),
          }}
        />
      </div>
    </div>
  );
}
