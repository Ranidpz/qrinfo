'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { ThumbsUp, ThumbsDown, Check, Loader2 } from 'lucide-react';
import { QStageConfig, QStageVoteType, QStageAvatarType, QStagePhase, QSTAGE_TRANSLATIONS } from '@/types/qstage';
import { useQStageConfig, useQStageStats } from '@/hooks/useQStageRealtime';
import { QStageAvatarPicker } from './QStageAvatarPicker';

// Swipe card threshold
const SWIPE_THRESHOLD = 100;

// Swipe voting card component
interface SwipeVotingCardProps {
  selectedAvatar: { type: QStageAvatarType; value: string } | null;
  primaryColor: string;
  likeIcon: string;
  dislikeIcon: string;
  likeText: string;
  dislikeText: string;
  error: string | null;
  isSubmitting: boolean;
  onVote: (vote: QStageVoteType) => void;
  t: typeof QSTAGE_TRANSLATIONS['he'];
}

function SwipeVotingCard({
  selectedAvatar,
  primaryColor,
  likeIcon,
  dislikeIcon,
  likeText,
  dislikeText,
  error,
  isSubmitting,
  onVote,
  t,
}: SwipeVotingCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);

  // Calculate swipe progress (-1 to 1)
  const progress = Math.min(Math.max(dragX / SWIPE_THRESHOLD, -1), 1);
  const isLikeActive = progress > 0.3;
  const isDislikeActive = progress < -0.3;

  // Handle touch/mouse start
  const handleStart = useCallback((clientX: number) => {
    if (isSubmitting || hasVoted) return;
    setIsDragging(true);
    setStartX(clientX);
  }, [isSubmitting, hasVoted]);

  // Handle touch/mouse move
  const handleMove = useCallback((clientX: number) => {
    if (!isDragging || isSubmitting || hasVoted) return;
    const diff = clientX - startX;
    setDragX(diff);
  }, [isDragging, startX, isSubmitting, hasVoted]);

  // Handle touch/mouse end
  const handleEnd = useCallback(() => {
    if (!isDragging || isSubmitting || hasVoted) return;
    setIsDragging(false);

    // Check if swipe exceeded threshold
    if (Math.abs(dragX) >= SWIPE_THRESHOLD) {
      setHasVoted(true);
      const voteType: QStageVoteType = dragX > 0 ? 'like' : 'dislike';
      // Animate card off screen
      setDragX(dragX > 0 ? 500 : -500);
      // Submit vote after animation
      setTimeout(() => {
        onVote(voteType);
      }, 200);
    } else {
      // Spring back to center
      setDragX(0);
    }
  }, [isDragging, dragX, isSubmitting, hasVoted, onVote]);

  // Touch event handlers
  const onTouchStart = (e: React.TouchEvent) => handleStart(e.touches[0].clientX);
  const onTouchMove = (e: React.TouchEvent) => handleMove(e.touches[0].clientX);
  const onTouchEnd = () => handleEnd();

  // Mouse event handlers (for desktop testing)
  const onMouseDown = (e: React.MouseEvent) => handleStart(e.clientX);
  const onMouseMove = (e: React.MouseEvent) => handleMove(e.clientX);
  const onMouseUp = () => handleEnd();
  const onMouseLeave = () => { if (isDragging) handleEnd(); };

  // Calculate card rotation based on drag
  const rotation = (dragX / 20);
  const opacity = Math.min(1, Math.abs(progress) * 2);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 relative overflow-hidden">
      {/* Swipe indicators */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-4 pointer-events-none">
        {/* Dislike indicator (LEFT side - card goes here when swiping left) */}
        <div
          className="flex flex-col items-center gap-2 transition-all duration-200"
          style={{
            opacity: isDislikeActive ? 1 : 0.3,
            transform: `scale(${isDislikeActive ? 1.2 : 1})`,
          }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{
              background: isDislikeActive ? '#ff3355' : 'rgba(255, 51, 85, 0.2)',
              boxShadow: isDislikeActive ? '0 0 30px #ff335560' : 'none',
            }}
          >
            <span className="text-3xl">{dislikeIcon}</span>
          </div>
          <span className={`font-bold text-sm ${isDislikeActive ? 'text-[#ff3355]' : 'text-[#ff3355]/50'}`}>
            {dislikeText}
          </span>
        </div>

        {/* Like indicator (RIGHT side - card goes here when swiping right) */}
        <div
          className="flex flex-col items-center gap-2 transition-all duration-200"
          style={{
            opacity: isLikeActive ? 1 : 0.3,
            transform: `scale(${isLikeActive ? 1.2 : 1})`,
          }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{
              background: isLikeActive ? '#00ff88' : 'rgba(0, 255, 136, 0.2)',
              boxShadow: isLikeActive ? '0 0 30px #00ff8860' : 'none',
            }}
          >
            <span className="text-3xl">{likeIcon}</span>
          </div>
          <span className={`font-bold text-sm ${isLikeActive ? 'text-[#00ff88]' : 'text-[#00ff88]/50'}`}>
            {likeText}
          </span>
        </div>
      </div>

      {/* Instruction text */}
      <p className="text-white/40 text-sm mb-6 text-center">
        {'←'} {dislikeText} &nbsp;|&nbsp; {likeText} {'→'}
      </p>

      {/* Swipeable card */}
      <div
        ref={cardRef}
        className="w-64 h-80 rounded-3xl flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none touch-none"
        style={{
          background: 'linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
          border: `3px solid ${
            isLikeActive ? '#00ff88' : isDislikeActive ? '#ff3355' : `${primaryColor}40`
          }`,
          boxShadow: `
            0 20px 60px rgba(0,0,0,0.5),
            ${isLikeActive ? '0 0 40px #00ff8840' : ''}
            ${isDislikeActive ? '0 0 40px #ff335540' : ''}
          `,
          transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
          transition: isDragging ? 'none' : 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      >
        {isSubmitting ? (
          <Loader2 className="w-16 h-16 text-white animate-spin" />
        ) : (
          <>
            {/* Avatar */}
            {selectedAvatar && (
              <div
                className="w-24 h-24 rounded-full mb-4 flex items-center justify-center overflow-hidden"
                style={{
                  background: selectedAvatar.type === 'emoji'
                    ? 'rgba(255, 255, 255, 0.15)'
                    : 'transparent',
                  border: `3px solid rgba(255,255,255,0.2)`,
                }}
              >
                {selectedAvatar.type === 'emoji' ? (
                  <span className="text-5xl">{selectedAvatar.value}</span>
                ) : (
                  <img
                    src={selectedAvatar.value}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            )}

            <h2 className="text-2xl font-bold text-white mb-2">{t.vote}</h2>
            <p className="text-white/50 text-sm">{t.swipeToVote || 'Swipe to vote'}</p>

            {/* Direction indicators on card */}
            <div className="flex items-center gap-8 mt-6">
              <span className="text-3xl opacity-50">{dislikeIcon}</span>
              <div className="w-12 h-1 bg-white/20 rounded-full" />
              <span className="text-3xl opacity-50">{likeIcon}</span>
            </div>
          </>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-4 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}

interface QStageMobileVoterProps {
  codeId: string;
  mediaId: string;
  initialConfig?: QStageConfig;
}

type VoterStep = 'landing' | 'avatar' | 'voting' | 'voted';

/**
 * QStageMobileVoter - Complete mobile voting experience
 * Landing → Avatar Selection → Vote → Confirmation
 */
export function QStageMobileVoter({
  codeId,
  mediaId,
  initialConfig,
}: QStageMobileVoterProps) {
  // Real-time data
  const { config, loading: configLoading } = useQStageConfig(codeId, mediaId);
  const { stats } = useQStageStats(codeId);

  // Local state
  const [step, setStep] = useState<VoterStep>('landing');
  const [selectedAvatar, setSelectedAvatar] = useState<{
    type: QStageAvatarType;
    value: string;
  } | null>(null);
  const [myVote, setMyVote] = useState<QStageVoteType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // Use config from props or real-time
  const currentConfig = config || initialConfig;

  // Determine locale
  const locale = currentConfig?.language === 'auto'
    ? (typeof navigator !== 'undefined' && navigator.language.startsWith('he') ? 'he' : 'en')
    : (currentConfig?.language || 'he');
  const isRTL = locale === 'he';
  const t = QSTAGE_TRANSLATIONS[locale];

  // Get visitor ID from localStorage
  const [visitorId, setVisitorId] = useState<string>('');
  useEffect(() => {
    let id = localStorage.getItem('qstage_visitor_id');
    if (!id) {
      id = `visitor_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      localStorage.setItem('qstage_visitor_id', id);
    }
    setVisitorId(id);

    // Check if already voted
    const votedKey = `qstage_voted_${codeId}`;
    const hasVoted = localStorage.getItem(votedKey);
    if (hasVoted) {
      const voteData = JSON.parse(hasVoted);
      setSelectedAvatar(voteData.avatar);
      setMyVote(voteData.vote);
      setStep('voted');
    }
  }, [codeId]);

  // Handle avatar selection
  const handleAvatarSelect = useCallback((type: QStageAvatarType, value: string) => {
    setSelectedAvatar({ type, value });
    // Auto-advance to voting
    setTimeout(() => setStep('voting'), 300);
  }, []);

  // Handle vote submission
  const handleVote = useCallback(async (voteType: QStageVoteType) => {
    if (!selectedAvatar || !visitorId || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/qstage/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeId,
          visitorId,
          voteType,
          avatarType: selectedAvatar.type,
          avatarValue: selectedAvatar.value,
          isJudge: false,
          weight: 1,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Vote failed');
      }

      // Success!
      setMyVote(voteType);
      setStep('voted');
      setShowConfetti(true);

      // Save to localStorage
      localStorage.setItem(`qstage_voted_${codeId}`, JSON.stringify({
        avatar: selectedAvatar,
        vote: voteType,
        timestamp: Date.now(),
      }));

      // Hide confetti after animation
      setTimeout(() => setShowConfetti(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vote failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [codeId, visitorId, selectedAvatar, isSubmitting]);

  // Loading state
  if (configLoading || !currentConfig) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
      </div>
    );
  }

  const { branding, likeIcon, dislikeIcon, likeLabel, likeLabelEn, dislikeLabel, dislikeLabelEn } = currentConfig;
  const primaryColor = branding.primaryColor || '#00d4ff';
  const successColor = branding.successColor || '#00ff88';

  // Get vote labels
  const likeText = isRTL
    ? (likeLabel || t.like)
    : (likeLabelEn || likeLabel || t.like);
  const dislikeText = isRTL
    ? (dislikeLabel || t.dislike)
    : (dislikeLabelEn || dislikeLabel || t.dislike);

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        fontFamily: "'Assistant', sans-serif",
        background: `linear-gradient(180deg, #0a0f1a 0%, #0d1321 100%)`,
      }}
    >
      {/* Background effects */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: `
            radial-gradient(ellipse at 30% 20%, ${primaryColor}20 0%, transparent 50%),
            radial-gradient(ellipse at 70% 80%, ${successColor}10 0%, transparent 50%)
          `,
        }}
      />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="p-4 flex items-center justify-between">
          {branding.eventLogo ? (
            <img src={branding.eventLogo} alt="" className="h-8" />
          ) : (
            <div className="text-white/40 text-sm font-medium">QStage</div>
          )}

          {/* Live indicator */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white/60 text-xs uppercase tracking-wider">Live</span>
          </div>
        </header>

        {/* Main content based on step */}
        <main className="flex-1 flex flex-col">
          {/* LANDING STEP */}
          {step === 'landing' && (
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
              {/* Event branding */}
              {branding.eventLogo && (
                <img
                  src={branding.eventLogo}
                  alt=""
                  className="h-16 mb-6"
                />
              )}

              <h1
                className="text-3xl font-bold text-white text-center mb-2"
                style={{ textShadow: `0 0 30px ${primaryColor}40` }}
              >
                {isRTL ? branding.eventName : branding.eventNameEn || branding.eventName || t.joinVoting}
              </h1>

              <p className="text-white/60 text-center mb-8">
                {t.joinVoting}
              </p>

              {/* Stats */}
              {stats && (
                <div
                  className="flex items-center gap-4 px-6 py-3 rounded-full mb-8"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <span className="text-white/60 text-sm">{t.liveVoters}:</span>
                  <span className="text-white font-bold">{stats.totalVoters}</span>
                </div>
              )}

              {/* Join button */}
              <button
                onClick={() => setStep('avatar')}
                className="px-8 py-4 rounded-full text-lg font-bold text-black transition-all active:scale-95"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`,
                  boxShadow: `0 0 40px ${primaryColor}60`,
                }}
              >
                {t.joinVoting}
              </button>
            </div>
          )}

          {/* AVATAR STEP */}
          {step === 'avatar' && (
            <QStageAvatarPicker
              onSelect={handleAvatarSelect}
              emojiPalette={currentConfig.emojiPalette}
              allowSelfie={currentConfig.allowSelfie}
              locale={locale}
              primaryColor={primaryColor}
            />
          )}

          {/* VOTING STEP - Swipe Interface */}
          {step === 'voting' && (
            <SwipeVotingCard
              selectedAvatar={selectedAvatar}
              primaryColor={primaryColor}
              likeIcon={likeIcon || '👍'}
              dislikeIcon={dislikeIcon || '👎'}
              likeText={likeText}
              dislikeText={dislikeText}
              error={error}
              isSubmitting={isSubmitting}
              onVote={handleVote}
              t={t}
            />
          )}

          {/* VOTED STEP */}
          {step === 'voted' && (
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
              {/* Success icon */}
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
                style={{
                  background: `linear-gradient(135deg, ${successColor}, ${successColor}bb)`,
                  boxShadow: `0 0 50px ${successColor}60`,
                }}
              >
                <Check className="w-12 h-12 text-black" />
              </div>

              <h2
                className="text-3xl font-bold mb-2"
                style={{
                  color: successColor,
                  textShadow: `0 0 30px ${successColor}60`,
                }}
              >
                {t.voteCounted}
              </h2>

              <p className="text-white/60 text-center mb-8">
                {t.thankYou}
              </p>

              {/* Show vote */}
              {myVote && selectedAvatar && (
                <div
                  className="flex items-center gap-4 px-6 py-4 rounded-2xl"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  {/* Avatar */}
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden"
                    style={{
                      background: selectedAvatar.type === 'emoji'
                        ? 'rgba(255, 255, 255, 0.1)'
                        : 'transparent',
                      border: `2px solid ${myVote === 'like' ? successColor : '#ff3355'}`,
                    }}
                  >
                    {selectedAvatar.type === 'emoji' ? (
                      <span className="text-xl">{selectedAvatar.value}</span>
                    ) : (
                      <img
                        src={selectedAvatar.value}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  {/* Vote icon */}
                  <span className="text-3xl">
                    {myVote === 'like'
                      ? (likeIcon || '👍')
                      : (dislikeIcon || '👎')
                    }
                  </span>
                </div>
              )}

              {/* Live stats */}
              {stats && (
                <div className="mt-8 text-center">
                  <div
                    className="text-5xl font-black mb-1"
                    style={{
                      color: stats.likePercent >= 50 ? successColor : '#ff3355',
                      fontFamily: "'Bebas Neue', Impact, sans-serif",
                    }}
                  >
                    {stats.likePercent}%
                  </div>
                  <div className="text-white/40 text-sm">
                    {stats.totalVoters} {t.liveVoters}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Confetti effect */}
      {showConfetti && (
        <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-20px',
                backgroundColor: [successColor, primaryColor, '#ffd700', '#ff00aa', '#ffffff'][i % 5],
                animation: `qstage-confetti-fall ${2 + Math.random()}s ease-in forwards`,
                animationDelay: `${Math.random() * 0.5}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Font imports */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@200;300;400;500;600;700;800&family=Bebas+Neue&display=swap');
      `}</style>
    </div>
  );
}

export default QStageMobileVoter;
