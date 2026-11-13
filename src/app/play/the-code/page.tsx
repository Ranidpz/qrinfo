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
export default async function TheCodeDemoPage({ searchParams }: { searchParams: Promise<{ brand?: string; theme?: string }> }) {
  if (process.env.NODE_ENV === 'production') redirect('/play/the-code/guide');
  // ?brand=1…8 = the opening-screen looks (see DEMO_BRANDINGS); ?theme=night|light|brand = the "איך משחקים" sheet.
  const { brand, theme } = await searchParams;
  const brandKey = brand && ['1', '2', '3', '4', '5', '6', '7', '8'].includes(brand) ? (brand as '1') : undefined;
  const themeKey = theme === 'light' || theme === 'brand' || theme === 'night' ? theme : undefined;
  return (
    <div className={display.variable}>
      <TheCodeDemo brand={brandKey} theme={themeKey} />
    </div>
  );
}
