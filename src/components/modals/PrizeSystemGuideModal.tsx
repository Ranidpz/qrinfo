'use client';

import { X, Gift, Star, Trophy, Monitor, Sparkles, Users, Package, Percent, AlertCircle } from 'lucide-react';
import { RARITY_CONFIG, DEFAULT_DROP_RATES } from '@/types';

interface PrizeSystemGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale?: 'he' | 'en';
}

const translations = {
  he: {
    title: 'מדריך מערכת הפרסים',
    subtitle: 'כל מה שצריך לדעת על הגדרת ומנהול פרסים',

    // Section 1: Overview
    overviewTitle: 'סקירה כללית',
    overviewDesc: 'מערכת הפרסים מאפשרת למבקרים לזכות בפרסים אמיתיים במהלך המשחק. המערכת פועלת בסגנון "פתיחת חבילות" כמו במשחקי FIFA או Brawl Stars.',

    // Section 2: How it works
    howItWorksTitle: 'איך זה עובד?',
    step1Title: 'צבירת XP',
    step1Desc: 'מבקרים צוברים נקודות XP על ידי סריקת קודים (+10 XP) והעלאת תמונות (+25 XP)',
    step2Title: 'עליית רמה',
    step2Desc: 'כשמבקר צובר מספיק XP, הוא עולה רמה ומקבל חבילה',
    step3Title: 'פתיחת חבילה',
    step3Desc: 'המבקר לוחץ על החבילה ומקבל פרס אקראי לפי הגרלה',
    step4Title: 'קבלת הפרס',
    step4Desc: 'הפרס מוצג והמבקר יכול לממש אותו בקבלה',

    // Section 3: Levels
    levelsTitle: 'רמות ודרישות XP',
    levelBeginner: 'מתחיל',
    levelExplorer: 'חוקר',
    levelExpert: 'מומחה',
    levelChampion: 'אלוף',
    xpRequired: 'נדרש: {xp} XP',
    packReward: 'פרס: חבילה אחת',

    // Section 4: Rarity
    rarityTitle: 'רמות נדירות',
    rarityDesc: 'כל פרס שייך לאחת מארבע רמות נדירות:',
    dropRateLabel: 'סיכוי נפילה מומלץ',

    // Section 5: Setup
    setupTitle: 'הגדרת פרסים',
    setupStep1: 'הפעל את מערכת הפרסים בהגדרות המסלול',
    setupStep2: 'לחץ על "נהל פרסים" כדי להוסיף פרסים',
    setupStep3: 'הוסף פרסים עם שם, נדירות וכמות',
    setupStep4: 'התאם את אחוזי הנפילה (סה"כ צריך להיות 100%)',
    setupStep5: 'אופציונלי: הפעל תצוגת לובי לזכיות גדולות',

    // Section 6: Tips
    tipsTitle: 'טיפים חשובים',
    tip1: 'שמור על איזון - הרבה פרסים נפוצים, מעט אגדיים',
    tip2: 'פרסים אגדיים יוצרים התרגשות - שים שם משהו מיוחד!',
    tip3: 'מסך הלובי מציג רק זכיות אפיות ואגדיות',
    tip4: 'עקוב אחרי המלאי - כשפרס נגמר, המערכת בוחרת חלופה',
    tip5: 'אפשר לערוך פרסים בכל עת בלי לפגוע במי שכבר זכה',

    // Section 7: Lobby
    lobbyTitle: 'מסך לובי',
    lobbyDesc: 'מסך הלובי מיועד להצגה על מסך גדול בכניסה או בלובי. הוא מציג בזמן אמת כל זכייה אפית או אגדית עם אנימציית חגיגה.',
    lobbyUrl: 'כתובת הלובי:',
    lobbyUrlExample: '/lobby/{routeId}',

    close: 'הבנתי!',
  },
  en: {
    title: 'Prize System Guide',
    subtitle: 'Everything you need to know about setting up and managing prizes',

    // Section 1: Overview
    overviewTitle: 'Overview',
    overviewDesc: 'The prize system allows visitors to win real prizes during the game. The system works like "pack opening" in FIFA or Brawl Stars games.',

    // Section 2: How it works
    howItWorksTitle: 'How Does It Work?',
    step1Title: 'Earn XP',
    step1Desc: 'Visitors earn XP by scanning codes (+10 XP) and uploading photos (+25 XP)',
    step2Title: 'Level Up',
    step2Desc: 'When a visitor earns enough XP, they level up and receive a pack',
    step3Title: 'Open Pack',
    step3Desc: 'The visitor taps the pack and receives a random prize from the lottery',
    step4Title: 'Claim Prize',
    step4Desc: 'The prize is shown and the visitor can redeem it at the reception',

    // Section 3: Levels
    levelsTitle: 'Levels and XP Requirements',
    levelBeginner: 'Beginner',
    levelExplorer: 'Explorer',
    levelExpert: 'Expert',
    levelChampion: 'Champion',
    xpRequired: 'Required: {xp} XP',
    packReward: 'Reward: One pack',

    // Section 4: Rarity
    rarityTitle: 'Rarity Levels',
    rarityDesc: 'Each prize belongs to one of four rarity levels:',
    dropRateLabel: 'Recommended drop rate',

    // Section 5: Setup
    setupTitle: 'Setting Up Prizes',
    setupStep1: 'Enable the prize system in route settings',
    setupStep2: 'Click "Manage Prizes" to add prizes',
    setupStep3: 'Add prizes with name, rarity, and quantity',
    setupStep4: 'Adjust drop rates (total should be 100%)',
    setupStep5: 'Optional: Enable lobby display for big wins',

    // Section 6: Tips
    tipsTitle: 'Important Tips',
    tip1: 'Keep balance - many common prizes, few legendary ones',
    tip2: 'Legendary prizes create excitement - put something special there!',
    tip3: 'The lobby screen only shows epic and legendary wins',
    tip4: 'Track inventory - when a prize runs out, the system picks an alternative',
    tip5: 'You can edit prizes anytime without affecting previous winners',

    // Section 7: Lobby
    lobbyTitle: 'Lobby Screen',
    lobbyDesc: 'The lobby screen is designed for display on a big screen at the entrance or lobby. It shows in real-time every epic or legendary win with a celebration animation.',
    lobbyUrl: 'Lobby URL:',
    lobbyUrlExample: '/lobby/{routeId}',

    close: 'Got it!',
  },
};

