// User roles
export type UserRole = 'super_admin' | 'producer' | 'free';

// Media types
export type MediaType = 'image' | 'video' | 'pdf' | 'gif' | 'link' | 'riddle' | 'wordcloud';

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

// User gallery image (selfies uploaded by viewers)
export interface UserGalleryImage {
  id: string;
  url: string;
  uploaderName: string; // Name or "אנונימי"
  uploadedAt: Date;
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
  schedule?: MediaSchedule;
  linkUrl?: string;     // Optional external link for the media
  linkTitle?: string;   // Display name for the link button
  riddleContent?: RiddleContent; // Content for riddle type
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
  createdAt: Date;
  updatedAt: Date;
}

// Folder document
export interface Folder {
  id: string;
  name: string;
  ownerId: string;
  color?: string; // Optional color for folder icon
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

// Admin notification/announcement
export interface Notification {
  id: string;
  title: string;
  message: string;
  createdBy: string; // Admin user ID
  createdAt: Date;
}
