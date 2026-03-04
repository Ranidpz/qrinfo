import { QGamesPlayer } from '@/types/qgames';

const SESSION_KEY_PREFIX = 'qgames_player_';

function getSessionKey(codeId: string): string {
  return `${SESSION_KEY_PREFIX}${codeId}`;
}

/** Save player profile to localStorage */
export function savePlayerSession(codeId: string, player: QGamesPlayer): void {
  try {
    localStorage.setItem(getSessionKey(codeId), JSON.stringify(player));
  } catch {
    // localStorage full or unavailable
  }
}

/** Load player profile from localStorage */
export function loadPlayerSession(codeId: string): QGamesPlayer | null {
  try {
    const raw = localStorage.getItem(getSessionKey(codeId));
    if (!raw) return null;
    return JSON.parse(raw) as QGamesPlayer;
  } catch {
    return null;
  }
}

/** Clear player session */
export function clearPlayerSession(codeId: string): void {
  try {
    localStorage.removeItem(getSessionKey(codeId));
  } catch {
    // Ignore
  }
}
