// SVG path data for lucide icons (24x24 viewBox)
// Used for rendering icons on canvas when downloading QR codes

export const ICON_PATHS: Record<string, { path: string; fill?: boolean }> = {
  Star: {
    path: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    fill: true,
  },
  Heart: {
    path: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
    fill: true,
  },
  Home: {
    path: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  },
  User: {
    path: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  },
  Mail: {
    path: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6',
  },
  Phone: {
    path: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
  },
  Camera: {
    path: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  },
  Music: {
    path: 'M9 18V5l12-2v13 M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  },
  Gift: {
    path: 'M20 12v10H4V12 M2 7h20v5H2z M12 22V7 M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
  },
  Crown: {
    path: 'M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z M2 17h20v3H2z',
    fill: true,
  },
  Zap: {
    path: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
    fill: true,
  },
  Sun: {
    path: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M12 1v2 M12 21v2 M4.22 4.22l1.42 1.42 M18.36 18.36l1.42 1.42 M1 12h2 M21 12h2 M4.22 19.78l1.42-1.42 M18.36 5.64l1.42-1.42',
  },
  Moon: {
    path: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
    fill: true,
  },
  Coffee: {
    path: 'M18 8h1a4 4 0 0 1 0 8h-1 M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z M6 1v3 M10 1v3 M14 1v3',
  },
  Smile: {
    path: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M8 14s1.5 2 4 2 4-2 4-2 M9 9h.01 M15 9h.01',
  },
  ThumbsUp: {
    path: 'M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3',
  },
  Award: {
    path: 'M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M8.21 13.89L7 23l5-3 5 3-1.21-9.12',
  },
  Bookmark: {
    path: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
    fill: true,
  },
  Bell: {
    path: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0',
  },
  Shield: {
    path: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    fill: true,
  },
};

// Icon names for display in the picker
export const ICON_NAMES = Object.keys(ICON_PATHS);

// Hebrew labels for icons
export const ICON_LABELS: Record<string, string> = {
  Star: 'כוכב',
  Heart: 'לב',
  Home: 'בית',
  User: 'משתמש',
  Mail: 'מייל',
  Phone: 'טלפון',
  Camera: 'מצלמה',
  Music: 'מוזיקה',
  Gift: 'מתנה',
  Crown: 'כתר',
  Zap: 'ברק',
  Sun: 'שמש',
  Moon: 'ירח',
  Coffee: 'קפה',
  Smile: 'חיוך',
  ThumbsUp: 'לייק',
  Award: 'פרס',
  Bookmark: 'סימניה',
  Bell: 'פעמון',
  Shield: 'מגן',
};

// Popular emojis for the picker
export const EMOJI_OPTIONS = [
  '⭐', '❤️', '🏠', '👤', '✉️', '📱', '📷', '🎵',
  '🎁', '👑', '⚡', '☀️', '🌙', '☕', '😊', '👍',
  '🎉', '🔥', '💎', '🌟', '💪', '🎯', '🚀', '💡',
];
