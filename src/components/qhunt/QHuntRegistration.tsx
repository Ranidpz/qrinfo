'use client';

/**
 * QHuntRegistration - Player registration component
 * Name input, emoji avatar picker, team selection (if enabled)
 *
 * Design: Neon Hunter - Arcade Gaming Vibe
 * - Glowing input fields
 * - Animated emoji grid
 * - Pulsing start button
 */

import React, { useState, useCallback } from 'react';
import { QHuntConfig, QHuntPlayer, QHUNT_TRANSLATIONS } from '@/types/qhunt';

interface QHuntRegistrationProps {
  codeId: string;
  config: QHuntConfig;
  existingPlayer?: QHuntPlayer;
  onRegister: () => Promise<void>;
  onStart: () => void;
  lang: 'he' | 'en';
}

export function QHuntRegistration({
  codeId,
  config,
  existingPlayer,
  onRegister,
  onStart,
  lang,
}: QHuntRegistrationProps) {
  const t = QHUNT_TRANSLATIONS[lang];

  const [step, setStep] = useState<'name' | 'avatar' | 'team' | 'ready'>(
    existingPlayer ? 'ready' : 'name'
  );
  const [name, setName] = useState(existingPlayer?.name || '');
  const [selectedEmoji, setSelectedEmoji] = useState(existingPlayer?.avatarValue || '');
  const [selectedTeam, setSelectedTeam] = useState(existingPlayer?.teamId || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTeamMode = config.mode === 'teams' && config.teams.length > 0;

  // Handle name submit
  const handleNameSubmit = () => {
    if (name.trim().length < 2) {
      setError(lang === 'he' ? 'השם חייב להכיל לפחות 2 תווים' : 'Name must be at least 2 characters');
      return;
    }
    if (name.trim().length > 20) {
      setError(lang === 'he' ? 'השם לא יכול להכיל יותר מ-20 תווים' : 'Name cannot exceed 20 characters');
      return;
    }
    setError(null);
    setStep('avatar');
  };

  // Handle emoji select
  const handleEmojiSelect = (emoji: string) => {
    setSelectedEmoji(emoji);
    if (isTeamMode) {
      setStep('team');
    } else {
      handleRegister(emoji);
    }
  };

  // Handle team select
  const handleTeamSelect = (teamId: string) => {
    setSelectedTeam(teamId);
    handleRegister(selectedEmoji, teamId);
  };

  // Handle registration
  const handleRegister = async (emoji: string, teamId?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Get visitor ID
      const playerId = localStorage.getItem('qhunt_visitor_id') ||
        `player_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      localStorage.setItem('qhunt_visitor_id', playerId);

      const response = await fetch('/api/qhunt/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeId,
          playerId,
          name: name.trim(),
          avatarType: 'emoji',
          avatarValue: emoji,
          teamId: isTeamMode ? teamId : undefined,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Registration failed');
      }

      await onRegister();
      setStep('ready');
    } catch (err) {
      setError(lang === 'he' ? 'שגיאה בהרשמה, נסו שוב' : 'Registration error, please try again');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle game start
  const handleStart = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const playerId = localStorage.getItem('qhunt_visitor_id');
      if (!playerId) throw new Error('No player ID');

      const response = await fetch('/api/qhunt/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId, playerId }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Start failed');
      }

      onStart();
    } catch (err) {
      setError(lang === 'he' ? 'שגיאה בהתחלת המשחק' : 'Error starting game');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="qhunt-registration">
      {/* Header */}
      <div className="qhunt-reg-header">
        <h1 className="qhunt-reg-title">
          {config.branding.gameTitle || (lang === 'he' ? 'ציד קודים' : 'Code Hunt')}
        </h1>
        <p className="qhunt-reg-subtitle">
          {t.joinGame}
        </p>
      </div>

      {/* Step indicator */}
      <div className="qhunt-steps">
        <div className={`qhunt-step ${step === 'name' ? 'active' : 'completed'}`}>
          <span>1</span>
        </div>
        <div className="qhunt-step-line" />
        <div className={`qhunt-step ${step === 'avatar' ? 'active' : ['team', 'ready'].includes(step) ? 'completed' : ''}`}>
          <span>2</span>
        </div>
        {isTeamMode && (
          <>
            <div className="qhunt-step-line" />
            <div className={`qhunt-step ${step === 'team' ? 'active' : step === 'ready' ? 'completed' : ''}`}>
              <span>3</span>
            </div>
          </>
        )}
      </div>

      {/* Content based on step */}
      <div className="qhunt-reg-content">
        {/* Name step */}
        {step === 'name' && (
          <div className="qhunt-step-content animate-in">
            <label className="qhunt-label">{t.enterName}</label>
            <input
              type="text"
              className="qhunt-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={lang === 'he' ? 'השם שלכם...' : 'Your name...'}
              maxLength={20}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
            />
            {error && <p className="qhunt-error">{error}</p>}
            <button
              className="qhunt-btn qhunt-btn-primary"
              onClick={handleNameSubmit}
              disabled={name.trim().length < 2}
            >
              {lang === 'he' ? 'המשך' : 'Continue'}
              <span className="btn-arrow">→</span>
            </button>
          </div>
        )}

        {/* Avatar step */}
        {step === 'avatar' && (
          <div className="qhunt-step-content animate-in">
            <label className="qhunt-label">{t.chooseAvatar}</label>
            <div className="qhunt-emoji-grid">
              {config.emojiPalette.map((emoji, index) => (
                <button
                  key={emoji}
                  className={`qhunt-emoji-btn ${selectedEmoji === emoji ? 'selected' : ''}`}
                  onClick={() => handleEmojiSelect(emoji)}
                  style={{ animationDelay: `${index * 0.05}s` }}
                  disabled={isLoading}
                >
                  {emoji}
                </button>
              ))}
            </div>
            {error && <p className="qhunt-error">{error}</p>}
          </div>
        )}

        {/* Team step */}
        {step === 'team' && isTeamMode && (
          <div className="qhunt-step-content animate-in">
            <label className="qhunt-label">{t.chooseTeam}</label>
            <div className="qhunt-team-grid">
              {config.teams.map((team, index) => (
                <button
                  key={team.id}
                  className={`qhunt-team-btn ${selectedTeam === team.id ? 'selected' : ''}`}
                  onClick={() => handleTeamSelect(team.id)}
                  style={{
                    '--team-color': team.color,
                    animationDelay: `${index * 0.1}s`,
                  } as React.CSSProperties}
                  disabled={isLoading}
                >
                  {team.emoji && <span className="team-emoji">{team.emoji}</span>}
                  <span className="team-name">{team.name}</span>
                </button>
              ))}
            </div>
            {error && <p className="qhunt-error">{error}</p>}
          </div>
        )}

        {/* Ready step */}
        {step === 'ready' && (
          <div className="qhunt-step-content animate-in">
            <div className="qhunt-ready-player">
              <div className="player-avatar">{selectedEmoji || existingPlayer?.avatarValue}</div>
              <div className="player-name">{name || existingPlayer?.name}</div>
              {isTeamMode && selectedTeam && (
                <div
                  className="player-team"
                  style={{ '--team-color': config.teams.find(t => t.id === selectedTeam)?.color } as React.CSSProperties}
                >
                  {config.teams.find(t => t.id === selectedTeam)?.name}
                </div>
              )}
            </div>

            {/* Mission briefing */}
            {config.enableTypeBasedHunting && (
              <div className="qhunt-mission-teaser">
                <div className="mission-icon">🎯</div>
                <p>{lang === 'he' ? 'המשימה שלכם תתגלה ברגע שתתחילו!' : 'Your mission will be revealed when you start!'}</p>
              </div>
            )}

            <button
              className="qhunt-btn qhunt-btn-start"
              onClick={handleStart}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="btn-loading" />
              ) : (
                <>
                  <span className="btn-icon">🚀</span>
                  {t.startHunting}
                </>
              )}
            </button>
            {error && <p className="qhunt-error">{error}</p>}
          </div>
        )}
      </div>

      <style jsx>{`
        .qhunt-registration {
          padding: 24px 16px;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          min-height: 100dvh;
        }

        .qhunt-reg-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .qhunt-reg-title {
          font-size: 2.5rem;
          font-weight: 800;
          color: #fff;
          margin: 0 0 8px;
          text-shadow:
            0 0 20px var(--qhunt-primary),
            0 0 40px var(--qhunt-primary)50;
          animation: titleGlow 2s ease-in-out infinite alternate;
        }

        @keyframes titleGlow {
          from { text-shadow: 0 0 20px var(--qhunt-primary), 0 0 40px var(--qhunt-primary)50; }
          to { text-shadow: 0 0 30px var(--qhunt-primary), 0 0 60px var(--qhunt-primary)80; }
        }

        .qhunt-reg-subtitle {
          font-size: 1.1rem;
          color: var(--qhunt-primary);
          margin: 0;
          opacity: 0.9;
        }

        /* Steps indicator */
        .qhunt-steps {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 32px;
        }

        .qhunt-step {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.9rem;
          background: #ffffff10;
          color: #ffffff60;
          border: 2px solid #ffffff20;
          transition: all 0.3s ease;
        }

        .qhunt-step.active {
          background: var(--qhunt-primary)20;
          color: var(--qhunt-primary);
          border-color: var(--qhunt-primary);
          box-shadow: 0 0 20px var(--qhunt-primary)40;
        }

        .qhunt-step.completed {
          background: var(--qhunt-success)20;
          color: var(--qhunt-success);
          border-color: var(--qhunt-success);
        }

        .qhunt-step-line {
          width: 40px;
          height: 2px;
          background: #ffffff20;
        }

        /* Content */
        .qhunt-reg-content {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .qhunt-step-content {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .animate-in {
          animation: slideUp 0.4s ease-out;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .qhunt-label {
          font-size: 1.2rem;
          font-weight: 600;
          color: #fff;
          margin-bottom: 16px;
          text-align: center;
        }

        /* Input */
        .qhunt-input {
          width: 100%;
          padding: 16px 20px;
          font-size: 1.2rem;
          font-family: 'Assistant', sans-serif;
          background: #ffffff08;
          border: 2px solid #ffffff20;
          border-radius: 16px;
          color: #fff;
          outline: none;
          transition: all 0.3s ease;
          text-align: center;
        }

        .qhunt-input:focus {
          border-color: var(--qhunt-primary);
          box-shadow: 0 0 20px var(--qhunt-primary)30;
          background: #ffffff10;
        }

        .qhunt-input::placeholder {
          color: #ffffff40;
        }

        /* Error */
        .qhunt-error {
          color: #ff4466;
          font-size: 0.9rem;
          text-align: center;
          margin: 12px 0;
          animation: shake 0.3s ease-in-out;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }

        /* Buttons */
        .qhunt-btn {
          padding: 16px 32px;
          font-size: 1.2rem;
          font-weight: 700;
          font-family: 'Assistant', sans-serif;
          border: none;
          border-radius: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.3s ease;
          margin-top: auto;
        }

        .qhunt-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .qhunt-btn-primary {
          background: linear-gradient(135deg, var(--qhunt-primary), var(--qhunt-primary)cc);
          color: #000;
          box-shadow: 0 4px 20px var(--qhunt-primary)40;
        }

        .qhunt-btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 30px var(--qhunt-primary)60;
        }

        .btn-arrow {
          transition: transform 0.3s ease;
        }

        .qhunt-btn:hover .btn-arrow {
          transform: translateX(4px);
        }

        /* Emoji grid */
        .qhunt-emoji-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 10px;
          margin-bottom: 24px;
        }

        .qhunt-emoji-btn {
          aspect-ratio: 1;
          font-size: 1.8rem;
          background: #ffffff08;
          border: 2px solid #ffffff15;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          animation: fadeIn 0.3s ease-out backwards;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
        }

        .qhunt-emoji-btn:hover {
          background: #ffffff15;
          border-color: var(--qhunt-primary)50;
          transform: scale(1.1);
        }

        .qhunt-emoji-btn.selected {
          background: var(--qhunt-primary)20;
          border-color: var(--qhunt-primary);
          box-shadow: 0 0 20px var(--qhunt-primary)40;
          transform: scale(1.15);
        }

        /* Team grid */
        .qhunt-team-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
        }

        .qhunt-team-btn {
          padding: 16px 20px;
          font-size: 1.1rem;
          font-family: 'Assistant', sans-serif;
          background: #ffffff08;
          border: 2px solid var(--team-color, #ffffff20);
          border-radius: 12px;
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: all 0.3s ease;
          animation: slideIn 0.4s ease-out backwards;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
        }

        .qhunt-team-btn:hover {
          background: var(--team-color, #ffffff)15;
          transform: translateX(8px);
        }

        .qhunt-team-btn.selected {
          background: var(--team-color, #ffffff)25;
          box-shadow: 0 0 20px var(--team-color, #ffffff)40;
        }

        .team-emoji {
          font-size: 1.5rem;
        }

        .team-name {
          font-weight: 600;
        }

        /* Ready state */
        .qhunt-ready-player {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          margin-bottom: 24px;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }

        .player-avatar {
          font-size: 4rem;
          animation: bounce 1s ease-in-out infinite;
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .player-name {
          font-size: 1.5rem;
          font-weight: 700;
          color: #fff;
        }

        .player-team {
          padding: 6px 16px;
          background: var(--team-color, #ffffff)20;
          border: 1px solid var(--team-color, #ffffff);
          border-radius: 20px;
          color: var(--team-color, #ffffff);
          font-weight: 600;
          font-size: 0.9rem;
        }

        /* Mission teaser */
        .qhunt-mission-teaser {
          background: #ffffff08;
          border: 1px dashed var(--qhunt-primary)40;
          border-radius: 12px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .mission-icon {
          font-size: 2rem;
        }

        .qhunt-mission-teaser p {
          margin: 0;
          color: var(--qhunt-primary);
          font-size: 0.95rem;
        }

        /* Start button */
        .qhunt-btn-start {
          background: linear-gradient(135deg, var(--qhunt-success), var(--qhunt-success)cc);
          color: #000;
          font-size: 1.4rem;
          padding: 20px 40px;
          box-shadow: 0 4px 30px var(--qhunt-success)40;
          animation: startPulse 1.5s ease-in-out infinite;
        }

        @keyframes startPulse {
          0%, 100% {
            box-shadow: 0 4px 30px var(--qhunt-success)40;
          }
          50% {
            box-shadow: 0 4px 50px var(--qhunt-success)70;
          }
        }

        .qhunt-btn-start:hover:not(:disabled) {
          transform: scale(1.05);
          box-shadow: 0 6px 40px var(--qhunt-success)60;
          animation: none;
        }

        .btn-icon {
          font-size: 1.5rem;
        }

        .btn-loading {
          width: 24px;
          height: 24px;
          border: 3px solid transparent;
          border-top-color: currentColor;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
