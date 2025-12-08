// Translations for public pages (outside [locale] routes)
// These detect browser language and provide appropriate translations

export type PublicLocale = 'he' | 'en';

export function getBrowserLocale(): PublicLocale {
  if (typeof window === 'undefined') return 'he'; // Default for SSR

  const browserLang = navigator.language || (navigator as { userLanguage?: string }).userLanguage || 'he';
  return browserLang.startsWith('he') ? 'he' : 'en';
}

// Viewer page translations
export const viewerTranslations = {
  he: {
    loadingContent: 'טוען תוכן...',
    loadingDocument: 'טוען מסמך...',
    processingPages: 'מעבד {count} עמודים...',
    preparingDisplay: 'מכין תצוגה...',
    almostThere: 'כמעט שם...',
    ready: 'מוכן!',
    noContent: 'אין תוכן להצגה',
    openLink: 'פתח לינק',
    page: 'עמוד',
    previous: 'הקודם',
    next: 'הבא',
  },
  en: {
    loadingContent: 'Loading content...',
    loadingDocument: 'Loading document...',
    processingPages: 'Processing {count} pages...',
    preparingDisplay: 'Preparing display...',
    almostThere: 'Almost there...',
    ready: 'Ready!',
    noContent: 'No content to display',
    openLink: 'Open link',
    page: 'Page',
    previous: 'Previous',
    next: 'Next',
  },
};

// Gallery page translations
export const galleryTranslations = {
  he: {
    anonymous: 'אנונימי',
    galleryEmpty: 'הגלריה ריקה',
    noImagesYet: 'עדיין אין תמונות בגלריה הזו',
    backToPage: 'חזרה לדף',
    loadMoreImages: 'טען עוד תמונות',
    remaining: 'נותרו',
    images: 'תמונות',
    deleteAllGallery: 'מחק את כל הגלריה?',
    deleteAllWarning: 'פעולה זו תמחק את כל {count} התמונות בגלריה.',
    cannotUndo: 'לא ניתן לבטל פעולה זו.',
    cancel: 'ביטול',
    deleteAll: 'מחק הכל',
    ctrlHint: 'לחץ על {key} להסתרת/הצגת התפריט',
    staticView: 'תצוגה רגילה',
    autoScroll: 'גלילה אוטומטית',
    shuffleMode: 'מצב רנדומלי',
    columns: 'עמודות',
    showNames: 'שמות',
    movement: 'תנועה',
    latest: 'אחרונות',
    all: 'הכל',
    roundCorners: 'עיגול',
    names: 'שמות',
    columnCount: 'מספר עמודות',
    showNamesOnImages: 'הצג שמות על התמונות',
    subtleMotion: 'אפקט תנועה קלה',
    showNewBadge: 'הצג תג NEW על תמונות חדשות',
    imageCount: 'כמות תמונות להצגה',
    cornerRadius: 'עיגול פינות התמונות',
    nameTextSize: 'גודל הטקסט של השמות',
    deleteAllImages: 'מחק את כל התמונות',
    enterName: 'הזן שם...',
  },
  en: {
    anonymous: 'Anonymous',
    galleryEmpty: 'Gallery is empty',
    noImagesYet: 'No images in this gallery yet',
    backToPage: 'Back to page',
    loadMoreImages: 'Load more images',
    remaining: 'remaining',
    images: 'images',
    deleteAllGallery: 'Delete entire gallery?',
    deleteAllWarning: 'This will delete all {count} images in the gallery.',
    cannotUndo: 'This action cannot be undone.',
    cancel: 'Cancel',
    deleteAll: 'Delete all',
    ctrlHint: 'Press {key} to hide/show menu',
    staticView: 'Static view',
    autoScroll: 'Auto scroll',
    shuffleMode: 'Shuffle mode',
    columns: 'Columns',
    showNames: 'Names',
    movement: 'Motion',
    latest: 'Latest',
    all: 'All',
    roundCorners: 'Round',
    names: 'Names',
    columnCount: 'Number of columns',
    showNamesOnImages: 'Show names on images',
    subtleMotion: 'Subtle motion effect',
    showNewBadge: 'Show NEW badge on new images',
    imageCount: 'Number of images to display',
    cornerRadius: 'Image corner radius',
    nameTextSize: 'Name text size',
    deleteAllImages: 'Delete all images',
    enterName: 'Enter name...',
  },
};

