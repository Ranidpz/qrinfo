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
import { QRCode, MediaItem, User, Folder, Notification } from '@/types';

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
      if (m.schedule) (mediaItem as Record<string, unknown>).schedule = m.schedule;
      if (m.linkUrl) (mediaItem as Record<string, unknown>).linkUrl = m.linkUrl;
      if (m.linkTitle) (mediaItem as Record<string, unknown>).linkTitle = m.linkTitle;
      if (m.riddleContent) (mediaItem as Record<string, unknown>).riddleContent = m.riddleContent;
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

// Transfer code ownership (admin only)
export async function transferCodeOwnership(
  codeId: string,
  newOwnerId: string
): Promise<{ newFolderId?: string }> {
  // 1. Get the code to check if it has a folder
  const codeDoc = await getDoc(doc(db, 'codes', codeId));
  if (!codeDoc.exists()) throw new Error('Code not found');

  const codeData = codeDoc.data();
  const currentFolderId = codeData.folderId;

  let newFolderId: string | undefined = undefined;

  // 2. If code has a folder, handle folder transfer
  if (currentFolderId) {
    // Get current folder details
    const folderDoc = await getDoc(doc(db, 'folders', currentFolderId));
    if (folderDoc.exists()) {
      const folderData = folderDoc.data();
      const folderName = folderData.name;
      const folderColor = folderData.color;

      // Check if new owner has a folder with same name
      const existingFolderQuery = query(
        collection(db, 'folders'),
        where('ownerId', '==', newOwnerId),
        where('name', '==', folderName)
      );
      const existingFolders = await getDocs(existingFolderQuery);

      if (!existingFolders.empty) {
        // Use existing folder
        newFolderId = existingFolders.docs[0].id;
      } else {
        // Create new folder for new owner
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

  // 3. Update the code with new owner and folder
  await updateDoc(doc(db, 'codes', codeId), {
    ownerId: newOwnerId,
    folderId: newFolderId || null,
    updatedAt: serverTimestamp(),
  });

  return { newFolderId };
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
  createdBy: string
): Promise<Notification> {
  const notificationData = {
    title,
    message,
    createdBy,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'notifications'), notificationData);

  return {
    id: docRef.id,
    title,
    message,
    createdBy,
    createdAt: new Date(),
  };
}

// Get all notifications (ordered by newest first)
export async function getNotifications(): Promise<Notification[]> {
  const q = query(
    collection(db, 'notifications'),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      title: data.title,
      message: data.message,
      createdBy: data.createdBy,
      createdAt: data.createdAt?.toDate() || new Date(),
    };
  });
}

// Delete notification (admin only)
export async function deleteNotification(notificationId: string): Promise<void> {
  await deleteDoc(doc(db, 'notifications', notificationId));
}

// Create a version update notification (only if doesn't exist)
// Uses localStorage to track which versions have been notified to avoid duplicates
const VERSION_NOTIFIED_KEY = 'qr_version_notified';

export async function createVersionNotification(
  version: string,
  highlights: string[]
): Promise<Notification | null> {
  // Check localStorage first to avoid duplicate notifications
  if (typeof window !== 'undefined') {
    const notifiedVersions = localStorage.getItem(VERSION_NOTIFIED_KEY);
    const versions = notifiedVersions ? JSON.parse(notifiedVersions) : [];
    if (versions.includes(version)) {
      return null; // Already created notification for this version
    }
  }

  // Also check Firestore to be safe (simple title check)
  const allNotifs = await getNotifications();
  const exists = allNotifs.some(n => n.title === `גרסה ${version}`);
  if (exists) {
    // Mark as notified in localStorage even if we found it in Firestore
    if (typeof window !== 'undefined') {
      const notifiedVersions = localStorage.getItem(VERSION_NOTIFIED_KEY);
      const versions = notifiedVersions ? JSON.parse(notifiedVersions) : [];
      versions.push(version);
      localStorage.setItem(VERSION_NOTIFIED_KEY, JSON.stringify(versions));
    }
    return null;
  }

  const title = `גרסה ${version}`;
  const message = highlights.join('\n');

  const notificationData = {
    title,
    message,
    createdBy: 'system',
    createdAt: serverTimestamp(),
    isVersionUpdate: true,
    version,
  };

  const docRef = await addDoc(collection(db, 'notifications'), notificationData);

  // Mark as notified in localStorage
  if (typeof window !== 'undefined') {
    const notifiedVersions = localStorage.getItem(VERSION_NOTIFIED_KEY);
    const versions = notifiedVersions ? JSON.parse(notifiedVersions) : [];
    versions.push(version);
    localStorage.setItem(VERSION_NOTIFIED_KEY, JSON.stringify(versions));
  }

  return {
    id: docRef.id,
    title,
    message,
    createdBy: 'system',
    createdAt: new Date(),
  };
}
