import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { isLandingLocale, publicPageMetadata } from '@/lib/landing/site';
import PrivacyClient from './PrivacyClient';

// Server wrapper so the page gets its own title / canonical / hreflang; the content stays a client component.

const META = {
  he: {
    title: 'מדיניות פרטיות | The Q',
    description:
      'מדיניות הפרטיות של The Q By Playzone: איזה מידע נאסף, איך משתמשים בו, עם מי הוא משותף, איך הוא מאובטח ואילו זכויות עומדות לכם.',
  },
  en: {
    title: 'Privacy Policy | The Q',
    description:
      'The Q By Playzone privacy policy: what information we collect, how we use and share it, how it is secured and what rights you have.',
  },
} as const;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLandingLocale(locale)) return {};
  return publicPageMetadata(locale, 'privacy', META[locale]);
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PrivacyClient />;
}
