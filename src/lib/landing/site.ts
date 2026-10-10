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
