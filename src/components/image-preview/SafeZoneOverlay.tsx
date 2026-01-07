'use client';

interface SafeZoneOverlayProps {
  safeZone?: {
    top: number;    // percentage from top
    bottom: number; // percentage from bottom
    left: number;   // percentage from left
    right: number;  // percentage from right
  };
  showLabel?: boolean;
  label?: string;
  color?: 'green' | 'blue' | 'yellow';
}

const colorClasses = {
  green: {
    border: 'border-green-400',
    bg: 'bg-green-500/80',
    overlay: 'border-black/30',
  },
  blue: {
    border: 'border-blue-400',
    bg: 'bg-blue-500/80',
    overlay: 'border-black/30',
  },
  yellow: {
    border: 'border-yellow-400',
    bg: 'bg-yellow-500/80',
    overlay: 'border-black/30',
  },
};

export default function SafeZoneOverlay({
  safeZone = { top: 15, bottom: 20, left: 10, right: 10 },
  showLabel = true,
  label = 'Safe Zone',
  color = 'green',
}: SafeZoneOverlayProps) {
  const colors = colorClasses[color];

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Dark overlay on unsafe areas - using pseudo-elements approach */}
      <div
        className={`absolute inset-0 ${colors.overlay}`}
        style={{
          borderTopWidth: `${safeZone.top}%`,
          borderBottomWidth: `${safeZone.bottom}%`,
          borderLeftWidth: `${safeZone.left}%`,
          borderRightWidth: `${safeZone.right}%`,
          borderStyle: 'solid',
          borderColor: 'rgba(0, 0, 0, 0.3)',
        }}
      />

      {/* Safe zone border */}
      <div
        className={`absolute border-2 border-dashed ${colors.border}`}
        style={{
          top: `${safeZone.top}%`,
          left: `${safeZone.left}%`,
          right: `${safeZone.right}%`,
          bottom: `${safeZone.bottom}%`,
        }}
      >
        {/* Corner marks */}
        <div className={`absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 ${colors.border}`} />
        <div className={`absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 ${colors.border}`} />
        <div className={`absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 ${colors.border}`} />
        <div className={`absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 ${colors.border}`} />

        {/* Label */}
        {showLabel && (
          <div className={`absolute top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 ${colors.bg} text-white text-xs rounded whitespace-nowrap`}>
            {label}
          </div>
        )}
      </div>
    </div>
  );
}
