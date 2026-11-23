'use client';

// /g/{code}: find the gnome's adventure, then open the game with this scan pending.
// Known device → the scan is sent at once. New device → register (greeted by this gnome),
// then the scan. Once the scan reached the server the URL becomes /v/{shortId}, so a
// refresh resumes the game instead of scanning the gnome again.

import { useCallback, useEffect, useState } from 'react';
import TheCodeGame, { StaticTheCodeScreen } from '@/components/thecode/live/TheCodeGame';
import TheCodeFreeGame from '@/components/thecode/free/TheCodeFreeGame';
import { activeAuth, loadIdentity } from '@/components/thecode/live/identity';
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
      ) : state.mode === 'free' ? (
        <FreeGnomeEntry found={state} code={code} onConsumed={onConsumed} />
      ) : (
        <TheCodeGame codeId={state.codeId} pendingScanCode={code} pendingGnome={state.gnome} branding={state.branding} howToPlay={state.howToPlay} howToPlayTheme={state.howToPlayTheme} selfie={state.selfie} onPendingScanConsumed={onConsumed} />
      )}
    </div>
  );
}

/**
 * Free mode: a phone that already has a group scans this gnome at once. A new phone goes to the
 * game page /v/{shortId} instead — that is the page the game is installed from (its manifest), and
 * where the group registers (Rani 23.11.2026: install → register → the screen → the magician).
 */
function FreeGnomeEntry({ found, code, onConsumed }: { found: Found; code: string; onConsumed(): void }) {
  const [known, setKnown] = useState<boolean | null>(null);
  useEffect(() => {
    const has = !!activeAuth(loadIdentity(found.codeId).identity);
    setKnown(has);
    if (!has && found.shortId) window.location.replace(`/v/${found.shortId}`);
  }, [found.codeId, found.shortId]);
  if (!known) return <StaticTheCodeScreen screen={{ kind: 'loading' }} />;
  return (
    <TheCodeFreeGame codeId={found.codeId} pendingScanCode={code} pendingGnome={found.gnome} branding={found.branding}
      selfie={found.selfie} screenHint={found.screenHint} onPendingScanConsumed={onConsumed} />
  );
}
