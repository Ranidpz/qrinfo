import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { ViewLog, DeviceInfo, AnalyticsData, QRCode, LinkClick, LinkSource, LinkClickStats } from '@/types';

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

// Get views count for last 24 hours for multiple codes
export async function getViews24h(codeIds: string[]): Promise<Record<string, number>> {
  if (codeIds.length === 0) return {};

  const result: Record<string, number> = {};
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Initialize all codes with 0
  codeIds.forEach((id) => {
    result[id] = 0;
  });

  // Firestore 'in' queries are limited to 30 items
  const chunks: string[][] = [];
  for (let i = 0; i < codeIds.length; i += 30) {
    chunks.push(codeIds.slice(i, i + 30));
  }

  for (const chunk of chunks) {
    const q = query(
      collection(db, 'viewLogs'),
      where('codeId', 'in', chunk),
      where('timestamp', '>=', Timestamp.fromDate(yesterday))
    );

    const snapshot = await getDocs(q);
    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      result[data.codeId] = (result[data.codeId] || 0) + 1;
    });
  }

  return result;
}

// Subscribe to real-time view counts for dashboard cards
export function subscribeToCodeViews(
  codeIds: string[],
  onData: (views: Record<string, number>) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (codeIds.length === 0) {
    onData({});
    return () => {};
  }

  const viewCounts: Record<string, number> = {};
  const unsubscribes: Unsubscribe[] = [];

  // Initialize
  codeIds.forEach((id) => {
    viewCounts[id] = 0;
  });

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Firestore 'in' queries are limited to 30 items
  const chunks: string[][] = [];
  for (let i = 0; i < codeIds.length; i += 30) {
    chunks.push(codeIds.slice(i, i + 30));
  }

  chunks.forEach((chunk) => {
    // Listen to viewLogs for these codes (last 24h for efficiency)
    const q = query(
      collection(db, 'viewLogs'),
      where('codeId', 'in', chunk),
      where('timestamp', '>=', Timestamp.fromDate(yesterday))
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // Reset counts for this chunk
        chunk.forEach((id) => {
          viewCounts[id] = 0;
        });

        // Count views
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          if (viewCounts[data.codeId] !== undefined) {
            viewCounts[data.codeId]++;
          }
        });

        onData({ ...viewCounts });
      },
      (error) => {
        console.error('Error in code views subscription:', error);
        onError?.(error);
      }
    );

    unsubscribes.push(unsubscribe);
  });

  return () => {
    unsubscribes.forEach((unsub) => unsub());
  };
}

// Subscribe to real-time views count on codes collection (for dashboard)
export function subscribeToTotalViews(
  codeIds: string[],
  onData: (views: Record<string, number>) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (codeIds.length === 0) {
    onData({});
    return () => {};
  }

  const viewCounts: Record<string, number> = {};
  const unsubscribes: Unsubscribe[] = [];

  // Initialize
  codeIds.forEach((id) => {
    viewCounts[id] = 0;
  });

  // Subscribe to each code document for views changes
  codeIds.forEach((codeId) => {
    const unsubscribe = onSnapshot(
      doc(db, 'codes', codeId),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          viewCounts[codeId] = data.views || 0;
          onData({ ...viewCounts });
        }
      },
      (error) => {
        console.error('Error in total views subscription:', error);
        onError?.(error);
      }
    );
    unsubscribes.push(unsubscribe);
  });

  return () => {
    unsubscribes.forEach((unsub) => unsub());
  };
}

