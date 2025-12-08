import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  QRCode,
  MediaItem,
  User,
  Folder,
  Notification,
  NotificationLocale,
  Visitor,
  VisitorProgress,
  RouteConfig,
  XP_VALUES,
  LeaderboardEntry,
} from '@/types';
import { getLevelForXP } from './xp';

// Generate a unique short ID for QR codes
export function generateShortId(length: number = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ============ QR CODES ============

// Create a new QR code
export async function createQRCode(
  ownerId: string,
  title: string,
  media: Omit<MediaItem, 'id' | 'createdAt'>[],
  folderId?: string | null
): Promise<QRCode> {
  const shortId = generateShortId();

  const codeData: Record<string, unknown> = {
    shortId,
    ownerId,
    collaborators: [],
    title,
    media: media.map((m, index) => ({
      ...m,
      id: `media_${Date.now()}_${index}`,
      createdAt: Timestamp.now(),
    })),
    widgets: {},
    views: 0,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // Add folderId if provided
  if (folderId) {
    codeData.folderId = folderId;
  }

  const docRef = await addDoc(collection(db, 'codes'), codeData);

  return {
    id: docRef.id,
    shortId,
    ownerId,
    collaborators: [],
    title,
    media: media.map((m, index) => ({
      ...m,
      id: `media_${Date.now()}_${index}`,
      createdAt: new Date(),
    })) as MediaItem[],
    widgets: {},
    views: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    folderId: folderId || undefined,
  } as QRCode;
}

// Get QR code by ID
export async function getQRCode(id: string): Promise<QRCode | null> {
  const docSnap = await getDoc(doc(db, 'codes', id));

  if (!docSnap.exists()) return null;

  const data = docSnap.data();
  return {
    id: docSnap.id,
    shortId: data.shortId,
    ownerId: data.ownerId,
    collaborators: data.collaborators || [],
    title: data.title,
    media: (data.media || []).map((m: Record<string, unknown>, index: number) => ({
      ...m,
      id: m.id || `media_${Date.now()}_${index}`, // Ensure id exists for old records
      createdAt: (m.createdAt as Timestamp)?.toDate() || new Date(),
      schedule: m.schedule ? {
        ...m.schedule as object,
        startDate: (m.schedule as Record<string, unknown>).startDate
          ? ((m.schedule as Record<string, unknown>).startDate as Timestamp).toDate()
          : undefined,
        endDate: (m.schedule as Record<string, unknown>).endDate
          ? ((m.schedule as Record<string, unknown>).endDate as Timestamp).toDate()
          : undefined,
      } : undefined,
    })),
    widgets: data.widgets || {},
    views: data.views || 0,
    isActive: data.isActive ?? true,
    folderId: data.folderId || undefined,
    userGallery: (data.userGallery || []).map((img: Record<string, unknown>) => ({
      ...img,
      uploadedAt: (img.uploadedAt as Timestamp)?.toDate() || new Date(),
    })),
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  };
}

// Get QR code by short ID (for viewer)
export async function getQRCodeByShortId(shortId: string): Promise<QRCode | null> {
  const q = query(collection(db, 'codes'), where('shortId', '==', shortId));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) return null;

  const docSnap = querySnapshot.docs[0];
  const data = docSnap.data();

  return {
    id: docSnap.id,
    shortId: data.shortId,
    ownerId: data.ownerId,
    collaborators: data.collaborators || [],
    title: data.title,
    media: (data.media || []).map((m: Record<string, unknown>, index: number) => ({
      ...m,
      id: m.id || `media_${Date.now()}_${index}`, // Ensure id exists for old records
      createdAt: (m.createdAt as Timestamp)?.toDate() || new Date(),
    })),
    widgets: data.widgets || {},
    views: data.views || 0,
    isActive: data.isActive ?? true,
    userGallery: (data.userGallery || []).map((img: Record<string, unknown>) => ({
      ...img,
      uploadedAt: (img.uploadedAt as Timestamp)?.toDate() || new Date(),
    })),
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  };
}

// Get all global QR codes (for unauthenticated users)
export async function getGlobalQRCodes(): Promise<QRCode[]> {
  // Simple query without orderBy to avoid requiring composite index
  const q = query(
    collection(db, 'codes'),
    where('isGlobal', '==', true)
  );

  const snapshot = await getDocs(q);

  const codes = snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      shortId: data.shortId,
      ownerId: data.ownerId,
      collaborators: data.collaborators || [],
      title: data.title,
      media: (data.media || []).map((m: Record<string, unknown>, index: number) => ({
        ...m,
        id: m.id || `media_${Date.now()}_${index}`,
        createdAt: (m.createdAt as Timestamp)?.toDate() || new Date(),
      })),
      widgets: data.widgets || {},
      views: data.views || 0,
      isActive: data.isActive ?? true,
      isGlobal: true,
      folderId: data.folderId || undefined,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  });

  // Sort by createdAt descending (client-side)
  return codes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// Get all QR codes for a user (owned + collaborated)
