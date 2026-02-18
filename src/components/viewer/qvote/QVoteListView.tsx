'use client';

import { memo, useCallback, useRef, useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import type { Candidate } from '@/types/qvote';

interface QVoteListViewProps {
  candidates: Candidate[];
  selectedIds: string[];
  maxSelections: number;
  onSelect: (candidateId: string) => void;
  onScrollToIndex: (index: number) => void;
  targetIndex: number | null;
  hasVoted: boolean;
  showNames: boolean;
  showVoteCount: boolean;
  isFinalsPhase: boolean;
  accentColor?: string;
  textColor?: string;
  backgroundColor?: string;
  isRTL?: boolean;
  /** Called when the focused item changes (for bubble X visibility) */
  onFocusedIndexChange?: (index: number | null) => void;
}

// Individual list item - Compact horizontal card
const ListItem = memo(function ListItem({
  candidate,
  isSelected,
  canSelect,
  hasVoted,
  showNames,
  showVoteCount,
  isFinalsPhase,
  accentColor,
  textColor,
  backgroundColor,
  isRTL,
  onSelect,
}: {
  candidate: Candidate;
  isSelected: boolean;
  canSelect: boolean;
  hasVoted: boolean;
  showNames: boolean;
  showVoteCount: boolean;
  isFinalsPhase: boolean;
  accentColor: string;
  textColor: string;
  backgroundColor: string;
  isRTL: boolean;
  onSelect: () => void;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const photo = candidate.photos[0];
  const voteCount = isFinalsPhase ? candidate.finalsVoteCount : candidate.voteCount;

  // Check if name is real (not a filename)
  const isRealName = candidate.name &&
    !candidate.name.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i) &&
    !candidate.name.match(/^(IMG|DSC|Photo|Screenshot|Firefly|Adobe|DCIM|image)/i) &&
    !candidate.name.match(/^\d{5,}/) &&
    !candidate.name.match(/[_-]\d+$/) &&
    !candidate.name.match(/^[A-Za-z0-9_-]+\s*\(\d+\)$/);

  return (
    <button
      onClick={onSelect}
      disabled={hasVoted || (!canSelect && !isSelected)}
      className="w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-300 ease-out text-start active:scale-[0.98]"
      style={{
        backgroundColor,
        boxShadow: isSelected
          ? `0 0 0 3px ${accentColor}, 0 4px 16px ${accentColor}30`
          : `0 2px 8px ${textColor}15`,
        opacity: hasVoted && !isSelected ? 0.6 : 1,
      }}
    >
      {/* Image - Small square */}
      <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0">
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <Loader2 className="w-5 h-5 animate-spin text-white/60" />
          </div>
        )}

        {photo ? (
          <img
            src={photo.thumbnailUrl || photo.url}
            alt=""
            className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImageLoaded(true)}
            onError={(e) => { const img = e.currentTarget; if (img.src !== photo.url) img.src = photo.url; }}
            loading="lazy"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-2xl"
            style={{ backgroundColor: `${textColor}10`, color: `${textColor}30` }}
          >
            {candidate.name?.[0] || '?'}
          </div>
        )}

        {/* Selection checkmark on image */}
        {isSelected && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: '#22c55e',
                boxShadow: '0 2px 8px rgba(34, 197, 94, 0.5)',
              }}
            >
              <Check className="w-5 h-5 text-white" strokeWidth={3} />
            </div>
          </div>
        )}

        {/* Multiple photos indicator */}
        {candidate.photos.length > 1 && !isSelected && (
          <div
            className="absolute bottom-1 end-1 px-1.5 py-0.5 rounded text-[10px] font-semibold backdrop-blur-md"
            style={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              color: '#ffffff',
            }}
          >
            +{candidate.photos.length - 1}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        {showNames && isRealName && (
          <h3
            className="font-semibold truncate text-lg"
            style={{ color: textColor }}
          >
            {candidate.name}
          </h3>
        )}
        {showVoteCount && (
          <span
            className="text-sm mt-1"
            style={{ color: `${textColor}70` }}
          >
            {voteCount} {isRTL ? 'קולות' : 'votes'}
          </span>
        )}
      </div>

      {/* Selection indicator on end */}
      <div className="shrink-0">
        <div
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
            isSelected ? 'border-transparent' : ''
          }`}
          style={{
            borderColor: isSelected ? 'transparent' : `${textColor}30`,
            backgroundColor: isSelected ? '#22c55e' : 'transparent',
          }}
        >
          {isSelected && <Check className="w-5 h-5 text-white" strokeWidth={3} />}
        </div>
      </div>
    </button>
  );
});

const QVoteListView = memo(function QVoteListView({
  candidates,
  selectedIds,
  maxSelections,
  onSelect,
  onScrollToIndex,
  targetIndex,
  hasVoted,
  showNames,
  showVoteCount,
  isFinalsPhase,
  accentColor = '#3b82f6',
  textColor = '#1f2937',
  backgroundColor = '#ffffff',
  isRTL = false,
  onFocusedIndexChange,
}: QVoteListViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const isScrollingFromBubble = useRef(false);
  const focusedIndexRef = useRef<number | null>(null);

  // Scroll to target index when navigating from bubbles
  useEffect(() => {
    if (targetIndex !== null && targetIndex >= 0 && itemRefs.current.has(targetIndex)) {
      isScrollingFromBubble.current = true;
      focusedIndexRef.current = targetIndex;
      onFocusedIndexChange?.(targetIndex);

      const element = itemRefs.current.get(targetIndex);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      onScrollToIndex(-1); // Reset target

      // Reset the bubble scroll flag after animation completes
      setTimeout(() => {
        isScrollingFromBubble.current = false;
      }, 500);
    }
  }, [targetIndex, onScrollToIndex, onFocusedIndexChange]);

  // Clear focus when user scrolls manually
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let scrollTimeout: NodeJS.Timeout;

    const handleScroll = () => {
      // Ignore if this scroll was triggered by bubble click
      if (isScrollingFromBubble.current) return;

      // Clear focus when user scrolls manually
      if (focusedIndexRef.current !== null) {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          focusedIndexRef.current = null;
          onFocusedIndexChange?.(null);
        }, 100);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [onFocusedIndexChange]);

  const handleSelect = useCallback(
    (candidateId: string) => {
      if (hasVoted) return;

      const isSelected = selectedIds.includes(candidateId);

      // If already selected, do nothing - deselect only via bubble X button
      if (isSelected) {
        return;
      }

      if (selectedIds.length >= maxSelections) {
        return; // Max reached
      }

      onSelect(candidateId);
    },
    [selectedIds, maxSelections, hasVoted, onSelect]
  );

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-y-auto overscroll-contain scroll-smooth"
      style={{ backgroundColor }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="flex flex-col gap-3 p-4 pb-44">
        {candidates.map((candidate, index) => {
          const isSelected = selectedIds.includes(candidate.id);
          const canSelect = isSelected || selectedIds.length < maxSelections;

          return (
            <div
              key={candidate.id}
              ref={(el) => {
                if (el) itemRefs.current.set(index, el);
              }}
            >
              <ListItem
                candidate={candidate}
                isSelected={isSelected}
                canSelect={canSelect}
                hasVoted={hasVoted}
                showNames={showNames}
                showVoteCount={showVoteCount}
                isFinalsPhase={isFinalsPhase}
                accentColor={accentColor}
                textColor={textColor}
                backgroundColor={backgroundColor}
                isRTL={isRTL}
                onSelect={() => handleSelect(candidate.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default QVoteListView;
