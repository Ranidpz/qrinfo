// App version - update this when making important changes
export const APP_VERSION = '1.3.2';

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
