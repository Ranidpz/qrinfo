// Raffle ("הגרלה") experience — shared types.
// Phase 1 is an isolated front-end demo; the same types are reused in Phase 2
// when participants/winners move to Supabase (server-side only).

export type RaffleDisplayMode = 'names' | 'phones';
export type RaffleBackgroundType = 'color' | 'image' | 'video';
// 'buzzer' / 'win' are the bundled presets; 'custom' uses customWinSoundUrl.
export type RaffleWinSound = 'buzzer' | 'win' | 'custom';

// NOTE: filenames are case-sensitive on Vercel/Linux — keep exact casing.
export const RAFFLE_SPIN_SOUND = '/sounds/raffle/spin.mp3';
// Dedicated "you pressed to stop early" buzzer (fixed, not the configurable win sound).
export const RAFFLE_BUZZER_SOUND = '/sounds/raffle/Buzzer.mp3';
export const RAFFLE_WIN_SOUND_PRESETS: Record<'buzzer' | 'win', string> = {
  buzzer: '/sounds/raffle/Buzzer.mp3',
  win: '/sounds/raffle/Win.mp3',
};

export interface RaffleParticipant {
  // Stable unique id. In Phase 2 this is derived from the normalized phone
  // (phone is the unique key), so duplicate names map to distinct ids.
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  // How many times this row may win (prizes: stock; people: usually 1).
  quantity: number;
  // Remaining wins available; row drops out of the pool when it hits 0.
  remaining: number;
}

export interface RaffleWinner {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  rank: number;
  wonAt: number; // epoch ms
}

export interface RaffleConfig {
  // Idle screen title (editable) + its shine color (default silver/nickel).
  idleTitle?: string;
  idleColor?: string;
  fontColor: string;
  winnerColor: string;
  backgroundType: RaffleBackgroundType;
  backgroundColor: string;
  backgroundImageUrl?: string;
  backgroundVideoUrl?: string;
  // 'phones' is honored only for the authenticated owner; the public link is
  // always forced to 'names' so phone numbers never leave the server.
  displayMode: RaffleDisplayMode;
  // When false, a winner is removed from the pool after winning once.
  // When true, a row stays until its remaining quantity is exhausted.
  allowRepeat: boolean;
  soundsEnabled: boolean;
  // Which sound plays when the reel lands on a winner.
  winSound: RaffleWinSound;
  customWinSoundUrl?: string;
  // Shared secret for the public big-screen link (/raffle/{shortId}?token=).
  // Generated when the raffle is first created. Gates the names + draw APIs.
  token?: string;
}

export const DEFAULT_RAFFLE_CONFIG: RaffleConfig = {
  idleTitle: 'הגרלה',
  idleColor: '#C9CED6', // silver / nickel
  fontColor: '#ffffff',
  winnerColor: '#FFD60A',
  backgroundType: 'color',
  backgroundColor: '#000000',
  displayMode: 'names',
  allowRepeat: true,
  soundsEnabled: true,
  winSound: 'win',
};

// Resolve the URL of the configured winner sound.
export function resolveWinSoundUrl(config: RaffleConfig): string {
  if (config.winSound === 'custom' && config.customWinSoundUrl) {
    return config.customWinSoundUrl;
  }
  if (config.winSound === 'buzzer') return RAFFLE_WIN_SOUND_PRESETS.buzzer;
  return RAFFLE_WIN_SOUND_PRESETS.win;
}

export function fullName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`.trim();
}

export function participantLabel(
  p: { firstName: string; lastName: string; phone: string },
  mode: RaffleDisplayMode
): string {
  return mode === 'phones' ? p.phone : fullName(p);
}
