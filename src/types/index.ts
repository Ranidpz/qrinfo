// User roles
export type UserRole = 'super_admin' | 'producer' | 'free';

// Media types
export type MediaType = 'image' | 'video' | 'pdf' | 'gif' | 'link' | 'riddle' | 'wordcloud' | 'selfiebeam' | 'qvote' | 'weeklycal';

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

// Landing page button style
export type LandingPageButtonStyle = 'solid' | 'outline' | 'glass';

// Landing page button layout
export type LandingPageButtonLayout = 'list' | 'grid';

// Landing page configuration for mixed media codes
export interface LandingPageConfig {
  enabled: boolean;
  // Background
  backgroundColor: string;
  backgroundImageUrl?: string;
  backgroundBlur?: boolean;          // Apply blur to background image
  imageOverlayOpacity?: number;      // 0-100, overlay darkness for text readability
  // Content
  title?: string;
  subtitle?: string;
  // Button styling
  buttonColor: string;
  buttonTextColor: string;
  buttonStyle?: LandingPageButtonStyle;
  buttonLayout?: LandingPageButtonLayout;
  // Custom button titles (mediaId -> custom title)
  buttonTitles?: Record<string, string>;
}

// Default landing page configuration
export const DEFAULT_LANDING_PAGE_CONFIG: LandingPageConfig = {
  enabled: true,
  backgroundColor: '#1a1a2e',
  backgroundBlur: false,
  imageOverlayOpacity: 40,
  buttonColor: '#3b82f6',
  buttonTextColor: '#ffffff',
  buttonStyle: 'solid',
  buttonLayout: 'list',
};

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
  qvoteConfig?: import('./qvote').QVoteConfig; // Configuration for qvote type
  weeklycalConfig?: import('./weeklycal').WeeklyCalendarConfig; // Configuration for weekly calendar type
  createdAt: Date;
}

// QR Sign types
export type QRSignType = 'text' | 'emoji' | 'icon' | 'logo';

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
  pwaEncourage?: {
    enabled: boolean; // Default true - encourage app installation on scan
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
  landingPageConfig?: LandingPageConfig; // Landing page configuration for mixed media
  createdAt: Date;
  updatedAt: Date;
}

// Route configuration for gamification (folders can become routes)
export interface RouteConfig {
  isRoute: boolean;           // Is this folder a route?
  routeTitle?: string;        // Display title for route
  bonusThreshold?: number;    // Stations to complete for bonus (0 = all)
  bonusXP?: number;           // XP bonus for completion
  prizesEnabled?: boolean;    // Enable pack/prize system for this route
  lobbyDisplayEnabled?: boolean; // Show epic/legendary wins on lobby screen
  routeStartUrl?: string;     // URL where visitors can start the route (shown to non-participants)
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
  pendingPackCount?: number;  // Number of unopened packs
  lastLevelNotified?: number; // Last level minXP where pack was awarded
  createdAt: Date;
  updatedAt: Date;
}

// Station visit record (for detailed XP breakdown)
export interface StationVisit {
  codeId: string;
  title: string;
  xpEarned: number;
  visitedAt: Date;
}

// Visitor progress per route (stored in 'visitorProgress' collection)
// Document ID = `${visitorId}_${routeId}`
export interface VisitorProgress {
  id: string;                 // Document ID
  visitorId: string;          // Reference to visitor
  routeId: string;            // Folder ID (route)
  nickname?: string;          // Cached nickname for leaderboard display
  xp: number;                 // XP earned in this route
  visitedStations: StationVisit[];  // Array of station visits with details
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
  visitedStations?: StationVisit[];  // Detailed station visits
  updatedAt?: Date;
}

// ============ ANALYTICS GRID LAYOUT ============

// Analytics section identifiers
export type AnalyticsSectionId = 'metrics' | 'views' | 'hourly' | 'linkClicks' | 'rsvp';

// Layout item for react-grid-layout
export interface AnalyticsLayoutItem {
  i: string;       // Section ID
  x: number;       // X position in grid units (0-2 for 3-column grid)
  y: number;       // Y position in grid units
  w: number;       // Width in grid units (1-3)
  h: number;       // Height in grid units
  minW?: number;   // Minimum width
  maxW?: number;   // Maximum width
  minH?: number;   // Minimum height
  maxH?: number;   // Maximum height
}

// Layouts for different breakpoints
export interface AnalyticsLayouts {
  lg: AnalyticsLayoutItem[];  // Desktop (>=1200px)
  md: AnalyticsLayoutItem[];  // Tablet (>=996px)
  sm: AnalyticsLayoutItem[];  // Small tablet (>=768px)
}

// ============ PACK / PRIZE SYSTEM ============

// Prize rarity levels
export type PrizeRarity = 'common' | 'rare' | 'epic' | 'legendary';

// Default drop rates by rarity (percentage)
export const DEFAULT_DROP_RATES: Record<PrizeRarity, number> = {
  common: 70,
  rare: 20,
  epic: 8,
  legendary: 2,
};

// Rarity display configuration
export const RARITY_CONFIG: Record<PrizeRarity, {
  color: string;
  bgColor: string;
  emoji: string;
  name: string;
  nameEn: string;
}> = {
  common: { color: '#6B7280', bgColor: '#F3F4F6', emoji: '⚪', name: 'רגיל', nameEn: 'Common' },
  rare: { color: '#3B82F6', bgColor: '#DBEAFE', emoji: '🔵', name: 'נדיר', nameEn: 'Rare' },
  epic: { color: '#8B5CF6', bgColor: '#EDE9FE', emoji: '🟣', name: 'אפי', nameEn: 'Epic' },
  legendary: { color: '#F59E0B', bgColor: '#FEF3C7', emoji: '🌟', name: 'אגדי', nameEn: 'Legendary' },
};

// Prize document (stored in 'prizes' collection)
export interface Prize {
  id: string;
  routeId: string;              // The route this prize belongs to
  name: string;                 // Hebrew name
  nameEn: string;               // English name
  description?: string;         // Optional description
  rarity: PrizeRarity;
  dropRate: number;             // Percentage (e.g., 70 for 70%)
  totalAvailable: number;       // Total inventory
  claimed: number;              // How many have been claimed
  imageUrl?: string;            // Prize image
  isActive: boolean;            // Can be disabled without deletion
  createdAt: Date;
  updatedAt: Date;
}

// Reason for receiving a pack
export type PackTrigger = 'level_up' | 'route_complete' | 'achievement';

// Pending pack (unopened) - stored in 'pendingPacks' collection
export interface PendingPack {
  id: string;                   // Document ID
  visitorId: string;
  routeId: string;
  reason: PackTrigger;
  levelReached?: number;        // minXP of level reached (if level_up)
  earnedAt: Date;
  opened: boolean;
}

// Pack opening record - stored in 'packOpenings' collection
export interface PackOpening {
  id: string;
  visitorId: string;
  visitorNickname: string;      // Cached for lobby display
  routeId: string;
  prizeId: string;
  prizeName: string;            // Cached Hebrew name
  prizeNameEn: string;          // Cached English name
  prizeRarity: PrizeRarity;
  prizeImageUrl?: string;
  openedAt: Date;
  redeemed: boolean;            // Has the prize been redeemed?
  redeemedAt?: Date;
}
