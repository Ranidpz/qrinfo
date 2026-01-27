'use client';

/**
 * QHuntPlayerView - Main container component for the player interface
 * Routes to different views based on game phase and player state
 *
 * Design: Neon Hunter - Arcade Gaming Vibe
 * - Deep dark blue/black background (#0a0f1a)
 * - Electric cyan accents (#00d4ff)
 * - Hot pink highlights (#ff00aa)
 * - Glowing effects and scan animations
 */

import React, { useState, useEffect, useCallback } from 'react';
import { QHuntConfig, QHuntPhase } from '@/types/qhunt';
import { useQHuntConfig, useQHuntPlayer, useQHuntTimer, useQHuntSounds } from '@/hooks/useQHuntRealtime';
import { QHuntRegistration } from './QHuntRegistration';
import { QHuntScanner } from './QHuntScanner';
import { QHuntPlayerComplete } from './QHuntPlayerComplete';
import { QHuntCountdown } from './QHuntCountdown';

// Generate or get visitor ID from localStorage
function getVisitorId(): string {
  if (typeof window === 'undefined') return '';

  let visitorId = localStorage.getItem('qhunt_visitor_id');
  if (!visitorId) {
    visitorId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    localStorage.setItem('qhunt_visitor_id', visitorId);
  }
  return visitorId;
}

// Generate a new unique player ID (for "Try Again")
function generateNewPlayerId(): string {
  const newId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  if (typeof window !== 'undefined') {
    localStorage.setItem('qhunt_visitor_id', newId);
  }
  return newId;
}

interface QHuntPlayerViewProps {
  codeId: string;
  mediaId: string;
  initialConfig: QHuntConfig;
  shortId: string;
}

