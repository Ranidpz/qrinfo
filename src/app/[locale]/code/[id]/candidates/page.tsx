'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCandidates, updateCandidate, deleteCandidate, batchUpdateCandidateStatus, createCandidate } from '@/lib/qvote';
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
} from 'lucide-react';

export default function QVoteCandidatesPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const codeId = params.id as string;
  const locale = (params.locale as string) || 'he';
  const isRTL = locale === 'he';

  const [code, setCode] = useState<{ title?: string; shortId?: string; ownerId?: string } | null>(null);
  const [qvoteConfig, setQvoteConfig] = useState<QVoteConfig | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'finalists'>('all');
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Bulk upload state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const bulkUploadRef = useRef<HTMLInputElement>(null);

  // Manual add state (boomerang - 2 photos)
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualPhotos, setManualPhotos] = useState<File[]>([]);
  const [manualPhotoPreviews, setManualPhotoPreviews] = useState<string[]>([]);
  const [manualCandidateName, setManualCandidateName] = useState('');
  const [addingManually, setAddingManually] = useState(false);
  const [currentPhotoSlot, setCurrentPhotoSlot] = useState<number>(0);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Edit photo state
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [editPhotoIndex, setEditPhotoIndex] = useState<number>(0);
  const editPhotoInputRef = useRef<HTMLInputElement>(null);

  // Load code and candidates
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Load code document
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
        });

        // Find Q.Vote config
        const qvoteMedia = codeData.media?.find((m: { type: string }) => m.type === 'qvote');
        if (qvoteMedia?.qvoteConfig) {
          setQvoteConfig(qvoteMedia.qvoteConfig);
        }

        // Load candidates
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
      loadData();
    }
  }, [codeId, isRTL]);

  // Check authorization
  const isAuthorized = user && code && (code.ownerId === user.id || user.role === 'super_admin');

  // Search helper - get searchable text from candidate
  const getCandidateSearchText = useCallback((candidate: Candidate): string => {
    const parts = [
      candidate.name || '',
      ...Object.values(candidate.formData || {}).map(v => String(v)),
    ];
    return parts.join(' ').toLowerCase();
  }, []);

  // Get search suggestions (autocomplete)
  const searchSuggestions = searchQuery.length > 0
    ? candidates
        .filter((c) => getCandidateSearchText(c).includes(searchQuery.toLowerCase()))
        .slice(0, 5)
    : [];

  // Filter candidates (by filter type and search query)
  const filteredCandidates = candidates.filter((c) => {
    // First apply filter
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

    // Then apply search
    if (!passesFilter) return false;
    if (!searchQuery) return true;
    return getCandidateSearchText(c).includes(searchQuery.toLowerCase());
  });

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

  // Bulk actions
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

  // Bulk upload handlers
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
    // Reset input
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
        // Upload image
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);
        formDataUpload.append('codeId', codeId);

        const response = await fetch('/api/qvote/upload', {
          method: 'POST',
          body: formDataUpload,
        });

        if (!response.ok) {
          console.error(`Failed to upload ${file.name}`);
          continue;
        }

        const data = await response.json();

        // Create candidate with this image
        const candidateName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        const candidate = await createCandidate(codeId, {
          source: 'producer',
          name: candidateName,
          formData: { name: candidateName },
          photos: [
            {
              id: data.id,
              url: data.url,
              thumbnailUrl: data.thumbnailUrl || data.url,
              order: 0,
              uploadedAt: new Date(),
            },
          ],
          isApproved: true, // Producer-uploaded candidates are auto-approved
          isFinalist: false,
          isHidden: false,
          displayOrder: candidates.length + i,
        });

        newCandidates.push(candidate);
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
      }
    }

    // Add new candidates to list
    if (newCandidates.length > 0) {
      setCandidates((prev) => [...prev, ...newCandidates]);
    }

    setUploadingImages(false);
    setUploadProgress({ current: 0, total: 0 });
  };

  // Manual add handlers
  const openCameraForSlot = (slot: number) => {
    setCurrentPhotoSlot(slot);
    cameraInputRef.current?.click();
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      const preview = event.target?.result as string;

      // Update the specific slot
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

    // Reset input
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  const resetManualAdd = () => {
    setShowAddModal(false);
    setManualPhotos([]);
    setManualPhotoPreviews([]);
    setManualCandidateName('');
    setCurrentPhotoSlot(0);
  };

  const handleManualSubmit = async () => {
    if (manualPhotos.length === 0) return;
    if (addingManually) return;

    setAddingManually(true);
    try {
      // Upload all photos
      const uploadedPhotos = [];
      for (let i = 0; i < manualPhotos.length; i++) {
        const file = manualPhotos[i];
        if (!file) continue;

        const formDataUpload = new FormData();
        formDataUpload.append('file', file);
        formDataUpload.append('codeId', codeId);

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
        });
      }

      if (uploadedPhotos.length === 0) {
        throw new Error('No photos uploaded');
      }

      // Create candidate
      const candidateName = manualCandidateName || (isRTL ? 'מועמד חדש' : 'New Candidate');
      const candidate = await createCandidate(codeId, {
        source: 'producer',
        name: candidateName,
        formData: { name: candidateName },
        photos: uploadedPhotos,
        isApproved: true,
        isFinalist: false,
        isHidden: false,
        displayOrder: candidates.length,
      });

      setCandidates((prev) => [...prev, candidate]);
      resetManualAdd();
    } catch (error) {
      console.error('Error adding candidate manually:', error);
    } finally {
      setAddingManually(false);
    }
  };

  // Edit photo handlers
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
      // Upload new photo
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('codeId', codeId);

      const response = await fetch('/api/qvote/upload', {
        method: 'POST',
        body: formDataUpload,
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();

      // Update candidate's photos array
      const newPhotos = [...editingCandidate.photos];
      newPhotos[editPhotoIndex] = {
        id: data.id,
        url: data.url,
        thumbnailUrl: data.thumbnailUrl || data.url,
        order: editPhotoIndex,
        uploadedAt: new Date(),
      };

      await updateCandidate(codeId, editingCandidate.id, { photos: newPhotos });

      // Update local state
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

  // Stats
  const pendingCount = candidates.filter((c) => !c.isApproved && !c.isHidden).length;
  const approvedCount = candidates.filter((c) => c.isApproved).length;
  const finalistCount = candidates.filter((c) => c.isFinalist).length;

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center" dir={isRTL ? 'rtl' : 'ltr'}>
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="text-center">
          <p className="text-danger mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="btn bg-accent text-white hover:bg-accent-hover"
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
        <div className="text-center">
          <p className="text-text-secondary mb-4">
            {isRTL ? 'אין לך הרשאה לצפות בדף זה' : 'You do not have permission to view this page'}
          </p>
          <button
            onClick={() => router.push(`/${locale}/login`)}
            className="btn bg-accent text-white hover:bg-accent-hover"
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
      <header className="bg-bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(`/${locale}/code/${codeId}`)}
                className="p-2 rounded-lg hover:bg-bg-secondary text-text-secondary"
              >
                <ArrowRight className={`w-5 h-5 ${isRTL ? '' : 'rotate-180'}`} />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <Vote className="w-5 h-5 text-accent" />
                  <h1 className="text-lg font-semibold text-text-primary">
                    {isRTL ? 'ניהול מועמדים' : 'Manage Candidates'}
                  </h1>
                </div>
                {code?.title && (
                  <p className="text-sm text-text-secondary">{code.title}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {code?.shortId && (
                <a
                  href={`/v/${code.shortId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn bg-bg-secondary text-text-primary hover:bg-bg-hover text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  {isRTL ? 'צפה בדף' : 'View page'}
                </a>
              )}
              <button
                onClick={refreshCandidates}
                disabled={loading}
                className="p-2 rounded-lg hover:bg-bg-secondary text-text-secondary"
                title={isRTL ? 'רענן' : 'Refresh'}
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Search & Filters */}
      <div className="bg-bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 space-y-3">
          {/* Search with autocomplete */}
          <div className="relative">
            <div className="relative">
              <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary ${isRTL ? 'right-3' : 'left-3'}`} />
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
                className={`w-full py-2 rounded-lg bg-bg-secondary border border-border text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/50 ${isRTL ? 'pr-10 pl-3' : 'pl-10 pr-3'}`}
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setShowSearchResults(false);
                  }}
                  className={`absolute top-1/2 -translate-y-1/2 p-1 rounded hover:bg-bg-hover ${isRTL ? 'left-2' : 'right-2'}`}
                >
                  <X className="w-4 h-4 text-text-secondary" />
                </button>
              )}
            </div>

            {/* Autocomplete suggestions */}
            {showSearchResults && searchSuggestions.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full bg-bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                {searchSuggestions.map((candidate) => (
                  <button
                    key={candidate.id}
                    onClick={() => {
                      setSearchQuery(candidate.name || candidate.formData?.name || '');
                      setShowSearchResults(false);
                    }}
                    className="w-full flex items-center gap-3 p-2 hover:bg-bg-hover text-start"
                  >
                    {candidate.photos[0] ? (
                      <img
                        src={candidate.photos[0].thumbnailUrl || candidate.photos[0].url}
                        alt=""
                        className="w-8 h-8 rounded object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded bg-bg-secondary flex items-center justify-center">
                        <User className="w-4 h-4 text-text-secondary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {candidate.name || candidate.formData?.name || (isRTL ? 'ללא שם' : 'No name')}
                      </p>
                      {candidate.isApproved && (
                        <span className="text-xs text-green-500">{isRTL ? 'מאושר' : 'Approved'}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Filter tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-accent text-white'
                    : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                }`}
              >
                {isRTL ? 'הכל' : 'All'} ({candidates.length})
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'pending'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                }`}
              >
                {isRTL ? 'ממתינים' : 'Pending'} ({pendingCount})
              </button>
              <button
                onClick={() => setFilter('approved')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'approved'
                    ? 'bg-green-500 text-white'
                    : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                }`}
              >
                {isRTL ? 'מאושרים' : 'Approved'} ({approvedCount})
              </button>
              {qvoteConfig?.enableFinals && (
                <button
                  onClick={() => setFilter('finalists')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filter === 'finalists'
                      ? 'bg-purple-500 text-white'
                      : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {isRTL ? 'פינליסטים' : 'Finalists'} ({finalistCount})
                </button>
              )}
            </div>

            {/* Bulk actions */}
            {selectedCandidates.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-secondary">
                  {isRTL ? `${selectedCandidates.length} נבחרו` : `${selectedCandidates.length} selected`}
                </span>
                <button
                  onClick={handleBulkApprove}
                  disabled={updating === 'bulk'}
                  className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50"
                >
                  {updating === 'bulk' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    isRTL ? 'אשר הכל' : 'Approve All'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Bulk Upload Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-xl p-6 transition-all ${
            isDragging
              ? 'border-accent bg-accent/10'
              : 'border-border hover:border-accent/50 hover:bg-bg-hover/50'
          }`}
        >
          {uploadingImages ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
              <p className="text-sm text-text-secondary">
                {isRTL
                  ? `מעלה ${uploadProgress.current} מתוך ${uploadProgress.total}...`
                  : `Uploading ${uploadProgress.current} of ${uploadProgress.total}...`}
              </p>
              <div className="w-full max-w-xs h-2 bg-bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                <Upload className="w-6 h-6 text-accent" />
              </div>
              <div className="text-center">
                <p className="text-text-primary font-medium">
                  {isRTL ? 'גררו תמונות להוספת מועמדים' : 'Drag images to add candidates'}
                </p>
                <p className="text-sm text-text-secondary mt-1">
                  {isRTL
                    ? 'כל תמונה תיצור מועמד חדש (יאושר אוטומטית)'
                    : 'Each image will create a new candidate (auto-approved)'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => bulkUploadRef.current?.click()}
                  className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {isRTL ? 'בחרו תמונות' : 'Select images'}
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
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

        {filteredCandidates.length === 0 ? (
          <div className="text-center py-12 text-text-secondary">
            <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{isRTL ? 'אין מועמדים להצגה' : 'No candidates to display'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Select all */}
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <input
                type="checkbox"
                checked={selectedCandidates.length === filteredCandidates.length && filteredCandidates.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
              />
              <span className="text-sm text-text-secondary">
                {isRTL ? 'בחר הכל' : 'Select all'}
              </span>
            </div>

            {/* Candidates list */}
            {filteredCandidates.map((candidate) => (
              <div
                key={candidate.id}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                  candidate.isHidden
                    ? 'bg-bg-secondary/50 border-border opacity-60'
                    : candidate.isApproved
                    ? 'bg-green-500/5 border-green-500/30'
                    : 'bg-bg-card border-border'
                }`}
              >
                {/* Checkbox */}
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
                  className="w-4 h-4 rounded border-border text-accent focus:ring-accent shrink-0"
                />

                {/* Photo - Click to edit */}
                <button
                  onClick={() => startEditPhoto(candidate, 0)}
                  className="w-16 h-16 rounded-lg overflow-hidden bg-bg-hover shrink-0 relative group"
                  title={isRTL ? 'לחץ להחלפת תמונה' : 'Click to replace photo'}
                >
                  {candidate.photos[0] ? (
                    <>
                      <img
                        src={candidate.photos[0].thumbnailUrl || candidate.photos[0].url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Edit3 className="w-4 h-4 text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-text-secondary" />
                    </div>
                  )}
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-text-primary truncate">
                      {candidate.name || candidate.formData?.name || (isRTL ? 'ללא שם' : 'No name')}
                    </p>
                    {candidate.isFinalist && (
                      <Trophy className="w-4 h-4 text-yellow-500 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(candidate.createdAt).toLocaleDateString(locale)}
                    </span>
                    {candidate.voteCount > 0 && (
                      <span>{candidate.voteCount} {isRTL ? 'קולות' : 'votes'}</span>
                    )}
                  </div>
                  {/* Form data */}
                  {Object.entries(candidate.formData || {}).slice(0, 2).map(([key, value]) => (
                    <p key={key} className="text-xs text-text-secondary truncate mt-0.5">
                      {value}
                    </p>
                  ))}
                </div>

                {/* Status badges */}
                <div className="flex items-center gap-2 shrink-0">
                  {candidate.isApproved ? (
                    <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-500 text-xs font-medium">
                      {isRTL ? 'מאושר' : 'Approved'}
                    </span>
                  ) : candidate.isHidden ? (
                    <span className="px-2 py-1 rounded-full bg-gray-500/20 text-gray-400 text-xs font-medium">
                      {isRTL ? 'מוסתר' : 'Hidden'}
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-500 text-xs font-medium">
                      {isRTL ? 'ממתין' : 'Pending'}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {updating === candidate.id ? (
                    <Loader2 className="w-5 h-5 animate-spin text-accent" />
                  ) : (
                    <>
                      {/* Approve/Reject */}
                      {!candidate.isApproved ? (
                        <button
                          onClick={() => handleApprove(candidate.id, true)}
                          className="p-2 rounded-lg hover:bg-green-500/20 text-green-500 transition-colors"
                          title={isRTL ? 'אשר' : 'Approve'}
                        >
                          <Check className="w-5 h-5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleApprove(candidate.id, false)}
                          className="p-2 rounded-lg hover:bg-red-500/20 text-red-500 transition-colors"
                          title={isRTL ? 'בטל אישור' : 'Unapprove'}
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      )}

                      {/* Toggle visibility */}
                      <button
                        onClick={() => handleToggleHidden(candidate.id, !candidate.isHidden)}
                        className={`p-2 rounded-lg transition-colors ${
                          candidate.isHidden
                            ? 'hover:bg-accent/20 text-accent'
                            : 'hover:bg-bg-hover text-text-secondary'
                        }`}
                        title={candidate.isHidden ? (isRTL ? 'הצג' : 'Show') : (isRTL ? 'הסתר' : 'Hide')}
                      >
                        {candidate.isHidden ? (
                          <Eye className="w-5 h-5" />
                        ) : (
                          <EyeOff className="w-5 h-5" />
                        )}
                      </button>

                      {/* Toggle finalist */}
                      {qvoteConfig?.enableFinals && candidate.isApproved && (
                        <button
                          onClick={() => handleToggleFinalist(candidate.id, !candidate.isFinalist)}
                          className={`p-2 rounded-lg transition-colors ${
                            candidate.isFinalist
                              ? 'bg-yellow-500/20 text-yellow-500'
                              : 'hover:bg-yellow-500/20 text-text-secondary hover:text-yellow-500'
                          }`}
                          title={isRTL ? 'פינליסט' : 'Finalist'}
                        >
                          <Trophy className="w-5 h-5" />
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(candidate.id)}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-text-secondary hover:text-red-500 transition-colors"
                        title={isRTL ? 'מחק' : 'Delete'}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer stats */}
      <footer className="fixed bottom-0 left-0 right-0 bg-bg-card border-t border-border py-3">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
          <div className="text-sm text-text-secondary">
            {isRTL
              ? `${approvedCount} מאושרים מתוך ${candidates.length}`
              : `${approvedCount} approved out of ${candidates.length}`}
          </div>
          <div className="text-sm text-text-secondary">
            {isRTL ? `${pendingCount} ממתינים לאישור` : `${pendingCount} pending approval`}
          </div>
        </div>
      </footer>

      {/* Hidden inputs for camera/file */}
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
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={resetManualAdd}
          />

          {/* Modal */}
          <div className="relative bg-bg-card border border-border rounded-2xl w-full max-w-md shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">
                {isRTL ? 'הוספת מועמד' : 'Add Candidate'}
              </h2>
              <button
                onClick={resetManualAdd}
                className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Name input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  {isRTL ? 'שם המועמד' : 'Candidate Name'}
                </label>
                <input
                  type="text"
                  value={manualCandidateName}
                  onChange={(e) => setManualCandidateName(e.target.value)}
                  placeholder={isRTL ? 'הזינו שם...' : 'Enter name...'}
                  className="w-full px-3 py-2 rounded-lg bg-bg-secondary border border-border text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>

              {/* Photo slots (2 for boomerang) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  {isRTL ? 'תמונות (2 לבומרנג)' : 'Photos (2 for boomerang)'}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[0, 1].map((slot) => (
                    <button
                      key={slot}
                      onClick={() => openCameraForSlot(slot)}
                      className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-accent/50 overflow-hidden transition-colors relative group"
                    >
                      {manualPhotoPreviews[slot] ? (
                        <>
                          <img
                            src={manualPhotoPreviews[slot]}
                            alt={`Photo ${slot + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Camera className="w-6 h-6 text-white" />
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-text-secondary">
                          <Camera className="w-8 h-8 mb-2" />
                          <span className="text-xs">
                            {isRTL ? `תמונה ${slot + 1}` : `Photo ${slot + 1}`}
                          </span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-text-secondary text-center">
                  {isRTL ? 'לחצו על ריבוע לצילום' : 'Tap a square to capture'}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border flex gap-2">
              <button
                onClick={resetManualAdd}
                className="flex-1 py-2 rounded-lg bg-bg-secondary text-text-primary hover:bg-bg-hover transition-colors"
              >
                {isRTL ? 'ביטול' : 'Cancel'}
              </button>
              <button
                onClick={handleManualSubmit}
                disabled={manualPhotos.filter(Boolean).length === 0 || addingManually}
                className="flex-1 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
    </div>
  );
}
