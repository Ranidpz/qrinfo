// ============ WEEKLY CALENDAR - Schedule Management ============

// Day of week (0 = Sunday, 6 = Saturday) - Israeli week format
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// Calendar mode: weekly view or daily booth view
export type CalendarMode = 'weekly' | 'booths';

// Registration for a cell (RSVP) - basic version
export interface CellRegistration {
  visitorId: string;
  nickname?: string;
  registeredAt: Date;
}

// Avatar type for participant profile
export type AvatarType = 'photo' | 'emoji' | 'none';

// Enhanced registration with phone verification and check-in
export interface EnhancedCellRegistration {
  // Core identifiers
  id: string;                      // Document ID
  codeId: string;                  // QR code ID
  cellId: string;                  // Activity cell ID
  visitorId: string;               // Browser visitor ID

  // Context (booth mode)
  boothId?: string;                // Booth ID
  boothDate?: string;              // Date string (YYYY-MM-DD)

  // Context (weekly mode)
  weekStartDate?: string;          // Week start date

  // Participant info
  nickname: string;                // Name
  phone: string;                   // Normalized phone (+972 format)
  count: number;                   // Number of people (1-10)

  // Avatar/Profile
  avatarUrl?: string;              // Photo URL or emoji
  avatarType: AvatarType;          // 'photo' | 'emoji' | 'none'

  // QR Token for check-in
  qrToken: string;                 // Unique token for QR code

  // Phone verification
  isVerified: boolean;             // Phone verified via OTP
  verifiedAt?: Date;               // When verified

  // Check-in tracking
  checkedIn: boolean;              // Has checked in
  checkedInAt?: Date;              // When checked in
  checkedInBy?: string;            // Admin who approved

  // Slot transfer tracking
  transferredFrom?: string;        // Original cellId before transfer
  transferredAt?: Date;            // When transferred

  // Timestamps
  registeredAt: Date;
  updatedAt?: Date;
}

// Check-in scenario type (detected during QR scan)
export type CheckinScenario = 'ON_TIME' | 'EARLY' | 'LATE' | 'WRONG_DATE';

// Preset avatar options
export const PRESET_AVATARS = [
  { id: 'emoji_smile', value: '😊' },
  { id: 'emoji_star', value: '⭐' },
  { id: 'emoji_heart', value: '❤️' },
  { id: 'emoji_fire', value: '🔥' },
  { id: 'emoji_party', value: '🎉' },
  { id: 'emoji_cool', value: '😎' },
  { id: 'emoji_rocket', value: '🚀' },
  { id: 'emoji_unicorn', value: '🦄' },
] as const;

// Individual calendar cell (activity/event)
export interface CalendarCell {
  id: string;
  dayIndex: DayOfWeek;           // Starting day (0-6)
  startSlotIndex: number;        // Starting time slot index
  rowSpan: number;               // How many time slots it spans (default 1)
  colSpan?: number;              // How many days it spans (default 1)

  // Content
  title: string;
  description?: string;
  imageUrl?: string;             // Optional image
  linkUrl?: string;              // Optional button/link
  linkTitle?: string;            // Display text for link

  // Styling
  backgroundColor: string;
  textColor?: string;            // Defaults to auto-contrast

  // RSVP / Registration
  enableRSVP?: boolean;          // Enable RSVP button for this cell
  maxRegistrations?: number;     // Optional limit on registrations

  // Recurrence (weekly repeat)
  recurrence?: {
    enabled: boolean;
    frequency: 'weekly';           // Only weekly for now
    endDate?: string;              // ISO date string, undefined = forever
    parentId?: string;             // Original event ID (for instances)
    isInstance?: boolean;          // Is this an instance of a recurring event
    excludedDates?: string[];      // Week start dates where this event is excluded
  };

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// Time slot definition (row in the grid)
export interface TimeSlot {
  id: string;
  startTime: string;             // HH:MM format (e.g., "09:00")
  endTime: string;               // HH:MM format (e.g., "10:00")
  label?: string;                // Optional custom label
  order: number;
  durationMinutes?: number;      // Duration in minutes (calculated from start/end if not set)
}

// Single week's data
export interface WeekData {
  id: string;
  weekStartDate: string;         // ISO date string (Sunday of the week)
  timeSlots: TimeSlot[];         // Time slots for this week
  cells: CalendarCell[];         // All cells for this week
  isTemplate?: boolean;          // Can be used as template for other weeks
}

// ============ BOOTH MODE - Daily Booth Schedule ============

// Booth definition (experience station)
export interface Booth {
  id: string;
  name: string;                    // Booth name (e.g., "Face Painting")
  description?: string;            // Optional booth description
  imageUrl?: string;               // Optional booth image/logo
  order: number;                   // Display order (for drag-to-reorder)
  isActive: boolean;               // Can hide without deleting
  defaultCapacity?: number;        // Default max registrations per time slot
  slotCapacities?: Record<number, number>; // Per-slot capacity overrides { slotIndex: capacity }
  overbookingPercentage?: number;  // Allow registrations beyond capacity (0-50%, default 10)
  maxRegistrationsPerPhone?: number; // Max times same phone can register for this booth per day (default: 1)
  backgroundColor?: string;        // Optional custom color for header