export function QHuntPlayerView({
  codeId,
  mediaId,
  initialConfig,
  shortId,
}: QHuntPlayerViewProps) {
  const [playerId, setPlayerId] = useState(() => getVisitorId());
  const [isRegistered, setIsRegistered] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const { config, loading: configLoading } = useQHuntConfig(codeId, mediaId);
  const { player, scans, refreshPlayer, refreshScans } = useQHuntPlayer(codeId, playerId);
  const sounds = useQHuntSounds(config?.sound?.enabled ?? true);

  // Use live config or fallback to initial
  const activeConfig = config || initialConfig;

  // Determine language
  const lang = activeConfig.language === 'auto'
    ? (typeof navigator !== 'undefined' && navigator.language?.startsWith('he') ? 'he' : 'en')
    : activeConfig.language;
  const isRTL = lang === 'he';

  // Check if player is registered and has started
  useEffect(() => {
    if (player) {
      setIsRegistered(true);
      if (player.gameStartedAt) {
        setHasStarted(true);
      }
    }
  }, [player]);

  // Handle registration complete
  const handleRegistrationComplete = useCallback(async () => {
    await refreshPlayer();
    setIsRegistered(true);
  }, [refreshPlayer]);

  // Handle game start
  const handleGameStart = useCallback(async () => {
    // Show countdown first
    setShowCountdown(true);
  }, []);

  // Handle countdown complete
  const handleCountdownComplete = useCallback(async () => {
    setShowCountdown(false);
    setHasStarted(true);
    // Refresh player data to get the gameStartedAt timestamp
    await refreshPlayer();
    sounds.playCountdown();
  }, [sounds, refreshPlayer]);

  // Handle scan complete
  const handleScanComplete = useCallback(async (isGameComplete: boolean) => {
    await refreshPlayer();
    await refreshScans();

    if (isGameComplete) {
      sounds.playGameComplete();
    } else {
      sounds.playScanSuccess();

      // Check for milestone
      const newCount = (player?.scansCount || 0) + 1;
      const interval = activeConfig.sound?.milestoneInterval || 5;
      if (newCount % interval === 0) {
        sounds.playMilestone();
      }
    }
  }, [refreshPlayer, refreshScans, player, activeConfig, sounds]);

  // Handle scan error
  const handleScanError = useCallback(() => {
    sounds.playScanError();
  }, [sounds]);

  // Handle edit profile (from scanner)
  const handleEditProfile = useCallback(() => {
    setIsEditingProfile(true);
  }, []);

  // Handle returning from edit profile
  const handleReturnToGame = useCallback(async () => {
    await refreshPlayer();
    setIsEditingProfile(false);
  }, [refreshPlayer]);

  // Handle "Try Again" - creates a new player entry and starts fresh
  const handleTryAgain = useCallback(() => {
    // Generate a new player ID so old entry stays on leaderboard
    const newId = generateNewPlayerId();
    setPlayerId(newId);
    // Reset all state to go back to registration
    setIsRegistered(false);
    setHasStarted(false);
    setShowCountdown(false);
    setIsEditingProfile(false);
  }, []);

  // Determine what to render based on state
  const renderContent = () => {
    // Show countdown overlay
    if (showCountdown) {
      return (
        <QHuntCountdown
          seconds={activeConfig.countdownSeconds}
          onComplete={handleCountdownComplete}
          branding={activeConfig.branding}
        />
      );
    }

    // Player finished the game
    if (player?.isFinished) {
      return (
        <QHuntPlayerComplete
          codeId={codeId}
          player={player}
          scans={scans}
          config={activeConfig}
          lang={lang}
          onTryAgain={handleTryAgain}
        />
      );
    }

    // Player is editing profile mid-game
    if (isEditingProfile && player) {
      return (
        <QHuntRegistration
          codeId={codeId}
          config={activeConfig}
          existingPlayer={player}
          onRegister={handleReturnToGame}
          onStart={handleReturnToGame}
          lang={lang}
          isEditMode
        />
      );
    }

    // Player is playing (either local state says started or player data has gameStartedAt)
    if (player && (hasStarted || player.gameStartedAt)) {
      return (
        <QHuntScanner
          codeId={codeId}
          player={player}
          config={activeConfig}
          onScanComplete={handleScanComplete}
          onScanError={handleScanError}
          onEditProfile={handleEditProfile}
          lang={lang}
        />
      );
    }

    // Player is registered but hasn't started
    if (isRegistered && player) {
      return (
        <QHuntRegistration
          codeId={codeId}
          config={activeConfig}
          existingPlayer={player}
          onRegister={handleRegistrationComplete}
          onStart={handleGameStart}
          lang={lang}
        />
      );
    }

    // Registration phase
    return (
      <QHuntRegistration
        codeId={codeId}
        config={activeConfig}
        onRegister={handleRegistrationComplete}
        onStart={handleGameStart}
        lang={lang}
      />
    );
  };

  return (
    <div
      className="qhunt-desktop-wrapper"
      style={{
        '--qhunt-bg': activeConfig.branding.backgroundColor || '#0a0f1a',
        '--qhunt-primary': activeConfig.branding.primaryColor || '#00d4ff',
        '--qhunt-secondary': activeConfig.branding.secondaryColor || '#ff00aa',
        '--qhunt-success': activeConfig.branding.successColor || '#00ff88',
        '--qhunt-warning': activeConfig.branding.warningColor || '#ffaa00',
      } as React.CSSProperties}
    >
      <div className="qhunt-phone-mockup">
        <div className="qhunt-phone-notch" />
        <div
          className="qhunt-player-view"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {/* Animated background */}
          <div className="qhunt-bg-effects">
            {activeConfig.branding.showGridAnimation !== false && (
              <div className="qhunt-grid-lines" />
            )}
            {activeConfig.branding.showGlowingOrbs !== false && (
              <>
                <div className="qhunt-glow-orb qhunt-glow-orb-1" />
                <div className="qhunt-glow-orb qhunt-glow-orb-2" />
              </>
            )}
          </div>

          {/* Main content */}
          <div className="qhunt-content">
            {configLoading ? (
              <div className="qhunt-loading">
                <div className="qhunt-loading-spinner" />
              </div>
            ) : (
              renderContent()
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        /* Desktop phone mockup wrapper */
        .qhunt-desktop-wrapper {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--qhunt-bg);
        }

        .qhunt-phone-mockup {
          width: 100%;
          height: 100%;
          min-height: 100vh;
          min-height: 100dvh;
          position: relative;
          background: var(--qhunt-bg);
        }

        .qhunt-phone-notch {
          display: none;
        }

        /* Desktop styles - show phone frame */
        @media (min-width: 768px) {
          .qhunt-desktop-wrapper {
            padding: 40px 20px;
            background: linear-gradient(135deg, #0a0f1a 0%, #1a1f2e 100%);
          }

          .qhunt-phone-mockup {
            width: 390px;
            height: 844px;
            min-height: unset;
            max-height: calc(100vh - 80px);
            border-radius: 50px;
            border: 8px solid #2a2f3e;
            box-shadow:
              0 0 0 2px #1a1f2e,
              0 25px 80px rgba(0, 0, 0, 0.5),
              0 0 60px color-mix(in srgb, var(--qhunt-primary) 10%, transparent),
              inset 0 0 20px rgba(0, 0, 0, 0.3);
            overflow: hidden;
            position: relative;
          }

          .qhunt-phone-notch {
            display: block;
            position: absolute;
            top: 12px;
            left: 50%;
            transform: translateX(-50%);
            width: 120px;
            height: 28px;
            background: #1a1f2e;
            border-radius: 20px;
            z-index: 300;
          }

          .qhunt-phone-notch::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 20px;
            transform: translateY(-50%);
            width: 10px;
            height: 10px;
            background: #2a2f3e;
            border-radius: 50%;
          }

          .qhunt-phone-notch::after {
            content: '';
            position: absolute;
            top: 50%;
            right: 30px;
            transform: translateY(-50%);
            width: 8px;
            height: 8px;
            background: var(--qhunt-primary);
            border-radius: 50%;
            box-shadow: 0 0 6px var(--qhunt-primary);
          }

          .qhunt-player-view {
            height: 100%;
            min-height: unset;
            padding-top: 50px;
            border-radius: 42px;
            overflow: hidden;
          }

          .qhunt-bg-effects {
            border-radius: 42px;
          }

          .qhunt-content {
            min-height: unset;
            height: 100%;
          }
        }

        .qhunt-player-view {
          min-height: 100vh;
          min-height: 100dvh;
          background: var(--qhunt-bg);
          font-family: 'Assistant', sans-serif;
          position: relative;
          overflow-x: hidden;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        .qhunt-bg-effects {
          position: fixed;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }

        .qhunt-grid-lines {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(color-mix(in srgb, var(--qhunt-primary) 5%, transparent) 1px, transparent 1px),
            linear-gradient(90deg, color-mix(in srgb, var(--qhunt-primary) 5%, transparent) 1px, transparent 1px);
          background-size: 50px 50px;
          animation: gridMove 20s linear infinite;
        }

        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
        }

        .qhunt-glow-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.3;
          animation: orbFloat 10s ease-in-out infinite;
        }

        .qhunt-glow-orb-1 {
          width: 400px;
          height: 400px;
          background: var(--qhunt-primary);
          top: -200px;
          right: -100px;
        }

        .qhunt-glow-orb-2 {
          width: 300px;
          height: 300px;
          background: var(--qhunt-secondary);
          bottom: -150px;
          left: -100px;
          animation-delay: -5s;
        }

        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(30px, 30px) scale(1.1); }
        }

        .qhunt-content {
          position: relative;
          z-index: 1;
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
        }

        .qhunt-loading {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .qhunt-loading-spinner {
          width: 60px;
          height: 60px;
          border: 3px solid color-mix(in srgb, var(--qhunt-primary) 25%, transparent);
          border-top-color: var(--qhunt-primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Desktop: keep background effects inside phone */
        @media (min-width: 768px) {
          .qhunt-bg-effects {
            position: absolute;
          }
        }
      `}</style>
    </div>
  );
}
