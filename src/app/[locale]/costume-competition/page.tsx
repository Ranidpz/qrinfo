import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { isLandingLocale, publicPageAlternates } from '@/lib/landing/site';
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

// The pages print the current year (and costume: next Purim) - regenerate daily so it never goes stale
export const revalidate = 86400;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'costumeCompetition.meta' });

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
    ...(isLandingLocale(locale) ? { alternates: publicPageAlternates(locale, 'costume-competition') } : {}),
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
        <section id="demo">
          <CostumeDemo />
        </section>
        <section id="faq">
          <CostumeFAQ />
        </section>
        <CostumeCTA />
      </main>
      <CostumeFooter />
    </div>
  );
}