  // Per-booth schedule settings (for Timeline View)
  startTime?: string;              // Booth operating start time (e.g., "09:00", default: "09:00")
  endTime?: string;                // Booth operating end time (e.g., "18:00", default: "18:00")
  durationMinutes: number;         // Activity duration in minutes (default: 10)
  bufferMinutes: number;           // Buffer/gap time between slots in minutes (default: 5)
  timeSlots: TimeSlot[];           // This booth's time slots (each booth can have different slots)
}

// Booth cell (activity at a booth + time slot)
export interface BoothCell {
  id: string;
  boothId: string;                 // Reference to booth (instead of dayIndex)
  startSlotIndex: number;          // Time slot index (row)
  rowSpan: number;                 // How many time slots it spans (default 1)

  // Content (same as CalendarCell)
  title: string;
  description?: string;
  imageUrl?: string;
  linkUrl?: string;
  linkTitle?: string;

  // Styling
  backgroundColor: string;
  textColor?: string;

  // Capacity - important for booth mode
  capacity?: number;               // Override booth default capacity
  overbookingPercentage?: number;  // Override booth overbooking (0-50%, default from booth)
  enableRSVP?: boolean;            // Enable registration for this slot

  // Break mode - booth not active during this time
  isBreak?: boolean;               // When true, shows as break (gray, no RSVP)

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// Single day's booth data
export interface BoothDayData {
  id: string;
  date: string;                    // ISO date string (specific day, e.g., "2026-01-15")
  booths: Booth[];                 // Booth definitions for this day
  timeSlots: TimeSlot[];           // Time slots (reuse existing TimeSlot)
  cells: BoothCell[];              // Activities at booth+slot intersections
}

// Featured event/attraction (highlight from calendar)
export interface CalendarAttraction {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  youtubeUrl?: string;           // Optional YouTube embed
  dayIndex?: DayOfWeek;          // Optional - single day (legacy support)
  dayIndices?: DayOfWeek[];      // Multiple days selection
  timeDisplay?: string;          // Legacy time string
  startTime?: string;            // Start time (e.g., "20:00")
  endTime?: string;              // End time (e.g., "22:00")
  linkedCellId?: string;         // Reference to the calendar cell
  order: number;
  isActive: boolean;
  // Styling
  backgroundColor?: string;      // Background color
  textColor?: string;            // Text color
  backgroundImageUrl?: string;   // Optional background image
}

// Landing page configuration
export interface CalendarLanding {
  splashImageUrl?: string;       // Full-screen branded image
  logoUrl?: string;              // Logo placement
  title?: string;
  subtitle?: string;
  enterButtonText?: string;
  backgroundColor: string;
  textColor: string;
  buttonColor?: string;          // Button background color
  useImageAsBackground?: boolean; // Use splash image as full-screen background (legacy)
  blurBackground?: boolean;       // Apply blur effect to background (legacy)
  imageOverlayOpacity?: number;   // 0-100, overlay darkness for text readability
}

// Branding configuration
export interface CalendarBranding {
  landing: CalendarLanding;

  // Header/navigation colors
  headerBackgroundColor: string;
  headerTextColor: string;

  // Day card colors
  dayBackgroundColor: string;
  dayTextColor: string;
  dayBackgroundImageUrl?: string;  // Optional background image
  useLandingImageForDays?: boolean; // Use landing splash image as day background
  dayBackgroundBlur?: boolean;      // Glassmorphism blur effect

  // Past day styling
  pastDayOpacity: number;        // 0.3 - 0.7 for grayed out effect

