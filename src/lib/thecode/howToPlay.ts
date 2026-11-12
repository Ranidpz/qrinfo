// הקוד — "איך משחקים": the short rules a family can open from any screen.
// PURE: shared by the server (snapshot / lookup), the operator admin (placeholder +
// "restore default") and the player app. The operator may replace the lines with their
// own (`TheCodeConfig.howToPlay`); otherwise the default below is built from the
// adventure's real rules, so the numbers on screen are always the numbers in play.

import type { TheCodeConfig, TheCodeLanguage, TheCodeRules } from '@/types/thecode';

export const HOW_TO_PLAY_LIMITS = { lines: 8, line: 160 } as const;

/** Default rules text for an adventure, in plain words a child can follow. */
export function defaultHowToPlay(rules: TheCodeRules, language: TheCodeLanguage = 'he'): string[] {
  if (language === 'en') {
    return [
      'Gnomes are hiding all around you. Each one guards a letter of a secret phrase.',
      'The game sends you to one gnome at a time with a clue to where it stands. Look closely at the colours: only the right gnome counts.',
      'Scan the right gnome and you get a riddle. Tap the FIRST letter of the answer.',
      `Every correct letter is worth ${rules.pointsPerLetter} points. ${rules.hotStreakAt} in a row and you are on fire: points ×${rules.hotMultiplier}.`,
      `Stuck? Take a hint (${rules.hintCost} points). A wrong gnome or a wrong letter may cost a few points.`,
      `Collected every letter? Put them in order, crack the phrase and open the suitcase for ${rules.suitcaseBonus} more points.`,
      'There is no clock — play at your own pace. Your progress is saved on this phone.',
    ];
  }
  return [
    'מסביבכם מסתתרים גמדים. כל גמד שומר על אות אחת מתוך משפט סודי.',
    'המשחק שולח אתכם לגמד אחד בכל פעם, עם רמז איפה הוא עומד. הסתכלו טוב על הצבעים — רק הגמד הנכון נחשב.',
    'סרקו את הגמד הנכון וקבלו חידה. הקישו על האות הראשונה של התשובה.',
    `כל אות נכונה שווה ${rules.pointsPerLetter} נקודות. ${rules.hotStreakAt} תשובות נכונות ברצף ואתם שחקנים חמים: הנקודות ×${rules.hotMultiplier}.`,
    `נתקעתם? קחו רמז (${rules.hintCost} נקודות). גמד לא נכון או אות לא נכונה עלולים לעלות בכמה נקודות.`,
    `אספתם את כל האותיות? סדרו אותן, פצחו את המשפט ופתחו את המזוודה — ועוד ${rules.suitcaseBonus} נקודות.`,
    'אין שעון ואין לחץ — משחקים בקצב שלכם. ההתקדמות נשמרת בטלפון.',
  ];
}

/** What families see: the operator's own lines, or the default built from the rules. */
export function resolveHowToPlay(
  config: Pick<TheCodeConfig, 'howToPlay' | 'language'>,
  rules: TheCodeRules
): string[] {
  const own = (config.howToPlay || []).map((l) => l.trim()).filter(Boolean);
  return own.length ? own.slice(0, HOW_TO_PLAY_LIMITS.lines) : defaultHowToPlay(rules, config.language);
}
