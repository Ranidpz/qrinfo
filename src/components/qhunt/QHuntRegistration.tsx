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

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { QHuntConfig, QHuntPlayer, QHUNT_TRANSLATIONS, DEFAULT_QHUNT_EMOJI_PALETTE } from '@/types/qhunt';
import { compressImage } from '@/lib/imageCompression';

// Helper to convert YouTube URLs to embed format
function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null;

  // Match various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return `https://www.youtube.com/embed/${match[1]}?rel=0&modestbranding=1`;
    }
  }

  return null; // Not a YouTube URL
}

interface QHuntRegistrationProps {
  codeId: string;
  config: QHuntConfig;
  existingPlayer?: QHuntPlayer;
  onRegister: () => Promise<void>;
  onStart: () => void;
  lang: 'he' | 'en';
  isEditMode?: boolean;
}

export function QHuntRegistration({
  codeId,
  config,
  existingPlayer,
  onRegister,
  onStart,
  lang,
  isEditMode = false,
}: QHuntRegistrationProps) {
  const t = QHUNT_TRANSLATIONS[lang];

  const [step, setStep] = useState<'registration' | 'team' | 'ready'>(
    isEditMode ? 'registration' : (existingPlayer ? 'ready' : 'registration')
  );
  const [name, setName] = useState(existingPlayer?.name || '');
  const [selectedEmoji, setSelectedEmoji] = useState(existingPlayer?.avatarValue || '');
  const [selectedTeam, setSelectedTeam] = useState(existingPlayer?.teamId || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarType, setAvatarType] = useState<'emoji' | 'selfie'>(
    existingPlayer?.avatarType === 'selfie' ? 'selfie' : 'emoji'
  );
  const [photoUrl, setPhotoUrl] = useState<string | null>(
    existingPlayer?.avatarType === 'selfie' ? existingPlayer.avatarValue : null
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const isTeamMode = config.mode === 'teams' && config.teams.length > 0;

  // Handle registration continue (name + avatar validation)
  const handleRegistrationContinue = () => {
    if (name.trim().length < 2) {
      setError(lang === 'he' ? 'השם חייב להכיל לפחות 2 תווים' : 'Name must be at least 2 characters');
      return;
    }
    if (name.trim().length > 20) {
      setError(lang === 'he' ? 'השם לא יכול להכיל יותר מ-20 תווים' : 'Name cannot exceed 20 characters');
      return;
    }
    if (!selectedEmoji && !photoUrl) {
      setError(lang === 'he' ? 'בחרו אווטר או צלמו תמונה' : 'Choose an avatar or take a photo');
      return;
    }
    setError(null);

    const avatarValue = avatarType === 'selfie' ? photoUrl! : selectedEmoji;

    if (isTeamMode) {
      setStep('team');
    } else {
      handleRegister(avatarValue, undefined, avatarType);
    }
  };

  // Handle emoji select
  const handleEmojiSelect = (emoji: string) => {
    setSelectedEmoji(emoji);
    setAvatarType('emoji');
    setPhotoUrl(null);
    setError(null); // Clear any avatar error
    // Don't auto-proceed - user clicks continue button
  };

  // Handle photo upload
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      // Compress image on client side first (200x200 for avatar)
      const compressed = await compressImage(file, {
        maxWidth: 200,
        maxHeight: 200,
        maxSizeKB: 100,
        quality: 0.85,
      });

      // Get visitor ID
      const visitorId = localStorage.getItem('qhunt_visitor_id') ||
        `player_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      localStorage.setItem('qhunt_visitor_id', visitorId);

      // Create form data
      const formData = new FormData();
      formData.append('file', compressed.blob, 'avatar.webp');
      formData.append('codeId', codeId);
      formData.append('visitorId', visitorId);

      // Upload to server
      const response = await fetch('/api/avatar/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      setPhotoUrl(result.url);
      setAvatarType('selfie');
      setSelectedEmoji(''); // Clear emoji selection
      setError(null); // Clear any avatar error
      // Don't auto-proceed - user clicks continue button
    } catch (err) {
      console.error('Photo upload error:', err);
      setError(lang === 'he' ? 'שגיאה בהעלאת התמונה, נסו שוב' : 'Error uploading photo, please try again');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle team select
  const handleTeamSelect = (teamId: string) => {
    setSelectedTeam(teamId);
    // Use photo URL if photo type, otherwise use emoji
    const avatarValue = avatarType === 'selfie' ? photoUrl! : selectedEmoji;
    handleRegister(avatarValue, teamId, avatarType);
  };

  // Handle registration
  const handleRegister = async (avatarValue: string, teamId?: string, type: 'emoji' | 'selfie' = 'emoji') => {
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
          avatarType: type,
          avatarValue: avatarValue,
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
          {isEditMode
            ? (lang === 'he' ? 'עריכת פרופיל' : 'Edit Profile')
            : (config.branding.gameTitle || (lang === 'he' ? 'ציד קודים' : 'Code Hunt'))}
        </h1>
        {!isEditMode && (
          <p className="qhunt-reg-subtitle">
            {t.joinGame}
          </p>
        )}
      </div>

      {/* Step indicator - hide in edit mode */}
      {!isEditMode && <div className="qhunt-steps">
        <button
          className={`qhunt-step ${step === 'registration' ? 'active' : 'completed'}`}
          onClick={() => step !== 'registration' && setStep('registration')}
          disabled={step === 'registration'}
        >
          <span>1</span>
        </button>
        {isTeamMode && (
          <>
            <div className="qhunt-step-line" />
            <button
              className={`qhunt-step ${step === 'team' ? 'active' : step === 'ready' ? 'completed' : ''}`}
              onClick={() => step === 'ready' && setStep('team')}
              disabled={step !== 'ready' && step !== 'team'}
            >
              <span>2</span>
            </button>
          </>
        )}
        <div className="qhunt-step-line" />
        <button
          className={`qhunt-step ${step === 'ready' ? 'active' : ''}`}
          disabled={step !== 'ready'}
        >
          <span>{isTeamMode ? '3' : '2'}</span>
        </button>
      </div>}

      {/* Content based on step */}
      <div className="qhunt-reg-content">
        {/* Registration step (name + avatar combined) */}
        {step === 'registration' && (
          <div className={`qhunt-step-content qhunt-registration-step animate-in ${isEditMode ? 'edit-mode' : ''}`}>
            {/* Name input section */}
            <div className="registration-name-section">
              {isEditMode ? (
                // Editable name in edit mode (tap to edit)
                <div className="edit-name-section">
                  {isEditingName ? (
                    <div className="edit-name-input-wrapper">
                      <input
                        ref={nameInputRef}
                        type="text"
                        className="edit-name-input"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onBlur={() => name.trim().length >= 2 && setIsEditingName(false)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && name.trim().length >= 2) {
                            setIsEditingName(false);
                          }
                        }}
                        maxLength={20}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <button
                      className="edit-name-display"
                      onClick={() => {
                        setIsEditingName(true);
                        setTimeout(() => nameInputRef.current?.focus(), 50);
                      }}
                    >
                      <span className="edit-name-text">{name}</span>
                    </button>
                  )}
                </div>
              ) : (
                // Normal name input for new registration (no label, placeholder only)
                <input
                  type="text"
                  className="qhunt-input qhunt-input-compact"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={lang === 'he' ? 'בחרו כינוי...' : 'Choose a nickname...'}
                  maxLength={20}
                  autoFocus
                />
              )}
            </div>

            {/* Avatar selection section */}
            <div className="registration-avatar-section">
              <label className="qhunt-label qhunt-label-compact">
                {isEditMode
                  ? (lang === 'he' ? 'עדכנו את האווטר' : 'Update your avatar')
                  : (lang === 'he' ? 'בחרו אווטר' : 'Choose avatar')}
              </label>

              {/* Scrollable emoji area */}
              <div className="avatar-scroll-area">
                <div className="qhunt-emoji-grid">
                  {/* Upload photo button */}
                  <button
                    className={`qhunt-emoji-btn upload-btn ${avatarType === 'selfie' && photoUrl ? 'selected' : ''}`}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading || isUploading}
                    style={{ animationDelay: '0s' }}
                  >
                    {isUploading ? (
                      <span className="upload-spinner" />
                    ) : photoUrl && avatarType === 'selfie' ? (
                      <img src={photoUrl} alt="avatar" className="photo-preview" />
                    ) : (
                      <span className="upload-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </span>
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={handlePhotoSelect}
                    style={{ display: 'none' }}
                  />
                  {DEFAULT_QHUNT_EMOJI_PALETTE.map((emoji, index) => (
                    <button
                      key={emoji}
                      className={`qhunt-emoji-btn ${selectedEmoji === emoji && avatarType === 'emoji' ? 'selected' : ''}`}
                      onClick={() => handleEmojiSelect(emoji)}
                      style={{ animationDelay: `${(index + 1) * 0.05}s` }}
                      disabled={isLoading || isUploading}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error && <p className="qhunt-error">{error}</p>}

            {/* Continue/Save button */}
            <div className="registration-step-footer">
              {isEditMode ? (
                <button
                  className="qhunt-btn qhunt-btn-save"
                  onClick={() => {
                    const avatarValue = avatarType === 'selfie' ? photoUrl! : selectedEmoji;
                    handleRegister(avatarValue, existingPlayer?.teamId, avatarType);
                  }}
                  disabled={isLoading || isUploading || (!selectedEmoji && !photoUrl) || name.trim().length < 2}
                >
                  {isLoading ? (
                    <span className="btn-loading" />
                  ) : (
                    <>
                      <span className="btn-icon">✓</span>
                      {lang === 'he' ? 'שמור וחזור' : 'Save & Return'}
                    </>
                  )}
                </button>
              ) : (
                <button
                  className="qhunt-btn qhunt-btn-primary"
                  onClick={handleRegistrationContinue}
                  disabled={isLoading || isUploading || name.trim().length < 2 || (!selectedEmoji && !photoUrl)}
                >
                  {isLoading ? (
                    <span className="btn-loading" />
                  ) : (
                    <>
                      {lang === 'he' ? 'המשך' : 'Continue'}
                      <span className="btn-arrow">→</span>
                    </>
                  )}
                </button>
              )}
            </div>
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
          <div className="qhunt-step-content qhunt-ready-step animate-in">
            {/* Profile Header - Fixed at top */}
            <div className="qhunt-profile-header">
              <div className="profile-avatar-frame">
                <div className={`profile-avatar ${avatarType === 'selfie' ? 'photo-avatar' : ''}`}>
                  {avatarType === 'selfie' && photoUrl ? (
                    <img src={photoUrl} alt="avatar" className="avatar-photo" />
                  ) : (
                    selectedEmoji || existingPlayer?.avatarValue
                  )}
                </div>
                <div className="profile-glow" />
              </div>
              <div className="profile-name">{name || existingPlayer?.name}</div>
              {isTeamMode && selectedTeam && (
                <div
                  className="profile-team"
                  style={{ '--team-color': config.teams.find(t => t.id === selectedTeam)?.color } as React.CSSProperties}
                >
                  {config.teams.find(t => t.id === selectedTeam)?.name}
                </div>
              )}
            </div>

            {/* Scrollable content area - only show intro content if configured */}
            {((config.branding.introVideoEnabled && config.branding.introVideoUrl) || config.branding.introText || config.branding.introTextEn) && (
              <div className="qhunt-ready-scroll">
                {/* Intro Video - only show if enabled */}
                {config.branding.introVideoEnabled && config.branding.introVideoUrl && (() => {
                  const youtubeEmbedUrl = getYouTubeEmbedUrl(config.branding.introVideoUrl);
                  return youtubeEmbedUrl ? (
                    // YouTube embed
                    <div className="qhunt-intro-video youtube-video">
                      <iframe
                        src={youtubeEmbedUrl}
                        title="Intro Video"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="intro-video-player"
                      />
                    </div>
                  ) : (
                    // Direct video file
                    <div className="qhunt-intro-video">
                      <video
                        src={config.branding.introVideoUrl}
                        controls
                        playsInline
                        poster={config.branding.eventLogo}
                        className="intro-video-player"
                      />
                    </div>
                  );
                })()}

                {/* Intro Text - show if video is disabled or no video URL */}
                {!(config.branding.introVideoEnabled && config.branding.introVideoUrl) && (config.branding.introText || config.branding.introTextEn) && (
                  <div className="qhunt-intro-text">
                    <div className="intro-text-content">
                      {lang === 'he'
                        ? (config.branding.introText || config.branding.introTextEn)
                        : (config.branding.introTextEn || config.branding.introText)
                      }
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Fixed start button at bottom */}
            <div className="qhunt-ready-actions">
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
          </div>
        )}
      </div>

      <style jsx>{`
        .qhunt-registration {
          padding: 16px 16px;
          padding-bottom: env(safe-area-inset-bottom, 16px);
          display: flex;
          flex-direction: column;
          flex: 1;
          overflow-x: hidden;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        @media (min-height: 700px) {
          .qhunt-registration {
            padding-top: 24px;
          }
        }

        /* Desktop: no scroll needed */
        @media (min-width: 768px) {
          .qhunt-registration {
            overflow: visible;
            padding: 32px 24px;
          }
        }

        .qhunt-reg-header {
          text-align: center;
          margin-bottom: 16px;
        }

        .qhunt-registration:has(.edit-mode) .qhunt-reg-header {
          margin-bottom: 16px;
        }

        .qhunt-reg-title {
          font-size: 2rem;
          font-weight: 800;
          color: #fff;
          margin: 0 0 8px;
          text-shadow:
            0 0 20px var(--qhunt-primary),
            0 0 40px color-mix(in srgb, var(--qhunt-primary) 40%, transparent);
          animation: titleGlow 2s ease-in-out infinite alternate;
        }

        @media (min-width: 400px) {
          .qhunt-reg-title {
            font-size: 2.5rem;
          }
        }

        @keyframes titleGlow {
          from { text-shadow: 0 0 20px var(--qhunt-primary), 0 0 40px color-mix(in srgb, var(--qhunt-primary) 40%, transparent); }
          to { text-shadow: 0 0 30px var(--qhunt-primary), 0 0 60px color-mix(in srgb, var(--qhunt-primary) 60%, transparent); }
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
          margin-bottom: 20px;
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
          cursor: default;
        }

        .qhunt-step.active {
          background: color-mix(in srgb, var(--qhunt-primary) 15%, transparent);
          color: var(--qhunt-primary);
          border-color: var(--qhunt-primary);
          box-shadow: 0 0 20px color-mix(in srgb, var(--qhunt-primary) 30%, transparent);
        }

        .qhunt-step.completed {
          background: color-mix(in srgb, var(--qhunt-success) 15%, transparent);
          color: var(--qhunt-success);
          border-color: var(--qhunt-success);
          cursor: pointer;
        }

        .qhunt-step.completed:hover:not(:disabled) {
          transform: scale(1.1);
          box-shadow: 0 0 15px color-mix(in srgb, var(--qhunt-success) 40%, transparent);
        }

        .qhunt-step:disabled {
          cursor: default;
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
          display: flex;
          flex-direction: column;
        }

        /* Combined registration step - full height layout */
        .qhunt-registration-step {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          gap: 12px;
        }

        .qhunt-registration-step.edit-mode {
          height: 100%;
        }

        /* Desktop: no scroll */
        @media (min-width: 768px) {
          .qhunt-registration-step {
            overflow: visible;
            gap: 16px;
          }
        }

        .registration-name-section {
          flex-shrink: 0;
        }

        .registration-avatar-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: visible;
        }

        .qhunt-input-compact {
          margin-bottom: 0;
        }

        .registration-step-footer {
          flex-shrink: 0;
          padding-top: 16px;
          background: linear-gradient(to top, var(--qhunt-bg, #0a0f1a) 80%, transparent);
          margin: 0 -16px -24px;
          padding-left: 16px;
          padding-right: 16px;
          padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
        }

        .registration-step-footer .qhunt-btn {
          margin-top: 0;
        }

        /* Desktop: simpler footer without gradient */
        @media (min-width: 768px) {
          .registration-step-footer {
            background: transparent;
            margin: 0;
            padding: 24px 0 0;
          }
        }

        .avatar-scroll-area {
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          min-height: 80px;
          max-height: 160px;
          padding: 4px 0;
          margin: 0 -4px;
          padding-left: 4px;
          padding-right: 4px;
          scrollbar-width: thin;
          scrollbar-color: color-mix(in srgb, var(--qhunt-primary) 30%, transparent) transparent;
          touch-action: pan-y;
        }

        @media (min-height: 700px) {
          .avatar-scroll-area {
            max-height: 180px;
          }
        }

        /* Desktop: no scroll, show all avatars */
        @media (min-width: 768px) {
          .avatar-scroll-area {
            overflow: visible;
            max-height: none;
          }
        }

        .avatar-scroll-area::-webkit-scrollbar {
          width: 6px;
        }

        .avatar-scroll-area::-webkit-scrollbar-track {
          background: transparent;
        }

        .avatar-scroll-area::-webkit-scrollbar-thumb {
          background: color-mix(in srgb, var(--qhunt-primary) 30%, transparent);
          border-radius: 3px;
        }

        .avatar-scroll-area::-webkit-scrollbar-thumb:hover {
          background: color-mix(in srgb, var(--qhunt-primary) 50%, transparent);
        }

        .qhunt-label-compact {
          margin-bottom: 12px;
        }

        /* Ready step - simple scrollable layout */
        .qhunt-ready-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding-bottom: 24px;
        }

        .qhunt-ready-scroll {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          padding: 0 8px;
        }

        .qhunt-ready-actions {
          width: 100%;
          padding-top: 8px;
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

        /* Edit name section */
        .edit-name-section {
          margin-bottom: 12px;
          display: flex;
          justify-content: center;
        }

        .edit-name-display {
          background: #ffffff08;
          border: 1px dashed #ffffff30;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px 20px;
          border-radius: 20px;
          transition: all 0.2s ease;
        }

        .edit-name-display:hover {
          background: #ffffff15;
          border-color: var(--qhunt-primary);
        }

        .edit-name-text {
          font-size: 1.3rem;
          font-weight: 700;
          color: #fff;
          text-shadow: 0 0 15px color-mix(in srgb, var(--qhunt-primary) 40%, transparent);
        }

        .edit-name-input-wrapper {
          width: 100%;
          max-width: 280px;
        }

        .edit-name-input {
          width: 100%;
          padding: 8px 16px;
          font-size: 1.3rem;
          font-weight: 700;
          font-family: 'Assistant', sans-serif;
          background: rgba(255,255,255,0.06);
          border: 2px solid var(--qhunt-primary);
          border-radius: 20px;
          color: #fff;
          text-align: center;
          outline: none;
          box-shadow: 0 0 20px color-mix(in srgb, var(--qhunt-primary) 25%, transparent);
        }

        .edit-name-input:focus {
          box-shadow: 0 0 30px color-mix(in srgb, var(--qhunt-primary) 40%, transparent);
        }

        /* Input */
        .qhunt-input {
          width: 100%;
          padding: 16px 20px;
          font-size: 1.2rem;
          font-family: 'Assistant', sans-serif;
          background: rgba(255,255,255,0.05);
          border: 2px solid rgba(255,255,255,0.12);
          border-radius: 16px;
          color: #fff;
          outline: none;
          transition: all 0.3s ease;
          text-align: center;
        }

        .qhunt-input:focus {
          border-color: var(--qhunt-primary);
          box-shadow: 0 0 20px color-mix(in srgb, var(--qhunt-primary) 25%, transparent);
          background: rgba(255,255,255,0.06);
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
          margin-top: 24px;
          width: 100%;
        }

        .qhunt-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .qhunt-btn-primary {
          background: linear-gradient(135deg, #00ff88, #00cc6a);
          color: #000;
          box-shadow: 0 4px 20px rgba(0, 255, 136, 0.4);
        }

        .qhunt-btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 30px rgba(0, 255, 136, 0.6);
        }

        .btn-arrow {
          transition: transform 0.3s ease;
        }

        .qhunt-btn:hover .btn-arrow {
          transform: translateX(4px);
        }

        .qhunt-btn-save {
          background: linear-gradient(135deg, #00bfff, #0099cc);
          color: #000;
          box-shadow: 0 4px 20px rgba(0, 191, 255, 0.4);
          margin-top: 16px;
        }

        .qhunt-btn-save:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 30px rgba(0, 191, 255, 0.6);
        }

        /* Emoji grid */
        .qhunt-emoji-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
          max-width: 100%;
          padding: 0 4px;
        }

        @media (min-width: 420px) {
          .qhunt-emoji-grid {
            grid-template-columns: repeat(6, 1fr);
          }
        }

        .qhunt-emoji-btn {
          width: 100%;
          aspect-ratio: 1;
          font-size: 1.6rem;
          background: #ffffff08;
          border: 2px solid #ffffff15;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          animation: fadeIn 0.3s ease-out backwards;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
        }

        .qhunt-emoji-btn:hover {
          background: rgba(255,255,255,0.08);
          border-color: color-mix(in srgb, var(--qhunt-primary) 40%, transparent);
          transform: scale(1.1);
        }

        .qhunt-emoji-btn.selected {
          background: color-mix(in srgb, var(--qhunt-primary) 15%, transparent);
          border-color: var(--qhunt-primary);
          box-shadow: 0 0 20px color-mix(in srgb, var(--qhunt-primary) 30%, transparent);
          transform: scale(1.15);
        }

        /* Upload photo button */
        .upload-btn {
          background: linear-gradient(145deg, rgba(0,255,136,0.12), rgba(0,255,136,0.05));
          border-color: var(--qhunt-success, #00ff88);
          position: relative;
          overflow: hidden;
        }

        .upload-btn:hover {
          border-color: var(--qhunt-success, #00ff88);
          background: color-mix(in srgb, var(--qhunt-success) 20%, transparent);
          box-shadow: 0 0 15px color-mix(in srgb, var(--qhunt-success) 30%, transparent);
        }

        .upload-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--qhunt-success, #00ff88);
        }

        .upload-icon svg {
          width: 1.4rem;
          height: 1.4rem;
        }

        @media (min-width: 400px) {
          .upload-icon svg {
            width: 1.6rem;
            height: 1.6rem;
          }
        }

        .photo-preview {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 10px;
        }

        .upload-spinner {
          width: 24px;
          height: 24px;
          border: 3px solid #ffffff30;
          border-top-color: var(--qhunt-primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
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

        /* Profile Header */
        .qhunt-profile-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding-bottom: 12px;
          flex-shrink: 0;
        }

        .profile-avatar-frame {
          position: relative;
          width: 70px;
          height: 70px;
        }

        .profile-avatar {
          width: 100%;
          height: 100%;
          font-size: 2.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
          border: 2px solid var(--qhunt-primary);
          border-radius: 50%;
          box-shadow:
            0 0 15px color-mix(in srgb, var(--qhunt-primary) 30%, transparent),
            inset 0 0 15px color-mix(in srgb, var(--qhunt-primary) 15%, transparent);
          animation: avatarPulse 2s ease-in-out infinite;
          overflow: hidden;
        }

        .profile-avatar.photo-avatar {
          padding: 0;
        }

        .avatar-photo {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .profile-glow {
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          background: radial-gradient(circle, color-mix(in srgb, var(--qhunt-primary) 25%, transparent) 0%, transparent 70%);
          animation: glowPulse 2s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes avatarPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }

        @keyframes glowPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        .profile-name {
          font-size: 1.2rem;
          font-weight: 700;
          color: #fff;
          text-shadow: 0 0 10px color-mix(in srgb, var(--qhunt-primary) 30%, transparent);
        }

        .profile-team {
          padding: 4px 12px;
          background: color-mix(in srgb, var(--team-color, #ffffff) 15%, transparent);
          border: 1px solid var(--team-color, #ffffff);
          border-radius: 16px;
          color: var(--team-color, #ffffff);
          font-weight: 600;
          font-size: 0.85rem;
        }

        /* Intro Video */
        .qhunt-intro-video {
          width: 100%;
          max-width: 280px;
          margin: 0 auto;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
        }

        .qhunt-intro-video.youtube-video {
          position: relative;
          padding-bottom: 56.25%; /* 16:9 aspect ratio */
          height: 0;
        }

        .qhunt-intro-video.youtube-video iframe {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border: none;
          border-radius: 12px;
        }

        .intro-video-player {
          width: 100%;
          display: block;
          background: #000;
          border-radius: 12px;
        }

        /* Intro Text */
        .qhunt-intro-text {
          width: 100%;
          max-width: 280px;
          margin: 0 auto;
          background: linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
          border: 1px solid color-mix(in srgb, var(--qhunt-primary) 25%, transparent);
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
        }

        .intro-text-content {
          color: #fff;
          font-size: 1rem;
          line-height: 1.6;
          text-align: center;
          white-space: pre-line;
        }

        /* Start button */
        .qhunt-btn-start {
          background: linear-gradient(135deg, #00ff88, #00cc6a);
          color: #000;
          font-size: 1.2rem;
          padding: 16px 36px;
          margin-top: 0;
          box-shadow: 0 4px 30px rgba(0, 255, 136, 0.4);
          animation: startPulse 1.5s ease-in-out infinite;
        }

        @keyframes startPulse {
          0%, 100% {
            box-shadow: 0 4px 30px rgba(0, 255, 136, 0.4);
          }
          50% {
            box-shadow: 0 4px 50px rgba(0, 255, 136, 0.7);
          }
        }

        .qhunt-btn-start:hover:not(:disabled) {
          transform: scale(1.05);
          box-shadow: 0 6px 40px rgba(0, 255, 136, 0.6);
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
