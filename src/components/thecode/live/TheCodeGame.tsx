'use client';

// הקוד — the live game: useTheCodeGame (server) → TheCodePlayer (screens).
// Fills its parent; the route decides the frame (/v/{shortId}, /g/{code}).

import TheCodePlayer from '../player/TheCodePlayer';
import type { PlayerScreen, PlayerState } from '../player/types';
import { useTheCodeGame, type UseTheCodeGameOptions } from './useTheCodeGame';
import { HEBREW_LETTERS } from '@/lib/thecode/letters';

const NOOP = () => {};

/** A fixed, profile-less screen (loading / not found) rendered with the game's own look. */
export function StaticTheCodeScreen({ screen }: { screen: PlayerScreen }) {
  const state: PlayerState = {
    screen,
    venueName: '',
    profile: null,
    profiles: [],
    collector: null,
    target: null,
    riddle: null,
    correct: null,
    arrange: null,
    suitcase: null,
    summary: null,
    alphabet: HEBREW_LETTERS,
    muted: true,
  };
  return (
    <TheCodePlayer
      state={state}
      callbacks={{
        onRegister: NOOP, onRecover: NOOP, onRegisterMode: NOOP, onLocationHint: NOOP, onRiddleHint: NOOP,
        onPickLetter: NOOP, onSubmitLetter: NOOP, onContinue: NOOP, onArrangePlace: NOOP, onArrangeRemove: NOOP,
        onArrangeHelp: NOOP, onOpenSuitcase: NOOP, onShowSummary: NOOP, onNewSuitcase: NOOP, onSwitchProfile: NOOP,
        onAddProfile: NOOP, onToggleMute: NOOP, onRetry: () => window.location.reload(), onOpenScanner: NOOP,
        onCloseScanner: NOOP, onScanCode: NOOP, onOpenInBrowser: NOOP, onDismissInAppBrowser: NOOP,
      }}
    />
  );
}

export default function TheCodeGame(props: UseTheCodeGameOptions) {
  const { state, callbacks } = useTheCodeGame(props);
  return <TheCodePlayer state={state} callbacks={callbacks} />;
}
