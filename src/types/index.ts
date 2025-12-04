// User roles
export type UserRole = 'super_admin' | 'producer' | 'free';

// Media types
export type MediaType = 'image' | 'video' | 'pdf' | 'gif' | 'link';

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
  createdAt: Date;
}

// Widgets configuration
export interface CodeWidgets {
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
  folderId?: string; // Optional folder assignment
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
