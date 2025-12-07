// Supported locales configuration
export const locales = ['he', 'en'] as const;
export type Locale = (typeof locales)[number];

// Default locale for users outside Israel
export const defaultLocale: Locale = 'en';

// RTL languages
export const rtlLocales: Locale[] = ['he'];

// Check if locale is RTL
export function isRtlLocale(locale: Locale): boolean {
  return rtlLocales.includes(locale);
}

// Get direction for locale
export function getDirection(locale: Locale): 'rtl' | 'ltr' {
  return isRtlLocale(locale) ? 'rtl' : 'ltr';
}

// Locale display names (in their own language)
export const localeNames: Record<Locale, string> = {
  he: 'עברית',
  en: 'English',
};

// Locale to Intl locale mapping
export const intlLocales: Record<Locale, string> = {
  he: 'he-IL',
  en: 'en-US',
};
