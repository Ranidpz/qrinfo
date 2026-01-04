'use client';

import { memo, useCallback, useRef, useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import type { Candidate } from '@/types/qvote';

interface QVoteGridViewProps {
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
}

// Individual grid item with lazy loading
const GridItem = memo(function GridItem({
  candidate,
  isSelected,
  canSelect,
  hasVoted,
  showNames,
  showVoteCount,
  isFinalsPhase,
  accentColor,
  textColor,
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
  onSelect: () => void;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const photo = candidate.photos[0];
  const voteCount = isFinalsPhase ? candidate.finalsVoteCount : candidate.voteCount;

  return (
    <button
      onClick={onSelect}
      disabled={hasVoted || (!canSelect && !isSelected)}
      className="relative w-full aspect-square overflow-hidden transition-all duration-200 ease-out active:scale-95"
      style={{
        outline: isSelected ? `3px solid ${accentColor}` : 'none',
        outlineOffset: '-3px',
        opacity: hasVoted && !isSelected ? 0.5 : 1,
      }}
    >
      {/* Loading spinner */}
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <Loader2 className="w-6 h-6 animate-spin text-white/60" />
        </div>
      )}

      {/* Image */}
      {photo ? (
        <img
          src={photo.thumbnailUrl || photo.url}
          alt=""
          className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setImageLoaded(true)}
          loading="lazy"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-3xl font-bold"
          style={{ backgroundColor: `${textColor}10`, color: `${textColor}30` }}
        >
          {candidate.name?.[0] || '?'}
        </div>
      )}

      {/* Selection overlay */}
      {isSelected && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ backgroundColor: `${accentColor}30` }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: accentColor,
              boxShadow: `0 2px 12px ${accentColor}60`,
            }}
          >
            <Check className="w-6 h-6 text-white" strokeWidth={3} />
          </div>
        </div>
      )}

      {/* Multiple photos badge */}
      {candidate.photos.length > 1 && !isSelected && (
        <div
          className="absolute top-1 end-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
          style={{
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: '#ffffff',
          }}
        >
          {candidate.photos.length}
        </div>
      )}

      {/* Name overlay (bottom gradient) */}
      {showNames && candidate.name && (
        <div
          className="absolute bottom-0 inset-x-0 px-1.5 py-1"
          style={{
            background: `linear-gradient(transparent, rgba(0,0,0,0.7))`,
          }}
        >
          <p className="text-white text-xs font-medium truncate text-center drop-shadow-sm">
            {candidate.name}
          </p>
        </div>
      )}

      {/* Vote count badge */}
      {showVoteCount && !showNames && (
        <div
          className="absolute bottom-1 start-1 px-1.5 py-0.5 rounded text-xs font-medium"
          style={{
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: '#ffffff',
          }}
        >
          {voteCount}
        </div>
      )}
    </button>
  );
});

const QVoteGridView = memo(function QVoteGridView({
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
}: QVoteGridViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Scroll to target index when navigating from bubbles
  useEffect(() => {
    if (targetIndex !== null && targetIndex >= 0 && itemRefs.current.has(targetIndex)) {
      const element = itemRefs.current.get(targetIndex);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      onScrollToIndex(-1); // Reset target
    }
  }, [targetIndex, onScrollToIndex]);

  const handleSelect = useCallback(
    (candidateId: string) => {
      if (hasVoted) return;

      const isSelected = selectedIds.includes(candidateId);
      if (!isSelected && selectedIds.length >= maxSelections) {
        return; // Max reached
      }

      onSelect(candidateId);
    },
    [selectedIds, maxSelections, hasVoted, onSelect]
  );

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-y-auto overscroll-contain"
      style={{ backgroundColor }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="grid grid-cols-3 gap-0.5 p-0.5 pb-44">
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
              <GridItem
                candidate={candidate}
                isSelected={isSelected}
                canSelect={canSelect}
                hasVoted={hasVoted}
                showNames={showNames}
                showVoteCount={showVoteCount}
                isFinalsPhase={isFinalsPhase}
                accentColor={accentColor}
                textColor={textColor}
                onSelect={() => handleSelect(candidate.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default QVoteGridView;
