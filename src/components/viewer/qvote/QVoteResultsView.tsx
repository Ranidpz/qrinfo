'use client';

import { useState, useCallback, useEffect, useMemo, useRef, memo } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCards, Autoplay } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import { ChevronLeft, ChevronRight, Trophy, Crown, Medal, Loader2, Settings, X, LayoutGrid, List, Layers } from 'lucide-react';
import type { Candidate, QVoteFlipbookSettings } from '@/types/qvote';
import { DEFAULT_FLIPBOOK_SETTINGS } from '@/types/qvote';
import QVoteViewModeSelector, { ViewMode } from './QVoteViewModeSelector';

import 'swiper/css';
import 'swiper/css/effect-cards';

const STORAGE_KEY = 'qvote-results-view-mode';
const TOP_COUNT_KEY = 'qvote-results-top-count';

interface QVoteResultsViewProps {
  candidates: Candidate[];
  showNames: boolean;
  showVoteCount: boolean;
  isFinalsPhase: boolean;
  accentColor?: string;
  textColor?: string;
  backgroundColor?: string;
  isRTL?: boolean;
  logoUrl?: string;
  flipbookSettings?: QVoteFlipbookSettings;
  categoryName?: string;  // Category name to display in header
  translations: {
    resultsTitle: string;
    votes: string;
    winner: string;
  };
}

// Rank badge component - Elegant combined badge
const RankBadge = memo(function RankBadge({
  rank,
  voteCount,
  showVoteCount,
  isRTL,
}: {
  rank: number;
  voteCount: number;
  showVoteCount: boolean;
  isRTL: boolean;
}) {
  const getBadgeColor = () => {
    if (rank === 1) return '#fbbf24'; // Gold
    if (rank === 2) return '#9ca3af'; // Silver
    if (rank === 3) return '#d97706'; // Bronze
    return '#3b82f6'; // Blue
  };

  const getTextColor = () => {
    if (rank === 1) return '#78350f'; // Dark amber
    if (rank === 2) return '#374151'; // Dark gray
    return '#ffffff'; // White
  };

  return (
    <div className={`absolute top-3 ${isRTL ? 'left-3' : 'right-3'} z-20`}>
      <div
        className="flex flex-col items-center rounded-2xl overflow-hidden shadow-xl"
        style={{ backgroundColor: getBadgeColor() }}
      >
        {/* Rank */}
        <div
          className="w-14 h-14 flex items-center justify-center"
          style={{ color: getTextColor() }}
        >
          {rank === 1 ? (
            <Crown className="w-8 h-8" />
          ) : (
            <span className="font-bold text-2xl">{rank}</span>
          )}
        </div>
        {/* Vote count */}
        {showVoteCount && (
          <div
            className="w-full px-3 py-1.5 text-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}
          >
            <span className="text-white text-sm font-bold">{voteCount}</span>
          </div>
        )}
      </div>
    </div>
  );
});

// Flipbook result card
const FlipbookResultCard = memo(function FlipbookResultCard({
  candidate,
  rank,
  showNames,
  showVoteCount,
  isFinalsPhase,
  isRTL,
  votesLabel,
}: {
  candidate: Candidate;
  rank: number;
  showNames: boolean;
  showVoteCount: boolean;
  isFinalsPhase: boolean;
  isRTL: boolean;
  votesLabel: string;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const photo = candidate.photos[0];
  const voteCount = isFinalsPhase ? candidate.finalsVoteCount : candidate.voteCount;

  return (
    <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl">
      {/* Loading */}
      {!imageLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10">
          <Loader2 className="w-12 h-12 animate-spin text-white/60" />
        </div>
      )}

      {/* Image */}
      {photo && (
        <img
          src={photo.thumbnailUrl || photo.url}
          alt=""
          className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setImageLoaded(true)}
        />
      )}

      {/* Rank Badge */}
      <RankBadge rank={rank} voteCount={voteCount} showVoteCount={showVoteCount} isRTL={isRTL} />

      {/* Bottom gradient with name - only show real names, not filenames */}
      {(() => {
        const isRealName = candidate.name &&
          !candidate.name.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i) &&
          !candidate.name.match(/^(IMG|DSC|Photo|Screenshot|Firefly|Adobe|DCIM|image)/i) &&
          !candidate.name.match(/^\d{5,}/) &&
          !candidate.name.match(/[_-]\d+$/) &&
          !candidate.name.match(/^[A-Za-z0-9_-]+\s*\(\d+\)$/);

        return showNames && isRealName ? (
          <div
            className="absolute bottom-0 inset-x-0 p-4 z-10"
            style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}
          >
            <h3 className="text-white text-2xl font-bold truncate text-center drop-shadow-lg">
              {candidate.name}
            </h3>
          </div>
        ) : null;
      })()}
    </div>
  );
});

