'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { doc, getDoc, updateDoc, collection, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCandidates, updateCandidate, deleteCandidate, batchUpdateCandidateStatus, createCandidate, deleteAllQVoteData, recalculateStats, resetAllVotes } from '@/lib/qvote';
import { QRCodeSVG } from 'qrcode.react';

// Helper function to remove undefined values from objects (Firestore doesn't accept undefined)
function removeUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result = {} as T;
  for (const key in obj) {
    const value = obj[key];
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      result[key] = value.map((item) => {
        if (item !== null && typeof item === 'object' && !(item instanceof Date)) {
          return removeUndefined(item as Record<string, unknown>);
        }
        return item;
      }) as T[typeof key];
    } else if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
      result[key] = removeUndefined(value as Record<string, unknown>) as T[typeof key];
    } else {
      result[key] = value;
    }
  }
  return result;
}

// Animated number component with smooth counting animation
function AnimatedNumber({ value, duration = 500 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const previousValue = useRef(0);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = previousValue.current;
    const endValue = value;
    const startTime = performance.now();

    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    // If values are the same, no need to animate
    if (startValue === endValue) {
      setTimeout(() => setDisplayValue(endValue), 0);
      return;
    }

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (endValue - startValue) * easeOut);

      setDisplayValue(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        previousValue.current = endValue;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  return <>{displayValue.toLocaleString()}</>;
}

// Image Zoom Modal with pinch-to-zoom support
function ImageZoomModal({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const lastPosition = useRef({ x: 0, y: 0 });

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch start
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastTouchDistance.current = distance;
      lastTouchCenter.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    } else if (e.touches.length === 1 && scale > 1) {
      // Pan start (only when zoomed)
      isDragging.current = true;
      lastPosition.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      e.preventDefault();
      // Pinch zoom
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scaleChange = distance / lastTouchDistance.current;
      setScale((prev) => Math.min(Math.max(prev * scaleChange, 1), 5));
      lastTouchDistance.current = distance;
    } else if (e.touches.length === 1 && isDragging.current && scale > 1) {
      // Pan (only when zoomed)
      const deltaX = e.touches[0].clientX - lastPosition.current.x;
      const deltaY = e.touches[0].clientY - lastPosition.current.y;
      setPosition((prev) => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));
      lastPosition.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchEnd = () => {
    lastTouchDistance.current = null;
    lastTouchCenter.current = null;
    isDragging.current = false;
    // Reset position if scale is 1
    if (scale <= 1) {
      setPosition({ x: 0, y: 0 });
    }
  };

  const handleDoubleClick = () => {
    if (scale > 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(2.5);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
      onClick={scale <= 1 ? onClose : undefined}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 end-4 z-10 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Zoom hint */}
      {scale === 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-full bg-white/10 text-white/70 text-sm backdrop-blur-sm">
          צבוט לזום • לחץ כפול להגדלה
        </div>
      )}

      {/* Image container */}
      <div
        className="w-full h-full flex items-center justify-center overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt=""
          className="max-w-full max-h-full object-contain transition-transform duration-100"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            touchAction: 'none',
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}

import type { CandidatePhoto } from '@/types/qvote';
import { Candidate, QVoteConfig } from '@/types/qvote';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowRight,
  Check,
  XCircle,
  Eye,
  EyeOff,
  Trophy,
  Loader2,
  User,
  Calendar,
  Image as ImageIcon,
  RefreshCw,
  X,
  Vote,
  ExternalLink,
  Search,
  Upload,
  Plus,
  Camera,
  Edit3,
  Settings,
  Grid3X3,
  List,
  Trash2,
  Sparkles,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Tag,
  Tags,
} from 'lucide-react';
import QVoteModal from '@/components/modals/QVoteModal';
import QVoteVotersModal from '@/components/modals/QVoteVotersModal';
import { MediaItem } from '@/types';
import { compressImage, createCompressedFile, formatBytes } from '@/lib/imageCompression';

