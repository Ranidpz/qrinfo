/**
 * Phone number utilities for Israeli phone numbers
 */

// Israeli phone prefixes
const ISRAELI_MOBILE_PREFIXES = ['050', '051', '052', '053', '054', '055', '056', '057', '058', '059'];
const ISRAELI_LANDLINE_PREFIXES = ['02', '03', '04', '08', '09', '072', '073', '074', '076', '077', '078', '079'];

/**
 * Normalize phone number to international format (+972...)
 * Handles various Israeli phone formats:
 * - 0501234567 -> +972501234567
 * - 050-123-4567 -> +972501234567
 * - +972501234567 -> +972501234567
 * - 972501234567 -> +972501234567
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // If starts with +972, it's already normalized
  if (cleaned.startsWith('+972')) {
    return cleaned;
  }

  // If starts with 972 (without +), add +
  if (cleaned.startsWith('972')) {
    return '+' + cleaned;
  }

  // If starts with 0, replace with +972
  if (cleaned.startsWith('0')) {
    return '+972' + cleaned.substring(1);
  }

  // If it's just digits without prefix, assume Israeli mobile and add +972
  if (/^\d{9}$/.test(cleaned)) {
    return '+972' + cleaned;
  }

  // Return with + if not already there
  return cleaned.startsWith('+') ? cleaned : '+' + cleaned;
}

/**
 * Validate if phone number is a valid Israeli mobile number
 */
export function isValidIsraeliMobile(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);

  // Should be +972 followed by 9 digits
  if (!/^\+972\d{9}$/.test(normalized)) {
    return false;
  }

  // Check if it's a valid mobile prefix (without the leading 0)
  const prefix = '0' + normalized.substring(4, 6);
  return ISRAELI_MOBILE_PREFIXES.includes(prefix);
}

/**
 * Validate if phone number is a valid Israeli phone (mobile or landline)
 */
export function isValidIsraeliPhone(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);

  // Should be +972 followed by 8-9 digits
  if (!/^\+972\d{8,9}$/.test(normalized)) {
    return false;
  }

  return true;
}

/**
 * Format phone for display (Israeli format)
 * +972501234567 -> 050-123-4567
 */
export function formatPhoneForDisplay(phone: string): string {
  const normalized = normalizePhoneNumber(phone);

  if (!normalized.startsWith('+972')) {
    return phone; // Return original if not Israeli
  }

  // Convert +972501234567 to 0501234567
  const localNumber = '0' + normalized.substring(4);

  // Format as 050-123-4567
  if (localNumber.length === 10) {
    return `${localNumber.substring(0, 3)}-${localNumber.substring(3, 6)}-${localNumber.substring(6)}`;
  }

  return localNumber;
}

/**
 * Mask phone number for privacy
 * +972501234567 -> 050-***-4567
 */
export function maskPhoneNumber(phone: string): string {
  const formatted = formatPhoneForDisplay(phone);
  const parts = formatted.split('-');

  if (parts.length === 3) {
    return `${parts[0]}-***-${parts[2]}`;
  }

  // Fallback: mask middle characters
  if (formatted.length > 6) {
    return formatted.substring(0, 3) + '***' + formatted.substring(formatted.length - 4);
  }

  return formatted;
}

/**
 * Extract phone number from various formats that might appear in Excel
 */
export function extractPhoneFromExcel(value: string | number): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  // Convert to string
  let phone = String(value).trim();

  // Remove common Excel artifacts
  phone = phone.replace(/^['"]|['"]$/g, ''); // Remove quotes
  phone = phone.replace(/\s/g, ''); // Remove spaces

  // If it looks like a number that was formatted as text
  if (/^\d{9,10}$/.test(phone)) {
    // Add leading 0 if 9 digits (Excel might strip it)
    if (phone.length === 9) {
      phone = '0' + phone;
    }
  }

  // Validate and normalize
  const normalized = normalizePhoneNumber(phone);

  if (isValidIsraeliPhone(normalized)) {
    return normalized;
  }

  return null;
}

/**
 * Compare two phone numbers (handles different formats)
 */
export function phonesMatch(phone1: string, phone2: string): boolean {
  return normalizePhoneNumber(phone1) === normalizePhoneNumber(phone2);
}
