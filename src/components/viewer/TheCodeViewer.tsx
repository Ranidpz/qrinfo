'use client';

// /v/{shortId} for a "קוד הגמדים" code = the game home: resume the current target, scanner, board.
// `fixed` (not h-full / min-h-screen): ViewerClient's wrapper is min-h-screen, so a h-full
// child would collapse; the top follows the PWA banner (`--pwa-banner-h`), never hidden.
//
// `?src=lobby` = this phone scanned the QR on the big screen: report it ONCE (even before the
// group registers — the screen starts its "how to play" scene), then drop the flag from the URL
// so a refresh never reports again.
//
// `?join={recoveryCode}` = the QR a staff member showed a returning group: the game recovers
// the group at once, then the code is dropped from the URL (replaceState) so it does not stay in
// the address bar or the history.

import { useCallback, useEffect, useState } from 'react';
import { cleanRecoveryCode } from '@/lib/thecode/server/codes';
import TheCodeGame from '@/components/thecode/live/TheCodeGame';
import { theCodeFont } from '@/components/thecode/live/font';
import { reportLobbyScan } from '@/components/thecode/live/api';

/** Survives React's dev double-mount; one report per page load. */
const reported = new Set<string>();

function dropParam(name: string) {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(name)) return;
    url.searchParams.delete(name);
    window.history.replaceState(window.history.state, '', url.pathname + (url.search ? url.search : '') + url.hash);
  } catch { /* nothing to clean */ }
}

export default function TheCodeViewer({ codeId }: { codeId: string }) {
  // Read once, before the game mounts (this component is client-only).
  const [joinCode] = useState(() => {
    try {
      const code = cleanRecoveryCode(new URL(window.location.href).searchParams.get('join'));
      if (!code) dropParam('join'); // junk in the URL: nothing to recover, nothing to keep
      return code;
    } catch {
      return null;
    }
  });
  const onJoinConsumed = useCallback(() => dropParam('join'), []);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('src') !== 'lobby') return;
      url.searchParams.delete('src');
      window.history.replaceState(window.history.state, '', url.pathname + (url.search ? url.search : '') + url.hash);
    } catch {
      return;
    }
    if (reported.has(codeId)) return;
    reported.add(codeId);
    void reportLobbyScan(codeId);
  }, [codeId]);

  return (
    <div className={`${theCodeFont.variable} fixed inset-x-0 bottom-0 z-10`} style={{ top: 'var(--pwa-banner-h, 0px)' }}>
      <TheCodeGame codeId={codeId} pendingRecoveryCode={joinCode || undefined} onPendingRecoveryConsumed={onJoinConsumed} />
    </div>
  );
}
