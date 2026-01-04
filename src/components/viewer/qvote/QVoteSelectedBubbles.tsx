'use client';

import { memo, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import type { Candidate } from '@/types/qvote';

interface QVoteSelectedBubblesProps {
  candidates: Candidate[];
  selectedIds: string[];
  currentIndex: number;
  maxSelections: number;
  onNavigateTo: (index: number) => void;
  onDeselect: (candidateId: string) => void;
  accentColor?: string;
  textColor?: string;
  isRTL?: boolean;
  /** When true (grid/list modes), tapping a bubble deselects directly without navigation */
  directDeselect?: boolean;
}

const QVoteSelectedBubbles = memo(function QVoteSelectedBubbles({
  candidates,
  selectedIds,
  currentIndex,
  maxSelections,
  onNavigateTo,
  onDeselect,
  accentColor = '#3b82f6',
  textColor = '#ffffff',
  isRTL = false,
  directDeselect = false,
}: QVoteSelectedBubblesProps) {
  const [pressedId, setPressedId] = useState<string | null>(null);

  const handleClick = useCallback(
    (candidateId: string) => {
      // In grid/list modes, directly deselect on tap
      if (directDeselect) {
        onDeselect(candidateId);
        return;
      }

      // In flipbook mode: first tap navigates, second tap deselects
      const candidateIndex = candidates.findIndex((c) => c.id === candidateId);
      const isCurrentlyViewing = candidateIndex === currentIndex;

      if (isCurrentlyViewing) {
        // Second tap - deselect
        onDeselect(candidateId);
      } else {
        // First tap - navigate to this candidate
        onNavigateTo(candidateIndex);
      }
    },
    [candidates, currentIndex, onNavigateTo, onDeselect, directDeselect]
  );

  return (
    <div
      className="flex justify-center px-4"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-2xl backdrop-blur-xl pointer-events-auto"
        style={{
          backgroundColor: `${textColor === '#ffffff' ? '#000000' : textColor}40`,
          border: `1px solid ${textColor}20`,
          boxShadow: `0 8px 32px ${textColor === '#ffffff' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)'}`,
        }}
      >
        {/* Selection count badge */}
        <div
          className="flex items-center justify-center min-w-[2.5rem] h-10 px-3 rounded-xl font-semibold text-sm"
          style={{
            backgroundColor: `${accentColor}20`,
            color: accentColor,
            border: `1px solid ${accentColor}40`,
          }}
        >
          {selectedIds.length}/{maxSelections}
        </div>

        {/* Divider */}
        <div
          className="w-px h-8"
          style={{ backgroundColor: `${textColor}20` }}
        />

        {/* Selected candidate bubbles */}
        <div className="flex items-center gap-2">
          {selectedIds.map((id, idx) => {
            const candidate = candidates.find((c) => c.id === id);
            if (!candidate) return null;

            const photo = candidate.photos[0];
            const candidateIndex = candidates.findIndex((c) => c.id === id);
            const isViewing = candidateIndex === currentIndex;
            const isPressed = pressedId === id;

            return (
              <button
                key={id}
                onClick={() => handleClick(id)}
                onTouchStart={() => setPressedId(id)}
                onTouchEnd={() => setPressedId(null)}
                onMouseDown={() => setPressedId(id)}
                onMouseUp={() => setPressedId(null)}
                onMouseLeave={() => setPressedId(null)}
                className="relative w-12 h-12 rounded-full overflow-hidden transition-all duration-300 ease-out"
                style={{
                  transform: isPressed ? 'scale(0.9)' : isViewing ? 'scale(1.15)' : 'scale(1)',
                  boxShadow: isViewing
                    ? `0 0 0 3px ${accentColor}, 0 4px 16px ${accentColor}50`
                    : `0 2px 8px rgba(0,0,0,0.2)`,
                  animation: `qvote-bubble-enter 0.4s ease-out ${idx * 0.08}s both`,
                }}
              >
                {photo ? (
                  <img
                    src={photo.thumbnailUrl || photo.url}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-lg font-bold"
                    style={{ backgroundColor: accentColor, color: textColor }}
                  >
                    {candidate.name?.[0] || (idx + 1)}
                  </div>
                )}

                {/* Deselect overlay - only show when viewing this candidate */}
                <div
                  className={`absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity duration-200 ${
                    isViewing ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                >
                  <X className="w-5 h-5 text-white drop-shadow-lg" strokeWidth={3} />
                </div>
              </button>
            );
          })}

          {/* Empty slots */}
          {Array.from({ length: maxSelections - selectedIds.length }).map((_, idx) => (
            <div
              key={`empty-${idx}`}
              className="w-12 h-12 rounded-full border-2 border-dashed opacity-30"
              style={{ borderColor: textColor }}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

export default QVoteSelectedBubbles;
