import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import {
  CostumeHeader,
  CostumeFooter,
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

export default function CostumeCompetitionPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <CostumeHeader />
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
      <CostumeFooter />
    </div>
  );
}
