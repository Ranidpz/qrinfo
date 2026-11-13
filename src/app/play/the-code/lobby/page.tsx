import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { theCodeFont } from '@/components/thecode/live/font';
import TheCodeLobbyDemo from './TheCodeLobbyDemo';

// קוד הגמדים — the big screen as a DEMO for Rani's approval: fake teams that change by
// themselves (no server). The live board (src/app/lobby/thecode/[shortId]) stays as it is
// until this is approved. Like the other demos: local `next dev` only, production → guide.

export const metadata: Metadata = {
  title: 'קוד הגמדים — המסך הגדול (הדגמה)',
  robots: { index: false, follow: false },
};

export default function TheCodeLobbyDemoPage() {
  if (process.env.NODE_ENV === 'production') redirect('/play/the-code/guide');
  return (
    <div className={theCodeFont.variable}>
      <TheCodeLobbyDemo />
    </div>
  );
}
