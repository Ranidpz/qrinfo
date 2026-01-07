'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X, Loader2, Plus, Trash2, Palette, Settings, HelpCircle,
  Copy, Check, ImageIcon, Upload, Timer, Play, Square, RotateCcw,
  GripVertical, ChevronDown, ChevronUp, Zap, Clock, Flame, CheckCircle,
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import {
  QChallengeConfig,
  QChallengeQuestion,
  QChallengeAnswer,
  QChallengePhase,
  QChallengeScoringMode,
  DEFAULT_QCHALLENGE_CONFIG,
  SCORING_MODE_CONFIG,
  generateQuestionId,
  generateAnswerId,
  createEmptyQuestion,
} from '@/types/qchallenge';

interface QChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: QChallengeConfig, logoFile?: File) => Promise<void>;
  onPhaseChange?: (phase: QChallengePhase) => Promise<void>;
  onReset?: () => Promise<void>;
  loading?: boolean;
  initialConfig?: QChallengeConfig;
  shortId?: string;
  currentPhase?: QChallengePhase;
}

// Preset colors
const presetColors = {
  background: ['#0a0f1a', '#0d1321', '#1a1a2e', '#16213e', '#0f172a', '#1e293b'],
  primary: ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'],
  success: ['#22c55e', '#10b981', '#14b8a6', '#84cc16'],
  error: ['#ef4444', '#f43f5e', '#e11d48', '#dc2626'],
};

