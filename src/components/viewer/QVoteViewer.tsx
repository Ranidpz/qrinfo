'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { QVoteConfig, Candidate, QVotePhase } from '@/types/qvote';
import { onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCandidates, submitVotes, getVoterVotes, createCandidate } from '@/lib/qvote';
import { getOrCreateVisitorId } from '@/lib/xp';
import { getBrowserLocale } from '@/lib/publicTranslations';
import { Check, Loader2, Vote, Camera, ChevronLeft, ChevronRight, Trophy, Clock, Users, X, Plus, Trash2 } from 'lucide-react';

interface QVoteViewerProps {
  config: QVoteConfig;
  codeId: string;
  mediaId: string;
  shortId: string;
}

// Translations
const translations = {
  he: {
    registration: 'הרשמה',
    registrationTitle: 'הרשמו לתחרות',
    registrationClosed: 'ההרשמה נסגרה',
    preparationTitle: 'מכינים את ההצבעה...',
    preparationDesc: 'ההצבעה תיפתח בקרוב',
    votingTitle: 'הצביעו למועמד האהוב',
    selectUpTo: 'בחרו עד {n} מועמדים',
    submitVote: 'שלח הצבעה',
    voteSubmitted: 'ההצבעה נשלחה!',
    thankYou: 'תודה על ההשתתפות',
    resultsTitle: 'התוצאות',
    winner: 'זוכה',
    votes: 'קולות',
    finalsTitle: 'גמר!',
    finalistVoting: 'הצביעו לפינליסטים',
    photoUpload: 'העלו תמונה',
    addPhoto: 'הוסיפו תמונה',
    removePhoto: 'הסירו תמונה',
    submit: 'שלח',
    required: 'חובה',
    uploading: 'מעלה...',
    yourSelections: 'הבחירות שלי',
    alreadyVoted: 'כבר הצבעת',
    category: 'קטגוריה',
    selectCategory: 'בחרו קטגוריה',
    back: 'חזרה',
    noCategories: 'אין קטגוריות',
    noCandidates: 'אין מועמדים',
    registrationSuccess: 'נרשמתם בהצלחה!',
    waitForApproval: 'ההרשמה שלכם תאושר בקרוב',
    tapToContinue: 'לחצו להמשך',
    enterButton: 'כניסה',
  },
  en: {
    registration: 'Registration',
    registrationTitle: 'Register to Vote',
    registrationClosed: 'Registration is closed',
    preparationTitle: 'Preparing the vote...',
    preparationDesc: 'Voting will open soon',
    votingTitle: 'Vote for your favorite',
    selectUpTo: 'Select up to {n} candidates',
    submitVote: 'Submit Vote',
    voteSubmitted: 'Vote submitted!',
    thankYou: 'Thank you for participating',
    resultsTitle: 'Results',
    winner: 'Winner',
    votes: 'votes',
    finalsTitle: 'Finals!',
    finalistVoting: 'Vote for finalists',
    photoUpload: 'Upload photo',
    addPhoto: 'Add photo',
    removePhoto: 'Remove photo',
    submit: 'Submit',
    required: 'Required',
    uploading: 'Uploading...',
    yourSelections: 'Your selections',
    alreadyVoted: 'You already voted',
    category: 'Category',
    selectCategory: 'Select a category',
    back: 'Back',
    noCategories: 'No categories',
    noCandidates: 'No candidates',
    registrationSuccess: 'Registered successfully!',
    waitForApproval: 'Your registration will be approved soon',
    tapToContinue: 'Tap to continue',
    enterButton: 'Enter',
  },
};