export async function getUserQRCodes(userId: string): Promise<QRCode[]> {
  // Get owned codes
  const ownedQuery = query(
    collection(db, 'codes'),
    where('ownerId', '==', userId),
    orderBy('createdAt', 'desc')
  );

  // Get collaborated codes
  const collabQuery = query(
    collection(db, 'codes'),
    where('collaborators', 'array-contains', userId),
    orderBy('createdAt', 'desc')
  );

  const [ownedSnapshot, collabSnapshot] = await Promise.all([
    getDocs(ownedQuery),
    getDocs(collabQuery),
  ]);

  const codes: QRCode[] = [];
  const seenIds = new Set<string>();

  const processDoc = (docSnap: typeof ownedSnapshot.docs[0]) => {
    if (seenIds.has(docSnap.id)) return;
    seenIds.add(docSnap.id);

    const data = docSnap.data();
    codes.push({
      id: docSnap.id,
      shortId: data.shortId,
      ownerId: data.ownerId,
      collaborators: data.collaborators || [],
      title: data.title,
      media: (data.media || []).map((m: Record<string, unknown>, index: number) => ({
        ...m,
        id: m.id || `media_${Date.now()}_${index}`, // Ensure id exists for old records
        createdAt: (m.createdAt as Timestamp)?.toDate() || new Date(),
      })),
      widgets: data.widgets || {},
      views: data.views || 0,
      isActive: data.isActive ?? true,
      isGlobal: data.isGlobal ?? false,
      folderId: data.folderId || undefined,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    });
  };

  ownedSnapshot.docs.forEach(processDoc);
  collabSnapshot.docs.forEach(processDoc);

  return codes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// Get ALL QR codes (for super admin)
export async function getAllQRCodes(): Promise<QRCode[]> {
  const q = query(
    collection(db, 'codes'),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      shortId: data.shortId,
      ownerId: data.ownerId,
      collaborators: data.collaborators || [],
      title: data.title,
      media: (data.media || []).map((m: Record<string, unknown>, index: number) => ({
        ...m,
        id: m.id || `media_${Date.now()}_${index}`,
        createdAt: (m.createdAt as Timestamp)?.toDate() || new Date(),
      })),
      widgets: data.widgets || {},
      views: data.views || 0,
      isActive: data.isActive ?? true,
      isGlobal: data.isGlobal ?? false,
      folderId: data.folderId || undefined,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  });
}

