'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  Rocket,
  Smartphone,
  BarChart3,
  Palette,
  Clock,
  TrendingUp,
  Gamepad2,
  Lightbulb,
  ChevronDown,
  BookOpen,
  Sparkles,
  MessageCircle,
  QrCode,
  Share2,
  FolderOpen,
  Mic2,
  Crosshair,
  Map
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { clsx } from 'clsx';

interface FAQItem {
  questionKey: string;
  answerKey: string;
}

interface FAQCategory {
  id: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  questions: FAQItem[];
}

const categories: FAQCategory[] = [
  {
    id: 'quickStart',
    icon: Rocket,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    questions: [
      { questionKey: 'createFirstCode', answerKey: 'createFirstCodeAnswer' },
      { questionKey: 'uploadMedia', answerKey: 'uploadMediaAnswer' },
      { questionKey: 'shareCode', answerKey: 'shareCodeAnswer' },
      { questionKey: 'whatIsDynamic', answerKey: 'whatIsDynamicAnswer' },
    ],
  },
  {
    id: 'contentTypes',
    icon: Smartphone,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    questions: [
      { questionKey: 'imageVsGallery', answerKey: 'imageVsGalleryAnswer' },
      { questionKey: 'pdfAnimation', answerKey: 'pdfAnimationAnswer' },
      { questionKey: 'whatIsRiddle', answerKey: 'whatIsRiddleAnswer' },
      { questionKey: 'whatIsSelfiebeam', answerKey: 'whatIsSelfiebeamAnswer' },
      { questionKey: 'createWeeklyCal', answerKey: 'createWeeklyCalAnswer' },
    ],
  },
  {
    id: 'qrDesign',
    icon: QrCode,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
    questions: [
      { questionKey: 'qrSignLogo', answerKey: 'qrSignLogoAnswer' },
      { questionKey: 'qrSignText', answerKey: 'qrSignTextAnswer' },
      { questionKey: 'qrSignEmoji', answerKey: 'qrSignEmojiAnswer' },
      { questionKey: 'qrColors', answerKey: 'qrColorsAnswer' },
      { questionKey: 'printSafe', answerKey: 'printSafeAnswer' },
    ],
  },
  {
    id: 'widgets',
    icon: MessageCircle,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    questions: [
      { questionKey: 'whatsappWidget', answerKey: 'whatsappWidgetAnswer' },
      { questionKey: 'whatsappGroup', answerKey: 'whatsappGroupAnswer' },
      { questionKey: 'phoneWidget', answerKey: 'phoneWidgetAnswer' },
      { questionKey: 'emailWidget', answerKey: 'emailWidgetAnswer' },
      { questionKey: 'navigationWidget', answerKey: 'navigationWidgetAnswer' },
      { questionKey: 'smsWidget', answerKey: 'smsWidgetAnswer' },
    ],
  },
  {
    id: 'qvote',
    icon: BarChart3,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    questions: [
      { questionKey: 'openVoting', answerKey: 'openVotingAnswer' },
      { questionKey: 'votingPhases', answerKey: 'votingPhasesAnswer' },
      { questionKey: 'addCandidates', answerKey: 'addCandidatesAnswer' },
      { questionKey: 'shuffleCandidates', answerKey: 'shuffleCandidatesAnswer' },
      { questionKey: 'limitVotes', answerKey: 'limitVotesAnswer' },
      { questionKey: 'showResults', answerKey: 'showResultsAnswer' },
      { questionKey: 'qvoteBranding', answerKey: 'qvoteBrandingAnswer' },
      { questionKey: 'disableLandingPage', answerKey: 'disableLandingPageAnswer' },
      { questionKey: 'requireRegistration', answerKey: 'requireRegistrationAnswer' },
      { questionKey: 'imagePositioning', answerKey: 'imagePositioningAnswer' },
      { questionKey: 'imageSafeZone', answerKey: 'imageSafeZoneAnswer' },
    ],
  },
  {
    id: 'qstage',
    icon: Mic2,
    color: 'text-fuchsia-500',
    bgColor: 'bg-fuchsia-500/10',
    questions: [
      { questionKey: 'whatIsQstage', answerKey: 'whatIsQstageAnswer' },
      { questionKey: 'startVotingSession', answerKey: 'startVotingSessionAnswer' },
      { questionKey: 'qstagePhases', answerKey: 'qstagePhasesAnswer' },
      { questionKey: 'addJudges', answerKey: 'addJudgesAnswer' },
      { questionKey: 'customizeDisplay', answerKey: 'customizeDisplayAnswer' },
      { questionKey: 'qstageThresholds', answerKey: 'qstageThresholdsAnswer' },
    ],
  },
  {
    id: 'qhunt',
    icon: Crosshair,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    questions: [
      { questionKey: 'whatIsQhunt', answerKey: 'whatIsQhuntAnswer' },
      { questionKey: 'createHuntCodes', answerKey: 'createHuntCodesAnswer' },
      { questionKey: 'teamScoring', answerKey: 'teamScoringAnswer' },
      { questionKey: 'huntLeaderboard', answerKey: 'huntLeaderboardAnswer' },
    ],
  },
  {
    id: 'qtreasure',
    icon: Map,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    questions: [
      { questionKey: 'whatIsQtreasure', answerKey: 'whatIsQtreasureAnswer' },
      { questionKey: 'createTreasureStations', answerKey: 'createTreasureStationsAnswer' },
      { questionKey: 'addCluesAndVideos', answerKey: 'addCluesAndVideosAnswer' },
      { questionKey: 'treasureProgress', answerKey: 'treasureProgressAnswer' },
    ],
  },
  {
    id: 'customization',
    icon: Palette,
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
    questions: [
      { questionKey: 'changeColors', answerKey: 'changeColorsAnswer' },
      { questionKey: 'setupLandingPage', answerKey: 'setupLandingPageAnswer' },
      { questionKey: 'customButtons', answerKey: 'customButtonsAnswer' },
      { questionKey: 'mediaLinkButton', answerKey: 'mediaLinkButtonAnswer' },
    ],
  },
  {
    id: 'organization',
    icon: FolderOpen,
    color: 'text-teal-500',
    bgColor: 'bg-teal-500/10',
    questions: [
      { questionKey: 'createFolder', answerKey: 'createFolderAnswer' },
      { questionKey: 'moveToFolder', answerKey: 'moveToFolderAnswer' },
      { questionKey: 'duplicateCode', answerKey: 'duplicateCodeAnswer' },
      { questionKey: 'transferOwnership', answerKey: 'transferOwnershipAnswer' },
    ],
  },
  {
    id: 'scheduling',
    icon: Clock,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    questions: [
      { questionKey: 'scheduleMedia', answerKey: 'scheduleMediaAnswer' },
      { questionKey: 'autoReplace', answerKey: 'autoReplaceAnswer' },
      { questionKey: 'activitySchedule', answerKey: 'activityScheduleAnswer' },
    ],
  },
  {
    id: 'analytics',
    icon: TrendingUp,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    questions: [
      { questionKey: 'viewStats', answerKey: 'viewStatsAnswer' },
      { questionKey: 'viewSource', answerKey: 'viewSourceAnswer' },
      { questionKey: 'clickReport', answerKey: 'clickReportAnswer' },
    ],
  },
  {
    id: 'gamification',
    icon: Gamepad2,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    questions: [
      { questionKey: 'whatIsXP', answerKey: 'whatIsXPAnswer' },
      { questionKey: 'setupPrizes', answerKey: 'setupPrizesAnswer' },
      { questionKey: 'whatIsRoute', answerKey: 'whatIsRouteAnswer' },
      { questionKey: 'howLobbyWorks', answerKey: 'howLobbyWorksAnswer' },
    ],
  },
  {
    id: 'sharing',
    icon: Share2,
    color: 'text-rose-500',
    bgColor: 'bg-rose-500/10',
    questions: [
      { questionKey: 'shareLink', answerKey: 'shareLinkAnswer' },
      { questionKey: 'downloadQR', answerKey: 'downloadQRAnswer' },
      { questionKey: 'publicUrls', answerKey: 'publicUrlsAnswer' },
      { questionKey: 'galleryUrl', answerKey: 'galleryUrlAnswer' },
    ],
  },
  {
    id: 'tipsAndTricks',
    icon: Lightbulb,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    questions: [
      { questionKey: 'keyboardShortcuts', answerKey: 'keyboardShortcutsAnswer' },
      { questionKey: 'mobilePreview', answerKey: 'mobilePreviewAnswer' },
      { questionKey: 'collaborators', answerKey: 'collaboratorsAnswer' },
      { questionKey: 'globalCodes', answerKey: 'globalCodesAnswer' },
    ],
  },
];

