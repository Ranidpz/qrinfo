import type { TheCodeColor } from '@/types/thecode';

/**
 * The gnome as families and operators see it on screen: body colour + hat colour.
 * Shared by the player app and the admin so "the green gnome with the red hat"
 * always looks the same. Owned by the player-UI work; the admin only imports it.
 */

export const THECODE_COLORS: Record<TheCodeColor, { hex: string; he: string; en: string }> = {
  red: { hex: '#E5484D', he: 'אדום', en: 'red' },
  blue: { hex: '#3B82F6', he: 'כחול', en: 'blue' },
  green: { hex: '#30A46C', he: 'ירוק', en: 'green' },
  yellow: { hex: '#F5C518', he: 'צהוב', en: 'yellow' },
  black: { hex: '#1F2430', he: 'שחור', en: 'black' },
  white: { hex: '#F4F4F5', he: 'לבן', en: 'white' },
  purple: { hex: '#8E4EC6', he: 'סגול', en: 'purple' },
  orange: { hex: '#F76B15', he: 'כתום', en: 'orange' },
};

/** Hat colour names in Hebrew are feminine (מצנפת אדומה). */
const HAT_HE: Record<TheCodeColor, string> = {
  red: 'אדומה', blue: 'כחולה', green: 'ירוקה', yellow: 'צהובה',
  black: 'שחורה', white: 'לבנה', purple: 'סגולה', orange: 'כתומה',
};

/** Hebrew colour word for one part of the gnome ("ירוק" body, "אדומה" hat). */
export function colorNameHe(color: TheCodeColor, part: 'body' | 'hat'): string {
  return part === 'hat' ? HAT_HE[color] : THECODE_COLORS[color].he;
}

/** "גמד ירוק עם מצנפת אדומה" / "green gnome with a red hat". */
export function describeGnome(
  bodyColor: TheCodeColor,
  hatColor: TheCodeColor,
  language: 'he' | 'en' = 'he'
): string {
  if (language === 'en') {
    return `${THECODE_COLORS[bodyColor].en} gnome with a ${THECODE_COLORS[hatColor].en} hat`;
  }
  return `גמד ${THECODE_COLORS[bodyColor].he} עם מצנפת ${HAT_HE[hatColor]}`;
}

interface GnomeFigureProps {
  bodyColor: TheCodeColor;
  hatColor: TheCodeColor;
  size?: number;
  /** Embossed number shown on the base, as on the printed figure. */
  number?: number;
  className?: string;
  title?: string;
  /** Closed eyes, drooping hat — an inactive gnome ("הגמד הזה ישן"). */
  sleeping?: boolean;
  /** Dark silhouette — a gnome not found yet (album). */
  silhouette?: boolean;
}

/** Light colours need a darker outline-side shade, dark ones a lighter rim. */
const SHADE = 'rgba(10, 12, 30, 0.22)';
const SHINE = 'rgba(255, 255, 255, 0.28)';

