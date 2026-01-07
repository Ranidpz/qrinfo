import { ImagePositionConfig } from '@/types/qvote';

/**
 * Convert ImagePositionConfig to CSS object-position value
 */
export function getObjectPosition(position?: ImagePositionConfig): string {
  if (!position || position.mode === 'natural') {
    return 'center center';
  }
  const x = position.x ?? 0;
  const y = position.y ?? 0;
  return `${50 + x}% ${50 + y}%`;
}

/**
 * Convert ImagePositionConfig to CSS transform value for zoom
 */
export function getImageTransform(position?: ImagePositionConfig): string {
  if (!position || position.mode === 'natural') {
    return 'none';
  }
  const zoom = position.zoom ?? 1;
  if (zoom === 1) return 'none';
  return `scale(${zoom})`;
}

/**
 * Get inline style object for an image with position config
 */
export function getImagePositionStyle(position?: ImagePositionConfig): React.CSSProperties {
  return {
    objectPosition: getObjectPosition(position),
    transform: getImageTransform(position),
  };
}

/**
 * Check if position has custom settings
 */
export function hasCustomPosition(position?: ImagePositionConfig): boolean {
  return position?.mode === 'custom';
}

/**
 * Device configurations for safe zone calculations
 */
export const DEVICE_SAFE_ZONES = {
  mobile: {
    // Safe zone percentages - content should stay within these boundaries
    top: 12,      // 12% from top (for status bar, headers)
    bottom: 18,   // 18% from bottom (for buttons, navigation)
    left: 8,      // 8% from sides
    right: 8,
  },
  tablet: {
    top: 10,
    bottom: 15,
    left: 6,
    right: 6,
  },
  kiosk: {
    top: 8,
    bottom: 12,
    left: 5,
    right: 5,
  },
  desktop: {
    top: 5,
    bottom: 10,
    left: 5,
    right: 5,
  },
} as const;

export type DeviceType = keyof typeof DEVICE_SAFE_ZONES;

/**
 * Get safe zone for a specific device type
 */
export function getSafeZone(device: DeviceType) {
  return DEVICE_SAFE_ZONES[device];
}
