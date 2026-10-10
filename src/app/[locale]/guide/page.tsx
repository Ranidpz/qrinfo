import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { isLandingLocale, publicPageMetadata } from '@/lib/landing/site';
import GuideClient from './GuideClient';

// Server wrapper so the page gets its own title / canonical / hreflang; the content stays a client component.

const META = {
  he: {
    title: 'מדריך למשתמש – שאלות ותשובות | The Q',
    description:
      'כל מה שצריך לדעת על The Q: יצירת קודי QR דינמיים, הצבעות, משחקים, רישום לאירועים, ציד אוצרות ועוד – שאלות ותשובות מסודרות לפי נושאים.',
  },
  en: {
    title: 'User Guide – Questions and Answers | The Q',
    description:
      'Everything you need to know about The Q: creating dynamic QR codes, voting, games, event registration, treasure hunts and more – answers organised by topic.',
  },
} as const;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLandingLocale(locale)) return {};
  return publicPageMetadata(locale, 'guide', META[locale]);
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <GuideClient />;
}
