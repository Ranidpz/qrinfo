import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { theCodeFont } from '@/components/thecode/live/font';
import TheCodeFreeLobbyDemo from './TheCodeFreeLobbyDemo';

// קוד הגמדים — the big screen of the "free game" as a DEMO (no server): the SAME live stage
// (LobbyStage + selfie parade) with the new "a group joined" celebration on top.
// Like the other demos: local `next dev` only, production → guide.

export const metadata: Metadata = {
  title: 'קוד הגמדים — המסך הגדול, משחק חופשי (הדגמה)',
  robots: { index: false, follow: false },
};

export default function TheCodeFreeLobbyDemoPage() {
  if (process.env.NODE_ENV === 'production') redirect('/play/the-code/guide');
  return (
    <div className={theCodeFont.variable}>
      <TheCodeFreeLobbyDemo />
    </div>
  );
}
