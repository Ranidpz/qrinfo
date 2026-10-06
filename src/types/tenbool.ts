// "10 בול" settings. Every field is optional: codes created before the settings
// existed have no tenboolConfig at all and must play exactly as before, so all
// reads go through the resolvers below instead of touching the fields directly.

export type TenBoolSoundSlot = 'start' | 'beep' | 'success' | 'fail';

// The system sounds any slot can use. NOTE: filenames are case-sensitive on Vercel.
export const TENBOOL_SOUND_LIBRARY = {
  start: { label: 'פתיחה', url: '/sounds/tenbool/start.mp3' },
  beep: { label: 'צפצוף', url: '/sounds/tenbool/beep.mp3' },
  success: { label: 'הצלחה', url: '/sounds/tenbool/success.mp3' },
  fail: { label: 'כישלון', url: '/sounds/tenbool/fail.mp3' },
  buzzer: { label: 'באזר', url: '/sounds/raffle/Buzzer.mp3' },
  win: { label: 'זכייה', url: '/sounds/raffle/Win.mp3' },
  spin: { label: 'סיבוב', url: '/sounds/raffle/spin.mp3' },
} as const;
export type TenBoolLibrarySound = keyof typeof TENBOOL_SOUND_LIBRARY;

// A slot plays a library sound, an uploaded file ('custom'), or nothing ('none').
export type TenBoolSoundChoice = TenBoolLibrarySound | 'custom' | 'none';

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
}

export const TENBOOL_DEFAULTS = {
  backgroundColor: '#000000',
  textColor: '#ffffff',
  fontId: 'assistant' as TenBoolFontId,
};

// Out of the box every slot plays its own namesake sound.
export function tenboolSoundSetting(config: TenBoolConfig | undefined, slot: TenBoolSoundSlot): TenBoolSoundSetting {
  return config?.sounds?.[slot] ?? { choice: slot };
}

// null = silent (chose 'none', or 'custom' with nothing uploaded yet).
export function resolveTenBoolSoundUrl(config: TenBoolConfig | undefined, slot: TenBoolSoundSlot): string | null {
  const s = tenboolSoundSetting(config, slot);
  if (s.choice === 'none') return null;
  if (s.choice === 'custom') return s.customUrl || null;
  return TENBOOL_SOUND_LIBRARY[s.choice]?.url ?? TENBOOL_SOUND_LIBRARY[slot].url;
}

export function tenboolFont(config: TenBoolConfig | undefined) {
  return TENBOOL_FONTS.find((f) => f.id === config?.fontId) ?? TENBOOL_FONTS[0];
}

export function tenboolFontStylesheet(family: string) {
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@400;700;900&display=swap`;
}
