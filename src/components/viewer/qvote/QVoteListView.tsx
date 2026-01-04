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
}

// Individual list item with lazy loading
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

  return (
    <button
      onClick={onSelect}
      disabled={hasVoted || (!canSelect && !isSelected)}
      className="w-full rounded-2xl overflow-hidden transition-all duration-300 ease-out text-start active:scale-[0.98]"
      style={{
        boxShadow: isSelected
          ? `0 0 0 3px ${accentColor}, 0 8px 32px ${accentColor}30`
          : `0 4px 16px ${textColor}10`,
        transform: isSelected ? 'scale(1.01)' : 'scale(1)',
        opacity: hasVoted && !isSelected ? 0.6 : 1,
      }}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {/* Loading spinner */}
        {!imageLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800">
            <Loader2 className="w-8 h-8 animate-spin text-white/60" />
            <p className="mt-2 text-white/50 text-xs">{isRTL ? 'טוען...' : 'Loading...'}</p>
          </div>
        )}

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
            className="w-full h-full flex items-center justify-center text-6xl"
            style={{ backgroundColor: `${textColor}10`, color: `${textColor}30` }}
          >
            {candidate.name?.[0] || '?'}
          </div>
        )}

        {/* Selection overlay */}
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            background: isSelected
              ? `linear-gradient(180deg, ${accentColor}20 0%, ${accentColor}40 100%)`
              : 'transparent',
          }}
        />

        {/* Selection badge - green like submit button */}
        {isSelected && (
          <div
            className="absolute top-4 end-4 w-12 h-12 rounded-full flex items-center justify-center animate-qvote-check"
            style={{
              backgroundColor: '#22c55e',
              boxShadow: '0 4px 20px rgba(34, 197, 94, 0.5)',
            }}
          >
            <Check className="w-7 h-7 text-white" strokeWidth={3} />
          </div>
        )}

        {/* Multiple photos indicator */}
        {candidate.photos.length > 1 && (
          <div
            className="absolute bottom-4 end-4 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-md"
            style={{
              backgroundColor: 'rgba(0,0,0,0.5)',
              color: '#ffffff',
            }}
          >
            {candidate.photos.length} {isRTL ? 'תמונות' : 'photos'}
          </div>
        )}
      </div>

      {/* Info */}
      <div
        className="px-4 py-3"
        style={{ backgroundColor: `${backgroundColor}f8` }}
      >
        <div className="flex items-center justify-between">
          {(() => {
            const isRealName = candidate.name &&
              !candidate.name.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i) &&
              !candidate.name.match(/^(IMG|DSC|Photo|Screenshot|Firefly|Adobe|DCIM|image)/i) &&
              !candidate.name.match(/^\d{5,}/) &&
              !candidate.name.match(/[_-]\d+$/) &&
              !candidate.name.match(/^[A-Za-z0-9_-]+\s*\(\d+\)$/);

            return showNames && isRealName ? (
              <h3
                className="text-lg font-bold truncate flex-1"
                style={{ color: textColor }}
              >
                {candidate.name}
              </h3>
            ) : null;
          })()}
          {showVoteCount && (
            <span
              className="text-sm font-semibold px-3 py-1.5 rounded-full ms-2 shrink-0"
              style={{
                backgroundColor: `${accentColor}15`,
                color: accentColor,
              }}
            >
              {voteCount} {isRTL ? 'קולות' : 'votes'}
            </span>
          )}
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
}: QVoteListViewProps) {
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
      <div className="flex flex-col gap-4 p-4 pb-44">
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