// Real-time listener for view logs
export function subscribeToViewLogs(
  codeIds: string[],
  startDate: Date,
  endDate: Date,
  onData: (logs: ViewLog[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (codeIds.length === 0) {
    onData([]);
    return () => {};
  }

  const allLogs: Map<string, ViewLog> = new Map();
  const unsubscribes: Unsubscribe[] = [];

  // Firestore 'in' queries are limited to 30 items
  const chunks: string[][] = [];
  for (let i = 0; i < codeIds.length; i += 30) {
    chunks.push(codeIds.slice(i, i + 30));
  }

  chunks.forEach((chunk) => {
    const q = query(
      collection(db, 'viewLogs'),
      where('codeId', 'in', chunk),
      where('timestamp', '>=', Timestamp.fromDate(startDate)),
      where('timestamp', '<=', Timestamp.fromDate(endDate)),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          const log: ViewLog = {
            id: change.doc.id,
            codeId: data.codeId,
            shortId: data.shortId,
            ownerId: data.ownerId,
            timestamp: data.timestamp.toDate(),
            device: data.device,
          };

          if (change.type === 'added' || change.type === 'modified') {
            allLogs.set(change.doc.id, log);
          } else if (change.type === 'removed') {
            allLogs.delete(change.doc.id);
          }
        });

        // Convert map to sorted array and send to callback
        const sortedLogs = Array.from(allLogs.values()).sort(
          (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
        );
        onData(sortedLogs);
      },
      (error) => {
        console.error('Error in viewLogs subscription:', error);
        onError?.(error);
      }
    );

    unsubscribes.push(unsubscribe);
  });

  // Return a function that unsubscribes from all listeners
  return () => {
    unsubscribes.forEach((unsub) => unsub());
  };
}

// ============ LINK CLICK TRACKING ============

// Create a link click entry
export async function createLinkClick(
  codeId: string,
  shortId: string,
  ownerId: string,
  linkUrl: string,
  linkSource: LinkSource
): Promise<void> {
  const clickData = {
    codeId,
    shortId,
    ownerId,
    linkUrl,
    linkSource,
    timestamp: Timestamp.now(),
  };

  await addDoc(collection(db, 'linkClicks'), clickData);
}

// Subscribe to real-time link clicks
export function subscribeToLinkClicks(
  codeIds: string[],
  startDate: Date,
  endDate: Date,
  onData: (clicks: LinkClick[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (codeIds.length === 0) {
    onData([]);
    return () => {};
  }

  const allClicks: Map<string, LinkClick> = new Map();
  const unsubscribes: Unsubscribe[] = [];

  // Firestore 'in' queries are limited to 30 items
  const chunks: string[][] = [];
  for (let i = 0; i < codeIds.length; i += 30) {
    chunks.push(codeIds.slice(i, i + 30));
  }

  chunks.forEach((chunk) => {
    const q = query(
      collection(db, 'linkClicks'),
      where('codeId', 'in', chunk),
      where('timestamp', '>=', Timestamp.fromDate(startDate)),
      where('timestamp', '<=', Timestamp.fromDate(endDate)),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          const click: LinkClick = {
            id: change.doc.id,
            codeId: data.codeId,
            shortId: data.shortId,
            ownerId: data.ownerId,
            linkUrl: data.linkUrl,
            linkSource: data.linkSource,
            timestamp: data.timestamp.toDate(),
          };

          if (change.type === 'added' || change.type === 'modified') {
            allClicks.set(change.doc.id, click);
          } else if (change.type === 'removed') {
            allClicks.delete(change.doc.id);
          }
        });

        // Convert map to sorted array and send to callback
        const sortedClicks = Array.from(allClicks.values()).sort(
          (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
        );
        onData(sortedClicks);
      },
      (error) => {
        console.error('Error in linkClicks subscription:', error);
        onError?.(error);
      }
    );

    unsubscribes.push(unsubscribe);
  });

  return () => {
    unsubscribes.forEach((unsub) => unsub());
  };
}

// Aggregate link click stats
export function aggregateLinkClicks(clicks: LinkClick[]): LinkClickStats {
  const totalClicks = clicks.length;

  // Group by link URL and source
  const clicksByLinkMap = new Map<string, { url: string; source: LinkSource; count: number; lastClick: Date }>();

  clicks.forEach((click) => {
    const key = `${click.linkSource}:${click.linkUrl}`;
    const existing = clicksByLinkMap.get(key);

    if (existing) {
      existing.count++;
      if (click.timestamp > existing.lastClick) {
        existing.lastClick = click.timestamp;
      }
    } else {
      clicksByLinkMap.set(key, {
        url: click.linkUrl,
        source: click.linkSource,
        count: 1,
        lastClick: click.timestamp,
      });
    }
  });

  // Convert to array and sort by count
  const clicksByLink = Array.from(clicksByLinkMap.values()).sort((a, b) => b.count - a.count);

  return {
    totalClicks,
    clicksByLink,
  };
}

// Link source labels in Hebrew
export const linkSourceLabels: Record<LinkSource, string> = {
  pdf: 'PDF',
  media: 'מדיה',
  whatsapp: 'WhatsApp',
};
