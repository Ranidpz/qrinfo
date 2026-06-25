// Country list for the Selfie Beam — participants tag their photo with a country
// so a small flag can appear next to it on the big-screen beam.
//
// `code` doubles as the flag asset filename in /public/flags/{code}.svg (ISO 3166-1
// alpha-2 for real countries). "m25" is a custom entry (Maccabiah logo) that has no
// official country — its flag asset is supplied separately.

export interface SelfiebeamCountry {
  code: string;      // unique id + flag asset filename (e.g. 'us', 'il', 'm25')
  nameHe: string;
  nameEn: string;
  flag: string;      // public path to the flag asset, e.g. '/flags/us.svg'
  custom?: boolean;  // true for non-ISO entries (e.g. M25)
  aliases?: string[]; // extra search terms (he/en) to widen autocomplete matches
}

// Stored on each UserGalleryImage. Self-contained (name + flag baked in) so the beam
// can render without re-resolving against this list.
export interface SelfiebeamCountryTag {
  code: string;
  name: string; // display name in the uploader's locale at upload time
  flag: string; // '/flags/{code}.svg'
}

const f = (code: string) => `/flags/${code}.svg`;

export const SELFIEBEAM_COUNTRIES: SelfiebeamCountry[] = [
  { code: 'us', nameHe: 'ארה"ב', nameEn: 'USA', flag: f('us'), aliases: ['usa', 'united states', 'america', 'ארצות הברית', 'ארהב'] },
  { code: 'ph', nameHe: 'פיליפינים', nameEn: 'Philippines', flag: f('ph'), aliases: ['philippines', 'pilipinas'] },
  { code: 'ar', nameHe: 'ארגנטינה', nameEn: 'Argentina', flag: f('ar'), aliases: ['argentina'] },
  { code: 'ua', nameHe: 'אוקראינה', nameEn: 'Ukraine', flag: f('ua'), aliases: ['ukraine'] },
  { code: 'hu', nameHe: 'הונגריה', nameEn: 'Hungary', flag: f('hu'), aliases: ['hungary'] },
  { code: 'ch', nameHe: 'שוויץ', nameEn: 'Switzerland', flag: f('ch'), aliases: ['switzerland', 'swiss'] },
  { code: 'co', nameHe: 'קולומביה', nameEn: 'Colombia', flag: f('co'), aliases: ['colombia'] },
  { code: 'sk', nameHe: 'סלובקיה', nameEn: 'Slovakia', flag: f('sk'), aliases: ['slovakia'] },
  { code: 'in', nameHe: 'הודו', nameEn: 'India', flag: f('in'), aliases: ['india'] },
  { code: 'cr', nameHe: 'קוסטה ריקה', nameEn: 'Costa Rica', flag: f('cr'), aliases: ['costa rica'] },
  { code: 'cu', nameHe: 'קובה', nameEn: 'Cuba', flag: f('cu'), aliases: ['cuba'] },
  { code: 'ro', nameHe: 'רומניה', nameEn: 'Romania', flag: f('ro'), aliases: ['romania', 'רומינה'] },
  { code: 'mx', nameHe: 'מקסיקו', nameEn: 'Mexico', flag: f('mx'), aliases: ['mexico'] },
  { code: 'de', nameHe: 'גרמניה', nameEn: 'Germany', flag: f('de'), aliases: ['germany', 'deutschland'] },
  { code: 'br', nameHe: 'ברזיל', nameEn: 'Brazil', flag: f('br'), aliases: ['brazil', 'brasil'] },
  { code: 'es', nameHe: 'ספרד', nameEn: 'Spain', flag: f('es'), aliases: ['spain', 'espana'] },
  { code: 'fr', nameHe: 'צרפת', nameEn: 'France', flag: f('fr'), aliases: ['france'] },
  { code: 'il', nameHe: 'ישראל', nameEn: 'Israel', flag: f('il'), aliases: ['israel'] },
  // Custom — Maccabiah delegations without an official country flag. Uses the Maccabiah
  // logo. Asset: /public/flags/m25.png (save the official logo there; m25.svg is a fallback placeholder).
  { code: 'm25', nameHe: 'מכביה (M25)', nameEn: 'Maccabiah (M25)', flag: '/flags/m25.png', custom: true, aliases: ['maccabiah', 'maccabi', 'מכביה', 'מכבייה', 'm25'] },
];

const byCode = new Map(SELFIEBEAM_COUNTRIES.map((c) => [c.code, c]));

export function findCountryByCode(code?: string | null): SelfiebeamCountry | undefined {
  if (!code) return undefined;
  return byCode.get(code);
}

// Localised display name for a country in the given locale.
export function countryName(country: SelfiebeamCountry, locale: 'he' | 'en'): string {
  return locale === 'he' ? country.nameHe : country.nameEn;
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/["'`׳״]/g, '');
}

// Autocomplete search across Hebrew/English names + aliases. Empty query returns the
// full list (so the dropdown can show every option on focus).
export function searchCountries(query: string, limit = 50): SelfiebeamCountry[] {
  const q = normalize(query);
  if (!q) return SELFIEBEAM_COUNTRIES.slice(0, limit);

  const scored: Array<{ c: SelfiebeamCountry; score: number }> = [];
  for (const c of SELFIEBEAM_COUNTRIES) {
    const haystacks = [c.nameHe, c.nameEn, ...(c.aliases || [])].map(normalize);
    let best = Infinity;
    for (const h of haystacks) {
      if (h === q) { best = Math.min(best, 0); }
      else if (h.startsWith(q)) { best = Math.min(best, 1); }
      else if (h.includes(q)) { best = Math.min(best, 2); }
    }
    if (best < Infinity) scored.push({ c, score: best });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((s) => s.c);
}

// Build the compact, self-contained tag stored on a gallery image.
export function toCountryTag(country: SelfiebeamCountry, locale: 'he' | 'en'): SelfiebeamCountryTag {
  return { code: country.code, name: countryName(country, locale), flag: country.flag };
}
