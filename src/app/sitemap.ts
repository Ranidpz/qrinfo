import type { MetadataRoute } from 'next';
import { LANDING_LOCALES, LANDING_PAGES, LANDING_UPDATED, SITE_URL, landingUrl, publicPagePath } from '@/lib/landing/site';

// Public, indexable pages only, each listed per language with its hreflang alternates.

function bothLanguages(path: (locale: 'he' | 'en') => string, priority: number, lastModified?: string): MetadataRoute.Sitemap {
  const languages = { he: path('he'), en: path('en'), 'x-default': path('he') };
  return LANDING_LOCALES.map((locale) => ({
    url: path(locale),
    lastModified,
    changeFrequency: 'monthly' as const,
    priority,
    alternates: { languages },
  }));
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...bothLanguages((l) => landingUrl(l), 0.8, LANDING_UPDATED),
    ...LANDING_PAGES.flatMap((p) => bothLanguages((l) => landingUrl(l, p.slug), 0.9, p.updated)),
    ...bothLanguages((l) => `${SITE_URL}${publicPagePath(l, 'marketing')}`, 0.7),
    ...bothLanguages((l) => `${SITE_URL}${publicPagePath(l, 'costume-competition')}`, 0.5),
    ...bothLanguages((l) => `${SITE_URL}${publicPagePath(l, 'qtag')}`, 0.5),
    ...bothLanguages((l) => `${SITE_URL}${publicPagePath(l, 'guide')}`, 0.5),
    ...bothLanguages((l) => `${SITE_URL}${publicPagePath(l, 'privacy')}`, 0.2),
    ...bothLanguages((l) => `${SITE_URL}${publicPagePath(l, 'accessibility')}`, 0.2),
  ];
}
