import type { Metadata } from 'next';
import TenBoolViewer from '@/components/viewer/TenBoolViewer';
import type { TenBoolBoard } from '@/types/tenbool';

// Public "10 בול" demo: the real game with default settings, no code / Firestore behind it.
// The landing page embeds it in an iframe (the viewer is fixed full-viewport and listens for
// Enter/Space on window, so a frame keeps it from taking over the page), and links here for
// full screen. Outside the [locale] tree (middleware skips /play/) so no app shell or auth loads.

// Shared on WhatsApp it must look like a real 10 בול game (same preview + icon as /v/), not The Q
const TITLE = '10 בול';
const DESCRIPTION = 'עצרו את הטיימר בדיוק על 10.00 ⏱️';
const OG_IMAGE = '/api/og/tenbool';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  // The landing pages are the indexable ones; this is just the game surface
  robots: { index: false, follow: true },
  manifest: '/play/10-bool/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: TITLE },
  icons: { icon: '/favicon.svg', apple: '/api/og/tenbool?icon=180' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    url: '/play/10-bool',
    siteName: 'The Q',
    images: [{ url: OG_IMAGE, width: 633, height: 633, alt: TITLE }],
  },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION, images: [OG_IMAGE] },
};

const BOARDS: TenBoolBoard[] = ['wins', 'counter', 'lives'];

export default async function TenBoolDemoPage({ searchParams }: { searchParams: Promise<{ board?: string; bg?: string }> }) {
  const { board, bg } = await searchParams;
  const picked = BOARDS.find((b) => b === board) ?? 'wins';
  return (
    <>
      <style>{'body { background: #000 !important; }'}</style>
      <TenBoolViewer config={{ board: picked, closenessBar: true, ...(bg === 'neon' ? { backgroundStyle: 'neon' as const } : {}) }} />
    </>
  );
}
