import type { Metadata } from 'next';
import TenBoolViewer from '@/components/viewer/TenBoolViewer';
import type { TenBoolBoard } from '@/types/tenbool';

// Public "10 בול" demo: the real game with default settings, no code / Firestore behind it.
// The landing page embeds it in an iframe (the viewer is fixed full-viewport and listens for
// Enter/Space on window, so a frame keeps it from taking over the page), and links here for
// full screen. Outside the [locale] tree (middleware skips /play/) so no app shell or auth loads.

export const metadata: Metadata = {
  title: '10 בול – דמו',
  // The landing pages are the indexable ones; this is just the game surface
  robots: { index: false, follow: true },
};

const BOARDS: TenBoolBoard[] = ['wins', 'counter', 'lives'];

export default async function TenBoolDemoPage({ searchParams }: { searchParams: Promise<{ board?: string }> }) {
  const { board } = await searchParams;
  const picked = BOARDS.find((b) => b === board) ?? 'wins';
  return (
    <>
      <style>{'body { background: #000 !important; }'}</style>
      <TenBoolViewer config={{ board: picked, closenessBar: true }} />
    </>
  );
}
