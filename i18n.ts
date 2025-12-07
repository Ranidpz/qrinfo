import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';

export const locales = ['he', 'en'] as const;
export const defaultLocale = 'en' as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async () => {
  // 1. Check cookie first (user preference)
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('NEXT_LOCALE')?.value as Locale | undefined;
  if (localeCookie && locales.includes(localeCookie)) {
    return {
      locale: localeCookie,
      messages: (await import(`./src/i18n/locales/${localeCookie}.json`)).default,
    };
  }

  // 2. Check Accept-Language header
  const headersList = await headers();
  const acceptLanguage = headersList.get('accept-language');

  if (acceptLanguage) {
    const languages = acceptLanguage.split(',').map(lang => {
      const [code] = lang.trim().split(';');
      return code.toLowerCase().split('-')[0];
    });

    for (const lang of languages) {
      if (lang === 'he') {
        return {
          locale: 'he',
          messages: (await import('./src/i18n/locales/he.json')).default,
        };
      }
      if (lang === 'en') {
        return {
          locale: 'en',
          messages: (await import('./src/i18n/locales/en.json')).default,
        };
      }
    }
  }

  // 3. Default to English
  return {
    locale: defaultLocale,
    messages: (await import(`./src/i18n/locales/${defaultLocale}.json`)).default,
  };
});
