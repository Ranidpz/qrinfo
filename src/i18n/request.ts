import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { locales, defaultLocale, type Locale } from './config';

// Israel timezone for geo detection
const ISRAEL_TIMEZONE = 'Asia/Jerusalem';

async function detectLocaleFromRequest(): Promise<Locale> {
  // 1. Check cookie first (user preference)
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('NEXT_LOCALE')?.value as Locale | undefined;
  if (localeCookie && locales.includes(localeCookie)) {
    return localeCookie;
  }

  // 2. Check Accept-Language header
  const headersList = await headers();
  const acceptLanguage = headersList.get('accept-language');

  if (acceptLanguage) {
    // Parse Accept-Language header
    const languages = acceptLanguage.split(',').map(lang => {
      const [code] = lang.trim().split(';');
      return code.toLowerCase().split('-')[0];
    });

    // Check if any preferred language matches our locales
    for (const lang of languages) {
      if (lang === 'he') return 'he';
      if (lang === 'en') return 'en';
    }
  }

  // 3. Try to detect Israel by timezone (client-side will handle geo)
  // For server-side, we default to English for international users

  return defaultLocale;
}

export default getRequestConfig(async () => {
  const locale = await detectLocaleFromRequest();

  return {
    locale,
    messages: (await import(`./locales/${locale}.json`)).default,
  };
});
