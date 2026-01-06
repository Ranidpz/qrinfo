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
  XP_LEVELS,
  LeaderboardEntry,
  Prize,
  PendingPack,
  PackTrigger,
} from '@/types';
import {
  MessageQuota,
  DEFAULT_MESSAGE_QUOTA,
  MessageLog,
  VerificationCode,
  VerifiedVoter,
} from '@/types/verification';
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

  // Default QR sign with theQ logo
  const defaultQRSign = {
    enabled: true,
    type: 'logo',
    value: '/theQ.png',
    color: '#000000',
    backgroundColor: '#ffffff',
    scale: 1.0,
  };

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
    widgets: {
      qrSign: defaultQRSign,
    },
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
    widgets: {
      qrSign: {
        enabled: true,
        type: 'logo',
        value: '/theQ.png',
        color: '#000000',
        backgroundColor: '#ffffff',
        scale: 1.0,
      },
    },
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
    media: (data.media || []).map((m: Record<string, unknown>, index: number) => {
      // Handle qvoteConfig.stats.lastUpdated Timestamp conversion
      const qvoteConfig = m.qvoteConfig as Record<string, unknown> | undefined;
      if (qvoteConfig?.stats) {
        const stats = qvoteConfig.stats as Record<string, unknown>;
        if (stats.lastUpdated && typeof (stats.lastUpdated as Timestamp)?.toDate === 'function') {
          stats.lastUpdated = (stats.lastUpdated as Timestamp).toDate().toISOString();
        }
      }

      return {
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
        pendingReplacement: m.pendingReplacement ? {
          ...(m.pendingReplacement as object),
          scheduledAt: ((m.pendingReplacement as Record<string, unknown>).scheduledAt as Timestamp)?.toDate() || new Date(),
          uploadedAt: ((m.pendingReplacement as Record<string, unknown>).uploadedAt as Timestamp)?.toDate() || new Date(),
        } : undefined,
      };
    }),
    widgets: data.widgets || {},
    views: data.views || 0,
    isActive: data.isActive ?? true,
    folderId: data.folderId || undefined,
    userGallery: (data.userGallery || []).map((img: Record<string, unknown>) => ({
      ...img,
      uploadedAt: (img.uploadedAt as Timestamp)?.toDate() || new Date(),
    })),
    gallerySettings: data.gallerySettings,
    landingPageConfig: data.landingPageConfig,
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

  // Debug logging
  console.log('[getQRCodeByShortId] Raw data from Firestore:', {
    id: docSnap.id,
    title: data.title,
    folderId: data.folderId,
    hasFolder: !!data.folderId,
  });

  return {
    id: docSnap.id,
    shortId: data.shortId,
    ownerId: data.ownerId,
    collaborators: data.collaborators || [],
    title: data.title,
    media: (data.media || []).map((m: Record<string, unknown>, index: number) => {
      // Handle qvoteConfig.stats.lastUpdated Timestamp conversion
      const qvoteConfig = m.qvoteConfig as Record<string, unknown> | undefined;
      if (qvoteConfig?.stats) {
        const stats = qvoteConfig.stats as Record<string, unknown>;
        if (stats.lastUpdated && typeof (stats.lastUpdated as Timestamp)?.toDate === 'function') {
          stats.lastUpdated = (stats.lastUpdated as Timestamp).toDate().toISOString();
        }
      }

      return {
        ...m,
        id: m.id || `media_${Date.now()}_${index}`, // Ensure id exists for old records
        createdAt: (m.createdAt as Timestamp)?.toDate() || new Date(),
        pendingReplacement: m.pendingReplacement ? {
          ...(m.pendingReplacement as object),
          scheduledAt: ((m.pendingReplacement as Record<string, unknown>).scheduledAt as Timestamp)?.toDate() || new Date(),
          uploadedAt: ((m.pendingReplacement as Record<string, unknown>).uploadedAt as Timestamp)?.toDate() || new Date(),
        } : undefined,
      };
    }),
    widgets: data.widgets || {},
    views: data.views || 0,
    isActive: data.isActive ?? true,
    folderId: data.folderId, // For route/XP tracking
    userGallery: (data.userGallery || []).map((img: Record<string, unknown>) => ({
      ...img,
      uploadedAt: (img.uploadedAt as Timestamp)?.toDate() || new Date(),
    })),
    gallerySettings: data.gallerySettings,
    landingPageConfig: data.landingPageConfig,
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
        pendingReplacement: m.pendingReplacement ? {
          ...(m.pendingReplacement as object),
          scheduledAt: ((m.pendingReplacement as Record<string, unknown>).scheduledAt as Timestamp)?.toDate() || new Date(),
          uploadedAt: ((m.pendingReplacement as Record<string, unknown>).uploadedAt as Timestamp)?.toDate() || new Date(),
        } : undefined,
      })),
      widgets: data.widgets || {},
      views: data.views || 0,
      isActive: data.isActive ?? true,
      isGlobal: true,
      folderId: data.folderId || undefined,
      landingPageConfig: data.landingPageConfig,
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
        pendingReplacement: m.pendingReplacement ? {
          ...(m.pendingReplacement as object),
          scheduledAt: ((m.pendingReplacement as Record<string, unknown>).scheduledAt as Timestamp)?.toDate() || new Date(),
          uploadedAt: ((m.pendingReplacement as Record<string, unknown>).uploadedAt as Timestamp)?.toDate() || new Date(),
        } : undefined,
      })),
      widgets: data.widgets || {},
      views: data.views || 0,
      isActive: data.isActive ?? true,
      isGlobal: data.isGlobal ?? false,
      folderId: data.folderId || undefined,
      landingPageConfig: data.landingPageConfig,
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
        pendingReplacement: m.pendingReplacement ? {
          ...(m.pendingReplacement as object),
          scheduledAt: ((m.pendingReplacement as Record<string, unknown>).scheduledAt as Timestamp)?.toDate() || new Date(),
          uploadedAt: ((m.pendingReplacement as Record<string, unknown>).uploadedAt as Timestamp)?.toDate() || new Date(),
        } : undefined,
      })),
      widgets: data.widgets || {},
      views: data.views || 0,
      isActive: data.isActive ?? true,
      isGlobal: data.isGlobal ?? false,
      folderId: data.folderId || undefined,
      landingPageConfig: data.landingPageConfig,
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
  updates: Partial<Pick<QRCode, 'title' | 'media' | 'widgets' | 'collaborators' | 'isActive' | 'isGlobal' | 'landingPageConfig'>>
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
      if (m.pendingReplacement) {
        (mediaItem as Record<string, unknown>).pendingReplacement = {
          ...m.pendingReplacement,
          scheduledAt: m.pendingReplacement.scheduledAt instanceof Date
            ? Timestamp.fromDate(m.pendingReplacement.scheduledAt)
            : m.pendingReplacement.scheduledAt,
          uploadedAt: m.pendingReplacement.uploadedAt instanceof Date
            ? Timestamp.fromDate(m.pendingReplacement.uploadedAt)
            : m.pendingReplacement.uploadedAt,
        };
      }
      if (m.linkUrl) (mediaItem as Record<string, unknown>).linkUrl = m.linkUrl;
      if (m.linkTitle) (mediaItem as Record<string, unknown>).linkTitle = m.linkTitle;
      if (m.riddleContent) (mediaItem as Record<string, unknown>).riddleContent = m.riddleContent;
      if (m.selfiebeamContent) (mediaItem as Record<string, unknown>).selfiebeamContent = m.selfiebeamContent;
      if (m.qvoteConfig) (mediaItem as Record<string, unknown>).qvoteConfig = m.qvoteConfig;
      if (m.weeklycalConfig) (mediaItem as Record<string, unknown>).weeklycalConfig = m.weeklycalConfig;
      if (m.pdfSettings) (mediaItem as Record<string, unknown>).pdfSettings = m.pdfSettings;
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

  // Always fetch the visitor to get the latest nickname
  const visitor = await getVisitor(visitorId);
  const nickname = visitor?.nickname || 'Player';

  if (existing.exists()) {
    await updateDoc(docRef, {
      ...updates,
      nickname, // Always sync nickname from visitor
      updatedAt: serverTimestamp(),
    });
  } else {
    // Create new progress document
    const { setDoc } = await import('firebase/firestore');
    await setDoc(docRef, {
      id: progressId,
      visitorId,
      routeId,
      nickname,
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
  codeId: string,
  codeTitle?: string
): Promise<{
  xpEarned: number;
  isFirstVisit: boolean;
  totalXP: number;
  leveledUp?: boolean;
  packAwarded?: boolean;
}> {
  const progress = await getVisitorProgress(visitorId, routeId);
  const previousXP = progress?.xp || 0;

  // visitedStations is now an array of StationVisit objects
  const visitedStations = progress?.visitedStations || [];
  // Check if already visited by looking at codeId
  const isFirstVisit = !visitedStations.some(
    (station) => typeof station === 'object' ? station.codeId === codeId : station === codeId
  );

  if (!isFirstVisit) {
    return {
      xpEarned: 0,
      isFirstVisit: false,
      totalXP: previousXP,
    };
  }

  // First visit - add XP
  const xpEarned = XP_VALUES.SCAN_STATION;
  const newXP = previousXP + xpEarned;

  // Create new station visit record
  const newStationVisit = {
    codeId,
    title: codeTitle || 'תחנה',
    xpEarned,
    visitedAt: new Date(),
  };

  const newVisitedStations = [...visitedStations, newStationVisit];

  await updateVisitorProgress(visitorId, routeId, {
    xp: newXP,
    visitedStations: newVisitedStations,
  });

  // Update visitor's total XP
  await updateDoc(doc(db, 'visitors', visitorId), {
    totalXP: increment(xpEarned),
    updatedAt: serverTimestamp(),
  });

  // Check for level-up and award pack
  const levelUpResult = await checkAndAwardLevelUpPack(visitorId, previousXP, newXP, routeId);

  return {
    xpEarned,
    isFirstVisit: true,
    totalXP: newXP,
    leveledUp: levelUpResult.leveledUp,
    packAwarded: levelUpResult.packAwarded,
  };
}

// Record photo upload (adds XP)
export async function recordPhotoUpload(
  visitorId: string,
  routeId: string
): Promise<{
  xpEarned: number;
  totalXP: number;
  leveledUp?: boolean;
  packAwarded?: boolean;
}> {
  const progress = await getVisitorProgress(visitorId, routeId);
  const previousXP = progress?.xp || 0;

  const xpEarned = XP_VALUES.UPLOAD_PHOTO;
  const newXP = previousXP + xpEarned;
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

  // Check for level-up and award pack
  const levelUpResult = await checkAndAwardLevelUpPack(visitorId, previousXP, newXP, routeId);

  return {
    xpEarned,
    totalXP: newXP,
    leveledUp: levelUpResult.leveledUp,
    packAwarded: levelUpResult.packAwarded,
  };
}

// Remove XP when a photo is deleted
export async function removePhotoXP(
  visitorId: string,
  routeId: string
): Promise<{ xpRemoved: number; totalXP: number }> {
  const progress = await getVisitorProgress(visitorId, routeId);

  if (!progress || progress.photosUploaded <= 0) {
    return { xpRemoved: 0, totalXP: progress?.xp || 0 };
  }

  const xpToRemove = XP_VALUES.UPLOAD_PHOTO;
  const newXP = Math.max(0, (progress.xp || 0) - xpToRemove);
  const newPhotosUploaded = Math.max(0, (progress.photosUploaded || 0) - 1);

  await updateVisitorProgress(visitorId, routeId, {
    xp: newXP,
    photosUploaded: newPhotosUploaded,
  });

  // Update visitor's total XP (decrement)
  await updateDoc(doc(db, 'visitors', visitorId), {
    totalXP: increment(-xpToRemove),
    updatedAt: serverTimestamp(),
  });

  return {
    xpRemoved: xpToRemove,
    totalXP: newXP,
  };
}

// Check and award route completion bonus
export async function checkAndAwardRouteBonus(
  visitorId: string,
  routeId: string,
  routeConfig: RouteConfig,
  totalStations: number
): Promise<{ bonusAwarded: boolean; bonusXP: number; packAwarded?: boolean }> {
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

  // Award pack for route completion if prizes are enabled
  let packAwarded = false;
  if (routeConfig.prizesEnabled) {
    await createPendingPack(visitorId, routeId, 'route_complete');
    packAwarded = true;
  }

  return {
    bonusAwarded: true,
    bonusXP,
    packAwarded,
  };
}

// Get sibling codes (codes in the same folder, or main folder if no folderId)
export async function getSiblingCodes(
  userId: string,
  folderId: string | null | undefined
): Promise<QRCode[]> {
  let q;

  if (folderId) {
    // Get codes in the specified folder (no orderBy to avoid index requirement)
    q = query(
      collection(db, 'codes'),
      where('folderId', '==', folderId)
    );
  } else {
    // Get codes owned by user without a folder (main folder)
    q = query(
      collection(db, 'codes'),
      where('ownerId', '==', userId)
    );
  }

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
        pendingReplacement: m.pendingReplacement ? {
          ...(m.pendingReplacement as object),
          scheduledAt: ((m.pendingReplacement as Record<string, unknown>).scheduledAt as Timestamp)?.toDate() || new Date(),
          uploadedAt: ((m.pendingReplacement as Record<string, unknown>).uploadedAt as Timestamp)?.toDate() || new Date(),
        } : undefined,
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

  // Filter and sort client-side
  let filteredCodes = folderId
    ? codes
    : codes.filter(code => !code.folderId);

  // Sort by createdAt desc (newest first)
  return filteredCodes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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
        pendingReplacement: m.pendingReplacement ? {
          ...(m.pendingReplacement as object),
          scheduledAt: ((m.pendingReplacement as Record<string, unknown>).scheduledAt as Timestamp)?.toDate() || new Date(),
          uploadedAt: ((m.pendingReplacement as Record<string, unknown>).uploadedAt as Timestamp)?.toDate() || new Date(),
        } : undefined,
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

// ============ PACK / PRIZE SYSTEM ============

// Check if visitor leveled up and award a pack if prizes are enabled
export async function checkAndAwardLevelUpPack(
  visitorId: string,
  previousXP: number,
  newXP: number,
  routeId: string
): Promise<{ leveledUp: boolean; newLevel: typeof XP_LEVELS[0] | null; packAwarded: boolean }> {
  const previousLevel = getLevelForXP(previousXP);
  const newLevel = getLevelForXP(newXP);

  // Check if level increased
  if (newLevel.minXP <= previousLevel.minXP) {
    return { leveledUp: false, newLevel: null, packAwarded: false };
  }

  // Get route config to check if prizes are enabled
  const folder = await getFolder(routeId);
  if (!folder?.routeConfig?.prizesEnabled) {
    return { leveledUp: true, newLevel, packAwarded: false };
  }

  // Check if we already awarded a pack for this level
  const visitor = await getVisitor(visitorId);
  if (visitor?.lastLevelNotified && visitor.lastLevelNotified >= newLevel.minXP) {
    return { leveledUp: true, newLevel, packAwarded: false };
  }

  // Award the pack
  await createPendingPack(visitorId, routeId, 'level_up', newLevel.minXP);

  // Update visitor's last level notified
  await updateDoc(doc(db, 'visitors', visitorId), {
    lastLevelNotified: newLevel.minXP,
    updatedAt: serverTimestamp(),
  });

  return { leveledUp: true, newLevel, packAwarded: true };
}

// Create a pending pack for a visitor
export async function createPendingPack(
  visitorId: string,
  routeId: string,
  reason: PackTrigger,
  levelReached?: number
): Promise<PendingPack> {
  const packRef = await addDoc(collection(db, 'pendingPacks'), {
    visitorId,
    routeId,
    reason,
    levelReached: levelReached || null,
    earnedAt: serverTimestamp(),
    opened: false,
  });

  // Increment visitor's pending pack count
  await updateDoc(doc(db, 'visitors', visitorId), {
    pendingPackCount: increment(1),
    updatedAt: serverTimestamp(),
  });

  return {
    id: packRef.id,
    visitorId,
    routeId,
    reason,
    levelReached,
    earnedAt: new Date(),
    opened: false,
  };
}

// Get pending pack count for a visitor
export async function getPendingPackCount(visitorId: string): Promise<number> {
  const visitor = await getVisitor(visitorId);
  return visitor?.pendingPackCount || 0;
}

// ============ PRIZE CRUD ============

// Create a new prize
export async function createPrize(
  routeId: string,
  prize: Omit<Prize, 'id' | 'routeId' | 'claimed' | 'createdAt' | 'updatedAt'>
): Promise<Prize> {
  const prizeRef = await addDoc(collection(db, 'prizes'), {
    ...prize,
    routeId,
    claimed: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id: prizeRef.id,
    ...prize,
    routeId,
    claimed: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Update a prize
export async function updatePrize(
  prizeId: string,
  updates: Partial<Omit<Prize, 'id' | 'createdAt'>>
): Promise<void> {
  await updateDoc(doc(db, 'prizes', prizeId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

// Delete a prize
export async function deletePrize(prizeId: string): Promise<void> {
  await deleteDoc(doc(db, 'prizes', prizeId));
}

// Get all prizes for a route
export async function getRoutePrizes(routeId: string): Promise<Prize[]> {
  const q = query(
    collection(db, 'prizes'),
    where('routeId', '==', routeId)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Prize;
  });
}

// Get prize statistics for a route
export async function getRoutePrizeStats(routeId: string): Promise<{
  total: number;
  claimed: number;
  remaining: number;
  byRarity: Record<string, { total: number; claimed: number; remaining: number }>;
}> {
  const prizes = await getRoutePrizes(routeId);

  const stats = {
    total: 0,
    claimed: 0,
    remaining: 0,
    byRarity: {} as Record<string, { total: number; claimed: number; remaining: number }>,
  };

  for (const prize of prizes) {
    if (!prize.isActive) continue;

    stats.total += prize.totalAvailable;
    stats.claimed += prize.claimed;
    stats.remaining += prize.totalAvailable - prize.claimed;

    if (!stats.byRarity[prize.rarity]) {
      stats.byRarity[prize.rarity] = { total: 0, claimed: 0, remaining: 0 };
    }

    stats.byRarity[prize.rarity].total += prize.totalAvailable;
    stats.byRarity[prize.rarity].claimed += prize.claimed;
    stats.byRarity[prize.rarity].remaining += prize.totalAvailable - prize.claimed;
  }

  return stats;
}

// ============ MESSAGE QUOTA SYSTEM ============

// Get user's message quota
export async function getUserMessageQuota(userId: string): Promise<MessageQuota> {
  const user = await getUser(userId);
  return user?.messageQuota || DEFAULT_MESSAGE_QUOTA;
}

// Check if user can send a message (has remaining quota)
export async function checkMessageQuota(userId: string): Promise<{
  canSend: boolean;
  remaining: number;
  limit: number;
}> {
  const quota = await getUserMessageQuota(userId);
  const remaining = Math.max(0, quota.limit - quota.used);

  return {
    canSend: remaining > 0,
    remaining,
    limit: quota.limit,
  };
}

// Decrement user's message quota (after sending)
export async function decrementMessageQuota(userId: string): Promise<{
  success: boolean;
  remaining: number;
}> {
  const userRef = doc(db, 'users', userId);

  return runTransaction(db, async (transaction) => {
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const data = userDoc.data();
    const quota = data.messageQuota || DEFAULT_MESSAGE_QUOTA;
    const newUsed = quota.used + 1;

    // Check if we can send
    if (newUsed > quota.limit) {
      return { success: false, remaining: 0 };
    }

    // Update quota
    transaction.update(userRef, {
      messageQuota: {
        ...quota,
        used: newUsed,
      },
      updatedAt: serverTimestamp(),
    });

    return {
      success: true,
      remaining: quota.limit - newUsed,
    };
  });
}

// Add messages to user's quota (admin action)
export async function addMessageQuota(
  userId: string,
  amount: number
): Promise<{ newLimit: number }> {
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);

  if (!userDoc.exists()) {
    throw new Error('User not found');
  }

  const data = userDoc.data();
  const currentQuota = data.messageQuota || DEFAULT_MESSAGE_QUOTA;
  const newLimit = currentQuota.limit + amount;

  await updateDoc(userRef, {
    messageQuota: {
      ...currentQuota,
      limit: newLimit,
    },
    updatedAt: serverTimestamp(),
  });

  return { newLimit };
}

// Reset user's used messages (e.g., monthly reset)
export async function resetMessageQuotaUsage(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);

  if (!userDoc.exists()) {
    throw new Error('User not found');
  }

  const data = userDoc.data();
  const currentQuota = data.messageQuota || DEFAULT_MESSAGE_QUOTA;

  await updateDoc(userRef, {
    messageQuota: {
      ...currentQuota,
      used: 0,
      lastResetAt: serverTimestamp(),
    },
    updatedAt: serverTimestamp(),
  });
}

// Initialize quota for new user (called during user creation)
export async function initializeMessageQuota(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);

  await updateDoc(userRef, {
    messageQuota: DEFAULT_MESSAGE_QUOTA,
    updatedAt: serverTimestamp(),
  });
}

// ============ MESSAGE LOGS ============

// Log a sent message
export async function logMessage(
  userId: string,
  codeId: string,
  phone: string,
  method: 'whatsapp' | 'sms',
  status: 'sent' | 'delivered' | 'failed',
  errorMessage?: string
): Promise<MessageLog> {
  const logRef = await addDoc(collection(db, 'messageLogs'), {
    userId,
    codeId,
    phone,
    method,
    status,
    errorMessage: errorMessage || null,
    cost: 1, // Each message costs 1 credit
    createdAt: serverTimestamp(),
  });

  return {
    id: logRef.id,
    userId,
    codeId,
    phone,
    method,
    status,
    errorMessage,
    cost: 1,
    createdAt: new Date(),
  };
}

// Get message logs for a user
export async function getUserMessageLogs(
  userId: string,
  limitCount: number = 100
): Promise<MessageLog[]> {
  const { limit: firestoreLimit } = await import('firebase/firestore');

  const q = query(
    collection(db, 'messageLogs'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    firestoreLimit(limitCount)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      userId: data.userId,
      codeId: data.codeId,
      phone: data.phone,
      method: data.method,
      status: data.status,
      errorMessage: data.errorMessage,
      cost: data.cost || 1,
      createdAt: data.createdAt?.toDate() || new Date(),
    };
  });
}

// ============ VERIFICATION CODES ============

// Store a verification code
export async function createVerificationCode(
  verificationCode: Omit<VerificationCode, 'id'>
): Promise<VerificationCode> {
  const { setDoc } = await import('firebase/firestore');
  const docId = `${verificationCode.codeId}_${verificationCode.phone.replace(/\D/g, '')}_${Date.now()}`;

  await setDoc(doc(db, 'verificationCodes', docId), {
    ...verificationCode,
    id: docId,
    createdAt: Timestamp.fromDate(verificationCode.createdAt),
    expiresAt: Timestamp.fromDate(verificationCode.expiresAt),
  });

  return {
    ...verificationCode,
    id: docId,
  };
}

// Get the latest verification code for a phone
export async function getLatestVerificationCode(
  codeId: string,
  phone: string
): Promise<VerificationCode | null> {
  const normalizedPhone = phone.replace(/\D/g, '');

  const q = query(
    collection(db, 'verificationCodes'),
    where('codeId', '==', codeId),
    where('phone', '==', phone),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const data = snapshot.docs[0].data();
  return {
    id: snapshot.docs[0].id,
    codeId: data.codeId,
    phone: data.phone,
    codeHash: data.codeHash,
    attempts: data.attempts,
    method: data.method,
    status: data.status,
    createdAt: data.createdAt?.toDate() || new Date(),
    expiresAt: data.expiresAt?.toDate() || new Date(),
    verifiedAt: data.verifiedAt?.toDate(),
    blockedUntil: data.blockedUntil?.toDate(),
  };
}

// Update verification code status
export async function updateVerificationCode(
  verificationId: string,
  updates: Partial<Pick<VerificationCode, 'status' | 'attempts' | 'verifiedAt' | 'blockedUntil'>>
): Promise<void> {
  const updateData: Record<string, unknown> = { ...updates };

  if (updates.verifiedAt) {
    updateData.verifiedAt = Timestamp.fromDate(updates.verifiedAt);
  }
  if (updates.blockedUntil) {
    updateData.blockedUntil = Timestamp.fromDate(updates.blockedUntil);
  }

  await updateDoc(doc(db, 'verificationCodes', verificationId), updateData);
}

// ============ VERIFIED VOTERS ============

// Get or create verified voter
export async function getOrCreateVerifiedVoter(
  codeId: string,
  phone: string,
  maxVotes: number,
  name?: string
): Promise<VerifiedVoter> {
  const { setDoc } = await import('firebase/firestore');
  const normalizedPhone = phone.replace(/\D/g, '');
  const voterId = `${codeId}_${normalizedPhone}`;
  const voterRef = doc(db, 'verifiedVoters', voterId);

  const existing = await getDoc(voterRef);

  if (existing.exists()) {
    const data = existing.data();
    return {
      id: voterId,
      codeId: data.codeId,
      phone: data.phone,
      name: data.name,
      votesUsed: data.votesUsed,
      maxVotes: data.maxVotes,
      lastVerifiedAt: data.lastVerifiedAt?.toDate() || new Date(),
      sessionToken: data.sessionToken,
      sessionExpiresAt: data.sessionExpiresAt?.toDate() || new Date(),
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  }

  // Create new verified voter
  const now = new Date();
  const sessionExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  const newVoter: VerifiedVoter = {
    id: voterId,
    codeId,
    phone,
    name,
    votesUsed: 0,
    maxVotes,
    lastVerifiedAt: now,
    sessionToken: '', // Will be set by caller
    sessionExpiresAt,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(voterRef, {
    ...newVoter,
    lastVerifiedAt: Timestamp.fromDate(now),
    sessionExpiresAt: Timestamp.fromDate(sessionExpiresAt),
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  });

  return newVoter;
}

// Get verified voter by ID
export async function getVerifiedVoter(
  codeId: string,
  phone: string
): Promise<VerifiedVoter | null> {
  const normalizedPhone = phone.replace(/\D/g, '');
  const voterId = `${codeId}_${normalizedPhone}`;
  const voterDoc = await getDoc(doc(db, 'verifiedVoters', voterId));

  if (!voterDoc.exists()) return null;

  const data = voterDoc.data();
  return {
    id: voterId,
    codeId: data.codeId,
    phone: data.phone,
    name: data.name,
    votesUsed: data.votesUsed,
    maxVotes: data.maxVotes,
    lastVerifiedAt: data.lastVerifiedAt?.toDate() || new Date(),
    sessionToken: data.sessionToken,
    sessionExpiresAt: data.sessionExpiresAt?.toDate() || new Date(),
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  };
}

// Update verified voter (e.g., after voting)
export async function updateVerifiedVoter(
  codeId: string,
  phone: string,
  updates: Partial<Pick<VerifiedVoter, 'votesUsed' | 'sessionToken' | 'sessionExpiresAt' | 'lastVerifiedAt'>>
): Promise<void> {
  const normalizedPhone = phone.replace(/\D/g, '');
  const voterId = `${codeId}_${normalizedPhone}`;

  const updateData: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (updates.votesUsed !== undefined) {
    updateData.votesUsed = updates.votesUsed;
  }
  if (updates.sessionToken !== undefined) {
    updateData.sessionToken = updates.sessionToken;
  }
  if (updates.sessionExpiresAt) {
    updateData.sessionExpiresAt = Timestamp.fromDate(updates.sessionExpiresAt);
  }
  if (updates.lastVerifiedAt) {
    updateData.lastVerifiedAt = Timestamp.fromDate(updates.lastVerifiedAt);
  }

  await updateDoc(doc(db, 'verifiedVoters', voterId), updateData);
}

// Increment votes used for a verified voter
export async function incrementVerifiedVoterVotes(
  codeId: string,
  phone: string
): Promise<{ success: boolean; votesUsed: number; votesRemaining: number }> {
  const normalizedPhone = phone.replace(/\D/g, '');
  const voterId = `${codeId}_${normalizedPhone}`;
  const voterRef = doc(db, 'verifiedVoters', voterId);

  return runTransaction(db, async (transaction) => {
    const voterDoc = await transaction.get(voterRef);

    if (!voterDoc.exists()) {
      return { success: false, votesUsed: 0, votesRemaining: 0 };
    }

    const data = voterDoc.data();
    const currentVotes = data.votesUsed || 0;
    const maxVotes = data.maxVotes || 1;

    if (currentVotes >= maxVotes) {
      return { success: false, votesUsed: currentVotes, votesRemaining: 0 };
    }

    const newVotesUsed = currentVotes + 1;

    transaction.update(voterRef, {
      votesUsed: newVotesUsed,
      updatedAt: serverTimestamp(),
    });

    return {
      success: true,
      votesUsed: newVotesUsed,
      votesRemaining: maxVotes - newVotesUsed,
    };
  });
}

// Validate session token for a verified voter
export async function validateVoterSession(
  codeId: string,
  phone: string,
  sessionToken: string
): Promise<{ valid: boolean; votesRemaining: number }> {
  const voter = await getVerifiedVoter(codeId, phone);

  if (!voter) {
    return { valid: false, votesRemaining: 0 };
  }

  // Check session token
  if (voter.sessionToken !== sessionToken) {
    return { valid: false, votesRemaining: 0 };
  }

  // Check session expiry
  if (voter.sessionExpiresAt < new Date()) {
    return { valid: false, votesRemaining: 0 };
  }

  const votesRemaining = Math.max(0, voter.maxVotes - voter.votesUsed);
  return { valid: true, votesRemaining };
}