  // Current time indicator
  currentTimeIndicatorColor: string;
}

// Notes page configuration
export interface CalendarNotes {
  enabled: boolean;
  title?: string;
  content: string;                // HTML content with formatting
  buttonText?: string;            // "הבנתי" button text
  backgroundColor?: string;       // Background color
  textColor?: string;             // Text color
  buttonColor?: string;           // Button background color
  useLandingImage?: boolean;      // Use landing page image as background
  imageOverlayOpacity?: number;   // 0-100, overlay darkness for text readability
  // FAB button on landing page
  fabButtonColor?: string;        // FAB button background color
  fabIconColor?: string;          // FAB button icon color
}

// Default notes configuration
export const DEFAULT_CALENDAR_NOTES: CalendarNotes = {
  enabled: false,
  title: '',
  content: '',
  buttonText: 'הבנתי',
  backgroundColor: '#ffffff',
  textColor: '#1f2937',
  buttonColor: '#3b82f6',
  fabButtonColor: '#3b82f6',
  fabIconColor: '#ffffff',
};

// Main Weekly Calendar configuration (stored in MediaItem.weeklycalConfig)
export interface WeeklyCalendarConfig {
  // Mode selection (new)
  mode?: CalendarMode;           // 'weekly' | 'booths' (default: 'weekly')

  // Weekly mode data
  weeks: WeekData[];             // All programmed weeks
  attractions: CalendarAttraction[];
  notes?: CalendarNotes;         // Notes page configuration

  // Booth mode data (new)
  boothDays?: BoothDayData[];    // Data for booth mode (by date)
  defaultBooths?: Booth[];       // Template booths for new days

  // Default time slots (template for new weeks/days)
  defaultTimeSlots: TimeSlot[];

  // Branding
  branding: CalendarBranding;

  // Viewer behavior
  showPastDayWarning: boolean;   // Show "this already happened" warning
  showCurrentTimeIndicator: boolean;
  enableSwipeNavigation: boolean;
  enableRSVP?: boolean;          // Enable RSVP feature globally

  // Phone verification & Check-in (booth mode)
  requirePhoneVerification?: boolean;  // Require phone OTP verification
  enableCheckin?: boolean;             // Enable admin check-in scanner

