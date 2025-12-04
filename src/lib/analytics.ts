import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { ViewLog, DeviceInfo, AnalyticsData, QRCode } from '@/types';

// Parse user agent string to device info
export function parseUserAgent(ua: string): DeviceInfo {
  const uaLower = ua.toLowerCase();

  // Device type detection
  let type: DeviceInfo['type'] = 'desktop';
  if (/ipad|tablet|playbook|silk/i.test(ua)) {
    type = 'tablet';
  } else if (/mobile|iphone|ipod|android.*mobile|windows phone/i.test(ua)) {
    type = 'mobile';
  }

  // Browser detection
  let browser = 'Other';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/chrome/i.test(ua) && !/edg/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/opera|opr/i.test(ua)) browser = 'Opera';

  return { type, browser };
}

// Create a view log entry
export async function createViewLog(
  codeId: string,
  shortId: string,
  ownerId: string,
  userAgent: string
): Promise<void> {
  const device = parseUserAgent(userAgent);

  const logData = {
    codeId,
    shortId,
    ownerId,
    timestamp: Timestamp.now(),
    device,
  };

  await addDoc(collection(db, 'viewLogs'), logData);
}

// Get view logs for specific codes within date range
export async function getViewLogs(
  codeIds: string[],
  startDate: Date,
  endDate: Date
): Promise<ViewLog[]> {
  if (codeIds.length === 0) return [];

  const logs: ViewLog[] = [];

  // Firestore 'in' queries are limited to 30 items
  const chunks = [];
  for (let i = 0; i < codeIds.length; i += 30) {
    chunks.push(codeIds.slice(i, i + 30));
  }

  for (const chunk of chunks) {
    const q = query(
      collection(db, 'viewLogs'),
      where('codeId', 'in', chunk),
      where('timestamp', '>=', Timestamp.fromDate(startDate)),
      where('timestamp', '<=', Timestamp.fromDate(endDate)),
      orderBy('timestamp', 'desc')
    );

    const snapshot = await getDocs(q);

    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      logs.push({
        id: docSnap.id,
        codeId: data.codeId,
        shortId: data.shortId,
        ownerId: data.ownerId,
        timestamp: data.timestamp.toDate(),
        device: data.device,
      });
    });
  }

  return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

// Calculate date range from preset
export function getDateRange(preset: string, customStart?: Date, customEnd?: Date): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  let start: Date;

  switch (preset) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      break;
    case 'week':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0);
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate(), 0, 0, 0, 0);
      break;
    case 'year':
      start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 0, 0, 0, 0);
      break;
    case 'custom':
      if (customStart && customEnd) {
        return {
          start: new Date(customStart.getFullYear(), customStart.getMonth(), customStart.getDate(), 0, 0, 0, 0),
          end: new Date(customEnd.getFullYear(), customEnd.getMonth(), customEnd.getDate(), 23, 59, 59, 999),
        };
      }
      // Default to last month if custom dates not provided
      start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate(), 0, 0, 0, 0);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate(), 0, 0, 0, 0);
  }

  return { start, end };
}

// Aggregate analytics data from view logs
export function aggregateAnalytics(logs: ViewLog[]): AnalyticsData {
  const totalViews = logs.length;

  // Group by day
  const viewsByDayMap = new Map<string, number>();
  const viewsByHourMap = new Map<number, number>();
  const viewsByDeviceMap = new Map<string, number>();

  logs.forEach((log) => {
    // By day
    const dateKey = log.timestamp.toISOString().split('T')[0];
    viewsByDayMap.set(dateKey, (viewsByDayMap.get(dateKey) || 0) + 1);

    // By hour
    const hour = log.timestamp.getHours();
    viewsByHourMap.set(hour, (viewsByHourMap.get(hour) || 0) + 1);

    // By device
    const device = log.device.type;
    viewsByDeviceMap.set(device, (viewsByDeviceMap.get(device) || 0) + 1);
  });

  // Calculate daily average
  const uniqueDays = viewsByDayMap.size || 1;
  const dailyAverage = Math.round((totalViews / uniqueDays) * 10) / 10;

  // Find peak hour
  let peakHour = 0;
  let maxHourViews = 0;
  viewsByHourMap.forEach((views, hour) => {
    if (views > maxHourViews) {
      maxHourViews = views;
      peakHour = hour;
    }
  });

  // Find top device
  let topDevice = 'desktop';
  let maxDeviceViews = 0;
  viewsByDeviceMap.forEach((views, device) => {
    if (views > maxDeviceViews) {
      maxDeviceViews = views;
      topDevice = device;
    }
  });

  // Convert maps to arrays
  const viewsByDay = Array.from(viewsByDayMap.entries())
    .map(([date, views]) => ({ date, views }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const viewsByHour = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    views: viewsByHourMap.get(hour) || 0,
  }));

  const viewsByDevice = Array.from(viewsByDeviceMap.entries()).map(([device, views]) => ({
    device,
    views,
  }));

  return {
    totalViews,
    dailyAverage,
    peakHour,
    topDevice,
    viewsByDay,
    viewsByHour,
    viewsByDevice,
  };
}

// Get all QR codes (for super admin)
export async function getAllQRCodes(): Promise<QRCode[]> {
  const q = query(collection(db, 'codes'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      shortId: data.shortId,
      ownerId: data.ownerId,
      collaborators: data.collaborators || [],
      title: data.title,
      media: data.media || [],
      widgets: data.widgets || {},
      views: data.views || 0,
      isActive: data.isActive ?? true,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  });
}

// Format hour for display (Hebrew locale)
export function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`;
}

// Format date for display (Hebrew locale)
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

// Device type labels in Hebrew
export const deviceLabels: Record<string, string> = {
  mobile: 'נייד',
  tablet: 'טאבלט',
  desktop: 'מחשב',
};
