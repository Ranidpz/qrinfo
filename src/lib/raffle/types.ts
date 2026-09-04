// Raffle ("הגרלה") experience — shared types.
// Phase 1 is an isolated front-end demo; the same types are reused in Phase 2
// when participants/winners move to Supabase (server-side only).

export type RaffleDisplayMode = 'names' | 'phones';
export type RaffleBackgroundType = 'color' | 'image' | 'video' | 'gradient';
export type RaffleGradientShape = 'radial' | 'linear';
// 'wheel' = the classic spinning reel. 'codeReveal' = the code is revealed one
// character at a time, left→right, out of a scramble of the real loaded codes.
export type RaffleAnimationStyle = 'wheel' | 'codeReveal';
// What the participant list actually holds. 'people' = name + phone rows (the
// original raffle). 'codes' = one code per row, no name and no phone.
// Absent means 'people', so every raffle created before this option existed
// keeps behaving exactly as it did.
export type RaffleListType = 'people' | 'codes';
// 'buzzer' / 'win' are the bundled presets; 'custom' uses customWinSoundUrl.
export type RaffleWinSound = 'buzzer' | 'win' | 'custom';
// Start-of-draw sound: the bundled spin whoosh (default), either end sound, or
// an uploaded file.
export type RaffleStartSound = 'spin' | 'win' | 'buzzer' | 'custom';

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
  // backgroundType 'gradient': two colours. Radial = `gradientFrom` at the
  // centre fading to `gradientTo` at the edges; linear = top → bottom.
  gradientFrom?: string;
  gradientTo?: string;
  gradientShape?: RaffleGradientShape;
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
  // Whether the list holds people (name + phone) or plain codes.
  listType?: RaffleListType;
  // Which on-screen animation runs. Absent = 'wheel' (every existing raffle).
  animationStyle?: RaffleAnimationStyle;
  // codeReveal only — base pace per locked character (ms). The real schedule
  // starts faster and slows down on the last two characters for suspense.
  codeLockMs?: number;
  // codeReveal only — the synthesized ticking + "pop" layer. Independent of
  // `soundsEnabled` (which is the master switch for every sound).
  codeTickSounds?: boolean;
  // Shared secret for the public big-screen link (/raffle/{shortId}?token=).
  // Generated when the raffle is first created. Gates the names + draw APIs.
  token?: string;
  // Optional prize label per draw, in DRAW ORDER: prizes[0] is shown under the
  // first winner (rank 1), prizes[1] under the second, and so on. An empty or
  // missing entry shows nothing. Resetting the winners restarts the ranks, so
  // the labels line up again for the live run after a rehearsal.
  prizes?: string[];
  // Sound on the press that starts a draw. Absent = on (both styles).
  startSound?: boolean;
  // Which sound that is. Absent = the bundled spin whoosh.
  startSoundKind?: RaffleStartSound;
  customStartSoundUrl?: string;
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
  listType: 'people',
  animationStyle: 'wheel',
  codeLockMs: 1600,
  codeTickSounds: true,
};

// codeReveal pace bounds (ms per character) — kept here so the settings panel
// and the animation agree on the allowed range.
export const CODE_LOCK_MS_MIN = 800;
export const CODE_LOCK_MS_MAX = 3000;
export const CODE_LOCK_MS_DEFAULT = 1600;

// Resolve the URL of the configured winner sound.
export function resolveWinSoundUrl(config: RaffleConfig): string {
  if (config.winSound === 'custom' && config.customWinSoundUrl) {
    return config.customWinSoundUrl;
  }
  if (config.winSound === 'buzzer') return RAFFLE_WIN_SOUND_PRESETS.buzzer;
  return RAFFLE_WIN_SOUND_PRESETS.win;
}

// Defaults sampled from a typical stage backdrop (deep navy, slightly lighter
// at the centre) so picking "gradient" looks right before touching a colour.
export const DEFAULT_GRADIENT_FROM = '#232460';
export const DEFAULT_GRADIENT_TO = '#111236';

// CSS for the big-screen background — ONE place for both animations.
export function raffleBackgroundStyle(
  config: Pick<
    RaffleConfig,
    'backgroundType' | 'backgroundColor' | 'backgroundImageUrl' | 'gradientFrom' | 'gradientTo' | 'gradientShape'
  >
): Record<string, string> {
  if (config.backgroundType === 'image' && config.backgroundImageUrl) {
    return {
      backgroundImage: `url(${config.backgroundImageUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  if (config.backgroundType === 'gradient') {
    const from = config.gradientFrom || DEFAULT_GRADIENT_FROM;
    const to = config.gradientTo || DEFAULT_GRADIENT_TO;
    return {
      backgroundColor: to,
      backgroundImage:
        (config.gradientShape ?? 'radial') === 'linear'
          ? `linear-gradient(180deg, ${from} 0%, ${to} 100%)`
          : `radial-gradient(ellipse at center, ${from} 0%, ${to} 75%)`,
    };
  }
  return { backgroundColor: config.backgroundColor };
}

// Whether the start-of-draw sound plays for this config (see `startSound`).
export function startSoundEnabled(config: Pick<RaffleConfig, 'startSound'>): boolean {
  return config.startSound ?? true;
}

// URL of the configured start sound (falls back to the spin whoosh).
export function resolveStartSoundUrl(
  config: Pick<RaffleConfig, 'startSoundKind' | 'customStartSoundUrl'>
): string {
  const kind = config.startSoundKind ?? 'spin';
  if (kind === 'custom' && config.customStartSoundUrl) return config.customStartSoundUrl;
  if (kind === 'win') return RAFFLE_WIN_SOUND_PRESETS.win;
  if (kind === 'buzzer') return RAFFLE_WIN_SOUND_PRESETS.buzzer;
  return RAFFLE_SPIN_SOUND;
}

// Rank the NEXT draw will get, from the winners recorded so far. Ranks are
// assigned server-side as count + 1, so this mirrors what the server will do.
export function nextDrawRank(winners: { rank: number }[]): number {
  return winners.reduce((m, w) => Math.max(m, w.rank), 0) + 1;
}

// Prize label for a winner of the given rank (1-based), or '' when none is set.
export function prizeForRank(config: Pick<RaffleConfig, 'prizes'>, rank: number): string {
  const list = config.prizes;
  if (!Array.isArray(list) || rank < 1) return '';
  return String(list[rank - 1] ?? '').trim();
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
