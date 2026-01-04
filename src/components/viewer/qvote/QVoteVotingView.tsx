'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Check, ChevronLeft, Loader2, Vote, X, RefreshCw } from 'lucide-react';
import type { Candidate, QVoteConfig } from '@/types/qvote';
import QVoteViewModeSelector, { ViewMode } from './QVoteViewModeSelector';
import QVoteSelectedBubbles from './QVoteSelectedBubbles';
import QVoteFlipbookView from './QVoteFlipbookView';
import QVoteListView from './QVoteListView';
import QVoteGridView from './QVoteGridView';

const STORAGE_KEY = 'qvote-view-mode';

interface QVoteVotingViewProps {
  candidates: Candidate[];
  config: QVoteConfig;
  selectedCandidates: string[];
  onSelectCandidate: (candidateId: string) => void;
  hasVoted: boolean;
  submitting: boolean;
  onSubmitVote: () => void;
  selectedCategory: string | null;
  onBackToCategories: () => void;
  locale: 'he' | 'en';
  voteChangeCount?: number;
  onResetVote?: () => void;
  translations: {
    votingTitle: string;
    finalsTitle: string;
    selectUpTo: string;
    submitVote: string;
    voteSubmitted: string;
    thankYou: string;
    yourSelections: string;
    noCandidates: string;
    votes: string;
    changeVote?: string;
    confirmChangeVote?: string;
    cancel?: string;
    confirm?: string;
    changesRemaining?: string;
  };
}

