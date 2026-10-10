import { Metadata } from 'next';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import Hero from '@/components/marketing/Hero';
import HowItWorks from '@/components/marketing/HowItWorks';
import Features from '@/components/marketing/Features';
import UseCases from '@/components/marketing/UseCases';
import Benefits from '@/components/marketing/Benefits';
import Clients from '@/components/marketing/Clients';
import Pricing from '@/components/marketing/Pricing';
import FAQ from '@/components/marketing/FAQ';
import FinalCTA from '@/components/marketing/FinalCTA';
import Footer from '@/components/marketing/Footer';
import { JsonLd } from '@/components/landing/LandingShell';
import { CATALOG } from '@/lib/experiences/catalog';
import { SITE_URL, isLandingLocale, publicPageMetadata } from '@/lib/landing/site';

// The pages print the current year (and costume: next Purim) - regenerate daily so it never goes stale
export const revalidate = 86400;

type Props = { params: Promise<{ locale: string }> };

const META = {
  he: {
    title: 'The Q – חוויות אינטראקטיביות וקודי QR דינמיים לאירועים',
    description:
      'רישום וצ׳ק־אין, הגרלות, הצבעות, קיר סלפי, טריוויה, ציד מטמון, 10 בול ועוד – כל החוויות לאירועים, לכנסים ולעסקים, על קוד QR דינמי שמתעדכן בלי להדפיס מחדש.',
  },
  en: {
    title: 'The Q – Interactive Event Experiences & Dynamic QR Codes',
    description:
      'Registration & check-in, raffles, voting, a selfie wall, trivia, treasure hunts, 10 Bool and more – every experience for events, conferences and businesses, on a dynamic QR you never reprint.',
  },
} as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLandingLocale(locale)) return {};
  return {
    ...publicPageMetadata(locale, 'marketing', META[locale]),
    keywords: ['QR code', 'dynamic QR', 'interactive QR', 'event experiences', 'raffle', 'voting system', 'Q.Vote', 'event registration', 'check-in', 'Q.Tag', 'selfie wall', 'Q.Games', 'trivia', 'treasure hunt', 'Q.Stage', '10 בול', 'הגרלה לאירוע', 'קוד QR דינמי', 'חוויות לאירועים'],
  };
}

export default async function MarketingPage({ params }: Props) {
  const { locale } = await params;
  const l = isLandingLocale(locale) ? locale : 'he';
  // Every experience, for search engines (the same catalogue the section renders)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: l === 'he' ? 'חוויות The Q' : 'The Q Experiences',
    url: `${SITE_URL}/${l}/marketing#features`,
    itemListElement: CATALOG.map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: e.name[l],
      description: e.pitch[l],
      url: e.landing ? `${SITE_URL}/${l}${e.landing}` : e.externalUrl ?? `${SITE_URL}/${l}/marketing#${e.id}`,
    })),
  };
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <JsonLd data={jsonLd} />
      <MarketingHeader />
      <main>
        <Hero />
        <HowItWorks />
        <section id="features">
          <Features />
        </section>
        <section id="usecases">
          <UseCases />
        </section>
        <Benefits />
        {/* <Clients /> - Hidden for now */}
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
