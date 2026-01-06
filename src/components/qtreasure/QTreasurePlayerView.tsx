'use client';

/**
 * QTreasurePlayerView - Main container for the treasure hunt player experience
 *
 * Design: Ancient Explorer / Quest Adventure
 * - Deep forest greens and mystical blues
 * - Gold/amber treasure accents
 * - Parchment textures and compass motifs
 * - Adventurous, mysterious atmosphere
 */

import React, { useState, useEffect, useCallback } from 'react';
import { QTreasureConfig, QTreasureStation } from '@/types/qtreasure';
import {
  useQTreasureConfig,
  useQTreasurePlayer,
  useQTreasureTimer,
  useQTreasureProgress,
  useQTreasureSounds,
  useQTreasureLeaderboard
} from '@/hooks/useQTreasureRealtime';
import { QTreasureRegistration } from './QTreasureRegistration';
import { QTreasureStationView } from './QTreasureStationView';
import { QTreasureComplete } from './QTreasureComplete';
import { QTreasureTimer } from './QTreasureTimer';

// Generate or get visitor ID from localStorage
function getVisitorId(): string {
  if (typeof window === 'undefined') return '';

  let visitorId = localStorage.getItem('qtreasure_visitor_id');
  if (!visitorId) {
    visitorId = `explorer_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    localStorage.setItem('qtreasure_visitor_id', visitorId);
  }
  return visitorId;
}

interface QTreasurePlayerViewProps {
  codeId: string;
  mediaId: string;
  initialConfig: QTreasureConfig;
  shortId: string;
}

export function QTreasurePlayerView({
  codeId,
  mediaId,
  initialConfig,
  shortId,
}: QTreasurePlayerViewProps) {
  const [playerId] = useState(() => getVisitorId());
  const [isRegistered, setIsRegistered] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentStation, setCurrentStation] = useState<QTreasureStation | null>(null);

  const { config, loading: configLoading } = useQTreasureConfig(codeId, mediaId);
  const { player, refreshPlayer } = useQTreasurePlayer(codeId, playerId);
  const { leaderboard } = useQTreasureLeaderboard(codeId);
  const sounds = useQTreasureSounds(true);

  // Use live config or fallback to initial
  const activeConfig = config || initialConfig;

  // Progress tracking
  const progress = useQTreasureProgress(player, activeConfig);

  // Timer
  const timer = useQTreasureTimer(
    player?.startedAt,
    activeConfig.timer?.maxTimeSeconds || 0
  );

  // Determine language
  const lang = activeConfig.language === 'auto'
    ? (typeof navigator !== 'undefined' && navigator.language?.startsWith('he') ? 'he' : 'en')
    : activeConfig.language;
  const isRTL = lang === 'he';

  // Check if player is registered and has started
  useEffect(() => {
    if (player) {
      setIsRegistered(true);
      if (player.startedAt) {
        setHasStarted(true);
        // Set current station based on progress
        const nextStationOrder = player.currentStationIndex + 1;
        const station = activeConfig.stations.find(s => s.isActive && s.order === nextStationOrder);
        setCurrentStation(station || null);
      }
    }
  }, [player, activeConfig.stations]);

  // Handle registration complete
  const handleRegistrationComplete = useCallback(async (firstStation?: QTreasureStation) => {
    await refreshPlayer();
    setIsRegistered(true);
    if (firstStation) {
      setCurrentStation(firstStation);
    }
  }, [refreshPlayer]);

  // Handle hunt start
  const handleHuntStart = useCallback(async () => {
    try {
      const response = await fetch('/api/qtreasure/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId, playerId }),
      });

      const result = await response.json();
      if (result.success) {
        await refreshPlayer();
        setHasStarted(true);
        if (result.firstStation) {
          setCurrentStation(result.firstStation);
        }
      }
    } catch (error) {
      console.error('Error starting hunt:', error);
    }
  }, [codeId, playerId, refreshPlayer]);

  // Handle station scan complete
  const handleStationComplete = useCallback(async (
    isComplete: boolean,
    nextStation?: QTreasureStation
  ) => {
    await refreshPlayer();

    if (isComplete) {
      sounds.playHuntComplete();
      setCurrentStation(null);
    } else if (nextStation) {
      sounds.playScanSuccess();
      setCurrentStation(nextStation);
    }
  }, [refreshPlayer, sounds]);

  // Determine which view to show
  const renderContent = () => {
    // Game completed
    if (player?.completedAt || progress.isComplete) {
      return (
        <QTreasureComplete
          config={activeConfig}
          player={player!}
          leaderboard={leaderboard}
          lang={lang}
        />
      );
    }

    // Not registered yet
    if (!isRegistered) {
      return (
        <QTreasureRegistration
          codeId={codeId}
          playerId={playerId}
          config={activeConfig}
          lang={lang}
          onComplete={handleRegistrationComplete}
          onStart={handleHuntStart}
        />
      );
    }

    // Registered but not started
    if (!hasStarted) {
      return (
        <QTreasureRegistration
          codeId={codeId}
          playerId={playerId}
          config={activeConfig}
          lang={lang}
          isRegistered={true}
          onComplete={handleRegistrationComplete}
          onStart={handleHuntStart}
        />
      );
    }

    // Active hunt
    return (
      <QTreasureStationView
        codeId={codeId}
        playerId={playerId}
        config={activeConfig}
        station={currentStation}
        progress={progress}
        lang={lang}
        onStationComplete={handleStationComplete}
      />
    );
  };

  // Loading state
  if (configLoading) {
    return (
      <div className="qtreasure-loading">
        <div className="compass-loader">
          <div className="compass-ring" />
          <div className="compass-needle" />
        </div>
        <p>{lang === 'he' ? 'טוען את המסע...' : 'Loading adventure...'}</p>

        <style jsx>{`
          .qtreasure-loading {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 1.5rem;
            background: linear-gradient(135deg, #0d1f17 0%, #1a2f23 50%, #0f2318 100%);
            color: #d4af37;
            font-family: 'Crimson Text', Georgia, serif;
          }

          .compass-loader {
            width: 80px;
            height: 80px;
            position: relative;
          }

          .compass-ring {
            width: 100%;
            height: 100%;
            border: 3px solid rgba(212, 175, 55, 0.3);
            border-top-color: #d4af37;
            border-radius: 50%;
            animation: spin 1.5s linear infinite;
          }

          .compass-needle {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 4px;
            height: 30px;
            background: linear-gradient(to bottom, #d4af37, #8b6914);
            transform-origin: center bottom;
            transform: translate(-50%, -100%);
            animation: needle 1.5s ease-in-out infinite;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          @keyframes needle {
            0%, 100% { transform: translate(-50%, -100%) rotate(-30deg); }
            50% { transform: translate(-50%, -100%) rotate(30deg); }
          }

          p {
            font-size: 1.125rem;
            letter-spacing: 0.05em;
          }
        `}</style>
      </div>
    );
  }

  const bgColor = activeConfig.branding?.backgroundColor || '#0d1f17';

  return (
    <div
      className="qtreasure-container"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        '--primary': activeConfig.branding?.primaryColor || '#d4af37',
        '--accent': activeConfig.branding?.accentColor || '#00ff88',
        '--success': activeConfig.branding?.successColor || '#4ade80',
        '--warning': activeConfig.branding?.warningColor || '#f59e0b',
        '--bg': bgColor,
      } as React.CSSProperties}
    >
      {/* Timer overlay if active and hunt started */}
      {hasStarted && !progress.isComplete && activeConfig.timer?.showToPlayer && (
        <div className="timer-overlay">
          <QTreasureTimer
            startedAt={player?.startedAt}
            elapsedMs={timer.elapsedTime}
            maxTimeSeconds={activeConfig.timer.maxTimeSeconds}
            isExpired={timer.isExpired}
            lang={lang}
          />
        </div>
      )}

      {/* Background effects */}
      <div className="bg-effects">
        <div className="fog fog-1" />
        <div className="fog fog-2" />
        <div className="particles" />
      </div>

      {/* Main content */}
      <div className="content-wrapper">
        {renderContent()}
      </div>

      <style jsx>{`
        .qtreasure-container {
          min-height: 100vh;
          min-height: 100dvh;
          background: linear-gradient(135deg, var(--bg) 0%, #1a2f23 50%, #0f2318 100%);
          position: relative;
          overflow: hidden;
          font-family: 'Crimson Text', Georgia, serif;
        }

        .timer-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 50;
          padding: 0.75rem;
          background: linear-gradient(to bottom, rgba(13, 31, 23, 0.95), transparent);
        }

        .bg-effects {
          position: fixed;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }

        .fog {
          position: absolute;
          width: 200%;
          height: 200%;
          background: radial-gradient(ellipse at center, rgba(212, 175, 55, 0.03) 0%, transparent 70%);
        }

        .fog-1 {
          top: -50%;
          left: -50%;
          animation: fog-drift 30s ease-in-out infinite;
        }

        .fog-2 {
          bottom: -50%;
          right: -50%;
          animation: fog-drift 25s ease-in-out infinite reverse;
          opacity: 0.5;
        }

        .particles {
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(1px 1px at 20% 30%, rgba(212, 175, 55, 0.4), transparent),
            radial-gradient(1px 1px at 40% 70%, rgba(212, 175, 55, 0.3), transparent),
            radial-gradient(1px 1px at 60% 20%, rgba(212, 175, 55, 0.5), transparent),
            radial-gradient(1px 1px at 80% 60%, rgba(212, 175, 55, 0.3), transparent),
            radial-gradient(1px 1px at 10% 80%, rgba(212, 175, 55, 0.4), transparent),
            radial-gradient(1px 1px at 90% 40%, rgba(212, 175, 55, 0.3), transparent);
          animation: sparkle 8s ease-in-out infinite;
        }

        .content-wrapper {
          position: relative;
          z-index: 10;
          min-height: 100vh;
          min-height: 100dvh;
        }

        @keyframes fog-drift {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(5%, 5%) rotate(5deg); }
        }

        @keyframes sparkle {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
