import type { Metadata } from 'next';
import { Secular_One } from 'next/font/google';
import { redirect } from 'next/navigation';
import TheCodeFreeDemo from './TheCodeFreeDemo';

// קוד הגמדים — "free game" DEMO (stage 1 of the free-mode plan): a board of 16 gnomes, any awake
// gnome may be scanned, a solved gnome sleeps until it wakes with its next riddle.
// Local fake only (src/components/thecode/demo/freeDemo.ts): no code, Firestore or server.

const display = Secular_One({ subsets: ['hebrew', 'latin'], weight: '400', variable: '--tc-font-display' });

export const metadata: Metadata = {
  title: 'קוד הגמדים — הדגמת משחק חופשי',
  description: 'סרקו כל גמד ער, פתרו את החידה שלו ואספו אותיות',
  robots: { index: false, follow: false },
};

// Like the other demo pages: closed on the live site (production sends visitors to the guide),
// runs on a local dev server only.
export default function TheCodeFreeDemoPage() {
  if (process.env.NODE_ENV === 'production') redirect('/play/the-code/guide');
  return (
    <div className={display.variable}>
      <TheCodeFreeDemo />
    </div>
  );
}
