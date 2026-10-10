import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { isLandingLocale, publicPageMetadata } from '@/lib/landing/site';
import AccessibilityClient from './AccessibilityClient';

// Server wrapper so the page gets its own title / canonical / hreflang; the content stays a client component.

const META = {
  he: {
    title: 'הצהרת נגישות | The Q',
    description:
      'הצהרת הנגישות של The Q By Playzone: התאמות הנגישות באתר, תקן WCAG 2.1 ברמה AA, דפדפנים נתמכים ופרטי רכז הנגישות.',
  },
  en: {
    title: 'Accessibility Statement | The Q',
    description:
      'The Q By Playzone accessibility statement: accessibility features, WCAG 2.1 AA conformance, supported browsers and how to reach our accessibility coordinator.',
  },
} as const;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLandingLocale(locale)) return {};
  return publicPageMetadata(locale, 'accessibility', META[locale]);
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AccessibilityClient />;
}
