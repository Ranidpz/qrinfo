'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQStageDisplay } from '@/hooks/useQStageRealtime';
import { QStageConfig, QStagePhase, QSTAGE_TRANSLATIONS } from '@/types/qstage';
import { QStageBackground } from './QStageBackground';
import { QStagePercentageBar } from './QStagePercentageBar';
import { QStageVoterGrid } from './QStageVoterGrid';
import { QStageCountdown } from './QStageCountdown';
import { QStageExplosion } from './QStageExplosion';
import { Users, Crown } from 'lucide-react';

interface QStageDisplayProps {
  codeId: string;
  mediaId: string;
  initialConfig?: QStageConfig;
}

/**
 * QStageDisplay - Main display screen for TV/projector
 * Combines all visual elements for the live voting experience
 */
export function QStageDisplay({
  codeId,
  mediaId,
  initialConfig,
}: QStageDisplayProps) {
  // Get all real-time data
  const {
    config,
    liveData,
    voters,
    events,
    phase,
    percentage,
    totalVoters,
    loading,
    ready,
  } = useQStageDisplay(codeId, mediaId);

  // Local state for UI
  const [showCountdown, setShowCountdown] = useState(false);
  const [showExplosion, setShowExplosion] = useState(false);
  const [lastPhase, setLastPhase] = useState<QStagePhase>(phase);

  // Determine locale
  const currentConfig = config || initialConfig;
  const locale = currentConfig?.language === 'he' ? 'he' : 'en';
  const isRTL = locale === 'he';
  const t = QSTAGE_TRANSLATIONS[locale];

  // Handle phase transitions
  useEffect(() => {
    if (phase !== lastPhase) {
      if (phase === 'countdown') {
        setShowCountdown(true);
      }
      setLastPhase(phase);
    }
  }, [phase, lastPhase]);

  // Handle success event from Realtime DB
  useEffect(() => {
    if (events.successTriggered && !showExplosion) {
      setShowExplosion(true);
    }
  }, [events.successTriggered, showExplosion]);

  // Countdown complete handler
  const handleCountdownComplete = useCallback(() => {
    setShowCountdown(false);
  }, []);

  // Explosion complete handler
  const handleExplosionComplete = useCallback(() => {
    setShowExplosion(false);
  }, []);

  // Success threshold reached handler
  const handleSuccessReached = useCallback(() => {
    if (!showExplosion) {
      setShowExplosion(true);
    }
  }, [showExplosion]);

  // Loading state
  if (loading || !currentConfig) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  const { display, branding, thresholds, successThreshold } = currentConfig;

  // Determine layout direction
  const barOnLeft = display.barPosition === 'left';
  const showGrid = display.gridPosition !== 'hidden';

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ fontFamily: "'Assistant', sans-serif" }}
    >
      {/* Background layer */}
      <QStageBackground
        type={display.backgroundType}
        color={display.backgroundColor}
        imageUrl={display.backgroundImageUrl}
        videoUrl={display.backgroundVideoUrl}
        overlayOpacity={display.backgroundOverlayOpacity}
      />

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex flex-col p-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          {/* Event branding */}
          <div className="flex items-center gap-4">
            {branding.eventLogo && (
              <img
                src={branding.eventLogo}
                alt=""
                className="h-12 w-auto"
              />
            )}
            {(branding.eventName || branding.eventNameEn) && (
              <h1
                className="text-2xl md:text-3xl font-bold"
                style={{
                  color: branding.primaryColor,
                  textShadow: `0 0 20px ${branding.primaryColor}40`,
                }}
              >
                {isRTL ? branding.eventName : branding.eventNameEn || branding.eventName}
              </h1>
            )}
          </div>

          {/* Live stats */}
          <div className="flex items-center gap-6">
            {/* Voter count */}
            {display.showVoterCount && (
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-full"
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <Users className="w-5 h-5 text-cyan-400" />
                <span className="text-xl font-bold text-white tabular-nums">
                  {totalVoters.toLocaleString()}
                </span>
                <span className="text-white/60 text-sm">
                  {t.liveVoters}
                </span>
              </div>
            )}

            {/* Like/Dislike count */}
            {display.showLikeDislikeCount && liveData?.stats && (
              <div
                className="flex items-center gap-4 px-4 py-2 rounded-full"
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <span className="flex items-center gap-1">
                  <span>{currentConfig.likeIcon || '👍'}</span>
                  <span className="text-lg font-bold text-green-400 tabular-nums">
                    {liveData.stats.totalLikes}
                  </span>
                </span>
                <span className="text-white/30">|</span>
                <span className="flex items-center gap-1">
                  <span>{currentConfig.dislikeIcon || '👎'}</span>
                  <span className="text-lg font-bold text-red-400 tabular-nums">
                    {liveData.stats.totalDislikes}
                  </span>
                </span>
              </div>
            )}

            {/* Live indicator */}
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white/80 text-sm font-medium uppercase tracking-wider">
                LIVE
              </span>
            </div>
          </div>
        </header>

        {/* Main area - Bar + Grid */}
        <main className="flex-1 flex gap-6">
          {/* Left side */}
          {barOnLeft ? (
            <div className="w-40 flex-shrink-0">
              <QStagePercentageBar
                percentage={percentage}
                thresholds={thresholds}
                width={display.barWidth}
                showPercentageText={display.showPercentageText}
                glowEnabled={display.barGlowEnabled}
                successThreshold={successThreshold}
                onSuccessReached={handleSuccessReached}
              />
            </div>
          ) : showGrid ? (
            <QStageVoterGrid
              voters={voters}
              maxVisible={display.maxVisibleVoters}
              likeColor={branding.successColor}
              dislikeColor="#ff3355"
            />
          ) : (
            <div className="flex-1" />
          )}

          {/* Right side */}
          {!barOnLeft ? (
            <div className="w-40 flex-shrink-0">
              <QStagePercentageBar
                percentage={percentage}
                thresholds={thresholds}
                width={display.barWidth}
                showPercentageText={display.showPercentageText}
                glowEnabled={display.barGlowEnabled}
                successThreshold={successThreshold}
                onSuccessReached={handleSuccessReached}
              />
            </div>
          ) : showGrid ? (
            <QStageVoterGrid
              voters={voters}
              maxVisible={display.maxVisibleVoters}
              likeColor={branding.successColor}
              dislikeColor="#ff3355"
            />
          ) : (
            <div className="flex-1" />
          )}
        </main>

        {/* Phase-specific overlays */}
        {phase === 'standby' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="text-center">
              <div className="text-6xl mb-4">🎭</div>
              <p className="text-2xl text-white/80 font-medium">
                {t.waitingForVoting}
              </p>
            </div>
          </div>
        )}

        {phase === 'results' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <div
              className="text-center p-8 rounded-3xl"
              style={{
                background: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(20px)',
                border: '2px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <div
                className="text-8xl md:text-9xl font-black mb-4"
                style={{
                  color: percentage >= successThreshold ? branding.successColor : '#ff3355',
                  textShadow: `0 0 40px ${percentage >= successThreshold ? branding.successColor : '#ff3355'}80`,
                  fontFamily: "'Bebas Neue', 'Impact', sans-serif",
                }}
              >
                {Math.round(percentage)}%
              </div>
              <p
                className="text-3xl font-bold"
                style={{
                  color: percentage >= successThreshold ? branding.successColor : '#ff3355',
                }}
              >
                {percentage >= successThreshold ? t.success : t.votingEnded}
              </p>
              <p className="text-xl text-white/60 mt-2">
                {totalVoters.toLocaleString()} {t.liveVoters}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Countdown overlay */}
      {showCountdown && (
        <QStageCountdown
          duration={currentConfig.countdownDurationSeconds}
          onComplete={handleCountdownComplete}
          primaryColor={branding.primaryColor}
        />
      )}

      {/* Success explosion */}
      {showExplosion && (
        <QStageExplosion
          trigger={showExplosion}
          onComplete={handleExplosionComplete}
          successColor={branding.successColor}
        />
      )}

      {/* Import Google Fonts */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@200;300;400;500;600;700;800&family=Bebas+Neue&display=swap');
      `}</style>
    </div>
  );
}

export default QStageDisplay;
