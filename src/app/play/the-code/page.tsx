import type { Metadata } from 'next';
import { Secular_One } from 'next/font/google';
import { redirect } from 'next/navigation';
import TheCodeDemo from './TheCodeDemo';

// הקוד — clickable player demo on sample data (src/components/thecode/demo/playerDemo.ts).
// No code, Firestore or server behind it. Outside [locale] (middleware skips /play/).
// For screen-recording the family journey for a hotel; the demo bar fakes the camera.

const display = Secular_One({ subsets: ['hebrew', 'latin'], weight: '400', variable: '--tc-font-display' });

export const metadata: Metadata = {
  title: 'קוד הגמדים — הדגמה',
  description: 'מצאו את הגמדים, פתרו את החידות ופצחו את הקוד של המזוודה',
  robots: { index: false, follow: false },
};

// Closed on the live site (Rani, 12.11.2026: "מיותר") — production sends visitors to the guide.
// Still runs on a local dev server (`next dev`), where the build sessions use it.
export default async function TheCodeDemoPage({ searchParams }: { searchParams: Promise<{ brand?: string }> }) {
  if (process.env.NODE_ENV === 'production') redirect('/play/the-code/guide');
  // ?brand=1 = the venue-branded opening screen on a bright photo, ?brand=2 on a dark one.
  const { brand } = await searchParams;
  return (
    <div className={display.variable}>
      <TheCodeDemo brand={brand === '1' || brand === '2' ? brand : undefined} />
    </div>
  );
}
