// User roles
export type UserRole = 'super_admin' | 'producer' | 'free';

// Media types
export type MediaType = 'image' | 'video' | 'pdf' | 'gif' | 'link' | 'riddle' | 'wordcloud' | 'selfiebeam';

// Riddle content structure
export interface RiddleContent {
  title: string;
  content: string; // Supports emojis, line breaks, WhatsApp-style formatting
  backgroundColor: string;
  textColor: string;
  youtubeUrl?: string; // YouTube video URL for embedding
  images?: string[]; // Array of uploaded image URLs
  galleryEnabled?: boolean; // Allow users to upload selfies
  allowAnonymous?: boolean; // Allow anonymous uploads (no name required)
}

// Selfiebeam content structure (same as RiddleContent for now, may diverge later)
export interface SelfiebeamContent {
  title: string;
  content: string; // Supports emojis, line breaks, WhatsApp-style formatting
  backgroundColor: string;
  textColor: string;
  youtubeUrl?: string; // YouTube video URL for embedding
  images?: string[]; // Array of uploaded image URLs
  galleryEnabled?: boolean; // Allow users to upload selfies
  allowAnonymous?: boolean; // Allow anonymous uploads (no name required)
  companyLogos?: string[]; // Company logos to display in gallery mixed with selfies
}

// User gallery image (selfies uploaded by viewers)
export interface UserGalleryImage {
  id: string;
  url: string;
  uploaderName: string; // Name or "אנונימי"
  uploadedAt: Date;
  // Gamification fields (optional for backwards compatibility)
  visitorId?: string;  // Link to visitor document
}

// Gallery display mode
export type GalleryDisplayMode = 'static' | 'scroll' | 'shuffle';

// Gallery settings (saved per QR code)
export interface GallerySettings {
  displayMode: GalleryDisplayMode;
  displayLimit: number; // 0 = all, or 10/20/50/100
  gridColumns: number;  // 2-6
  headerHidden: boolean;
  showNames?: boolean;  // Show uploader names on images
  fadeEffect?: boolean; // Subtle fade-in effect on images (video-like motion)
  borderRadius?: number; // Image border radius 0-50 (percentage)
  nameSize?: number; // Name text size 10-20 (pixels)
  showNewBadge?: boolean; // Show NEW badge on first-time displayed images
}

// Schedule for media
export interface MediaSchedule {
  enabled: boolean;
  startDate?: Date;
  endDate?: Date;
  startTime?: string; // HH:MM format
  endTime?: string;   // HH:MM format
}

// Media item in a code
export interface MediaItem {
  id: string;
  url: string;
  type: MediaType;
  size: number; // bytes, 0 for links
  order: number;
  uploadedBy: string; // User ID
  title?: string;
  filename?: string;   // Original filename
  pageCount?: number;  // Number of pages (for PDF files)
  schedule?: MediaSchedule;
  linkUrl?: string;     // Optional external link for the media
  linkTitle?: string;   // Display name for the link button
  riddleContent?: RiddleContent; // Content for riddle type
  selfiebeamContent?: SelfiebeamContent; // Content for selfiebeam type
  createdAt: Date;
}

// QR Sign types
export type QRSignType = 'text' | 'emoji' | 'icon';

// QR Sign configuration for center overlay
export interface QRSign {
  enabled: boolean;
  type: QRSignType;
  value: string;           // 1-4 letters / emoji / icon name
  color: string;           // Sign color (hex)
  backgroundColor: string; // Background color (hex)
  scale?: number;          // Size scale 0.5-1.5 (default 1.0)
}

// Widgets configuration
export interface CodeWidgets {
  qrSign?: QRSign;
  whatsapp?: {
    enabled: boolean;
    groupLink: string;
  };
}

// QR Code document
export interface QRCode {
  id: string;
  shortId: string; // 6-8 chars unique identifier
  ownerId: string;
  collaborators: string[];
  title: string;
  media: MediaItem[];
  widgets: CodeWidgets;
  views: number;
  isActive: boolean;
  isGlobal?: boolean; // Whether the code is globally featured (admin only)
  folderId?: string; // Optional folder assignment
  userGallery?: UserGalleryImage[]; // Selfies uploaded by viewers
  gallerySettings?: GallerySettings; // Display settings for gallery page
  createdAt: Date;
  updatedAt: Date;
}

// Route configuration for gamification (folders can become routes)
export interface RouteConfig {
  isRoute: boolean;           // Is this folder a route?
  routeTitle?: string;        // Display title for route
  bonusThreshold?: number;    // Stations to complete for bonus (0 = all)
  bonusXP?: number;           // XP bonus for completion
}

// Folder document
export interface Folder {
  id: string;
  name: string;
  ownerId: string;
  color?: string; // Optional color for folder icon
  routeConfig?: RouteConfig; // Optional route configuration for gamification
  createdAt: Date;
  updatedAt: Date;
}