export default function QChallengeModal({
  isOpen,
  onClose,
  onSave,
  onPhaseChange,
  onReset,
  loading = false,
  initialConfig,
  shortId,
  currentPhase = 'registration',
}: QChallengeModalProps) {
  const t = useTranslations('modals');
  const locale = useLocale();
  const isRTL = locale === 'he';

  // Tab state
  const [activeTab, setActiveTab] = useState<'general' | 'questions' | 'scoring' | 'branding' | 'advanced'>('general');

  // Config state
  const [config, setConfig] = useState<QChallengeConfig>(initialConfig || DEFAULT_QCHALLENGE_CONFIG);

  // Expanded question state
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  // Logo file state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Copy state
  const [copiedLink, setCopiedLink] = useState(false);

  // Initialize from initialConfig
  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig);
      if (initialConfig.branding.eventLogo) {
        setLogoPreview(initialConfig.branding.eventLogo);
      }
    }
  }, [initialConfig]);

  // Update config helpers
  const updateConfig = <K extends keyof QChallengeConfig>(key: K, value: QChallengeConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const updateBranding = <K extends keyof QChallengeConfig['branding']>(
    key: K,
    value: QChallengeConfig['branding'][K]
  ) => {
    setConfig(prev => ({
      ...prev,
      branding: { ...prev.branding, [key]: value },
    }));
  };

  const updateScoring = <K extends keyof QChallengeConfig['scoring']>(
    key: K,
    value: QChallengeConfig['scoring'][K]
  ) => {
    setConfig(prev => ({
      ...prev,
      scoring: { ...prev.scoring, [key]: value },
    }));
  };

  // Question management
  const addQuestion = () => {
    const newQuestion = createEmptyQuestion(config.questions.length);
    updateConfig('questions', [...config.questions, newQuestion]);
    setExpandedQuestionId(newQuestion.id);
  };

  const updateQuestion = (id: string, updates: Partial<QChallengeQuestion>) => {
    updateConfig('questions', config.questions.map(q =>
      q.id === id ? { ...q, ...updates } : q
    ));
  };

  const removeQuestion = (id: string) => {
    updateConfig('questions', config.questions.filter(q => q.id !== id));
    if (expandedQuestionId === id) {
      setExpandedQuestionId(null);
    }
  };

  const moveQuestion = (id: string, direction: 'up' | 'down') => {
    const index = config.questions.findIndex(q => q.id === id);
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === config.questions.length - 1)
    ) {
      return;
    }

    const newQuestions = [...config.questions];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]];

    // Update order values
    newQuestions.forEach((q, i) => {
      q.order = i;
    });

    updateConfig('questions', newQuestions);
  };

  // Answer management
  const addAnswer = (questionId: string) => {
    const question = config.questions.find(q => q.id === questionId);
    if (!question || question.answers.length >= 6) return;

    const newAnswer: QChallengeAnswer = {
      id: generateAnswerId(),
      text: '',
      isCorrect: false,
      order: question.answers.length,
    };

    updateQuestion(questionId, {
      answers: [...question.answers, newAnswer],
    });
  };

  const updateAnswer = (questionId: string, answerId: string, updates: Partial<QChallengeAnswer>) => {
    const question = config.questions.find(q => q.id === questionId);
    if (!question) return;

    // If setting this answer as correct, unset others
    let newAnswers = question.answers.map(a =>
      a.id === answerId ? { ...a, ...updates } : a
    );

    if (updates.isCorrect) {
      newAnswers = newAnswers.map(a =>
        a.id === answerId ? a : { ...a, isCorrect: false }
      );
    }

    updateQuestion(questionId, { answers: newAnswers });
  };

  const removeAnswer = (questionId: string, answerId: string) => {
    const question = config.questions.find(q => q.id === questionId);
    if (!question || question.answers.length <= 2) return;

    updateQuestion(questionId, {
      answers: question.answers.filter(a => a.id !== answerId),
    });
  };

  // Handle logo upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  // Copy link
  const copyLink = async () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${baseUrl}/v/${shortId}`;
    await navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Handle save
  const handleSave = async () => {
    await onSave(config, logoFile || undefined);
  };

  // Phase control
  const handlePhaseChange = async (phase: QChallengePhase) => {
    if (onPhaseChange) {
      await onPhaseChange(phase);
    }
  };

  if (!isOpen) return null;

  // Scoring mode icons
  const scoringIcons: Record<QChallengeScoringMode, React.ReactNode> = {
    time_and_streak: <Zap className="w-5 h-5" />,
    time_only: <Clock className="w-5 h-5" />,
    streak_only: <Flame className="w-5 h-5" />,
    simple: <CheckCircle className="w-5 h-5" />,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl flex flex-col"
        style={{ backgroundColor: '#1a1a2e' }}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-blue-400" />
            Q.Challenge - {isRTL ? 'חידון טריוויה' : 'Trivia Quiz'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 overflow-x-auto">
          {[
            { id: 'general', label: isRTL ? 'כללי' : 'General', icon: Settings },
            { id: 'questions', label: isRTL ? 'שאלות' : 'Questions', icon: HelpCircle },
            { id: 'scoring', label: isRTL ? 'ניקוד' : 'Scoring', icon: Zap },
            { id: 'branding', label: isRTL ? 'מיתוג' : 'Branding', icon: Palette },
            { id: 'advanced', label: isRTL ? 'מתקדם' : 'Advanced', icon: Settings },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap
                ${activeTab === tab.id
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-white/60 hover:text-white'
                }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Quiz Title */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  {isRTL ? 'כותרת החידון' : 'Quiz Title'}
                </label>
                <input
                  type="text"
                  value={config.branding.quizTitle || ''}
                  onChange={(e) => updateBranding('quizTitle', e.target.value)}
                  placeholder={isRTL ? 'הכנס כותרת...' : 'Enter title...'}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  {isRTL ? 'תיאור' : 'Description'}
                </label>
                <textarea
                  value={config.branding.quizDescription || ''}
                  onChange={(e) => updateBranding('quizDescription', e.target.value)}
                  placeholder={isRTL ? 'הכנס תיאור...' : 'Enter description...'}
                  rows={3}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Default Timer */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  {isRTL ? 'זמן ברירת מחדל לשאלה (שניות)' : 'Default Time Per Question (seconds)'}
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={10}
                    max={120}
                    step={5}
                    value={config.defaultTimeLimitSeconds}
                    onChange={(e) => updateConfig('defaultTimeLimitSeconds', parseInt(e.target.value))}
                    className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-white font-medium w-16 text-center">
                    {config.defaultTimeLimitSeconds}s
                  </span>
                </div>
              </div>

              {/* Options */}
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.shuffleQuestions}
                    onChange={(e) => updateConfig('shuffleQuestions', e.target.checked)}
                    className="w-5 h-5 rounded border-white/20 bg-white/10 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-white/80">
                    {isRTL ? 'ערבב שאלות' : 'Shuffle Questions'}
                  </span>
                </label>

                <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.shuffleAnswers}
                    onChange={(e) => updateConfig('shuffleAnswers', e.target.checked)}
                    className="w-5 h-5 rounded border-white/20 bg-white/10 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-white/80">
                    {isRTL ? 'ערבב תשובות' : 'Shuffle Answers'}
                  </span>
                </label>

                <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showCorrectAnswers}
                    onChange={(e) => updateConfig('showCorrectAnswers', e.target.checked)}
                    className="w-5 h-5 rounded border-white/20 bg-white/10 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-white/80">
                    {isRTL ? 'הצג תשובה נכונה' : 'Show Correct Answer'}
                  </span>
                </label>

                <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showLeaderboard}
                    onChange={(e) => updateConfig('showLeaderboard', e.target.checked)}
                    className="w-5 h-5 rounded border-white/20 bg-white/10 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-white/80">
                    {isRTL ? 'הצג לוח תוצאות' : 'Show Leaderboard'}
                  </span>
                </label>
              </div>

              {/* Language */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  {isRTL ? 'שפה' : 'Language'}
                </label>
                <select
                  value={config.language}
                  onChange={(e) => updateConfig('language', e.target.value as 'he' | 'en' | 'auto')}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="auto">{isRTL ? 'אוטומטי' : 'Auto'}</option>
                  <option value="he">{isRTL ? 'עברית' : 'Hebrew'}</option>
                  <option value="en">{isRTL ? 'אנגלית' : 'English'}</option>
                </select>
              </div>
            </div>
          )}

          {/* Questions Tab */}
          {activeTab === 'questions' && (
            <div className="space-y-4">
              {/* Questions count */}
              <div className="flex items-center justify-between">
                <span className="text-white/60">
                  {config.questions.length} {isRTL ? 'שאלות' : 'questions'}
                </span>
                <button
                  onClick={addQuestion}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {isRTL ? 'הוסף שאלה' : 'Add Question'}
                </button>
              </div>

              {/* Questions list */}
              <div className="space-y-3">
                {config.questions.map((question, index) => (
                  <div
                    key={question.id}
                    className="border border-white/10 rounded-lg overflow-hidden"
                  >
                    {/* Question header */}
                    <div
                      className="flex items-center gap-3 p-4 bg-white/5 cursor-pointer"
                      onClick={() => setExpandedQuestionId(
                        expandedQuestionId === question.id ? null : question.id
                      )}
                    >
                      <GripVertical className="w-5 h-5 text-white/40" />
                      <span className="text-blue-400 font-medium">{index + 1}.</span>
                      <span className="flex-1 text-white truncate">
                        {question.text || (isRTL ? 'שאלה חדשה...' : 'New question...')}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); moveQuestion(question.id, 'up'); }}
                          disabled={index === 0}
                          className="p-1 text-white/40 hover:text-white disabled:opacity-30"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveQuestion(question.id, 'down'); }}
                          disabled={index === config.questions.length - 1}
                          className="p-1 text-white/40 hover:text-white disabled:opacity-30"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeQuestion(question.id); }}
                          className="p-1 text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {expandedQuestionId === question.id ? (
                          <ChevronUp className="w-5 h-5 text-white/60" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-white/60" />
                        )}
                      </div>
                    </div>

                    {/* Expanded question content */}
                    {expandedQuestionId === question.id && (
                      <div className="p-4 space-y-4 bg-white/[0.02]">
                        {/* Question text */}
                        <div>
                          <label className="block text-sm font-medium text-white/60 mb-2">
                            {isRTL ? 'טקסט השאלה' : 'Question Text'}
                          </label>
                          <textarea
                            value={question.text}
                            onChange={(e) => updateQuestion(question.id, { text: e.target.value })}
                            placeholder={isRTL ? 'הכנס את השאלה...' : 'Enter question...'}
                            rows={2}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500 resize-none"
                          />
                        </div>

                        {/* Timer */}
                        <div className="flex items-center gap-4">
                          <label className="text-sm text-white/60">
                            {isRTL ? 'זמן (שניות):' : 'Time (seconds):'}
                          </label>
                          <input
                            type="number"
                            min={10}
                            max={120}
                            value={question.timeLimitSeconds}
                            onChange={(e) => updateQuestion(question.id, {
                              timeLimitSeconds: parseInt(e.target.value) || 30,
                            })}
                            className="w-20 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-center focus:outline-none focus:border-blue-500"
                          />
                          <Timer className="w-4 h-4 text-white/40" />
                        </div>

                        {/* Answers */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-white/60">
                              {isRTL ? 'תשובות' : 'Answers'} ({question.answers.length}/6)
                            </label>
                            {question.answers.length < 6 && (
                              <button
                                onClick={() => addAnswer(question.id)}
                                className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                              >
                                <Plus className="w-4 h-4" />
                                {isRTL ? 'הוסף' : 'Add'}
                              </button>
                            )}
                          </div>

                          <div className="space-y-2">
                            {question.answers.map((answer, answerIndex) => (
                              <div
                                key={answer.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                                  answer.isCorrect
                                    ? 'border-green-500/50 bg-green-500/10'
                                    : 'border-white/10 bg-white/5'
                                }`}
                              >
                                <button
                                  onClick={() => updateAnswer(question.id, answer.id, { isCorrect: true })}
                                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                    answer.isCorrect
                                      ? 'border-green-500 bg-green-500'
                                      : 'border-white/30 hover:border-green-500'
                                  }`}
                                >
                                  {answer.isCorrect && <Check className="w-4 h-4 text-white" />}
                                </button>

                                <span className="text-white/40 text-sm font-medium">
                                  {String.fromCharCode(65 + answerIndex)}.
                                </span>

                                <input
                                  type="text"
                                  value={answer.text}
                                  onChange={(e) => updateAnswer(question.id, answer.id, { text: e.target.value })}
                                  placeholder={isRTL ? 'הכנס תשובה...' : 'Enter answer...'}
                                  className="flex-1 bg-transparent text-white placeholder-white/40 focus:outline-none"
                                />

                                {question.answers.length > 2 && (
                                  <button
                                    onClick={() => removeAnswer(question.id, answer.id)}
                                    className="p-1 text-red-400/60 hover:text-red-400"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>

                          {!question.answers.some(a => a.isCorrect) && (
                            <p className="text-sm text-amber-400 mt-2">
                              {isRTL ? '⚠️ לא נבחרה תשובה נכונה' : '⚠️ No correct answer selected'}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {config.questions.length === 0 && (
                <div className="text-center py-12 text-white/40">
                  <HelpCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{isRTL ? 'אין שאלות עדיין' : 'No questions yet'}</p>
                  <p className="text-sm">{isRTL ? 'לחצו "הוסף שאלה" להתחיל' : 'Click "Add Question" to start'}</p>
                </div>
              )}
            </div>
          )}

          {/* Scoring Tab */}
          {activeTab === 'scoring' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-4">
                  {isRTL ? 'מצב ניקוד' : 'Scoring Mode'}
                </label>

                <div className="grid grid-cols-2 gap-3">
                  {(Object.keys(SCORING_MODE_CONFIG) as QChallengeScoringMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => updateScoring('mode', mode)}
                      className={`p-4 rounded-lg border-2 text-start transition-all ${
                        config.scoring.mode === mode
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className={config.scoring.mode === mode ? 'text-blue-400' : 'text-white/60'}>
                          {scoringIcons[mode]}
                        </span>
                        <span className="font-medium text-white">
                          {isRTL ? SCORING_MODE_CONFIG[mode].name : SCORING_MODE_CONFIG[mode].nameEn}
                        </span>
                        <span className="text-xl">{SCORING_MODE_CONFIG[mode].emoji}</span>
                      </div>
                      <p className="text-sm text-white/50">
                        {isRTL ? SCORING_MODE_CONFIG[mode].description : SCORING_MODE_CONFIG[mode].descriptionEn}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Base points */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  {isRTL ? 'נקודות בסיס לתשובה נכונה' : 'Base Points per Correct Answer'}
                </label>
                <input
                  type="number"
                  min={10}
                  max={500}
                  step={10}
                  value={config.scoring.basePoints}
                  onChange={(e) => updateScoring('basePoints', parseInt(e.target.value) || 100)}
                  className="w-32 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Time bonus (if applicable) */}
              {(config.scoring.mode === 'time_only' || config.scoring.mode === 'time_and_streak') && (
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    {isRTL ? 'בונוס זמן מקסימלי' : 'Maximum Time Bonus'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={200}
                    step={10}
                    value={config.scoring.timeBonusMax}
                    onChange={(e) => updateScoring('timeBonusMax', parseInt(e.target.value) || 50)}
                    className="w-32 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-sm text-white/40 mt-1">
                    {isRTL ? 'נקודות נוספות למי שעונה מהר' : 'Extra points for fast answers'}
                  </p>
                </div>
              )}

              {/* Preview scoring */}
              <div className="p-4 bg-white/5 rounded-lg">
                <h4 className="font-medium text-white mb-3">
                  {isRTL ? 'דוגמה לחישוב ניקוד' : 'Scoring Example'}
                </h4>
                <div className="text-sm text-white/60 space-y-1">
                  <p>{isRTL ? 'תשובה נכונה:' : 'Correct answer:'} +{config.scoring.basePoints}</p>
                  {(config.scoring.mode === 'time_only' || config.scoring.mode === 'time_and_streak') && (
                    <p>{isRTL ? 'בונוס זמן (מהיר):' : 'Time bonus (fast):'} +{config.scoring.timeBonusMax}</p>
                  )}
                  {(config.scoring.mode === 'streak_only' || config.scoring.mode === 'time_and_streak') && (
                    <p>{isRTL ? 'מכפיל רצף (x3):' : 'Streak multiplier (x3):'} x3.0</p>
                  )}
                  <p className="text-white font-medium pt-2 border-t border-white/10">
                    {isRTL ? 'מקסימום לשאלה:' : 'Max per question:'} ~
                    {config.scoring.mode === 'simple'
                      ? config.scoring.basePoints
                      : Math.round(
                          (config.scoring.basePoints + (config.scoring.mode !== 'streak_only' ? config.scoring.timeBonusMax : 0)) *
                          (config.scoring.mode !== 'time_only' ? 3 : 1)
                        )
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Branding Tab */}
          {activeTab === 'branding' && (
            <div className="space-y-6">
              {/* Logo */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  {isRTL ? 'לוגו' : 'Logo'}
                </label>
                <div className="flex items-center gap-4">
                  {logoPreview ? (
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-white/10">
                      <img
                        src={logoPreview}
                        alt="Logo"
                        className="w-full h-full object-contain"
                      />
                      <button
                        onClick={() => {
                          setLogoFile(null);
                          setLogoPreview(null);
                          updateBranding('eventLogo', undefined);
                        }}
                        className="absolute top-1 right-1 p-1 bg-red-500 rounded-full text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      className="w-20 h-20 rounded-lg border-2 border-dashed border-white/20 hover:border-white/40 flex flex-col items-center justify-center text-white/40 hover:text-white/60 transition-colors"
                    >
                      <Upload className="w-6 h-6" />
                      <span className="text-xs mt-1">{isRTL ? 'העלאה' : 'Upload'}</span>
                    </button>
                  )}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Primary Color */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  {isRTL ? 'צבע ראשי' : 'Primary Color'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {presetColors.primary.map(color => (
                    <button
                      key={color}
                      onClick={() => updateBranding('primaryColor', color)}
                      className={`w-10 h-10 rounded-lg border-2 transition-all ${
                        config.branding.primaryColor === color
                          ? 'border-white scale-110'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Background Color */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  {isRTL ? 'צבע רקע' : 'Background Color'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {presetColors.background.map(color => (
                    <button
                      key={color}
                      onClick={() => updateBranding('backgroundColor', color)}
                      className={`w-10 h-10 rounded-lg border-2 transition-all ${
                        config.branding.backgroundColor === color
                          ? 'border-white scale-110'
                          : 'border-white/20'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Success Color */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  {isRTL ? 'צבע תשובה נכונה' : 'Correct Answer Color'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {presetColors.success.map(color => (
                    <button
                      key={color}
                      onClick={() => updateBranding('successColor', color)}
                      className={`w-10 h-10 rounded-lg border-2 transition-all ${
                        config.branding.successColor === color
                          ? 'border-white scale-110'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Error Color */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  {isRTL ? 'צבע תשובה שגויה' : 'Wrong Answer Color'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {presetColors.error.map(color => (
                    <button
                      key={color}
                      onClick={() => updateBranding('errorColor', color)}
                      className={`w-10 h-10 rounded-lg border-2 transition-all ${
                        config.branding.errorColor === color
                          ? 'border-white scale-110'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Advanced Tab */}
          {activeTab === 'advanced' && (
            <div className="space-y-6">
              {/* Phase Control */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-3">
                  {isRTL ? 'שלב נוכחי' : 'Current Phase'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {['registration', 'playing', 'finished', 'results'].map(phase => (
                    <button
                      key={phase}
                      onClick={() => handlePhaseChange(phase as QChallengePhase)}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        currentPhase === phase
                          ? 'bg-blue-500 text-white'
                          : 'bg-white/5 text-white/60 hover:bg-white/10'
                      }`}
                    >
                      {phase === 'registration' && (isRTL ? 'הרשמה' : 'Registration')}
                      {phase === 'playing' && (isRTL ? 'משחק' : 'Playing')}
                      {phase === 'finished' && (isRTL ? 'סיום' : 'Finished')}
                      {phase === 'results' && (isRTL ? 'תוצאות' : 'Results')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Links */}
              {shortId && (
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-3">
                    {isRTL ? 'קישור לחידון' : 'Quiz Link'}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/v/${shortId}`}
                      className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white/60 text-sm"
                    />
                    <button
                      onClick={copyLink}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors flex items-center gap-2"
                    >
                      {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedLink ? (isRTL ? 'הועתק!' : 'Copied!') : (isRTL ? 'העתק' : 'Copy')}
                    </button>
                  </div>
                </div>
              )}

              {/* Reset */}
              {onReset && (
                <div className="pt-4 border-t border-white/10">
                  <button
                    onClick={onReset}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {isRTL ? 'אפס חידון' : 'Reset Quiz'}
                  </button>
                  <p className="text-sm text-white/40 mt-2">
                    {isRTL ? 'זה ימחק את כל המשתתפים והתוצאות' : 'This will delete all participants and results'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-6 py-2 text-white/60 hover:text-white transition-colors"
          >
            {isRTL ? 'ביטול' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isRTL ? 'שמור' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
