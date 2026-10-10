import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';

// Public landing pages ("games" area). Everything that builds a URL for them goes through here,
// so pointing a dedicated domain at a page later only means changing SITE_URL / the paths below.

export const SITE_URL = 'https://qr.playzones.app';
export const LANDING_LOCALES: Locale[] = ['he', 'en'];
// Hebrew is the primary market, so it's also what x-default points to.
export const LANDING_DEFAULT_LOCALE: Locale = 'he';

// The games area (/he/games, /en/games/10-bool, ...). These pages have their own header/footer
// (no app shell) and are rendered on the server - see Providers / ClientLayout.
export function isLandingPathname(pathname: string | null | undefined) {
  return /^\/(he|en)\/games(\/|$)/.test(pathname ?? '');
}

export function isLandingLocale(value: string): value is Locale {
  return (LANDING_LOCALES as string[]).includes(value);
}

// slug undefined = the hub itself
export function landingPath(locale: Locale, slug?: string) {
  return `/${locale}/games${slug ? `/${slug}` : ''}`;
}

export function landingUrl(locale: Locale, slug?: string) {
  return `${SITE_URL}${landingPath(locale, slug)}`;
}

// canonical + hreflang (he / en / x-default) - every language has its own real URL
export function landingAlternates(locale: Locale, slug?: string): Metadata['alternates'] {
  return {
    canonical: landingPath(locale, slug),
    languages: {
      he: landingPath('he', slug),
      en: landingPath('en', slug),
      'x-default': landingPath(LANDING_DEFAULT_LOCALE, slug),
    },
  };
}

// Where "create your own" lands: the dashboard opens the create panel on that experience's tab
// (and asks a guest to sign in first).
export function createHref(locale: Locale, experience: string) {
  return `/${locale}/dashboard?create=${experience}`;
}

// The public 10 בול demo (no code behind it), embedded on its landing page and opened full screen
export type DemoBoard = 'wins' | 'counter' | 'lives';
export function tenboolDemoSrc(board: DemoBoard = 'wins') {
  return `/play/10-bool?board=${board}`;
}

export interface LandingCard {
  slug: string;
  updated: string; // ISO date, for the sitemap
  image: string;
  title: Record<Locale, string>;
  tagline: Record<Locale, string>;
  tags: Record<Locale, string[]>;
}

// The hub lists these, and the sitemap emits every one in both languages.
export const LANDING_PAGES: LandingCard[] = [
  {
    slug: '10-bool',
    updated: '2026-10-10',
    image: '/api/og/tenbool',
    title: { he: '10 בול', en: '10 Bool' },
    tagline: {
      he: 'עצרו את הטיימר בדיוק על 10.00. משחק תזמון קצר וממכר למסך גדול, לכיתה ולטלפון.',
      en: 'Stop the timer at exactly 10.00. A quick, addictive timing game for big screens, classrooms and phones.',
    },
    tags: {
      he: ['אירועים', 'כנסים', 'ימי הולדת', 'כיתות'],
      en: ['Events', 'Conferences', 'Birthdays', 'Classrooms'],
    },
  },
];

export const LANDING_UPDATED = LANDING_PAGES.map((p) => p.updated).sort().at(-1)!;
