import type { Metadata } from 'next';
import SocialWallDemo from './SocialWallDemo';

// Social Wall demo: the real participant app on sample data (src/components/viewer/socialwall/
// demo.ts) — no code, Firestore or storage behind it. Outside [locale] (middleware skips /play/).
// ?reset=1 starts over at the welcome screen; ?access=whatsapp shows the WhatsApp-code join
// (any 6 digits pass).

// Shared on WhatsApp it must look like Social Wall, not The Q. The OG image (collage of the demo
// photos + slogan) and icons are static files in public/play/social-wall/, rendered in Chromium
// (sharp/librsvg and Satori both break Hebrew RTL).
const TITLE = 'Social Wall';
const DESCRIPTION = 'מצטלמים. משתפים. מפרגנים. הרשת החברתית הפרטית לאירועים 📸';
const OG_IMAGE = '/play/social-wall/og.jpg?v=2'; // bump when the image changes (WhatsApp caches it)

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: false },
  icons: { icon: '/play/social-wall/icon.png', apple: '/play/social-wall/apple-icon.png' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    url: '/play/social-wall',
    siteName: 'Social Wall by Playzone',
    locale: 'he_IL',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: `${TITLE} — מצטלמים. משתפים. מפרגנים.` }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [OG_IMAGE] },
};

export default async function SocialWallDemoPage({ searchParams }: { searchParams: Promise<{ reset?: string; access?: string }> }) {
  const { reset, access } = await searchParams;
  return <SocialWallDemo reset={reset === '1'} access={access === 'whatsapp' ? 'whatsapp' : 'open'} />;
}