// Helper to remove undefined values from an object
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function removeUndefined(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

// Update QR code
export async function updateQRCode(
  id: string,
  updates: Partial<Pick<QRCode, 'title' | 'media' | 'widgets' | 'collaborators' | 'isActive' | 'isGlobal'>>
): Promise<void> {
  // Convert media createdAt to Firestore Timestamp if present and remove undefined values
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processedUpdates: Record<string, any> = { ...updates };
  if (processedUpdates.media) {
    processedUpdates.media = processedUpdates.media.map((m: MediaItem) => {
      const mediaItem = {
        id: m.id,
        url: m.url,
        type: m.type,
        size: m.size,
        order: m.order,
        uploadedBy: m.uploadedBy,
        createdAt: m.createdAt instanceof Date ? Timestamp.fromDate(m.createdAt) : m.createdAt,
      };
      // Only add optional fields if they exist
      if (m.title) (mediaItem as Record<string, unknown>).title = m.title;
      if (m.filename) (mediaItem as Record<string, unknown>).filename = m.filename;
      if (m.pageCount) (mediaItem as Record<string, unknown>).pageCount = m.pageCount;
      if (m.schedule) (mediaItem as Record<string, unknown>).schedule = m.schedule;
      if (m.linkUrl) (mediaItem as Record<string, unknown>).linkUrl = m.linkUrl;
      if (m.linkTitle) (mediaItem as Record<string, unknown>).linkTitle = m.linkTitle;
      if (m.riddleContent) (mediaItem as Record<string, unknown>).riddleContent = m.riddleContent;
      if (m.selfiebeamContent) (mediaItem as Record<string, unknown>).selfiebeamContent = m.selfiebeamContent;
      return mediaItem;
    });
  }

  await updateDoc(doc(db, 'codes', id), {
    ...removeUndefined(processedUpdates),
    updatedAt: serverTimestamp(),
  });
}

// Delete QR code
export async function deleteQRCode(id: string): Promise<void> {
  await deleteDoc(doc(db, 'codes', id));
}

// Increment view count and create view log
export async function incrementViews(
  id: string,
  shortId: string,
  ownerId: string,
  userAgent: string
): Promise<void> {
  // Increment the counter (atomic, fast)
  await updateDoc(doc(db, 'codes', id), {
    views: increment(1),
  });

  // Create detailed view log (fire and forget - don't block the page load)
  import('./analytics').then(({ createViewLog }) => {
    createViewLog(id, shortId, ownerId, userAgent).catch(console.error);
  });
}

// ============ USERS ============

// Update user storage
export async function updateUserStorage(userId: string, bytesChange: number): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    storageUsed: increment(bytesChange),
    updatedAt: serverTimestamp(),
  });
}

// Check and update storage with transaction (prevents race conditions)
// Returns true if storage was updated successfully, false if quota exceeded
export async function checkAndUpdateStorage(
  userId: string,
  bytesToAdd: number
): Promise<{ success: boolean; currentUsage: number; limit: number }> {
  const userRef = doc(db, 'users', userId);

  return runTransaction(db, async (transaction) => {
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const data = userDoc.data();
    const currentUsage = data.storageUsed || 0;
    const limit = data.storageLimit || 0;

    // Check if adding bytes would exceed limit
    if (currentUsage + bytesToAdd > limit) {
      return {
        success: false,
        currentUsage,
        limit,
      };
    }

    // Update storage atomically
    transaction.update(userRef, {
      storageUsed: currentUsage + bytesToAdd,
      updatedAt: serverTimestamp(),
    });

    return {
      success: true,
      currentUsage: currentUsage + bytesToAdd,
      limit,
    };
  });
}

// Get user by ID
export async function getUser(userId: string): Promise<User | null> {
  const docSnap = await getDoc(doc(db, 'users', userId));

  if (!docSnap.exists()) return null;

  const data = docSnap.data();
  return {
    id: docSnap.id,
    email: data.email,
    displayName: data.displayName,
    role: data.role,
    storageLimit: data.storageLimit,
    storageUsed: data.storageUsed,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  };
}

// Get all users (admin only)
export async function getAllUsers(): Promise<User[]> {
  const querySnapshot = await getDocs(collection(db, 'users'));

  return querySnapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      email: data.email,
      displayName: data.displayName,
      role: data.role,
      storageLimit: data.storageLimit,
      storageUsed: data.storageUsed,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  });
}

// Update user role (admin only)
export async function updateUserRole(
  userId: string,
  role: User['role'],
  storageLimit?: number
): Promise<void> {
  const updates: Record<string, unknown> = {
    role,
    updatedAt: serverTimestamp(),
  };

  if (storageLimit !== undefined) {
    updates.storageLimit = storageLimit;
  }

  await updateDoc(doc(db, 'users', userId), updates);
}

// ============ HELPERS ============

// Check if user can edit a code
export function canEditCode(code: QRCode, userId: string, userRole: User['role']): boolean {
  if (userRole === 'super_admin') return true;
  if (code.ownerId === userId) return true;
  if (code.collaborators.includes(userId)) return true;
  return false;
}

// Check if user can delete a code
export function canDeleteCode(code: QRCode, userId: string, userRole: User['role']): boolean {
  if (userRole === 'super_admin') return true;
  if (code.ownerId === userId) return true;
  return false;
}