// User document
export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  storageLimit: number; // bytes
  storageUsed: number;  // bytes
  createdAt: Date;
  updatedAt: Date;
}

// Storage limits per role (in bytes)
export const STORAGE_LIMITS: Record<UserRole, number> = {
  super_admin: 1024 * 1024 * 1024, // 1GB
  producer: 50 * 1024 * 1024,      // 50MB
  free: 25 * 1024 * 1024,          // 25MB
};

// Max file size (5MB)
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed file types
export const ALLOWED_FILE_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/webm'],
  pdf: ['application/pdf'],
};

// View modes for dashboard
export type ViewMode = 'grid' | 'list';

// Filter options
export type FilterOption = 'all' | 'mine' | 'shared';

// ============ ANALYTICS ============

// Device info for view logs
export interface DeviceInfo {
  type: 'mobile' | 'tablet' | 'desktop';
  browser: string;
}

// View log document
export interface ViewLog {
  id: string;
  codeId: string;
  shortId: string;
  ownerId: string;
  timestamp: Date;
  device: DeviceInfo;
}

// Date range preset options
export type DateRangePreset = 'today' | 'week' | 'month' | 'year' | 'custom';

// Aggregated analytics data
export interface AnalyticsData {
  totalViews: number;
  dailyAverage: number;
  peakHour: number;
  topDevice: string;
  viewsByDay: { date: string; views: number }[];
  viewsByHour: { hour: number; views: number }[];
  viewsByDevice: { device: string; views: number }[];
}

// Analytics filter state
export interface AnalyticsFilter {
  codeIds: string[];
  dateRange: DateRangePreset;
  customStartDate?: Date;
  customEndDate?: Date;
}

// ============ LINK CLICK TRACKING ============

// Link source types
export type LinkSource = 'pdf' | 'media' | 'whatsapp';

// Link click document
export interface LinkClick {
  id: string;
  codeId: string;
  shortId: string;
  ownerId: string;
  linkUrl: string;
  linkSource: LinkSource;
  timestamp: Date;
}

// Aggregated link click stats
export interface LinkClickStats {
  totalClicks: number;
  clicksByLink: { url: string; source: LinkSource; count: number; lastClick: Date }[];
}

// ============ NOTIFICATIONS ============

// Supported locales for notifications
export type NotificationLocale = 'he' | 'en' | 'all';

// Admin notification/announcement
export interface Notification {
  id: string;
  title: string;
  message: string;
  createdBy: string; // Admin user ID
  locale: NotificationLocale; // Which locale to show this notification to ('all' for both)
  createdAt: Date;
}

// ============ GAMIFICATION / XP SYSTEM ============

// XP Level definition
export interface XPLevel {
  name: string;      // Level name (Hebrew)
  nameEn: string;    // Level name (English)
  emoji: string;     // Badge emoji
  minXP: number;     // Minimum XP for this level
  maxXP: number;     // Maximum XP (exclusive, use Infinity for top level)
}

// XP Levels configuration
export const XP_LEVELS: XPLevel[] = [
  { name: 'מתחילים', nameEn: 'Beginner', emoji: '🌱', minXP: 0, maxXP: 50 },
  { name: 'חוקרים', nameEn: 'Explorer', emoji: '🔍', minXP: 50, maxXP: 150 },
  { name: 'מומחים', nameEn: 'Expert', emoji: '⭐', minXP: 150, maxXP: 300 },
  { name: 'אלופים', nameEn: 'Champion', emoji: '👑', minXP: 300, maxXP: Infinity },
];

// XP action values
export const XP_VALUES = {
  SCAN_STATION: 10,      // First scan of a station in a route
  UPLOAD_PHOTO: 25,      // Upload photo to any code
  ROUTE_BONUS_BASE: 50,  // Default bonus for completing route
} as const;

// Visitor/Player document (stored in 'visitors' collection)
export interface Visitor {
  id: string;              // UUID from localStorage
  nickname: string;        // Display name (2-20 chars)
  consent: boolean;        // Has consented to photo publishing
  consentTimestamp?: Date; // When consent was given
  totalXP: number;         // Total accumulated XP across all routes
  createdAt: Date;
  updatedAt: Date;
}

// Visitor progress per route (stored in 'visitorProgress' collection)
// Document ID = `${visitorId}_${routeId}`
export interface VisitorProgress {
  id: string;                 // Document ID
  visitorId: string;          // Reference to visitor
  routeId: string;            // Folder ID (route)
  xp: number;                 // XP earned in this route
  visitedStations: string[];  // Array of codeIds visited
  photosUploaded: number;     // Count of photos uploaded in route
  bonusAwarded: boolean;      // Has received completion bonus
  createdAt: Date;
  updatedAt: Date;
}

// Leaderboard entry (computed, not stored)
export interface LeaderboardEntry {
  rank: number;
  visitorId: string;
  nickname: string;
  xp: number;
  level: XPLevel;
  photosUploaded: number;
}
