'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { QVoteConfig, Candidate, QVotePhase } from '@/types/qvote';
import { onSnapshot, collection, query, where, orderBy, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCandidates, getVoterVotes, createCandidate } from '@/lib/qvote';
import { MediaItem } from '@/types';
import { getOrCreateVisitorId } from '@/lib/xp';
import { compressImage, createCompressedFile, formatBytes } from '@/lib/imageCompression';
import { getBrowserLocale } from '@/lib/publicTranslations';
import { Check, Loader2, Vote, Camera, ChevronLeft, ChevronRight, Trophy, Clock, Users, X, Plus, Trash2, UserPlus, Shield } from 'lucide-react';
import QVoteVotingView from './qvote/QVoteVotingView';
import QVoteResultsView from './qvote/QVoteResultsView';
import PhoneVerificationModal from '../modals/PhoneVerificationModal';

interface QVoteViewerProps {
  config: QVoteConfig;
  codeId: string;
  mediaId: string;
  shortId: string;
  ownerId?: string;
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
    submitVote: 'שלחו הצבעה',
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
    calculatingTitle: 'מחשבים תוצאות...',
    calculatingDesc: 'התוצאות יוצגו בקרוב',
    gracePeriod: 'סיימו להצביע',
    secondsLeft: 'שניות נותרו',
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
    calculatingTitle: 'Calculating results...',
    calculatingDesc: 'Results will be displayed soon',
    gracePeriod: 'Finish voting',
    secondsLeft: 'seconds left',
  },
};