export default function QVoteViewer({ config, codeId, mediaId, shortId }: QVoteViewerProps) {
  const [locale, setLocale] = useState<'he' | 'en'>('he');
  const t = translations[locale];

  // State
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategorySelect, setShowCategorySelect] = useState(false);

  // Landing page state
  const [showLanding, setShowLanding] = useState(true);

  // Registration state
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [registering, setRegistering] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const visitorId = getOrCreateVisitorId();

  useEffect(() => {
    setLocale(getBrowserLocale());
  }, []);

  // Determine round based on phase
  const round = config.currentPhase === 'finals' ? 2 : 1;

  // Load candidates and check existing votes
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Load candidates
        const loadedCandidates = await getCandidates(codeId, {
          approvedOnly: config.currentPhase === 'voting' || config.currentPhase === 'finals' || config.currentPhase === 'results',
          finalistsOnly: config.currentPhase === 'finals',
          excludeHidden: true,
          orderByVotes: config.currentPhase === 'results',
        });
        setCandidates(loadedCandidates);

        // Check if user has already voted in this round
        if (visitorId && (config.currentPhase === 'voting' || config.currentPhase === 'finals')) {
          const existingVotes = await getVoterVotes(codeId, visitorId, round);
          if (existingVotes.length > 0) {
            setHasVoted(true);
            setSelectedCandidates(existingVotes.map(v => v.candidateId));
          }
        }

        // Check if user has already registered as a candidate
        if (visitorId && config.currentPhase === 'registration') {
          const existingCandidate = loadedCandidates.find(c => c.visitorId === visitorId);
          if (existingCandidate) {
            setAlreadyRegistered(true);
          }
        }
      } catch (error) {
        console.error('Error loading Q.Vote data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [codeId, config.currentPhase, visitorId, round]);

  // Show category select if there are categories
  useEffect(() => {
    if (config.categories.length > 0 && !selectedCategory) {
      setShowCategorySelect(true);
    }
  }, [config.categories, selectedCategory]);

  // Generate photo previews
  useEffect(() => {
    const previews = photoFiles.map(file => URL.createObjectURL(file));
    setPhotoPreviews(previews);
    return () => previews.forEach(url => URL.revokeObjectURL(url));
  }, [photoFiles]);

  // Handle candidate selection for voting
  const handleCandidateSelect = (candidateId: string) => {
    if (hasVoted) return;

    setSelectedCandidates(prev => {
      if (prev.includes(candidateId)) {
        return prev.filter(id => id !== candidateId);
      }
      if (prev.length >= config.maxSelectionsPerVoter) {
        return prev;
      }
      return [...prev, candidateId];
    });
  };

  // Submit vote
  const handleSubmitVote = async () => {
    if (!visitorId || selectedCandidates.length === 0 || submitting) return;

    setSubmitting(true);
    try {
      const result = await submitVotes(
        codeId,
        visitorId,
        selectedCandidates,
        round,
        selectedCategory || undefined
      );

      if (result.success) {
        setHasVoted(true);
      }
    } catch (error) {
      console.error('Error submitting vote:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle photo selection for registration
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files).slice(0, config.maxPhotosPerCandidate - photoFiles.length);
    setPhotoFiles(prev => [...prev, ...newFiles]);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotoFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Submit registration
  const handleSubmitRegistration = async () => {
    setRegistrationError(null);

    if (!visitorId) {
      setRegistrationError(locale === 'he' ? 'שגיאה בזיהוי המשתמש' : 'User identification error');
      return;
    }

    if (photoFiles.length === 0) {
      setRegistrationError(locale === 'he' ? 'יש להעלות תמונה' : 'Please upload a photo');
      return;
    }

    if (registering) return;

    setRegistering(true);
    try {
      // Upload photos
      const uploadedPhotos = [];
      for (const file of photoFiles) {
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);
        formDataUpload.append('codeId', codeId);

        const response = await fetch('/api/qvote/upload', {
          method: 'POST',
          body: formDataUpload,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Upload failed');
        }

        const data = await response.json();
        uploadedPhotos.push({
          id: data.id,
          url: data.url,
          thumbnailUrl: data.thumbnailUrl || data.url,
          order: uploadedPhotos.length,
          uploadedAt: new Date(),
        });
      }

      // Create candidate
      await createCandidate(codeId, {
        source: 'self',
        name: formData.name || undefined,
        formData,
        photos: uploadedPhotos,
        isApproved: false,
        isFinalist: false,
        isHidden: false,
        displayOrder: 0,
        visitorId,
        categoryId: selectedCategory || undefined,
      });

      setRegistrationSuccess(true);
    } catch (error) {
      console.error('Error registering:', error);
      setRegistrationError(
        locale === 'he'
          ? `שגיאה בהרשמה: ${error instanceof Error ? error.message : 'נסו שוב'}`
          : `Registration error: ${error instanceof Error ? error.message : 'Please try again'}`
      );
    } finally {
      setRegistering(false);
    }
  };

  // Get branding styles
  const brandingStyles = {
    background: config.branding.colors.background,
    text: config.branding.colors.text,
    buttonBg: config.branding.colors.buttonBackground,
    buttonText: config.branding.colors.buttonText,
  };

  // Render loading state
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: brandingStyles.background }}
        dir={locale === 'he' ? 'rtl' : 'ltr'}
      >
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: brandingStyles.text }} />
      </div>
    );
  }

  // Render category selection if needed
  if (showCategorySelect && config.categories.length > 0) {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ backgroundColor: brandingStyles.background }}
        dir={locale === 'he' ? 'rtl' : 'ltr'}
      >
        {/* Landing image */}
        {config.branding.landingImage && (
          <div className="relative w-full aspect-video">
            <img
              src={config.branding.landingImage}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="flex-1 p-4 space-y-4">
          <h2
            className="text-2xl font-bold text-center"
            style={{ color: brandingStyles.text }}
          >
            {t.selectCategory}
          </h2>

          <div className="grid grid-cols-1 gap-3">
            {config.categories.filter(c => c.isActive).map((category) => (
              <button
                key={category.id}
                onClick={() => {
                  setSelectedCategory(category.id);
                  setShowCategorySelect(false);
                }}
                className="p-4 rounded-xl border-2 transition-all"
                style={{
                  borderColor: brandingStyles.buttonBg,
                  backgroundColor: `${brandingStyles.buttonBg}10`,
                }}
              >
                {config.branding.categoryImages?.[category.id] && (
                  <img
                    src={config.branding.categoryImages[category.id]}
                    alt=""
                    className="w-full h-32 object-cover rounded-lg mb-2"
                  />
                )}
                <span
                  className="text-lg font-medium"
                  style={{ color: brandingStyles.text }}
                >
                  {locale === 'en' && category.nameEn ? category.nameEn : category.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Render based on phase
  const renderPhaseContent = () => {
    switch (config.currentPhase) {
      case 'registration':
        return renderRegistration();
      case 'preparation':
        return renderPreparation();
      case 'voting':
      case 'finals':
        return renderVoting();
      case 'results':
        return renderResults();
      default:
        return null;
    }
  };

  // Registration Phase
  const renderRegistration = () => {
    // Show success message after registration
    if (registrationSuccess || alreadyRegistered) {
      const successTitle = config.messages?.registrationSuccess || t.registrationSuccess;
      const successSubtitle = config.messages?.waitForApproval || t.waitForApproval;
      const alreadyTitle = config.messages?.alreadyRegistered || (locale === 'he' ? 'כבר נרשמת לתחרות' : 'You are already registered');

      return (
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mb-4">
            <Check className="w-10 h-10 text-white" />
          </div>
          <h2
            className="text-2xl font-bold mb-2"
            style={{ color: brandingStyles.text }}
          >
            {alreadyRegistered ? alreadyTitle : successTitle}
          </h2>
          <p style={{ color: `${brandingStyles.text}99` }}>
            {alreadyRegistered ? '' : successSubtitle}
          </p>
        </div>
      );
    }

    return (
      <div className="flex-1 p-4 space-y-6">
        <h2
          className="text-2xl font-bold text-center"
          style={{ color: brandingStyles.text }}
        >
          {t.registrationTitle}
        </h2>

        {/* Form Fields */}
        <div className="space-y-4">
          {config.formFields.map((field) => (
            <div key={field.id} className="space-y-1">
              <label
                className="text-sm font-medium"
                style={{ color: brandingStyles.text }}
              >
                {locale === 'en' && field.labelEn ? field.labelEn : field.label}
                {field.required && (
                  <span className="text-red-500 ms-1">*</span>
                )}
              </label>
              <input
                type="text"
                value={formData[field.id] || ''}
                onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                placeholder={locale === 'en' && field.placeholderEn ? field.placeholderEn : field.placeholder}
                className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
                style={{
                  borderColor: `${brandingStyles.text}30`,
                  backgroundColor: `${brandingStyles.background}`,
                  color: brandingStyles.text,
                }}
              />
            </div>
          ))}
        </div>

        {/* Photo Upload */}
        <div className="space-y-3">
          <label
            className="text-sm font-medium"
            style={{ color: brandingStyles.text }}
          >
            {t.photoUpload}
            <span className="text-red-500 ms-1">*</span>
          </label>

          {/* Photo Previews */}
          {photoPreviews.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {photoPreviews.map((preview, index) => (
                <div key={index} className="relative w-24 h-24">
                  <img
                    src={preview}
                    alt=""
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <button
                    onClick={() => handleRemovePhoto(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add Photo Button */}
          {photoFiles.length < config.maxPhotosPerCandidate && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-4 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 transition-colors"
              style={{
                borderColor: `${brandingStyles.text}30`,
                color: brandingStyles.text,
              }}
            >
              <Camera className="w-5 h-5" />
              <span>{t.addPhoto}</span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoSelect}
          />
        </div>

        {/* Error Message */}
        {registrationError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-sm text-center">
            {registrationError}
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmitRegistration}
          disabled={registering}
          className="w-full py-4 rounded-xl font-semibold transition-all disabled:opacity-50"
          style={{
            backgroundColor: brandingStyles.buttonBg,
            color: brandingStyles.buttonText,
          }}
        >
          {registering ? (
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          ) : (
            t.submit
          )}
        </button>
      </div>
    );
  };

  // Preparation Phase
  const renderPreparation = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
      <Clock className="w-16 h-16 mb-4" style={{ color: brandingStyles.text }} />
      <h2
        className="text-2xl font-bold mb-2"
        style={{ color: brandingStyles.text }}
      >
        {config.messages.preparationMessage || t.preparationTitle}
      </h2>
      <p style={{ color: `${brandingStyles.text}99` }}>
        {t.preparationDesc}
      </p>
    </div>
  );

  // Voting Phase
  const renderVoting = () => {
    const filteredCandidates = selectedCategory
      ? candidates.filter(c => c.categoryId === selectedCategory)
      : candidates;

    const isFinalsPhase = config.currentPhase === 'finals';

    return (
      <div className="flex-1 flex flex-col">
        {/* Category Header */}
        {selectedCategory && config.categories.length > 0 && (
          <div className="relative">
            {config.branding.categoryImages?.[selectedCategory] && (
              <img
                src={config.branding.categoryImages[selectedCategory]}
                alt=""
                className="w-full h-32 object-cover"
              />
            )}
            <button
              onClick={() => {
                setSelectedCategory(null);
                setShowCategorySelect(true);
              }}
              className="absolute top-2 start-2 p-2 rounded-full bg-black/50 text-white"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Title */}
        <div className="p-4 text-center">
          <h2
            className="text-2xl font-bold"
            style={{ color: brandingStyles.text }}
          >
            {isFinalsPhase ? t.finalsTitle : t.votingTitle}
          </h2>
          {!hasVoted && (
            <p className="text-sm mt-1" style={{ color: `${brandingStyles.text}99` }}>
              {t.selectUpTo.replace('{n}', String(config.maxSelectionsPerVoter))}
            </p>
          )}
        </div>

        {/* Vote Success Message */}
        {hasVoted && (
          <div className="mx-4 mb-4 p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-center">
            <Check className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="font-semibold text-green-600">{t.voteSubmitted}</p>
            <p className="text-sm text-green-600/80">{t.thankYou}</p>
          </div>
        )}

        {/* Candidates Grid */}
        <div className="flex-1 px-4 pb-32 overflow-y-auto">
          {filteredCandidates.length === 0 ? (
            <div className="text-center py-8" style={{ color: `${brandingStyles.text}99` }}>
              {t.noCandidates}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredCandidates.map((candidate) => {
                const isSelected = selectedCandidates.includes(candidate.id);
                const photo = candidate.photos[0];

                return (
                  <button
                    key={candidate.id}
                    onClick={() => handleCandidateSelect(candidate.id)}
                    disabled={hasVoted}
                    className={`relative rounded-xl overflow-hidden transition-all ${
                      isSelected ? 'ring-4 ring-offset-2 scale-[1.02]' : ''
                    } ${hasVoted ? 'opacity-70' : ''}`}
                    style={{
                      '--tw-ring-color': isSelected ? brandingStyles.buttonBg : undefined,
                    } as React.CSSProperties}
                  >
                    {/* Photo */}
                    <div className="aspect-square bg-gray-200">
                      {photo && (
                        <img
                          src={photo.thumbnailUrl || photo.url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    {/* Name & Vote Count */}
                    <div
                      className="p-2"
                      style={{ backgroundColor: `${brandingStyles.background}f0` }}
                    >
                      {config.showNames && candidate.name && (
                        <p
                          className="font-medium text-sm truncate"
                          style={{ color: brandingStyles.text }}
                        >
                          {candidate.name}
                        </p>
                      )}
                      {config.showVoteCount && (
                        <p
                          className="text-xs"
                          style={{ color: `${brandingStyles.text}99` }}
                        >
                          {isFinalsPhase ? candidate.finalsVoteCount : candidate.voteCount} {t.votes}
                        </p>
                      )}
                    </div>

                    {/* Selection Indicator */}
                    {isSelected && (
                      <div
                        className="absolute top-2 end-2 w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: brandingStyles.buttonBg }}
                      >
                        <Check className="w-4 h-4" style={{ color: brandingStyles.buttonText }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Fixed Bottom Bar */}
        {!hasVoted && selectedCandidates.length > 0 && (
          <div
            className="fixed bottom-0 left-0 right-0 p-4 border-t"
            style={{
              backgroundColor: brandingStyles.background,
              borderColor: `${brandingStyles.text}20`,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span style={{ color: brandingStyles.text }}>
                {t.yourSelections}: {selectedCandidates.length}/{config.maxSelectionsPerVoter}
              </span>
            </div>
            <button
              onClick={handleSubmitVote}
              disabled={submitting}
              className="w-full py-4 rounded-xl font-semibold transition-all disabled:opacity-50"
              style={{
                backgroundColor: brandingStyles.buttonBg,
                color: brandingStyles.buttonText,
              }}
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                <>
                  <Vote className="w-5 h-5 inline-block me-2" />
                  {t.submitVote}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    );
  };

  // Results Phase
  const renderResults = () => (
    <div className="flex-1 p-4">
      <h2
        className="text-2xl font-bold text-center mb-6"
        style={{ color: brandingStyles.text }}
      >
        {t.resultsTitle}
      </h2>

      <div className="space-y-3">
        {candidates.slice(0, 10).map((candidate, index) => {
          const photo = candidate.photos[0];
          const isWinner = index === 0;

          return (
            <div
              key={candidate.id}
              className={`flex items-center gap-3 p-3 rounded-xl ${
                isWinner ? 'ring-2 ring-yellow-400' : ''
              }`}
              style={{
                backgroundColor: `${brandingStyles.text}10`,
              }}
            >
              {/* Rank */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  isWinner ? 'bg-yellow-400 text-yellow-900' : ''
                }`}
                style={!isWinner ? {
                  backgroundColor: `${brandingStyles.text}20`,
                  color: brandingStyles.text,
                } : undefined}
              >
                {isWinner ? <Trophy className="w-4 h-4" /> : index + 1}
              </div>

              {/* Photo */}
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                {photo && (
                  <img
                    src={photo.thumbnailUrl || photo.url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                {config.showNames && candidate.name && (
                  <p
                    className="font-medium truncate"
                    style={{ color: brandingStyles.text }}
                  >
                    {candidate.name}
                  </p>
                )}
                {config.showVoteCount && (
                  <p
                    className="text-sm"
                    style={{ color: `${brandingStyles.text}99` }}
                  >
                    {candidate.voteCount} {t.votes}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Determine if we should show landing page
  const hasLandingContent = config.branding.landingImage || config.branding.landingTitle || config.branding.landingSubtitle;

  // Get button text based on current phase
  const getButtonText = () => {
    const phase = config.currentPhase;
    if (config.branding.buttonTexts && phase !== 'results') {
      const text = config.branding.buttonTexts[phase];
      if (text) return text;
    }
    return config.branding.buttonText || t.enterButton;
  };

  // Render landing page
  if (showLanding && hasLandingContent) {
    const overlayOpacity = config.branding.imageOverlayOpacity ?? 40;

    return (
      <div
        className="min-h-screen flex flex-col relative overflow-hidden"
        style={{ backgroundColor: brandingStyles.background }}
        dir={locale === 'he' ? 'rtl' : 'ltr'}
      >
        {/* Background Image */}
        {config.branding.landingImage && (
          <div className="absolute inset-0">
            <img
              src={config.branding.landingImage}
              alt=""
              className="w-full h-full object-cover"
            />
            {/* Overlay */}
            <div
              className="absolute inset-0"
              style={{ backgroundColor: `rgba(0, 0, 0, ${overlayOpacity / 100})` }}
            />
          </div>
        )}

        {/* Content */}
        <div className="relative flex-1 flex flex-col items-center justify-center p-6 text-center">
          {/* Title & Subtitle */}
          {(config.branding.landingTitle || config.branding.landingSubtitle) && (
            <div className="mb-8">
              {config.branding.landingTitle && (
                <h1
                  className="text-3xl font-bold mb-3"
                  style={{ color: config.branding.landingImage ? '#ffffff' : brandingStyles.text }}
                >
                  {config.branding.landingTitle}
                </h1>
              )}
              {config.branding.landingSubtitle && (
                <p
                  className="text-lg"
                  style={{ color: config.branding.landingImage ? 'rgba(255,255,255,0.85)' : `${brandingStyles.text}99` }}
                >
                  {config.branding.landingSubtitle}
                </p>
              )}
            </div>
          )}

          {/* Enter Button */}
          <button
            onClick={() => setShowLanding(false)}
            className="px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:scale-105 active:scale-95 shadow-lg"
            style={{
              backgroundColor: brandingStyles.buttonBg,
              color: brandingStyles.buttonText,
            }}
          >
            {getButtonText()}
          </button>

          {/* Tap to continue hint */}
          <p
            className="mt-6 text-sm opacity-70"
            style={{ color: config.branding.landingImage ? '#ffffff' : brandingStyles.text }}
          >
            {t.tapToContinue}
          </p>
        </div>

        {/* Tap anywhere to enter (optional - makes whole screen tappable) */}
        <button
          onClick={() => setShowLanding(false)}
          className="absolute inset-0 z-0"
          aria-label="Enter"
        />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: brandingStyles.background }}
      dir={locale === 'he' ? 'rtl' : 'ltr'}
    >
      {/* Phase Content */}
      {renderPhaseContent()}
    </div>
  );
}
