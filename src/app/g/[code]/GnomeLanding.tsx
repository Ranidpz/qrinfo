'use client';

// /g/{code}: find the gnome's adventure, then open the game with this scan pending.
// Known device → the scan is sent at once. New device → register (greeted by this gnome),
// then the scan. Once the scan reached the server the URL becomes /v/{shortId}, so a
// refresh resumes the game instead of scanning the gnome again.

import { useCallback, useEffect, useState } from 'react';
import TheCodeGame, { StaticTheCodeScreen } from '@/components/thecode/live/TheCodeGame';
import { theCodeFont } from '@/components/thecode/live/font';
import { lookupGnome } from '@/components/thecode/live/api';
import type { TheCodeGnomeLookupResponse } from '@/types/thecode-api';

type Found = Extract<TheCodeGnomeLookupResponse, { ok: true }>;

export default function GnomeLanding({ code }: { code: string }) {
  const [state, setState] = useState<'loading' | 'notFound' | 'offline' | Found>('loading');

  useEffect(() => {
    let cancelled = false;
    void lookupGnome(code).then((r) => {
      if (cancelled) return;
      if (!r) setState('offline');
      else if (!r.ok) setState('notFound');
      else setState(r);
    });
    return () => { cancelled = true; };
  }, [code]);

  const shortId = typeof state === 'object' ? state.shortId : null;
  const onConsumed = useCallback(() => {
    if (!shortId) return;
    try {
      window.history.replaceState(null, '', `/v/${shortId}`);
    } catch {
      /* the URL stays /g/{code}; a refresh would just scan the same gnome again (idempotent) */
    }
  }, [shortId]);

  return (
    <div className={`${theCodeFont.variable} fixed inset-0`}>
      {state === 'loading' ? (
        <StaticTheCodeScreen screen={{ kind: 'loading' }} />
      ) : state === 'notFound' ? (
        <StaticTheCodeScreen screen={{ kind: 'notFound', title: 'הגמד הזה כבר לא במשחק', text: 'אולי הוא יצא לחופשה. חפשו גמד אחר, או שאלו בקבלה.' }} />
      ) : state === 'offline' ? (
        <StaticTheCodeScreen screen={{ kind: 'networkError', problem: 'offline' }} />
      ) : (
        <TheCodeGame codeId={state.codeId} pendingScanCode={code} pendingGnome={state.gnome} branding={state.branding} howToPlay={state.howToPlay} onPendingScanConsumed={onConsumed} />
      )}
    </div>
  );
}
