import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { isLandingLocale, publicPageAlternates } from '@/lib/landing/site';
import {
  QTagHeader,
  QTagFooter,
  QTagHero,
  QTagHowItWorks,
  QTagFeatures,
  QTagHighlights,
  QTagCommunity,
  QTagCTA,
} from '@/components/marketing/qtag';

// The pages print the current year (and costume: next Purim) - regenerate daily so it never goes stale
export const revalidate = 86400;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'qtagMarketing.meta' });

  return {
    title: t('title'),
    description: t('description'),
    keywords: ['רישום לאירוע', 'הרשמה דיגיטלית', 'QR check-in', 'ניהול אורחים', 'Q.Tag', 'The Q', 'event registration'],
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
    ...(isLandingLocale(locale) ? { alternates: publicPageAlternates(locale, 'qtag') } : {}),
  };
}

export default function QTagPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <QTagHeader />
      <main>
        <QTagHero />
        <QTagHowItWorks />
        <section id="features">
          <QTagFeatures />
        </section>
        <QTagHighlights />
        <QTagCommunity />
        <QTagCTA />
      </main>
      <QTagFooter />
    </div>
  );
}
