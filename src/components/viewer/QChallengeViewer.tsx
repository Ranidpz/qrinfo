'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocale } from 'next-intl';
import { Check, X, Trophy, Users, Clock, Zap, ChevronRight, Loader2 } from 'lucide-react';
import {
  QChallengeConfig,
  QChallengePlayer,
  QChallengeQuestion,
  QChallengeLeaderboardEntry,
  getQChallengeTranslation,
  formatQuizDuration,
} from '@/types/qchallenge';
import { getOrCreateVisitorId } from '@/lib/xp';
import { subscribeToQChallengeLeaderboard } from '@/lib/qchallenge-realtime';
import QChallengeTimer from './qchallenge/QChallengeTimer';

interface QChallengeViewerProps {
  codeId: string;
  mediaId: string;
  initialConfig: QChallengeConfig;
  shortId: string;
}

type ViewPhase = 'landing' | 'playing' | 'feedback' | 'result' | 'leaderboard';

export default function QChallengeViewer({
  codeId,
  mediaId,
  initialConfig,
  shortId,
}: QChallengeViewerProps) {
  const locale = useLocale() as 'he' | 'en';
  const isRTL = locale === 'he';

  // State
  const [config] = useState(initialConfig);
  const [phase, setPhase] = useState<ViewPhase>('landing');
  const [player, setPlayer] = useState<QChallengePlayer | null>(null);
  const [questions, setQuestions] = useState<QChallengeQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);

  // Feedback state
  const [feedbackData, setFeedbackData] = useState<{
    isCorrect: boolean;
    correctAnswerId: string;
    totalPoints: number;
    timeBonus: number;
    streakMultiplier: number;
    newStreak: number;
  } | null>(null);

  // Result state
  const [finalResult, setFinalResult] = useState<{
    score: number;
    correctAnswers: number;
    totalQuestions: number;
    maxStreak: number;
    totalTimeMs: number;
    rank?: number;
  } | null>(null);

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<QChallengeLeaderboardEntry[]>([]);

  // Registration state
  const [nickname, setNickname] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState(config.emojiPalette[0]);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  // Refs
  const visitorIdRef = useRef<string | null>(null);

  // Get visitor ID on mount
  useEffect(() => {
    visitorIdRef.current = getOrCreateVisitorId();
  }, []);

  // Subscribe to leaderboard
  useEffect(() => {
    const unsubscribe = subscribeToQChallengeLeaderboard(codeId, (entries) => {
      setLeaderboard(entries);
    });

    return () => unsubscribe();
  }, [codeId]);

  // Get translation helper
  const t = (key: keyof typeof import('@/types/qchallenge').QCHALLENGE_TRANSLATIONS.he) => {
    return getQChallengeTranslation(key, config.language, locale);
  };

  // Handle registration
  const handleRegister = async () => {
    if (!nickname.trim() || nickname.length < 2) {
      setRegistrationError(isRTL ? 'נא להזין שם (לפחות 2 תווים)' : 'Please enter a name (at least 2 characters)');
      return;
    }

    setIsRegistering(true);
    setRegistrationError(null);

    try {
      const response = await fetch('/api/qchallenge/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeId,
          playerId: visitorIdRef.current,
          nickname: nickname.trim(),
          avatarType: 'emoji',
          avatarValue: selectedEmoji,
          consent: true,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        if (data.errorCode === 'ALREADY_PLAYED') {
          setRegistrationError(isRTL ? 'כבר השתתפת בחידון הזה' : 'You have already played this quiz');
        } else {
          setRegistrationError(data.error || 'Registration failed');
        }
        return;
      }

      setPlayer(data.player);
      setQuestions(data.questions);
      setPhase('playing');
      setCurrentQuestionIndex(0);
      setQuestionStartTime(Date.now());
    } catch (error) {
      console.error('Registration error:', error);
      setRegistrationError(isRTL ? 'שגיאה בהרשמה' : 'Registration error');
    } finally {
      setIsRegistering(false);
    }
  };

  // Handle answer selection
  const handleSelectAnswer = (answerId: string) => {
    if (isSubmitting || selectedAnswerId) return;
    setSelectedAnswerId(answerId);
  };

  // Handle answer submission
  const handleSubmitAnswer = async () => {
    if (!selectedAnswerId || isSubmitting) return;

    setIsSubmitting(true);
    const responseTimeMs = Date.now() - questionStartTime;
    const currentQuestion = questions[currentQuestionIndex];

    try {
      const response = await fetch('/api/qchallenge/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeId,
          playerId: visitorIdRef.current,
          questionId: currentQuestion.id,
          questionIndex: currentQuestionIndex,
          answerId: selectedAnswerId,
          responseTimeMs,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setFeedbackData({
          isCorrect: data.isCorrect,
          correctAnswerId: data.correctAnswerId,
          totalPoints: data.totalPoints,
          timeBonus: data.timeBonus,
          streakMultiplier: data.streakMultiplier,
          newStreak: data.newStreak,
        });

        if (data.isGameComplete) {
          setFinalResult({
            score: data.newTotalScore,
            correctAnswers: player ? player.correctAnswers + (data.isCorrect ? 1 : 0) : 0,
            totalQuestions: questions.length,
            maxStreak: Math.max(player?.maxStreak || 0, data.newStreak),
            totalTimeMs: (player?.totalTimeMs || 0) + responseTimeMs,
            rank: data.rank,
          });
        }

        setPhase('feedback');
      }
    } catch (error) {
      console.error('Answer submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle time up
  const handleTimeUp = useCallback(() => {
    if (selectedAnswerId) {
      handleSubmitAnswer();
    } else {
      // Auto-submit with no answer (wrong)
      setSelectedAnswerId('__timeout__');
      handleSubmitAnswer();
    }
  }, [selectedAnswerId]);

  // Handle continue after feedback
  const handleContinue = () => {
    if (finalResult) {
      setPhase('result');
    } else {
      // Next question
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswerId(null);
      setFeedbackData(null);
      setQuestionStartTime(Date.now());
      setPhase('playing');
    }
  };

  // Branding styles
  const brandingStyles = {
    backgroundColor: config.branding.backgroundColor,
    primaryColor: config.branding.primaryColor,
    successColor: config.branding.successColor,
    errorColor: config.branding.errorColor,
  };

  // Current question
  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: brandingStyles.backgroundColor }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Landing Phase */}
      {phase === 'landing' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          {/* Logo */}
          {config.branding.eventLogo && (
            <img
              src={config.branding.eventLogo}
              alt="Logo"
              className="w-32 h-32 object-contain mb-6"
            />
          )}

          {/* Title */}
          <h1 className="text-3xl font-bold text-white text-center mb-2">
            {config.branding.quizTitle || t('quizTitle')}
          </h1>

          {config.branding.quizDescription && (
            <p className="text-white/60 text-center mb-8 max-w-md">
              {config.branding.quizDescription}
            </p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-6 mb-8 text-white/50 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{config.questions.length} {isRTL ? 'שאלות' : 'questions'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>{leaderboard.length} {isRTL ? 'שחקנים' : 'players'}</span>
            </div>
          </div>

          {/* Registration Form */}
          <div className="w-full max-w-sm space-y-4">
            {/* Nickname input */}
            <div>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder={t('enterName')}
                maxLength={20}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/40 text-center text-lg"
              />
            </div>

            {/* Emoji selector */}
            <div>
              <p className="text-white/60 text-sm text-center mb-2">{t('chooseAvatar')}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {config.emojiPalette.slice(0, 12).map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => setSelectedEmoji(emoji)}
                    className={`w-12 h-12 text-2xl rounded-xl transition-all ${
                      selectedEmoji === emoji
                        ? 'bg-white/20 scale-110 ring-2 ring-white/50'
                        : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Error message */}
            {registrationError && (
              <p className="text-red-400 text-sm text-center">{registrationError}</p>
            )}

            {/* Start button */}
            <button
              onClick={handleRegister}
              disabled={isRegistering || !nickname.trim()}
              className="w-full py-4 rounded-xl font-bold text-lg text-white transition-all disabled:opacity-50"
              style={{ backgroundColor: brandingStyles.primaryColor }}
            >
              {isRegistering ? (
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              ) : (
                t('startQuiz')
              )}
            </button>
          </div>
        </div>
      )}

      {/* Playing Phase */}
      {phase === 'playing' && currentQuestion && (
        <div className="flex-1 flex flex-col p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-white/60">
              <span className="text-lg font-medium">
                {currentQuestionIndex + 1}/{questions.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5" style={{ color: brandingStyles.primaryColor }} />
              <span className="text-white font-bold">{player?.currentScore || 0}</span>
            </div>
          </div>

          {/* Timer */}
          <div className="mb-8 relative pt-8">
            <QChallengeTimer
              totalSeconds={currentQuestion.timeLimitSeconds}
              onTimeUp={handleTimeUp}
              isPaused={isSubmitting}
              primaryColor={brandingStyles.primaryColor}
              warningColor="#f59e0b"
              dangerColor={brandingStyles.errorColor}
            />
          </div>

          {/* Question */}
          <div className="flex-1 flex flex-col">
            <h2 className="text-xl font-bold text-white text-center mb-8">
              {currentQuestion.text}
            </h2>

            {/* Answers */}
            <div className="space-y-3">
              {currentQuestion.answers.map((answer, index) => (
                <button
                  key={answer.id}
                  onClick={() => handleSelectAnswer(answer.id)}
                  disabled={isSubmitting}
                  className={`w-full p-4 rounded-xl text-start transition-all ${
                    selectedAnswerId === answer.id
                      ? 'ring-2 bg-white/20'
                      : 'bg-white/10 hover:bg-white/15'
                  }`}
                  style={{
                    borderColor: selectedAnswerId === answer.id ? brandingStyles.primaryColor : 'transparent',
                    ['--tw-ring-color' as string]: brandingStyles.primaryColor,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{
                        backgroundColor: selectedAnswerId === answer.id
                          ? brandingStyles.primaryColor
                          : 'rgba(255,255,255,0.1)',
                        color: 'white',
                      }}
                    >
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="text-white flex-1">{answer.text}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Submit button */}
            {selectedAnswerId && (
              <button
                onClick={handleSubmitAnswer}
                disabled={isSubmitting}
                className="mt-6 w-full py-4 rounded-xl font-bold text-lg text-white transition-all"
                style={{ backgroundColor: brandingStyles.primaryColor }}
              >
                {isSubmitting ? (
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    {isRTL ? 'אישור' : 'Confirm'}
                    <ChevronRight className="w-5 h-5" />
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Feedback Phase */}
      {phase === 'feedback' && feedbackData && (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          {/* Result icon */}
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 ${
              feedbackData.isCorrect ? 'animate-bounce' : 'animate-shake'
            }`}
            style={{
              backgroundColor: feedbackData.isCorrect
                ? brandingStyles.successColor
                : brandingStyles.errorColor,
            }}
          >
            {feedbackData.isCorrect ? (
              <Check className="w-12 h-12 text-white" />
            ) : (
              <X className="w-12 h-12 text-white" />
            )}
          </div>

          {/* Message */}
          <h2 className="text-2xl font-bold text-white mb-2">
            {feedbackData.isCorrect ? t('correct') : t('incorrect')}
          </h2>

          {/* Points */}
          {feedbackData.isCorrect && (
            <div className="text-center mb-4">
              <p className="text-4xl font-bold" style={{ color: brandingStyles.primaryColor }}>
                +{feedbackData.totalPoints}
              </p>
              {feedbackData.timeBonus > 0 && (
                <p className="text-white/60 text-sm">
                  {t('timeBonus')}: +{feedbackData.timeBonus}
                </p>
              )}
              {feedbackData.streakMultiplier > 1 && (
                <p className="text-amber-400 text-sm">
                  {t('streak')}: x{feedbackData.streakMultiplier.toFixed(1)}
                </p>
              )}
            </div>
          )}

          {/* Streak indicator */}
          {feedbackData.newStreak > 1 && (
            <div className="flex items-center gap-2 mb-6">
              <Zap className="w-5 h-5 text-amber-400" />
              <span className="text-amber-400 font-bold">
                {feedbackData.newStreak} {isRTL ? 'ברצף!' : 'in a row!'}
              </span>
            </div>
          )}

          {/* Continue button */}
          <button
            onClick={handleContinue}
            className="px-8 py-4 rounded-xl font-bold text-lg text-white transition-all"
            style={{ backgroundColor: brandingStyles.primaryColor }}
          >
            {finalResult ? (isRTL ? 'צפה בתוצאות' : 'View Results') : (isRTL ? 'השאלה הבאה' : 'Next Question')}
          </button>
        </div>
      )}

      {/* Result Phase */}
      {phase === 'result' && finalResult && (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <Trophy className="w-16 h-16 text-amber-400 mb-4" />

          <h2 className="text-2xl font-bold text-white mb-2">{t('quizComplete')}</h2>

          {/* Score */}
          <p
            className="text-6xl font-bold mb-6"
            style={{ color: brandingStyles.primaryColor }}
          >
            {finalResult.score}
          </p>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4 mb-8 w-full max-w-sm">
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-white/60 text-sm">{t('correctAnswers')}</p>
              <p className="text-2xl font-bold text-white">
                {finalResult.correctAnswers}/{finalResult.totalQuestions}
              </p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-white/60 text-sm">{t('accuracy')}</p>
              <p className="text-2xl font-bold text-white">
                {Math.round((finalResult.correctAnswers / finalResult.totalQuestions) * 100)}%
              </p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-white/60 text-sm">{t('bestStreak')}</p>
              <p className="text-2xl font-bold text-white">{finalResult.maxStreak}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-white/60 text-sm">{t('totalTime')}</p>
              <p className="text-2xl font-bold text-white">
                {formatQuizDuration(finalResult.totalTimeMs)}
              </p>
            </div>
          </div>

          {/* Rank */}
          {finalResult.rank && (
            <p className="text-white/60 mb-6">
              {t('yourRank')}: <span className="text-white font-bold">#{finalResult.rank}</span>
            </p>
          )}

          {/* View leaderboard button */}
          {config.showLeaderboard && (
            <button
              onClick={() => setPhase('leaderboard')}
              className="px-8 py-4 rounded-xl font-bold text-lg text-white transition-all"
              style={{ backgroundColor: brandingStyles.primaryColor }}
            >
              {t('viewLeaderboard')}
            </button>
          )}
        </div>
      )}

      {/* Leaderboard Phase */}
      {phase === 'leaderboard' && (
        <div className="flex-1 flex flex-col p-6">
          <div className="flex items-center gap-3 mb-6">
            <Trophy className="w-6 h-6 text-amber-400" />
            <h2 className="text-xl font-bold text-white">{t('leaderboard')}</h2>
          </div>

          {/* Leaderboard list */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {leaderboard.slice(0, config.maxLeaderboardEntries).map((entry, index) => {
              const isCurrentPlayer = entry.visitorId === visitorIdRef.current;
              const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;

              return (
                <div
                  key={entry.visitorId}
                  className={`flex items-center gap-3 p-3 rounded-xl ${
                    isCurrentPlayer ? 'bg-white/20 ring-2' : 'bg-white/10'
                  }`}
                  style={{ ['--tw-ring-color' as string]: isCurrentPlayer ? brandingStyles.primaryColor : 'transparent' }}
                >
                  <span className="w-8 text-center font-bold text-white/60">
                    {rankEmoji || `#${entry.rank}`}
                  </span>
                  <span className="text-2xl">{entry.avatarValue}</span>
                  <span className="flex-1 text-white font-medium truncate">
                    {entry.nickname}
                  </span>
                  <span className="font-bold" style={{ color: brandingStyles.primaryColor }}>
                    {entry.score}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Back to results */}
          <button
            onClick={() => setPhase('result')}
            className="mt-4 py-3 rounded-xl text-white/60 hover:text-white transition-colors"
          >
            {isRTL ? '← חזרה לתוצאות' : '← Back to Results'}
          </button>
        </div>
      )}
    </div>
  );
}
