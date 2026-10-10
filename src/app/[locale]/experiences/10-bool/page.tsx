import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import ExperienceLanding from '@/components/landing/ExperienceLanding';
import TenBoolDemo from '@/components/landing/TenBoolDemo';
import { TENBOOL_CONTENT, TENBOOL_DEMO_LABELS } from '@/lib/landing/tenbool-content';
import { LANDING_PAGES, SITE_URL, isLandingLocale, landingAlternates, landingPath, tenboolDemoSrc } from '@/lib/landing/site';

const SLUG = '10-bool';
const CARD = LANDING_PAGES.find((p) => p.slug === SLUG)!;
const OG_IMAGE = CARD.image;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLandingLocale(locale)) return {};
  const c = TENBOOL_CONTENT[locale].meta;
  return {
    title: { absolute: c.title },
    description: c.description,
    keywords: c.keywords,
    alternates: landingAlternates(locale, SLUG),
    openGraph: {
      title: c.title,
      description: c.description,
      url: landingPath(locale, SLUG),
      siteName: 'The Q',
      locale: locale === 'he' ? 'he_IL' : 'en_US',
      alternateLocale: locale === 'he' ? ['en_US'] : ['he_IL'],
      type: 'website',
      images: [{ url: OG_IMAGE, width: 633, height: 633, alt: c.ogAlt }],
    },
    twitter: { card: 'summary', title: c.title, description: c.description, images: [OG_IMAGE] },
  };
}

export default async function TenBoolLandingPage({ params }: Props) {
  const { locale } = await params;
  if (!isLandingLocale(locale)) notFound();
  setRequestLocale(locale);
  const c = TENBOOL_CONTENT[locale];

  return (
    <ExperienceLanding
      locale={locale}
      slug={SLUG}
      experience="tenbool"
      content={c}
      demo={<TenBoolDemo labels={TENBOOL_DEMO_LABELS[locale]} />}
      playHref={tenboolDemoSrc('wins')}
      entityJsonLd={{
        '@type': ['VideoGame', 'WebApplication'],
        name: c.name,
        alternateName: ['10 בול', '10 Bool', 'Ten Bool'],
        description: c.meta.description,
        image: `${SITE_URL}${OG_IMAGE}`,
        applicationCategory: 'GameApplication',
        genre: ['Party game', 'Timing game'],
        operatingSystem: 'Any (web browser)',
        gamePlatform: ['Web browser', 'Mobile', 'Desktop'],
        playMode: ['SinglePlayer', 'MultiPlayer'],
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'ILS', availability: 'https://schema.org/InStock' },
        publisher: { '@type': 'Organization', name: 'Playzone', url: SITE_URL },
      }}
    />
  );
}
