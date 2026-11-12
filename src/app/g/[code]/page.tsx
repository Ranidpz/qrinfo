import type { Metadata } from 'next';
import GnomeLanding from './GnomeLanding';

// הקוד — where a gnome's printed QR lands when scanned with the phone's own camera.
// Public, no locale (middleware skips /g/). The lookup + the game run client-side
// against /api/thecode/gnome and /api/thecode/play.

export const metadata: Metadata = {
  title: 'קוד הגמדים',
  description: 'מצאתם גמד! פתרו את החידה שלו ואספו את האות',
  robots: { index: false, follow: false },
};

export default async function GnomePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let decoded = code;
  try {
    decoded = decodeURIComponent(code);
  } catch {
    /* keep the raw segment */
  }
  return <GnomeLanding code={decoded.slice(0, 40)} />;
}