// Transfer code ownership
// When transferring, the code moves to the new owner
// If the code is in a folder, we find or create a matching folder for the new owner
export async function transferCodeOwnership(
  codeId: string,
  newOwnerId: string
): Promise<void> {
  // Get the current code to check if it's in a folder
  const codeDoc = await getDoc(doc(db, 'codes', codeId));
  if (!codeDoc.exists()) {
    throw new Error('Code not found');
  }

  const codeData = codeDoc.data();
  const currentFolderId = codeData.folderId;

  // If the code is in a folder, find or create a matching folder for the new owner
  let newFolderId: string | null = null;

  if (currentFolderId) {
    // Get the current folder to get its name
    const currentFolderDoc = await getDoc(doc(db, 'folders', currentFolderId));

    if (currentFolderDoc.exists()) {
      const currentFolderData = currentFolderDoc.data();
      const folderName = currentFolderData.name;
      const folderColor = currentFolderData.color;

      // Check if new owner already has a folder with the same name
      const newOwnerFoldersQuery = query(
        collection(db, 'folders'),
        where('ownerId', '==', newOwnerId),
        where('name', '==', folderName)
      );
      const existingFolders = await getDocs(newOwnerFoldersQuery);

      if (!existingFolders.empty) {
        // Use existing folder
        newFolderId = existingFolders.docs[0].id;
      } else {
        // Create a new folder for the new owner with the same name and color
        const newFolderRef = await addDoc(collection(db, 'folders'), {
          name: folderName,
          ownerId: newOwnerId,
          color: folderColor || '#3b82f6',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        newFolderId = newFolderRef.id;
      }
    }
  }

  // Update the code with new owner and new folder (if applicable)
  const updateData: Record<string, unknown> = {
    ownerId: newOwnerId,
    updatedAt: serverTimestamp(),
  };

  if (newFolderId !== null) {
    updateData.folderId = newFolderId;
  } else if (currentFolderId) {
    // If there was a folder but we couldn't find/create a new one, remove the folder reference
    updateData.folderId = null;
  }

  await updateDoc(doc(db, 'codes', codeId), updateData);
}

// ============ FOLDERS ============

// Create a new folder
export async function createFolder(
  ownerId: string,
  name: string,
  color?: string
): Promise<Folder> {
  const folderData = {
    name,
    ownerId,
    color: color || '#3b82f6',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'folders'), folderData);

  return {
    id: docRef.id,
    name,
    ownerId,
    color: color || '#3b82f6',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Get user's folders
export async function getUserFolders(userId: string): Promise<Folder[]> {
  const q = query(
    collection(db, 'folders'),
    where('ownerId', '==', userId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      name: data.name,
      ownerId: data.ownerId,
      color: data.color,
      routeConfig: data.routeConfig,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  });
}

// Get ALL folders (for super admin)
export async function getAllFolders(): Promise<Folder[]> {
  const q = query(
    collection(db, 'folders'),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      name: data.name,
      ownerId: data.ownerId,
      color: data.color,
      routeConfig: data.routeConfig,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  });
}

// Update folder
export async function updateFolder(
  folderId: string,
  updates: Partial<Pick<Folder, 'name' | 'color'>>
): Promise<void> {
  await updateDoc(doc(db, 'folders', folderId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

// Delete folder
export async function deleteFolder(folderId: string): Promise<void> {
  // Remove folderId from all codes in this folder
  const codesQuery = query(
    collection(db, 'codes'),
    where('folderId', '==', folderId)
  );
  const codesSnapshot = await getDocs(codesQuery);

  const updatePromises = codesSnapshot.docs.map((docSnap) =>
    updateDoc(doc(db, 'codes', docSnap.id), {
      folderId: null,
      updatedAt: serverTimestamp(),
    })
  );

  await Promise.all(updatePromises);

  // Delete the folder
  await deleteDoc(doc(db, 'folders', folderId));
}

// Move code to folder
export async function moveCodeToFolder(
  codeId: string,
  folderId: string | null
): Promise<void> {
  await updateDoc(doc(db, 'codes', codeId), {
    folderId: folderId,
    updatedAt: serverTimestamp(),
  });
}

// ============ NOTIFICATIONS ============

// Create a new notification (admin only)
export async function createNotification(
  title: string,
  message: string,
  createdBy: string,
  locale: NotificationLocale = 'all'
): Promise<Notification> {
  const notificationData = {
    title,
    message,
    createdBy,
    locale,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'notifications'), notificationData);

  return {
    id: docRef.id,
    title,
    message,
    createdBy,
    locale,
    createdAt: new Date(),
  };
}

// Get all notifications for a specific locale (ordered by newest first)
// Returns notifications that match the locale OR have locale='all'
export async function getNotifications(locale: 'he' | 'en' = 'he'): Promise<Notification[]> {
  const q = query(
    collection(db, 'notifications'),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        title: data.title,
        message: data.message,
        createdBy: data.createdBy,
        locale: data.locale || 'all', // Default to 'all' for backwards compatibility
        createdAt: data.createdAt?.toDate() || new Date(),
      };
    })
    .filter((n) => n.locale === locale || n.locale === 'all');
}

// Delete notification (admin only)
export async function deleteNotification(notificationId: string): Promise<void> {
  await deleteDoc(doc(db, 'notifications', notificationId));
}

// Update notification (admin only)
export async function updateNotification(
  notificationId: string,
  updates: { title?: string; message?: string }
): Promise<void> {
  await updateDoc(doc(db, 'notifications', notificationId), updates);
}

// Create version update notifications (creates one for each locale if doesn't exist)
// Uses localStorage to track which versions have been notified to avoid duplicates
const VERSION_NOTIFIED_KEY = 'qr_version_notified';

export async function createVersionNotification(
  version: string,
  highlights: { he: string[]; en: string[] }
): Promise<void> {
  // Check localStorage first to avoid duplicate notifications
  if (typeof window !== 'undefined') {
    const notifiedVersions = localStorage.getItem(VERSION_NOTIFIED_KEY);
    const versions = notifiedVersions ? JSON.parse(notifiedVersions) : [];
    if (versions.includes(version)) {
      return; // Already created notifications for this version
    }

    // Mark as "in progress" immediately to prevent race conditions
    // (multiple tabs or rapid page loads)
    versions.push(version);
    localStorage.setItem(VERSION_NOTIFIED_KEY, JSON.stringify(versions));
  }

  // Check Firestore for existing version notifications
  const q = query(
    collection(db, 'notifications'),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  const allNotifs = snapshot.docs.map((docSnap) => docSnap.data());

  // Check if Hebrew version exists
  const heExists = allNotifs.some(n => n.title === `גרסה ${version}` && n.locale === 'he');
  // Check if English version exists
  const enExists = allNotifs.some(n => n.title === `Version ${version}` && n.locale === 'en');

  // Create Hebrew notification if doesn't exist
  if (!heExists) {
    const heNotificationData = {
      title: `גרסה ${version}`,
      message: highlights.he.join('\n'),
      createdBy: 'system',
      locale: 'he',
      createdAt: serverTimestamp(),
      isVersionUpdate: true,
      version,
    };
    await addDoc(collection(db, 'notifications'), heNotificationData);
  }

  // Create English notification if doesn't exist
  if (!enExists) {
    const enNotificationData = {
      title: `Version ${version}`,
      message: highlights.en.join('\n'),
      createdBy: 'system',
      locale: 'en',
      createdAt: serverTimestamp(),
      isVersionUpdate: true,
      version,
    };
    await addDoc(collection(db, 'notifications'), enNotificationData);
  }
}

// ============ GAMIFICATION / XP SYSTEM ============

// Get visitor by ID
export async function getVisitor(visitorId: string): Promise<Visitor | null> {
  const docSnap = await getDoc(doc(db, 'visitors', visitorId));

  if (!docSnap.exists()) return null;

  const data = docSnap.data();
  return {
    id: docSnap.id,
    nickname: data.nickname,
    consent: data.consent || false,
    consentTimestamp: data.consentTimestamp?.toDate(),
    totalXP: data.totalXP || 0,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  };
}

// Create or get visitor (upsert)
export async function getOrCreateVisitor(
  visitorId: string,
  nickname?: string
): Promise<Visitor> {
  const existing = await getVisitor(visitorId);
  if (existing) return existing;

  // Create new visitor
  const visitorData = {
    id: visitorId,
    nickname: nickname || '',
    consent: false,
    totalXP: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await updateDoc(doc(db, 'visitors', visitorId), visitorData).catch(async () => {
    // Document doesn't exist, create it with setDoc
    const { setDoc } = await import('firebase/firestore');
    await setDoc(doc(db, 'visitors', visitorId), visitorData);
  });

  return {
    id: visitorId,
    nickname: nickname || '',
    consent: false,
    totalXP: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Update visitor profile
export async function updateVisitor(
  visitorId: string,
  updates: Partial<Pick<Visitor, 'nickname' | 'consent'>>
): Promise<void> {
  const updateData: Record<string, unknown> = {
    ...updates,
    updatedAt: serverTimestamp(),
  };

  // Add consent timestamp if consent is being set to true
  if (updates.consent === true) {
    updateData.consentTimestamp = serverTimestamp();
  }

  await updateDoc(doc(db, 'visitors', visitorId), updateData);
}

// Get visitor progress for a specific route
export async function getVisitorProgress(
  visitorId: string,
  routeId: string
): Promise<VisitorProgress | null> {
  const progressId = `${visitorId}_${routeId}`;
  const docSnap = await getDoc(doc(db, 'visitorProgress', progressId));

  if (!docSnap.exists()) return null;

  const data = docSnap.data();
  return {
    id: docSnap.id,
    visitorId: data.visitorId,
    routeId: data.routeId,
    xp: data.xp || 0,
    visitedStations: data.visitedStations || [],
    photosUploaded: data.photosUploaded || 0,
    bonusAwarded: data.bonusAwarded || false,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  };
}

// Create or update visitor progress
export async function updateVisitorProgress(
  visitorId: string,
  routeId: string,
  updates: Partial<Pick<VisitorProgress, 'xp' | 'visitedStations' | 'photosUploaded' | 'bonusAwarded'>>
): Promise<void> {
  const progressId = `${visitorId}_${routeId}`;
  const docRef = doc(db, 'visitorProgress', progressId);
  const existing = await getDoc(docRef);

  if (existing.exists()) {
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } else {
    // Create new progress document
    const { setDoc } = await import('firebase/firestore');
    await setDoc(docRef, {
      id: progressId,
      visitorId,
      routeId,
      xp: updates.xp || 0,
      visitedStations: updates.visitedStations || [],
      photosUploaded: updates.photosUploaded || 0,
      bonusAwarded: updates.bonusAwarded || false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

// Record station scan (adds XP if first visit)
export async function recordStationScan(
  visitorId: string,
  routeId: string,
  codeId: string
): Promise<{ xpEarned: number; isFirstVisit: boolean; totalXP: number }> {
  const progress = await getVisitorProgress(visitorId, routeId);

  const visitedStations = progress?.visitedStations || [];
  const isFirstVisit = !visitedStations.includes(codeId);

  if (!isFirstVisit) {
    return {
      xpEarned: 0,
      isFirstVisit: false,
      totalXP: progress?.xp || 0,
    };
  }

  // First visit - add XP
  const xpEarned = XP_VALUES.SCAN_STATION;
  const newXP = (progress?.xp || 0) + xpEarned;
  const newVisitedStations = [...visitedStations, codeId];

  await updateVisitorProgress(visitorId, routeId, {
    xp: newXP,
    visitedStations: newVisitedStations,
  });

  // Update visitor's total XP
  await updateDoc(doc(db, 'visitors', visitorId), {
    totalXP: increment(xpEarned),
    updatedAt: serverTimestamp(),
  });

  return {
    xpEarned,
    isFirstVisit: true,
    totalXP: newXP,
  };
}

// Record photo upload (adds XP)
export async function recordPhotoUpload(
  visitorId: string,
  routeId: string
): Promise<{ xpEarned: number; totalXP: number }> {
  const progress = await getVisitorProgress(visitorId, routeId);

  const xpEarned = XP_VALUES.UPLOAD_PHOTO;
  const newXP = (progress?.xp || 0) + xpEarned;
  const newPhotosUploaded = (progress?.photosUploaded || 0) + 1;

  await updateVisitorProgress(visitorId, routeId, {
    xp: newXP,
    photosUploaded: newPhotosUploaded,
  });

  // Update visitor's total XP
  await updateDoc(doc(db, 'visitors', visitorId), {
    totalXP: increment(xpEarned),
    updatedAt: serverTimestamp(),
  });

  return {
    xpEarned,
    totalXP: newXP,
  };
}

// Check and award route completion bonus
export async function checkAndAwardRouteBonus(
  visitorId: string,
  routeId: string,
  routeConfig: RouteConfig,
  totalStations: number
): Promise<{ bonusAwarded: boolean; bonusXP: number }> {
  const progress = await getVisitorProgress(visitorId, routeId);

  if (!progress || progress.bonusAwarded) {
    return { bonusAwarded: false, bonusXP: 0 };
  }

  // Check if threshold is met
  const threshold = routeConfig.bonusThreshold === 0
    ? totalStations
    : (routeConfig.bonusThreshold || totalStations);

  if (progress.visitedStations.length < threshold) {
    return { bonusAwarded: false, bonusXP: 0 };
  }

  // Award bonus
  const bonusXP = routeConfig.bonusXP || XP_VALUES.ROUTE_BONUS_BASE;
  const newXP = progress.xp + bonusXP;

  await updateVisitorProgress(visitorId, routeId, {
    xp: newXP,
    bonusAwarded: true,
  });

  // Update visitor's total XP
  await updateDoc(doc(db, 'visitors', visitorId), {
    totalXP: increment(bonusXP),
    updatedAt: serverTimestamp(),
  });

  return {
    bonusAwarded: true,
    bonusXP,
  };
}

// Get all codes in a route (folder with isRoute=true)
export async function getRouteCodes(routeId: string): Promise<QRCode[]> {
  const q = query(
    collection(db, 'codes'),
    where('folderId', '==', routeId)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      shortId: data.shortId,
      ownerId: data.ownerId,
      collaborators: data.collaborators || [],
      title: data.title,
      media: (data.media || []).map((m: Record<string, unknown>, index: number) => ({
        ...m,
        id: m.id || `media_${Date.now()}_${index}`,
        createdAt: (m.createdAt as Timestamp)?.toDate() || new Date(),
      })),
      widgets: data.widgets || {},
      views: data.views || 0,
      isActive: data.isActive ?? true,
      folderId: data.folderId,
      userGallery: (data.userGallery || []).map((img: Record<string, unknown>) => ({
        ...img,
        uploadedAt: (img.uploadedAt as Timestamp)?.toDate() || new Date(),
      })),
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  });
}

// Get route leaderboard (top N visitors by XP)
export async function getRouteLeaderboard(
  routeId: string,
  limit: number = 10
): Promise<LeaderboardEntry[]> {
  const { limit: firestoreLimit } = await import('firebase/firestore');

  const q = query(
    collection(db, 'visitorProgress'),
    where('routeId', '==', routeId),
    orderBy('xp', 'desc'),
    firestoreLimit(limit)
  );

  const snapshot = await getDocs(q);

  // Get visitor details for each progress entry
  const entries: LeaderboardEntry[] = [];
  let rank = 1;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const visitor = await getVisitor(data.visitorId);

    if (visitor && visitor.nickname) {
      entries.push({
        rank,
        visitorId: data.visitorId,
        nickname: visitor.nickname,
        xp: data.xp || 0,
        level: getLevelForXP(data.xp || 0),
        photosUploaded: data.photosUploaded || 0,
      });
      rank++;
    }
  }

  return entries;
}

// Update folder route configuration
export async function updateFolderRouteConfig(
  folderId: string,
  routeConfig: RouteConfig
): Promise<void> {
  await updateDoc(doc(db, 'folders', folderId), {
    routeConfig,
    updatedAt: serverTimestamp(),
  });
}

// Get folder by ID (including route config)
export async function getFolder(folderId: string): Promise<Folder | null> {
  const docSnap = await getDoc(doc(db, 'folders', folderId));

  if (!docSnap.exists()) return null;

  const data = docSnap.data();
  return {
    id: docSnap.id,
    name: data.name,
    ownerId: data.ownerId,
    color: data.color,
    routeConfig: data.routeConfig,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  };
}
