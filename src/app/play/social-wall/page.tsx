import type { Metadata } from 'next';
import SocialWallDemo from './SocialWallDemo';

// Social Wall demo: the real participant app on sample data (src/components/viewer/socialwall/
// demo.ts) — no code, Firestore or storage behind it. Outside [locale] (middleware skips /play/).
// ?reset=1 starts over at the welcome screen; ?access=whatsapp shows the WhatsApp-code join
// (any 4 digits pass).

export const metadata: Metadata = {
  title: 'Social Wall',
  description: 'הרשת החברתית הפרטית של האירוע 📸',
  robots: { index: false, follow: false },
};

export default async function SocialWallDemoPage({ searchParams }: { searchParams: Promise<{ reset?: string; access?: string }> }) {
  const { reset, access } = await searchParams;
  return <SocialWallDemo reset={reset === '1'} access={access === 'whatsapp' ? 'whatsapp' : 'open'} />;
}
