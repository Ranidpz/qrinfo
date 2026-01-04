'use client';

import { memo, useCallback, useRef, useState, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCards, Virtual } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { Candidate } from '@/types/qvote';
import QVoteBoomerangImage from './QVoteBoomerangImage';

import 'swiper/css';
import 'swiper/css/effect-cards';

interface QVoteFlipbookViewProps {
  candidates: Candidate[];
  selectedIds: string[];
  maxSelections: number;
  onSelect: (candidateId: string) => void;
  onSlideChange: (index: number) => void;
  currentIndex: number;
  hasVoted: boolean;
  showNames: boolean;
  showVoteCount: boolean;
  isFinalsPhase: boolean;
  accentColor?: string;
  textColor?: string;
  backgroundColor?: string;
  isRTL?: boolean;
}

const QVoteFlipbookView = memo(function QVoteFlipbookView({
  candidates,
  selectedIds,
  maxSelections,
  onSelect,
  onSlideChange,
  currentIndex,
  hasVoted,
  showNames,
  showVoteCount,
  isFinalsPhase,
  accentColor = '#3b82f6',
  textColor = '#1f2937',
  backgroundColor = '#ffffff',
  isRTL = false,
}: QVoteFlipbookViewProps) {
  const swiperRef = useRef<SwiperType | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'selected' | 'deselected' | 'max'>('selected');
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  // Navigate to specific slide
  useEffect(() => {
    if (swiperRef.current && swiperRef.current.activeIndex !== currentIndex) {
      swiperRef.current.slideTo(currentIndex);
    }
  }, [currentIndex]);

  const handleImageLoad = useCallback((id: string) => {
    setLoadedImages(prev => new Set(prev).add(id));
  }, []);

  const handleSelect = useCallback(
    (candidateId: string) => {
      if (hasVoted) return;

      const isSelected = selectedIds.includes(candidateId);

      if (isSelected) {
        setFeedbackType('deselected');
        onSelect(candidateId);
      } else if (selectedIds.length >= maxSelections) {
        setFeedbackType('max');
      } else {
        setFeedbackType('selected');
        onSelect(candidateId);
      }

      setShowFeedback(true);
      setTimeout(() => setShowFeedback(false), 500);
    },
    [selectedIds, maxSelections, hasVoted, onSelect]
  );

  const handleSwiperInit = useCallback((swiper: SwiperType) => {
    swiperRef.current = swiper;
  }, []);

  const handleSlideChange = useCallback(
    (swiper: SwiperType) => {
      onSlideChange(swiper.activeIndex);
    },
    [onSlideChange]
  );

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < candidates.length - 1;

  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor }}>
      {/* Main Swiper Area */}
      <div className="flex-1 relative overflow-hidden">
        <Swiper
          modules={[EffectCards]}
          effect="cards"
          grabCursor={true}
          cardsEffect={{
            slideShadows: true,
            perSlideOffset: 8,
            perSlideRotate: 2,
          }}
          dir={isRTL ? 'rtl' : 'ltr'}
          onSwiper={handleSwiperInit}
          onSlideChange={handleSlideChange}
          initialSlide={currentIndex}
          className="w-full h-full px-2 py-3"
        >
          {candidates.map((candidate, index) => {
            const isSelected = selectedIds.includes(candidate.id);
            const photos = candidate.photos;
            const hasTwoPhotos = photos.length === 2;
            const photo = photos[0];
            const isLoaded = loadedImages.has(candidate.id);

            return (
              <SwiperSlide key={candidate.id} className="!flex items-center justify-center">
                <div
                  onClick={() => handleSelect(candidate.id)}
                  className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl cursor-pointer transition-transform active:scale-[0.98]"
                  style={{
                    backgroundColor: '#f3f4f6',
                    boxShadow: isSelected
                      ? `0 0 0 4px ${accentColor}, 0 25px 50px -12px rgba(0,0,0,0.4)`
                      : '0 25px 50px -12px rgba(0,0,0,0.25)',
                  }}
                >
                  {/* Loading spinner */}
                  {!isLoaded && !hasTwoPhotos && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10">
                      <div className="relative">
                        <Loader2 className="w-16 h-16 animate-spin text-white/60" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-white/80 text-sm font-bold">
                            {Math.round((loadedImages.size / candidates.length) * 100)}%
                          </span>
                        </div>
                      </div>
                      <p className="mt-4 text-white/70 text-sm font-medium">
                        {isRTL ? 'טוען מועמדים...' : 'Loading candidates...'}
                      </p>
                    </div>
                  )}

                  {/* Image */}
                  <div className="absolute inset-0">
                    {hasTwoPhotos ? (
                      <QVoteBoomerangImage photos={photos} className="w-full h-full" />
                    ) : (
                      <img
                        src={photo?.thumbnailUrl || photo?.url}
                        alt=""
                        className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                        onLoad={() => handleImageLoad(candidate.id)}
                        loading={Math.abs(index - currentIndex) < 3 ? 'eager' : 'lazy'}
                      />
                    )}
                  </div>

                  {/* Selection indicator */}
                  {isSelected && (
                    <div
                      className="absolute top-4 end-4 w-14 h-14 rounded-full flex items-center justify-center z-20 animate-qvote-check"
                      style={{
                        backgroundColor: accentColor,
                        boxShadow: `0 4px 24px ${accentColor}70`,
                      }}
                    >
                      <Check className="w-8 h-8 text-white" strokeWidth={3} />
                    </div>
                  )}

                  {/* Tap hint on first slides */}
                  {index < 2 && !hasVoted && !isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                      <div className="flex flex-col items-center gap-3 animate-pulse">
                        <div
                          className="w-20 h-20 rounded-full border-3 flex items-center justify-center"
                          style={{ borderColor: 'white', backgroundColor: 'rgba(0,0,0,0.3)' }}
                        >
                          <span className="text-4xl">👆</span>
                        </div>
                        <span className="text-white text-sm font-semibold px-4 py-2 rounded-full bg-black/50 backdrop-blur-sm">
                          {isRTL ? 'לחצו לבחירה' : 'Tap to select'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Bottom info gradient - only show if there's real content */}
                  {(() => {
                    // Check if name looks like a real name (not a filename)
                    const isRealName = candidate.name &&
                      !candidate.name.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i) &&
                      !candidate.name.match(/^(IMG|DSC|Photo|Screenshot|Firefly|Adobe)/i) &&
                      !candidate.name.match(/^\d{5,}/) &&
                      !candidate.name.match(/[_-]\d+$/);

                    const hasContent = (showNames && isRealName) || showVoteCount;

                    if (hasContent) {
                      return (
                        <div
                          className="absolute bottom-0 inset-x-0 p-4 z-10"
                          style={{
                            background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                          }}
                        >
                          <div className="flex items-end justify-between">
                            <div className="flex-1 min-w-0">
                              {showNames && isRealName && (
                                <h3 className="text-white text-xl font-bold truncate drop-shadow-lg">
                                  {candidate.name}
                                </h3>
                              )}
                              {showVoteCount && (
                                <p className="text-white/80 text-sm mt-0.5">
                                  {isFinalsPhase ? candidate.finalsVoteCount : candidate.voteCount} {isRTL ? 'קולות' : 'votes'}
                                </p>
                              )}
                            </div>

                            {/* Counter */}
                            <div className="text-white/90 text-sm font-semibold px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm">
                              {index + 1} / {candidates.length}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    /* Counter only when no name/votes */
                    return (
                      <div className="absolute bottom-4 end-4 z-10">
                        <div className="text-white/90 text-sm font-semibold px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-sm">
                          {index + 1} / {candidates.length}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </SwiperSlide>
            );
          })}
        </Swiper>

        {/* Navigation arrows - glassy/transparent */}
        <button
          onClick={() => swiperRef.current?.slidePrev()}
          disabled={!canGoPrev}
          className="absolute start-2 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-0 disabled:pointer-events-none hover:scale-110 hover:bg-white/30 active:scale-95 backdrop-blur-sm"
          style={{
            backgroundColor: 'rgba(255,255,255,0.15)',
            color: 'white',
          }}
        >
          <ChevronLeft className="w-6 h-6 drop-shadow-md" />
        </button>

        <button
          onClick={() => swiperRef.current?.slideNext()}
          disabled={!canGoNext}
          className="absolute end-2 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-0 disabled:pointer-events-none hover:scale-110 hover:bg-white/30 active:scale-95 backdrop-blur-sm"
          style={{
            backgroundColor: 'rgba(255,255,255,0.15)',
            color: 'white',
          }}
        >
          <ChevronRight className="w-6 h-6 drop-shadow-md" />
        </button>

        {/* Selection feedback overlay */}
        {showFeedback && (
          <div
            className={`absolute inset-0 z-30 pointer-events-none flex items-center justify-center ${
              feedbackType === 'max' ? 'animate-qvote-shake' : ''
            }`}
          >
            <div
              className={`w-28 h-28 rounded-full flex items-center justify-center animate-qvote-check ${
                feedbackType === 'selected'
                  ? 'bg-green-500'
                  : feedbackType === 'deselected'
                  ? 'bg-gray-500'
                  : 'bg-red-500'
              }`}
              style={{
                boxShadow: `0 8px 40px ${
                  feedbackType === 'selected'
                    ? 'rgba(34,197,94,0.6)'
                    : feedbackType === 'deselected'
                    ? 'rgba(107,114,128,0.6)'
                    : 'rgba(239,68,68,0.6)'
                }`,
              }}
            >
              {feedbackType === 'selected' && <Check className="w-14 h-14 text-white" strokeWidth={3} />}
              {feedbackType === 'deselected' && <Check className="w-14 h-14 text-white opacity-50" strokeWidth={3} />}
              {feedbackType === 'max' && <span className="text-5xl text-white">!</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default QVoteFlipbookView;
