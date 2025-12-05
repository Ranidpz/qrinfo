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
} from 'firebase/firestore';
import { db } from './firebase';
import { QRCode, MediaItem, User, Folder } from '@/types';

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
  media: Omit<MediaItem, 'id' | 'createdAt'>[]
): Promise<QRCode> {
  const shortId = generateShortId();

  const codeData = {
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
  };
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
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  };
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
  updates: Partial<Pick<QRCode, 'title' | 'media' | 'widgets' | 'collaborators' | 'isActive'>>
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
): Promise<void> {
  await updateDoc(doc(db, 'codes', codeId), {
    ownerId: newOwnerId,
    updatedAt: serverTimestamp(),
  });
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