export default function QVoteVotingView({
  candidates,
  config,
  selectedCandidates,
  onSelectCandidate,
  hasVoted,
  submitting,
  onSubmitVote,
  selectedCategory,
  onBackToCategories,
  locale,
  voteChangeCount = 0,
  onResetVote,
  translations: t,
}: QVoteVotingViewProps) {
  const isRTL = locale === 'he';
  const isFinalsPhase = config.currentPhase === 'finals';
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Calculate if vote change is allowed
  const maxVoteChanges = config.maxVoteChanges ?? 0;
  const canChangeVote = hasVoted && onResetVote && (
    maxVoteChanges === -1 || // Unlimited
    (maxVoteChanges > 0 && voteChangeCount < maxVoteChanges)
  );
  const changesRemaining = maxVoteChanges === -1 ? -1 : maxVoteChanges - voteChangeCount;

  // View mode state with localStorage persistence
  const [viewMode, setViewMode] = useState<ViewMode>('flipbook');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scrollTargetIndex, setScrollTargetIndex] = useState<number | null>(null);

  // Load saved view mode preference
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ViewMode | null;
    if (saved && ['flipbook', 'list', 'grid'].includes(saved)) {
      setViewMode(saved);
    }
  }, []);

  // Save view mode preference
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }, []);

  // Branding styles
  const brandingStyles = useMemo(
    () => ({
      background: config.branding.colors.background || '#ffffff',
      text: config.branding.colors.text || '#1f2937',
      buttonBg: config.branding.colors.buttonBackground || '#3b82f6',
      buttonText: config.branding.colors.buttonText || '#ffffff',
      accent: config.branding.colors.accent || config.branding.colors.buttonBackground || '#3b82f6',
    }),
    [config.branding.colors]
  );

  // Filter candidates based on category (supports both categoryId and categoryIds)
  const filteredCandidates = useMemo(() => {
    if (!selectedCategory) return candidates;
    return candidates.filter((c) => {
      // Check categoryIds array first (new multi-category support)
      if (c.categoryIds && c.categoryIds.length > 0) {
        return c.categoryIds.includes(selectedCategory);
      }
      // Fallback to legacy single categoryId
      return c.categoryId === selectedCategory;
    });
  }, [candidates, selectedCategory]);

  // Handle navigation from bubbles
  const handleNavigateToCandidate = useCallback(
    (index: number) => {
      if (viewMode === 'flipbook') {
        setCurrentIndex(index);
      } else {
        setScrollTargetIndex(index);
      }
    },
    [viewMode]
  );

  // Handle deselect from bubbles
  const handleDeselectFromBubble = useCallback(
    (candidateId: string) => {
      onSelectCandidate(candidateId);
    },
    [onSelectCandidate]
  );

  return (
    <div
      className="flex-1 flex flex-col relative overflow-hidden"
      style={{ backgroundColor: brandingStyles.background }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header with Logo, Category Name, and Back Button - Fixed */}
      <div
        className="fixed top-0 left-0 right-0 px-4 py-3 z-50"
        style={{
          backgroundColor: brandingStyles.background,
          borderBottom: `1px solid ${brandingStyles.text}10`,
        }}
      >
        <div className="flex items-center gap-3">
          {/* Back button (if categories) */}
          {selectedCategory && config.categories.length > 0 && (
            <button
              onClick={onBackToCategories}
              className="p-2 -ms-2 rounded-full transition-colors hover:bg-black/10 active:scale-95"
              style={{ color: brandingStyles.text }}
              title={isRTL ? 'חזרה לקטגוריות' : 'Back to categories'}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Title - Category name or voting title */}
          <div className="flex-1 min-w-0">
            {selectedCategory && config.categories.length > 0 ? (
              <>
                {/* Category name */}
                <h2
                  className="text-lg font-bold truncate"
                  style={{ color: brandingStyles.text }}
                >
                  {(() => {
                    const category = config.categories.find(c => c.id === selectedCategory);
                    return locale === 'en' && category?.nameEn ? category.nameEn : category?.name || '';
                  })()}
                </h2>
                {!hasVoted && (
                  <p
                    className="text-xs"
                    style={{ color: `${brandingStyles.text}70` }}
                  >
                    {t.selectUpTo.replace('{n}', String(config.maxSelectionsPerVoter))}
                  </p>
                )}
              </>
            ) : (
              <>
                <h2
                  className="text-lg font-bold truncate"
                  style={{ color: brandingStyles.text }}
                >
                  {isFinalsPhase ? t.finalsTitle : t.votingTitle}
                </h2>
                {!hasVoted && (
                  <p
                    className="text-xs"
                    style={{ color: `${brandingStyles.text}70` }}
                  >
                    {t.selectUpTo.replace('{n}', String(config.maxSelectionsPerVoter))}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Q Logo - Links to main site */}
          <a
            href="https://qr.playzones.app"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 transition-transform hover:scale-105 active:scale-95"
          >
            <img
              src="/theQ.png"
              alt="Q"
              className="w-8 h-8 object-contain"
            />
          </a>
        </div>
      </div>

      {/* Spacer for fixed header */}
      <div className="h-14 shrink-0" />

      {/* Vote Success Banner */}
      {hasVoted && (
        <div
          className="mx-4 my-3 p-4 rounded-xl text-center animate-qvote-check relative"
          style={{
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
          }}
        >
          {/* X button to change vote */}
          {canChangeVote && (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="absolute top-2 end-2 p-1.5 rounded-full hover:bg-green-500/20 transition-colors"
              title={t.changeVote || (isRTL ? 'שנה הצבעה' : 'Change vote')}
            >
              <X className="w-5 h-5 text-green-600" />
            </button>
          )}
          <Check className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="font-semibold text-green-600">{t.voteSubmitted}</p>
          <p className="text-sm text-green-600/80">{t.thankYou}</p>
          {canChangeVote && changesRemaining > 0 && (
            <p className="text-xs text-green-600/60 mt-2">
              {(t.changesRemaining || (isRTL ? 'נותרו {n} שינויים' : '{n} changes remaining')).replace('{n}', String(changesRemaining))}
            </p>
          )}
        </div>
      )}

      {/* Reset Vote Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowResetConfirm(false)}
          />
          <div
            className="relative w-full max-w-sm p-6 rounded-2xl shadow-xl"
            style={{ backgroundColor: brandingStyles.background }}
          >
            <div className="text-center">
              <div
                className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ backgroundColor: `${brandingStyles.accent}20` }}
              >
                <RefreshCw className="w-7 h-7" style={{ color: brandingStyles.accent }} />
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: brandingStyles.text }}>
                {t.confirmChangeVote || (isRTL ? 'לשנות את ההצבעה?' : 'Change your vote?')}
              </h3>
              <p className="text-sm mb-6" style={{ color: `${brandingStyles.text}80` }}>
                {isRTL
                  ? 'ההצבעה הקודמת תבוטל ותוכלו לבחור מחדש'
                  : 'Your previous vote will be cancelled and you can choose again'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-3 rounded-xl font-medium transition-colors"
                  style={{
                    backgroundColor: `${brandingStyles.text}10`,
                    color: brandingStyles.text,
                  }}
                >
                  {t.cancel || (isRTL ? 'ביטול' : 'Cancel')}
                </button>
                <button
                  onClick={() => {
                    setShowResetConfirm(false);
                    onResetVote?.();
                  }}
                  className="flex-1 py-3 rounded-xl font-medium transition-colors"
                  style={{
                    backgroundColor: brandingStyles.accent,
                    color: '#ffffff',
                  }}
                >
                  {t.confirm || (isRTL ? 'אישור' : 'Confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 min-h-0 relative">
        {filteredCandidates.length === 0 ? (
          <div
            className="h-full flex items-center justify-center text-center p-8"
            style={{ color: `${brandingStyles.text}60` }}
          >
            {t.noCandidates}
          </div>
        ) : viewMode === 'flipbook' ? (
          <QVoteFlipbookView
            candidates={filteredCandidates}
            selectedIds={selectedCandidates}
            maxSelections={config.maxSelectionsPerVoter}
            onSelect={onSelectCandidate}
            onSlideChange={setCurrentIndex}
            currentIndex={currentIndex}
            hasVoted={hasVoted}
            showNames={config.showNames}
            showVoteCount={config.showVoteCount}
            isFinalsPhase={isFinalsPhase}
            accentColor={brandingStyles.accent}
            textColor={brandingStyles.text}
            backgroundColor={brandingStyles.background}
            isRTL={isRTL}
          />
        ) : viewMode === 'list' ? (
          <QVoteListView
            candidates={filteredCandidates}
            selectedIds={selectedCandidates}
            maxSelections={config.maxSelectionsPerVoter}
            onSelect={onSelectCandidate}
            onScrollToIndex={setScrollTargetIndex}
            targetIndex={scrollTargetIndex}
            hasVoted={hasVoted}
            showNames={config.showNames}
            showVoteCount={config.showVoteCount}
            isFinalsPhase={isFinalsPhase}
            accentColor={brandingStyles.accent}
            textColor={brandingStyles.text}
            backgroundColor={brandingStyles.background}
            isRTL={isRTL}
          />
        ) : (
          <QVoteGridView
            candidates={filteredCandidates}
            selectedIds={selectedCandidates}
            maxSelections={config.maxSelectionsPerVoter}
            onSelect={onSelectCandidate}
            onScrollToIndex={setScrollTargetIndex}
            targetIndex={scrollTargetIndex}
            hasVoted={hasVoted}
            showNames={config.showNames}
            showVoteCount={config.showVoteCount}
            isFinalsPhase={isFinalsPhase}
            accentColor={brandingStyles.accent}
            textColor={brandingStyles.text}
            backgroundColor={brandingStyles.background}
            isRTL={isRTL}
          />
        )}

        {/* Floating View Mode Selector */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
          <QVoteViewModeSelector
            viewMode={viewMode}
            onChange={handleViewModeChange}
            accentColor={brandingStyles.accent}
            textColor={brandingStyles.text}
          />
        </div>
      </div>

      {/* Selected Bubbles (floating) */}
      {!hasVoted && (
        <QVoteSelectedBubbles
          candidates={filteredCandidates}
          selectedIds={selectedCandidates}
          currentIndex={viewMode === 'flipbook' ? currentIndex : -1}
          maxSelections={config.maxSelectionsPerVoter}
          onNavigateTo={handleNavigateToCandidate}
          onDeselect={handleDeselectFromBubble}
          accentColor={brandingStyles.accent}
          textColor={brandingStyles.text}
          isRTL={isRTL}
        />
      )}

      {/* Submit Button Bar - slides in when all candidates selected */}
      {!hasVoted && (
        <div
          className={`fixed left-0 right-0 p-4 z-50 transition-all duration-500 ease-out ${
            selectedCandidates.length >= config.maxSelectionsPerVoter
              ? 'bottom-0 opacity-100 translate-y-0'
              : 'bottom-0 opacity-0 translate-y-full pointer-events-none'
          }`}
          style={{
            backgroundColor: brandingStyles.background,
            borderTop: `1px solid ${brandingStyles.text}15`,
            boxShadow: `0 -4px 24px ${brandingStyles.text}10`,
          }}
        >
          <button
            onClick={onSubmitVote}
            disabled={submitting}
            className={`relative w-full py-4 rounded-2xl font-bold text-lg transition-all duration-300 active:scale-[0.98] overflow-hidden ${
              !submitting ? 'animate-qvote-breathe' : ''
            }`}
            style={{
              backgroundColor: '#22c55e',
              color: '#ffffff',
              boxShadow: '0 4px 30px rgba(34, 197, 94, 0.5)',
            }}
          >
            {/* Animated gradient overlay when button is active */}
            {!submitting && (
              <div
                className="absolute inset-0 animate-qvote-shimmer"
                style={{
                  background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)`,
                  backgroundSize: '200% 100%',
                }}
              />
            )}

            {submitting ? (
              <Loader2 className="w-6 h-6 animate-spin mx-auto" />
            ) : (
              <span className="relative flex items-center justify-center gap-2">
                <Vote className="w-5 h-5 animate-pulse" />
                {t.submitVote}
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