  // Statistics
  stats?: {
    totalWeeks: number;
    totalEvents: number;
    lastUpdated: Date;
  };
}

// Day names by locale
export const DAY_NAMES = {
  he: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

// Short day names
export const DAY_NAMES_SHORT = {
  he: ['א\'', 'ב\'', 'ג\'', 'ד\'', 'ה\'', 'ו\'', 'ש\''],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

// Default color palette for cells
export const CELL_COLOR_PALETTE = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#6366F1', // Indigo
  // Glassmorphism dark colors
  '#1a1a2e', // Dark navy
  '#16213e', // Dark blue
  '#1e293b', // Slate 800
  '#27272a', // Zinc 800
];

// Default configuration
export const DEFAULT_WEEKLYCAL_CONFIG: WeeklyCalendarConfig = {
  mode: 'weekly',                // Default to weekly mode
  weeks: [],
  attractions: [],
  boothDays: [],                 // Booth mode data
  defaultBooths: [],             // Template booths
  defaultTimeSlots: [
    { id: 'slot_1', startTime: '09:00', endTime: '10:00', order: 0 },
    { id: 'slot_2', startTime: '10:00', endTime: '11:00', order: 1 },
    { id: 'slot_3', startTime: '11:00', endTime: '12:00', order: 2 },
    { id: 'slot_4', startTime: '12:00', endTime: '13:00', order: 3 },
    { id: 'slot_5', startTime: '13:00', endTime: '14:00', order: 4 },
    { id: 'slot_6', startTime: '14:00', endTime: '15:00', order: 5 },
    { id: 'slot_7', startTime: '15:00', endTime: '16:00', order: 6 },
    { id: 'slot_8', startTime: '16:00', endTime: '17:00', order: 7 },
    { id: 'slot_9', startTime: '17:00', endTime: '18:00', order: 8 },
  ],
  branding: {
    landing: {
      backgroundColor: '#1a1a2e',
      textColor: '#ffffff',
      buttonColor: '#3b82f6',
      enterButtonText: 'כניסה ללוח',
    },
    headerBackgroundColor: '#1a1a2e',
    headerTextColor: '#ffffff',
    dayBackgroundColor: '#ffffff',
    dayTextColor: '#1f2937',
    pastDayOpacity: 0.5,
    currentTimeIndicatorColor: '#EF4444',
  },
  showPastDayWarning: true,
  showCurrentTimeIndicator: true,
  enableSwipeNavigation: true,
};

// ============ Helper Functions ============

/**
 * Get the Sunday of the week for a given date (Israeli week starts Sunday)
 */
export function getWeekStartDate(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day); // Go back to Sunday
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Get today's day index (0 = Sunday)
 */
export function getTodayDayIndex(): DayOfWeek {
  return new Date().getDay() as DayOfWeek;
}

/**
 * Check if a week is the current week
 */
export function isCurrentWeek(weekStartDate: string): boolean {
  return weekStartDate === getWeekStartDate(new Date());
}

/**
 * Check if a day is in the past (before today)
 */
export function isPastDay(weekStartDate: string, dayIndex: DayOfWeek): boolean {
  const weekStart = new Date(weekStartDate);
  const dayDate = new Date(weekStart);
  dayDate.setDate(dayDate.getDate() + dayIndex);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return dayDate < today;
}

/**
 * Check if a day is today
 */
export function isToday(weekStartDate: string, dayIndex: DayOfWeek): boolean {
  const weekStart = new Date(weekStartDate);
  const dayDate = new Date(weekStart);
  dayDate.setDate(dayDate.getDate() + dayIndex);

  const today = new Date();

  return (
    dayDate.getDate() === today.getDate() &&
    dayDate.getMonth() === today.getMonth() &&
    dayDate.getFullYear() === today.getFullYear()
  );
}

/**
 * Get formatted date string for a day in a week
 */
export function getDayDate(weekStartDate: string, dayIndex: DayOfWeek, locale: 'he' | 'en' = 'he'): string {
  const weekStart = new Date(weekStartDate);
  const dayDate = new Date(weekStart);
  dayDate.setDate(dayDate.getDate() + dayIndex);

  return dayDate.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Get current time position as percentage of day (for time indicator)
 */
export function getCurrentTimePosition(firstSlotStart: string, lastSlotEnd: string): number {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const startMinutes = timeToMinutes(firstSlotStart);
  const endMinutes = timeToMinutes(lastSlotEnd);

  if (currentMinutes < startMinutes) return 0;
  if (currentMinutes > endMinutes) return 100;

  return ((currentMinutes - startMinutes) / (endMinutes - startMinutes)) * 100;
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new empty week
 */
export function createEmptyWeek(weekStartDate: string, defaultTimeSlots: TimeSlot[]): WeekData {
  return {
    id: generateId(),
    weekStartDate,
    timeSlots: [...defaultTimeSlots],
    cells: [],
  };
}

/**
 * Get cells for a specific day (including multi-day cells that span into this day)
 */
export function getCellsForDay(cells: CalendarCell[], dayIndex: DayOfWeek): CalendarCell[] {
  return cells
    .filter(cell => {
      // Cell starts on this day
      if (cell.dayIndex === dayIndex) return true;
      // Cell starts before this day and spans into it (colSpan extends to this day)
      const colSpan = cell.colSpan || 1;
      if (cell.dayIndex < dayIndex && cell.dayIndex + colSpan > dayIndex) return true;
      return false;
    })
    .sort((a, b) => a.startSlotIndex - b.startSlotIndex);
}

/**
 * Auto-contrast text color (black or white) based on background
 */
export function getContrastTextColor(backgroundColor: string): string {
  // Remove # if present
  const hex = backgroundColor.replace('#', '');

  // Parse RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? '#1f2937' : '#ffffff';
}

/**
 * Check if a recurring event should appear in a specific week
 */
export function isRecurrenceActiveInWeek(
  cell: CalendarCell,
  cellWeekStartDate: string,
  targetWeekStartDate: string
): boolean {
  if (!cell.recurrence?.enabled) return false;

  // Check if target week is after the cell's original week
  if (targetWeekStartDate < cellWeekStartDate) return false;

  // Check if excluded
  if (cell.recurrence.excludedDates?.includes(targetWeekStartDate)) return false;

  // Check end date
  if (cell.recurrence.endDate && targetWeekStartDate > cell.recurrence.endDate) return false;

  return true;
}

/**
 * Generate a recurring cell instance for a target week
 */
export function generateRecurringCellInstance(
  parentCell: CalendarCell,
  targetWeekStartDate: string
): CalendarCell {
  return {
    ...parentCell,
    id: `${parentCell.id}_${targetWeekStartDate}`,
    recurrence: {
      ...parentCell.recurrence!,
      parentId: parentCell.id,
      isInstance: true,
    },
  };
}

/**
 * Get all recurring cells that should appear in a target week
 */
export function getRecurringCellsForWeek(
  allWeeks: WeekData[],
  targetWeekStartDate: string
): CalendarCell[] {
  const recurringCells: CalendarCell[] = [];

  for (const week of allWeeks) {
    // Only check weeks before or equal to target
    if (week.weekStartDate > targetWeekStartDate) continue;
    // Skip the target week itself (those cells are already there)
    if (week.weekStartDate === targetWeekStartDate) continue;

    for (const cell of week.cells) {
      if (isRecurrenceActiveInWeek(cell, week.weekStartDate, targetWeekStartDate)) {
        recurringCells.push(generateRecurringCellInstance(cell, targetWeekStartDate));
      }
    }
  }

  return recurringCells;
}

// ============ Booth Mode Helper Functions ============

/**
 * Get today's date as ISO string (YYYY-MM-DD) in local timezone
 */
export function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Check if a date is today
 */
export function isDateToday(dateString: string): boolean {
  return dateString === getTodayDateString();
}

/**
 * Check if a date is in the past
 */
export function isDatePast(dateString: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateString);
  return date < today;
}

/**
 * Format date for display
 */
export function formatBoothDate(dateString: string, locale: 'he' | 'en' = 'he'): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Get day name from a date string
 */
export function getDayNameFromDate(dateString: string, locale: 'he' | 'en' = 'he'): string {
  const date = new Date(dateString);
  const dayIndex = date.getDay() as DayOfWeek;
  return DAY_NAMES[locale][dayIndex];
}

/**
 * Check if a time slot has passed for a specific date
 */
export function isBoothSlotPast(dateString: string, slotEndTime: string): boolean {
  const todayStr = getTodayDateString();

  // If the date is before today, all slots are past
  if (dateString < todayStr) return true;
  // If the date is after today, no slots are past
  if (dateString > todayStr) return false;

  // Same day - compare time
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const slotEndMinutes = timeToMinutes(slotEndTime);
  return currentMinutes > slotEndMinutes;
}

/**
 * Get next/previous date
 */
export function getAdjacentDate(dateString: string, direction: 'next' | 'prev'): string {
  const date = new Date(dateString);
  date.setDate(date.getDate() + (direction === 'next' ? 1 : -1));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Create a new empty booth day
 */
export function createEmptyBoothDay(date: string, defaultTimeSlots: TimeSlot[], defaultBooths: Booth[]): BoothDayData {
  return {
    id: generateId(),
    date,
    booths: defaultBooths.map(b => ({ ...b })), // Keep same booth IDs to sync with defaultBooths
    timeSlots: [...defaultTimeSlots],
    cells: [],
  };
}

/**
 * Create a new booth
 */
export function createBooth(name: string, order: number): Booth {
  return {
    id: generateId(),
    name,
    order,
    isActive: true,
    defaultCapacity: 10,
    backgroundColor: CELL_COLOR_PALETTE[order % CELL_COLOR_PALETTE.length],
    durationMinutes: 10,           // Default: 10 minutes per activity
    bufferMinutes: 5,              // Default: 5 minutes break between activities
    timeSlots: [],                 // Empty - user will generate slots
  };
}

/**
 * Get cells for a specific booth
 */
export function getCellsForBooth(cells: BoothCell[], boothId: string): BoothCell[] {
  return cells
    .filter(cell => cell.boothId === boothId)
    .sort((a, b) => a.startSlotIndex - b.startSlotIndex);
}

/**
 * Get active booths sorted by order
 */
export function getActiveBooths(booths: Booth[]): Booth[] {
  return booths
    .filter(b => b.isActive)
    .sort((a, b) => a.order - b.order);
}

/**
 * Get booth day data for a specific date, or create new if not exists
 */
export function getOrCreateBoothDay(
  boothDays: BoothDayData[],
  date: string,
  defaultTimeSlots: TimeSlot[],
  defaultBooths: Booth[]
): { boothDay: BoothDayData; isNew: boolean } {
  const existing = boothDays.find(bd => bd.date === date);
  if (existing) {
    return { boothDay: existing, isNew: false };
  }
  return { boothDay: createEmptyBoothDay(date, defaultTimeSlots, defaultBooths), isNew: true };
}
