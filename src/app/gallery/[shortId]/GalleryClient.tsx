'use client';

import { useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import { UserGalleryImage, GallerySettings, GalleryDisplayMode } from '@/types';
import { X, Trash2, Settings, Loader2, ImageIcon, Play, Shuffle } from 'lucide-react';
import { onSnapshot, doc, updateDoc, Timestamp, getDoc, increment } from 'firebase/firestore';
import { getBrowserLocale, galleryTranslations } from '@/lib/publicTranslations';

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
import { getVisitorId } from '@/lib/xp';
import { getFolder } from '@/lib/db';
import LiveLeaderboard from '@/components/gamification/LiveLeaderboard';

interface GalleryClientProps {
  codeId: string;
  shortId: string;
  ownerId: string;
  title: string;
  initialImages: UserGalleryImage[];
  initialSettings?: GallerySettings;
  companyLogos?: string[]; // Company logos to display mixed with selfies
  folderId?: string;
  isSelfiebeam?: boolean; // True when the code is a Selfie Beam experience
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
  displaySpeed: 4.5,
  featureNewPhotos: false,
};

// Selfie Beam opens straight into the animated big-screen beam: shuffle mode,
// a wide 5-column grid, subtle Ken Burns motion, and a rolling window of the most
// recent ~300 photos. Riddle galleries keep the plain static default above.
const SELFIEBEAM_DEFAULTS: Partial<GallerySettings> = {
  displayMode: 'shuffle',
  displayLimit: 300,
  gridColumns: 5,
  fadeEffect: true,
  displaySpeed: 4.5,
};

// A diagonal red "NEW" ribbon across the top-right corner of a cell (first-appearance photos).
function NewRibbon() {
  return (
    <div className="absolute top-0 right-0 w-[92px] h-[92px] overflow-hidden z-30 pointer-events-none">
      <div className="absolute top-[20px] right-[-28px] w-[128px] rotate-45 bg-red-500 text-white text-[14px] font-extrabold tracking-widest text-center py-1 shadow-md">
        NEW
      </div>
    </div>
  );
}

export default function GalleryClient({
  codeId,
  shortId,
  ownerId,
  title,
  initialImages,
  initialSettings,
  companyLogos = [],
  folderId,
  isSelfiebeam = false,
}: GalleryClientProps) {
  // Get browser locale for translations
  const [locale, setLocale] = useState<'he' | 'en'>('he');
  const t = galleryTranslations[locale];

  useEffect(() => {
    setLocale(getBrowserLocale());
  }, []);

  const { user } = useAuth();
  const isOwner = user?.id === ownerId;

  // Effective defaults (Selfie Beam opens into the animated beam). A saved
  // gallerySettings always wins, so owners can still override per code.
  const experienceDefaults: GallerySettings = {
    ...DEFAULT_SETTINGS,
    ...(isSelfiebeam ? SELFIEBEAM_DEFAULTS : {}),
  };

  // Merge initial settings with defaults
  const settings = { ...experienceDefaults, ...initialSettings };

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
  const [displaySpeed, setDisplaySpeed] = useState(settings.displaySpeed ?? 4.5);
  const [featureNewPhotos, setFeatureNewPhotos] = useState(settings.featureNewPhotos ?? false);
  const [minPinnedOnScreen, setMinPinnedOnScreen] = useState(settings.minPinnedOnScreen ?? 1);
  // Ctrl-hint: show once until the owner dismisses it, then never again (persisted).
  const [showHint, setShowHint] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('gallery_hint_dismissed')) {
      setShowHint(true);
    }
  }, []);
  const dismissHint = useCallback(() => {
    setShowHint(false);
    try { localStorage.setItem('gallery_hint_dismissed', '1'); } catch {}
  }, []);

  // Connection status — the beam keeps cycling cached photos even when offline; this just
  // tells the operator that NEW photos won't arrive until the connection is back.
  const [navOnline, setNavOnline] = useState(true);
  const [fbFromCache, setFbFromCache] = useState(false); // Firestore serving cache (no server sync)
  useEffect(() => {
    const update = () => setNavOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  const connectionLost = !navOnline || fbFromCache;
  // Debounce: only show the dot if the issue persists (>1.5s), so the normal cache-first
  // Firestore snapshot on page load doesn't flash it.
  const [showConnectionDot, setShowConnectionDot] = useState(false);
  useEffect(() => {
    if (!connectionLost) {
      setShowConnectionDot(false);
      return;
    }
    const id = setTimeout(() => setShowConnectionDot(true), 1500);
    return () => clearTimeout(id);
  }, [connectionLost]);
  const [savingSettings, setSavingSettings] = useState(false);

  // Gamification state - simplified to avoid render loops
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isRouteEnabled, setIsRouteEnabled] = useState(false);
  const [routeTitle, setRouteTitle] = useState<string>('');
  const [currentVisitorId, setCurrentVisitorId] = useState<string | null>(null);

  // Check if folder is a route - run once on mount only
  useEffect(() => {
    let isMounted = true;

    const checkRoute = async () => {
      if (!folderId) return;

      try {
        const folder = await getFolder(folderId);
        if (isMounted && folder?.routeConfig?.isRoute) {
          setIsRouteEnabled(true);
          setRouteTitle(folder.routeConfig?.routeTitle || folder.name);

          // Get visitor ID for leaderboard highlighting
          const vid = getVisitorId();
          if (vid) {
            setCurrentVisitorId(vid);
          }
        }
      } catch (err) {
        console.error('Error checking route:', err);
      }
    };

    checkRoute();

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Shuffle rotation state (uniform cadence + fair cycling through the whole pool)
  const poolRef = useRef<UserGalleryImage[]>([]); // ordered pool to cycle (last N + logos)
  const rotationIndexRef = useRef(0); // pointer into the pool for the next image
  const newQueueRef = useRef<string[]>([]); // freshly-uploaded image ids to show first
  const lastSlotRef = useRef<number>(-1); // last slot changed (avoid immediate repeat)
  const preloadedRef = useRef<Set<string>>(new Set()); // urls already warmed into cache
  const pinnedIdsRef = useRef<Set<string>>(new Set()); // fast lookup of pinned image ids
  const pinRotationRef = useRef(0); // fair rotation pointer through pinned images

  // "Feature new photos" effect: a new photo pops up big, then falls into the grid.
  const featureQueueRef = useRef<string[]>([]);
  const featuringRef = useRef(false);
  const featuringIdRef = useRef<string | null>(null); // id currently mid-reveal (keep it out of the grid)
  const [featured, setFeatured] = useState<{ image: UserGalleryImage; phase: 'enter' | 'hold' | 'fly' } | null>(null);

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

  // Convert company logos to UserGalleryImage format for display (memoized to prevent re-renders)
  const logoImages = useMemo<UserGalleryImage[]>(() =>
    companyLogos.map((url, index) => ({
      id: `logo_${index}`,
      url,
      uploaderName: '', // No name for logos
      uploadedAt: new Date(0), // Oldest date so they don't affect sorting
    })), [companyLogos]);

  // Check if an image is a company logo (not deletable)
  const isCompanyLogo = (imageId: string) => imageId.startsWith('logo_');

  // Track if settings were loaded from Firebase (to avoid overwriting with initial values)
  const settingsLoadedRef = useRef(false);

  // Real-time updates from Firestore (images AND settings)
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'codes', codeId), { includeMetadataChanges: true }, (docSnap) => {
      // metadata.fromCache === true means we're not synced with the server (offline / disconnected)
      setFbFromCache(docSnap.metadata.fromCache);
      if (!docSnap.exists()) return;

      const data = docSnap.data();

      // Update gallery images
      const gallery = (data.userGallery || []) as Array<{
        id: string;
        url: string;
        uploaderName: string;
        uploadedAt: { toDate?: () => Date } | Date;
        approved?: boolean;
        pinned?: boolean;
      }>;

      const newImages: UserGalleryImage[] = gallery
        // Hide pending (un-approved) photos from the beam. undefined === approved,
        // so existing photos and Riddle galleries are unaffected.
        .filter((img) => img.approved !== false)
        .map((img) => ({
          id: img.id,
          url: img.url,
          uploaderName: img.uploaderName,
          pinned: img.pinned,
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
          setDisplaySpeed(fbSettings.displaySpeed ?? experienceDefaults.displaySpeed ?? 4.5);
          setFeatureNewPhotos(fbSettings.featureNewPhotos ?? false);
          setMinPinnedOnScreen(fbSettings.minPinnedOnScreen ?? 1);
          settingsLoadedRef.current = true;
        }
      }
    });

    return () => unsubscribe();
  }, [codeId, savingSettings]);

  // Scroll mode uses CSS animation - no JS scroll needed

  // Track if shuffle mode was already initialized
  const shuffleInitializedRef = useRef(false);

  // Track if we have images (to trigger the shuffle effect once when images arrive)
  const hasImages = images.length > 0;

  // Pick the next image to show: freshly-uploaded first, otherwise the next in a fair
  // rotation through the WHOLE pool — preferring images not already on screen, but
  // falling back to a repeat when the pool is smaller than the grid (keeps it full).
  const pickNextImage = useCallback((): UserGalleryImage | null => {
    const pool = poolRef.current;
    if (pool.length === 0) return null;
    const visibleIds = new Set(currentlyAssignedRef.current.values());
    // Photos waiting for / mid- big reveal must NOT appear in the grid yet — their first
    // appearance is the reveal itself, so the NEW badge stays in sync.
    const held = new Set(featureQueueRef.current);
    if (featuringIdRef.current) held.add(featuringIdRef.current);

    // Priority: fresh uploads not yet on screen
    while (newQueueRef.current.length > 0) {
      const id = newQueueRef.current[0];
      const img = pool.find((p) => p.id === id);
      if (!img || visibleIds.has(id) || held.has(id)) {
        newQueueRef.current.shift();
        continue;
      }
      newQueueRef.current.shift();
      return img;
    }

    // Rotation: walk the pool from the current pointer; return the first not-visible image.
    let firstCandidate: UserGalleryImage | null = null;
    for (let n = 0; n < pool.length; n++) {
      const idx = rotationIndexRef.current % pool.length;
      rotationIndexRef.current += 1;
      const img = pool[idx];
      if (held.has(img.id)) continue; // skip photos reserved for their big reveal
      if (firstCandidate === null) firstCandidate = img;
      if (!visibleIds.has(img.id)) return img;
    }
    // Whole pool already on screen (pool <= grid): allow a repeat so the grid stays full.
    return firstCandidate;
  }, []);

  // Fill every empty slot instantly — a removed/un-approved image is replaced at once, so a
  // cell is NEVER left as a black hole. Repeats are allowed when the pool is smaller than the grid.
  const fillGrid = useCallback(() => {
    const additions: Array<[number, UserGalleryImage]> = [];
    for (let s = 0; s < gridSize; s++) {
      if (currentlyAssignedRef.current.has(s)) continue;
      const img = pickNextImage();
      if (!img) break;
      currentlyAssignedRef.current.set(s, img.id);
      additions.push([s, img]);
    }
    if (additions.length > 0) {
      setVisibleSlots((prev) => {
        const next = new Map(prev);
        additions.forEach(([s, img]) => next.set(s, img));
        return next;
      });
    }
  }, [gridSize, pickNextImage]);

  // Keep a fast lookup of which image ids are pinned (used by the beam invariant below).
  useEffect(() => {
    pinnedIdsRef.current = new Set(images.filter((i) => i.pinned).map((i) => i.id));
  }, [images]);

  // Pinned-presence invariant: ensure at least `minPinnedOnScreen` pinned photos occupy grid
  // cells at all times. Pinned photos are still swapped out by the normal rotation, so they
  // "move" around the grid — this just tops the count back up (placing into NON-pinned slots)
  // so a pin is always visible. No-op when there are no pinned photos (Riddle/legacy safe).
  const enforcePins = useCallback(() => {
    const target = Math.max(0, minPinnedOnScreen || 0);
    if (target <= 0) return;
    const pins = poolRef.current.filter((p) => p.pinned);
    if (pins.length === 0) return;

    const countOnScreen = () => {
      let c = 0;
      currentlyAssignedRef.current.forEach((id) => { if (pinnedIdsRef.current.has(id)) c += 1; });
      return c;
    };

    const additions: Array<[number, UserGalleryImage]> = [];
    let guard = 0;
    while (countOnScreen() + additions.length < target && guard < pins.length + target) {
      guard += 1;
      const visibleIds = new Set(currentlyAssignedRef.current.values());
      additions.forEach(([, img]) => visibleIds.add(img.id));
      // Next pinned image not already on screen (fair rotation through all pins).
      let chosen: UserGalleryImage | null = null;
      for (let n = 0; n < pins.length; n++) {
        const idx = pinRotationRef.current % pins.length;
        pinRotationRef.current += 1;
        const cand = pins[idx];
        if (!visibleIds.has(cand.id)) { chosen = cand; break; }
      }
      if (!chosen) break;
      // Place into a non-pinned slot so we never evict another pin.
      let slot = Math.floor(Math.random() * gridSize);
      let tries = 0;
      while (pinnedIdsRef.current.has(currentlyAssignedRef.current.get(slot) || '') && tries < 25) {
        slot = Math.floor(Math.random() * gridSize);
        tries += 1;
      }
      currentlyAssignedRef.current.set(slot, chosen.id);
      additions.push([slot, chosen]);
    }
    if (additions.length > 0) {
      setVisibleSlots((prev) => {
        const next = new Map(prev);
        additions.forEach(([s, img]) => next.set(s, img));
        return next;
      });
    }
  }, [gridSize, minPinnedOnScreen]);

  // Keep the rotation pool (last N + logos) in sync, and IMMEDIATELY top up any slots emptied
  // by deletions/moderation — so holes never linger until the next swap tick.
  useEffect(() => {
    const base = displayLimit > 0 ? images.slice(0, displayLimit) : images;
    // Pinned photos stay in the pool even after they age out of the rolling window (like logos).
    const pinnedExtra = displayLimit > 0 ? images.filter((i) => i.pinned && !base.includes(i)) : [];
    poolRef.current = [...base, ...pinnedExtra, ...logoImages];
    if (displayMode === 'shuffle' && shuffleInitializedRef.current) { fillGrid(); enforcePins(); }
  }, [images, displayLimit, logoImages, displayMode, fillGrid, enforcePins]);

  // Warm the browser cache for the pool so each swap is instant (no spinner flash),
  // even with large galleries. The Image objects GC after load — only the HTTP cache is warmed.
  useEffect(() => {
    if (displayMode !== 'shuffle') return;
    const base = displayLimit > 0 ? images.slice(0, displayLimit) : images;
    const pinnedExtra = displayLimit > 0 ? images.filter((i) => i.pinned && !base.includes(i)) : [];
    for (const img of [...base, ...pinnedExtra, ...logoImages]) {
      if (preloadedRef.current.has(img.url)) continue;
      preloadedRef.current.add(img.url);
      const im = new window.Image();
      im.src = img.url;
    }
  }, [images, displayLimit, logoImages, displayMode]);

  // "Feature new photos": pop the photo up big, hold, then drop it into the grid.
  const processFeatureQueue = useCallback(() => {
    if (featuringRef.current) return;
    let img: UserGalleryImage | undefined;
    while (featureQueueRef.current.length > 0) {
      const id = featureQueueRef.current.shift();
      const found = poolRef.current.find((p) => p.id === id) || imagesRef.current.find((p) => p.id === id);
      if (found) { img = found; break; }
    }
    if (!img) return;
    const featuredImg = img;
    featuringRef.current = true;
    featuringIdRef.current = featuredImg.id;

    setFeatured({ image: featuredImg, phase: 'enter' });
    window.setTimeout(() => setFeatured((f) => (f ? { ...f, phase: 'hold' } : f)), 60);
    window.setTimeout(() => setFeatured((f) => (f ? { ...f, phase: 'fly' } : f)), 2300);
    window.setTimeout(() => {
      // Land the photo into a fresh slot so it "joins" the grid.
      const slot = Math.floor(Math.random() * Math.max(1, gridSize));
      currentlyAssignedRef.current.set(slot, featuredImg.id);
      setVisibleSlots((prev) => {
        const next = new Map(prev);
        next.set(slot, featuredImg);
        return next;
      });
      setAnimatingSlot(slot);
      window.setTimeout(() => setAnimatingSlot(null), 350);
      featuringRef.current = false;
      featuringIdRef.current = null;
      setFeatured(null); // a trigger effect picks up the next queued photo
    }, 3050);
  }, [gridSize]);

  // Route freshly-uploaded photos: feature them (if enabled) or queue them for the normal
  // uniform-cadence rotation. Either way they appear soon, never in a flood.
  useEffect(() => {
    if (displayMode !== 'shuffle' || newImageIds.size === 0) return;
    if (featureNewPhotos) {
      newImageIds.forEach((id) => {
        if (!featureQueueRef.current.includes(id)) featureQueueRef.current.push(id);
      });
      processFeatureQueue();
    } else {
      newImageIds.forEach((id) => {
        if (!newQueueRef.current.includes(id)) newQueueRef.current.push(id);
      });
    }
  }, [newImageIds, displayMode, featureNewPhotos, processFeatureQueue]);

  // When a feature finishes (featured → null), start the next queued one.
  useEffect(() => {
    if (displayMode === 'shuffle' && featureNewPhotos && !featured && featureQueueRef.current.length > 0) {
      processFeatureQueue();
    }
  }, [featured, displayMode, featureNewPhotos, processFeatureQueue]);

  // Shuffle effect — fill the grid, then swap exactly ONE cell at a uniform cadence.
  useEffect(() => {
    if (displayMode !== 'shuffle' || !hasImages) {
      if (shuffleIntervalRef.current) {
        clearInterval(shuffleIntervalRef.current);
        shuffleIntervalRef.current = null;
      }
      if (displayMode !== 'shuffle') {
        setVisibleSlots(new Map());
        setFadingOutSlot(null);
        currentlyAssignedRef.current = new Map();
        shuffleInitializedRef.current = false;
      }
      return;
    }

    // Reset ONLY when entering shuffle (not on speed/size changes or image updates)
    if (!shuffleInitializedRef.current) {
      currentlyAssignedRef.current = new Map();
      rotationIndexRef.current = 0;
      newQueueRef.current = [];
      lastSlotRef.current = -1;
      setVisibleSlots(new Map());
      shuffleInitializedRef.current = true;
    }

    // Swap exactly one cell to the next image (the uniform "every X seconds" tick).
    const swapOne = () => {
      if (featuringRef.current) return; // hold swaps steady while a photo is being featured
      const img = pickNextImage();
      if (!img) return;

      // Random slot, avoiding the one we just changed and any slot already showing this image.
      let slot = Math.floor(Math.random() * gridSize);
      let tries = 0;
      while (
        (slot === lastSlotRef.current || currentlyAssignedRef.current.get(slot) === img.id) &&
        tries < 12
      ) {
        slot = Math.floor(Math.random() * gridSize);
        tries += 1;
      }
      lastSlotRef.current = slot;

      setFadingOutSlot(slot);
      window.setTimeout(() => {
        currentlyAssignedRef.current.set(slot, img.id);
        setVisibleSlots((prev) => {
          const next = new Map(prev);
          next.set(slot, img);
          return next;
        });
        setFadingOutSlot(null);
        setAnimatingSlot(slot);
        window.setTimeout(() => setAnimatingSlot(null), 350);
        enforcePins(); // if this swap evicted the last pin, re-place one in a different slot
      }, 350);
    };

    fillGrid();
    enforcePins();

    const ms = Math.max(1000, Math.round((displaySpeed || 4.5) * 1000));
    shuffleIntervalRef.current = setInterval(() => {
      fillGrid(); // safety top-up
      swapOne();
    }, ms);

    return () => {
      if (shuffleIntervalRef.current) {
        clearInterval(shuffleIntervalRef.current);
        shuffleIntervalRef.current = null;
      }
    };
  }, [displayMode, hasImages, gridSize, displaySpeed, pickNextImage, fillGrid, enforcePins]);

  // Handle save edited name
  const handleSaveName = async () => {
    if (!lightboxImage || !isOwner || savingName) return;
    if (editingName === lightboxImage.uploaderName) return;

    setSavingName(true);
    try {
      const codeRef = doc(db, 'codes', codeId);
      const updatedGallery = images.map(img =>
        img.id === lightboxImage.id
          ? { ...img, uploaderName: editingName || t.anonymous }
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
      setLightboxImage(prev => prev ? { ...prev, uploaderName: editingName || t.anonymous } : null);
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
          displaySpeed,
          featureNewPhotos,
          ...newSettings,
        },
      });
    } catch (error) {
      console.error('Error saving gallery settings:', error);
    } finally {
      setSavingSettings(false);
    }
  }, [isOwner, codeId, displayMode, displayLimit, gridColumns, headerHidden, showNames, fadeEffect, borderRadius, nameSize, showNewBadge, displaySpeed, featureNewPhotos]);

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
          dismissHint();
        }
      }
    };

    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [toggleHeader, dismissHint]);

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
        size?: number;
      }>;

      // Delete all images from storage (R2). Pass codeId so the API authorizes the owner.
      for (const image of currentGallery) {
        await fetch('/api/gallery', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageUrl: image.url,
            codeId,
          }),
        });
      }

      // Clear the gallery in Firestore
      await updateDoc(codeRef, {
        userGallery: [],
      });

      // Reclaim the owner's storage quota for everything just removed (older rows without
      // `size` contribute 0; guard keeps storageUsed from ever going negative).
      const freed = currentGallery.reduce((sum, img) => sum + (img.size || 0), 0);
      if (freed > 0 && ownerId) {
        try {
          await updateDoc(doc(db, 'users', ownerId), { storageUsed: increment(-freed) });
        } catch (err) {
          console.error('Failed to reclaim storage on delete-all:', err);
        }
      }

      setLightboxImage(null);
    } catch (error) {
      console.error('Error deleting all images:', error);
    } finally {
      setDeletingAll(false);
    }
  };

  // Get images to display based on mode, with logos mixed in
  const getDisplayImages = (): UserGalleryImage[] => {
    let baseImages: UserGalleryImage[];
    if (displayLimit > 0) {
      // Specific limit selected (10, 20, 50, 100)
      baseImages = images.slice(0, displayLimit);
    } else {
      // "All" mode - use pagination to avoid loading thousands at once
      baseImages = images.slice(0, paginationLimit);
    }

    // If no logos, return images as-is
    if (logoImages.length === 0) {
      return baseImages;
    }

    // Mix logos into the images at regular intervals
    // Logos repeat cyclically every N images (where N = number of logos * spacing)
    const mixedImages: UserGalleryImage[] = [];
    const logoSpacing = Math.max(3, Math.floor(baseImages.length / (logoImages.length * 2))); // At least every 3 images
    let logoIndex = 0;

    for (let i = 0; i < baseImages.length; i++) {
      // Insert logo at regular intervals
      if (i > 0 && i % logoSpacing === 0 && logoImages.length > 0) {
        mixedImages.push(logoImages[logoIndex % logoImages.length]);
        logoIndex++;
      }
      mixedImages.push(baseImages[i]);
    }

    return mixedImages;
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
                    {/* NEW ribbon */}
                    {showNewBadge && isNewImage(image.id) && <NewRibbon />}
                    {/* Name badge */}
                    {showNames && image.uploaderName && image.uploaderName !== 'אנונימי' && image.uploaderName !== 'Anonymous' && (
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
              {/* NEW ribbon */}
              {showNewBadge && isNewImage(image.id) && <NewRibbon />}
              {/* Name badge - always visible when enabled */}
              {showNames && image.uploaderName && image.uploaderName !== 'אנונימי' && image.uploaderName !== 'Anonymous' && (
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
                <span>{t.loadMoreImages}</span>
                <span className="text-white/60">({images.length - paginationLimit} {t.remaining})</span>
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
                {/* NEW ribbon */}
                {showNewBadge && isNewImage(image.id) && <NewRibbon />}
                {showNames && image.uploaderName && image.uploaderName !== 'אנונימי' && image.uploaderName !== 'Anonymous' && (
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
                {/* NEW ribbon */}
                {showNewBadge && isNewImage(image.id) && <NewRibbon />}
                {showNames && image.uploaderName && image.uploaderName !== 'אנונימי' && image.uploaderName !== 'Anonymous' && (
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

            {/* Settings button - only for owner */}
            {isOwner && (
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
            )}
          </div>

          {/* Settings Panel with smooth animation - only for owner */}
          {isOwner && (
          <div
            className={`overflow-hidden transition-all duration-300 ease-out ${
              showSettings ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
              {/* Row 1: Display mode + Grid columns + Toggles */}
              <div className="flex items-center justify-center flex-wrap gap-3">
                {/* Display mode buttons */}
                <div className="flex gap-1">
                  <Tooltip text={t.staticView}>
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
                  <Tooltip text={t.autoScroll}>
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
                  <Tooltip text={t.shuffleMode}>
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

                {/* Grid columns slider */}
                <Tooltip text={t.columnCount}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white/60">{t.columns}</span>
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

                {/* Toggles */}
                <div className="flex items-center gap-3">
                  <Tooltip text={t.showNamesOnImages}>
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
                      <span className="text-sm text-white/60">{t.showNames}</span>
                    </div>
                  </Tooltip>

                  <Tooltip text={t.subtleMotion}>
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
                      <span className="text-sm text-white/60">{t.movement}</span>
                    </div>
                  </Tooltip>

                  <Tooltip text={t.showNewBadge}>
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
              </div>

              {/* Row 2: Display limit + Sliders + Image count + Delete */}
              <div className="flex items-center justify-center flex-wrap gap-3">
                {/* Display limit buttons */}
                <Tooltip text={t.imageCount} position="above">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white/60">{t.latest}</span>
                    <div className="flex gap-1">
                      {[0, 50, 100, 200, 300, 400].map((limit) => (
                        <button
                          key={limit}
                          onClick={() => updateDisplayLimit(limit)}
                          className={`px-2 py-1 text-sm rounded-lg transition-colors ${
                            displayLimit === limit
                              ? 'bg-blue-500 text-white'
                              : 'bg-white/10 text-white/60 hover:bg-white/20'
                          }`}
                        >
                          {limit === 0 ? t.all : limit}
                        </button>
                      ))}
                    </div>
                  </div>
                </Tooltip>

                <div className="w-px h-5 bg-white/20" />

                {/* Border radius slider */}
                <Tooltip text={t.cornerRadius} position="above">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white/60">{t.roundCorners}</span>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={borderRadius}
                      onChange={(e) => updateBorderRadius(Number(e.target.value))}
                      className="w-16 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <span className="text-sm text-white/60 w-6">{borderRadius}%</span>
                  </div>
                </Tooltip>

                {/* Name size slider */}
                <Tooltip text={t.nameTextSize} position="above">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white/60">{t.names}</span>
                    <input
                      type="range"
                      min="10"
                      max="48"
                      value={nameSize}
                      onChange={(e) => updateNameSize(Number(e.target.value))}
                      className="w-16 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <span className="text-sm text-white/60 w-6">{nameSize}px</span>
                  </div>
                </Tooltip>

                <div className="w-px h-5 bg-white/20" />

                {/* Image count + Delete button together */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white/50">
                    {images.length} {t.images}
                  </span>
                  {isOwner && images.length > 0 && (
                    <Tooltip text={t.deleteAllImages} position="above">
                      <button
                        onClick={() => setShowDeleteAllConfirm(true)}
                        disabled={deletingAll}
                        className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors disabled:opacity-50"
                      >
                        {deletingAll ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      )}

      {/* Grid */}
      {images.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-4">
            <ImageIcon className="w-10 h-10 text-white/40" />
          </div>
          <h2 className="text-xl font-semibold mb-2">{t.galleryEmpty}</h2>
          <p className="text-white/60">
            {t.noImagesYet}
          </p>
          <a
            href={`/v/${shortId}`}
            className="mt-4 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 transition-colors"
          >
            {t.backToPage}
          </a>
        </div>
      ) : (
        renderGrid()
      )}

      {/* "Feature new photo": pops up big, holds, then falls into the grid */}
      {featured && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center overflow-hidden">
          <div
            className={`absolute inset-0 bg-black/55 transition-opacity duration-700 ${
              featured.phase === 'hold' ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div
            className="absolute left-1/2 top-1/2 rounded-3xl overflow-hidden shadow-2xl ring-4 ring-white/80"
            style={{
              width: '70vmin',
              height: '70vmin',
              transform:
                featured.phase === 'enter'
                  ? 'translate(-50%, -50%) scale(0.7)'
                  : featured.phase === 'fly'
                  ? 'translate(-50%, calc(-50% + 34vh)) scale(0.12)'
                  : 'translate(-50%, -50%) scale(1)',
              opacity: featured.phase === 'hold' ? 1 : featured.phase === 'fly' ? 0 : 0,
              transition:
                featured.phase === 'fly'
                  ? 'transform 0.75s cubic-bezier(0.5, 0, 0.75, 0), opacity 0.75s ease-in'
                  : 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.45s ease-out',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={featured.image.url} alt={featured.image.uploaderName} className="w-full h-full object-cover" />
            {showNewBadge && isNewImage(featured.image.id) && <NewRibbon />}
            {featured.image.uploaderName &&
              featured.image.uploaderName !== 'אנונימי' &&
              featured.image.uploaderName !== 'Anonymous' && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full bg-black/60 backdrop-blur-sm">
                  <span className="text-white text-2xl font-semibold">{featured.image.uploaderName}</span>
                </div>
              )}
          </div>
        </div>
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
                placeholder={t.enterName}
                className="bg-transparent text-white text-sm text-center outline-none min-w-[100px] placeholder:text-white/50"
                dir={locale === 'he' ? 'rtl' : 'ltr'}
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
              <h3 className="text-lg font-semibold text-white">{t.deleteAllGallery}</h3>
              <p className="text-sm text-white/60 mt-2">
                {t.deleteAllWarning.replace('{count}', String(images.length))}
                <br />
                {t.cannotUndo}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteAllConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleDeleteAllImages}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                {t.deleteAll}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard toggle button (only if route is active) - Gaming style */}
      {isRouteEnabled && (
        <button
          onClick={() => setShowLeaderboard(!showLeaderboard)}
          className={`
            fixed z-40 p-3 rounded-xl shadow-lg transition-all duration-300
            ${locale === 'he' ? 'left-4' : 'right-4'}
            ${showLeaderboard
              ? 'bg-gradient-to-br from-amber-400 to-yellow-500 shadow-[0_0_20px_rgba(251,191,36,0.4)]'
              : 'bg-gradient-to-br from-slate-800 to-slate-700 border border-slate-600/50 shadow-[0_0_15px_rgba(0,0,0,0.3)]'
            }
            hover:scale-110 hover:shadow-[0_0_25px_rgba(251,191,36,0.5)]
          `}
          style={{ top: '50%', transform: 'translateY(-50%)' }}
          title={locale === 'he' ? 'לידרבורד' : 'Leaderboard'}
        >
          <span className={`text-xl ${showLeaderboard ? '' : 'animate-pulse'}`}>🏆</span>
        </button>
      )}

      {/* Leaderboard panel - Glassmorphism style */}
      {isRouteEnabled && showLeaderboard && (
        <div
          className={`
            fixed top-0 z-40 h-full w-96
            bg-black/40 backdrop-blur-xl
            shadow-[0_0_50px_rgba(0,0,0,0.3)]
            border-slate-500/20
            transform transition-transform duration-300 ease-in-out overflow-y-auto
            ${locale === 'he' ? 'left-0 border-r' : 'right-0 border-l'}
          `}
        >
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/20 pointer-events-none" />

          <div className="relative p-5">
            {/* Close button */}
            <button
              onClick={() => setShowLeaderboard(false)}
              className={`
                absolute top-4 p-2.5 rounded-full
                bg-white/10 hover:bg-white/20
                backdrop-blur-sm border border-white/20
                transition-all duration-200 hover:scale-110
                ${locale === 'he' ? 'left-4' : 'right-4'}
              `}
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {/* Route title */}
            <div className="mb-6 mt-2" dir={locale === 'he' ? 'rtl' : 'ltr'}>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-3xl">🎮</span>
                <h2 className="text-2xl font-black text-white drop-shadow-lg">
                  {routeTitle}
                </h2>
              </div>
              <p className="text-xs text-white/50 uppercase tracking-widest">
                {locale === 'he' ? 'מסלול פעיל' : 'Active Route'}
              </p>
            </div>

            {/* Leaderboard */}
            <LiveLeaderboard
              routeId={folderId!}
              locale={locale}
              maxEntries={10}
              currentVisitorId={currentVisitorId || undefined}
              isAdmin={isOwner}
            />
          </div>
        </div>
      )}

      {/* Keyboard shortcut hint */}
      {showHint && isOwner && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-black/90 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg">
          <span className="text-sm text-white/80">
            {t.ctrlHint.replace('{key}', '')} <kbd className="px-2 py-0.5 bg-white/20 rounded text-white font-mono text-xs mx-1">Ctrl</kbd>
          </span>
          <button
            onClick={dismissHint}
            className="p-1 rounded hover:bg-white/20 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Connection-status dot — minimal red light when offline (display keeps running) */}
      {showConnectionDot && (
        <div className="fixed bottom-3 right-3 z-50">
          <Tooltip text={t.connectionLost} position="above">
            <div className="relative w-3.5 h-3.5 cursor-default">
              <span className="absolute inset-0 rounded-full bg-red-500 opacity-60 animate-ping" />
              <span className="relative block w-3.5 h-3.5 rounded-full bg-red-500 ring-2 ring-black/50 shadow" />
            </div>
          </Tooltip>
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
