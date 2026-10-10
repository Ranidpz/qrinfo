import Image from 'next/image';
import { Globe, Sparkles } from 'lucide-react';
import type { Locale } from '@/i18n/config';
import { experiencesHref, landingPath } from '@/lib/landing/site';
import SocialLinks from './SocialLinks';

// Server-rendered frame for the public landing pages: everything here is plain HTML so
// crawlers read it without running JS.

const SHELL_TEXT = {
  he: {
    experiences: 'חוויות The Q',
    otherLang: 'English',
    home: 'מה זה The Q?',
    privacy: 'פרטיות',
    accessibility: 'נגישות',
    rights: 'The Q מבית Playzone · משחקים וחוויות דיגיטליות לאירועים',
  },
  en: {
    experiences: 'The Q Experiences',
    otherLang: 'עברית',
    home: 'What is The Q?',
    privacy: 'Privacy',
    accessibility: 'Accessibility',
    rights: 'The Q by Playzone · Digital games and experiences for events',
  },
} as const;

export function LandingShell({
  locale,
  slug,
  children,
}: {
  locale: Locale;
  slug?: string; // current page, so the language switch lands on the same page in the other language
  children: React.ReactNode;
}) {
  const t = SHELL_TEXT[locale];
  const other: Locale = locale === 'he' ? 'en' : 'he';
  return (
    <div
      lang={locale}
      dir={locale === 'he' ? 'rtl' : 'ltr'}
      className="min-h-screen bg-bg-primary text-text-primary"
      style={{ fontFamily: 'var(--font-assistant), system-ui, sans-serif' }}
    >
      <header className="sticky top-0 z-40 border-b border-border/60 bg-bg-primary/85 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <a href={`/${locale}/marketing`} className="flex items-center gap-2 shrink-0" aria-label="The Q">
            <Image src="/theQ.png" alt="The Q" width={32} height={32} className="rounded-md" />
          </a>
          <nav className="flex items-center gap-1 text-sm font-medium">
            <a
              href={experiencesHref(locale)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              {t.experiences}
            </a>
            <a
              href={landingPath(other, slug)}
              hrefLang={other}
              lang={other}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
            >
              <Globe className="h-4 w-4" />
              {t.otherLang}
            </a>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-sm text-text-secondary sm:px-6">
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <a href={experiencesHref(locale)} className="hover:text-text-primary">{t.experiences}</a>
            <a href={`/${locale}/marketing`} className="hover:text-text-primary">{t.home}</a>
            <a href={`/${locale}/privacy`} className="hover:text-text-primary">{t.privacy}</a>
            <a href={`/${locale}/accessibility`} className="hover:text-text-primary">{t.accessibility}</a>
            <a href={landingPath(other, slug)} hrefLang={other} lang={other} className="hover:text-text-primary">
              {t.otherLang}
            </a>
          </nav>
          <SocialLinks />
          <p className="text-center text-xs opacity-80">{t.rights}</p>
        </div>
      </footer>
    </div>
  );
}

export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // `<` escaped so content can never close the script tag
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

// Visible breadcrumb trail (matches the BreadcrumbList JSON-LD)
export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="breadcrumb" className="text-sm text-text-secondary">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true" className="opacity-50">/</span>}
            {item.href ? (
              <a href={item.href} className="hover:text-text-primary transition-colors">{item.label}</a>
            ) : (
              <span aria-current="page" className="text-text-primary">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
