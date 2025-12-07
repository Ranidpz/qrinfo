'use client';

import { useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { UserGalleryImage, GallerySettings, GalleryDisplayMode } from '@/types';
import { X, Trash2, Settings, Loader2, ImageIcon, Play, Shuffle } from 'lucide-react';
import { onSnapshot, doc, updateDoc, Timestamp, getDoc } from 'firebase/firestore';

// Styled tooltip component that appears immediately on hover
// position: 'below' (default) or 'above'
function Tooltip({ children, text, position = 'below' }: { children: ReactNode; text: string; position?: 'below' | 'above' }) {
  if (position === 'above') {
    return (
      <div className="relative group/tooltip">
        {children}
        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-black text-white text-xs rounded-lg shadow-xl whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-100 border border-white/20" style={{ zIndex: 9999 }}>
          {text}
          {/* Arrow pointing down */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="border-4 border-transparent border-t-black" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative group/tooltip">
      {children}
      <div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1.5 bg-black text-white text-xs rounded-lg shadow-xl whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-100 border border-white/20" style={{ zIndex: 9999 }}>
        {text}
        {/* Arrow pointing up */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-[-1px]">
          <div className="border-4 border-transparent border-b-black" />
        </div>
      </div>
    </div>
  );
}
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

interface GalleryClientProps {
  codeId: string;
  shortId: string;
  ownerId: string;
  title: string;
  initialImages: UserGalleryImage[];
  initialSettings?: GallerySettings;
}

const DEFAULT_SETTINGS: GallerySettings = {
  displayMode: 'static',
  displayLimit: 0,
  gridColumns: 3,
  headerHidden: false,
  showNames: false,
  fadeEffect: false,
  borderRadius: 0,
  nameSize: 14,
  showNewBadge: false,
};

// Get adjacent slots (up, down, left, right) for a given slot
function getAdjacentSlots(slotIndex: number, totalSlots: number, columns: number): number[] {
  const adjacent: number[] = [];
  const row = Math.floor(slotIndex / columns);
  const col = slotIndex % columns;

  // Up
  if (row > 0) adjacent.push(slotIndex - columns);
  // Down
  if (slotIndex + columns < totalSlots) adjacent.push(slotIndex + columns);
  // Left
  if (col > 0) adjacent.push(slotIndex - 1);
  // Right
  if (col < columns - 1) adjacent.push(slotIndex + 1);

  return adjacent;
}

export default function GalleryClient({
  codeId,
  shortId,
  ownerId,
  title,
  initialImages,
  initialSettings,
}: GalleryClientProps) {
  const { user } = useAuth();
  const isOwner = user?.id === ownerId;

  // Merge initial settings with defaults
  const settings = { ...DEFAULT_SETTINGS, ...initialSettings };

  const [images, setImages] = useState<UserGalleryImage[]>(initialImages);
  const [lightboxImage, setLightboxImage] = useState<UserGalleryImage | null>(null);
  const [gridColumns, setGridColumns] = useState(settings.gridColumns);
  const [newImageIds, setNewImageIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [displayLimit, setDisplayLimit] = useState<number>(settings.displayLimit);
  const [displayMode, setDisplayMode] = useState<GalleryDisplayMode>(settings.displayMode);
  const [headerHidden, setHeaderHidden] = useState(settings.headerHidden);
  const [showNames, setShowNames] = useState(settings.showNames ?? false);
  const [fadeEffect, setFadeEffect] = useState(settings.fadeEffect ?? false);
  const [borderRadius, setBorderRadius] = useState(settings.borderRadius ?? 0);
  const [nameSize, setNameSize] = useState(settings.nameSize ?? 14);
  const [showNewBadge, setShowNewBadge] = useState(settings.showNewBadge ?? false);
  const [showHint, setShowHint] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Pagination state for "all" mode - load 50 at a time
  const PAGINATION_SIZE = 50;
  const [paginationLimit, setPaginationLimit] = useState(PAGINATION_SIZE);

  // Track which images have been displayed (for NEW badge)
  // An image shows NEW badge until it's been displayed once in the grid
  const [displayedImages, setDisplayedImages] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`gallery-displayed-${codeId}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    }
    return new Set();
  });

  // Shuffle mode state
  const [fadingOutSlot, setFadingOutSlot] = useState<number | null>(null);
  const [visibleSlots, setVisibleSlots] = useState<Map<number, UserGalleryImage>>(new Map());
  const [animatingSlot, setAnimatingSlot] = useState<number | null>(null);

  const previousImagesRef = useRef<Set<string>>(new Set(initialImages.map(img => img.id)));
  const shuffleIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Track images currently assigned in shuffle mode (slot -> imageId)
  const currentlyAssignedRef = useRef<Map<number, string>>(new Map());

  // Track last image shown in each slot (to prevent returning to same slot)
  const lastImageInSlotRef = useRef<Map<number, string>>(new Map());

  // Ref to hold current images for shuffle mode (so effect doesn't re-run on image changes)
  const imagesRef = useRef<UserGalleryImage[]>(initialImages);

  // Track loaded images to hide spinners - use ref to persist across re-renders
  // Initialize with all initial images as "loaded" since they come from server
  const loadedImagesRef = useRef<Set<string>>(new Set(initialImages.map(img => img.id)));
  const [loadedImages, setLoadedImages] = useState<Set<string>>(() => new Set(initialImages.map(img => img.id)));

  // Edit name state
  const [editingName, setEditingName] = useState<string>('');
  const [savingName, setSavingName] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Calculate grid rows based on screen aspect ratio (safe for SSR)
  const [gridRows, setGridRows] = useState(4);

  useEffect(() => {
    const calculateGridRows = () => {
      // Calculate how many rows fit the screen height with square cells
      const cellWidth = window.innerWidth / gridColumns;
      const rows = Math.floor(window.innerHeight / cellWidth);
      setGridRows(Math.max(rows, 2)); // Minimum 2 rows
    };
    calculateGridRows();
    window.addEventListener('resize', calculateGridRows);
    return () => window.removeEventListener('resize', calculateGridRows);
  }, [gridColumns]);

  // Total grid cells = columns * rows (fills screen exactly)
  const gridSize = gridColumns * gridRows;

  // Track if settings were loaded from Firebase (to avoid overwriting with initial values)
  const settingsLoadedRef = useRef(false);

  // Real-time updates from Firestore (images AND settings)
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'codes', codeId), (docSnap) => {
      if (!docSnap.exists()) return;

      const data = docSnap.data();

      // Update gallery images
      const gallery = (data.userGallery || []) as Array<{
        id: string;
        url: string;
        uploaderName: string;
        uploadedAt: { toDate?: () => Date } | Date;
      }>;

      const newImages: UserGalleryImage[] = gallery.map((img) => ({
        id: img.id,
        url: img.url,
        uploaderName: img.uploaderName,
        uploadedAt: img.uploadedAt && typeof (img.uploadedAt as { toDate?: () => Date }).toDate === 'function'
          ? (img.uploadedAt as { toDate: () => Date }).toDate()
          : new Date(img.uploadedAt as unknown as string),
      }));

      newImages.sort((a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );

      const newIds = new Set<string>();
      newImages.forEach((img) => {
        if (!previousImagesRef.current.has(img.id)) {
          newIds.add(img.id);
        }
      });

      if (newIds.size > 0) {
        setNewImageIds(newIds);
        setTimeout(() => {
          setNewImageIds(new Set());
        }, 600);
      }

      // Detect deleted images and remove them from shuffle grid
      const currentImageIds = new Set(newImages.map(img => img.id));
      const deletedIds: string[] = [];
      previousImagesRef.current.forEach(id => {
        if (!currentImageIds.has(id)) {
          deletedIds.push(id);
        }
      });

      // Remove deleted images from visible slots
      if (deletedIds.length > 0) {
        deletedIds.forEach(deletedId => {
          // Find and clear slots with deleted images
          currentlyAssignedRef.current.forEach((imgId, slotIndex) => {
            if (imgId === deletedId) {
              currentlyAssignedRef.current.delete(slotIndex);
            }
          });
        });
        // Update visible slots to remove deleted images
        setVisibleSlots(prev => {
          const updated = new Map(prev);
          deletedIds.forEach(deletedId => {
            updated.forEach((img, slotIndex) => {
              if (img.id === deletedId) {
                updated.delete(slotIndex);
              }
            });
          });
          return updated;
        });
      }

      previousImagesRef.current = currentImageIds;
      imagesRef.current = newImages;
      setImages(newImages);

      // Update gallery settings from Firebase (only if not currently saving)
      if (!savingSettings) {
        const fbSettings = data.gallerySettings as GallerySettings | undefined;
        if (fbSettings) {
          setDisplayMode(fbSettings.displayMode ?? DEFAULT_SETTINGS.displayMode);
          setDisplayLimit(fbSettings.displayLimit ?? DEFAULT_SETTINGS.displayLimit);
          setGridColumns(fbSettings.gridColumns ?? DEFAULT_SETTINGS.gridColumns);
          setHeaderHidden(fbSettings.headerHidden ?? DEFAULT_SETTINGS.headerHidden);
          setShowNames(fbSettings.showNames ?? DEFAULT_SETTINGS.showNames ?? false);
          setFadeEffect(fbSettings.fadeEffect ?? DEFAULT_SETTINGS.fadeEffect ?? false);
          setBorderRadius(fbSettings.borderRadius ?? DEFAULT_SETTINGS.borderRadius ?? 0);
          setNameSize(fbSettings.nameSize ?? DEFAULT_SETTINGS.nameSize ?? 14);
          setShowNewBadge(fbSettings.showNewBadge ?? DEFAULT_SETTINGS.showNewBadge ?? false);
          settingsLoadedRef.current = true;
        }
      }
    });

    return () => unsubscribe();
  }, [codeId, savingSettings]);

  // Scroll mode uses CSS animation - no JS scroll needed

  // Get image for a slot - checks adjacent slots to prevent same image next to each other
  const getImageForSlot = useCallback((
    slotIndex: number,
    excludeImageId?: string // Don't use this image (e.g., the one being replaced)
  ): UserGalleryImage | null => {
    // Use ref to get current images (avoids re-running effect on image changes)
    const currentImages = imagesRef.current;
    const displayImages = displayLimit > 0 ? currentImages.slice(0, displayLimit) : currentImages;
    if (displayImages.length === 0) return null;

    // Get IDs of images in adjacent slots
    const adjacentSlots = getAdjacentSlots(slotIndex, gridSize, gridColumns);
    const adjacentImageIds = new Set<string>();
    adjacentSlots.forEach(adj => {
      const imgId = currentlyAssignedRef.current.get(adj);
      if (imgId) adjacentImageIds.add(imgId);
    });

    // Find images that can be used (not in adjacent slots, not the excluded one)
    const validImages = displayImages.filter(img =>
      img.id !== excludeImageId && !adjacentImageIds.has(img.id)
    );

    if (validImages.length > 0) {
      return validImages[Math.floor(Math.random() * validImages.length)];
    }

    // Fallback: any image except the excluded one
    const fallbackImages = displayImages.filter(img => img.id !== excludeImageId);
    if (fallbackImages.length > 0) {
      return fallbackImages[Math.floor(Math.random() * fallbackImages.length)];
    }

    return displayImages[0];
  }, [displayLimit, gridSize, gridColumns]);

  // Track if shuffle mode was already initialized
  const shuffleInitializedRef = useRef(false);

  // Track if we have images (to trigger effect once when images arrive)
  const hasImages = images.length > 0;

  // Shuffle mode effect - fills grid then swaps images
  useEffect(() => {
    // Use ref to check images (not state, to avoid re-running on every image change)
    if (displayMode !== 'shuffle' || !hasImages) {
      if (shuffleIntervalRef.current) {
        clearInterval(shuffleIntervalRef.current);
        shuffleIntervalRef.current = null;
      }
      // Only reset if we're leaving shuffle mode
      if (displayMode !== 'shuffle') {
        setVisibleSlots(new Map());
        setFadingOutSlot(null);
        currentlyAssignedRef.current = new Map();
        shuffleInitializedRef.current = false;
      }
      return;
    }

    // Only reset state when ENTERING shuffle mode for the first time
    // Don't reset if images just updated while already in shuffle mode
    if (!shuffleInitializedRef.current) {
      currentlyAssignedRef.current = new Map();
      setVisibleSlots(new Map());
      shuffleInitializedRef.current = true;
    }

    // If interval is already running, don't start another one
    if (shuffleIntervalRef.current) {
      return;
    }

    let phase: 'filling' | 'swapping' = 'filling';

    const runInterval = () => {
      if (phase === 'filling') {
        // Find empty slots
        const emptySlots: number[] = [];
        for (let i = 0; i < gridSize; i++) {
          if (!currentlyAssignedRef.current.has(i)) {
            emptySlots.push(i);
          }
        }

        if (emptySlots.length === 0) {
          // Grid is full, switch to swapping phase
          phase = 'swapping';
          // Restart interval with longer delay for swapping
          if (shuffleIntervalRef.current) {
            clearInterval(shuffleIntervalRef.current);
          }
          shuffleIntervalRef.current = setInterval(runInterval, 2500);
          return;
        }

        // Pick random empty slot and fill it
        const slotToFill = emptySlots[Math.floor(Math.random() * emptySlots.length)];
        const image = getImageForSlot(slotToFill);

        if (image) {
          currentlyAssignedRef.current.set(slotToFill, image.id);
          setVisibleSlots(prev => {
            const updated = new Map(prev);
            updated.set(slotToFill, image);
            return updated;
          });
          setAnimatingSlot(slotToFill);
          setTimeout(() => setAnimatingSlot(null), 300);
        }
      } else {
        // Swapping phase - replace a random image
        const slotToReplace = Math.floor(Math.random() * gridSize);
        const currentImageId = currentlyAssignedRef.current.get(slotToReplace);
        const newImage = getImageForSlot(slotToReplace, currentImageId);

        if (newImage && newImage.id !== currentImageId) {
          // Start fade out
          setFadingOutSlot(slotToReplace);

          // After fade out, replace with new image
          setTimeout(() => {
            currentlyAssignedRef.current.set(slotToReplace, newImage.id);
            setVisibleSlots(prev => {
              const updated = new Map(prev);
              updated.set(slotToReplace, newImage);
              return updated;
            });
            setFadingOutSlot(null);
            setAnimatingSlot(slotToReplace);
            setTimeout(() => setAnimatingSlot(null), 300);
          }, 300);
        }
      }
    };

    // Start with fast filling interval
    shuffleIntervalRef.current = setInterval(runInterval, 300);

    return () => {
      if (shuffleIntervalRef.current) {
        clearInterval(shuffleIntervalRef.current);
        shuffleIntervalRef.current = null;
      }
    };
  }, [displayMode, hasImages, displayLimit, gridSize, gridColumns, getImageForSlot]);

  // Add new images to the grid immediately when they arrive (in shuffle mode)
  useEffect(() => {
    if (displayMode !== 'shuffle' || newImageIds.size === 0) return;

    // Get the new images that just arrived
    const newImagesArr = images.filter(img => newImageIds.has(img.id));
    if (newImagesArr.length === 0) return;

    // Add each new image to an empty slot or replace a random one
    newImagesArr.forEach((newImage, index) => {
      // Delay each image slightly for a nice staggered effect
      setTimeout(() => {
        // Find empty slots first
        const emptySlots: number[] = [];
        for (let i = 0; i < gridSize; i++) {
          if (!currentlyAssignedRef.current.has(i)) {
            emptySlots.push(i);
          }
        }

        let targetSlot: number;
        if (emptySlots.length > 0) {
          // Use an empty slot
          targetSlot = emptySlots[Math.floor(Math.random() * emptySlots.length)];
        } else {
          // Replace a random slot
          targetSlot = Math.floor(Math.random() * gridSize);
          // Start fade out on current image
          setFadingOutSlot(targetSlot);
        }

        // After a short delay (for fade out if replacing), add the new image
        setTimeout(() => {
          currentlyAssignedRef.current.set(targetSlot, newImage.id);
          setVisibleSlots(prev => {
            const updated = new Map(prev);
            updated.set(targetSlot, newImage);
            return updated;
          });
          setFadingOutSlot(null);
          setAnimatingSlot(targetSlot);
          setTimeout(() => setAnimatingSlot(null), 300);
        }, emptySlots.length > 0 ? 0 : 300);
      }, index * 500); // Stagger new images by 500ms
    });
  }, [newImageIds, displayMode, images, gridSize]);

  // Handle save edited name
  const handleSaveName = async () => {
    if (!lightboxImage || !isOwner || savingName) return;
    if (editingName === lightboxImage.uploaderName) return;

    setSavingName(true);
    try {
      const codeRef = doc(db, 'codes', codeId);
      const updatedGallery = images.map(img =>
        img.id === lightboxImage.id
          ? { ...img, uploaderName: editingName || 'אנונימי' }
          : img
      );

      await updateDoc(codeRef, {
        userGallery: updatedGallery.map(img => ({
          id: img.id,
          url: img.url,
          uploaderName: img.uploaderName,
          uploadedAt: img.uploadedAt instanceof Date
            ? Timestamp.fromDate(img.uploadedAt)
            : img.uploadedAt,
        })),
      });

      // Update local state
      setLightboxImage(prev => prev ? { ...prev, uploaderName: editingName || 'אנונימי' } : null);
    } catch (error) {
      console.error('Error saving name:', error);
    } finally {
      setSavingName(false);
    }
  };

  // Handle delete image
  const handleDeleteImage = async (image: UserGalleryImage) => {
    if (!isOwner || deleting) return;

    setDeleting(image.id);

    try {
      // First, get fresh data from Firestore to avoid stale state issues
      const codeRef = doc(db, 'codes', codeId);
      const codeSnap = await getDoc(codeRef);

      if (!codeSnap.exists()) {
        throw new Error('Code not found');
      }

      const currentData = codeSnap.data();
      const currentGallery = (currentData.userGallery || []) as Array<{
        id: string;
        url: string;
        uploaderName: string;
        uploadedAt: unknown;
      }>;

      // Filter out the image to delete
      const updatedGallery = currentGallery.filter(img => img.id !== image.id);

      // Delete from Vercel Blob
      await fetch('/api/gallery', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: image.url,
        }),
      });

      // Update Firestore with filtered gallery
      await updateDoc(codeRef, {
        userGallery: updatedGallery,
      });

      if (lightboxImage?.id === image.id) {
        setLightboxImage(null);
      }
    } catch (error) {
      console.error('Error deleting image:', error);
    } finally {
      setDeleting(null);
    }
  };

  // Save settings to Firebase (only for owner)
  const saveSettings = useCallback(async (newSettings: Partial<GallerySettings>) => {
    if (!isOwner) return;

    setSavingSettings(true);
    try {
      const codeRef = doc(db, 'codes', codeId);
      await updateDoc(codeRef, {
        gallerySettings: {
          displayMode,
          displayLimit,
          gridColumns,
          headerHidden,
          showNames,
          fadeEffect,
          borderRadius,
          nameSize,
          showNewBadge,
          ...newSettings,
        },
      });
    } catch (error) {
      console.error('Error saving gallery settings:', error);
    } finally {
      setSavingSettings(false);
    }
  }, [isOwner, codeId, displayMode, displayLimit, gridColumns, headerHidden, showNames, fadeEffect, borderRadius, nameSize, showNewBadge]);

  // Update settings with auto-save
  const updateDisplayMode = (mode: GalleryDisplayMode) => {
    setDisplayMode(mode);
    if (isOwner) saveSettings({ displayMode: mode });
  };

  const updateDisplayLimit = (limit: number) => {
    setDisplayLimit(limit);
    if (isOwner) saveSettings({ displayLimit: limit });
  };

  const updateGridColumns = (cols: number) => {
    setGridColumns(cols);
    if (isOwner) saveSettings({ gridColumns: cols });
  };

  const toggleHeader = useCallback(() => {
    setHeaderHidden(prev => {
      const newValue = !prev;
      if (isOwner) saveSettings({ headerHidden: newValue });
      return newValue;
    });
  }, [isOwner, saveSettings]);

  const toggleShowNames = useCallback(() => {
    setShowNames(prev => {
      const newValue = !prev;
      if (isOwner) saveSettings({ showNames: newValue });
      return newValue;
    });
  }, [isOwner, saveSettings]);

  const toggleFadeEffect = useCallback(() => {
    setFadeEffect(prev => {
      const newValue = !prev;
      if (isOwner) saveSettings({ fadeEffect: newValue });
      return newValue;
    });
  }, [isOwner, saveSettings]);

  const toggleShowNewBadge = useCallback(() => {
    setShowNewBadge(prev => {
      const newValue = !prev;
      if (isOwner) saveSettings({ showNewBadge: newValue });
      return newValue;
    });
  }, [isOwner, saveSettings]);

  const updateBorderRadius = useCallback((value: number) => {
    setBorderRadius(value);
    if (isOwner) saveSettings({ borderRadius: value });
  }, [isOwner, saveSettings]);

  const updateNameSize = useCallback((value: number) => {
    setNameSize(value);
    if (isOwner) saveSettings({ nameSize: value });
  }, [isOwner, saveSettings]);

  // Mark image as displayed - removes NEW badge after delay and saves to localStorage
  const markImageAsDisplayed = useCallback((imageId: string) => {
    // Delay marking as displayed so NEW badge stays visible for a few seconds
    setTimeout(() => {
      setDisplayedImages(prev => {
        if (prev.has(imageId)) return prev;
        const newSet = new Set(prev);
        newSet.add(imageId);
        localStorage.setItem(`gallery-displayed-${codeId}`, JSON.stringify([...newSet]));
        return newSet;
      });
    }, 5000); // Keep NEW badge for 5 seconds
  }, [codeId]);

  // Check if image is new (not displayed yet)
  const isNewImage = useCallback((imageId: string) => {
    return !displayedImages.has(imageId);
  }, [displayedImages]);

  // Keyboard shortcut for header toggle (Ctrl/Cmd)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key === 'Control') {
        // Wait for keyup to trigger
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Toggle on Ctrl/Cmd release (not while typing in inputs)
      if (e.key === 'Control' || e.key === 'Meta') {
        const activeElement = document.activeElement;
        if (activeElement?.tagName !== 'INPUT' && activeElement?.tagName !== 'TEXTAREA') {
          toggleHeader();
          setShowHint(false);
        }
      }
    };

    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [toggleHeader]);

  // Handle delete all images
  const handleDeleteAllImages = async () => {
    if (!isOwner || deletingAll || images.length === 0) return;

    setDeletingAll(true);
    setShowDeleteAllConfirm(false);

    try {
      // First, get fresh data from Firestore
      const codeRef = doc(db, 'codes', codeId);
      const codeSnap = await getDoc(codeRef);

      if (!codeSnap.exists()) {
        throw new Error('Code not found');
      }

      const currentData = codeSnap.data();
      const currentGallery = (currentData.userGallery || []) as Array<{
        id: string;
        url: string;
        uploaderName: string;
        uploadedAt: unknown;
      }>;

      // Delete all images from Vercel Blob
      for (const image of currentGallery) {
        await fetch('/api/gallery', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageUrl: image.url,
          }),
        });
      }

      // Clear the gallery in Firestore
      await updateDoc(codeRef, {
        userGallery: [],
      });

      setLightboxImage(null);
    } catch (error) {
      console.error('Error deleting all images:', error);
    } finally {
      setDeletingAll(false);
    }
  };

  // Get images to display based on mode
  const getDisplayImages = () => {
    if (displayLimit > 0) {
      // Specific limit selected (10, 20, 50, 100)
      return images.slice(0, displayLimit);
    }
    // "All" mode - use pagination to avoid loading thousands at once
    return images.slice(0, paginationLimit);
  };

  // Check if there are more images to load (for "all" mode)
  const hasMoreImages = displayLimit === 0 && images.length > paginationLimit;

  // Load more images
  const loadMoreImages = () => {
    setPaginationLimit(prev => prev + PAGINATION_SIZE);
  };

  // Reset pagination when display limit changes
  useEffect(() => {
    if (displayLimit > 0) {
      setPaginationLimit(PAGINATION_SIZE);
    }
  }, [displayLimit]);

  // Handle image load - persist to ref so it survives re-renders
  const handleImageLoad = (imageId: string) => {
    loadedImagesRef.current.add(imageId);
    setLoadedImages(prev => {
      if (prev.has(imageId)) return prev;
      const newSet = new Set(loadedImagesRef.current);
      return newSet;
    });
  };

  // Open lightbox with name editing initialized
  const openLightbox = (image: UserGalleryImage) => {
    setLightboxImage(image);
    setEditingName(image.uploaderName);
  };

  // Render grid based on mode
  const renderGrid = () => {
    const displayImages = getDisplayImages();

    if (displayMode === 'shuffle') {
      // Use gridSize to fill the entire screen
      const slots = Array.from({ length: gridSize }, (_, i) => i);

      return (
        <div
          className="grid gap-0 h-screen overflow-hidden"
          style={{
            gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
            gridTemplateRows: `repeat(${gridRows}, 1fr)`,
          }}
        >
          {slots.map((slotIndex) => {
            const image = visibleSlots.get(slotIndex);
            const isAnimating = animatingSlot === slotIndex;
            const isFadingOut = fadingOutSlot === slotIndex;

            return (
              <div
                key={slotIndex}
                className="relative overflow-hidden bg-gray-800"
                style={{
                  borderRadius: `${borderRadius}%`,
                  border: borderRadius > 0 ? '3px solid black' : 'none',
                }}
              >
                {/* Empty slot with spinner */}
                {!image && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
                  </div>
                )}
                {/* Image loading spinner */}
                {image && !loadedImages.has(image.id) && (
                  <div className="absolute inset-0 flex items-center justify-center z-0">
                    <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
                  </div>
                )}
                {image && (
                  <button
                    onClick={() => openLightbox(image)}
                    className={`w-full h-full focus:outline-none relative z-10 transition-opacity duration-300 ${
                      isFadingOut ? 'opacity-0' : isAnimating ? 'animate-quickFadeIn' : 'opacity-100'
                    }`}
                  >
                    <img
                      src={image.url}
                      alt={image.uploaderName}
                      className={`w-full h-full object-cover ${fadeEffect ? 'fade-effect-image' : ''}`}
                      style={{ borderRadius: `${borderRadius}%` }}
                      onLoad={() => {
                        handleImageLoad(image.id);
                        markImageAsDisplayed(image.id);
                      }}
                    />
                    {/* NEW badge */}
                    {showNewBadge && isNewImage(image.id) && (
                      <div className="absolute top-2 left-2 z-30">
                        <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-sm shadow-lg transform -rotate-12">
                          NEW
                        </span>
                      </div>
                    )}
                    {/* Name badge */}
                    {showNames && image.uploaderName && image.uploaderName !== 'אנונימי' && (
                      <div className="absolute bottom-2 right-2 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full">
                        <span className="text-white font-medium" style={{ fontSize: `${nameSize}px` }}>{image.uploaderName}</span>
                      </div>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    // Static mode
    if (displayMode === 'static') {
      return (
        <div>
          <div
            className="grid gap-1 p-1"
            style={{
              gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
            }}
          >
          {displayImages.map((image, index) => (
            <button
              key={image.id}
              onClick={() => openLightbox(image)}
              className={`relative aspect-square overflow-hidden bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                newImageIds.has(image.id) ? 'animate-bounceIn' : 'animate-staggerIn'
              }`}
              style={{
                animationDelay: newImageIds.has(image.id) ? '0ms' : `${index * 50}ms`,
                borderRadius: `${borderRadius}%`,
                border: borderRadius > 0 ? '3px solid black' : 'none',
              }}
            >
              {!loadedImages.has(image.id) && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
                </div>
              )}
              <img
                src={image.url}
                alt={image.uploaderName}
                className={`w-full h-full object-cover relative z-10 ${fadeEffect ? 'fade-effect-image' : ''}`}
                style={{ borderRadius: `${borderRadius}%` }}
                loading="lazy"
                onLoad={() => {
                  handleImageLoad(image.id);
                  markImageAsDisplayed(image.id);
                }}
              />
              {/* NEW badge */}
              {showNewBadge && isNewImage(image.id) && (
                <div className="absolute top-2 left-2 z-30">
                  <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-sm shadow-lg transform -rotate-12">
                    NEW
                  </span>
                </div>
              )}
              {/* Name badge - always visible when enabled */}
              {showNames && image.uploaderName && image.uploaderName !== 'אנונימי' && (
                <div className="absolute bottom-2 right-2 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full z-20">
                  <span className="text-white font-medium" style={{ fontSize: `${nameSize}px` }}>{image.uploaderName}</span>
                </div>
              )}
              {/* Hover overlay - only when showNames is off */}
              {!showNames && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 hover:opacity-100 transition-opacity z-20">
                  <p className="text-white truncate" style={{ fontSize: `${nameSize - 2}px` }}>{image.uploaderName}</p>
                </div>
              )}
            </button>
          ))}
          </div>
          {/* Load More Button for "all" mode */}
          {hasMoreImages && (
            <div className="flex justify-center py-6">
              <button
                onClick={loadMoreImages}
                className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors flex items-center gap-2"
              >
                <span>טען עוד תמונות</span>
                <span className="text-white/60">({images.length - paginationLimit} נותרו)</span>
              </button>
            </div>
          )}
        </div>
      );
    }

    // Scroll mode - CSS marquee-style infinite scroll
    // Calculate animation duration based on number of images
    const animationDuration = Math.max(displayImages.length * 3, 20); // minimum 20s

    return (
      <div className="h-screen overflow-hidden">
        <div
          className="scroll-container"
          style={{
            animation: `scrollUp ${animationDuration}s linear infinite`,
          }}
        >
          {/* First set */}
          <div
            className="grid gap-1 p-1"
            style={{
              gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
            }}
          >
            {displayImages.map((image) => (
              <button
                key={image.id}
                onClick={() => openLightbox(image)}
                className="relative aspect-square overflow-hidden bg-white/10 focus:outline-none"
                style={{
                  borderRadius: `${borderRadius}%`,
                  border: borderRadius > 0 ? '3px solid black' : 'none',
                }}
              >
                {!loadedImages.has(image.id) && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
                  </div>
                )}
                <img
                  src={image.url}
                  alt={image.uploaderName}
                  className={`w-full h-full object-cover relative z-10 ${fadeEffect ? 'fade-effect-image' : ''}`}
                  style={{ borderRadius: `${borderRadius}%` }}
                  loading="eager"
                  onLoad={() => {
                    handleImageLoad(image.id);
                    markImageAsDisplayed(image.id);
                  }}
                />
                {/* NEW badge */}
                {showNewBadge && isNewImage(image.id) && (
                  <div className="absolute top-2 left-2 z-30">
                    <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-sm shadow-lg transform -rotate-12">
                      NEW
                    </span>
                  </div>
                )}
                {showNames && image.uploaderName && image.uploaderName !== 'אנונימי' && (
                  <div className="absolute bottom-2 right-2 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full z-20">
                    <span className="text-white font-medium" style={{ fontSize: `${nameSize}px` }}>{image.uploaderName}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
          {/* Second set for seamless loop */}
          <div
            className="grid gap-1 p-1"
            style={{
              gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
            }}
          >
            {displayImages.map((image) => (
              <button
                key={`${image.id}-dup`}
                onClick={() => openLightbox(image)}
                className="relative aspect-square overflow-hidden bg-white/10 focus:outline-none"
                style={{
                  borderRadius: `${borderRadius}%`,
                  border: borderRadius > 0 ? '3px solid black' : 'none',
                }}
              >
                {!loadedImages.has(image.id) && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
                  </div>
                )}
                <img
                  src={image.url}
                  alt={image.uploaderName}
                  className={`w-full h-full object-cover relative z-10 ${fadeEffect ? 'fade-effect-image' : ''}`}
                  style={{ borderRadius: `${borderRadius}%` }}
                  loading="eager"
                />
                {/* NEW badge */}
                {showNewBadge && isNewImage(image.id) && (
                  <div className="absolute top-2 left-2 z-30">
                    <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-sm shadow-lg transform -rotate-12">
                      NEW
                    </span>
                  </div>
                )}
                {showNames && image.uploaderName && image.uploaderName !== 'אנונימי' && (
                  <div className="absolute bottom-2 right-2 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full z-20">
                    <span className="text-white font-medium" style={{ fontSize: `${nameSize}px` }}>{image.uploaderName}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-gray-900 to-black text-white ${
        displayMode === 'scroll' ? 'h-screen overflow-hidden' : 'overflow-y-auto'
      }`}
    >
      {/* Header - can be hidden */}
      {!headerHidden && (
        <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-sm border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <h1 className="text-lg font-semibold">{title}</h1>

            <div className="flex items-center gap-2">
              {savingSettings && (
                <Loader2 className="w-4 h-4 animate-spin text-white/40" />
              )}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-white/20' : 'bg-white/10 hover:bg-white/20'}`}
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Settings Panel with smooth animation */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-out ${
              showSettings ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
              {/* Row 1: All controls in one line */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                {/* Delete button */}
                {isOwner && images.length > 0 ? (
                  <Tooltip text="מחק את כל התמונות">
                    <button
                      onClick={() => setShowDeleteAllConfirm(true)}
                      disabled={deletingAll}
                      className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors disabled:opacity-50"
                    >
                      {deletingAll ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Trash2 className="w-5 h-5" />
                      )}
                    </button>
                  </Tooltip>
                ) : (
                  <div className="w-9" />
                )}

                {/* Grid size slider */}
                <Tooltip text="גודל הרשת">
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="2"
                      max="6"
                      value={gridColumns}
                      onChange={(e) => updateGridColumns(Number(e.target.value))}
                      className="w-16 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <span className="text-sm text-white/60 w-3">{gridColumns}</span>
                  </div>
                </Tooltip>

                <div className="w-px h-5 bg-white/20" />

                {/* Display mode buttons - icons only with tooltips */}
                <div className="flex gap-1">
                  <Tooltip text="תצוגה רגילה">
                    <button
                      onClick={() => updateDisplayMode('static')}
                      className={`p-2 rounded-lg transition-colors ${
                        displayMode === 'static'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}
                    >
                      <ImageIcon className="w-5 h-5" />
                    </button>
                  </Tooltip>
                  <Tooltip text="גלילה אוטומטית">
                    <button
                      onClick={() => updateDisplayMode('scroll')}
                      className={`p-2 rounded-lg transition-colors ${
                        displayMode === 'scroll'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}
                    >
                      <Play className="w-5 h-5" />
                    </button>
                  </Tooltip>
                  <Tooltip text="מצב רנדומלי">
                    <button
                      onClick={() => updateDisplayMode('shuffle')}
                      className={`p-2 rounded-lg transition-colors ${
                        displayMode === 'shuffle'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}
                    >
                      <Shuffle className="w-5 h-5" />
                    </button>
                  </Tooltip>
                </div>

                <div className="w-px h-5 bg-white/20" />

                {/* Toggles */}
                <div className="flex items-center gap-3">
                  {/* Show names toggle */}
                  <Tooltip text="הצג שמות על התמונות">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={toggleShowNames}
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          showNames ? 'bg-blue-500' : 'bg-white/20'
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 ${
                            showNames ? 'right-0.5' : 'left-0.5'
                          }`}
                        />
                      </button>
                      <span className="text-sm text-white/60">שמות</span>
                    </div>
                  </Tooltip>

                  {/* Fade effect toggle */}
                  <Tooltip text="אפקט תנועה קלה">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={toggleFadeEffect}
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          fadeEffect ? 'bg-blue-500' : 'bg-white/20'
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 ${
                            fadeEffect ? 'right-0.5' : 'left-0.5'
                          }`}
                        />
                      </button>
                      <span className="text-sm text-white/60">תנועה</span>
                    </div>
                  </Tooltip>

                  {/* NEW badge toggle */}
                  <Tooltip text="הצג תג NEW על תמונות חדשות">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={toggleShowNewBadge}
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          showNewBadge ? 'bg-blue-500' : 'bg-white/20'
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 ${
                            showNewBadge ? 'right-0.5' : 'left-0.5'
                          }`}
                        />
                      </button>
                      <span className="text-sm text-white/60">NEW</span>
                    </div>
                  </Tooltip>
                </div>

                <div className="w-px h-5 bg-white/20" />

                {/* Display limit */}
                <Tooltip text="כמות תמונות להצגה">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {[0, 10, 20, 50, 100].map((limit) => (
                        <button
                          key={limit}
                          onClick={() => updateDisplayLimit(limit)}
                          className={`px-2 py-1 text-sm rounded-lg transition-colors ${
                            displayLimit === limit
                              ? 'bg-blue-500 text-white'
                              : 'bg-white/10 text-white/60 hover:bg-white/20'
                          }`}
                        >
                          {limit === 0 ? 'הכל' : limit}
                        </button>
                      ))}
                    </div>
                    <span className="text-sm text-white/60">אחרונות</span>
                  </div>
                </Tooltip>
              </div>

              {/* Row 2: Border radius + Name size sliders */}
              <div className="flex items-center justify-center flex-wrap gap-4">
                {/* Border radius slider */}
                <Tooltip text="עיגול פינות התמונות" position="above">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white/60">עיגול</span>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={borderRadius}
                      onChange={(e) => updateBorderRadius(Number(e.target.value))}
                      className="w-20 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <span className="text-sm text-white/60 w-6">{borderRadius}%</span>
                  </div>
                </Tooltip>

                <div className="w-px h-5 bg-white/20" />

                {/* Name size slider */}
                <Tooltip text="גודל הטקסט של השמות" position="above">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white/60">טקסט</span>
                    <input
                      type="range"
                      min="10"
                      max="24"
                      value={nameSize}
                      onChange={(e) => updateNameSize(Number(e.target.value))}
                      className="w-20 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <span className="text-sm text-white/60 w-6">{nameSize}px</span>
                  </div>
                </Tooltip>

                <div className="w-px h-5 bg-white/20" />

                {/* Image count */}
                <span className="text-sm text-white/50">
                  {images.length} תמונות
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      {images.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-4">
            <ImageIcon className="w-10 h-10 text-white/40" />
          </div>
          <h2 className="text-xl font-semibold mb-2">הגלריה ריקה</h2>
          <p className="text-white/60">
            עדיין אין תמונות בגלריה הזו
          </p>
          <a
            href={`/v/${shortId}`}
            className="mt-4 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 transition-colors"
          >
            חזרה לדף
          </a>
        </div>
      ) : (
        renderGrid()
      )}

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => {
            handleSaveName();
            setLightboxImage(null);
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSaveName();
              setLightboxImage(null);
            }}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>

          {isOwner && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteImage(lightboxImage);
              }}
              disabled={deleting === lightboxImage.id}
              className="absolute top-4 left-4 p-2 rounded-full bg-red-500/80 text-white hover:bg-red-500 transition-colors z-10 disabled:opacity-50"
            >
              {deleting === lightboxImage.id ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Trash2 className="w-6 h-6" />
              )}
            </button>
          )}

          <img
            src={lightboxImage.url}
            alt={lightboxImage.uploaderName}
            className="max-w-[90vw] max-h-[80vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Name display/edit at bottom */}
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {isOwner ? (
              <input
                ref={editInputRef}
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveName();
                    editInputRef.current?.blur();
                  }
                }}
                placeholder="הזן שם..."
                className="bg-transparent text-white text-sm text-center outline-none min-w-[100px] placeholder:text-white/50"
                dir="rtl"
              />
            ) : (
              <p className="text-white text-sm">{lightboxImage.uploaderName}</p>
            )}
            {savingName && <Loader2 className="w-4 h-4 animate-spin text-white inline-block mr-2" />}
          </div>
        </div>
      )}

      {/* Delete All Confirmation Modal */}
      {showDeleteAllConfirm && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowDeleteAllConfirm(false)}
        >
          <div
            className="bg-gray-900 border border-white/10 rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <Trash2 className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">מחק את כל הגלריה?</h3>
              <p className="text-sm text-white/60 mt-2">
                פעולה זו תמחק את כל {images.length} התמונות בגלריה.
                <br />
                לא ניתן לבטל פעולה זו.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteAllConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={handleDeleteAllImages}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                מחק הכל
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard shortcut hint */}
      {showHint && isOwner && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-black/90 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg">
          <span className="text-sm text-white/80">
            לחץ על <kbd className="px-2 py-0.5 bg-white/20 rounded text-white font-mono text-xs mx-1">Ctrl</kbd> להסתרת/הצגת התפריט
          </span>
          <button
            onClick={() => setShowHint(false)}
            className="p-1 rounded hover:bg-white/20 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Animation styles */}
      <style jsx global>{`
        @keyframes bounceIn {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          50% {
            transform: scale(1.05);
          }
          70% {
            transform: scale(0.9);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-bounceIn {
          animation: bounceIn 0.5s ease-out;
        }

        @keyframes staggerIn {
          0% {
            opacity: 0;
            transform: scale(0.8) translateY(10px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-staggerIn {
          opacity: 0;
          animation: staggerIn 0.4s ease-out forwards;
        }

        @keyframes fadeIn {
          0% {
            opacity: 0;
            transform: scale(0.9);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out;
        }

        @keyframes quickFadeIn {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }
        .animate-quickFadeIn {
          animation: quickFadeIn 0.3s ease-out;
        }

        @keyframes scrollUp {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(-50%);
          }
        }
        .scroll-container {
          will-change: transform;
        }

        /* Subtle video-like Ken Burns motion effect */
        @keyframes subtleMotion {
          0% {
            transform: scale(1) translate(0, 0);
          }
          100% {
            transform: scale(1.08) translate(-1%, -1%);
          }
        }
        .fade-effect-image {
          animation: subtleMotion 12s ease-in-out infinite alternate;
          will-change: transform;
        }
      `}</style>
    </div>
  );
}
