import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { LandingShell, JsonLd, Breadcrumbs } from '@/components/landing/LandingShell';
import { LANDING_PAGES, SITE_URL, isLandingLocale, landingAlternates, landingPath, landingUrl } from '@/lib/landing/site';

// Hub of the public landing pages. Each entry in LANDING_PAGES gets a card here.

const HUB = {
  he: {
    title: 'משחקים לאירועים, לכיתה ולמסך הגדול | The Q',
    description:
      'משחקים קצרים וממכרים שרצים בדפדפן – למסך גדול באירוע, לכנס, לכיתה ולטלפון. שחקו בחינם או צרו משחק משלכם עם לוגו, צבעים וקוד QR.',
    home: 'The Q',
    crumb: 'משחקים',
    h1: 'משחקים לאירועים ולמסך הגדול',
    intro:
      'משחקים קצרים שכל אחד מבין בשנייה – על מסך גדול עם באזר, בכיתה או בטלפון דרך קוד QR. נסו כל משחק כאן בחינם, ואז צרו גרסה משלכם עם הלוגו, הצבעים והצלילים שלכם.',
    open: 'לדף המשחק',
    more: 'משחקים נוספים בדרך.',
  },
  en: {
    title: 'Games for Events, Classrooms and Big Screens | The Q',
    description:
      'Quick, addictive games that run in the browser – for event big screens, conferences, classrooms and phones. Play free or create your own with your logo, colours and a QR code.',
    home: 'The Q',
    crumb: 'Games',
    h1: 'Games for events and big screens',
    intro:
      'Short games anyone gets in a second – on a big screen with a buzzer, in class, or on phones through a QR code. Try every game here for free, then create your own version with your logo, colours and sounds.',
    open: 'Open the game page',
    more: 'More games are on the way.',
  },
} as const;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLandingLocale(locale)) return {};
  const t = HUB[locale];
  return {
    title: { absolute: t.title },
    description: t.description,
    alternates: landingAlternates(locale),
    openGraph: {
      title: t.title,
      description: t.description,
      url: landingPath(locale),
      siteName: 'The Q',
      locale: locale === 'he' ? 'he_IL' : 'en_US',
      type: 'website',
      images: [{ url: '/theQ.png', width: 512, height: 512, alt: 'The Q' }],
    },
  };
}

export default async function GamesHubPage({ params }: Props) {
  const { locale } = await params;
  if (!isLandingLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = HUB[locale];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: t.h1,
      description: t.description,
      url: landingUrl(locale),
      inLanguage: locale,
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: LANDING_PAGES.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: p.title[locale],
          url: landingUrl(locale, p.slug),
        })),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: t.home, item: `${SITE_URL}/${locale}/marketing` },
        { '@type': 'ListItem', position: 2, name: t.crumb, item: landingUrl(locale) },
      ],
    },
  ];

  return (
    <LandingShell locale={locale}>
      <JsonLd data={jsonLd} />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6 lg:pt-12">
        <Breadcrumbs items={[{ label: t.home, href: `/${locale}/marketing` }, { label: t.crumb }]} />
        <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">{t.h1}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-text-secondary">{t.intro}</p>

        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {LANDING_PAGES.map((p) => (
            <li key={p.slug}>
              <a
                href={landingPath(locale, p.slug)}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-bg-card transition-all hover:-translate-y-0.5 hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/10"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- dynamic OG image route */}
                <img
                  src={p.image}
                  alt=""
                  width={633}
                  height={633}
                  loading="lazy"
                  className="aspect-[16/10] w-full bg-black object-cover"
                />
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="text-2xl font-bold">{p.title[locale]}</h2>
                  <p className="mt-2 flex-1 leading-relaxed text-text-secondary">{p.tagline[locale]}</p>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {p.tags[locale].map((tag) => (
                      <li key={tag} className="rounded-full bg-bg-hover px-2.5 py-1 text-xs font-medium text-text-secondary">
                        {tag}
                      </li>
                    ))}
                  </ul>
                  <span className="mt-5 inline-flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300">
                    {t.open}
                    <ArrowLeft className="h-4 w-4 transition-transform ltr:rotate-180 group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </div>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-10 text-sm text-text-secondary">{t.more}</p>
      </main>
    </LandingShell>
  );
}
