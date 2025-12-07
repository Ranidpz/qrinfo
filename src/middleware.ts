import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/config';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
  // Detect locale from Accept-Language header
  localeDetection: true,
});

export const config = {
  // Match all pathnames except:
  // - API routes
  // - Static files
  // - Public viewer pages (v/[shortId])
  // - Gallery pages
  matcher: [
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next`, `/v/`, `/gallery/` or contain a dot
    '/((?!api|_next|v/|gallery/|.*\\..*).*)',
  ],
};