// Grid result item
const GridResultItem = memo(function GridResultItem({
  candidate,
  rank,
  showNames,
  showVoteCount,
  isFinalsPhase,
  accentColor,
  textColor,
  isRTL,
}: {
  candidate: Candidate;
  rank: number;
  showNames: boolean;
  showVoteCount: boolean;
  isFinalsPhase: boolean;
  accentColor: string;
  textColor: string;
  isRTL: boolean;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const photo = candidate.photos[0];
  const voteCount = isFinalsPhase ? candidate.finalsVoteCount : candidate.voteCount;
  const isTopThree = rank <= 3;

  const ringColor = rank === 1 ? '#fbbf24' : rank === 2 ? '#9ca3af' : rank === 3 ? '#d97706' : undefined;

  return (
    <div
      className="relative w-full h-full rounded-xl overflow-hidden"
      style={{
        boxShadow: isTopThree && ringColor ? `0 0 0 2px ${ringColor}` : undefined,
        minHeight: 0,
      }}
    >
      {/* Loading */}
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
        />
      ) : (
        <div className="w-full h-full bg-gray-700 flex items-center justify-center">
          <span className="text-4xl text-gray-500">{candidate.name?.[0] || '?'}</span>
        </div>
      )}

      {/* Rank & Vote Badge - Elegant combined badge */}
      <div className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} z-10`}>
        <div
          className="flex flex-col items-center rounded-xl overflow-hidden shadow-lg"
          style={{
            backgroundColor: rank === 1 ? '#fbbf24' : rank === 2 ? '#9ca3af' : rank === 3 ? '#d97706' : '#3b82f6',
          }}
        >
          {/* Rank */}
          <div
            className={`w-10 h-10 flex items-center justify-center font-bold ${
              rank === 1 ? 'text-yellow-900' : rank === 2 ? 'text-gray-700' : rank === 3 ? 'text-white' : 'text-white'
            }`}
          >
            {rank === 1 ? <Crown className="w-5 h-5" /> : <span className="text-lg">{rank}</span>}
          </div>
          {/* Vote count */}
          {showVoteCount && (
            <div
              className="w-full px-2 py-1 text-center"
              style={{
                backgroundColor: 'rgba(0,0,0,0.3)',
              }}
            >
              <span className="text-white text-xs font-semibold">{voteCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Name overlay - only show real names, not filenames */}
      {(() => {
        const isRealName = candidate.name &&
          !candidate.name.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i) &&
          !candidate.name.match(/^(IMG|DSC|Photo|Screenshot|Firefly|Adobe|DCIM|image)/i) &&
          !candidate.name.match(/^\d{5,}/) &&
          !candidate.name.match(/[_-]\d+$/) &&
          !candidate.name.match(/^[A-Za-z0-9_-]+\s*\(\d+\)$/);

        return showNames && isRealName ? (
          <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
            <p className="text-white text-xs font-medium truncate text-center">
              {candidate.name}
            </p>
          </div>
        ) : null;
      })()}
    </div>
  );
});

// List result item - Compact card with small image and details side by side
const ListResultItem = memo(function ListResultItem({
  candidate,
  rank,
  showNames,
  showVoteCount,
  isFinalsPhase,
  accentColor,
  textColor,
  backgroundColor,
  isRTL,
  votesLabel,
}: {
  candidate: Candidate;
  rank: number;
  showNames: boolean;
  showVoteCount: boolean;
  isFinalsPhase: boolean;
  accentColor: string;
  textColor: string;
  backgroundColor: string;
  isRTL: boolean;
  votesLabel: string;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const photo = candidate.photos[0];
  const voteCount = isFinalsPhase ? candidate.finalsVoteCount : candidate.voteCount;
  const isTopThree = rank <= 3;
  const ringColor = rank === 1 ? '#fbbf24' : rank === 2 ? '#9ca3af' : rank === 3 ? '#d97706' : undefined;

  // Check if name is real (not a filename)
  const isRealName = candidate.name &&
    !candidate.name.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i) &&
    !candidate.name.match(/^(IMG|DSC|Photo|Screenshot|Firefly|Adobe|DCIM|image)/i) &&
    !candidate.name.match(/^\d{5,}/) &&
    !candidate.name.match(/[_-]\d+$/) &&
    !candidate.name.match(/^[A-Za-z0-9_-]+\s*\(\d+\)$/);

  return (
    <div
      className="flex items-center gap-4 p-3 rounded-xl transition-all"
      style={{
        backgroundColor: `${backgroundColor}`,
        boxShadow: isTopThree && ringColor
          ? `0 0 0 2px ${ringColor}, 0 2px 8px ${textColor}10`
          : `0 2px 8px ${textColor}15`,
      }}
    >
      {/* Rank Badge with Vote Count */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold shadow-md ${
            rank === 1
              ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-yellow-900'
              : rank === 2
              ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-700'
              : rank === 3
              ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white'
              : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
          }`}
        >
          {rank === 1 ? <Crown className="w-6 h-6" /> : <span className="text-xl">{rank}</span>}
        </div>
        {showVoteCount && (
          <div
            className="mt-1 px-2 py-0.5 rounded-md text-xs font-semibold"
            style={{
              backgroundColor: rank === 1 ? '#fbbf24' : rank === 2 ? '#9ca3af' : rank === 3 ? '#d97706' : '#3b82f6',
              color: rank === 1 ? '#78350f' : rank === 2 ? '#374151' : '#ffffff',
            }}
          >
            {voteCount}
          </div>
        )}
      </div>

      {/* Image - Small square */}
      <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0">
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <Loader2 className="w-4 h-4 animate-spin text-white/60" />
          </div>
        )}

        {photo ? (
          <img
            src={photo.thumbnailUrl || photo.url}
            alt=""
            className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImageLoaded(true)}
          />
        ) : (
          <div className="w-full h-full bg-gray-700 flex items-center justify-center">
            <span className="text-xl text-gray-500">{candidate.name?.[0] || '?'}</span>
          </div>
        )}
      </div>

      {/* Info - Name only, vote count shown in badge */}
      <div className="flex-1 min-w-0 flex items-center">
        {showNames && isRealName && (
          <h3 className="font-semibold truncate text-lg" style={{ color: textColor }}>
            {candidate.name}
          </h3>
        )}
      </div>
    </div>
  );
});

