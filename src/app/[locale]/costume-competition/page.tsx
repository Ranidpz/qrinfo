import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import Footer from '@/components/marketing/Footer';
import {
  CostumeHero,
  CostumeHowItWorks,
  RegistrationOptions,
  LargeEventSection,
  CostumeFeatures,
  CostumeSecurity,
  CostumeUseCases,
  CostumeDemo,
  CostumeFAQ,
  CostumeCTA,
} from '@/components/marketing/costume';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('costumeCompetition.meta');

  return {
    title: t('title'),
    description: t('description'),
    keywords: ['תחרות תחפושות', 'פורים 2026', 'הצבעה דיגיטלית', 'אירוע פורים', 'The Q', 'costume competition', 'Purim voting'],
    openGraph: {
      title: t('title'),
      description: t('description'),
      type: 'website',
      images: ['/theQ.png'],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
    },
  };
}

interface PageProps {
  searchParams: Promise<{ embed?: string }>;
}

export default async function CostumeCompetitionPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const isEmbed = params.embed === 'true';

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {!isEmbed && <MarketingHeader />}
      <main>
        <CostumeHero />
        <CostumeHowItWorks />
        <RegistrationOptions />
        <LargeEventSection />
        <section id="features">
          <CostumeFeatures />
        </section>
        <CostumeSecurity />
        <CostumeUseCases />
        <CostumeDemo />
        <section id="faq">
          <CostumeFAQ />
        </section>
        <CostumeCTA />
      </main>
      {!isEmbed && <Footer />}
    </div>
  );
}
