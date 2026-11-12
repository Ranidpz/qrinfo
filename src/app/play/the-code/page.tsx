import type { Metadata } from 'next';
import { Secular_One } from 'next/font/google';
import TheCodeDemo from './TheCodeDemo';

// הקוד — clickable player demo on sample data (src/components/thecode/demo/playerDemo.ts).
// No code, Firestore or server behind it. Outside [locale] (middleware skips /play/).
// For screen-recording the family journey for a hotel; the demo bar fakes the camera.

const display = Secular_One({ subsets: ['hebrew', 'latin'], weight: '400', variable: '--tc-font-display' });

export const metadata: Metadata = {
  title: 'הקוד — הדגמה',
  description: 'מצאו את הגמדים, פתרו את החידות ופצחו את הקוד של המזוודה',
  robots: { index: false, follow: false },
};

export default function TheCodeDemoPage() {
  return (
    <div className={display.variable}>
      <TheCodeDemo />
    </div>
  );
}