export default function GnomeFigure({
  bodyColor,
  hatColor,
  size = 96,
  number,
  className,
  title,
  sleeping = false,
  silhouette = false,
}: GnomeFigureProps) {
  const outline = '#11131A';
  const body = silhouette ? '#262C55' : THECODE_COLORS[bodyColor].hex;
  const hat = silhouette ? '#2E3566' : THECODE_COLORS[hatColor].hex;
  const beard = silhouette ? '#323A70' : '#FFFFFF';
  const skin = silhouette ? '#2A3060' : '#F6B996';
  const boots = silhouette ? '#1E2348' : '#5A3A22';
  const line = silhouette ? '#151938' : outline;
  // A sleeping gnome's hat tip flops over to the side.
  const hatPath = sleeping
    ? 'M24 56 C28 40 38 24 56 16 C66 12 76 16 80 26 C74 24 68 26 66 32 C70 40 72 48 72 56 C58 50 38 50 24 56 Z'
    : 'M48 3 C44 10 40 18 36 28 C31 39 26 48 22 56 C36 50 60 50 74 56 C70 46 64 36 60 27 C56 18 52 10 48 3 Z';
  return (
    <svg
      width={size}
      height={size * 1.25}
      viewBox="0 0 96 120"
      className={className}
      role="img"
      aria-label={title || describeGnome(bodyColor, hatColor)}
    >
      {/* base plate */}
      <rect x="14" y="104" width="68" height="12" rx="4" fill="#2A2F3A" stroke={line} strokeWidth="2" />
      {typeof number === 'number' && (
        <text x="48" y="113.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="#C9CEDA">
          {number}
        </text>
      )}
      {/* boots */}
      <ellipse cx="36" cy="103" rx="10" ry="5" fill={boots} stroke={line} strokeWidth="2" />
      <ellipse cx="60" cy="103" rx="10" ry="5" fill={boots} stroke={line} strokeWidth="2" />
      {/* body */}
      <path d="M22 102 C20 78 30 62 48 62 C66 62 76 78 74 102 Z" fill={body} stroke={line} strokeWidth="2.5" />
      <path d="M58 64 C68 70 74 84 74 102 L62 102 C64 86 62 74 58 64 Z" fill={SHADE} />
      <path d="M30 72 C27 80 26 88 26 96" stroke={SHINE} strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* belt */}
      <path d="M23.5 88 C38 92 58 92 72.5 88 L73 94 C58 98 38 98 23 94 Z" fill="#2B2116" stroke={line} strokeWidth="2" />
      <rect x="44" y="88.5" width="8" height="7" rx="1.5" fill="#F4B740" stroke={line} strokeWidth="1.5" />
      {/* mittens */}
      <circle cx="22" cy="84" r="5.5" fill={skin} stroke={line} strokeWidth="2" />
      <circle cx="74" cy="84" r="5.5" fill={skin} stroke={line} strokeWidth="2" />
      {/* beard */}
      <path d="M33 58 C32 73 40 83 48 83 C56 83 64 73 63 58 Z" fill={beard} stroke={line} strokeWidth="2.5" />
      {!silhouette && <path d="M56 62 C59 69 58 76 52 82 C58 79 62 72 62 63 Z" fill="rgba(20,30,70,.10)" />}
      {/* face */}
      <path d="M31 57 C34 65 62 65 65 57 C62 52 34 52 31 57 Z" fill={skin} stroke={line} strokeWidth="2" />
      {!silhouette && (sleeping ? (
        <g stroke={outline} strokeWidth="1.8" strokeLinecap="round" fill="none">
          <path d="M36 57.5 C38 59.5 40.5 59.5 42.5 57.5" />
          <path d="M53.5 57.5 C55.5 59.5 58 59.5 60 57.5" />
        </g>
      ) : (
        <g fill={outline}>
          <ellipse cx="39.5" cy="57.5" rx="2" ry="2.4" />
          <ellipse cx="56.5" cy="57.5" rx="2" ry="2.4" />
          <circle cx="40.2" cy="56.7" r=".7" fill="#fff" />
          <circle cx="57.2" cy="56.7" r=".7" fill="#fff" />
        </g>
      ))}
      {!silhouette && <ellipse cx="34.5" cy="62" rx="3" ry="1.8" fill="#FF8C8C" opacity=".55" />}
      {!silhouette && <ellipse cx="61.5" cy="62" rx="3" ry="1.8" fill="#FF8C8C" opacity=".55" />}
      {/* nose */}
      <ellipse cx="48" cy="62" rx="6.5" ry="5.5" fill={silhouette ? skin : '#F2A07C'} stroke={line} strokeWidth="2.3" />
      {!silhouette && <ellipse cx="46" cy="60.3" rx="2" ry="1.3" fill="#fff" opacity=".6" />}
      {/* hat */}
      <path d={hatPath} fill={hat} stroke={line} strokeWidth="2.5" strokeLinejoin="round" />
      {!sleeping && <path d="M48 8 C45 18 40 30 34 44" stroke={SHINE} strokeWidth="3" strokeLinecap="round" fill="none" />}
      {!sleeping && <path d="M54 22 C58 32 64 42 70 52" stroke={SHADE} strokeWidth="5" strokeLinecap="round" fill="none" />}
      <path d="M22 56 C36 49 60 49 74 56 C74 59 73 60 72 61 C58 55 38 55 24 61 C23 60 22 59 22 56 Z" fill={hat} stroke={line} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M24 60 C38 55 58 55 72 60" stroke={SHADE} strokeWidth="2" fill="none" />
      {silhouette && (
        <text x="48" y="84" textAnchor="middle" fontSize="18" fontWeight="800" fill="#5D66A8">?</text>
      )}
    </svg>
  );
}
