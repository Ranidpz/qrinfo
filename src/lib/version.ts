// App version - update this when making important changes
export const APP_VERSION = '1.1.0';

// Changelog for user notifications
export interface VersionUpdate {
  version: string;
  date: string;
  highlights: string[]; // Short marketing-style bullet points
  isNew?: boolean;
}

export const CHANGELOG: VersionUpdate[] = [
  {
    version: '1.1.0',
    date: '2025-12-07',
    highlights: [
      '🔒 אבטחה משופרת - הגנה מפני התקפות XSS',
      '⚡ יציבות מוגברת - תור העלאות חכם עם retry אוטומטי',
      '🚀 ביצועים משופרים - טעינה הדרגתית בגלריה',
      '🛡️ Rate Limiting - הגנה מפני עומס יתר',
    ],
  },
  {
    version: '1.0.0',
    date: '2025-01-01',
    highlights: [
      '🎉 השקה ראשונה!',
      '📱 קודי QR דינמיים עם מדיה',
      '📅 תזמון תוכן חכם',
      '📊 אנליטיקס בזמן אמת',
    ],
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
