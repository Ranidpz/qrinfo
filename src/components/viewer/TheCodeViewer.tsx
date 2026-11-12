'use client';

// /v/{shortId} for a "הקוד" code = the game home: resume the current target, scanner, board.
// `fixed` (not h-full / min-h-screen): ViewerClient's wrapper is min-h-screen, so a h-full
// child would collapse; the top follows the PWA banner (`--pwa-banner-h`), never hidden.

import TheCodeGame from '@/components/thecode/live/TheCodeGame';
import { theCodeFont } from '@/components/thecode/live/font';

export default function TheCodeViewer({ codeId }: { codeId: string }) {
  return (
    <div className={`${theCodeFont.variable} fixed inset-x-0 bottom-0 z-10`} style={{ top: 'var(--pwa-banner-h, 0px)' }}>
      <TheCodeGame codeId={codeId} />
    </div>
  );
}
