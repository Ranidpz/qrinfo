// "10 בול" settings. Every field is optional: codes created before the settings
// existed have no tenboolConfig at all and must play exactly as before, so all
// reads go through the resolvers below instead of touching the fields directly.

// 'ten' = the last beep, on 10.00 itself (by default the beep pitched up).
export type TenBoolSoundSlot = 'start' | 'beep' | 'ten' | 'success' | 'fail';

// The system sounds any slot can use. NOTE: filenames are case-sensitive on Vercel.
export const TENBOOL_SOUND_LIBRARY = {
  start: { label: 'פתיחה', url: '/sounds/tenbool/start.mp3' },
  beep: { label: 'צפצוף', url: '/sounds/tenbool/beep.mp3' },
  success: { label: 'הצלחה', url: '/sounds/tenbool/success.mp3' },
  fail: { label: 'באזר קצר', url: '/sounds/tenbool/fail.mp3' },
  buzzer: { label: 'באזר ארוך', url: '/sounds/raffle/Buzzer.mp3' },
} as const;
export type TenBoolLibrarySound = keyof typeof TENBOOL_SOUND_LIBRARY;

// v1.22.0 also listed 'win' and 'spin', which are byte-identical to success / start.
// Saved choices of those still resolve, to the same file.
const LEGACY_SOUNDS: Record<string, TenBoolLibrarySound> = { win: 'success', spin: 'start' };

// A slot plays a library sound, an uploaded file ('custom'), or nothing ('none').
export type TenBoolSoundChoice = TenBoolLibrarySound | 'custom' | 'none';

const SLOT_DEFAULT: Record<TenBoolSoundSlot, TenBoolLibrarySound> = {
  start: 'start',
  beep: 'beep',
  ten: 'beep',
  success: 'success',
  fail: 'fail',
};

export interface TenBoolSoundSetting {
  choice: TenBoolSoundChoice;
  customUrl?: string; // R2 url, kept even when another choice is picked so switching back is free
  customName?: string;
}

// Google Fonts with Hebrew glyphs. Assistant is already loaded by the app layout.
export const TENBOOL_FONTS = [
  { id: 'assistant', label: 'אסיסטנט', family: 'Assistant' },
  { id: 'rubik', label: 'רוביק', family: 'Rubik' },
  { id: 'heebo', label: 'היבו', family: 'Heebo' },
  { id: 'secular', label: 'סקולר', family: 'Secular One' },
  { id: 'suez', label: 'סואץ', family: 'Suez One' },
  { id: 'varela', label: 'ורלה עגול', family: 'Varela Round' },
] as const;
export type TenBoolFontId = (typeof TENBOOL_FONTS)[number]['id'];

export interface TenBoolConfig {
  sounds?: Partial<Record<TenBoolSoundSlot, TenBoolSoundSetting>>;
  fontId?: TenBoolFontId;
  backgroundColor?: string;
  textColor?: string;
  backgroundImageUrl?: string;
  logoUrl?: string; // PNG (transparency kept), centred above the timer
  logoSize?: number; // % of screen height
  warningCues?: boolean; // 7-10s beeps, red digits and red flash; absent = on
  winFlash?: boolean; // absent = on
  confetti?: boolean; // colourful confetti burst on a hit, on top of the flash; absent = on
  loseFlash?: boolean; // absent = on
  loseColor?: string;
  // Scoreboard in the top corners: 'wins' = a green dot per 10.00 (absent = this),
  // 'counter' = + a misses-since-last-hit number, 'lives' = N lives per player + a gold dot per hit.
  board?: TenBoolBoard;
  lives?: number;
  closenessBar?: boolean; // a line under the timer showing how far off each stop was
}

export type TenBoolBoard = 'off' | 'wins' | 'counter' | 'lives';
export const TENBOOL_BOARDS: { id: TenBoolBoard; label: string }[] = [
  { id: 'wins', label: 'נקודות הצלחה' },
  { id: 'counter', label: 'הצלחות ומונה ניסיונות' },
  { id: 'lives', label: 'חיים' },
  { id: 'off', label: 'כבוי' },
];
export const TENBOOL_LIVES = { min: 1, max: 9, default: 3 };

export const TENBOOL_DEFAULTS = {
  backgroundColor: '#000000',
  textColor: '#ffffff',
  fontId: 'assistant' as TenBoolFontId,
  logoSize: 22,
  loseColor: '#ff0000',
};
export const TENBOOL_LOGO_SIZE = { min: 8, max: 50 };

// End-of-round + countdown behaviour; every switch defaults to on (the original game).
export function tenboolEffects(config: TenBoolConfig | undefined) {
  return {
    warningCues: config?.warningCues !== false,
    winFlash: config?.winFlash !== false,
    confetti: config?.confetti !== false,
    loseFlash: config?.loseFlash !== false,
    loseColor: config?.loseColor || TENBOOL_DEFAULTS.loseColor,
    logoSize: config?.logoSize ?? TENBOOL_DEFAULTS.logoSize,
    board: config?.board ?? ('wins' as TenBoolBoard),
    lives: Math.min(TENBOOL_LIVES.max, Math.max(TENBOOL_LIVES.min, config?.lives ?? TENBOOL_LIVES.default)),
    closenessBar: config?.closenessBar === true,
  };
}

// Out of the box every slot plays its own namesake sound ('ten' plays the beep).
export function tenboolSoundSetting(config: TenBoolConfig | undefined, slot: TenBoolSoundSlot): TenBoolSoundSetting {
  const s = config?.sounds?.[slot];
  if (!s) return { choice: SLOT_DEFAULT[slot] };
  const legacy = LEGACY_SOUNDS[s.choice as string];
  return legacy ? { ...s, choice: legacy } : s;
}

// The beep on 10.00 is the regular beep pitched up, so it stands out from 7-9.
export function tenboolPlaybackRate(config: TenBoolConfig | undefined, slot: TenBoolSoundSlot): number {
  return slot === 'ten' && tenboolSoundSetting(config, slot).choice === 'beep' ? 1.6 : 1;
}

// null = silent (chose 'none', or 'custom' with nothing uploaded yet).
export function resolveTenBoolSoundUrl(config: TenBoolConfig | undefined, slot: TenBoolSoundSlot): string | null {
  const s = tenboolSoundSetting(config, slot);
  if (s.choice === 'none') return null;
  if (s.choice === 'custom') return s.customUrl || null;
  return (TENBOOL_SOUND_LIBRARY[s.choice] ?? TENBOOL_SOUND_LIBRARY[SLOT_DEFAULT[slot]]).url;
}

export function tenboolFont(config: TenBoolConfig | undefined) {
  return TENBOOL_FONTS.find((f) => f.id === config?.fontId) ?? TENBOOL_FONTS[0];
}

export function tenboolFontStylesheet(family: string) {
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@400;700;900&display=swap`;
}