function AccordionItem({
  question,
  answer,
  isOpen,
  onToggle,
  index
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
  index: number;
}) {
  return (
    <div
      className={clsx(
        "border-b border-border/50 last:border-b-0 transition-colors",
        isOpen && "bg-bg-hover/30"
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-4 py-3.5 text-start hover:bg-bg-hover/50 transition-colors group"
      >
        <span className={clsx(
          "text-sm font-medium transition-colors",
          isOpen ? "text-accent" : "text-text-primary group-hover:text-accent"
        )}>
          {question}
        </span>
        <ChevronDown
          className={clsx(
            "w-4 h-4 text-text-secondary shrink-0 transition-transform duration-300",
            isOpen && "rotate-180 text-accent"
          )}
        />
      </button>
      <div className={clsx(
        "grid transition-all duration-300 ease-out",
        isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}>
        <div className="overflow-hidden">
          <p className="px-4 pb-4 text-sm text-text-secondary leading-relaxed whitespace-pre-line">
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
}

function CategoryCard({
  category,
  isExpanded,
  onToggle,
  openQuestionId,
  setOpenQuestionId,
  t,
  index
}: {
  category: FAQCategory;
  isExpanded: boolean;
  onToggle: () => void;
  openQuestionId: string | null;
  setOpenQuestionId: (id: string | null) => void;
  t: ReturnType<typeof useTranslations>;
  index: number;
}) {
  const Icon = category.icon;

  return (
    <div
      className={clsx(
        "rounded-2xl border border-border bg-bg-secondary overflow-hidden transition-all duration-300",
        "hover:border-border/80 hover:shadow-lg hover:shadow-black/5",
        isExpanded && "ring-2 ring-accent/20"
      )}
      style={{
        animationDelay: `${index * 100}ms`,
        animation: 'fadeSlideIn 0.5s ease-out backwards'
      }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-4 text-start transition-colors hover:bg-bg-hover/30 group"
      >
        <div className={clsx(
          "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
          category.bgColor
        )}>
          <Icon className={clsx("w-6 h-6", category.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-text-primary">
            {t(`categories.${category.id}`)}
          </h3>
          <p className="text-xs text-text-secondary mt-0.5">
            {category.questions.length} {t('questionsCount')}
          </p>
        </div>
        <ChevronDown
          className={clsx(
            "w-5 h-5 text-text-secondary transition-transform duration-300",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      <div className={clsx(
        "grid transition-all duration-300 ease-out",
        isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      )}>
        <div className="overflow-hidden">
          <div className="border-t border-border/50">
            {category.questions.map((q, qIndex) => (
              <AccordionItem
                key={q.questionKey}
                question={t(`questions.${q.questionKey}`)}
                answer={t(`questions.${q.answerKey}`)}
                isOpen={openQuestionId === `${category.id}-${q.questionKey}`}
                onToggle={() => setOpenQuestionId(
                  openQuestionId === `${category.id}-${q.questionKey}`
                    ? null
                    : `${category.id}-${q.questionKey}`
                )}
                index={qIndex}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GuidePage() {
  const t = useTranslations('guide');
  const locale = useLocale();
  const isRTL = locale === 'he';

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);

  // Filter categories and questions based on search
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;

    const query = searchQuery.toLowerCase();
    return categories.map(category => {
      const filteredQuestions = category.questions.filter(q => {
        const question = t(`questions.${q.questionKey}`).toLowerCase();
        const answer = t(`questions.${q.answerKey}`).toLowerCase();
        return question.includes(query) || answer.includes(query);
      });
      return { ...category, questions: filteredQuestions };
    }).filter(category => category.questions.length > 0);
  }, [searchQuery, t]);

  // Auto-expand category when searching
  const effectiveExpandedId = searchQuery.trim()
    ? filteredCategories[0]?.id || null
    : expandedCategoryId;

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-accent/10 via-purple-500/5 to-bg-primary pb-8 pt-6">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -end-24 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -start-24 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 mb-4">
              <BookOpen className="w-8 h-8 text-accent" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-text-primary mb-3">
              {t('title')}
            </h1>
            <p className="text-text-secondary text-lg max-w-xl mx-auto">
              {t('subtitle')}
            </p>
          </div>

          {/* Search */}
          <div className="relative max-w-xl mx-auto">
            <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none">
              <Search className="w-5 h-5 text-text-secondary" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className={clsx(
                "w-full py-3.5 px-12 rounded-xl",
                "bg-bg-secondary border border-border",
                "text-text-primary placeholder:text-text-secondary",
                "focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent",
                "transition-all duration-200"
              )}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 end-0 flex items-center pe-4 text-text-secondary hover:text-text-primary transition-colors"
              >
                <span className="text-sm">{t('clear')}</span>
              </button>
            )}
          </div>

          {/* Quick stats */}
          <div className="flex items-center justify-center gap-6 mt-6 text-sm text-text-secondary">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <span>{categories.length} {t('categoriesCount')}</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-text-secondary/30" />
            <div className="flex items-center gap-2">
              <span>{categories.reduce((acc, c) => acc + c.questions.length, 0)} {t('totalQuestions')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {filteredCategories.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-bg-secondary mb-4">
              <Search className="w-8 h-8 text-text-secondary" />
            </div>
            <h3 className="text-lg font-medium text-text-primary mb-2">
              {t('noResults')}
            </h3>
            <p className="text-text-secondary">
              {t('tryDifferentSearch')}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredCategories.map((category, index) => (
              <CategoryCard
                key={category.id}
                category={category}
                isExpanded={effectiveExpandedId === category.id}
                onToggle={() => setExpandedCategoryId(
                  expandedCategoryId === category.id ? null : category.id
                )}
                openQuestionId={openQuestionId}
                setOpenQuestionId={setOpenQuestionId}
                t={t}
                index={index}
              />
            ))}
          </div>
        )}

        {/* Footer note */}
        <div className="mt-12 text-center">
          <p className="text-sm text-text-secondary">
            {t('needMoreHelp')}{' '}
            <a
              href="https://wa.me/972773006306"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline font-medium"
            >
              {t('contactSupport')}
            </a>
          </p>
        </div>
      </div>

      {/* CSS Animation */}
      <style jsx global>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
