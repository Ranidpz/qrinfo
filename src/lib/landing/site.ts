import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';

// Public landing pages ("חוויות The Q" / The Q Experiences): a hub + one page per experience. Everything that builds a URL for them goes through here,
// so pointing a dedicated domain at a page later only means changing SITE_URL / the paths below.

export const SITE_URL = 'https://qr.playzones.app';
export const LANDING_LOCALES: Locale[] = ['he', 'en'];
// Hebrew is the primary market, so it's also what x-default points to.
export const LANDING_DEFAULT_LOCALE: Locale = 'he';

// The experiences area (/he/experiences, /en/experiences/10-bool, ...). These pages have their own header/footer
// (no app shell) and are rendered on the server - see Providers / ClientLayout.
export function isLandingPathname(pathname: string | null | undefined) {
  return /^\/(he|en)\/experiences(\/|$)/.test(pathname ?? '');
}

// Public pages that ship real HTML from the server (for search engines). ThemeProvider renders them
// before mount, so nothing they render may read window / localStorage / matchMedia - do that in an
// effect. App pages (dashboard, code, admin...) stay client-only on purpose.
export const PUBLIC_SSR_PAGES = ['marketing', 'costume-competition', 'qtag', 'guide', 'privacy', 'accessibility'] as const;
const PUBLIC_SSR_RE = new RegExp(`^/(he|en)/(${PUBLIC_SSR_PAGES.join('|')})/?$`);

export function isPublicSsrPathname(pathname: string | null | undefined) {
  return isLandingPathname(pathname) || PUBLIC_SSR_RE.test(pathname ?? '');
}

export function isLandingLocale(value: string): value is Locale {
  return (LANDING_LOCALES as string[]).includes(value);
}

// slug undefined = the hub itself
export function landingPath(locale: Locale, slug?: string) {
  return `/${locale}/experiences${slug ? `/${slug}` : ''}`;
}

export function landingUrl(locale: Locale, slug?: string) {
  return `${SITE_URL}${landingPath(locale, slug)}`;
}

// canonical + hreflang (he / en / x-default) - every language has its own real URL
function alternatesFor(locale: Locale, path: (l: Locale) => string): Metadata['alternates'] {
  return {
    canonical: path(locale),
    languages: {
      he: path('he'),
      en: path('en'),
      'x-default': path(LANDING_DEFAULT_LOCALE),
    },
  };
}

export function landingAlternates(locale: Locale, slug?: string): Metadata['alternates'] {
  return alternatesFor(locale, (l) => landingPath(l, slug));
}

// The other public pages (/he/marketing, /en/privacy, ...)
export type PublicPage = (typeof PUBLIC_SSR_PAGES)[number];

export function publicPagePath(locale: Locale, page: PublicPage) {
  return `/${locale}/${page}`;
}

export function publicPageAlternates(locale: Locale, page: PublicPage): Metadata['alternates'] {
  return alternatesFor(locale, (l) => publicPagePath(l, page));
}

// Where "create your own" lands: the dashboard opens the create panel on that experience's tab
// (and asks a guest to sign in first).
export function createHref(locale: Locale, experience: string) {
  return `/${locale}/dashboard?create=${experience}`;
}

// Same contact channels as the costume-competition page
export const CONTACT = {
  whatsapp: '972773006306',
  email: 'info@playzone.co.il',
  calendar: 'https://calendar.app.google/3dei45285ySZbHpa8',
};

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

// Metadata for a simple public page (guide, privacy, accessibility): own title, canonical + hreflang
export function publicPageMetadata(
  locale: Locale,
  page: PublicPage,
  { title, description }: { title: string; description: string },
): Metadata {
  return {
    title: { absolute: title },
    description,
    alternates: publicPageAlternates(locale, page),
    openGraph: {
      title,
      description,
      url: publicPagePath(locale, page),
      siteName: 'The Q',
      locale: locale === 'he' ? 'he_IL' : 'en_US',
      type: 'website',
      images: [{ url: '/theQ.png', width: 512, height: 512, alt: 'The Q' }],
    },
  };
}
