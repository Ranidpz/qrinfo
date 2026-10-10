import type { MetadataRoute } from 'next';
import { LANDING_LOCALES, SITE_URL, landingUrl, publicPagePath } from '@/lib/landing/site';
import { EXPERIENCE_PAGES, experienceSlug } from '@/lib/experiences/catalog';

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
    ...EXPERIENCE_PAGES.flatMap((p) => bothLanguages((l) => landingUrl(l, experienceSlug(p)), 0.9, p.updated)),
    // The home page - also the one list of every experience
    ...bothLanguages((l) => `${SITE_URL}${publicPagePath(l, 'marketing')}`, 1, '2026-10-10'),
    ...bothLanguages((l) => `${SITE_URL}${publicPagePath(l, 'costume-competition')}`, 0.5),
    ...bothLanguages((l) => `${SITE_URL}${publicPagePath(l, 'qtag')}`, 0.5),
    ...bothLanguages((l) => `${SITE_URL}${publicPagePath(l, 'guide')}`, 0.5),
    ...bothLanguages((l) => `${SITE_URL}${publicPagePath(l, 'privacy')}`, 0.2),
    ...bothLanguages((l) => `${SITE_URL}${publicPagePath(l, 'accessibility')}`, 0.2),
  ];
}