// Top count selector
const TopCountSelector = memo(function TopCountSelector({
  value,
  onChange,
  maxCount,
  isRTL,
  textColor,
}: {
  value: number;
  onChange: (count: number) => void;
  maxCount: number;
  isRTL: boolean;
  textColor: string;
}) {
  const options = [3, 5, 10, 20, maxCount].filter((n, i, arr) => n <= maxCount && arr.indexOf(n) === i);

  return (
    <div className="flex items-center gap-2 justify-center mb-4">
      <span className="text-sm" style={{ color: `${textColor}80` }}>
        {isRTL ? 'הצג:' : 'Show:'}
      </span>
      <div className="flex gap-1 p-1 rounded-lg bg-black/20 backdrop-blur-sm">
        {options.map((count) => (
          <button
            key={count}
            onClick={() => onChange(count)}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
              value === count
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            {count === maxCount ? (isRTL ? 'הכל' : 'All') : `${isRTL ? 'טופ' : 'Top'} ${count}`}
          </button>
        ))}
      </div>
    </div>
  );
});

export default function QVoteResultsView({
  candidates,
  showNames,
  showVoteCount,
  isFinalsPhase,
  accentColor = '#3b82f6',
  textColor = '#1f2937',
  backgroundColor = '#ffffff',
  isRTL = false,
  logoUrl,
  flipbookSettings = DEFAULT_FLIPBOOK_SETTINGS,
  categoryName,
  translations: t,
}: QVoteResultsViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('flipbook');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [topCount, setTopCount] = useState(10);
  const [showHeader, setShowHeader] = useState(true);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const swiperRef = useRef<SwiperType | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Sort candidates by vote count
  const sortedCandidates = useMemo(() => {
    return [...candidates].sort((a, b) => {
      const aVotes = isFinalsPhase ? a.finalsVoteCount : a.voteCount;
      const bVotes = isFinalsPhase ? b.finalsVoteCount : b.voteCount;
      return bVotes - aVotes;
    });
  }, [candidates, isFinalsPhase]);

  // Get top N candidates (optionally reversed for countdown reveal in flipbook)
  const displayCandidates = useMemo(() => {
    const top = sortedCandidates.slice(0, topCount);
    // If startFromLast is true, reverse the order for countdown reveal (last place first)
    return flipbookSettings.startFromLast ? [...top].reverse() : top;
  }, [sortedCandidates, topCount, flipbookSettings.startFromLast]);

  // For grid and list views, always show first place at top (not reversed)
  const gridListCandidates = useMemo(() => {
    return sortedCandidates.slice(0, topCount);
  }, [sortedCandidates, topCount]);

  // Calculate actual rank for each candidate (accounting for reversed order)
  const getRank = useCallback((index: number) => {
    if (flipbookSettings.startFromLast) {
      return displayCandidates.length - index;
    }
    return index + 1;
  }, [displayCandidates.length, flipbookSettings.startFromLast]);

  // Top count options
  const topCountOptions = useMemo(() => {
    return [3, 5, 10, 20, sortedCandidates.length].filter(
      (n, i, arr) => n <= sortedCandidates.length && arr.indexOf(n) === i
    );
  }, [sortedCandidates.length]);

  // Load saved preferences
  useEffect(() => {
    const savedMode = localStorage.getItem(STORAGE_KEY) as ViewMode | null;
    if (savedMode && ['flipbook', 'list', 'grid'].includes(savedMode)) {
      setViewMode(savedMode);
    }
    const savedCount = localStorage.getItem(TOP_COUNT_KEY);
    if (savedCount) {
      const count = parseInt(savedCount, 10);
      if (!isNaN(count) && count > 0) {
        setTopCount(Math.min(count, candidates.length));
      }
    }
  }, [candidates.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Control key toggles header
      if (e.key === 'Control') {
        setShowHeader((prev) => !prev);
        return;
      }

      // Arrow keys for navigation in flipbook mode
      if (viewMode === 'flipbook') {
        if (e.key === 'ArrowLeft') {
          if (isRTL) {
            swiperRef.current?.slideNext();
          } else {
            swiperRef.current?.slidePrev();
          }
        } else if (e.key === 'ArrowRight') {
          if (isRTL) {
            swiperRef.current?.slidePrev();
          } else {
            swiperRef.current?.slideNext();
          }
        }
      }

      // Escape closes side menu
      if (e.key === 'Escape' && showSideMenu) {
        setShowSideMenu(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, isRTL, showSideMenu]);

  // Save preferences
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }, []);

  const handleTopCountChange = useCallback((count: number) => {
    setTopCount(count);
    localStorage.setItem(TOP_COUNT_KEY, count.toString());
    setCurrentIndex(0);
  }, []);

  const handleSwiperInit = useCallback((swiper: SwiperType) => {
    swiperRef.current = swiper;
  }, []);

  const handleSlideChange = useCallback((swiper: SwiperType) => {
    setCurrentIndex(swiper.activeIndex);
  }, []);

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < displayCandidates.length - 1;

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col relative overflow-hidden"
      style={{ backgroundColor }}
      dir={isRTL ? 'rtl' : 'ltr'}
      tabIndex={0}
    >
      {/* Header with Q Logo - Collapsible with Control key */}
      <div
        className={`shrink-0 z-30 transition-all duration-300 overflow-hidden ${
          showHeader ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
        }`}
        style={{
          backgroundColor,
          borderBottom: showHeader ? `1px solid ${textColor}10` : 'none',
        }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          {/* Settings Button - Left in RTL */}
          <button
            onClick={() => setShowSideMenu(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
            style={{ backgroundColor: `${textColor}10`, color: textColor }}
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Title */}
          <div className="flex-1 text-center min-w-0">
            <h2 className="text-lg font-bold truncate" style={{ color: textColor }}>
              {categoryName || t.resultsTitle}
            </h2>
            {categoryName && (
              <p className="text-xs" style={{ color: `${textColor}70` }}>
                {t.resultsTitle}
              </p>
            )}
          </div>

          {/* Q Logo - Links to main site */}
          <a
            href="https://qr.playzones.app"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-transform hover:scale-105 active:scale-95"
          >
            <img
              src={logoUrl || '/theQ.png'}
              alt="Q"
              className="h-10 w-auto object-contain"
            />
          </a>
        </div>
      </div>

      {/* Header toggle hint - shows when header is hidden */}
      {!showHeader && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-black/30 backdrop-blur-sm">
          <span className="text-white/70 text-xs">
            {isRTL ? 'לחצו Control להצגת הכותרת' : 'Press Control to show header'}
          </span>
        </div>
      )}

      {/* Side Menu Overlay */}
      {showSideMenu && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowSideMenu(false)}
        >
          <div
            className={`absolute top-0 ${isRTL ? 'left-0' : 'right-0'} h-full w-72 bg-white shadow-2xl`}
            style={{ backgroundColor }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Menu Header */}
            <div
              className="flex items-center justify-between px-4 py-4 border-b"
              style={{ borderColor: `${textColor}15` }}
            >
              <h3 className="font-bold text-lg" style={{ color: textColor }}>
                {isRTL ? 'הגדרות תצוגה' : 'Display Settings'}
              </h3>
              <button
                onClick={() => setShowSideMenu(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-gray-100"
              >
                <X className="w-5 h-5" style={{ color: textColor }} />
              </button>
            </div>

            {/* Menu Content */}
            <div className="p-4 space-y-6">
              {/* View Mode */}
              <div>
                <label className="block text-sm font-medium mb-3" style={{ color: `${textColor}80` }}>
                  {isRTL ? 'סגנון תצוגה' : 'View Mode'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { mode: 'flipbook' as ViewMode, icon: Layers, label: isRTL ? 'פליפבוק' : 'Flipbook' },
                    { mode: 'grid' as ViewMode, icon: LayoutGrid, label: isRTL ? 'גריד' : 'Grid' },
                    { mode: 'list' as ViewMode, icon: List, label: isRTL ? 'רשימה' : 'List' },
                  ].map(({ mode, icon: Icon, label }) => (
                    <button
                      key={mode}
                      onClick={() => handleViewModeChange(mode)}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all hover:bg-gray-100"
                      style={{
                        backgroundColor: viewMode === mode ? `${accentColor}15` : 'transparent',
                        boxShadow: viewMode === mode ? `0 0 0 2px ${accentColor}` : 'none',
                      }}
                    >
                      <Icon
                        className="w-6 h-6"
                        style={{ color: viewMode === mode ? accentColor : `${textColor}60` }}
                      />
                      <span
                        className="text-xs font-medium"
                        style={{ color: viewMode === mode ? accentColor : textColor }}
                      >
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Top Count */}
              <div>
                <label className="block text-sm font-medium mb-3" style={{ color: `${textColor}80` }}>
                  {isRTL ? 'הצג מספר תוצאות' : 'Show Results'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {topCountOptions.map((count) => (
                    <button
                      key={count}
                      onClick={() => handleTopCountChange(count)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        topCount === count ? 'text-white' : 'hover:bg-gray-100'
                      }`}
                      style={{
                        backgroundColor: topCount === count ? accentColor : `${textColor}08`,
                        color: topCount === count ? '#ffffff' : textColor,
                      }}
                    >
                      {count === sortedCandidates.length
                        ? isRTL
                          ? 'הכל'
                          : 'All'
                        : `${isRTL ? 'טופ' : 'Top'} ${count}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Keyboard Shortcuts */}
              <div
                className="p-3 rounded-xl text-sm"
                style={{ backgroundColor: `${textColor}05` }}
              >
                <p className="font-medium mb-2" style={{ color: textColor }}>
                  {isRTL ? 'קיצורי מקלדת' : 'Keyboard Shortcuts'}
                </p>
                <div className="space-y-1.5 text-xs" style={{ color: `${textColor}70` }}>
                  <div className="flex justify-between">
                    <span>{isRTL ? 'הסתר/הצג כותרת' : 'Toggle header'}</span>
                    <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-700">Control</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>{isRTL ? 'ניווט בין תמונות' : 'Navigate images'}</span>
                    <span>
                      <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-700">←</kbd>{' '}
                      <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-700">→</kbd>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 min-h-0 relative">
        {displayCandidates.length === 0 ? (
          <div
            className="h-full flex items-center justify-center text-center p-8"
            style={{ color: `${textColor}60` }}
          >
            {isRTL ? 'אין תוצאות' : 'No results'}
          </div>
        ) : viewMode === 'flipbook' ? (
          /* Flipbook View */
          <div className="absolute inset-0 flex flex-col" style={{ backgroundColor }}>
            <div className="flex-1 relative overflow-hidden">
              <Swiper
                modules={[EffectCards, Autoplay]}
                effect={flipbookSettings.effect3D ? 'cards' : 'slide'}
                grabCursor={true}
                speed={flipbookSettings.flipDuration}
                autoplay={flipbookSettings.autoPlay ? {
                  delay: flipbookSettings.autoPlayInterval,
                  disableOnInteraction: true,
                } : false}
                cardsEffect={flipbookSettings.effect3D ? {
                  slideShadows: true,
                  perSlideOffset: 8,
                  perSlideRotate: 2,
                } : undefined}
                dir={isRTL ? 'rtl' : 'ltr'}
                onSwiper={handleSwiperInit}
                onSlideChange={handleSlideChange}
                initialSlide={currentIndex}
                className="w-full h-full px-4 py-6"
              >
                {displayCandidates.map((candidate, index) => (
                  <SwiperSlide key={candidate.id} className="!flex items-center justify-center">
                    <FlipbookResultCard
                      candidate={candidate}
                      rank={getRank(index)}
                      showNames={showNames}
                      showVoteCount={showVoteCount}
                      isFinalsPhase={isFinalsPhase}
                      isRTL={isRTL}
                      votesLabel={t.votes}
                    />
                  </SwiperSlide>
                ))}
              </Swiper>

              {/* Navigation arrows - controlled by showControls setting */}
              {flipbookSettings.showControls && (
                <>
                  <button
                    onClick={() => swiperRef.current?.slidePrev()}
                    disabled={!canGoPrev}
                    className="absolute start-2 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-0 disabled:pointer-events-none hover:scale-110 hover:bg-white/30 active:scale-95 backdrop-blur-sm"
                    style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white' }}
                  >
                    <ChevronLeft className="w-6 h-6 drop-shadow-md" />
                  </button>

                  <button
                    onClick={() => swiperRef.current?.slideNext()}
                    disabled={!canGoNext}
                    className="absolute end-2 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-0 disabled:pointer-events-none hover:scale-110 hover:bg-white/30 active:scale-95 backdrop-blur-sm"
                    style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white' }}
                  >
                    <ChevronRight className="w-6 h-6 drop-shadow-md" />
                  </button>
                </>
              )}

              {/* Counter - controlled by showCounter setting */}
              {flipbookSettings.showCounter && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
                  <div className="px-4 py-2 rounded-full bg-black/50 backdrop-blur-sm">
                    <span className="text-white font-semibold">
                      {flipbookSettings.startFromLast
                        ? `${getRank(currentIndex)} / ${displayCandidates.length}`
                        : `${currentIndex + 1} / ${displayCandidates.length}`
                      }
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View - Fit all items without scrolling */
          <div
            className="absolute inset-0 p-4 flex items-center justify-center"
            style={{ backgroundColor }}
          >
            <div
              className="w-full h-full grid gap-2 place-content-center"
              style={{
                // Calculate optimal grid layout based on item count
                // For n items, find best rows x cols that fills the space
                gridTemplateColumns: `repeat(${
                  gridListCandidates.length <= 1 ? 1 :
                  gridListCandidates.length <= 2 ? 2 :
                  gridListCandidates.length <= 4 ? 2 :
                  gridListCandidates.length <= 6 ? 3 :
                  gridListCandidates.length <= 9 ? 3 :
                  gridListCandidates.length <= 12 ? 4 :
                  gridListCandidates.length <= 16 ? 4 :
                  gridListCandidates.length <= 20 ? 5 :
                  gridListCandidates.length <= 25 ? 5 :
                  6
                }, 1fr)`,
                gridAutoRows: '1fr',
              }}
            >
              {gridListCandidates.map((candidate, index) => (
                <GridResultItem
                  key={candidate.id}
                  candidate={candidate}
                  rank={index + 1}
                  showNames={showNames}
                  showVoteCount={showVoteCount}
                  isFinalsPhase={isFinalsPhase}
                  accentColor={accentColor}
                  textColor={textColor}
                  isRTL={isRTL}
                />
              ))}
            </div>
          </div>
        ) : (
          /* List View - Compact cards with first place at top */
          <div
            className="absolute inset-0 overflow-y-auto overscroll-contain scroll-smooth"
            style={{ backgroundColor }}
          >
            <div className="flex flex-col gap-3 p-4 pb-24">
              {gridListCandidates.map((candidate, index) => (
                <ListResultItem
                  key={candidate.id}
                  candidate={candidate}
                  rank={index + 1}
                  showNames={showNames}
                  showVoteCount={showVoteCount}
                  isFinalsPhase={isFinalsPhase}
                  accentColor={accentColor}
                  textColor={textColor}
                  backgroundColor={backgroundColor}
                  isRTL={isRTL}
                  votesLabel={t.votes}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
