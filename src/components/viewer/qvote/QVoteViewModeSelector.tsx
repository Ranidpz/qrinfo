'use client';

import { memo } from 'react';
import { LayoutGrid, List, Maximize2 } from 'lucide-react';

export type ViewMode = 'flipbook' | 'list' | 'grid';

interface QVoteViewModeSelectorProps {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
  accentColor?: string;
  textColor?: string;
}

const QVoteViewModeSelector = memo(function QVoteViewModeSelector({
  viewMode,
  onChange,
  accentColor = '#3b82f6',
  textColor = '#1f2937',
}: QVoteViewModeSelectorProps) {
  const modes: { mode: ViewMode; icon: typeof Maximize2; label: string }[] = [
    { mode: 'flipbook', icon: Maximize2, label: 'Fullscreen' },
    { mode: 'list', icon: List, label: 'List' },
    { mode: 'grid', icon: LayoutGrid, label: 'Grid' },
  ];

  return (
    <div
      className="inline-flex items-center rounded-full p-1 backdrop-blur-md"
      style={{
        backgroundColor: `${textColor}08`,
        border: `1px solid ${textColor}15`,
      }}
    >
      {modes.map(({ mode, icon: Icon, label }) => {
        const isActive = viewMode === mode;
        return (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            aria-label={label}
            aria-pressed={isActive}
            className="relative p-2.5 rounded-full transition-all duration-300 ease-out"
            style={{
              color: isActive ? accentColor : `${textColor}60`,
              backgroundColor: isActive ? `${accentColor}15` : 'transparent',
              transform: isActive ? 'scale(1.05)' : 'scale(1)',
            }}
          >
            <Icon
              className="w-5 h-5 transition-transform duration-300"
              style={{
                filter: isActive ? `drop-shadow(0 0 8px ${accentColor}40)` : 'none',
              }}
              strokeWidth={isActive ? 2.5 : 2}
            />
            {isActive && (
              <span
                className="absolute inset-0 rounded-full animate-ping opacity-20"
                style={{ backgroundColor: accentColor }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
});

export default QVoteViewModeSelector;