export default function QVoteCandidatesPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const codeId = params.id as string;
  const locale = (params.locale as string) || 'he';
  const isRTL = locale === 'he';

  const [code, setCode] = useState<{ title?: string; shortId?: string; ownerId?: string; media?: MediaItem[] } | null>(null);
  const [qvoteConfig, setQvoteConfig] = useState<QVoteConfig | null>(null);
  const [qvoteMediaItem, setQvoteMediaItem] = useState<MediaItem | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'finalists'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]); // Empty = all categories
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Settings modal state
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Bulk upload state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const bulkUploadRef = useRef<HTMLInputElement>(null);

  // Manual add state
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualPhotos, setManualPhotos] = useState<File[]>([]);
  const [manualPhotoPreviews, setManualPhotoPreviews] = useState<string[]>([]);
  const [manualCandidateName, setManualCandidateName] = useState('');
  const [manualCompanyName, setManualCompanyName] = useState('');
  const [manualCategoryIds, setManualCategoryIds] = useState<string[]>([]);
  const [addingManually, setAddingManually] = useState(false);
  const [currentPhotoSlot, setCurrentPhotoSlot] = useState<number>(0);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Edit photo state
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [editPhotoIndex, setEditPhotoIndex] = useState<number>(0);
  const editPhotoInputRef = useRef<HTMLInputElement>(null);

  // Inline name editing state
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');

  // Edit modal state
  const [editModalCandidate, setEditModalCandidate] = useState<Candidate | null>(null);
  const [editModalDraggingSlot, setEditModalDraggingSlot] = useState<number | null>(null);
  const [cardDraggingId, setCardDraggingId] = useState<string | null>(null);

  // Delete all state
  const [deletingAll, setDeletingAll] = useState(false);
  const [resettingVotes, setResettingVotes] = useState(false);
  const [showDangerZone, setShowDangerZone] = useState(false);

  // Reset votes modal state
  const [showResetVotesModal, setShowResetVotesModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');

  // Voters modal state
  const [showVotersModal, setShowVotersModal] = useState(false);

  // Upload zone collapsed state
  const [showUploadZone, setShowUploadZone] = useState(false);

  // Upload category selection state
  const [uploadCategoryId, setUploadCategoryId] = useState<string>('');

  // Bulk category assignment state
  const [showCategoryAssignModal, setShowCategoryAssignModal] = useState(false);
  const [assigningCategories, setAssigningCategories] = useState(false);

  // Bulk delete state
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState('');
  const [deletingBulk, setDeletingBulk] = useState(false);

  // Per-card category picker state
  const [openCategoryPickerId, setOpenCategoryPickerId] = useState<string | null>(null);

  // Image zoom modal state
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);

  // Close category picker when clicking outside
  useEffect(() => {
    if (!openCategoryPickerId) return;

    const handleClickOutside = () => {
      setOpenCategoryPickerId(null);
    };

    // Add listener after a small delay to prevent immediate closing
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [openCategoryPickerId]);

  // Phase scheduling state
  const [editingSchedulePhase, setEditingSchedulePhase] = useState<string | null>(null);

  // Load code data
  useEffect(() => {
    const loadCodeData = async () => {
      setLoading(true);
      setError(null);
      try {
        const codeDoc = await getDoc(doc(db, 'codes', codeId));
        if (!codeDoc.exists()) {
          setError(isRTL ? 'הקוד לא נמצא' : 'Code not found');
          setLoading(false);
          return;
        }

        const codeData = codeDoc.data();
        setCode({
          title: codeData.title,
          shortId: codeData.shortId,
          ownerId: codeData.ownerId,
          media: codeData.media,
        });

        const qvoteMedia = codeData.media?.find((m: { type: string }) => m.type === 'qvote');
        if (qvoteMedia?.qvoteConfig) {
          setQvoteConfig(qvoteMedia.qvoteConfig);
          setQvoteMediaItem(qvoteMedia);
        }

        // Initial load of candidates
        const loaded = await getCandidates(codeId);
        setCandidates(loaded);
      } catch (err) {
        console.error('Error loading data:', err);
        setError(isRTL ? 'שגיאה בטעינת הנתונים' : 'Error loading data');
      } finally {
        setLoading(false);
      }
    };

    if (codeId) {
      loadCodeData();
    }
  }, [codeId, isRTL]);

  // Real-time listener for candidates (vote updates)
  useEffect(() => {
    if (!codeId) return;

    const unsubscribe = onSnapshot(
      collection(db, 'codes', codeId, 'candidates'),
      (snapshot) => {
        const updatedCandidates = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            codeId: data.codeId,
            categoryId: data.categoryId,
            categoryIds: data.categoryIds || [],
            source: data.source,
            name: data.name,
            formData: data.formData || {},
            photos: (data.photos || []).map((p: CandidatePhoto) => ({
              ...p,
              uploadedAt: p.uploadedAt instanceof Timestamp
                ? p.uploadedAt.toDate()
                : new Date(p.uploadedAt as string | number | Date),
            })),
            voteCount: data.voteCount || 0,
            finalsVoteCount: data.finalsVoteCount || 0,
            isApproved: data.isApproved || false,
            isFinalist: data.isFinalist || false,
            isHidden: data.isHidden || false,
            displayOrder: data.displayOrder || 0,
            visitorId: data.visitorId,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          } as Candidate;
        });

        // Sort by displayOrder
        updatedCandidates.sort((a, b) => a.displayOrder - b.displayOrder);
        setCandidates(updatedCandidates);
      },
      (error) => {
        console.error('Error listening to candidates:', error);
      }
    );

    return () => unsubscribe();
  }, [codeId]);

  const isAuthorized = user && code && (code.ownerId === user.id || user.role === 'super_admin');

  // Check if name looks like a real name (not a filename)
  const isRealName = useCallback((name: string | undefined): boolean => {
    if (!name) return false;
    // Check for common filename patterns
    if (name.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) return false;
    if (name.match(/^(IMG|DSC|Photo|Screenshot|Firefly|Adobe|DCIM|image)/i)) return false;
    if (name.match(/^\d{5,}/)) return false;
    if (name.match(/[_-]\d+$/)) return false;
    if (name.match(/^[A-Za-z0-9_-]+\s*\(\d+\)$/)) return false;
    return true;
  }, []);

  // Get display name (returns empty string if filename)
  const getDisplayName = useCallback((candidate: Candidate): string => {
    if (isRealName(candidate.name)) return candidate.name || '';
    return '';
  }, [isRealName]);

  const getCandidateSearchText = useCallback((candidate: Candidate): string => {
    const parts = [
      candidate.name || '',
      ...Object.values(candidate.formData || {}).map(v => String(v)),
    ];
    return parts.join(' ').toLowerCase();
  }, []);

  const searchSuggestions = searchQuery.length > 0
    ? candidates
        .filter((c) => getCandidateSearchText(c).includes(searchQuery.toLowerCase()))
        .slice(0, 5)
    : [];

  const filteredCandidates = useMemo(() => {
    // First deduplicate by ID
    const seenIds = new Set<string>();
    const deduped = candidates.filter((c) => {
      if (seenIds.has(c.id)) return false;
      seenIds.add(c.id);
      return true;
    });

    return deduped.filter((c) => {
      // Status filter
      let passesFilter = true;
      switch (filter) {
        case 'pending':
          passesFilter = !c.isApproved && !c.isHidden;
          break;
        case 'approved':
          passesFilter = c.isApproved;
          break;
        case 'finalists':
          passesFilter = c.isFinalist;
          break;
        default:
          passesFilter = true;
      }
      if (!passesFilter) return false;

      // Category filter - if categories are selected, check if candidate belongs to any of them
      if (categoryFilter.length > 0) {
        const candidateCategories = c.categoryIds?.length ? c.categoryIds : (c.categoryId ? [c.categoryId] : []);
        const passesCategory = categoryFilter.some(catId => candidateCategories.includes(catId));
        if (!passesCategory) return false;
      }

      // Search filter
      if (!searchQuery) return true;
      return getCandidateSearchText(c).includes(searchQuery.toLowerCase());
    });
  }, [candidates, filter, categoryFilter, searchQuery]);

  // Actions
  const handleApprove = async (candidateId: string, approve: boolean) => {
    setUpdating(candidateId);
    try {
      await updateCandidate(codeId, candidateId, { isApproved: approve });
      setCandidates((prev) =>
        prev.map((c) => (c.id === candidateId ? { ...c, isApproved: approve } : c))
      );
    } catch (error) {
      console.error('Error updating candidate:', error);
    } finally {
      setUpdating(null);
    }
  };

  const handleToggleHidden = async (candidateId: string, hide: boolean) => {
    setUpdating(candidateId);
    try {
      await updateCandidate(codeId, candidateId, { isHidden: hide });
      setCandidates((prev) =>
        prev.map((c) => (c.id === candidateId ? { ...c, isHidden: hide } : c))
      );
    } catch (error) {
      console.error('Error updating candidate:', error);
    } finally {
      setUpdating(null);
    }
  };

  const handleToggleFinalist = async (candidateId: string, isFinalist: boolean) => {
    setUpdating(candidateId);
    try {
      await updateCandidate(codeId, candidateId, { isFinalist });
      setCandidates((prev) =>
        prev.map((c) => (c.id === candidateId ? { ...c, isFinalist } : c))
      );
    } catch (error) {
      console.error('Error updating candidate:', error);
    } finally {
      setUpdating(null);
    }
  };

  const handleDelete = async (candidateId: string) => {
    if (!confirm(isRTL ? 'למחוק את המועמד?' : 'Delete candidate?')) return;

    setUpdating(candidateId);
    try {
      await deleteCandidate(codeId, candidateId);
      setCandidates((prev) => prev.filter((c) => c.id !== candidateId));
    } catch (error) {
      console.error('Error deleting candidate:', error);
    } finally {
      setUpdating(null);
    }
  };

  const handleDeleteAll = async () => {
    const confirmMessage = isRTL
      ? `האם אתה בטוח שברצונך למחוק את כל ${candidates.length} המועמדים? פעולה זו אינה ניתנת לביטול!`
      : `Are you sure you want to delete all ${candidates.length} candidates? This cannot be undone!`;

    if (!confirm(confirmMessage)) return;

    const doubleConfirm = isRTL ? 'הקלד "מחק" לאישור:' : 'Type "delete" to confirm:';
    const confirmation = prompt(doubleConfirm);
    if (confirmation?.toLowerCase() !== (isRTL ? 'מחק' : 'delete')) {
      return;
    }

    setDeletingAll(true);
    try {
      await deleteAllQVoteData(codeId);
      await recalculateStats(codeId);
      setCandidates([]);
      setSelectedCandidates([]);
      setShowDangerZone(false);
    } catch (error) {
      console.error('Error deleting all candidates:', error);
      alert(isRTL ? 'שגיאה במחיקת המועמדים' : 'Error deleting candidates');
    } finally {
      setDeletingAll(false);
    }
  };

  // Inline name editing
  const startEditingName = (candidate: Candidate) => {
    setEditingNameId(candidate.id);
    setEditingNameValue(candidate.name || '');
  };

  const saveEditingName = async () => {
    if (!editingNameId) return;

    const trimmedName = editingNameValue.trim();
    const candidate = candidates.find((c) => c.id === editingNameId);

    // Only save if name changed
    if (candidate && trimmedName !== candidate.name) {
      try {
        await updateCandidate(codeId, editingNameId, { name: trimmedName });
        setCandidates((prev) =>
          prev.map((c) => (c.id === editingNameId ? { ...c, name: trimmedName } : c))
        );
      } catch (error) {
        console.error('Error updating name:', error);
      }
    }

    setEditingNameId(null);
    setEditingNameValue('');
  };

  // Clear name (with bulk option)
  const handleClearName = async (candidateId: string) => {
    // Check if there are selected candidates
    if (selectedCandidates.length > 1 && selectedCandidates.includes(candidateId)) {
      const clearAll = confirm(
        isRTL
          ? `למחוק שמות מכל ${selectedCandidates.length} המועמדים שנבחרו?`
          : `Clear names from all ${selectedCandidates.length} selected candidates?`
      );

      if (clearAll) {
        setUpdating('bulk');
        try {
          for (const id of selectedCandidates) {
            await updateCandidate(codeId, id, { name: '' });
          }
          setCandidates((prev) =>
            prev.map((c) =>
              selectedCandidates.includes(c.id) ? { ...c, name: '' } : c
            )
          );
        } catch (error) {
          console.error('Error clearing names:', error);
        } finally {
          setUpdating(null);
        }
        return;
      }
    }

    // Clear single name
    setUpdating(candidateId);
    try {
      await updateCandidate(codeId, candidateId, { name: '' });
      setCandidates((prev) =>
        prev.map((c) => (c.id === candidateId ? { ...c, name: '' } : c))
      );
    } catch (error) {
      console.error('Error clearing name:', error);
    } finally {
      setUpdating(null);
    }
  };

  const handleResetVotes = async () => {
    const confirmMessage = isRTL
      ? `האם אתה בטוח שברצונך לאפס את כל ההצבעות? המועמדים יישארו אבל כל הקולות יימחקו.`
      : `Are you sure you want to reset all votes? Candidates will remain but all votes will be deleted.`;

    if (!confirm(confirmMessage)) return;

    setResettingVotes(true);
    try {
      const result = await resetAllVotes(codeId);
      alert(isRTL
        ? `${result.deletedVotes} הצבעות נמחקו. ניתן להצביע מחדש.`
        : `${result.deletedVotes} votes deleted. Voting can start again.`
      );
    } catch (error) {
      console.error('Error resetting votes:', error);
      alert(isRTL ? 'שגיאה באיפוס ההצבעות' : 'Error resetting votes');
    } finally {
      setResettingVotes(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedCandidates.length === 0) return;
    setUpdating('bulk');
    try {
      await batchUpdateCandidateStatus(codeId, selectedCandidates, { isApproved: true });
      setCandidates((prev) =>
        prev.map((c) =>
          selectedCandidates.includes(c.id) ? { ...c, isApproved: true } : c
        )
      );
      setSelectedCandidates([]);
    } catch (error) {
      console.error('Error bulk approving:', error);
    } finally {
      setUpdating(null);
    }
  };

  const handleBulkUnapprove = async () => {
    if (selectedCandidates.length === 0) return;
    setUpdating('bulk');
    try {
      await batchUpdateCandidateStatus(codeId, selectedCandidates, { isApproved: false });
      setCandidates((prev) =>
        prev.map((c) =>
          selectedCandidates.includes(c.id) ? { ...c, isApproved: false } : c
        )
      );
      setSelectedCandidates([]);
    } catch (error) {
      console.error('Error bulk unapproving:', error);
    } finally {
      setUpdating(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCandidates.length === 0 || deletingBulk) return;

    setDeletingBulk(true);
    try {
      // Delete each selected candidate and their photos
      for (const candidateId of selectedCandidates) {
        const candidate = candidates.find((c) => c.id === candidateId);
        if (candidate) {
          // Delete photos from blob storage
          for (const photo of candidate.photos) {
            try {
              await fetchWithAuth('/api/qvote/upload', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: photo.url, thumbnailUrl: photo.thumbnailUrl, codeId }),
              });
            } catch (photoError) {
              console.error('Error deleting photo:', photoError);
            }
          }
          // Delete candidate from Firestore
          await deleteCandidate(codeId, candidateId);
        }
      }

      // Update local state
      setCandidates((prev) => prev.filter((c) => !selectedCandidates.includes(c.id)));
      setSelectedCandidates([]);
      setShowBulkDeleteModal(false);
      setBulkDeleteConfirmText('');
    } catch (error) {
      console.error('Error bulk deleting:', error);
    } finally {
      setDeletingBulk(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedCandidates.length === filteredCandidates.length) {
      setSelectedCandidates([]);
    } else {
      setSelectedCandidates(filteredCandidates.map((c) => c.id));
    }
  };

  const refreshCandidates = async () => {
    setLoading(true);
    try {
      const loaded = await getCandidates(codeId);
      setCandidates(loaded);
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setLoading(false);
    }
  };

  // Upload handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/')
    );
    if (files.length > 0) {
      await handleBulkImageUpload(files);
    }
  };

  const handleBulkFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      await handleBulkImageUpload(files);
    }
    if (bulkUploadRef.current) {
      bulkUploadRef.current.value = '';
    }
  };

  const handleBulkImageUpload = async (files: File[]) => {
    if (uploadingImages) return;

    setUploadingImages(true);
    setUploadProgress({ current: 0, total: files.length });

    const newCandidates: Candidate[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress({ current: i + 1, total: files.length });

      try {
        // Compress image before upload (target 300KB, max 1200px)
        const compressed = await compressImage(file, { maxSizeKB: 300, maxWidth: 1200, maxHeight: 1200 });
        const compressedFile = createCompressedFile(compressed, file.name);
        console.log(`Compressed ${file.name}: ${formatBytes(compressed.originalSize)} → ${formatBytes(compressed.compressedSize)}`);

        const formDataUpload = new FormData();
        formDataUpload.append('file', compressedFile);
        formDataUpload.append('codeId', codeId);
        if (code?.ownerId) {
          formDataUpload.append('ownerId', code.ownerId);
        }

        const response = await fetch('/api/qvote/upload', {
          method: 'POST',
          body: formDataUpload,
        });

        if (!response.ok) continue;

        const data = await response.json();
        const candidateName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        const candidate = await createCandidate(codeId, {
          source: 'producer',
          name: candidateName,
          formData: { name: candidateName },
          photos: [{
            id: data.id,
            url: data.url,
            thumbnailUrl: data.thumbnailUrl || data.url,
            order: 0,
            uploadedAt: new Date(),
            size: data.size, // Store compressed file size
          }],
          isApproved: true,
          isFinalist: false,
          isHidden: false,
          displayOrder: candidates.length + i,
          // Add category if selected
          ...(uploadCategoryId && {
            categoryId: uploadCategoryId,
            categoryIds: [uploadCategoryId],
          }),
        });

        newCandidates.push(candidate);
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
      }
    }

    if (newCandidates.length > 0) {
      setCandidates((prev) => {
        // Filter out any duplicates based on ID
        const existingIds = new Set(prev.map((c) => c.id));
        const uniqueNew = newCandidates.filter((c) => !existingIds.has(c.id));
        return [...prev, ...uniqueNew];
      });
    }

    setUploadingImages(false);
    setUploadProgress({ current: 0, total: 0 });
  };

  // Bulk assign categories to selected candidates
  const handleBulkCategoryAssign = async (categoryIds: string[]) => {
    if (selectedCandidates.length === 0 || assigningCategories) return;

    setAssigningCategories(true);
    try {
      for (const candidateId of selectedCandidates) {
        const candidate = candidates.find((c) => c.id === candidateId);
        if (!candidate) continue;

        // Merge existing categories with new ones
        const existingCategories = candidate.categoryIds || (candidate.categoryId ? [candidate.categoryId] : []);
        const mergedCategories = [...new Set([...existingCategories, ...categoryIds])];

        await updateCandidate(codeId, candidateId, {
          categoryIds: mergedCategories,
          categoryId: mergedCategories[0], // Keep legacy field updated
        });
      }

      // Update local state
      setCandidates((prev) =>
        prev.map((c) => {
          if (selectedCandidates.includes(c.id)) {
            const existingCategories = c.categoryIds || (c.categoryId ? [c.categoryId] : []);
            const mergedCategories = [...new Set([...existingCategories, ...categoryIds])];
            return { ...c, categoryIds: mergedCategories, categoryId: mergedCategories[0] };
          }
          return c;
        })
      );

      setSelectedCandidates([]);
      setShowCategoryAssignModal(false);
    } catch (error) {
      console.error('Error assigning categories:', error);
    } finally {
      setAssigningCategories(false);
    }
  };

  // Remove category from candidate
  const handleRemoveCategoryFromCandidate = async (candidateId: string, categoryIdToRemove: string) => {
    const candidate = candidates.find((c) => c.id === candidateId);
    if (!candidate) return;

    const currentCategories = candidate.categoryIds || (candidate.categoryId ? [candidate.categoryId] : []);
    const updatedCategories = currentCategories.filter((id) => id !== categoryIdToRemove);

    await updateCandidate(codeId, candidateId, {
      categoryIds: updatedCategories.length > 0 ? updatedCategories : [],
      categoryId: updatedCategories[0] || undefined,
    });

    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateId
          ? { ...c, categoryIds: updatedCategories, categoryId: updatedCategories[0] || undefined }
          : c
      )
    );
  };

  // Add category to candidate (from per-card picker)
  const handleAddCategoryToCandidate = async (candidateId: string, categoryIdToAdd: string) => {
    const candidate = candidates.find((c) => c.id === candidateId);
    if (!candidate) return;

    const currentCategories = candidate.categoryIds || (candidate.categoryId ? [candidate.categoryId] : []);

    // Don't add if already exists
    if (currentCategories.includes(categoryIdToAdd)) {
      setOpenCategoryPickerId(null);
      return;
    }

    const updatedCategories = [...currentCategories, categoryIdToAdd];

    await updateCandidate(codeId, candidateId, {
      categoryIds: updatedCategories,
      categoryId: updatedCategories[0],
    });

    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateId
          ? { ...c, categoryIds: updatedCategories, categoryId: updatedCategories[0] }
          : c
      )
    );

    setOpenCategoryPickerId(null);
  };

  // Manual add handlers
  const openCameraForSlot = (slot: number) => {
    setCurrentPhotoSlot(slot);
    cameraInputRef.current?.click();
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const preview = event.target?.result as string;
      setManualPhotos((prev) => {
        const newPhotos = [...prev];
        newPhotos[currentPhotoSlot] = file;
        return newPhotos;
      });
      setManualPhotoPreviews((prev) => {
        const newPreviews = [...prev];
        newPreviews[currentPhotoSlot] = preview;
        return newPreviews;
      });
    };
    reader.readAsDataURL(file);

    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  const resetManualAdd = () => {
    setShowAddModal(false);
    setManualPhotos([]);
    setManualPhotoPreviews([]);
    setManualCandidateName('');
    setManualCompanyName('');
    setManualCategoryIds([]);
    setCurrentPhotoSlot(0);
  };

  const handleManualSubmit = async () => {
    if (manualPhotos.length === 0 || addingManually) return;

    setAddingManually(true);
    try {
      const uploadedPhotos = [];
      for (let i = 0; i < manualPhotos.length; i++) {
        const file = manualPhotos[i];
        if (!file) continue;

        // Compress image before upload (target 300KB, max 1200px)
        const compressed = await compressImage(file, { maxSizeKB: 300, maxWidth: 1200, maxHeight: 1200 });
        const compressedFile = createCompressedFile(compressed, file.name);
        console.log(`Compressed ${file.name}: ${formatBytes(compressed.originalSize)} → ${formatBytes(compressed.compressedSize)}`);

        const formDataUpload = new FormData();
        formDataUpload.append('file', compressedFile);
        formDataUpload.append('codeId', codeId);
        if (code?.ownerId) {
          formDataUpload.append('ownerId', code.ownerId);
        }

        const response = await fetch('/api/qvote/upload', {
          method: 'POST',
          body: formDataUpload,
        });

        if (!response.ok) continue;

        const data = await response.json();
        uploadedPhotos.push({
          id: data.id,
          url: data.url,
          thumbnailUrl: data.thumbnailUrl || data.url,
          order: i,
          uploadedAt: new Date(),
          size: data.size, // Store compressed file size
        });
      }

      if (uploadedPhotos.length === 0) throw new Error('No photos uploaded');

      const candidateName = manualCandidateName || (isRTL ? 'מועמד חדש' : 'New Candidate');
      const formData: Record<string, string> = { name: candidateName };
      if (manualCompanyName) {
        formData.company = manualCompanyName;
      }

      const candidate = await createCandidate(codeId, {
        source: 'producer',
        name: candidateName,
        formData,
        photos: uploadedPhotos,
        categoryIds: manualCategoryIds.length > 0 ? manualCategoryIds : undefined,
        isApproved: true,
        isFinalist: false,
        isHidden: false,
        displayOrder: candidates.length,
      });

      setCandidates((prev) => {
        // Prevent duplicates
        if (prev.some((c) => c.id === candidate.id)) return prev;
        return [...prev, candidate];
      });
      resetManualAdd();
    } catch (error) {
      console.error('Error adding candidate:', error);
    } finally {
      setAddingManually(false);
    }
  };

  const startEditPhoto = (candidate: Candidate, photoIndex: number) => {
    setEditingCandidate(candidate);
    setEditPhotoIndex(photoIndex);
    editPhotoInputRef.current?.click();
  };

  const handleEditPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingCandidate) return;

    setUpdating(editingCandidate.id);
    try {
      // Compress image before upload (target 300KB, max 1200px)
      const compressed = await compressImage(file, { maxSizeKB: 300, maxWidth: 1200, maxHeight: 1200 });
      const compressedFile = createCompressedFile(compressed, file.name);
      console.log(`Compressed ${file.name}: ${formatBytes(compressed.originalSize)} → ${formatBytes(compressed.compressedSize)}`);

      const formDataUpload = new FormData();
      formDataUpload.append('file', compressedFile);
      formDataUpload.append('codeId', codeId);
      if (code?.ownerId) {
        formDataUpload.append('ownerId', code.ownerId);
      }

      const response = await fetch('/api/qvote/upload', {
        method: 'POST',
        body: formDataUpload,
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      const newPhotos = [...editingCandidate.photos];
      newPhotos[editPhotoIndex] = {
        id: data.id,
        url: data.url,
        thumbnailUrl: data.thumbnailUrl || data.url,
        order: editPhotoIndex,
        uploadedAt: new Date(),
        size: data.size, // Store compressed file size
      };

      await updateCandidate(codeId, editingCandidate.id, { photos: newPhotos });
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === editingCandidate.id ? { ...c, photos: newPhotos } : c
        )
      );
    } catch (error) {
      console.error('Error updating photo:', error);
    } finally {
      setUpdating(null);
      setEditingCandidate(null);
      setEditPhotoIndex(0);
      if (editPhotoInputRef.current) {
        editPhotoInputRef.current.value = '';
      }
    }
  };

  // Upload photo via drag-drop (for edit modal slots and card replacement)
  const uploadPhotoFile = async (file: File): Promise<{ id: string; url: string; thumbnailUrl: string; size?: number } | null> => {
    try {
      // Compress image before upload (target 300KB, max 1200px)
      const compressed = await compressImage(file, { maxSizeKB: 300, maxWidth: 1200, maxHeight: 1200 });
      const compressedFile = createCompressedFile(compressed, file.name);
      console.log(`Compressed ${file.name}: ${formatBytes(compressed.originalSize)} → ${formatBytes(compressed.compressedSize)}`);

      const formDataUpload = new FormData();
      formDataUpload.append('file', compressedFile);
      formDataUpload.append('codeId', codeId);
      if (code?.ownerId) {
        formDataUpload.append('ownerId', code.ownerId);
      }

      const response = await fetch('/api/qvote/upload', {
        method: 'POST',
        body: formDataUpload,
      });

      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Error uploading photo:', error);
      return null;
    }
  };

  // Handle drag-drop on edit modal photo slot
  const handleEditModalSlotDrop = async (e: React.DragEvent, slotIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setEditModalDraggingSlot(null);

    if (!editModalCandidate) return;

    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    setUpdating(editModalCandidate.id);
    const uploadedPhoto = await uploadPhotoFile(file);

    if (uploadedPhoto) {
      const newPhotos = [...editModalCandidate.photos];
      newPhotos[slotIndex] = {
        id: uploadedPhoto.id,
        url: uploadedPhoto.url,
        thumbnailUrl: uploadedPhoto.thumbnailUrl || uploadedPhoto.url,
        order: slotIndex,
        uploadedAt: new Date(),
        size: uploadedPhoto.size, // Store compressed file size
      };

      // Update in Firebase
      await updateCandidate(codeId, editModalCandidate.id, { photos: newPhotos });

      // Update local state
      setEditModalCandidate({ ...editModalCandidate, photos: newPhotos });
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === editModalCandidate.id ? { ...c, photos: newPhotos } : c
        )
      );
    }
    setUpdating(null);
  };

  // Handle drag-drop on candidate card (replace first photo)
  const handleCardPhotoDrop = async (e: React.DragEvent, candidateId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setCardDraggingId(null);

    const candidate = candidates.find((c) => c.id === candidateId);
    if (!candidate) return;

    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    setUpdating(candidateId);
    const uploadedPhoto = await uploadPhotoFile(file);

    if (uploadedPhoto) {
      const newPhotos = [...candidate.photos];
      newPhotos[0] = {
        id: uploadedPhoto.id,
        url: uploadedPhoto.url,
        thumbnailUrl: uploadedPhoto.thumbnailUrl || uploadedPhoto.url,
        order: 0,
        uploadedAt: new Date(),
        size: uploadedPhoto.size, // Store compressed file size
      };

      await updateCandidate(codeId, candidateId, { photos: newPhotos });
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidateId ? { ...c, photos: newPhotos } : c
        )
      );
    }
    setUpdating(null);
  };

  // Stats
  const pendingCount = candidates.filter((c) => !c.isApproved && !c.isHidden).length;
  const approvedCount = candidates.filter((c) => c.isApproved).length;
  const finalistCount = candidates.filter((c) => c.isFinalist).length;
  const totalVotes = candidates.reduce((sum, c) => sum + (c.voteCount || 0), 0);

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 animate-pulse" />
            <Loader2 className="w-8 h-8 animate-spin text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-text-secondary animate-pulse">{isRTL ? 'טוען...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="text-center p-8 rounded-2xl bg-bg-card border border-border max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-danger mb-4 text-lg font-medium">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-accent text-white rounded-xl hover:bg-accent-hover transition-all font-medium"
          >
            {isRTL ? 'חזרה' : 'Go back'}
          </button>
        </div>
      </div>
    );
  }

  // Unauthorized
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="text-center p-8 rounded-2xl bg-bg-card border border-border max-w-md">
          <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-yellow-500" />
          </div>
          <p className="text-text-secondary mb-4">
            {isRTL ? 'אין לך הרשאה לצפות בדף זה' : 'You do not have permission to view this page'}
          </p>
          <button
            onClick={() => router.push(`/${locale}/login`)}
            className="px-6 py-3 bg-accent text-white rounded-xl hover:bg-accent-hover transition-all font-medium"
          >
            {isRTL ? 'התחברות' : 'Login'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="bg-bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => router.push(`/code/${codeId}`)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
            >
              <ArrowRight className={`w-5 h-5 ${isRTL ? '' : 'rotate-180'}`} />
              <span className="font-medium">{isRTL ? 'חזרה' : 'Back'}</span>
            </button>

            <div className="flex items-center gap-2">
              {code?.shortId && (
                <a
                  href={`/v/${code.shortId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm">{isRTL ? 'צפה בדף' : 'View'}</span>
                </a>
              )}
              <button
                onClick={() => setShowResetVotesModal(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">{isRTL ? 'איפוס הצבעות' : 'Reset Votes'}</span>
              </button>
              <button
                onClick={() => setShowSettingsModal(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">{isRTL ? 'הגדרות' : 'Settings'}</span>
              </button>
              <button
                onClick={refreshCandidates}
                disabled={loading}
                className="p-2 rounded-lg bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Title */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-1">
              <Vote className="w-6 h-6 text-accent" />
              <h1 className="text-2xl font-bold text-text-primary">
                {isRTL ? 'ניהול מועמדים' : 'Manage Candidates'}
              </h1>
            </div>
            {code?.title && (
              <p className="text-text-secondary">{code.title}</p>
            )}
          </div>

          {/* Stats Cards + QR Code */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Stats Grid */}
            <div className="flex-1 grid grid-cols-2 gap-3">
              <div className="bg-bg-secondary rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-text-secondary" />
                  <span className="text-text-secondary text-sm">{isRTL ? 'סה״כ' : 'Total'}</span>
                </div>
                <p className="text-2xl font-bold text-text-primary">
                  <AnimatedNumber value={candidates.length} />
                </p>
              </div>
              <div className="bg-bg-secondary rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-yellow-500" />
                  <span className="text-text-secondary text-sm">{isRTL ? 'ממתינים' : 'Pending'}</span>
                </div>
                <p className="text-2xl font-bold text-yellow-500">
                  <AnimatedNumber value={pendingCount} />
                </p>
              </div>
              <div className="bg-bg-secondary rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-text-secondary text-sm">{isRTL ? 'מאושרים' : 'Approved'}</span>
                </div>
                <p className="text-2xl font-bold text-green-500">
                  <AnimatedNumber value={approvedCount} />
                </p>
              </div>
              <button
                onClick={() => setShowVotersModal(true)}
                className="bg-bg-secondary rounded-xl p-4 hover:bg-bg-hover transition-colors cursor-pointer text-start w-full"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <span className="text-text-secondary text-sm">{isRTL ? 'קולות' : 'Votes'}</span>
                </div>
                <p className="text-2xl font-bold text-accent">
                  <AnimatedNumber value={totalVotes} />
                </p>
              </button>
            </div>

            {/* QR Code for Testing - Clickable */}
            {code?.shortId && (
              <a
                href={`/v/${code.shortId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-bg-secondary rounded-xl p-4 flex flex-col items-center justify-center gap-2 min-w-[140px] hover:bg-bg-tertiary transition-colors cursor-pointer group"
                title={isRTL ? 'לחצו לפתיחה בטאב חדש' : 'Click to open in new tab'}
              >
                <div className="bg-white rounded-lg p-2 group-hover:shadow-lg transition-shadow">
                  <QRCodeSVG
                    value={typeof window !== 'undefined' ? `${window.location.origin}/v/${code.shortId}` : `/v/${code.shortId}`}
                    size={96}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#000000"
                  />
                </div>
                <span className="text-xs text-text-secondary text-center group-hover:text-accent transition-colors">
                  {isRTL ? 'לחצו לבדיקה' : 'Click to test'}
                </span>
              </a>
            )}
          </div>

          {/* Phase Selector - Prominent with Scheduling */}
          {qvoteConfig && (
            <div className="mt-6">
              <p className="text-sm text-text-secondary font-medium mb-3">{isRTL ? 'שלב נוכחי' : 'Current Phase'}</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'registration', label: isRTL ? 'הרשמה' : 'Registration', color: 'bg-orange-500', borderColor: 'border-orange-500', hoverColor: 'hover:bg-orange-500/20' },
                  { key: 'preparation', label: isRTL ? 'מכינים' : 'Preparation', color: 'bg-red-500', borderColor: 'border-red-500', hoverColor: 'hover:bg-red-500/20' },
                  { key: 'voting', label: isRTL ? 'הצבעה' : 'Voting', color: 'bg-green-500', borderColor: 'border-green-500', hoverColor: 'hover:bg-green-500/20' },
                  ...(qvoteConfig.enableFinals ? [{ key: 'finals', label: isRTL ? 'גמר' : 'Finals', color: 'bg-purple-500', borderColor: 'border-purple-500', hoverColor: 'hover:bg-purple-500/20' }] : []),
                  { key: 'calculating', label: isRTL ? 'מחשבים תוצאות' : 'Calculating', color: 'bg-amber-500', borderColor: 'border-amber-500', hoverColor: 'hover:bg-amber-500/20' },
                  { key: 'results', label: isRTL ? 'תוצאות' : 'Results', color: 'bg-blue-500', borderColor: 'border-blue-500', hoverColor: 'hover:bg-blue-500/20' },
                ].map((phase) => {
                  const isActive = qvoteConfig.currentPhase === phase.key;
                  const scheduleTime = qvoteConfig.schedule?.[phase.key as keyof typeof qvoteConfig.schedule];
                  const isEditingSchedule = editingSchedulePhase === phase.key;

                  return (
                    <div key={phase.key} className="relative">
                      <button
                        onClick={async () => {
                          if (isActive) {
                            // If already active, toggle schedule editing
                            setEditingSchedulePhase(isEditingSchedule ? null : phase.key);
                          } else {
                            // Change phase
                            const newPhase = phase.key as 'registration' | 'preparation' | 'voting' | 'finals' | 'calculating' | 'results';
                            const newConfig = { ...qvoteConfig, currentPhase: newPhase };
                            try {
                              if (code?.media && qvoteMediaItem) {
                                const updatedMedia = code.media.map((m) =>
                                  m.id === qvoteMediaItem.id || m.type === 'qvote'
                                    ? { ...m, qvoteConfig: newConfig }
                                    : m
                                );
                                await updateDoc(doc(db, 'codes', codeId), { media: updatedMedia });
                                setQvoteConfig(newConfig);
                              }
                            } catch (error) {
                              console.error('Error updating phase:', error);
                            }
                          }
                        }}
                        className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all flex flex-col items-center gap-0.5 ${
                          isActive
                            ? `${phase.color} text-white shadow-lg`
                            : `bg-bg-secondary text-text-secondary ${phase.hoverColor} hover:text-text-primary`
                        }`}
                      >
                        <span>{phase.label}</span>
                        {scheduleTime && (() => {
                          const scheduleDate = new Date(scheduleTime);
                          const today = new Date();
                          const isToday = scheduleDate.toDateString() === today.toDateString();
                          const timeStr = scheduleDate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
                          const dateStr = scheduleDate.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });

                          return (
                            <span className={`text-[10px] ${isActive ? 'text-white/80' : 'text-text-secondary'}`}>
                              {isToday ? timeStr : `${dateStr} ${timeStr}`}
                            </span>
                          );
                        })()}
                      </button>

                      {/* Schedule Picker Dropdown */}
                      {isEditingSchedule && (
                        <div className="absolute top-full left-0 mt-2 p-3 bg-bg-card border border-border rounded-xl shadow-xl z-30 min-w-[200px]">
                          <p className="text-xs text-text-secondary mb-2 font-medium">
                            {isRTL ? 'תזמון להתחלת שלב' : 'Schedule phase start'}
                          </p>
                          <input
                            type="datetime-local"
                            value={scheduleTime ? new Date(scheduleTime).toISOString().slice(0, 16) : ''}
                            onChange={async (e) => {
                              const newSchedule = {
                                ...qvoteConfig.schedule,
                                [phase.key]: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                              };
                              const newConfig = { ...qvoteConfig, schedule: newSchedule };
                              try {
                                if (code?.media && qvoteMediaItem) {
                                  const updatedMedia = code.media.map((m) =>
                                    m.id === qvoteMediaItem.id || m.type === 'qvote'
                                      ? { ...m, qvoteConfig: newConfig }
                                      : m
                                  );
                                  await updateDoc(doc(db, 'codes', codeId), { media: updatedMedia });
                                  setQvoteConfig(newConfig);
                                }
                              } catch (error) {
                                console.error('Error updating schedule:', error);
                              }
                            }}
                            className="w-full px-3 py-2 rounded-lg bg-bg-secondary border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                          />
                          {scheduleTime && (
                            <button
                              onClick={async () => {
                                const newSchedule = { ...qvoteConfig.schedule };
                                delete newSchedule[phase.key as keyof typeof newSchedule];
                                const newConfig = { ...qvoteConfig, schedule: newSchedule };
                                try {
                                  if (code?.media && qvoteMediaItem) {
                                    const updatedMedia = code.media.map((m) =>
                                      m.id === qvoteMediaItem.id || m.type === 'qvote'
                                        ? { ...m, qvoteConfig: newConfig }
                                        : m
                                    );
                                    await updateDoc(doc(db, 'codes', codeId), { media: updatedMedia });
                                    setQvoteConfig(newConfig);
                                  }
                                } catch (error) {
                                  console.error('Error removing schedule:', error);
                                }
                              }}
                              className="mt-2 w-full px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 text-xs font-medium hover:bg-red-500/20 transition-colors"
                            >
                              {isRTL ? 'הסר תזמון' : 'Remove schedule'}
                            </button>
                          )}
                          <div className="flex gap-2 mt-2">
                            {/* View Results button - for results/calculating phases */}
                            {(phase.key === 'results' || phase.key === 'calculating') && code?.shortId && (
                              <a
                                href={`/v/${code.shortId}?operator=true`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors"
                                title={isRTL ? 'צפייה בתוצאות (מצב מנחה)' : 'View results (operator mode)'}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                {isRTL ? 'צפייה' : 'View'}
                              </a>
                            )}
                            <button
                              onClick={() => setEditingSchedulePhase(null)}
                              className="flex-1 px-3 py-1.5 rounded-lg bg-bg-secondary text-text-secondary text-xs font-medium hover:bg-bg-hover transition-colors"
                            >
                              {isRTL ? 'סגור' : 'Close'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-text-secondary mt-2">
                {isRTL ? 'לחצו על שלב לשינוי, לחצו שוב לתזמון' : 'Click phase to change, click again to schedule'}
              </p>
            </div>
          )}
        </div>
      </header>

      {/* Controls Bar */}
      <div className="sticky top-0 z-20 bg-bg-card/95 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary ${isRTL ? 'right-4' : 'left-4'}`} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(e.target.value.length > 0);
                }}
                onFocus={() => setShowSearchResults(searchQuery.length > 0)}
                onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                placeholder={isRTL ? 'חיפוש מועמדים...' : 'Search candidates...'}
                className={`w-full py-3 rounded-xl bg-bg-secondary border border-border text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'}`}
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setShowSearchResults(false);
                  }}
                  className={`absolute top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-bg-hover ${isRTL ? 'left-2' : 'right-2'}`}
                >
                  <X className="w-4 h-4 text-text-secondary" />
                </button>
              )}

              {/* Autocomplete */}
              {showSearchResults && searchSuggestions.length > 0 && (
                <div className="absolute z-30 top-full mt-2 w-full bg-bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                  {searchSuggestions.map((candidate) => (
                    <button
                      key={candidate.id}
                      onClick={() => {
                        setSearchQuery(candidate.name || candidate.formData?.name || '');
                        setShowSearchResults(false);
                      }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-bg-hover text-start transition-colors"
                    >
                      {candidate.photos[0] ? (
                        <img
                          src={candidate.photos[0].thumbnailUrl || candidate.photos[0].url}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-bg-secondary flex items-center justify-center">
                          <User className="w-5 h-5 text-text-secondary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-text-primary truncate">
                          {candidate.name || candidate.formData?.name || (isRTL ? 'ללא שם' : 'No name')}
                        </p>
                        {candidate.isApproved && (
                          <span className="text-xs text-green-500 font-medium">{isRTL ? 'מאושר' : 'Approved'}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* View Toggle & Filters */}
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex bg-bg-secondary rounded-xl p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-accent text-white shadow-md' : 'text-text-secondary hover:text-text-primary'}`}
                >
                  <Grid3X3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-accent text-white shadow-md' : 'text-text-secondary hover:text-text-primary'}`}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>

              {/* Filter Pills */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {[
                  { key: 'all', label: isRTL ? 'הכל' : 'All', count: candidates.length, color: 'accent' },
                  { key: 'pending', label: isRTL ? 'ממתינים' : 'Pending', count: pendingCount, color: 'yellow-500' },
                  { key: 'approved', label: isRTL ? 'מאושרים' : 'Approved', count: approvedCount, color: 'green-500' },
                  ...(qvoteConfig?.enableFinals ? [{ key: 'finalists', label: isRTL ? 'פינליסטים' : 'Finalists', count: finalistCount, color: 'purple-500' }] : []),
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key as typeof filter)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                      filter === f.key
                        ? `bg-${f.color} text-white shadow-md`
                        : 'bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                    }`}
                    style={filter === f.key ? { backgroundColor: f.color === 'accent' ? 'var(--accent)' : undefined } : undefined}
                  >
                    {f.label} ({f.count})
                  </button>
                ))}
              </div>

              {/* Category Filter */}
              {qvoteConfig?.categories && qvoteConfig.categories.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  <span className="text-xs text-text-secondary whitespace-nowrap">
                    {isRTL ? 'קטגוריה:' : 'Category:'}
                  </span>
                  <button
                    onClick={() => setCategoryFilter([])}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                      categoryFilter.length === 0
                        ? 'bg-purple-500 text-white shadow-sm'
                        : 'bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                    }`}
                  >
                    {isRTL ? 'הכל' : 'All'}
                  </button>
                  {qvoteConfig.categories.filter(c => c.isActive).map((category) => {
                    const isSelected = categoryFilter.includes(category.id);
                    const count = candidates.filter(c => {
                      const cats = c.categoryIds?.length ? c.categoryIds : (c.categoryId ? [c.categoryId] : []);
                      return cats.includes(category.id);
                    }).length;
                    return (
                      <button
                        key={category.id}
                        onClick={() => {
                          if (isSelected) {
                            setCategoryFilter(prev => prev.filter(id => id !== category.id));
                          } else {
                            setCategoryFilter(prev => [...prev, category.id]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-purple-500 text-white shadow-sm'
                            : 'bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                        }`}
                      >
                        {locale === 'en' && category.nameEn ? category.nameEn : category.name}
                        <span className={`text-[10px] ${isSelected ? 'text-white/70' : 'text-text-secondary'}`}>
                          ({count})
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedCandidates.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-3 p-3 bg-accent/10 rounded-xl border border-accent/20">
              <span className="text-sm font-medium text-accent">
                {isRTL ? `${selectedCandidates.length} נבחרו` : `${selectedCandidates.length} selected`}
              </span>
              <button
                onClick={handleBulkApprove}
                disabled={updating === 'bulk'}
                className="px-4 py-2 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {updating === 'bulk' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {isRTL ? 'אשר הכל' : 'Approve All'}
              </button>
              <button
                onClick={handleBulkUnapprove}
                disabled={updating === 'bulk'}
                className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {updating === 'bulk' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                {isRTL ? 'בטל אישור' : 'Unapprove'}
              </button>
              {/* Assign Category Button */}
              {qvoteConfig?.categories && qvoteConfig.categories.length > 0 && (
                <button
                  onClick={() => setShowCategoryAssignModal(true)}
                  className="px-4 py-2 rounded-lg bg-purple-500 text-white text-sm font-medium hover:bg-purple-600 transition-colors flex items-center gap-2"
                >
                  <Tags className="w-4 h-4" />
                  {isRTL ? 'שייך לקטגוריה' : 'Assign Category'}
                </button>
              )}
              {/* Delete Selected Button */}
              <button
                onClick={() => setShowBulkDeleteModal(true)}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {isRTL ? 'מחק נבחרים' : 'Delete Selected'}
              </button>
              <button
                onClick={() => setSelectedCandidates([])}
                className="px-4 py-2 rounded-lg bg-bg-secondary text-text-secondary text-sm font-medium hover:bg-bg-hover transition-colors"
              >
                {isRTL ? 'נקה בחירה' : 'Clear'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-4 pb-32">
        {/* Upload Zone Toggle */}
        <button
          onClick={() => setShowUploadZone(!showUploadZone)}
          className="w-full flex items-center justify-between px-4 py-3 bg-bg-card border border-border rounded-xl hover:bg-bg-hover transition-colors"
        >
          <div className="flex items-center gap-3">
            <Upload className="w-5 h-5 text-accent" />
            <span className="font-medium text-text-primary">
              {isRTL ? 'הוספת מועמדים' : 'Add Candidates'}
            </span>
          </div>
          {showUploadZone ? (
            <ChevronUp className="w-5 h-5 text-text-secondary" />
          ) : (
            <ChevronDown className="w-5 h-5 text-text-secondary" />
          )}
        </button>

        {/* Collapsible Upload Zone */}
        {showUploadZone && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-6 transition-all ${
              isDragging
                ? 'border-accent bg-accent/5'
                : 'border-border'
            }`}
          >
            {uploadingImages ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
                <p className="text-text-primary font-medium">
                  {isRTL
                    ? `מעלה ${uploadProgress.current} מתוך ${uploadProgress.total}...`
                    : `Uploading ${uploadProgress.current} of ${uploadProgress.total}...`}
                </p>
                <div className="w-full max-w-xs h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="text-center">
                  <p className="text-text-primary font-medium">
                    {isRTL ? 'גררו תמונות להוספת מועמדים' : 'Drag images to add candidates'}
                  </p>
                  <p className="text-text-secondary text-sm mt-1">
                    {isRTL ? 'כל תמונה תיצור מועמד חדש (יאושר אוטומטית)' : 'Each image creates a new candidate (auto-approved)'}
                  </p>
                </div>

                {/* Category selector for upload */}
                {qvoteConfig?.categories && qvoteConfig.categories.length > 0 && (
                  <div className="w-full max-w-sm">
                    <label className="block text-sm font-medium text-text-secondary mb-2 text-center">
                      <Tag className="w-4 h-4 inline-block me-1" />
                      {isRTL ? 'העלה לקטגוריה:' : 'Upload to category:'}
                    </label>
                    <select
                      value={uploadCategoryId}
                      onChange={(e) => setUploadCategoryId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-bg-secondary border border-border rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-accent text-center"
                    >
                      <option value="">{isRTL ? '-- ללא קטגוריה --' : '-- No category --'}</option>
                      {qvoteConfig.categories
                        .filter((c) => c.isActive)
                        .map((category) => (
                          <option key={category.id} value={category.id}>
                            {locale === 'en' && category.nameEn ? category.nameEn : category.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    onClick={() => bulkUploadRef.current?.click()}
                    className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-all text-sm font-medium flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    {isRTL ? 'בחרו תמונות' : 'Select Images'}
                  </button>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="px-4 py-2 bg-bg-secondary text-text-primary rounded-lg hover:bg-bg-hover transition-all text-sm font-medium flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    {isRTL ? 'הוספה ידנית' : 'Add Manually'}
                  </button>
                </div>
              </div>
            )}
            <input
              ref={bulkUploadRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleBulkFileSelect}
            />
          </div>
        )}

        {/* Candidates Display */}
        {filteredCandidates.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-2xl bg-bg-secondary flex items-center justify-center mx-auto mb-6">
              <User className="w-10 h-10 text-text-secondary" />
            </div>
            <p className="text-text-secondary text-lg">{isRTL ? 'אין מועמדים להצגה' : 'No candidates to display'}</p>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-2">
              <input
                type="checkbox"
                checked={selectedCandidates.length === filteredCandidates.length && filteredCandidates.length > 0}
                onChange={toggleSelectAll}
                className="w-5 h-5 rounded-lg border-border text-accent focus:ring-accent cursor-pointer"
              />
              <span className="text-sm text-text-secondary font-medium">
                {isRTL ? 'בחר הכל' : 'Select all'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredCandidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className={`group relative bg-bg-card rounded-2xl border overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1 ${
                    candidate.isHidden
                      ? 'opacity-50 border-border'
                      : candidate.isApproved
                      ? 'border-green-500/30 shadow-green-500/5'
                      : 'border-border'
                  }`}
                >
                  {/* Selection Checkbox */}
                  <div className="absolute top-3 left-3 z-10">
                    <input
                      type="checkbox"
                      checked={selectedCandidates.includes(candidate.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCandidates((prev) => [...prev, candidate.id]);
                        } else {
                          setSelectedCandidates((prev) => prev.filter((id) => id !== candidate.id));
                        }
                      }}
                      className="w-5 h-5 rounded-lg border-2 border-white/50 text-accent focus:ring-accent cursor-pointer bg-black/20 backdrop-blur-sm"
                    />
                  </div>

                  {/* Status Badge */}
                  <div className="absolute top-3 right-3 z-10">
                    {candidate.isApproved ? (
                      <span className="px-2.5 py-1 rounded-full bg-green-500 text-white text-xs font-bold shadow-lg">
                        {isRTL ? 'מאושר' : 'OK'}
                      </span>
                    ) : candidate.isHidden ? (
                      <span className="px-2.5 py-1 rounded-full bg-gray-500 text-white text-xs font-bold shadow-lg">
                        {isRTL ? 'מוסתר' : 'Hidden'}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-yellow-500 text-white text-xs font-bold shadow-lg animate-pulse">
                        {isRTL ? 'ממתין' : 'New'}
                      </span>
                    )}
                  </div>

                  {/* Photo - with drag-drop support */}
                  <div
                    onClick={() => startEditPhoto(candidate, 0)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCardDraggingId(candidate.id);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCardDraggingId(null);
                    }}
                    onDrop={(e) => handleCardPhotoDrop(e, candidate.id)}
                    className={`relative aspect-square w-full overflow-hidden cursor-pointer ${
                      cardDraggingId === candidate.id ? 'ring-4 ring-accent ring-inset' : ''
                    }`}
                  >
                    {updating === candidate.id && cardDraggingId === candidate.id ? (
                      <div className="w-full h-full bg-bg-secondary flex items-center justify-center">
                        <Loader2 className="w-10 h-10 animate-spin text-accent" />
                      </div>
                    ) : candidate.photos[0] ? (
                      <img
                        src={candidate.photos[0].thumbnailUrl || candidate.photos[0].url}
                        alt=""
                        className={`w-full h-full object-cover transition-all duration-300 ${
                          cardDraggingId === candidate.id ? 'opacity-50 scale-95' : 'group-hover:scale-105'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setZoomImageUrl(candidate.photos[0].url);
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-bg-secondary flex items-center justify-center">
                        <ImageIcon className="w-12 h-12 text-text-secondary" />
                      </div>
                    )}
                    {/* Drag overlay */}
                    {cardDraggingId === candidate.id && (
                      <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                        <div className="bg-accent text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2">
                          <Upload className="w-5 h-5 animate-bounce" />
                          {isRTL ? 'שחרר להחלפה' : 'Drop to replace'}
                        </div>
                      </div>
                    )}
                    {/* Hover overlay */}
                    {cardDraggingId !== candidate.id && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
                        <span className="text-white text-sm font-medium flex items-center gap-1">
                          <Edit3 className="w-4 h-4" />
                          {isRTL ? 'החלף תמונה' : 'Change'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    {/* Name with X to clear */}
                    <div className="flex items-center gap-1 mb-1">
                      {editingNameId === candidate.id ? (
                        <input
                          type="text"
                          value={editingNameValue}
                          onChange={(e) => setEditingNameValue(e.target.value)}
                          onBlur={saveEditingName}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditingName();
                            if (e.key === 'Escape') {
                              setEditingNameId(null);
                              setEditingNameValue('');
                            }
                          }}
                          autoFocus
                          className="font-semibold text-text-primary bg-transparent border-b border-accent outline-none flex-1 min-w-0"
                          placeholder={isRTL ? 'הזן שם...' : 'Enter name...'}
                        />
                      ) : (
                        <>
                          <p
                            onClick={() => startEditingName(candidate)}
                            className="font-semibold text-text-primary truncate flex-1 cursor-pointer hover:text-accent transition-colors"
                            title={isRTL ? 'לחץ לעריכה' : 'Click to edit'}
                          >
                            {getDisplayName(candidate) || (isRTL ? 'לחץ להוספת שם' : 'Click to add name')}
                          </p>
                          {getDisplayName(candidate) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleClearName(candidate.id); }}
                              className="p-0.5 rounded hover:bg-red-500/20 text-text-secondary hover:text-red-500 transition-colors shrink-0"
                              title={isRTL ? 'מחק שם' : 'Clear name'}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                      {candidate.isFinalist && (
                        <Trophy className="w-4 h-4 text-yellow-500 shrink-0" />
                      )}
                    </div>

                    {/* Form Data (Company, etc.) */}
                    {candidate.formData && Object.keys(candidate.formData).length > 0 && (
                      <div className="text-xs text-text-secondary mb-2 space-y-0.5">
                        {Object.entries(candidate.formData)
                          .filter(([key, value]) => key !== 'name' && value)
                          .slice(0, 2)
                          .map(([key, value]) => (
                            <p key={key} className="truncate">
                              {String(value)}
                            </p>
                          ))}
                      </div>
                    )}

                    {/* Category Tags */}
                    {qvoteConfig?.categories && qvoteConfig.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2 items-center relative">
                        {(candidate.categoryIds || (candidate.categoryId ? [candidate.categoryId] : [])).map((catId) => {
                          const category = qvoteConfig.categories.find((c) => c.id === catId);
                          if (!category) return null;
                          return (
                            <span
                              key={catId}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/20 text-accent text-xs font-medium group/tag"
                            >
                              <Tag className="w-3 h-3" />
                              {locale === 'en' && category.nameEn ? category.nameEn : category.name}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveCategoryFromCandidate(candidate.id, catId);
                                }}
                                className="opacity-0 group-hover/tag:opacity-100 hover:text-red-500 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          );
                        })}
                        {(candidate.categoryIds?.length === 0 || (!candidate.categoryIds && !candidate.categoryId)) && (
                          <span className="text-xs text-text-secondary italic">
                            {isRTL ? 'ללא קטגוריה' : 'No category'}
                          </span>
                        )}

                        {/* Add Category Button */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenCategoryPickerId(openCategoryPickerId === candidate.id ? null : candidate.id);
                            }}
                            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-bg-secondary hover:bg-accent/20 text-text-secondary hover:text-accent transition-colors"
                            title={isRTL ? 'הוסף קטגוריה' : 'Add category'}
                          >
                            <Plus className="w-3 h-3" />
                          </button>

                          {/* Category Picker Dropdown */}
                          {openCategoryPickerId === candidate.id && (
                            <div
                              className="absolute top-full mt-1 z-50 bg-bg-primary border border-border rounded-lg shadow-xl py-1 min-w-[140px]"
                              style={{ [isRTL ? 'right' : 'left']: 0 }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {qvoteConfig.categories
                                .filter((cat) => {
                                  const currentCats = candidate.categoryIds || (candidate.categoryId ? [candidate.categoryId] : []);
                                  return !currentCats.includes(cat.id);
                                })
                                .map((cat) => (
                                  <button
                                    key={cat.id}
                                    onClick={() => handleAddCategoryToCandidate(candidate.id, cat.id)}
                                    className="w-full px-3 py-2 text-start text-sm hover:bg-accent/10 flex items-center gap-2 transition-colors"
                                  >
                                    <Tag className="w-3 h-3 text-accent" />
                                    {locale === 'en' && cat.nameEn ? cat.nameEn : cat.name}
                                  </button>
                                ))}
                              {qvoteConfig.categories.filter((cat) => {
                                const currentCats = candidate.categoryIds || (candidate.categoryId ? [candidate.categoryId] : []);
                                return !currentCats.includes(cat.id);
                              }).length === 0 && (
                                <div className="px-3 py-2 text-xs text-text-secondary italic">
                                  {isRTL ? 'כל הקטגוריות נבחרו' : 'All categories assigned'}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-text-secondary">
                      <span>{candidate.voteCount || 0} {isRTL ? 'קולות' : 'votes'}</span>
                      <span>{new Date(candidate.createdAt).toLocaleDateString(locale)}</span>
                    </div>

                    {/* File size display */}
                    {candidate.photos?.[0]?.size && (
                      <div className="text-xs text-text-muted mt-1 text-center">
                        📦 {formatBytes(candidate.photos[0].size)}
                      </div>
                    )}

                    {/* Quick Actions: Approve (eye), Edit, Finalist, Delete (trash) */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                      {updating === candidate.id ? (
                        <Loader2 className="w-5 h-5 animate-spin text-accent mx-auto" />
                      ) : (
                        <>
                          {/* Approve/Reject toggle - eye open/closed */}
                          <button
                            onClick={() => handleApprove(candidate.id, !candidate.isApproved)}
                            className={`p-2 rounded-lg transition-colors ${
                              candidate.isApproved
                                ? 'bg-green-500/20 text-green-500'
                                : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                            }`}
                            title={candidate.isApproved ? (isRTL ? 'בטל אישור' : 'Unapprove') : (isRTL ? 'אשר' : 'Approve')}
                          >
                            {candidate.isApproved ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>

                          {/* Edit modal button */}
                          <button
                            onClick={() => setEditModalCandidate(candidate)}
                            className="p-2 rounded-lg bg-bg-secondary text-text-secondary hover:bg-accent/20 hover:text-accent transition-colors"
                            title={isRTL ? 'עריכה' : 'Edit'}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Finalist toggle */}
                          {qvoteConfig?.enableFinals && candidate.isApproved && (
                            <button
                              onClick={() => handleToggleFinalist(candidate.id, !candidate.isFinalist)}
                              className={`p-2 rounded-lg transition-colors ${
                                candidate.isFinalist
                                  ? 'bg-yellow-500/20 text-yellow-500'
                                  : 'bg-bg-secondary text-text-secondary hover:text-yellow-500'
                              }`}
                              title={isRTL ? 'פינליסט' : 'Finalist'}
                            >
                              <Trophy className="w-4 h-4" />
                            </button>
                          )}

                          {/* Delete - trash icon */}
                          <button
                            onClick={() => handleDelete(candidate.id)}
                            className="p-2 rounded-lg bg-bg-secondary text-text-secondary hover:bg-red-500/10 hover:text-red-500 transition-colors"
                            title={isRTL ? 'מחק' : 'Delete'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* List View */
          <div className="space-y-3">
            <div className="flex items-center gap-3 pb-2">
              <input
                type="checkbox"
                checked={selectedCandidates.length === filteredCandidates.length && filteredCandidates.length > 0}
                onChange={toggleSelectAll}
                className="w-5 h-5 rounded-lg border-border text-accent focus:ring-accent cursor-pointer"
              />
              <span className="text-sm text-text-secondary font-medium">
                {isRTL ? 'בחר הכל' : 'Select all'}
              </span>
            </div>

            {filteredCandidates.map((candidate) => (
              <div
                key={candidate.id}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all hover:shadow-lg ${
                  candidate.isHidden
                    ? 'bg-bg-secondary/50 border-border opacity-60'
                    : candidate.isApproved
                    ? 'bg-green-500/5 border-green-500/30'
                    : 'bg-bg-card border-border'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedCandidates.includes(candidate.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedCandidates((prev) => [...prev, candidate.id]);
                    } else {
                      setSelectedCandidates((prev) => prev.filter((id) => id !== candidate.id));
                    }
                  }}
                  className="w-5 h-5 rounded-lg border-border text-accent focus:ring-accent cursor-pointer shrink-0"
                />

                <div
                  onClick={() => startEditPhoto(candidate, 0)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCardDraggingId(candidate.id);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCardDraggingId(null);
                  }}
                  onDrop={(e) => handleCardPhotoDrop(e, candidate.id)}
                  className={`w-16 h-16 rounded-xl overflow-hidden bg-bg-hover shrink-0 relative group cursor-pointer transition-all ${
                    cardDraggingId === candidate.id ? 'ring-2 ring-accent scale-110' : ''
                  }`}
                >
                  {updating === candidate.id && cardDraggingId === candidate.id ? (
                    <div className="w-full h-full flex items-center justify-center bg-accent/10">
                      <Loader2 className="w-6 h-6 animate-spin text-accent" />
                    </div>
                  ) : candidate.photos[0] ? (
                    <>
                      <img
                        src={candidate.photos[0].thumbnailUrl || candidate.photos[0].url}
                        alt=""
                        className={`w-full h-full object-cover transition-opacity cursor-pointer ${
                          cardDraggingId === candidate.id ? 'opacity-50' : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setZoomImageUrl(candidate.photos[0].url);
                        }}
                      />
                      <div className={`absolute inset-0 bg-black/50 transition-opacity flex items-center justify-center pointer-events-none ${
                        cardDraggingId === candidate.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}>
                        {cardDraggingId === candidate.id ? (
                          <Upload className="w-5 h-5 text-white animate-bounce" />
                        ) : (
                          <Edit3 className="w-4 h-4 text-white" />
                        )}
                      </div>
                    </>
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${
                      cardDraggingId === candidate.id ? 'bg-accent/10' : ''
                    }`}>
                      {cardDraggingId === candidate.id ? (
                        <Upload className="w-5 h-5 text-accent animate-bounce" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-text-secondary" />
                      )}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    {editingNameId === candidate.id ? (
                      <input
                        type="text"
                        value={editingNameValue}
                        onChange={(e) => setEditingNameValue(e.target.value)}
                        onBlur={saveEditingName}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEditingName();
                          if (e.key === 'Escape') {
                            setEditingNameId(null);
                            setEditingNameValue('');
                          }
                        }}
                        autoFocus
                        className="font-semibold text-text-primary bg-transparent border-b border-accent outline-none flex-1 min-w-0"
                        placeholder={isRTL ? 'הזן שם...' : 'Enter name...'}
                      />
                    ) : (
                      <>
                        <p
                          onClick={() => startEditingName(candidate)}
                          className="font-semibold text-text-primary truncate cursor-pointer hover:text-accent transition-colors"
                          title={isRTL ? 'לחץ לעריכה' : 'Click to edit'}
                        >
                          {getDisplayName(candidate) || (isRTL ? 'לחץ להוספת שם' : 'Click to add name')}
                        </p>
                        {getDisplayName(candidate) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleClearName(candidate.id); }}
                            className="p-0.5 rounded hover:bg-red-500/20 text-text-secondary hover:text-red-500 transition-colors shrink-0"
                            title={isRTL ? 'מחק שם' : 'Clear name'}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                    {candidate.isFinalist && (
                      <Trophy className="w-4 h-4 text-yellow-500 shrink-0" />
                    )}
                  </div>
                  {/* Form Data (Company, etc.) */}
                  {candidate.formData && Object.entries(candidate.formData)
                    .filter(([key, value]) => key !== 'name' && value)
                    .slice(0, 2)
                    .map(([key, value]) => (
                      <p key={key} className="text-xs text-text-secondary truncate">
                        {String(value)}
                      </p>
                    ))}
                  <div className="flex items-center gap-4 mt-1 text-sm text-text-secondary">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(candidate.createdAt).toLocaleDateString(locale)}
                    </span>
                    {candidate.voteCount > 0 && (
                      <span className="font-medium">{candidate.voteCount} {isRTL ? 'קולות' : 'votes'}</span>
                    )}
                    {candidate.photos?.[0]?.size && (
                      <span className="text-text-muted">📦 {formatBytes(candidate.photos[0].size)}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {candidate.isApproved ? (
                    <span className="px-3 py-1.5 rounded-full bg-green-500/20 text-green-500 text-xs font-bold">
                      {isRTL ? 'מאושר' : 'Approved'}
                    </span>
                  ) : candidate.isHidden ? (
                    <span className="px-3 py-1.5 rounded-full bg-gray-500/20 text-gray-400 text-xs font-bold">
                      {isRTL ? 'מוסתר' : 'Hidden'}
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 rounded-full bg-yellow-500/20 text-yellow-500 text-xs font-bold">
                      {isRTL ? 'ממתין' : 'Pending'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {updating === candidate.id ? (
                    <Loader2 className="w-5 h-5 animate-spin text-accent" />
                  ) : (
                    <>
                      {/* Approve/Reject toggle - eye open/closed */}
                      <button
                        onClick={() => handleApprove(candidate.id, !candidate.isApproved)}
                        className={`p-2 rounded-lg transition-colors ${
                          candidate.isApproved
                            ? 'bg-green-500/20 text-green-500'
                            : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                        }`}
                        title={candidate.isApproved ? (isRTL ? 'בטל אישור' : 'Unapprove') : (isRTL ? 'אשר' : 'Approve')}
                      >
                        {candidate.isApproved ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>

                      {/* Edit modal button */}
                      <button
                        onClick={() => setEditModalCandidate(candidate)}
                        className="p-2 rounded-lg bg-bg-secondary text-text-secondary hover:bg-accent/20 hover:text-accent transition-colors"
                        title={isRTL ? 'עריכה' : 'Edit'}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {/* Finalist toggle */}
                      {qvoteConfig?.enableFinals && candidate.isApproved && (
                        <button
                          onClick={() => handleToggleFinalist(candidate.id, !candidate.isFinalist)}
                          className={`p-2 rounded-lg transition-colors ${
                            candidate.isFinalist
                              ? 'bg-yellow-500/20 text-yellow-500'
                              : 'bg-bg-secondary text-text-secondary hover:text-yellow-500'
                          }`}
                          title={isRTL ? 'פינליסט' : 'Finalist'}
                        >
                          <Trophy className="w-4 h-4" />
                        </button>
                      )}

                      {/* Delete - trash icon */}
                      <button
                        onClick={() => handleDelete(candidate.id)}
                        className="p-2 rounded-lg bg-bg-secondary text-text-secondary hover:bg-red-500/10 hover:text-red-500 transition-colors"
                        title={isRTL ? 'מחק' : 'Delete'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Danger Zone */}
        {candidates.length > 0 && (
          <div className="mt-12">
            <button
              onClick={() => setShowDangerZone(!showDangerZone)}
              className="flex items-center gap-2 text-sm text-text-secondary hover:text-red-500 transition-colors"
            >
              <AlertTriangle className="w-4 h-4" />
              {isRTL ? 'אזור סכנה' : 'Danger Zone'}
            </button>

            {showDangerZone && (
              <div className="mt-4 space-y-4">
                {/* Reset Votes */}
                <div className="p-6 rounded-2xl border-2 border-yellow-500/30 bg-yellow-500/5">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-yellow-500/10">
                      <RotateCcw className="w-6 h-6 text-yellow-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-yellow-600 mb-1">
                        {isRTL ? 'איפוס הצבעות' : 'Reset Votes'}
                      </h3>
                      <p className="text-sm text-text-secondary mb-4">
                        {isRTL
                          ? 'פעולה זו תמחק את כל ההצבעות אבל תשאיר את המועמדים. צופים יוכלו להצביע מחדש.'
                          : 'This will delete all votes but keep the candidates. Viewers can vote again.'}
                      </p>
                      <button
                        onClick={handleResetVotes}
                        disabled={resettingVotes}
                        className="px-6 py-3 rounded-xl bg-yellow-500 text-white font-medium hover:bg-yellow-600 disabled:opacity-50 transition-all flex items-center gap-2"
                      >
                        {resettingVotes ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-5 h-5" />
                        )}
                        {isRTL ? 'אפס הצבעות' : 'Reset Votes'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Delete All */}
                <div className="p-6 rounded-2xl border-2 border-red-500/30 bg-red-500/5">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-red-500/10">
                      <Trash2 className="w-6 h-6 text-red-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-red-500 mb-1">
                        {isRTL ? 'מחיקת כל המועמדים' : 'Delete All Candidates'}
                      </h3>
                      <p className="text-sm text-text-secondary mb-4">
                        {isRTL
                          ? 'פעולה זו תמחק את כל המועמדים וההצבעות לצמיתות. לא ניתן לבטל פעולה זו.'
                          : 'This will permanently delete all candidates and votes. This action cannot be undone.'}
                      </p>
                      <button
                        onClick={handleDeleteAll}
                        disabled={deletingAll}
                        className="px-6 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-50 transition-all flex items-center gap-2"
                      >
                        {deletingAll ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Trash2 className="w-5 h-5" />
                        )}
                        {isRTL ? 'מחק הכל' : 'Delete All'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Hidden Inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraCapture}
      />
      <input
        ref={editPhotoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleEditPhotoSelect}
      />

      {/* Manual Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={resetManualAdd} />

          <div className="relative bg-bg-card border border-border rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text-primary">
                  {isRTL ? 'הוספת מועמד' : 'Add Candidate'}
                </h2>
                <button
                  onClick={resetManualAdd}
                  className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  {isRTL ? 'שם המועמד' : 'Candidate Name'}
                </label>
                <input
                  type="text"
                  value={manualCandidateName}
                  onChange={(e) => setManualCandidateName(e.target.value)}
                  placeholder={isRTL ? 'הזינו שם...' : 'Enter name...'}
                  className="w-full px-3 py-2 rounded-lg bg-bg-secondary border border-border text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  {isRTL ? 'שם החברה' : 'Company Name'}
                </label>
                <input
                  type="text"
                  value={manualCompanyName}
                  onChange={(e) => setManualCompanyName(e.target.value)}
                  placeholder={isRTL ? 'הזינו שם חברה...' : 'Enter company name...'}
                  className="w-full px-3 py-2 rounded-lg bg-bg-secondary border border-border text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
                />
              </div>

              {/* Category Selection */}
              {qvoteConfig?.categories && qvoteConfig.categories.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">
                    {isRTL ? 'קטגוריות' : 'Categories'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {qvoteConfig.categories.map((category) => {
                      const isSelected = manualCategoryIds.includes(category.id);
                      return (
                        <button
                          key={category.id}
                          onClick={() => {
                            if (isSelected) {
                              setManualCategoryIds((prev) => prev.filter((id) => id !== category.id));
                            } else {
                              setManualCategoryIds((prev) => [...prev, category.id]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            isSelected
                              ? 'bg-accent text-white'
                              : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover'
                          }`}
                        >
                          {isRTL ? category.name : category.nameEn || category.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  {isRTL ? 'תמונות' : 'Photos'}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[0, 1].map((slot) => (
                    <button
                      key={slot}
                      onClick={() => openCameraForSlot(slot)}
                      className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-accent/50 overflow-hidden transition-all relative group bg-bg-secondary"
                    >
                      {manualPhotoPreviews[slot] ? (
                        <>
                          <img
                            src={manualPhotoPreviews[slot]}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Camera className="w-6 h-6 text-white" />
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-text-secondary">
                          <Camera className="w-8 h-8 mb-1" />
                          <span className="text-xs">
                            {isRTL ? `תמונה ${slot + 1}` : `Photo ${slot + 1}`}
                          </span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border flex gap-2">
              <button
                onClick={resetManualAdd}
                className="flex-1 py-2.5 rounded-lg bg-bg-secondary text-text-primary font-medium hover:bg-bg-hover transition-colors"
              >
                {isRTL ? 'ביטול' : 'Cancel'}
              </button>
              <button
                onClick={handleManualSubmit}
                disabled={manualPhotos.filter(Boolean).length === 0 || addingManually}
                className="flex-1 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {addingManually ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    {isRTL ? 'הוסף' : 'Add'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <QVoteModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          initialConfig={qvoteConfig || undefined}
          shortId={code?.shortId}
          onSave={async (config, landingImageFile?: File, logoFile?: File) => {
            try {
              let landingImageUrl: string | undefined;
              let logoUrl: string | undefined;

              // Upload landing image if provided
              if (landingImageFile && user) {
                const formData = new FormData();
                formData.append('file', landingImageFile);
                formData.append('userId', user.id);

                const uploadResponse = await fetch('/api/upload', {
                  method: 'POST',
                  body: formData,
                });

                if (uploadResponse.ok) {
                  const uploadData = await uploadResponse.json();
                  landingImageUrl = uploadData.url;
                }
              }

              // Upload logo if provided
              if (logoFile && user) {
                const logoFormData = new FormData();
                logoFormData.append('file', logoFile);
                logoFormData.append('userId', user.id);

                const logoUploadResponse = await fetch('/api/upload', {
                  method: 'POST',
                  body: logoFormData,
                });

                if (logoUploadResponse.ok) {
                  const logoUploadData = await logoUploadResponse.json();
                  logoUrl = logoUploadData.url;
                }
              }

              // Clean blob URLs from branding before saving to Firestore
              const cleanBranding = { ...config.branding };
              if (cleanBranding.logoUrl?.startsWith('blob:')) {
                delete cleanBranding.logoUrl;
                delete cleanBranding.logoName;
                delete cleanBranding.logoSize;
              }

              // Create updated config with uploaded files
              const updatedConfig = {
                ...config,
                branding: {
                  ...cleanBranding,
                  landingImage: landingImageUrl || cleanBranding.landingImage,
                  ...(landingImageFile && landingImageUrl ? {
                    landingImageName: landingImageFile.name,
                    landingImageSize: landingImageFile.size,
                  } : {}),
                  // Save logo URL from upload or preserve existing logo
                  ...(logoUrl || cleanBranding.logoUrl ? { logoUrl: logoUrl || cleanBranding.logoUrl } : {}),
                  // Save logo metadata (new upload or preserve existing)
                  ...(logoFile && logoUrl ? {
                    logoName: logoFile.name,
                    logoSize: logoFile.size,
                  } : cleanBranding.logoName && cleanBranding.logoSize ? {
                    logoName: cleanBranding.logoName,
                    logoSize: cleanBranding.logoSize,
                  } : {}),
                  // Preserve logo scale
                  ...(cleanBranding.logoScale !== undefined ? { logoScale: cleanBranding.logoScale } : {}),
                },
              };

              // Clean undefined values before saving to Firestore
              const cleanConfig = removeUndefined(updatedConfig as unknown as Record<string, unknown>);

              // Update the qvoteConfig in Firestore
              if (code?.media && qvoteMediaItem) {
                const updatedMedia = code.media.map((m) =>
                  m.id === qvoteMediaItem.id || m.type === 'qvote'
                    ? { ...m, qvoteConfig: cleanConfig }
                    : m
                );
                await updateDoc(doc(db, 'codes', codeId), { media: updatedMedia });
              }
              setQvoteConfig(cleanConfig as typeof updatedConfig);
              setShowSettingsModal(false);
            } catch (error) {
              console.error('Error saving QVote config:', error);
            }
          }}
        />
      )}

      {/* Voters Modal */}
      <QVoteVotersModal
        isOpen={showVotersModal}
        onClose={() => setShowVotersModal(false)}
        codeId={codeId}
        locale={locale}
      />

      {/* Reset Votes Confirmation Modal */}
      {showResetVotesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setShowResetVotesModal(false);
              setResetConfirmText('');
            }}
          />

          <div className="relative bg-bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-border bg-gradient-to-r from-red-500/10 to-transparent">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  {isRTL ? 'איפוס כל ההצבעות' : 'Reset All Votes'}
                </h2>
                <button
                  onClick={() => {
                    setShowResetVotesModal(false);
                    setResetConfirmText('');
                  }}
                  className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="text-text-secondary text-sm">
                {isRTL ? (
                  <>
                    <p className="mb-3">פעולה זו תאפס את כל ההצבעות:</p>
                    <ul className="list-disc list-inside space-y-1 mb-4">
                      <li>כל ההצבעות יימחקו</li>
                      <li>ספירת הקולות תאופס לאפס</li>
                      <li>הסטטיסטיקות יתאפסו</li>
                      <li>המשתתפים יוכלו להצביע מחדש</li>
                    </ul>
                    <p className="text-red-500 font-medium">פעולה זו אינה ניתנת לביטול!</p>
                  </>
                ) : (
                  <>
                    <p className="mb-3">This action will reset all votes:</p>
                    <ul className="list-disc list-inside space-y-1 mb-4">
                      <li>All votes will be deleted</li>
                      <li>Vote counts will be reset to zero</li>
                      <li>Statistics will be reset</li>
                      <li>Participants will be able to vote again</li>
                    </ul>
                    <p className="text-red-500 font-medium">This action cannot be undone!</p>
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  {isRTL
                    ? 'הקלד "מחיקה" לאישור:'
                    : 'Type "delete" to confirm:'}
                </label>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder={isRTL ? 'מחיקה' : 'delete'}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-bg-secondary text-text-primary placeholder-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  dir={isRTL ? 'rtl' : 'ltr'}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-bg-secondary flex gap-3">
              <button
                onClick={() => {
                  setShowResetVotesModal(false);
                  setResetConfirmText('');
                }}
                className="flex-1 px-4 py-3 rounded-xl border border-border bg-bg-card text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all font-medium"
              >
                {isRTL ? 'ביטול' : 'Cancel'}
              </button>
              <button
                onClick={async () => {
                  const confirmWord = isRTL ? 'מחיקה' : 'delete';
                  if (resetConfirmText.toLowerCase() !== confirmWord.toLowerCase()) {
                    return;
                  }

                  setResettingVotes(true);
                  try {
                    const result = await resetAllVotes(codeId);
                    console.log(`Reset ${result.deletedVotes} votes`);
                    await refreshCandidates();
                    setShowResetVotesModal(false);
                    setResetConfirmText('');
                  } catch (error) {
                    console.error('Error resetting votes:', error);
                  } finally {
                    setResettingVotes(false);
                  }
                }}
                disabled={
                  resettingVotes ||
                  resetConfirmText.toLowerCase() !== (isRTL ? 'מחיקה' : 'delete').toLowerCase()
                }
                className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {resettingVotes ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isRTL ? 'מאפס...' : 'Resetting...'}
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    {isRTL ? 'אפס הצבעות' : 'Reset Votes'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Assign Modal */}
      {showCategoryAssignModal && qvoteConfig?.categories && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCategoryAssignModal(false)}
          />

          <div className="relative bg-bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-border bg-gradient-to-r from-purple-500/10 to-transparent">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  <Tags className="w-5 h-5 text-purple-500" />
                  {isRTL ? 'שיוך לקטגוריות' : 'Assign to Categories'}
                </h2>
                <button
                  onClick={() => setShowCategoryAssignModal(false)}
                  className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-text-secondary text-sm">
                {isRTL
                  ? `בחר קטגוריות לשיוך ${selectedCandidates.length} מועמדים:`
                  : `Select categories to assign to ${selectedCandidates.length} candidates:`}
              </p>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {qvoteConfig.categories.filter((c) => c.isActive).map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleBulkCategoryAssign([category.id])}
                    disabled={assigningCategories}
                    className="w-full p-4 rounded-xl border border-border bg-bg-secondary hover:bg-bg-hover hover:border-purple-500/50 transition-all text-start flex items-center gap-3 disabled:opacity-50"
                  >
                    {assigningCategories ? (
                      <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                    ) : (
                      <Tag className="w-5 h-5 text-purple-500" />
                    )}
                    <span className="font-medium text-text-primary">
                      {locale === 'en' && category.nameEn ? category.nameEn : category.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-bg-secondary">
              <button
                onClick={() => setShowCategoryAssignModal(false)}
                className="w-full px-4 py-3 rounded-xl border border-border bg-bg-card text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all font-medium"
              >
                {isRTL ? 'ביטול' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setShowBulkDeleteModal(false);
              setBulkDeleteConfirmText('');
            }}
          />

          <div className="relative bg-bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-border bg-gradient-to-r from-red-500/10 to-transparent">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  {isRTL ? 'אישור מחיקה' : 'Confirm Deletion'}
                </h2>
                <button
                  onClick={() => {
                    setShowBulkDeleteModal(false);
                    setBulkDeleteConfirmText('');
                  }}
                  className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-text-primary font-medium">
                  {isRTL
                    ? `האם אתה בטוח שברצונך למחוק ${selectedCandidates.length} מועמדים?`
                    : `Are you sure you want to delete ${selectedCandidates.length} candidates?`}
                </p>
                <p className="text-text-secondary text-sm mt-2">
                  {isRTL
                    ? 'פעולה זו תמחק את כל התמונות והנתונים של המועמדים הנבחרים ולא ניתן לשחזר אותם.'
                    : 'This will permanently delete all photos and data for the selected candidates. This cannot be undone.'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {isRTL
                    ? 'הקלד "מחיקה" לאישור:'
                    : 'Type "delete" to confirm:'}
                </label>
                <input
                  type="text"
                  value={bulkDeleteConfirmText}
                  onChange={(e) => setBulkDeleteConfirmText(e.target.value)}
                  placeholder={isRTL ? 'מחיקה' : 'delete'}
                  className="w-full px-4 py-3 rounded-xl bg-bg-secondary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50"
                  dir={isRTL ? 'rtl' : 'ltr'}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-bg-secondary flex gap-3">
              <button
                onClick={() => {
                  setShowBulkDeleteModal(false);
                  setBulkDeleteConfirmText('');
                }}
                className="flex-1 px-4 py-3 rounded-xl border border-border bg-bg-card text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all font-medium"
              >
                {isRTL ? 'ביטול' : 'Cancel'}
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={
                  (isRTL ? bulkDeleteConfirmText !== 'מחיקה' : bulkDeleteConfirmText.toLowerCase() !== 'delete') ||
                  deletingBulk
                }
                className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {deletingBulk ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isRTL ? 'מוחק...' : 'Deleting...'}
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    {isRTL ? 'מחק לצמיתות' : 'Delete Permanently'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Edit Modal */}
      {editModalCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditModalCandidate(null)} />

          <div className="relative bg-bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-border bg-gradient-to-r from-accent/10 to-transparent">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-accent" />
                  {isRTL ? 'עריכת מועמד' : 'Edit Candidate'}
                </h2>
                <button
                  onClick={() => setEditModalCandidate(null)}
                  className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Photos Preview (Boomerang style) - with drag-drop */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {isRTL ? 'תמונות' : 'Photos'}
                  <span className="text-xs text-text-secondary/60 ms-2">
                    {isRTL ? '(גררו קובץ להחלפה)' : '(drag file to replace)'}
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[0, 1].map((index) => {
                    const photo = editModalCandidate.photos[index];
                    const isDraggingHere = editModalDraggingSlot === index;
                    return (
                      <div
                        key={index}
                        onClick={() => startEditPhoto(editModalCandidate, index)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditModalDraggingSlot(index);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditModalDraggingSlot(null);
                        }}
                        onDrop={(e) => handleEditModalSlotDrop(e, index)}
                        className={`aspect-square rounded-xl border-2 border-dashed overflow-hidden transition-all relative group bg-bg-secondary cursor-pointer ${
                          isDraggingHere
                            ? 'border-accent bg-accent/10 scale-105'
                            : 'border-border hover:border-accent/50'
                        }`}
                      >
                        {updating === editModalCandidate.id && isDraggingHere ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-accent" />
                          </div>
                        ) : photo ? (
                          <>
                            <img
                              src={photo.thumbnailUrl || photo.url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                            <div className={`absolute inset-0 bg-black/50 transition-opacity flex items-center justify-center ${
                              isDraggingHere ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}>
                              {isDraggingHere ? (
                                <Upload className="w-8 h-8 text-white animate-bounce" />
                              ) : (
                                <Camera className="w-6 h-6 text-white" />
                              )}
                            </div>
                            <div className="absolute bottom-2 start-2 flex flex-col gap-0.5">
                              <span className="px-2 py-1 rounded-md bg-black/60 text-white text-xs font-medium">
                                {isRTL ? `תמונה ${index + 1}` : `Photo ${index + 1}`}
                              </span>
                              {photo.size && (
                                <span className="px-2 py-0.5 rounded-md bg-black/60 text-white/80 text-[10px]">
                                  {(photo.size / 1024).toFixed(0)} KB
                                </span>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className={`w-full h-full flex flex-col items-center justify-center ${
                            isDraggingHere ? 'text-accent' : 'text-text-secondary'
                          }`}>
                            {isDraggingHere ? (
                              <Upload className="w-8 h-8 mb-1 animate-bounce" />
                            ) : (
                              <Camera className="w-8 h-8 mb-1" />
                            )}
                            <span className="text-xs">
                              {isDraggingHere
                                ? (isRTL ? 'שחרר כאן' : 'Drop here')
                                : (isRTL ? `תמונה ${index + 1}` : `Photo ${index + 1}`)
                              }
                            </span>
                            {index === 1 && !isDraggingHere && (
                              <span className="text-[10px] text-accent mt-1">
                                {isRTL ? 'לאפקט בומרנג' : 'For boomerang'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {editModalCandidate.photos.length === 2 && (
                  <p className="text-xs text-accent mt-2 text-center">
                    {isRTL ? '2 תמונות = אפקט בומרנג אוטומטי' : '2 photos = automatic boomerang effect'}
                  </p>
                )}
              </div>

              {/* Name Field */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  {isRTL ? 'שם' : 'Name'}
                </label>
                <input
                  type="text"
                  value={editModalCandidate.name || ''}
                  onChange={(e) => setEditModalCandidate({ ...editModalCandidate, name: e.target.value })}
                  placeholder={isRTL ? 'הזינו שם...' : 'Enter name...'}
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-secondary border border-border text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                />
              </div>

              {/* Form Data Fields */}
              {qvoteConfig?.formFields && qvoteConfig.formFields.length > 0 && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-text-secondary">
                    {isRTL ? 'שדות נוספים' : 'Additional Fields'}
                  </label>
                  {qvoteConfig.formFields
                    .filter((field) => field.id !== 'name')
                    .map((field) => (
                      <div key={field.id}>
                        <label className="block text-xs text-text-secondary mb-1">
                          {isRTL ? field.label : (field.labelEn || field.label)}
                        </label>
                        <input
                          type={field.id.includes('email') ? 'email' : field.id.includes('phone') ? 'tel' : 'text'}
                          value={(editModalCandidate.formData?.[field.id] as string) || ''}
                          onChange={(e) =>
                            setEditModalCandidate({
                              ...editModalCandidate,
                              formData: { ...editModalCandidate.formData, [field.id]: e.target.value },
                            })
                          }
                          placeholder={isRTL ? (field.placeholder || '') : (field.placeholderEn || field.placeholder || '')}
                          className="w-full px-3 py-2 rounded-lg bg-bg-secondary border border-border text-text-primary text-sm placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
                        />
                      </div>
                    ))}
                </div>
              )}

              {/* Registration Info (Read-only) */}
              <div className="p-3 rounded-xl bg-bg-secondary/50 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-text-secondary" />
                  <span className="text-sm font-medium text-text-secondary">
                    {isRTL ? 'פרטי הרשמה' : 'Registration Info'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-text-secondary text-xs">{isRTL ? 'תאריך' : 'Date'}</span>
                    <p className="text-text-primary font-medium">
                      {new Date(editModalCandidate.createdAt).toLocaleDateString(locale)}
                    </p>
                  </div>
                  <div>
                    <span className="text-text-secondary text-xs">{isRTL ? 'שעה' : 'Time'}</span>
                    <p className="text-text-primary font-medium">
                      {new Date(editModalCandidate.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div>
                    <span className="text-text-secondary text-xs">{isRTL ? 'קולות' : 'Votes'}</span>
                    <p className="text-text-primary font-medium">{editModalCandidate.voteCount || 0}</p>
                  </div>
                  <div>
                    <span className="text-text-secondary text-xs">{isRTL ? 'מקור' : 'Source'}</span>
                    <p className="text-text-primary font-medium capitalize">{editModalCandidate.source}</p>
                  </div>
                </div>
              </div>

              {/* Status Toggles */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => setEditModalCandidate({ ...editModalCandidate, isApproved: !editModalCandidate.isApproved })}
                  className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all ${
                    editModalCandidate.isApproved
                      ? 'bg-green-500/20 text-green-500 border border-green-500/30'
                      : 'bg-bg-secondary text-text-secondary border border-border hover:border-green-500/30'
                  }`}
                >
                  {editModalCandidate.isApproved ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {editModalCandidate.isApproved ? (isRTL ? 'מאושר' : 'Approved') : (isRTL ? 'לא מאושר' : 'Not Approved')}
                </button>

                {qvoteConfig?.enableFinals && (
                  <button
                    onClick={() => setEditModalCandidate({ ...editModalCandidate, isFinalist: !editModalCandidate.isFinalist })}
                    className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all ${
                      editModalCandidate.isFinalist
                        ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30'
                        : 'bg-bg-secondary text-text-secondary border border-border hover:border-yellow-500/30'
                    }`}
                  >
                    <Trophy className="w-4 h-4" />
                    {editModalCandidate.isFinalist ? (isRTL ? 'פינליסט' : 'Finalist') : (isRTL ? 'לא פינליסט' : 'Not Finalist')}
                  </button>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-bg-secondary/30 flex gap-2">
              <button
                onClick={() => setEditModalCandidate(null)}
                className="flex-1 py-2.5 rounded-xl bg-bg-secondary text-text-primary font-medium hover:bg-bg-hover transition-colors"
              >
                {isRTL ? 'ביטול' : 'Cancel'}
              </button>
              <button
                onClick={async () => {
                  setUpdating(editModalCandidate.id);
                  try {
                    await updateCandidate(codeId, editModalCandidate.id, {
                      name: editModalCandidate.name,
                      formData: editModalCandidate.formData,
                      isApproved: editModalCandidate.isApproved,
                      isFinalist: editModalCandidate.isFinalist,
                    });
                    setCandidates((prev) =>
                      prev.map((c) =>
                        c.id === editModalCandidate.id
                          ? {
                              ...c,
                              name: editModalCandidate.name,
                              formData: editModalCandidate.formData,
                              isApproved: editModalCandidate.isApproved,
                              isFinalist: editModalCandidate.isFinalist,
                            }
                          : c
                      )
                    );
                    setEditModalCandidate(null);
                  } catch (error) {
                    console.error('Error updating candidate:', error);
                  } finally {
                    setUpdating(null);
                  }
                }}
                disabled={updating === editModalCandidate.id}
                className="flex-1 py-2.5 rounded-xl bg-accent text-white font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {updating === editModalCandidate.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {isRTL ? 'שמור' : 'Save'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal - supports pinch to zoom on mobile */}
      {zoomImageUrl && (
        <ImageZoomModal
          imageUrl={zoomImageUrl}
          onClose={() => setZoomImageUrl(null)}
        />
      )}
    </div>
  );
}
