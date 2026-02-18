import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('qtagMarketing.meta');

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
