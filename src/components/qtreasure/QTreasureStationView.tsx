'use client';

/**
 * QTreasureStationView - Shows current station content and hint for next
 *
 * Design: Map/scroll style with mystical elements
 * - Station content prominently displayed
 * - Hint image/text for next location
 * - Progress tracker
 */

import React, { useState, useCallback } from 'react';
import { QTreasureConfig, QTreasureStation } from '@/types/qtreasure';
import { QTreasureScanner } from './QTreasureScanner';

interface ProgressInfo {
  completedCount: number;
  totalCount: number;
  progressPercent: number;
  isComplete: boolean;
  currentStationIndex: number;
}

interface QTreasureStationViewProps {
  codeId: string;
  playerId: string;
  config: QTreasureConfig;
  station: QTreasureStation | null;
  progress: ProgressInfo;
  lang: 'he' | 'en';
  onStationComplete: (isComplete: boolean, nextStation?: QTreasureStation) => void;
}

const translations = {
  he: {
    station: 'תחנה',
    of: 'מתוך',
    nextHint: 'רמז לתחנה הבאה',
    scanNext: 'סרקו את התחנה הבאה',
    completed: 'הושלמו',
    huntComplete: 'סיימתם את הציד!',
    noStation: 'אין תחנה',
    watchVideo: 'צפו בסרטון',
  },
  en: {
    station: 'Station',
    of: 'of',
    nextHint: 'Hint for the next station',
    scanNext: 'Scan the next station',
    completed: 'completed',
    huntComplete: 'Hunt complete!',
    noStation: 'No station',
    watchVideo: 'Watch video',
  },
};