// Upload (Riddle/Selfiebeam) translations
export const uploadTranslations = {
  he: {
    uploading: 'מעלה...',
    uploaded: 'הועלה!',
    error: 'שגיאה',
    maxReached: 'הגעת למקסימום',
    takePhoto: 'צלמו כאן',
    enterYourName: 'הזן את שמך',
    nameWillAppear: 'השם יופיע ליד התמונה בגלריה',
    nameOrNickname: 'שם או כינוי...',
    cancel: 'ביטול',
    continue: 'המשך',
    anonymous: 'אנונימי',
  },
  en: {
    uploading: 'Uploading...',
    uploaded: 'Uploaded!',
    error: 'Error',
    maxReached: 'Max reached',
    takePhoto: 'Take photo',
    enterYourName: 'Enter your name',
    nameWillAppear: 'Your name will appear next to the photo in the gallery',
    nameOrNickname: 'Name or nickname...',
    cancel: 'Cancel',
    continue: 'Continue',
    anonymous: 'Anonymous',
  },
};

// Gamification / XP system translations (gender-neutral Hebrew - plural form)
export const gamificationTranslations = {
  he: {
    // Registration
    enterNickname: 'בחרו כינוי',
    nickname: 'כינוי',
    nicknamePlaceholder: 'השם שיוצג בלידרבורד',
    nicknameRequired: 'הכינוי הוא שדה חובה',
    nicknameTooShort: 'הכינוי קצר מדי (מינימום 2 תווים)',
    nicknameTooLong: 'הכינוי ארוך מדי (מקסימום 20 תווים)',

    // Consent
    consentTitle: 'הצטרפו למשחק!',
    consentText: 'בהשתתפות במשחק והעלאת תמונות, הנכם מאשרים את הצגת התמונות על מסכי המתחם ובערוצי המדיה של המפעיל.',
    agreeAndJoin: 'מסכימים ומצטרפים',
    mustAgree: 'יש לאשר את התנאים כדי להמשיך',

    // XP
    yourXP: 'הנקודות שלכם',
    xpEarned: 'קיבלתם',
    totalXP: 'סה"כ נקודות',

    // Levels (plural - gender neutral)
    levelBeginner: 'מתחילים',
    levelExplorer: 'חוקרים',
    levelExpert: 'מומחים',
    levelChampion: 'אלופים',

    // Leaderboard
    leaderboard: 'טבלת מובילים',
    yourRank: 'המיקום שלכם',
    noPlayers: 'עדיין אין משתתפים',
    rank: 'מיקום',
    player: 'שחקן',
    points: 'נקודות',

    // Route/Progress
    stationsVisited: 'תחנות שביקרתם',
    routeComplete: 'השלמתם את המסלול!',
    bonusUnlocked: 'בונוס נפתח!',
    progress: 'התקדמות',
    outOf: 'מתוך',

    // Actions
    editNickname: 'ערכו את הכינוי',
    saveChanges: 'שמרו שינויים',

    // XP hints
    firstScan: 'סריקה ראשונה!',
    photoUploaded: 'תמונה הועלתה!',
    xpToNextLevel: 'עוד {xp} XP לרמה הבאה',
    maxLevelReached: 'הגעתם לרמה הגבוהה ביותר!',
  },
  en: {
    // Registration
    enterNickname: 'Choose a nickname',
    nickname: 'Nickname',
    nicknamePlaceholder: 'Your name on the leaderboard',
    nicknameRequired: 'Nickname is required',
    nicknameTooShort: 'Nickname too short (minimum 2 characters)',
    nicknameTooLong: 'Nickname too long (maximum 20 characters)',

    // Consent
    consentTitle: 'Join the game!',
    consentText: 'By participating and uploading photos, you agree to display them on venue screens and operator media channels.',
    agreeAndJoin: 'Agree & Join',
    mustAgree: 'You must agree to the terms to continue',

    // XP
    yourXP: 'Your XP',
    xpEarned: 'You earned',
    totalXP: 'Total XP',

    // Levels
    levelBeginner: 'Beginner',
    levelExplorer: 'Explorer',
    levelExpert: 'Expert',
    levelChampion: 'Champion',

    // Leaderboard
    leaderboard: 'Leaderboard',
    yourRank: 'Your rank',
    noPlayers: 'No players yet',
    rank: 'Rank',
    player: 'Player',
    points: 'Points',

    // Route/Progress
    stationsVisited: 'Stations visited',
    routeComplete: 'Route complete!',
    bonusUnlocked: 'Bonus unlocked!',
    progress: 'Progress',
    outOf: 'out of',

    // Actions
    editNickname: 'Edit nickname',
    saveChanges: 'Save changes',

    // XP hints
    firstScan: 'First scan!',
    photoUploaded: 'Photo uploaded!',
    xpToNextLevel: '{xp} XP to next level',
    maxLevelReached: 'Max level reached!',
  },
};

// Hook for using translations in components (deprecated - use direct access instead)
// Components should use: const t = translations[locale] where locale comes from getBrowserLocale()
