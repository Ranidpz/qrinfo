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
}

export default function GnomeFigure({
  bodyColor,
  hatColor,
  size = 96,
  number,
  className,
  title,
}: GnomeFigureProps) {
  const body = THECODE_COLORS[bodyColor].hex;
  const hat = THECODE_COLORS[hatColor].hex;
  const outline = '#11131A';
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
      <rect x="14" y="104" width="68" height="12" rx="4" fill="#2A2F3A" stroke={outline} strokeWidth="2" />
      {typeof number === 'number' && (
        <text x="48" y="113.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="#C9CEDA">
          {number}
        </text>
      )}
      {/* body */}
      <path d="M22 104 C20 78 30 62 48 62 C66 62 76 78 74 104 Z" fill={body} stroke={outline} strokeWidth="2.5" />
      {/* beard */}
      <path d="M30 60 C30 84 40 94 48 94 C56 94 66 84 66 60 Z" fill="#FFFFFF" stroke={outline} strokeWidth="2.5" />
      {/* nose */}
      <ellipse cx="48" cy="60" rx="7" ry="6" fill="#F2B38C" stroke={outline} strokeWidth="2.5" />
      {/* hat */}
      <path d="M48 4 C40 24 28 44 22 58 C36 52 60 52 74 58 C68 44 56 24 48 4 Z" fill={hat} stroke={outline} strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}