export function QTreasureStationView({
  codeId,
  playerId,
  config,
  station,
  progress,
  lang,
  onStationComplete,
}: QTreasureStationViewProps) {
  const t = translations[lang];
  const isRTL = lang === 'he';

  const [showScanner, setShowScanner] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  // Get station content based on language
  const stationTitle = (lang === 'en' && station?.titleEn) ? station.titleEn : station?.title;
  const stationContent = (lang === 'en' && station?.contentEn) ? station.contentEn : station?.content;
  const hintText = (lang === 'en' && station?.hintTextEn) ? station.hintTextEn : station?.hintText;

  // Handle scan result
  const handleScanResult = useCallback((result: {
    success: boolean;
    isComplete?: boolean;
    nextStation?: QTreasureStation;
    outOfOrderMessage?: string;
  }) => {
    if (result.success) {
      onStationComplete(result.isComplete || false, result.nextStation);
    }
    setShowScanner(false);
  }, [onStationComplete]);

  // Extract YouTube video ID
  const getYouTubeId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  };

  const videoId = station?.videoUrl ? getYouTubeId(station.videoUrl) : null;

  if (!station) {
    return (
      <div className="no-station">
        <span className="icon">🏁</span>
        <p>{t.huntComplete}</p>
      </div>
    );
  }

  return (
    <div className="station-view">
      {/* Progress bar */}
      <div className="progress-section">
        <div className="progress-text">
          <span>{t.station} {station.order}</span>
          <span className="progress-divider">{t.of}</span>
          <span>{progress.totalCount}</span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progress.progressPercent}%` }}
          />
        </div>
        <div className="progress-completed">
          {progress.completedCount} {t.completed}
        </div>
      </div>

      {/* Station card */}
      <div className="station-card">
        <div className="card-header">
          <div className="station-badge">{station.order}</div>
          <h2 className="station-title">{stationTitle}</h2>
        </div>

        {/* Video section */}
        {videoId && (
          <div className="video-section">
            {showVideo ? (
              <div className="video-wrapper">
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <button className="video-btn" onClick={() => setShowVideo(true)}>
                <span className="play-icon">▶</span>
                <span>{t.watchVideo}</span>
              </button>
            )}
          </div>
        )}

        {/* Station content */}
        {stationContent && (
          <div className="station-content">
            <p>{stationContent}</p>
          </div>
        )}

        {/* Station images */}
        {station.imageUrls && station.imageUrls.length > 0 && (
          <div className="station-images">
            {station.imageUrls.map((url, idx) => (
              <img key={idx} src={url} alt={`Station ${station.order}`} />
            ))}
          </div>
        )}
      </div>

      {/* Hint section */}
      <div className="hint-section">
        <div className="hint-header">
          <span className="hint-icon">🗺️</span>
          <h3>{t.nextHint}</h3>
        </div>

        {station.hintImageUrl && (
          <div className="hint-image">
            <img src={station.hintImageUrl} alt="Next location hint" />
            <div className="hint-overlay">
              <div className="compass-indicator">
                <span>🧭</span>
              </div>
            </div>
          </div>
        )}

        {hintText && (
          <p className="hint-text">{hintText}</p>
        )}
      </div>

      {/* Scan button */}
      <button className="scan-btn" onClick={() => setShowScanner(true)}>
        <div className="scan-icon">
          <div className="scan-frame" />
          <span>📷</span>
        </div>
        <span>{t.scanNext}</span>
      </button>

      {/* Scanner modal */}
      {showScanner && (
        <QTreasureScanner
          codeId={codeId}
          playerId={playerId}
          config={config}
          lang={lang}
          onResult={handleScanResult}
          onClose={() => setShowScanner(false)}
        />
      )}

      <style jsx>{`
        .station-view {
          padding: 1rem;
          padding-top: 5rem;
          padding-bottom: 120px;
          min-height: 100vh;
          min-height: 100dvh;
        }

        .no-station {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          text-align: center;
          color: #d4af37;
        }

        .no-station .icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }

        .progress-section {
          margin-bottom: 1.5rem;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 12px;
          border: 1px solid rgba(212, 175, 55, 0.2);
        }

        .progress-text {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-size: 1.125rem;
          color: #d4af37;
          margin-bottom: 0.75rem;
          font-weight: 600;
        }

        .progress-divider {
          opacity: 0.5;
        }

        .progress-bar {
          height: 8px;
          background: rgba(212, 175, 55, 0.2);
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #d4af37, #f5d670);
          border-radius: 4px;
          transition: width 0.5s ease;
        }

        .progress-completed {
          text-align: center;
          font-size: 0.75rem;
          color: rgba(212, 175, 55, 0.6);
          margin-top: 0.5rem;
        }

        .station-card {
          background: linear-gradient(135deg, rgba(0, 0, 0, 0.4), rgba(212, 175, 55, 0.05));
          border: 1px solid rgba(212, 175, 55, 0.3);
          border-radius: 16px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .station-badge {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #d4af37, #8b6914);
          border-radius: 50%;
          font-size: 1.5rem;
          font-weight: 700;
          color: #0d1f17;
          flex-shrink: 0;
          box-shadow: 0 2px 10px rgba(212, 175, 55, 0.4);
        }

        .station-title {
          font-family: 'Cinzel', 'Crimson Text', Georgia, serif;
          font-size: 1.5rem;
          font-weight: 700;
          color: #f5f5dc;
          margin: 0;
        }

        .video-section {
          margin-bottom: 1rem;
        }

        .video-wrapper {
          position: relative;
          width: 100%;
          padding-bottom: 56.25%;
          border-radius: 12px;
          overflow: hidden;
        }

        .video-wrapper iframe {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border: none;
        }

        .video-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          width: 100%;
          padding: 1rem;
          background: rgba(212, 175, 55, 0.1);
          border: 1px solid rgba(212, 175, 55, 0.3);
          border-radius: 12px;
          color: #d4af37;
          font-family: inherit;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.3s;
        }

        .video-btn:hover {
          background: rgba(212, 175, 55, 0.2);
        }

        .play-icon {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #d4af37;
          color: #0d1f17;
          border-radius: 50%;
          font-size: 0.875rem;
        }

        .station-content {
          color: rgba(245, 245, 220, 0.9);
          font-size: 1.125rem;
          line-height: 1.7;
        }

        .station-content p {
          margin: 0;
          white-space: pre-wrap;
        }

        .station-images {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .station-images img {
          width: 100%;
          border-radius: 8px;
          border: 1px solid rgba(212, 175, 55, 0.2);
        }

        .hint-section {
          background: linear-gradient(135deg, rgba(212, 175, 55, 0.1), rgba(0, 0, 0, 0.3));
          border: 1px solid rgba(212, 175, 55, 0.3);
          border-radius: 16px;
          padding: 1.25rem;
          margin-bottom: 1.5rem;
        }

        .hint-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .hint-icon {
          font-size: 1.5rem;
        }

        .hint-header h3 {
          font-family: 'Cinzel', 'Crimson Text', Georgia, serif;
          font-size: 1rem;
          font-weight: 600;
          color: #d4af37;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .hint-image {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 1rem;
        }

        .hint-image img {
          width: 100%;
          display: block;
          border-radius: 12px;
        }

        .hint-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0, 0, 0, 0.5), transparent);
          pointer-events: none;
        }

        .compass-indicator {
          position: absolute;
          bottom: 1rem;
          right: 1rem;
          width: 40px;
          height: 40px;
          background: rgba(212, 175, 55, 0.9);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        .hint-text {
          color: rgba(245, 245, 220, 0.9);
          font-size: 1rem;
          line-height: 1.6;
          font-style: italic;
          margin: 0;
          padding: ${isRTL ? '0 1rem 0 0' : '0 0 0 1rem'};
          border-${isRTL ? 'right' : 'left'}: 3px solid rgba(212, 175, 55, 0.5);
        }

        .scan-btn {
          position: fixed;
          bottom: 1.5rem;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 2.5rem;
          font-family: 'Cinzel', 'Crimson Text', Georgia, serif;
          font-size: 1.125rem;
          font-weight: 700;
          color: #0d1f17;
          background: linear-gradient(135deg, #d4af37, #f5d670, #d4af37);
          background-size: 200% 200%;
          border: none;
          border-radius: 50px;
          cursor: pointer;
          transition: all 0.3s;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          box-shadow:
            0 4px 20px rgba(212, 175, 55, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.3);
          z-index: 40;
        }

        .scan-btn:hover {
          transform: translateX(-50%) translateY(-2px);
          box-shadow: 0 8px 30px rgba(212, 175, 55, 0.5);
          background-position: 100% 0;
        }

        .scan-btn:active {
          transform: translateX(-50%) translateY(0);
        }

        .scan-icon {
          position: relative;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .scan-frame {
          position: absolute;
          inset: 0;
          border: 2px solid rgba(13, 31, 23, 0.5);
          border-radius: 4px;
        }

        .scan-icon span {
          font-size: 1.25rem;
        }
      `}</style>
    </div>
  );
}
