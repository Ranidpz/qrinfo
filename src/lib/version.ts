// App version - update this when making important changes
export const APP_VERSION = '1.12.10';

// Changelog for user notifications
export interface VersionUpdate {
  version: string;
  date: string;
  highlights: {
    he: string[];
    en: string[];
  };
  isNew?: boolean;
}

export const CHANGELOG: VersionUpdate[] = [
  {
    version: '1.12.10',
    date: '2026-02-13',
    isNew: true,
    highlights: {
      he: [
        'כרטיסי אורחים מתרחבים גם בדף הסורק',
        'חיפוש אורחים לפי טלפון ושמות +1 בסורק',
      ],
      en: [
        'Expandable guest cards in scanner page',
        'Search by phone and +1 names in scanner',
      ],
    },
  },
  {
    version: '1.12.9',
    date: '2026-02-13',
    highlights: {
      he: [
        'שיפור חוויית שחזור QR - הודעה ברורה אם הטלפון נמצא או לא',
      ],
      en: [
        'Improved QR recovery UX - clear feedback if phone is found or not',
      ],
    },
  },
  {
    version: '1.12.8',
    date: '2026-02-13',
    highlights: {
      he: [
        'כפתור "כבר נרשמתי" - שליחה חוזרת של QR לוואטסאפ לפי טלפון',
      ],
      en: [
        '"Already registered?" button - resend QR to WhatsApp by phone',
      ],
    },
  },
  {
    version: '1.12.7',
    date: '2026-02-13',
    highlights: {
      he: [
        'רשימת אורחים - כרטיסים מתרחבים בלחיצה עם פרטי +1, פעולות ומחיקה',
        'חיפוש אורחים לפי טלפון ושמות +1',
        'זיכרון אורח חוזר - QR זמין מיד בכניסה חוזרת לדף',
        'מסך הצלחה - שם אירוע, תאריך, שעה וניווט בוויז',
      ],
      en: [
        'Guest list - expandable cards with +1 details, actions and delete',
        'Search guests by phone and +1 names',
        'Returning guest memory - QR available immediately on revisit',
        'Success screen - event name, date, time and Waze navigation',
      ],
    },
  },
  {
    version: '1.12.6',
    date: '2026-02-13',
    highlights: {
      he: [
        'תיקון הרשמת אורחים - אורח נוצר רק אחרי אימות טלפון בוואטסאפ',
        'אבטחה: ולידציה על קלט הרשמה + הסרת פרטי שגיאה מתשובות API',
      ],
      en: [
        'Fix guest registration - guest created only after WhatsApp phone verification',
        'Security: input validation on registration + removed error details from API responses',
      ],
    },
  },
  {
    version: '1.12.5',
    date: '2026-02-13',
    highlights: {
      he: [
        'כפתור ביטול צ׳ק-אין בסורק Q.Tag',
        'תיקון ייצוא אקסל ברשימת אורחים Q.Tag',
      ],
      en: [
        'Undo check-in button in Q.Tag scanner',
        'Fixed Q.Tag guest list Excel export',
      ],
    },
  },
  {
    version: '1.12.3',
    date: '2026-02-13',
    highlights: {
      he: [
        'תיקון צ׳ק-אין בסורק Q.Tag',
      ],
      en: [
        'Fixed Q.Tag scanner check-in',
      ],
    },
  },
  {
    version: '1.12.2',
    date: '2026-02-13',
    highlights: {
      he: [
        'סורק Q.Tag - פס פיצול נגרר בין המצלמה לרשימה בדסקטופ',
        'מלבן כיוון QR מותאם אוטומטית לגודל הפאנל',
      ],
      en: [
        'Q.Tag scanner - draggable split divider between camera and list on desktop',
        'QR viewfinder auto-adapts to panel size',
      ],
    },
  },
  {
    version: '1.12.1',
    date: '2026-02-13',
    highlights: {
      he: [
        'תיקון העלאת תמונות גדולות - דחיסה אוטומטית בצד הלקוח',
        'סורק Q.Tag בתצוגת מסך מפוצל בדסקטופ',
        'תמונת OG מותאמת לכל Q.Tag',
        'תיקון תרגומים חסרים ב-Q.Tag',
      ],
      en: [
        'Fixed large image uploads - automatic client-side compression',
        'Q.Tag scanner in split-screen view on desktop',
        'Custom OG image per Q.Tag',
        'Fixed missing Q.Tag translations',
      ],
    },
  },
  {
    version: '1.12.0',
    date: '2026-02-13',
    highlights: {
      he: [
        'Q.Tag - מערכת רישום והזמנות לאירועים עם QR',
        'שליחת QR בוואטסאפ אוטומטית אחרי הרשמה',
        'סורק כניסה עם PIN וקוד QR',
        'הוספת אורחים מהירה מהסורק',
        'אבטחה מוגברת - הרשאות על כל API routes',
      ],
      en: [
        'Q.Tag - Event registration & invitation system with QR',
        'Automatic WhatsApp QR delivery after registration',
        'Entry scanner with PIN and QR code',
        'Quick-add guests from scanner',
        'Enhanced security - auth on all API routes',
      ],
    },
  },
  {
    version: '1.8.0',
    date: '2026-01-05',
    highlights: {
      he: [
        'דף נחיתה שיווקי חדש עם עיצוב מינימליסטי',
        'עמוד תמחור - מנויים ואירועים חד-פעמיים',
        'לוגו Q אינטראקטיבי עם אפקט הובר',
        'מותאם מושלם למובייל - כל הסקשנים רספונסיביים',
        'קישור לסיידבר מדף הנחיתה',
      ],
      en: [
        'New marketing landing page with minimalist design',
        'Pricing page - subscriptions and one-time events',
        'Interactive Q logo with hover effect',
        'Perfect mobile responsiveness - all sections responsive',
        'Sidebar link from landing page',
      ],
    },
  },
  {
    version: '1.7.0',
    date: '2025-12-11',
    highlights: {
      he: [
        'Q.Vote - מערכת הצבעות דיגיטלית עם דף נחיתה מעוצב',
        'Q.Cal - תכנון ימים ושעות עם RSVP',
        'דף נחיתה מותאם אישית עם תמונה, כותרת וכפתור',
        'תצוגת טלפון בזמן אמת בעורך המיתוג',
        'דחיסת תמונות אוטומטית ל-WebP',
        'Analytics משופר עם סקשן RSVP',
      ],
      en: [
        'Q.Vote - Digital voting system with branded landing page',
        'Q.Cal - Day/time planning with RSVP',
        'Custom landing page with image, title and button',
        'Real-time phone preview in branding editor',
        'Automatic image compression to WebP',
        'Improved Analytics with RSVP section',
      ],
    },
  },
  {
    version: '1.6.3',
    date: '2025-12-10',
    highlights: {
      he: [
        'מודל תצוגה מקדימה רספונסיבי במובייל',
      ],
      en: [
        'Responsive mobile preview modal',
      ],
    },
  },
  {
    version: '1.6.2',
    date: '2025-12-10',
    highlights: {
      he: [
        'שיפורים בלוגו ודף התחברות',
      ],
      en: [
        'Logo and login page improvements',
      ],
    },
  },
  {
    version: '1.6.1',
    date: '2025-12-10',
    highlights: {
      he: [
        'תיקון הבהוב מסך לבן בטעינת PDF',
        'עדכון לוגו לtheQ',
      ],
      en: [
        'Fix white screen flash during PDF loading',
        'Update logo to theQ',
      ],
    },
  },
  {
    version: '1.6.0',
    date: '2025-12-10',
    highlights: {
      he: [
        'מסך לובי משופר',
        'דף פאקים חדש',
      ],
      en: [
        'Improved lobby screen',
        'New packs page',
      ],
    },
  },
  {
    version: '1.5.2',
    date: '2025-12-09',
    highlights: {
      he: [
        'תיקון באנר עוגיות - תמיכה בעברית ואנגלית',
      ],
      en: [
        'Fixed cookie consent banner - Hebrew and English support',
      ],
    },
  },
  {
    version: '1.5.1',
    date: '2025-12-09',
    highlights: {
      he: [
        'תיקון דפי פרטיות ונגישות - תמיכה בעברית ואנגלית',
      ],
      en: [
        'Fixed privacy and accessibility pages - Hebrew and English support',
      ],
    },
  },
  {
    version: '1.5.0',
    date: '2025-12-09',
    highlights: {
      he: [
        'מערכת פרסים והגרלות - פאקים עם פרסים!',
        'מסך לובי להצגת זוכים',
        'דפים משפטיים - נגישות ופרטיות',
        'באדג XP משופר עם גדלים רספונסיביים',
        'טולטיפים על כפתורי יצירת חוויה',
      ],
      en: [
        'Prize and lottery system - packs with prizes!',
        'Lobby screen for displaying winners',
        'Legal pages - accessibility and privacy',
        'Improved XP badge with responsive sizes',
        'Tooltips on experience creation buttons',
      ],
    },
  },
  {
    version: '1.4.5',
    date: '2025-12-08',
    highlights: {
      he: [
        'תיקון הרשאות Firebase למבקרים וגיימיפיקציה',
        'תיקון צבע טקסט במודל הרשמה',
      ],
      en: [
        'Fixed Firebase permissions for visitors and gamification',
        'Fixed text color in registration modal',
      ],
    },
  },
  {
    version: '1.4.4',
    date: '2025-12-08',
    highlights: {
      he: [
        'תיקון קריטי: folderId עובר נכון לתצוגת חידה',
        'באדג XP על כרטיס קוד שנמצא במסלול',
        'אינדיקטור "מסלול XP פעיל" בתצוגת חידה',
      ],
      en: [
        'Critical fix: folderId correctly passed to riddle viewer',
        'XP badge on code card when in route',
        '"XP Route Active" indicator in riddle view',
      ],
    },
  },
  {
    version: '1.4.3',
    date: '2025-12-08',
    highlights: {
      he: [
        'תיקון מערכת XP - גיימיפיקציה עובדת בכתבי חידה במסלולים',
        'סליידרים משופרים בהגדרות מסלול',
      ],
      en: [
        'Fixed XP system - gamification works in riddles on routes',
        'Improved sliders in route settings',
      ],
    },
  },
  {
    version: '1.4.2',
    date: '2025-12-08',
    highlights: {
      he: [
        'תצוגת רשימה אוטומטית במובייל, גריד בדסקטופ',
      ],
      en: [
        'Automatic list view on mobile, grid on desktop',
      ],
    },
  },
  {
    version: '1.4.1',
    date: '2025-12-08',
    highlights: {
      he: [
        'תיקון תצוגת האדר מעל הסיידבר בדסקטופ',
        'שיפור מיקום לוגו עם תמיכה בכיוון RTL/LTR',
      ],
      en: [
        'Fixed header display above sidebar on desktop',
        'Improved logo positioning with RTL/LTR support',
      ],
    },
  },
  {
    version: '1.4.0',
    date: '2025-12-08',
    highlights: {
      he: [
        'מערכת XP וגיימיפיקציה לכתבי חידה!',
        'מסלולים עם נקודות XP ורמות',
        'לידרבורד בזמן אמת',
        'באדג XP על כפתור כתב חידה',
        'הגדרות מסלול על תיקיות',
      ],
      en: [
        'XP and gamification system for riddles!',
        'Routes with XP points and levels',
        'Real-time leaderboard',
        'XP badge on riddle button',
        'Route settings on folders',
      ],
    },
  },
  {
    version: '1.3.4',
    date: '2025-12-08',
    highlights: {
      he: [
        'לייאאוט מושלם RTL/LTR - האדר וסיידבר מותאמים לכל שפה',
        'לוגו תמיד בצד הנגדי לסיידבר (מובייל ודסקטופ)',
        'המבורגר תמיד בצד הסיידבר במובייל',
        'תיקון רווח שחור במובייל עברית',
      ],
      en: [
        'Perfect RTL/LTR layout - header and sidebar adapted per language',
        'Logo always on opposite side of sidebar (mobile & desktop)',
        'Hamburger always near sidebar on mobile',
        'Fixed black gap on Hebrew mobile',
      ],
    },
  },
  {
    version: '1.3.3',
    date: '2025-12-08',
    highlights: {
      he: [
        'תיקון לייאאוט RTL/LTR - סיידבר והאדר מותאמים לכל שפה',
        'לוגו בהאדר בצד הנגדי לסיידבר בכל התצורות',
        'תיקון רווח שחור במובייל עברית',
        'המבורגר ליד הסיידבר בכל שפה',
      ],
      en: [
        'Fixed RTL/LTR layout - sidebar and header adapted per language',
        'Header logo on opposite side of sidebar in all views',
        'Fixed black gap on Hebrew mobile',
        'Hamburger menu near sidebar in all languages',
      ],
    },
  },
  {
    version: '1.3.2',
    date: '2025-12-07',
    highlights: {
      he: [
        'ממשק מותאם לסלולר - תצוגה משופרת בעורך הקוד',
        'דפים ציבוריים מתורגמים לפי שפת הדפדפן',
        'תיקון תזמון מדיה לסלולר',
        'תיקון תפריט עברית/אנגלית בנייד',
      ],
      en: [
        'Mobile-optimized interface - improved code editor display',
        'Public pages translated by browser language',
        'Fixed media scheduling for mobile',
        'Fixed language menu on mobile',
      ],
    },
  },
  {
    version: '1.3.1',
    date: '2025-12-07',
    highlights: {
      he: [
        'תמיכה מלאה בשפות - עברית ואנגלית',
        'התראות לפי שפה - כל שפה רואה את ההתראות שלה',
        'תיקוני תרגום וממשק משופר',
      ],
      en: [
        'Full language support - Hebrew and English',
        'Locale-based notifications - each language sees its own notifications',
        'Translation fixes and improved interface',
      ],
    },
  },
  {
    version: '1.3.0',
    date: '2025-12-07',
    highlights: {
      he: [
        'גרירת קבצים על כרטיסים וקודים - החלפה מהירה',
        'שם קובץ מקורי נשמר ומוצג',
        'מספר עמודים ב-PDF מוצג אוטומטית',
        'תזמון חכם - מילוי אוטומטי של תאריכים ושעות',
        'צבע ירוק/אדום לסטטוס תזמון פעיל/לא פעיל',
      ],
      en: [
        'Drag files to cards and codes - quick replacement',
        'Original filename saved and displayed',
        'PDF page count displayed automatically',
        'Smart scheduling - auto-fill dates and times',
        'Green/red color for active/inactive schedule status',
      ],
    },
  },
  {
    version: '1.2.0',
    date: '2025-12-07',
    highlights: {
      he: [
        'העברת בעלות משופרת - תיקיות עוברות עם הקבצים',
        'מנהל על רואה את כל התיקיות וקודים',
        'סינון "My Q" לעומת "הכל" עובד נכון עם תיקיות',
        'שם הבעלים מוצג על תיקיות של משתמשים אחרים',
      ],
      en: [
        'Improved ownership transfer - folders move with files',
        'Super admin sees all folders and codes',
        '"My Q" vs "All" filter works correctly with folders',
        'Owner name shown on other users\' folders',
      ],
    },
  },
  {
    version: '1.1.0',
    date: '2025-12-07',
    highlights: {
      he: [
        'אבטחה משופרת - הגנה מפני התקפות XSS',
        'יציבות מוגברת - תור העלאות חכם עם retry אוטומטי',
        'ביצועים משופרים - טעינה הדרגתית בגלריה',
        'Rate Limiting - הגנה מפני עומס יתר',
      ],
      en: [
        'Enhanced security - XSS attack protection',
        'Improved stability - smart upload queue with auto-retry',
        'Better performance - gradual gallery loading',
        'Rate Limiting - overload protection',
      ],
    },
  },
  {
    version: '1.0.0',
    date: '2025-01-01',
    highlights: {
      he: [
        'השקה ראשונה!',
        'קודי QR דינמיים עם מדיה',
        'תזמון תוכן חכם',
        'אנליטיקס בזמן אמת',
      ],
      en: [
        'First launch!',
        'Dynamic QR codes with media',
        'Smart content scheduling',
        'Real-time analytics',
      ],
    },
  },
];

// Get the latest version update
export function getLatestUpdate(): VersionUpdate {
  return CHANGELOG[0];
}

// Check if there's a new version since user's last seen version
export function hasNewVersion(lastSeenVersion: string | null): boolean {
  if (!lastSeenVersion) return true;
  return lastSeenVersion !== APP_VERSION;
}