const LEVELS = [
  { name: 'beginner', emoji: '🌱', xp: 0, nextXp: 50 },
  { name: 'explorer', emoji: '🧭', xp: 50, nextXp: 150 },
  { name: 'expert', emoji: '⭐', xp: 150, nextXp: 300 },
  { name: 'champion', emoji: '🏆', xp: 300, nextXp: null },
];

export default function PrizeSystemGuideModal({
  isOpen,
  onClose,
  locale = 'he',
}: PrizeSystemGuideModalProps) {
  const t = translations[locale];
  const isRTL = locale === 'he';

  if (!isOpen) return null;

  const rarities = ['common', 'rare', 'epic', 'legendary'] as const;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg-primary rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-purple-600/20 to-pink-600/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/20">
              <Gift className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-primary">{t.title}</h2>
              <p className="text-sm text-text-secondary">{t.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-bg-secondary transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Section 1: Overview */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-semibold text-text-primary">{t.overviewTitle}</h3>
            </div>
            <p className="text-text-secondary leading-relaxed">{t.overviewDesc}</p>
          </section>

          {/* Section 2: How it works */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-semibold text-text-primary">{t.howItWorksTitle}</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: '🎯', title: t.step1Title, desc: t.step1Desc },
                { icon: '⬆️', title: t.step2Title, desc: t.step2Desc },
                { icon: '🎁', title: t.step3Title, desc: t.step3Desc },
                { icon: '✅', title: t.step4Title, desc: t.step4Desc },
              ].map((step, i) => (
                <div key={i} className="p-3 rounded-xl bg-bg-secondary border border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{step.icon}</span>
                    <span className="font-medium text-text-primary">{step.title}</span>
                  </div>
                  <p className="text-xs text-text-secondary">{step.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 3: Levels */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-semibold text-text-primary">{t.levelsTitle}</h3>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {LEVELS.map((level, i) => (
                <div
                  key={level.name}
                  className="p-3 rounded-xl bg-bg-secondary border border-border text-center"
                >
                  <div className="text-3xl mb-1">{level.emoji}</div>
                  <div className="text-sm font-medium text-text-primary">
                    {t[`level${level.name.charAt(0).toUpperCase() + level.name.slice(1)}` as keyof typeof t]}
                  </div>
                  <div className="text-xs text-text-secondary mt-1">
                    {level.nextXp ? t.xpRequired.replace('{xp}', String(level.nextXp)) : '🎉'}
                  </div>
                  {i > 0 && (
                    <div className="text-xs text-purple-400 mt-1">
                      {t.packReward}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Section 4: Rarity */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400" />
              <h3 className="text-lg font-semibold text-text-primary">{t.rarityTitle}</h3>
            </div>
            <p className="text-sm text-text-secondary">{t.rarityDesc}</p>
            <div className="grid grid-cols-2 gap-3">
              {rarities.map((rarity) => {
                const config = RARITY_CONFIG[rarity];
                return (
                  <div
                    key={rarity}
                    className="p-3 rounded-xl border"
                    style={{
                      backgroundColor: `${config.bgColor}20`,
                      borderColor: `${config.color}50`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{config.emoji}</span>
                      <div>
                        <div className="font-medium" style={{ color: config.color }}>
                          {locale === 'he' ? config.name : config.nameEn}
                        </div>
                        <div className="text-xs text-text-secondary">
                          {t.dropRateLabel}: {DEFAULT_DROP_RATES[rarity]}%
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Section 5: Setup */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Percent className="w-5 h-5 text-green-400" />
              <h3 className="text-lg font-semibold text-text-primary">{t.setupTitle}</h3>
            </div>
            <ol className="space-y-2">
              {[t.setupStep1, t.setupStep2, t.setupStep3, t.setupStep4, t.setupStep5].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-sm font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="text-text-secondary text-sm">{step}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* Section 6: Tips */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-semibold text-text-primary">{t.tipsTitle}</h3>
            </div>
            <div className="space-y-2">
              {[t.tip1, t.tip2, t.tip3, t.tip4, t.tip5].map((tip, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <span className="text-amber-400">💡</span>
                  <span className="text-sm text-text-secondary">{tip}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Section 7: Lobby */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-semibold text-text-primary">{t.lobbyTitle}</h3>
            </div>
            <p className="text-sm text-text-secondary">{t.lobbyDesc}</p>
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <span className="text-sm text-text-secondary">{t.lobbyUrl}</span>
              <code className="block mt-1 text-purple-400 font-mono text-sm">
                {t.lobbyUrlExample}
              </code>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold hover:from-purple-500 hover:to-pink-500 transition-all"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}
