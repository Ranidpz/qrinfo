import {
  BookOpen,
  CircleDot,
  CalendarDays,
  Camera,
  Cloud,
  Crosshair,
  Dices,
  Drama,
  FileText,
  Gamepad2,
  Gift,
  Link2,
  Map as MapIcon,
  Medal,
  Sparkles,
  Tag,
  Timer,
  Trophy,
  Vote,
  type LucideIcon,
} from 'lucide-react';
import type { Locale } from '@/i18n/config';

// "חוויות The Q" catalogue - every experience the platform offers, in one place. The hub page,
// the sitemap and the landing pages all read from here, so adding an experience = one entry.
// Only list what the dashboard really offers and is live in production.

export type ExperienceCategory = 'events' | 'engagement' | 'games' | 'tools' | 'rentals';

export const CATEGORIES: { id: ExperienceCategory; title: Record<Locale, string> }[] = [
  { id: 'events', title: { he: 'ניהול אירועים', en: 'Event management' } },
  { id: 'engagement', title: { he: 'השתתפות קהל', en: 'Audience engagement' } },
  { id: 'games', title: { he: 'משחקים', en: 'Games' } },
  { id: 'tools', title: { he: 'כלים', en: 'Tools' } },
  { id: 'rentals', title: { he: 'השכרת ציוד לאירועים', en: 'Event equipment for rent' } },
];

export type AddonId = 'buzzer';
export const ADDONS: Record<AddonId, Record<Locale, string>> = {
  buzzer: { he: 'באזר פיזי להשכרה', en: 'Physical buzzer for rent' },
};

export interface CatalogEntry {
  id: string; // the dashboard MediaType where there is one
  name: Record<Locale, string>;
  pitch: Record<Locale, string>; // one short, concrete line
  tags: Record<Locale, string>; // who it's for, e.g. "אירועים, ברים, מסיבות"
  icon: LucideIcon;
  category: ExperienceCategory;
  // Path of its landing page, after the locale ('/experiences/10-bool' -> /he/experiences/10-bool).
  // Absent = no page yet: the card offers to talk to us instead.
  landing?: string;
  externalUrl?: string; // a separate product with its own site
  demo?: string; // public, no-login demo
  addons?: AddonId[];
  // Full experience landing pages (under /experiences) only: link-preview image + sitemap date
  image?: string;
  updated?: string;
  // Cards without a page: override the default "talk to us" CTA + its prefilled WhatsApp message
  contact?: { cta: Record<Locale, string>; whatsapp: Record<Locale, string> };
}

