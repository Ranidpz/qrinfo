'use client';

// קוד הגמדים — the live FREE game: useTheCodeFreeGame (server) → FreeGamePlayer (screens).
// Fills its parent; the route decides the frame (/v/{shortId}, /g/{code}).

import FreeGamePlayer from './FreeGamePlayer';
import { useTheCodeFreeGame, type UseTheCodeFreeGameOptions } from './useTheCodeFreeGame';

export default function TheCodeFreeGame(props: UseTheCodeFreeGameOptions) {
  const { view, callbacks } = useTheCodeFreeGame(props);
  return <FreeGamePlayer view={view} callbacks={callbacks} />;
}
