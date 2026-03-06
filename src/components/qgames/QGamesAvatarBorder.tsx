'use client';

import { QGAMES_PRIZE_CATALOG } from '@/types/qgames';

interface QGamesAvatarBorderProps {
  avatarValue: string;
  equippedBorder?: string | null;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/** Get the border CSS for a given equipped border prize ID */
function getBorderStyle(borderId: string): React.CSSProperties {
  const prize = QGAMES_PRIZE_CATALOG.find(p => p.id === borderId);
  if (!prize) return {};

  const value = prize.value;

  // Special animated borders
  if (value === 'gold_pulse') {
    return { boxShadow: '0 0 0 3px #F59E0B, 0 0 12px #F59E0B66' };
  }
  if (value === 'rainbow_shift') {
    return { boxShadow: '0 0 0 3px #8B5CF6, 0 0 10px #8B5CF666' };
  }
  if (value === 'prismatic') {
    return { boxShadow: '0 0 0 3px #F59E0B, 0 0 16px #F59E0B88' };
  }

  // Gradient borders — use box-shadow approximation (CSS border-image doesn't work on rounded)
  if (value.startsWith('linear-gradient')) {
    // Extract first color from gradient for box-shadow
    const colorMatch = value.match(/#[0-9A-Fa-f]{6}/);
    const color = colorMatch ? colorMatch[0] : '#8B5CF6';
    return { boxShadow: `0 0 0 3px ${color}, 0 0 8px ${color}66` };
  }

  // Solid color borders
  if (value.startsWith('#')) {
    return { boxShadow: `0 0 0 3px ${value}` };
  }

  return {};
}

/**
 * Avatar with optional equipped border ring.
 * Drop-in replacement for avatar divs — just wrap with this.
 */
export default function QGamesAvatarBorder({
  avatarValue,
  equippedBorder,
  size = 48,
  className = '',
  style = {},
}: QGamesAvatarBorderProps) {
  const borderStyle = equippedBorder ? getBorderStyle(equippedBorder) : {};
  const isSpecial = equippedBorder && ['border_gold_pulse', 'border_rainbow_shift', 'border_prismatic'].includes(equippedBorder);

  return (
    <div
      className={`rounded-full flex items-center justify-center overflow-hidden shrink-0 ${isSpecial ? 'animate-pulse' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.55,
        ...borderStyle,
        ...style,
      }}
    >
      {avatarValue.startsWith('http') ? (
        <img
          src={avatarValue}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : avatarValue}
    </div>
  );
}

export { getBorderStyle };