export default function QVoteViewer({ config: initialConfig, codeId, mediaId, shortId, ownerId }: QVoteViewerProps) {
  const [locale, setLocale] = useState<'he' | 'en'>('he');
  const t = translations[locale];

  // Live config state - starts with initial config but updates in real-time
  const [liveConfig, setLiveConfig] = useState<QVoteConfig>(initialConfig);
  const config = liveConfig; // Use liveConfig for all rendering

  // State
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // Track votes per category (categoryId -> hasVoted), use '_global' for no-category voting
  const [votedCategories, setVotedCategories] = useState<Record<string, boolean>>({});
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategorySelect, setShowCategorySelect] = useState(false);
  const [showVoteSuccessMessage, setShowVoteSuccessMessage] = useState(false);

  // Landing page state
  const [showLanding, setShowLanding] = useState(true);
  const [showLanguageSelect, setShowLanguageSelect] = useState(false);

  // Registration state
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [registering, setRegistering] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  // Grace period state - allows users to finish their action before phase change
  const [userPhase, setUserPhase] = useState<QVotePhase>(initialConfig.currentPhase);
  const [gracePeriodActive, setGracePeriodActive] = useState(false);
  const [gracePeriodSeconds, setGracePeriodSeconds] = useState(0);
  const gracePeriodTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Vote change tracking state (stored in localStorage per code+round)
  const [voteChangeCount, setVoteChangeCount] = useState(0);

  // Verification state
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationSession, setVerificationSession] = useState<{
    phone: string;
    sessionToken: string;
    votesRemaining: number;
    maxVotes: number;
  } | null>(null);
  const [pendingVoteAfterVerification, setPendingVoteAfterVerification] = useState(false);

  // Tablet/Kiosk mode state
  const [tabletResetCountdown, setTabletResetCountdown] = useState<number | null>(null);
  const tabletTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const visitorId = getOrCreateVisitorId();

  // Compute hasVoted for current category
  const currentCategoryKey = selectedCategory || '_global';
  const hasVoted = votedCategories[currentCategoryKey] || false;

  // Set language based on config.languageMode
  useEffect(() => {
    const langMode = config.languageMode || 'choice';
    if (langMode === 'he') {
      setLocale('he');
      setShowLanguageSelect(false);
    } else if (langMode === 'en') {
      setLocale('en');
      setShowLanguageSelect(false);
    } else {
      // 'choice' - show language selection buttons
      setLocale(getBrowserLocale());
      setShowLanguageSelect(true);
    }
  }, [config.languageMode]);

  // Check for scheduled phase transitions every 10 seconds
  useEffect(() => {
    if (!config.schedule) return;

    const checkSchedule = () => {
      const now = new Date();
      const phases = ['registration', 'preparation', 'voting', 'finals', 'calculating', 'results'] as const;

      // Find the latest scheduled phase that has passed
      let latestScheduledPhase: typeof phases[number] | null = null;
      let latestScheduledTime: Date | null = null;

      for (const phase of phases) {
        const scheduleTime = config.schedule?.[phase];
        if (scheduleTime) {
          const scheduledDate = new Date(scheduleTime);
          if (scheduledDate <= now) {
            if (!latestScheduledTime || scheduledDate > latestScheduledTime) {
              latestScheduledTime = scheduledDate;
              latestScheduledPhase = phase;
            }
          }
        }
      }

      // If we found a scheduled phase that should be active and it's different from current
      if (latestScheduledPhase && latestScheduledPhase !== userPhase && !gracePeriodActive) {
        console.log('[QVoteViewer] Auto-transitioning to scheduled phase:', latestScheduledPhase);
        setUserPhase(latestScheduledPhase);
      }
    };

    // Check immediately and then every 10 seconds
    checkSchedule();
    const interval = setInterval(checkSchedule, 10000);

    return () => clearInterval(interval);
  }, [config.schedule, userPhase, gracePeriodActive]);

  // Subscribe to real-time config updates from Firestore
  useEffect(() => {
    if (!codeId) return;

    const unsubscribe = onSnapshot(doc(db, 'codes', codeId), (snapshot) => {
      if (!snapshot.exists()) return;

      const data = snapshot.data();
      const media = data.media as MediaItem[] | undefined;
      if (!media) return;

      // Find the QVote media item
      const qvoteMedia = media.find((m) => m.id === mediaId || m.type === 'qvote');
      if (qvoteMedia?.qvoteConfig) {
        const newConfig = qvoteMedia.qvoteConfig!;

        setLiveConfig((prev) => {
          // Check if phase changed
          if (prev.currentPhase !== newConfig.currentPhase) {
            console.log('[QVoteViewer] Phase change detected:', {
              previousPhase: prev.currentPhase,
              newPhase: newConfig.currentPhase,
              userPhase,
            });

            // Check if user is in the middle of an action that needs grace period
            const needsGracePeriod = (
              // User is voting/selecting and phase moves away from voting/finals
              ((userPhase === 'voting' || userPhase === 'finals') &&
               !hasVoted &&
               selectedCandidates.length > 0 &&
               (newConfig.currentPhase === 'calculating' || newConfig.currentPhase === 'results'))
            );

            if (needsGracePeriod && !gracePeriodActive) {
              // Start grace period - 10 seconds for voting
              setGracePeriodActive(true);
              setGracePeriodSeconds(10);

              // Clear any existing timer
              if (gracePeriodTimerRef.current) {
                clearInterval(gracePeriodTimerRef.current);
              }

              // Start countdown
              gracePeriodTimerRef.current = setInterval(() => {
                setGracePeriodSeconds((prev) => {
                  if (prev <= 1) {
                    // Grace period ended - force transition
                    clearInterval(gracePeriodTimerRef.current!);
                    setGracePeriodActive(false);
                    setUserPhase(newConfig.currentPhase);
                    return 0;
                  }
                  return prev - 1;
                });
              }, 1000);

              console.log('[QVoteViewer] Grace period started - 10 seconds to finish voting');
            } else if (!needsGracePeriod) {
              // No grace period needed - immediate transition
              setUserPhase(newConfig.currentPhase);
            }
          }

          // Check if votes were reset (stats show 0 voters/votes)
          const prevStats = prev.stats;
          const newStats = newConfig.stats;
          const wasReset = (
            prevStats &&
            newStats &&
            (prevStats.totalVoters > 0 || prevStats.totalVotes > 0) &&
            newStats.totalVoters === 0 &&
            newStats.totalVotes === 0
          );

          if (wasReset) {
            console.log('[QVoteViewer] Votes reset detected - allowing user to vote again');
            setVotedCategories({});
            setSelectedCandidates([]);
          }

          // Always update the live config (for branding, etc.)
          if (
            prev.currentPhase !== newConfig.currentPhase ||
            JSON.stringify(prev.branding) !== JSON.stringify(newConfig.branding) ||
            prev.maxSelectionsPerVoter !== newConfig.maxSelectionsPerVoter ||
            prev.showVoteCount !== newConfig.showVoteCount ||
            prev.showNames !== newConfig.showNames ||
            JSON.stringify(prev.stats) !== JSON.stringify(newStats)
          ) {
            return newConfig;
          }
          return prev;
        });
      }
    }, (error) => {
      console.error('[QVoteViewer] Error listening to config updates:', error);
    });

    return () => {
      unsubscribe();
      if (gracePeriodTimerRef.current) {
        clearInterval(gracePeriodTimerRef.current);
      }
      if (tabletTimerRef.current) {
        clearInterval(tabletTimerRef.current);
      }
    };
  }, [codeId, mediaId, userPhase, hasVoted, selectedCandidates.length, gracePeriodActive]);

  // Determine round based on phase
  const round = config.currentPhase === 'finals' ? 2 : 1;

  // Load vote change count from localStorage
  useEffect(() => {
    const storageKey = `qvote-changes-${shortId}-${round}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      setVoteChangeCount(parseInt(stored, 10) || 0);
    }
  }, [shortId, round]);

  // Load verification session from localStorage and check if still valid
  useEffect(() => {
    if (!config.verification?.enabled) return;

    const storageKey = `qvote-verification-${codeId}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const session = JSON.parse(stored);
        // Check if session is not expired (basic check - server will validate)
        if (session.sessionToken && session.phone) {
          // Verify session is still valid via API
          fetch(`/api/verification/status?codeId=${codeId}&phone=${encodeURIComponent(session.phone)}&sessionToken=${session.sessionToken}`)
            .then(res => res.json())
            .then(data => {
              if (data.sessionValid && data.votesRemaining > 0) {
                setVerificationSession({
                  phone: session.phone,
                  sessionToken: session.sessionToken,
                  votesRemaining: data.votesRemaining,
                  maxVotes: data.maxVotes,
                });
              } else {
                // Session expired or no votes remaining - clear storage
                localStorage.removeItem(storageKey);
              }
            })
            .catch(() => {
              // API error - clear session
              localStorage.removeItem(storageKey);
            });
        }
      } catch {
        localStorage.removeItem(storageKey);
      }
    }
  }, [codeId, config.verification?.enabled]);

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

        // Check if user has already voted in this round - group by category
        // Skip this check in tablet mode - allow multiple votes from same device
        if (visitorId && (config.currentPhase === 'voting' || config.currentPhase === 'finals') && !config.tabletMode?.enabled) {
          const existingVotes = await getVoterVotes(codeId, visitorId, round);
          if (existingVotes.length > 0) {
            // Group votes by category
            const votesByCategory: Record<string, string[]> = {};
            for (const vote of existingVotes) {
              const categoryKey = vote.categoryId || '_global';
              if (!votesByCategory[categoryKey]) {
                votesByCategory[categoryKey] = [];
              }
              votesByCategory[categoryKey].push(vote.candidateId);
            }

            // Mark categories as voted
            const votedCats: Record<string, boolean> = {};
            for (const categoryKey of Object.keys(votesByCategory)) {
              votedCats[categoryKey] = true;
            }
            setVotedCategories(votedCats);

            // Set selected candidates for current category (if already selected)
            const currentKey = selectedCategory || '_global';
            if (votesByCategory[currentKey]) {
              setSelectedCandidates(votesByCategory[currentKey]);
            }
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
  }, [codeId, config.currentPhase, visitorId, round, selectedCategory]);

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

  // Handle verification success callback
  const handleVerificationSuccess = (data: { phone: string; sessionToken: string; votesRemaining: number; maxVotes: number }) => {
    // Store session in state
    setVerificationSession({
      phone: data.phone,
      sessionToken: data.sessionToken,
      votesRemaining: data.votesRemaining,
      maxVotes: data.maxVotes,
    });

    // Store in localStorage
    const storageKey = `qvote-verification-${codeId}`;
    localStorage.setItem(storageKey, JSON.stringify({
      phone: data.phone,
      sessionToken: data.sessionToken,
    }));

    setShowVerificationModal(false);

    // If there was a pending vote, submit it now
    if (pendingVoteAfterVerification) {
      setPendingVoteAfterVerification(false);
      // Small delay to allow state to update
      setTimeout(() => submitVoteWithCredentials(data.phone, data.sessionToken), 100);
    }
  };

  // Submit vote with credentials (internal function)
  const submitVoteWithCredentials = async (phone?: string, sessionToken?: string) => {
    if (!visitorId || selectedCandidates.length === 0 || submitting) return;

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        codeId,
        voterId: visitorId,
        candidateIds: selectedCandidates,
        round,
        categoryId: selectedCategory || undefined,
      };

      // Add verification credentials if verification is enabled
      if (config.verification?.enabled) {
        const usePhone = phone || verificationSession?.phone;
        const useToken = sessionToken || verificationSession?.sessionToken;
        if (usePhone && useToken) {
          body.phone = usePhone;
          body.sessionToken = useToken;
        }
      }

      const response = await fetch('/api/qvote/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      // Handle verification errors
      if (!response.ok && result.errorCode) {
        if (result.errorCode === 'VERIFICATION_REQUIRED' || result.errorCode === 'NOT_VERIFIED' ||
            result.errorCode === 'INVALID_SESSION' || result.errorCode === 'SESSION_EXPIRED') {
          // Clear stored session and show verification modal
          const storageKey = `qvote-verification-${codeId}`;
          localStorage.removeItem(storageKey);
          setVerificationSession(null);
          setPendingVoteAfterVerification(true);
          setShowVerificationModal(true);
          setSubmitting(false);
          return;
        }
        if (result.errorCode === 'VOTE_LIMIT_REACHED') {
          // User has no more votes
          setVerificationSession(prev => prev ? { ...prev, votesRemaining: 0 } : null);
          setSubmitting(false);
          return;
        }
        if (result.errorCode === 'ALREADY_VOTED_CATEGORY') {
          // User already voted in this category - go back to categories
          const categoryKey = selectedCategory || '_global';
          setVotedCategories(prev => ({ ...prev, [categoryKey]: true }));
          if (config.categories.length > 0) {
            setSelectedCategory(null);
            setShowCategorySelect(true);
            setShowVoteSuccessMessage(true);
            setTimeout(() => setShowVoteSuccessMessage(false), 4000);
          }
          setSelectedCandidates([]);
          setSubmitting(false);
          return;
        }
      }

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit vote');
      }

      if (result.success) {
        // Mark this category as voted
        const categoryKey = selectedCategory || '_global';
        setVotedCategories(prev => ({ ...prev, [categoryKey]: true }));

        // Update remaining votes
        if (verificationSession) {
          setVerificationSession(prev => prev ? {
            ...prev,
            votesRemaining: Math.max(0, prev.votesRemaining - 1),
          } : null);
        }

        // If grace period is active, end it and transition to new phase
        if (gracePeriodActive) {
          if (gracePeriodTimerRef.current) {
            clearInterval(gracePeriodTimerRef.current);
          }
          setGracePeriodActive(false);
          setGracePeriodSeconds(0);
          setUserPhase(config.currentPhase);
        }

        // If there are categories, go back to categories page with success message
        if (config.categories.length > 0 && selectedCategory) {
          // Small delay to let the vote register visually
          setTimeout(() => {
            setSelectedCategory(null);
            setShowCategorySelect(true);
            setSelectedCandidates([]);
            setShowVoteSuccessMessage(true);
            // Auto-hide the success message after 4 seconds
            setTimeout(() => setShowVoteSuccessMessage(false), 4000);
          }, 500);
        } else if (config.tabletMode?.enabled) {
          // Start tablet mode countdown if enabled (only for non-category voting)
          const delay = config.tabletMode.resetDelaySeconds || 5;
          setTabletResetCountdown(delay);
        }
      }
    } catch (error) {
      console.error('Error submitting vote:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit vote via API
  const handleSubmitVote = async () => {
    if (!visitorId || selectedCandidates.length === 0 || submitting) return;

    // Check if verification is required
    if (config.verification?.enabled && !verificationSession) {
      setPendingVoteAfterVerification(true);
      setShowVerificationModal(true);
      return;
    }

    // Check if user has remaining votes (only for non-category voting)
    // When categories are used, each category allows one vote regardless of global limit
    if (config.verification?.enabled && verificationSession && verificationSession.votesRemaining <= 0 && config.categories.length === 0) {
      // No votes remaining - don't allow voting (only when no categories)
      return;
    }

    await submitVoteWithCredentials();
  };

  // Reset vote (for vote change feature)
  const handleResetVote = async () => {
    if (!visitorId) return;

    try {
      const response = await fetch('/api/qvote/reset-voter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shortId,
          voterId: visitorId,
          round,
          categoryId: selectedCategory || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to reset vote:', errorData.error);
        return;
      }

      const data = await response.json();
      console.log('[QVoteViewer] Vote reset successful:', data);

      // Update local state
      const categoryKey = selectedCategory || '_global';
      setVotedCategories((prev) => ({ ...prev, [categoryKey]: false }));
      setSelectedCandidates([]);

      // Increment vote change count and store in localStorage
      const newCount = voteChangeCount + 1;
      setVoteChangeCount(newCount);
      const storageKey = `qvote-changes-${shortId}-${round}`;
      localStorage.setItem(storageKey, String(newCount));
    } catch (error) {
      console.error('Error resetting vote:', error);
    }
  };

  // Reset for next voter in tablet mode
  const resetForNextVoter = useCallback(() => {
    // Reset voting state
    setVotedCategories({});
    setSelectedCandidates([]);
    setTabletResetCountdown(null);

    // Clear the timer
    if (tabletTimerRef.current) {
      clearInterval(tabletTimerRef.current);
      tabletTimerRef.current = null;
    }

    // Clear verification session if enabled
    if (config.verification?.enabled) {
      setVerificationSession(null);
      const storageKey = `qvote-verification-${codeId}`;
      localStorage.removeItem(storageKey);
    }

    // Return to landing page for next voter
    setShowLanding(true);

    // Reset category selection if categories exist
    if (config.categories.length > 0) {
      setSelectedCategory(null);
      setShowCategorySelect(true);
    }
  }, [config.verification?.enabled, codeId, config.categories.length]);

  // Tablet mode countdown timer - separate useEffect to avoid being cleared by other effects
  // Use a ref to track whether we should start the countdown
  const countdownStartedRef = useRef(false);
  const resetForNextVoterRef = useRef(resetForNextVoter);
  resetForNextVoterRef.current = resetForNextVoter;

  useEffect(() => {
    // Start countdown when tabletResetCountdown becomes a positive number
    if (tabletResetCountdown !== null && tabletResetCountdown > 0 && !countdownStartedRef.current) {
      countdownStartedRef.current = true;

      const timerId = setInterval(() => {
        setTabletResetCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(timerId);
            countdownStartedRef.current = false;
            // Use setTimeout to call reset after state update
            setTimeout(() => resetForNextVoterRef.current(), 0);
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      tabletTimerRef.current = timerId;

      return () => {
        clearInterval(timerId);
        countdownStartedRef.current = false;
      };
    }

    // Reset the flag when countdown becomes null
    if (tabletResetCountdown === null) {
      countdownStartedRef.current = false;
    }
  }, [tabletResetCountdown]);

  // Handle photo selection for registration
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files).slice(0, 2 - photoFiles.length); // Max 2 photos for boomerang
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
        // Compress image before upload (target 300KB, max 1200px for mobile)
        const compressed = await compressImage(file, { maxSizeKB: 300, maxWidth: 1200, maxHeight: 1200 });
        const compressedFile = createCompressedFile(compressed, file.name);
        console.log(`Compressed ${file.name}: ${formatBytes(compressed.originalSize)} → ${formatBytes(compressed.compressedSize)}`);

        const formDataUpload = new FormData();
        formDataUpload.append('file', compressedFile);
        formDataUpload.append('codeId', codeId);
        if (ownerId) {
          formDataUpload.append('ownerId', ownerId);
        }

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
        categoryIds: selectedCategory ? [selectedCategory] : [],
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
    accent: config.branding.colors.accent || config.branding.colors.buttonBackground,
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

  // Determine if we should show landing page (moved up for correct flow)
  const hasLandingContent = config.branding.landingImage || config.branding.landingTitle || config.branding.landingTitleEn || config.branding.landingSubtitle || config.branding.landingSubtitleEn;

  // Get button text based on current phase and locale
  const getButtonText = () => {
    const phase = config.currentPhase;
    if (phase !== 'results') {
      // Use English texts if locale is 'en' and English texts exist
      if (locale === 'en' && config.branding.buttonTextsEn) {
        const text = config.branding.buttonTextsEn[phase];
        if (text) return text;
      }
      // Fall back to Hebrew texts
      if (config.branding.buttonTexts) {
        const text = config.branding.buttonTexts[phase];
        if (text) return text;
      }
    }
    return config.branding.buttonText || t.enterButton;
  };

  // Get localized text based on locale
  const getLocalizedTitle = () => {
    if (locale === 'en' && config.branding.landingTitleEn) {
      return config.branding.landingTitleEn;
    }
    return config.branding.landingTitle;
  };

  const getLocalizedSubtitle = () => {
    if (locale === 'en' && config.branding.landingSubtitleEn) {
      return config.branding.landingSubtitleEn;
    }
    return config.branding.landingSubtitle;
  };

  const getLocalizedVotingTitle = () => {
    if (locale === 'en' && config.branding.votingTitleEn) {
      return config.branding.votingTitleEn;
    }
    return config.branding.votingTitle;
  };

  // Render landing page FIRST (before category selection)
  if (showLanding && hasLandingContent) {
    const overlayOpacity = config.branding.imageOverlayOpacity ?? 40;

    return (
      <div
        className="min-h-screen flex flex-col relative overflow-hidden"
        style={{ backgroundColor: brandingStyles.background }}
        dir={locale === 'he' ? 'rtl' : 'ltr'}
      >
        {/* Background Image with zoom-out animation */}
        {config.branding.landingImage && (
          <div className="absolute inset-0 overflow-hidden">
            <img
              src={config.branding.landingImage}
              alt=""
              className="w-full h-full object-cover animate-landing-zoom"
              style={{
                animation: 'landingZoom 8s ease-out forwards',
                objectPosition: config.branding.landingImagePosition?.mode === 'custom'
                  ? `${50 + (config.branding.landingImagePosition.x || 0)}% ${50 + (config.branding.landingImagePosition.y || 0)}%`
                  : 'center center',
                transform: config.branding.landingImagePosition?.mode === 'custom' && config.branding.landingImagePosition.zoom
                  ? `scale(${config.branding.landingImagePosition.zoom})`
                  : undefined,
              }}
            />
            {/* Overlay */}
            <div
              className="absolute inset-0"
              style={{ backgroundColor: `rgba(0, 0, 0, ${overlayOpacity / 100})` }}
            />
            {/* CSS Animation */}
            <style>{`
              @keyframes landingZoom {
                0% {
                  transform: scale(1.15);
                }
                100% {
                  transform: scale(1);
                }
              }
            `}</style>
          </div>
        )}

        {/* Content */}
        <div className="relative flex-1 flex flex-col items-center justify-center p-6 text-center">
          {/* Title & Subtitle */}
          {(getLocalizedTitle() || getLocalizedSubtitle()) && (
            <div className="mb-8">
              {getLocalizedTitle() && (
                <h1
                  className="text-3xl font-bold mb-3"
                  style={{ color: config.branding.landingImage ? '#ffffff' : brandingStyles.text }}
                >
                  {getLocalizedTitle()}
                </h1>
              )}
              {getLocalizedSubtitle() && (
                <p
                  className="text-lg"
                  style={{ color: config.branding.landingImage ? 'rgba(255,255,255,0.85)' : `${brandingStyles.text}99` }}
                >
                  {getLocalizedSubtitle()}
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

          {/* Language Selection Buttons - inside content for better positioning */}
          {showLanguageSelect && (
            <div className="flex justify-center gap-3 mt-8 relative z-20" dir="ltr">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setLocale('he');
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  locale === 'he'
                    ? 'bg-white/30 backdrop-blur-sm text-white border-2 border-white'
                    : 'bg-white/10 backdrop-blur-sm text-white/80 border border-white/30 hover:bg-white/20'
                }`}
              >
                עברית
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setLocale('en');
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  locale === 'en'
                    ? 'bg-white/30 backdrop-blur-sm text-white border-2 border-white'
                    : 'bg-white/10 backdrop-blur-sm text-white/80 border border-white/30 hover:bg-white/20'
                }`}
              >
                English
              </button>
            </div>
          )}
        </div>

        {/* Tap anywhere to enter (optional - makes whole screen tappable) */}
        <button
          onClick={() => setShowLanding(false)}
          className="absolute inset-0 -z-10"
          aria-label="Enter"
        />
      </div>
    );
  }

  // Render category selection AFTER landing page
  if (showCategorySelect && config.categories.length > 0) {
    return (
      <div
        className="min-h-screen relative overflow-hidden"
        style={{ backgroundColor: brandingStyles.background }}
        dir={locale === 'he' ? 'rtl' : 'ltr'}
      >
        {/* Full screen background image */}
        {config.branding.landingImage && (
          <div className="absolute inset-0">
            <img
              src={config.branding.landingImage}
              alt=""
              className="w-full h-full object-cover"
              style={{
                objectPosition: config.branding.landingImagePosition?.mode === 'custom'
                  ? `${50 + (config.branding.landingImagePosition.x || 0)}% ${50 + (config.branding.landingImagePosition.y || 0)}%`
                  : 'center center',
                transform: config.branding.landingImagePosition?.mode === 'custom' && config.branding.landingImagePosition.zoom
                  ? `scale(${config.branding.landingImagePosition.zoom})`
                  : undefined,
              }}
            />
            {/* Dark overlay for readability */}
            <div className="absolute inset-0 bg-black/40" />
          </div>
        )}

        {/* Centered glassmorphism overlay */}
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div
            className="w-full max-w-md rounded-3xl p-6 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            }}
          >
            {/* Success Message Banner */}
            {showVoteSuccessMessage && (
              <div
                className="p-4 rounded-2xl text-center animate-in fade-in slide-in-from-top-4 duration-300"
                style={{
                  backgroundColor: 'rgba(34, 197, 94, 0.3)',
                  border: '1px solid rgba(34, 197, 94, 0.5)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <div className="flex items-center justify-center gap-2 text-white">
                  <svg className="w-6 h-6 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-semibold">
                    {locale === 'he' ? 'תודה! ההצבעה נקלטה בהצלחה' : 'Thank you! Your vote was submitted'}
                  </span>
                </div>
              </div>
            )}

            {/* Title */}
            <h2 className="text-2xl font-bold text-center text-white drop-shadow-lg">
              {t.selectCategory}
            </h2>

            {/* Category buttons */}
            <div className="space-y-3 max-h-[60vh] overflow-y-auto overscroll-contain px-1 py-1">
              {config.categories.filter(c => c.isActive).map((category) => {
                const hasVotedInCategory = votedCategories[category.id] || false;
                return (
                  <button
                    key={category.id}
                    onClick={() => {
                      setSelectedCategory(category.id);
                      setShowCategorySelect(false);
                      setSelectedCandidates([]); // Clear selections when switching categories
                    }}
                    className="w-full p-4 rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 relative"
                    style={{
                      backgroundColor: hasVotedInCategory ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.2)',
                      border: hasVotedInCategory ? '2px solid rgba(59, 130, 246, 0.8)' : '1px solid rgba(255, 255, 255, 0.3)',
                      boxShadow: hasVotedInCategory ? '0 4px 15px rgba(59, 130, 246, 0.3)' : '0 4px 15px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    {/* Voted checkmark */}
                    {hasVotedInCategory && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    {config.branding.categoryImages?.[category.id] && (
                      <img
                        src={config.branding.categoryImages[category.id]}
                        alt=""
                        className="w-full h-28 object-cover rounded-xl mb-3"
                        style={{
                          objectPosition: config.branding.categoryImagePositions?.[category.id]?.mode === 'custom'
                            ? `${50 + (config.branding.categoryImagePositions[category.id].x || 0)}% ${50 + (config.branding.categoryImagePositions[category.id].y || 0)}%`
                            : 'center center',
                        }}
                      />
                    )}
                    <span className="text-lg font-semibold text-white drop-shadow-md block">
                      {locale === 'en' && category.nameEn ? category.nameEn : category.name}
                    </span>
                    {hasVotedInCategory && (
                      <span className="text-sm text-blue-200 mt-1 block">
                        {locale === 'he' ? '✓ ההצבעה בוצעה!' : '✓ Vote submitted!'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Language Selection Buttons */}
            {showLanguageSelect && (
              <div className="flex justify-center gap-3 pt-2" dir="ltr">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setLocale('he');
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    locale === 'he'
                      ? 'bg-white/30 backdrop-blur-sm text-white border-2 border-white'
                      : 'bg-white/10 backdrop-blur-sm text-white/80 border border-white/30 hover:bg-white/20'
                  }`}
                >
                  עברית
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setLocale('en');
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    locale === 'en'
                      ? 'bg-white/30 backdrop-blur-sm text-white border-2 border-white'
                      : 'bg-white/10 backdrop-blur-sm text-white/80 border border-white/30 hover:bg-white/20'
                  }`}
                >
                  English
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render based on phase (use userPhase for grace period support)
  const renderPhaseContent = () => {
    // Use userPhase to allow grace period - user sees their current phase until grace period ends
    const displayPhase = userPhase;

    // Check for operator mode via URL parameter
    const isOperator = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('operator') === 'true';

    // Operator mode always shows results, regardless of current phase
    if (isOperator) {
      return renderResults();
    }

    switch (displayPhase) {
      case 'registration':
        return renderRegistration();
      case 'preparation':
        return renderPreparation();
      case 'voting':
      case 'finals':
        return renderVoting();
      case 'calculating':
        return renderCalculating();
      case 'results':
        // If hideResultsFromParticipants is enabled, show calculating phase
        if (config.hideResultsFromParticipants) {
          return renderCalculating();
        }
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

    // If self-registration is disabled, show welcome message with booth instructions
    if (!config.allowSelfRegistration) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
            style={{ backgroundColor: `${brandingStyles.accent}20` }}
          >
            <UserPlus className="w-10 h-10" style={{ color: brandingStyles.accent }} />
          </div>
          <h2
            className="text-2xl font-bold mb-2"
            style={{ color: brandingStyles.text }}
          >
            {locale === 'he' ? 'ברוכים הבאים!' : 'Welcome!'}
          </h2>
          <p style={{ color: `${brandingStyles.text}99` }}>
            {locale === 'he'
              ? 'מוזמנים להירשם לתחרות בדוכן ההרשמה'
              : 'You can register for the competition at the registration booth'}
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

          {/* Add Photo Button - max 2 photos (1 static or 2 for boomerang) */}
          {photoFiles.length < 2 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-1 transition-colors"
              style={{
                borderColor: `${brandingStyles.text}30`,
                color: brandingStyles.text,
              }}
            >
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5" />
                <span>{t.addPhoto}</span>
              </div>
              {photoFiles.length === 0 && (
                <span className="text-xs opacity-60">
                  {locale === 'he' ? '1 תמונה או 2 לבומרנג' : '1 photo or 2 for boomerang'}
                </span>
              )}
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

  // Calculating Phase - Similar to preparation but different message
  const renderCalculating = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
      {/* Animated loading spinner */}
      <div className="relative w-20 h-20 mb-6">
        <div
          className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor: `${brandingStyles.text}30`, borderTopColor: brandingStyles.buttonBg }}
        />
        <div
          className="absolute inset-2 rounded-full border-4 border-b-transparent animate-spin"
          style={{
            borderColor: `${brandingStyles.text}20`,
            borderBottomColor: brandingStyles.buttonBg,
            animationDirection: 'reverse',
            animationDuration: '1.5s',
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Trophy className="w-8 h-8" style={{ color: brandingStyles.buttonBg }} />
        </div>
      </div>

      <h2
        className="text-2xl font-bold mb-2"
        style={{ color: brandingStyles.text }}
      >
        {config.messages.calculatingMessage || t.calculatingTitle}
      </h2>
      <p style={{ color: `${brandingStyles.text}99` }}>
        {t.calculatingDesc}
      </p>

      {/* Animated dots */}
      <div className="flex gap-1 mt-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full animate-bounce"
            style={{
              backgroundColor: brandingStyles.buttonBg,
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
    </div>
  );

  // Voting Phase - Using the new redesigned voting view
  const renderVoting = () => {
    const handleBackToCategories = () => {
      setSelectedCategory(null);
      setShowCategorySelect(true);
      setSelectedCandidates([]); // Clear selections when switching categories
    };

    return (
      <QVoteVotingView
        candidates={candidates}
        config={config}
        selectedCandidates={selectedCandidates}
        onSelectCandidate={handleCandidateSelect}
        hasVoted={hasVoted}
        submitting={submitting}
        onSubmitVote={handleSubmitVote}
        selectedCategory={selectedCategory}
        onBackToCategories={handleBackToCategories}
        locale={locale}
        voteChangeCount={voteChangeCount}
        onResetVote={handleResetVote}
        tabletResetCountdown={tabletResetCountdown}
        tabletResetDelay={config.tabletMode?.resetDelaySeconds || 5}
        translations={{
          votingTitle: getLocalizedVotingTitle() || t.votingTitle,
          finalsTitle: t.finalsTitle,
          selectUpTo: t.selectUpTo,
          submitVote: t.submitVote,
          voteSubmitted: t.voteSubmitted,
          thankYou: t.thankYou,
          yourSelections: t.yourSelections,
          noCandidates: t.noCandidates,
          votes: t.votes,
        }}
      />
    );
  };

  // Results Phase
  const renderResults = () => {
    // Get category name if a category is selected
    const categoryName = selectedCategory && config.categories.length > 0
      ? (() => {
          const category = config.categories.find(c => c.id === selectedCategory);
          return locale === 'en' && category?.nameEn ? category.nameEn : category?.name;
        })()
      : undefined;

    return (
      <QVoteResultsView
        candidates={candidates}
        showNames={config.showNames}
        showVoteCount={config.showVoteCount}
        isFinalsPhase={config.currentPhase === 'finals'}
        accentColor={brandingStyles.accent}
        textColor={brandingStyles.text}
        backgroundColor={brandingStyles.background}
        isRTL={locale === 'he'}
        logoUrl={config.branding.logoUrl}
        flipbookSettings={config.flipbookSettings}
        categoryName={categoryName}
        translations={{
          resultsTitle: t.resultsTitle,
          votes: t.votes,
          winner: t.winner,
        }}
      />
    );
  };

  return (
    <div
      className="min-h-screen flex flex-col relative"
      style={{ backgroundColor: brandingStyles.background }}
      dir={locale === 'he' ? 'rtl' : 'ltr'}
    >
      {/* Phase Content */}
      {renderPhaseContent()}

      {/* Grace Period Countdown Timer - Animated bar from green to red */}
      {gracePeriodActive && (
        <div className="fixed top-0 left-0 right-0 z-50">
          {/* Progress bar background */}
          <div className="h-2 bg-gray-200/30 backdrop-blur-sm">
            {/* Animated progress bar - shrinks from 100% to 0% over 10 seconds */}
            <div
              className="h-full transition-all duration-1000 ease-linear"
              style={{
                width: `${(gracePeriodSeconds / 10) * 100}%`,
                backgroundColor: gracePeriodSeconds > 6
                  ? '#22c55e' // Green
                  : gracePeriodSeconds > 3
                  ? '#f59e0b' // Amber
                  : '#ef4444', // Red
              }}
            />
          </div>

          {/* Timer message */}
          <div
            className="flex items-center justify-center gap-3 py-3 px-4"
            style={{
              backgroundColor: gracePeriodSeconds > 6
                ? 'rgba(34, 197, 94, 0.95)'
                : gracePeriodSeconds > 3
                ? 'rgba(245, 158, 11, 0.95)'
                : 'rgba(239, 68, 68, 0.95)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <Clock className="w-5 h-5 text-white animate-pulse" />
            <span className="text-white font-bold text-lg">
              {gracePeriodSeconds}
            </span>
            <span className="text-white/90 font-medium">
              {t.secondsLeft} - {t.gracePeriod}!
            </span>
          </div>
        </div>
      )}

      {/* Phone Verification Modal */}
      {showVerificationModal && config.verification?.enabled && (
        <PhoneVerificationModal
          isOpen={showVerificationModal}
          onClose={() => {
            setShowVerificationModal(false);
            setPendingVoteAfterVerification(false);
          }}
          codeId={codeId}
          locale={locale}
          onVerified={handleVerificationSuccess}
        />
      )}

      {/* Verification Status Indicator - shown when verified but has remaining votes */}
      {config.verification?.enabled && verificationSession && verificationSession.votesRemaining > 0 && (userPhase === 'voting' || userPhase === 'finals') && (
        <div className="fixed bottom-4 left-4 right-4 z-40">
          <div
            className="flex items-center justify-center gap-2 py-2 px-4 rounded-full mx-auto max-w-xs"
            style={{
              backgroundColor: 'rgba(34, 197, 94, 0.9)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <Shield className="w-4 h-4 text-white" />
            <span className="text-white text-sm font-medium">
              {locale === 'he'
                ? `${verificationSession.votesRemaining} הצבעות נותרו`
                : `${verificationSession.votesRemaining} votes remaining`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
