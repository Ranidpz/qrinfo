import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import ExperienceLanding from '@/components/landing/ExperienceLanding';
import SocialWallHero from '@/components/landing/SocialWallHero';
import SocialWallPreview from '@/components/landing/SocialWallPreview';
import { SOCIALWALL_CONTENT, SOCIALWALL_DEMO_LABELS, SOCIALWALL_HERO_LABELS } from '@/lib/landing/social-wall-content';
import { SITE_URL, isLandingLocale, landingAlternates, landingPath } from '@/lib/landing/site';

// Live but unlisted until the full experience ships: no catalog.ts entry (so no link from the
// site and no sitemap row) and every "create" button goes to WhatsApp - see social-wall-content.ts.
const SLUG = 'social-wall';
const OG_IMAGE = '/play/social-wall/og.jpg'; // 1200x630, the demo's branded WhatsApp preview

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLandingLocale(locale)) return {};
  const c = SOCIALWALL_CONTENT[locale].meta;
  return {
    title: { absolute: c.title },
    description: c.description,
    keywords: c.keywords,
    alternates: landingAlternates(locale, SLUG),
    icons: { icon: '/play/social-wall/icon.png', apple: '/play/social-wall/apple-icon.png' },
    openGraph: {
      title: c.title,
      description: c.description,
      url: landingPath(locale, SLUG),
      siteName: 'The Q',
      locale: locale === 'he' ? 'he_IL' : 'en_US',
      alternateLocale: locale === 'he' ? ['en_US'] : ['he_IL'],
      type: 'website',
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: c.ogAlt }],
    },
    twitter: { card: 'summary_large_image', title: c.title, description: c.description, images: [OG_IMAGE] },
  };
}

export default async function SocialWallLandingPage({ params }: Props) {
  const { locale } = await params;
  if (!isLandingLocale(locale)) notFound();
  setRequestLocale(locale);
  const c = SOCIALWALL_CONTENT[locale];

  return (
    <ExperienceLanding
      locale={locale}
      slug={SLUG}
      experience="socialwall"
      content={c}
      heroVisual={<SocialWallHero dir={locale === 'he' ? 'rtl' : 'ltr'} labels={SOCIALWALL_HERO_LABELS[locale]} />}
      demo={<SocialWallPreview labels={SOCIALWALL_DEMO_LABELS[locale]} />}
      playHref="/play/social-wall"
      entityJsonLd={{
        '@type': 'WebApplication',
        name: c.name,
        description: c.meta.description,
        image: `${SITE_URL}${OG_IMAGE}`,
        applicationCategory: 'SocialNetworkingApplication',
        operatingSystem: 'Any (web browser)',
        publisher: { '@type': 'Organization', name: 'Playzone', url: SITE_URL },
      }}
    />
  );
}
