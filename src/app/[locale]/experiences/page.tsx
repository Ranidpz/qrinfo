import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ArrowLeft, ArrowUpRight, Play } from 'lucide-react';
import type { Locale } from '@/i18n/config';
import { LandingShell, JsonLd, Breadcrumbs } from '@/components/landing/LandingShell';
import { CONTACT, SITE_URL, isLandingLocale, landingAlternates, landingPath, landingUrl } from '@/lib/landing/site';
import { ADDONS, CATALOG, CATEGORIES, type CatalogEntry } from '@/lib/experiences/catalog';

// "חוויות The Q" hub: the whole catalogue (src/lib/experiences/catalog.ts), grouped by category.
// Experiences with a landing page link to it; the rest offer a WhatsApp chat - no dead links.

const HUB = {
  he: {
    title: 'חוויות The Q – כל החוויות האינטראקטיביות לאירועים',
    description:
      'כל החוויות של The Q במקום אחד: רישום וצ׳ק־אין, הגרלות, הצבעות, קיר סלפי, טריוויה, ציד מטמון, 10 בול ועוד – לאירועים, לכנסים, לכיתות ולעסקים.',
    crumb: 'חוויות',
    h1: 'חוויות The Q',
    intro:
      'כל מה שאפשר להפעיל עם The Q – מרישום לאירוע ועד משחק על המסך הגדול. לחוויות עם דף מלא יש הסבר ודמו חי; על כל השאר נשמח לספר לכם בוואטסאפ.',
    open: 'לדף החוויה',
    demo: 'נסו דמו',
    external: 'לאתר',
    talk: 'רוצים את זה באירוע? דברו איתנו',
    whatsappText: (name: string) => `היי, אשמח לשמוע על ${name} לאירוע שלי`,
    missingTitle: 'לא מצאתם את מה שחיפשתם?',
    missingText: 'חוויות חדשות מתווספות כל הזמן, ואפשר גם להתאים ולמתג חוויה במיוחד בשבילכם.',
    missingCta: 'דברו איתנו בוואטסאפ',
    missingWhatsapp: 'היי, אני מחפש/ת חוויה לאירוע שלי',
  },
  en: {
    title: 'The Q Experiences – Every Interactive Experience for Events',
    description:
      'Every The Q experience in one place: registration and check-in, raffles, voting, a selfie wall, trivia, treasure hunts, 10 Bool and more – for events, conferences, classrooms and businesses.',
    crumb: 'Experiences',
    h1: 'The Q Experiences',
    intro:
      'Everything you can run with The Q – from event registration to a game on the big screen. Experiences with a full page come with details and a live demo; for the rest, we’re happy to tell you more on WhatsApp.',
    open: 'Open the experience',
    demo: 'Try the demo',
    external: 'Visit site',
    talk: 'Want this at your event? Talk to us',
    whatsappText: (name: string) => `Hi, I’d like to hear about ${name} for my event`,
    missingTitle: 'Can’t find what you’re looking for?',
    missingText: 'New experiences are added all the time, and we can also tailor and brand one just for you.',
    missingCta: 'Chat with us on WhatsApp',
    missingWhatsapp: 'Hi, I’m looking for an experience for my event',
  },
} as const;

const wa = (text: string) => `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(text)}`;

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

function ExperienceCard({ entry, locale }: { entry: CatalogEntry; locale: Locale }) {
  const t = HUB[locale];
  const Icon = entry.icon;
  const name = entry.name[locale];
  const href = entry.landing ? `/${locale}${entry.landing}` : entry.externalUrl;
  const linkProps = entry.externalUrl && !entry.landing ? { target: '_blank', rel: 'noopener' } : {};
  return (
    <li
      className={`relative flex flex-col rounded-2xl border bg-bg-card p-5 transition-all ${
        entry.landing ? 'border-amber-500/40 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-amber-500/10' : 'border-border'
      } ${href ? 'hover:border-amber-500/60' : ''}`}
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <h3 className="pt-2 text-lg font-bold leading-snug">
          {href ? (
            // stretched link: the whole card opens the page
            <a href={href} {...linkProps} className="after:absolute after:inset-0 after:rounded-2xl">
              {name}
            </a>
          ) : (
            name
          )}
        </h3>
      </div>
      <p className="mt-3 flex-1 leading-relaxed text-text-secondary">{entry.pitch[locale]}</p>
      {entry.addons && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {entry.addons.map((a) => (
            <li key={a}>
              <a
                href="#rentals"
                className="relative z-10 inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:border-amber-500/60 dark:text-amber-300"
              >
                + {ADDONS[a][locale]}
              </a>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold">
        {entry.landing ? (
          <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
            {t.open}
            <ArrowLeft className="h-4 w-4 ltr:rotate-180" aria-hidden="true" />
          </span>
        ) : entry.externalUrl ? (
          <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
            {t.external}
            <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
          </span>
        ) : (
          <a
            href={wa(entry.contact?.whatsapp[locale] ?? t.whatsappText(name))}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[#128C7E] hover:underline dark:text-[#25D366]"
          >
            {entry.contact?.cta[locale] ?? t.talk}
          </a>
        )}
        {entry.demo && (
          <a
            href={entry.demo}
            target="_blank"
            rel="noopener"
            className="relative z-10 inline-flex items-center gap-1.5 text-text-secondary hover:text-text-primary"
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            {t.demo}
          </a>
        )}
      </div>
    </li>
  );
}

export default async function ExperiencesHubPage({ params }: Props) {
  const { locale } = await params;
  if (!isLandingLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = HUB[locale];

  const listed = CATALOG.filter((e) => e.landing || e.externalUrl);
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
        itemListElement: listed.map((e, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: e.name[locale],
          url: e.landing ? `${SITE_URL}/${locale}${e.landing}` : e.externalUrl,
        })),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'The Q', item: `${SITE_URL}/${locale}/marketing` },
        { '@type': 'ListItem', position: 2, name: t.crumb, item: landingUrl(locale) },
      ],
    },
  ];

  return (
    <LandingShell locale={locale}>
      <JsonLd data={jsonLd} />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6 lg:pt-12">
        <Breadcrumbs items={[{ label: 'The Q', href: `/${locale}/marketing` }, { label: t.crumb }]} />
        <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">{t.h1}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-text-secondary">{t.intro}</p>

        <nav aria-label={t.crumb} className="mt-8 flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <a
              key={cat.id}
              href={`#${cat.id}`}
              className="rounded-full border border-border bg-bg-card px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-amber-500/50 hover:text-text-primary"
            >
              {cat.title[locale]}
            </a>
          ))}
        </nav>

        {CATEGORIES.map((cat) => {
          const entries = CATALOG.filter((e) => e.category === cat.id);
          return (
            <section key={cat.id} id={cat.id} className="scroll-mt-16 pt-12">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{cat.title[locale]}</h2>
              <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {entries.map((e) => (
                  <ExperienceCard key={e.id} entry={e} locale={locale} />
                ))}
              </ul>
            </section>
          );
        })}

        <section className="mt-16 flex flex-col items-start gap-4 rounded-2xl border border-border bg-bg-secondary p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h2 className="text-xl font-bold">{t.missingTitle}</h2>
            <p className="mt-1.5 text-text-secondary">{t.missingText}</p>
          </div>
          <a
            href={wa(t.missingWhatsapp)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#25D366] px-6 py-3 font-bold text-white transition-colors hover:bg-[#1ebe5b]"
          >
            {t.missingCta}
          </a>
        </section>
      </main>
    </LandingShell>
  );
}
