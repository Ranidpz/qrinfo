'use client';

/**
 * QTreasureStationView - Shows current station content and hint for next
 *
 * Design: Map/scroll style with mystical elements
 * - Station content prominently displayed
 * - Answer challenge with letter squares (Wordle-style)
 * - Hint image/text for next location (revealed after correct answer)
 * - Progress tracker
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
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
    answerChallenge: 'פתרו את האתגר',
    typeAnswer: 'הקלידו את התשובה',
    correctAnswer: 'תשובה נכונה!',
    wrongAnswer: 'לא נכון, נסו שוב',
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
    answerChallenge: 'Solve the challenge',
    typeAnswer: 'Type the answer',
    correctAnswer: 'Correct!',
    wrongAnswer: 'Wrong, try again',
  },
};

// Parse answer into word groups (spaces become visual gaps)
function parseAnswerGroups(answer: string): { letters: string[]; startIndex: number }[] {
  const groups: { letters: string[]; startIndex: number }[] = [];
  let currentGroup: string[] = [];
  let flatIndex = 0;
  let groupStartIndex = 0;

  for (const char of answer) {
    if (char === ' ') {
      if (currentGroup.length > 0) {
        groups.push({ letters: currentGroup, startIndex: groupStartIndex });
        currentGroup = [];
      }
      groupStartIndex = flatIndex;
    } else {
      if (currentGroup.length === 0) {
        groupStartIndex = flatIndex;
      }
      currentGroup.push(char);
      flatIndex++;
    }
  }

  if (currentGroup.length > 0) {
    groups.push({ letters: currentGroup, startIndex: groupStartIndex });
  }

  return groups;
}

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

  // Answer challenge state
  const [letterInputs, setLetterInputs] = useState<string[]>([]);
  const [answerSolved, setAnswerSolved] = useState(false);
  const [showWrongAnimation, setShowWrongAnimation] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Get station content based on language
  const stationTitle = (lang === 'en' && station?.titleEn) ? station.titleEn : station?.title;
  const stationContent = (lang === 'en' && station?.contentEn) ? station.contentEn : station?.content;
  const hintText = (lang === 'en' && station?.hintTextEn) ? station.hintTextEn : station?.hintText;

  // Get answer based on language
  const stationAnswer = (lang === 'en' && station?.answerEn) ? station.answerEn : station?.answer;
  const hasAnswerChallenge = !!stationAnswer && stationAnswer.trim().length > 0;

  // Check localStorage for previously solved answer + init letter inputs
  useEffect(() => {
    if (!station || !hasAnswerChallenge) {
      setAnswerSolved(false);
      setLetterInputs([]);
      return;
    }

    const storageKey = `qtreasure_answer_${codeId}_${station.id}`;
    const wasSolved = localStorage.getItem(storageKey) === 'solved';
    if (wasSolved) {
      setAnswerSolved(true);
      setLetterInputs([]);
    } else {
      setAnswerSolved(false);
      const charCount = stationAnswer!.split('').filter(c => c !== ' ').length;
      setLetterInputs(new Array(charCount).fill(''));
    }
    setShowSuccessAnimation(false);
    setShowWrongAnimation(false);
  }, [station?.id, hasAnswerChallenge, stationAnswer, codeId]);

  // Validate the answer
  const validateAnswer = useCallback((inputs: string[]) => {
    if (!stationAnswer || !station) return;

    const correctChars = stationAnswer.split('').filter(c => c !== ' ');

    const isCorrect = inputs.length === correctChars.length && inputs.every((input, i) => {
      const expected = correctChars[i];
      return input.toLowerCase() === expected.toLowerCase();
    });

    if (isCorrect) {
      setShowSuccessAnimation(true);
      const storageKey = `qtreasure_answer_${codeId}_${station.id}`;
      localStorage.setItem(storageKey, 'solved');

      setTimeout(() => {
        setAnswerSolved(true);
        setShowSuccessAnimation(false);
      }, 1500);
    } else {
      setShowWrongAnimation(true);
      setTimeout(() => {
        setShowWrongAnimation(false);
        const charCount = stationAnswer.split('').filter(c => c !== ' ').length;
        setLetterInputs(new Array(charCount).fill(''));
        inputRefs.current[0]?.focus();
      }, 800);
    }
  }, [stationAnswer, codeId, station]);

  // Handle letter input
  const handleLetterInput = useCallback((index: number, value: string) => {
    const letter = value.slice(-1);

    const newInputs = [...letterInputs];
    newInputs[index] = letter;
    setLetterInputs(newInputs);

    // Auto-advance to next empty input
    if (letter && index < letterInputs.length - 1) {
      const nextRef = inputRefs.current[index + 1];
      if (nextRef) nextRef.focus();
    }

    // Check if all filled
    const allFilled = newInputs.every(l => l.length > 0);
    if (allFilled) {
      validateAnswer(newInputs);
    }
  }, [letterInputs, validateAnswer]);

  // Handle keydown for backspace navigation
  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !letterInputs[index] && index > 0) {
      const prevRef = inputRefs.current[index - 1];
      if (prevRef) prevRef.focus();
    }
  }, [letterInputs]);

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

  // Whether to show hint/scan (no challenge OR challenge solved)
  const showHintAndScan = !hasAnswerChallenge || answerSolved;

  if (!station) {
    return (
      <div className="no-station">
        <span className="icon">🏁</span>
        <p>{t.huntComplete}</p>
      </div>
    );
  }

  const answerGroups = hasAnswerChallenge ? parseAnswerGroups(stationAnswer!) : [];

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

      {/* Answer Challenge Section */}
      {hasAnswerChallenge && !answerSolved && !showSuccessAnimation && (
        <div className={`answer-challenge ${showWrongAnimation ? 'shake' : ''}`}>
          <div className="challenge-header">
            <span className="challenge-icon">🔐</span>
            <h3>{t.answerChallenge}</h3>
          </div>
          <p className="challenge-instruction">{t.typeAnswer}</p>

          <div className="letter-groups" dir={isRTL ? 'rtl' : 'ltr'}>
            {answerGroups.map((group, groupIdx) => (
              <div key={groupIdx} className="letter-group">
                {group.letters.map((_, letterIdx) => {
                  const flatIdx = group.startIndex + letterIdx;
                  return (
                    <input
                      key={flatIdx}
                      ref={el => { inputRefs.current[flatIdx] = el; }}
                      type="text"
                      inputMode="text"
                      maxLength={2}
                      value={letterInputs[flatIdx] || ''}
                      onChange={(e) => handleLetterInput(flatIdx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(flatIdx, e)}
                      className={`letter-input ${letterInputs[flatIdx] ? 'filled' : ''}`}
                      autoComplete="off"
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success animation */}
      {showSuccessAnimation && (
        <div className="success-overlay">
          <span className="success-check">✓</span>
          <p>{t.correctAnswer}</p>
        </div>
      )}

      {/* Hint section - shown only if no answer challenge OR answer is solved */}
      {showHintAndScan && (
        <div className={`hint-section ${answerSolved ? 'hint-reveal' : ''}`}>
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
      )}

      {/* Scan button - shown only if no answer challenge OR answer is solved */}
      {showHintAndScan && (
        <button className={`scan-btn ${answerSolved ? 'scan-reveal' : ''}`} onClick={() => setShowScanner(true)}>
          <div className="scan-icon">
            <div className="scan-frame" />
            <span>📷</span>
          </div>
          <span>{t.scanNext}</span>
        </button>
      )}

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

        /* Answer Challenge */
        .answer-challenge {
          background: linear-gradient(135deg, rgba(0, 0, 0, 0.4), rgba(212, 175, 55, 0.08));
          border: 2px solid rgba(212, 175, 55, 0.4);
          border-radius: 16px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          text-align: center;
        }

        .challenge-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }

        .challenge-header h3 {
          font-family: 'Cinzel', 'Crimson Text', Georgia, serif;
          font-size: 1.125rem;
          font-weight: 600;
          color: #d4af37;
          margin: 0;
        }

        .challenge-icon {
          font-size: 1.25rem;
        }

        .challenge-instruction {
          color: rgba(245, 245, 220, 0.7);
          font-size: 0.875rem;
          margin: 0 0 1.25rem;
        }

        .letter-groups {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 1rem;
        }

        .letter-group {
          display: flex;
          gap: 0.375rem;
        }

        .letter-input {
          width: 44px;
          height: 52px;
          border: 2px solid rgba(212, 175, 55, 0.4);
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.3);
          color: #f5f5dc;
          font-size: 1.5rem;
          font-weight: 700;
          text-align: center;
          caret-color: #d4af37;
          outline: none;
          transition: all 0.2s;
          font-family: 'Crimson Text', Georgia, serif;
          -webkit-appearance: none;
        }

        .letter-input:focus {
          border-color: #d4af37;
          box-shadow: 0 0 12px rgba(212, 175, 55, 0.3);
          background: rgba(212, 175, 55, 0.05);
        }

        .letter-input.filled {
          border-color: rgba(212, 175, 55, 0.6);
          background: rgba(212, 175, 55, 0.08);
        }

        /* Shake animation for wrong answer */
        .answer-challenge.shake {
          animation: shake 0.5s ease-in-out;
        }

        .answer-challenge.shake .letter-input {
          border-color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-8px); }
          80% { transform: translateX(8px); }
        }

        /* Success overlay */
        .success-overlay {
          text-align: center;
          padding: 2rem 1.5rem;
          margin-bottom: 1.5rem;
          animation: fadeIn 0.5s ease;
        }

        .success-check {
          display: inline-flex;
          width: 72px;
          height: 72px;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #00ff88, #22c55e);
          border-radius: 50%;
          font-size: 2.5rem;
          color: #0d1f17;
          margin-bottom: 1rem;
          animation: scaleIn 0.5s ease;
          box-shadow: 0 4px 20px rgba(0, 255, 136, 0.4);
        }

        .success-overlay p {
          color: #00ff88;
          font-family: 'Cinzel', 'Crimson Text', Georgia, serif;
          font-size: 1.25rem;
          font-weight: 700;
          margin: 0;
        }

        @keyframes scaleIn {
          0% { transform: scale(0); }
          60% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* Hint reveal animation */
        .hint-section.hint-reveal {
          animation: slideReveal 0.5s ease-out;
        }

        .scan-btn.scan-reveal {
          animation: slideUp 0.5s ease-out;
        }

        @keyframes slideReveal {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
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