export const CATALOG: CatalogEntry[] = [
  // ---------- Event management ----------
  {
    id: 'qtag',
    name: { he: 'Q.Tag – רישום וצ׳ק־אין', en: 'Q.Tag – Registration & check-in' },
    pitch: {
      he: 'רישום לאירוע, QR אישי בוואטסאפ וצ׳ק־אין מהיר בכניסה עם סורק.',
      en: 'Event registration, a personal QR on WhatsApp and fast check-in at the door.',
    },
    tags: { he: 'אירועים, כנסים, מתחמי בידור', en: 'Events, conferences, venues' },
    icon: Tag,
    category: 'events',
    landing: '/qtag',
  },
  {
    id: 'raffle',
    name: { he: 'הגרלה', en: 'Raffle' },
    pitch: {
      he: 'הגרלה דרמטית על המסך הגדול – גלגל או חשיפת קוד, פרס לכל זוכה וקונפטי.',
      en: 'A dramatic big-screen draw – a wheel or a code reveal, a prize per winner and confetti.',
    },
    tags: { he: 'אירועים, כנסים, ערבי חברה', en: 'Events, conferences, company nights' },
    icon: Gift,
    category: 'events',
    addons: ['buzzer'],
  },
  {
    id: 'weeklycal',
    name: { he: 'Q.Cal – לוח פעילויות', en: 'Q.Cal – Activity schedule' },
    pitch: {
      he: 'לוח פעילויות שבועי עם הרשמה לפעילויות – למלונות, לקייטנות ולמועדונים.',
      en: 'A weekly activity schedule with sign-ups – for hotels, camps and clubs.',
    },
    tags: { he: 'מלונות, קייטנות, חדרי כושר', en: 'Hotels, camps, gyms' },
    icon: CalendarDays,
    category: 'events',
  },

  // ---------- Audience engagement ----------
  {
    id: 'costume',
    name: { he: 'תחרות תחפושות', en: 'Costume competition' },
    pitch: {
      he: 'הצבעת קהל לתחרות תחפושות, עם רישום מתמודדים ותוצאות חיות.',
      en: 'Audience voting for a costume contest, with contestant sign-up and live results.',
    },
    tags: { he: 'פורים, מסיבות, בתי ספר', en: 'Purim, parties, schools' },
    icon: Drama,
    category: 'engagement',
    landing: '/costume-competition',
  },
  {
    id: 'qvote',
    name: { he: 'Q.Vote – הצבעות', en: 'Q.Vote – Voting' },
    pitch: {
      he: 'הצבעה דיגיטלית עם רישום ותוצאות – לתחרויות, לבחירות ולסקרים.',
      en: 'Digital voting with registration and results – for contests, elections and polls.',
    },
    tags: { he: 'אירועים, תחרויות, סקרים', en: 'Events, competitions, surveys' },
    icon: Vote,
    category: 'engagement',
  },
  {
    id: 'qstage',
    name: { he: 'Q.Stage – הצבעה על הבמה', en: 'Q.Stage – Live stage voting' },
    pitch: {
      he: 'הקהל מצביע מהטלפון והתוצאות עולות בזמן אמת על המסך הגדול.',
      en: 'The audience votes from their phones and the results rise live on the big screen.',
    },
    tags: { he: 'תחרויות כשרונות, דיבייטים, תחרויות', en: 'Talent shows, debates, competitions' },
    icon: Sparkles,
    category: 'engagement',
  },
  {
    id: 'selfiebeam',
    name: { he: 'סלפי בים', en: 'Selfie Beam' },
    pitch: {
      he: 'האורחים מצלמים סלפי והתמונות מתחלפות בפסיפס חי על המסך.',
      en: 'Guests snap selfies and the photos shuffle into a live mosaic on the big screen.',
    },
    tags: { he: 'אירועים, ברים, מסיבות', en: 'Events, bars, parties' },
    icon: Camera,
    category: 'engagement',
  },
  {
    id: 'wordcloud',
    name: { he: 'ענן מילים', en: 'Word cloud' },
    pitch: {
      he: 'הקהל שולח מילים מהטלפון והן נבנות לענן מילים חי.',
      en: 'The audience sends words from their phones and they build a live word cloud.',
    },
    tags: { he: 'כנסים, הרצאות, סדנאות', en: 'Conferences, talks, workshops' },
    icon: Cloud,
    category: 'engagement',
  },
  {
    id: 'riddle',
    name: { he: 'כתב חידה', en: 'Riddle page' },
    pitch: {
      he: 'דף חידה או משימה עם טקסט, תמונות וסרטון, והמשתתפים יכולים להעלות סלפי.',
      en: 'A riddle or task page with text, images and video, where players can add a selfie.',
    },
    tags: { he: 'מוזיאונים, תערוכות, מסעות', en: 'Museums, exhibitions, tours' },
    icon: FileText,
    category: 'engagement',
  },

  // ---------- Games ----------
  {
    id: 'tenbool',
    name: { he: '10 בול', en: '10 Bool' },
    pitch: {
      he: 'עוצרים את הטיימר בדיוק על 10.00. משחק תזמון קצר וממכר למסך גדול ולטלפון.',
      en: 'Stop the timer at exactly 10.00. A quick, addictive timing game for big screens and phones.',
    },
    tags: { he: 'כנסים, ימי הולדת, כיתות', en: 'Conferences, birthdays, classrooms' },
    icon: Timer,
    category: 'games',
    landing: '/experiences/10-bool',
    demo: '/play/10-bool?board=wins',
    addons: ['buzzer'],
    image: '/api/og/tenbool',
    updated: '2026-10-10',
  },
  {
    id: 'minigames',
    name: { he: 'Q.Games – משחקי 1 על 1', en: 'Q.Games – 1-on-1 games' },
    pitch: {
      he: 'משחקי 1 על 1 מהטלפון, עם לוח תוצאות חי על המסך הגדול.',
      en: '1-on-1 games on phones, with a live leaderboard on the big screen.',
    },
    tags: { he: 'אירועים, גיבושים, ברים ומסעדות', en: 'Events, team building, bars & restaurants' },
    icon: Gamepad2,
    category: 'games',
  },
  {
    id: 'qchallenge',
    name: { he: 'טריוויה', en: 'Trivia' },
    pitch: {
      he: 'טריוויה ארגונית עם שאלות, תשובות ולוח תוצאות בזמן אמת.',
      en: 'Company trivia with questions, answers and a live leaderboard.',
    },
    tags: { he: 'חברות, גיבושים, ימי עיון', en: 'Companies, team building, seminars' },
    icon: Trophy,
    category: 'games',
  },
  {
    id: 'qbet',
    name: { he: 'ניחוש תוצאה', en: 'Score prediction' },
    pitch: {
      he: 'ניחוש תוצאת משחק עם אימות בוואטסאפ, נעילה בשריקת הפתיחה ורשימת זוכים.',
      en: 'Predict a match score with WhatsApp verification, a lock at kickoff and a winners list.',
    },
    tags: { he: 'משחקי כדורגל, ברים, קהילות', en: 'Football matches, bars, communities' },
    icon: Dices,
    category: 'games',
  },
  {
    id: 'qtreasure',
    name: { he: 'ציד מטמון', en: 'Treasure hunt' },
    pitch: {
      he: 'ציד מטמון בתחנות, עם רמז וסרטון בכל תחנה.',
      en: 'A station-by-station treasure hunt, with a clue and a video at every stop.',
    },
    tags: { he: 'מסעות, ימי הולדת, סיורים', en: 'Tours, birthdays, adventures' },
    icon: MapIcon,
    category: 'games',
  },
  {
    id: 'qhunt',
    name: { he: 'Q.Hunt – מרוץ קודים', en: 'Q.Hunt – Code race' },
    pitch: {
      he: 'מפזרים קודי QR במתחם, והמשתתפים מתחרים מי יסרוק יותר.',
      en: 'QR codes scattered around the venue, and players race to scan the most.',
    },
    tags: { he: 'גיבושים, אירועים, תערוכות', en: 'Team building, events, exhibitions' },
    icon: Crosshair,
    category: 'games',
  },
  {
    id: 'oleague',
    name: { he: 'oLeague – ליגות וטורנירים', en: 'oLeague – Leagues & tournaments' },
    pitch: {
      he: 'ניהול ליגות וטורנירים באפליקציה ייעודית.',
      en: 'Run leagues and tournaments in a dedicated app.',
    },
    tags: { he: 'מועדונים, קהילות, ליגות', en: 'Clubs, communities, leagues' },
    icon: Medal,
    category: 'games',
    externalUrl: 'https://oleague.playzones.app/landing',
  },

  // ---------- Tools ----------
  {
    id: 'link',
    name: { he: 'לינק חכם', en: 'Smart link' },
    pitch: {
      he: 'קוד QR שפותח וואטסאפ, ניווט, תשלום או רשתות חברתיות – ומשתנה בלי להדפיס מחדש.',
      en: 'A QR code that opens WhatsApp, navigation, payment or social profiles – change it without reprinting.',
    },
    tags: { he: 'תפריטים, כרטיסי ביקור', en: 'Menus, business cards' },
    icon: Link2,
    category: 'tools',
  },
  {
    id: 'booklet',
    name: { he: 'חוברת דיגיטלית', en: 'Digital booklet' },
    pitch: {
      he: 'PDF שנפתח כחוברת עם דפדוף תלת־ממדי – לתפריטים, לקטלוגים ולמדריכים.',
      en: 'A PDF that opens as a 3D flip-book – for menus, catalogs and guides.',
    },
    tags: { he: 'קטלוגים, מדריכים, תפריטים', en: 'Catalogs, guides, menus' },
    icon: BookOpen,
    category: 'tools',
  },

  // ---------- Event equipment for rent ----------
  {
    id: 'buzzer',
    name: { he: 'באזר פיזי', en: 'Physical buzzer' },
    pitch: {
      he: 'באזר גדול שמתחבר למחשב שמפעיל את המסך – לחיצה אחת מפעילה ועוצרת את 10 בול או מתחילה את ההגרלה. משכירים לאירוע.',
      en: 'A big buzzer that plugs into the computer running the screen – one slam starts and stops 10 Bool or kicks off the raffle. Rent it for your event.',
    },
    tags: { he: '10 בול, הגרלות', en: '10 Bool, raffles' },
    icon: CircleDot,
    category: 'rentals',
    contact: {
      cta: { he: 'רוצים באזר לאירוע? דברו איתנו', en: 'Need a buzzer for your event? Talk to us' },
      whatsapp: { he: 'היי, אשמח לשכור באזר לאירוע שלי', en: 'Hi, I’d like to rent a buzzer for my event' },
    },
  },
];

export function getExperience(id: string) {
  const entry = CATALOG.find((e) => e.id === id);
  if (!entry) throw new Error(`Unknown experience: ${id}`);
  return entry;
}

// Experiences with a full page in the /experiences area (the template pages)
export const EXPERIENCE_PAGES = CATALOG.filter((e) => e.landing?.startsWith('/experiences/'));

// The slug of a full experience page: '/experiences/10-bool' -> '10-bool'
export function experienceSlug(entry: CatalogEntry) {
  return entry.landing!.replace('/experiences/', '');
}
