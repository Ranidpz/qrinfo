'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X, Loader2, Plus, Trash2, Palette, Settings, HelpCircle,
  Copy, Check, ImageIcon, Upload, Timer, Play, Square, RotateCcw,
  GripVertical, ChevronDown, ChevronUp, Zap, Clock, Flame, CheckCircle,
  ExternalLink, Trophy, Download, FileUp, Sparkles,
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';
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
  onSave: (config: QChallengeConfig, logoFile?: File, backgroundFile?: File) => Promise<void>;
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

  // Background image state
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  // Copy state
  const [copiedLink, setCopiedLink] = useState(false);

  // Save success state
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize from initialConfig
  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig);
      if (initialConfig.branding.eventLogo) {
        setLogoPreview(initialConfig.branding.eventLogo);
      }
      if (initialConfig.branding.backgroundImage) {
        setBackgroundPreview(initialConfig.branding.backgroundImage);
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

  // Excel Import/Export
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());

      // Skip header row if it looks like a header
      const startIndex = lines[0]?.toLowerCase().includes('question') ||
                         lines[0]?.toLowerCase().includes('שאלה') ? 1 : 0;

      const newQuestions: QChallengeQuestion[] = [];

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i];
        // Parse CSV - handle quoted values
        const values: string[] = [];
        let current = '';
        let inQuotes = false;

        for (const char of line) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());

        // Format: Question, Answer1, Answer2, Answer3, Answer4, Answer5, Answer6, CorrectIndex, TimeLimit
        // Minimum: Question, Answer1, Answer2, CorrectIndex
        if (values.length >= 4) {
          const questionText = values[0];
          const answers: QChallengeAnswer[] = [];

          // Get answers (columns 1-6)
          for (let j = 1; j <= 6; j++) {
            if (values[j] && values[j].trim()) {
              answers.push({
                id: generateAnswerId(),
                text: values[j].trim(),
                isCorrect: false,
                order: j - 1,
              });
            }
          }

          // Get correct answer index (1-based in file, convert to 0-based)
          const correctIndex = parseInt(values[7] || values[answers.length + 1] || '1') - 1;
          if (correctIndex >= 0 && correctIndex < answers.length) {
            answers[correctIndex].isCorrect = true;
          } else if (answers.length > 0) {
            answers[0].isCorrect = true;
          }

          // Get time limit if provided (default to config default)
          const timeLimit = parseInt(values[8] || values[answers.length + 2] || '');
          const defaultTimeLimit = config.defaultTimeLimitSeconds || 30;

          if (questionText && answers.length >= 2) {
            newQuestions.push({
              id: generateQuestionId(),
              text: questionText,
              answers,
              timeLimitSeconds: isNaN(timeLimit) ? defaultTimeLimit : timeLimit,
              points: config.scoring?.basePoints || 100,
              order: config.questions.length + newQuestions.length,
              isActive: true,
              createdAt: Date.now(),
            });
          }
        }
      }

      if (newQuestions.length > 0) {
        updateConfig('questions', [...config.questions, ...newQuestions]);
        alert(isRTL
          ? `יובאו ${newQuestions.length} שאלות בהצלחה!`
          : `Successfully imported ${newQuestions.length} questions!`
        );
      } else {
        alert(isRTL
          ? 'לא נמצאו שאלות תקינות בקובץ. ודא שהפורמט נכון.'
          : 'No valid questions found. Please check the file format.'
        );
      }
    } catch (error) {
      console.error('Import error:', error);
      alert(isRTL ? 'שגיאה בייבוא הקובץ' : 'Error importing file');
    }

    // Reset input
    e.target.value = '';
  };

  const handleExportExcel = () => {
    if (config.questions.length === 0) return;

    // Create CSV content
    const headers = isRTL
      ? ['שאלה', 'תשובה 1', 'תשובה 2', 'תשובה 3', 'תשובה 4', 'תשובה 5', 'תשובה 6', 'תשובה נכונה', 'מגבלת זמן']
      : ['Question', 'Answer 1', 'Answer 2', 'Answer 3', 'Answer 4', 'Answer 5', 'Answer 6', 'Correct Answer', 'Time Limit'];

    const rows = config.questions.map(q => {
      const answers = Array(6).fill('');
      let correctIndex = 1;

      q.answers.forEach((a, i) => {
        answers[i] = a.text;
        if (a.isCorrect) correctIndex = i + 1;
      });

      return [
        `"${q.text.replace(/"/g, '""')}"`,
        ...answers.map(a => `"${a.replace(/"/g, '""')}"`),
        correctIndex.toString(),
        q.timeLimitSeconds?.toString() || '',
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    // Add BOM for Hebrew support in Excel
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `qchallenge-questions-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

  // Handle background upload
  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBackgroundFile(file);
      setBackgroundPreview(URL.createObjectURL(file));
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
    try {
      await onSave(config, logoFile || undefined, backgroundFile || undefined);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Save error:', error);
    }
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
              {/* Title and QR Code section */}
              <div className="flex gap-6">
                {/* Left side - Title and Description */}
                <div className="flex-1 space-y-4">
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
                </div>

                {/* Right side - QR Code */}
                {shortId && (
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className="p-3 bg-white rounded-xl cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => window.open(`${typeof window !== 'undefined' ? window.location.origin : ''}/v/${shortId}`, '_blank')}
                      title={isRTL ? 'לחץ לפתיחה' : 'Click to open'}
                    >
                      <QRCodeSVG
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/v/${shortId}`}
                        size={120}
                        level="M"
                        includeMargin={false}
                      />
                    </div>
                    <button
                      onClick={() => window.open(`${typeof window !== 'undefined' ? window.location.origin : ''}/v/${shortId}`, '_blank')}
                      className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {isRTL ? 'פתח בדפדפן' : 'Open in browser'}
                    </button>
                  </div>
                )}
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
              {/* Questions count and action buttons */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-white/60">
                  {config.questions.length} {isRTL ? 'שאלות' : 'questions'}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Import from Excel */}
                  <label className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer">
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">{isRTL ? 'יבוא מאקסל' : 'Import'}</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleImportExcel}
                      className="hidden"
                    />
                  </label>

                  {/* Export to Excel */}
                  <button
                    onClick={handleExportExcel}
                    disabled={config.questions.length === 0}
                    className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileUp className="w-4 h-4" />
                    <span className="hidden sm:inline">{isRTL ? 'יצוא לאקסל' : 'Export'}</span>
                  </button>

                  {/* AI Generator (coming soon) */}
                  <button
                    disabled
                    className="flex items-center gap-2 px-3 py-2 bg-purple-500/30 text-purple-300 rounded-lg cursor-not-allowed opacity-60"
                    title={isRTL ? 'בקרוב...' : 'Coming soon...'}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span className="hidden sm:inline">AI</span>
                  </button>

                  {/* Add Question */}
                  <button
                    onClick={addQuestion}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    {isRTL ? 'הוסף שאלה' : 'Add Question'}
                  </button>
                </div>
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

              {/* Points settings - row with inputs and explanation */}
              <div className="p-4 bg-white/5 rounded-xl space-y-4">
                {/* Input row */}
                <div className="flex items-center gap-6 flex-wrap">
                  {/* Base points */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-white/80">
                      {isRTL ? 'נקודות בסיס:' : 'Base points:'}
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={500}
                      step={10}
                      value={config.scoring.basePoints}
                      onChange={(e) => updateScoring('basePoints', parseInt(e.target.value) || 100)}
                      className="w-20 px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-center focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Time bonus (if applicable) */}
                  {(config.scoring.mode === 'time_only' || config.scoring.mode === 'time_and_streak') && (
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-white/80">
                        {isRTL ? 'בונוס זמן מקס׳:' : 'Max time bonus:'}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={200}
                        step={10}
                        value={config.scoring.timeBonusMax}
                        onChange={(e) => updateScoring('timeBonusMax', parseInt(e.target.value) || 50)}
                        className="w-20 px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-center focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  )}
                </div>

                {/* Scoring explanation */}
                <div className="text-sm text-white/60 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">✓</span>
                    <span>{isRTL ? 'תשובה נכונה:' : 'Correct answer:'}</span>
                    <span className="text-white font-medium">+{config.scoring.basePoints}</span>
                    <span>{isRTL ? 'נקודות' : 'points'}</span>
                  </div>

                  {(config.scoring.mode === 'time_only' || config.scoring.mode === 'time_and_streak') && (
                    <div className="flex items-center gap-2">
                      <span className="text-blue-400">⚡</span>
                      <span>{isRTL ? 'עונה מהר:' : 'Fast answer:'}</span>
                      <span className="text-white font-medium">+{config.scoring.timeBonusMax}</span>
                      <span>{isRTL ? 'נקודות נוספות (יורד ככל שעובר הזמן)' : 'bonus (decreases over time)'}</span>
                    </div>
                  )}

                  {(config.scoring.mode === 'streak_only' || config.scoring.mode === 'time_and_streak') && (
                    <div className="flex items-center gap-2">
                      <span className="text-orange-400">🔥</span>
                      <span>{isRTL ? 'רצף תשובות נכונות:' : 'Correct streak:'}</span>
                      <span className="text-white font-medium">×1.2 → ×3.0</span>
                      <span>{isRTL ? '(עד 6 תשובות ברצף)' : '(up to 6 in a row)'}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-white/10 flex items-center gap-2">
                    <span className="text-yellow-400">🏆</span>
                    <span>{isRTL ? 'מקסימום לשאלה:' : 'Max per question:'}</span>
                    <span className="text-white font-bold text-base">
                      ~{config.scoring.mode === 'simple'
                        ? config.scoring.basePoints
                        : Math.round(
                            (config.scoring.basePoints + (config.scoring.mode !== 'streak_only' ? config.scoring.timeBonusMax : 0)) *
                            (config.scoring.mode !== 'time_only' ? 3 : 1)
                          )
                      }
                    </span>
                    <span>{isRTL ? 'נקודות' : 'points'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Branding Tab */}
          {activeTab === 'branding' && (
            <div className="flex gap-6">
              {/* Left side - Settings */}
              <div className="flex-1 space-y-6">
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
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <span className="text-xs text-white/40">PNG / WebP / JPG</span>
                  </div>
                </div>

                {/* Primary Color */}
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    {isRTL ? 'צבע ראשי' : 'Primary Color'}
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-wrap gap-2">
                      {presetColors.primary.map(color => (
                        <button
                          key={color}
                          onClick={() => updateBranding('primaryColor', color)}
                          className={`w-8 h-8 rounded-lg border-2 transition-all ${
                            config.branding.primaryColor === color
                              ? 'border-white scale-110'
                              : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <input
                      type="color"
                      value={config.branding.primaryColor || '#3b82f6'}
                      onChange={(e) => updateBranding('primaryColor', e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-2 border-white/20"
                      title={isRTL ? 'בחר צבע מותאם' : 'Choose custom color'}
                    />
                  </div>
                </div>

                {/* Background Color */}
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    {isRTL ? 'צבע רקע' : 'Background Color'}
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-wrap gap-2">
                      {presetColors.background.map(color => (
                        <button
                          key={color}
                          onClick={() => updateBranding('backgroundColor', color)}
                          className={`w-8 h-8 rounded-lg border-2 transition-all ${
                            config.branding.backgroundColor === color
                              ? 'border-white scale-110'
                              : 'border-white/20'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <input
                      type="color"
                      value={config.branding.backgroundColor || '#1a1a2e'}
                      onChange={(e) => updateBranding('backgroundColor', e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-2 border-white/20"
                      title={isRTL ? 'בחר צבע מותאם' : 'Choose custom color'}
                    />
                  </div>
                </div>

                {/* Success Color */}
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    {isRTL ? 'צבע תשובה נכונה' : 'Correct Answer Color'}
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-wrap gap-2">
                      {presetColors.success.map(color => (
                        <button
                          key={color}
                          onClick={() => updateBranding('successColor', color)}
                          className={`w-8 h-8 rounded-lg border-2 transition-all ${
                            config.branding.successColor === color
                              ? 'border-white scale-110'
                              : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <input
                      type="color"
                      value={config.branding.successColor || '#22c55e'}
                      onChange={(e) => updateBranding('successColor', e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-2 border-white/20"
                      title={isRTL ? 'בחר צבע מותאם' : 'Choose custom color'}
                    />
                  </div>
                </div>

                {/* Error Color */}
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    {isRTL ? 'צבע תשובה שגויה' : 'Wrong Answer Color'}
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-wrap gap-2">
                      {presetColors.error.map(color => (
                        <button
                          key={color}
                          onClick={() => updateBranding('errorColor', color)}
                          className={`w-8 h-8 rounded-lg border-2 transition-all ${
                            config.branding.errorColor === color
                              ? 'border-white scale-110'
                              : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <input
                      type="color"
                      value={config.branding.errorColor || '#ef4444'}
                      onChange={(e) => updateBranding('errorColor', e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-2 border-white/20"
                      title={isRTL ? 'בחר צבע מותאם' : 'Choose custom color'}
                    />
                  </div>
                </div>
              </div>

              {/* Right side - Preview */}
              <div className="w-64 flex-shrink-0 space-y-4">
                {/* Preview header with background image button */}
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-white/80">
                    {isRTL ? 'תצוגה מקדימה' : 'Preview'}
                  </label>
                  <div className="flex items-center gap-2">
                    {/* Background image button */}
                    <button
                      onClick={() => backgroundInputRef.current?.click()}
                      className={`p-1.5 rounded-lg transition-colors ${
                        backgroundPreview
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-white/10 text-white/60 hover:text-white hover:bg-white/20'
                      }`}
                      title={isRTL ? 'תמונת רקע' : 'Background image'}
                    >
                      <ImageIcon className="w-4 h-4" />
                    </button>
                    {backgroundPreview && (
                      <button
                        onClick={() => {
                          setBackgroundFile(null);
                          setBackgroundPreview(null);
                          updateBranding('backgroundImage', undefined);
                        }}
                        className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                        title={isRTL ? 'הסר רקע' : 'Remove background'}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Hidden input for background */}
                <input
                  ref={backgroundInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleBackgroundUpload}
                  className="hidden"
                />

                {/* Preview container */}
                <div
                  className="w-full aspect-[9/16] rounded-2xl overflow-hidden border-2 border-white/10 relative"
                  style={{
                    backgroundColor: config.branding.backgroundColor || '#1a1a2e',
                    backgroundImage: backgroundPreview ? `url(${backgroundPreview})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add('border-orange-500');
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-orange-500');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-orange-500');
                    const file = e.dataTransfer.files[0];
                    if (file && file.type.startsWith('image/')) {
                      setBackgroundFile(file);
                      setBackgroundPreview(URL.createObjectURL(file));
                    }
                  }}
                >
                  {/* Overlay for readability */}
                  {backgroundPreview && (
                    <div className="absolute inset-0 bg-black/40" />
                  )}

                  {/* Preview content */}
                  <div className="relative h-full flex flex-col items-center justify-center p-4 text-center">
                    {/* Logo preview */}
                    {logoPreview && (
                      <img
                        src={logoPreview}
                        alt="Logo"
                        className="w-16 h-16 object-contain mb-3"
                      />
                    )}

                    {/* Trophy icon if no logo */}
                    {!logoPreview && (
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
                        style={{ backgroundColor: `${config.branding.primaryColor || '#3b82f6'}30` }}
                      >
                        <Trophy
                          className="w-7 h-7"
                          style={{ color: config.branding.primaryColor || '#3b82f6' }}
                        />
                      </div>
                    )}

                    {/* Title (if shown) */}
                    {config.branding.showTitle !== false && (
                      <h3
                        className="text-white font-bold mb-1 line-clamp-2"
                        style={{ fontSize: `${config.branding.titleFontSize || 1}rem` }}
                      >
                        {config.branding.quizTitle || (isRTL ? 'כותרת החידון' : 'Quiz Title')}
                      </h3>
                    )}

                    {/* Description (if shown) */}
                    {config.branding.showDescription !== false && (
                      <p
                        className="text-white/60 line-clamp-2 mb-4"
                        style={{ fontSize: `${config.branding.descriptionFontSize || 0.75}rem` }}
                      >
                        {config.branding.quizDescription || (isRTL ? 'תיאור החידון' : 'Quiz description')}
                      </p>
                    )}

                    {/* Start button */}
                    <button
                      className="px-4 py-2 rounded-lg text-white text-xs font-medium"
                      style={{ backgroundColor: config.branding.primaryColor || '#3b82f6' }}
                    >
                      {isRTL ? 'התחל!' : 'Start!'}
                    </button>
                  </div>
                </div>

                {/* Text display settings */}
                <div className="space-y-3 p-3 bg-white/5 rounded-xl">
                  {/* Title settings */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-white/70">{isRTL ? 'כותרת' : 'Title'}</label>
                      <button
                        onClick={() => updateBranding('showTitle', !config.branding.showTitle)}
                        className={`w-8 h-4 rounded-full transition-colors relative ${
                          config.branding.showTitle !== false ? 'bg-blue-500' : 'bg-white/20'
                        }`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${
                          config.branding.showTitle !== false ? 'right-0.5' : 'left-0.5'
                        }`} />
                      </button>
                    </div>
                    {config.branding.showTitle !== false && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/50">A</span>
                        <input
                          type="range"
                          min={0.75}
                          max={2}
                          step={0.05}
                          value={config.branding.titleFontSize || 1}
                          onChange={(e) => updateBranding('titleFontSize', parseFloat(e.target.value))}
                          className="flex-1 accent-blue-500"
                        />
                        <span className="text-sm text-white/50">A</span>
                      </div>
                    )}
                  </div>

                  {/* Description settings */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-white/70">{isRTL ? 'תיאור' : 'Description'}</label>
                      <button
                        onClick={() => updateBranding('showDescription', !config.branding.showDescription)}
                        className={`w-8 h-4 rounded-full transition-colors relative ${
                          config.branding.showDescription !== false ? 'bg-blue-500' : 'bg-white/20'
                        }`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${
                          config.branding.showDescription !== false ? 'right-0.5' : 'left-0.5'
                        }`} />
                      </button>
                    </div>
                    {config.branding.showDescription !== false && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/50">A</span>
                        <input
                          type="range"
                          min={0.5}
                          max={1.5}
                          step={0.05}
                          value={config.branding.descriptionFontSize || 0.75}
                          onChange={(e) => updateBranding('descriptionFontSize', parseFloat(e.target.value))}
                          className="flex-1 accent-blue-500"
                        />
                        <span className="text-sm text-white/50">A</span>
                      </div>
                    )}
                  </div>
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
            disabled={loading || saveSuccess}
            className={`flex items-center gap-2 px-6 py-2 text-white rounded-lg transition-all ${
              saveSuccess
                ? 'bg-green-500'
                : 'bg-blue-500 hover:bg-blue-600 disabled:opacity-50'
            }`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {saveSuccess && <Check className="w-4 h-4" />}
            {saveSuccess ? (isRTL ? 'נשמר!' : 'Saved!') : loading ? (isRTL ? 'שומר...' : 'Saving...') : (isRTL ? 'שמור' : 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}
