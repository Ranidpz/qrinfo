'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import Image from 'next/image';
import { Search, Plus, LayoutGrid, List, Loader2, FolderPlus, ArrowLeft, Folder as FolderIcon, Home, Edit2, Check, X, ChevronDown, ChevronUp, Upload, Route, Settings, Gift, Printer, CalendarClock, Ban, QrCode } from 'lucide-react';
import StorageBar from '@/components/layout/StorageBar';
import MediaUploader from '@/components/code/MediaUploader';
import CodeCard from '@/components/code/CodeCard';
import FolderCard from '@/components/code/FolderCard';
import DeleteConfirm from '@/components/modals/DeleteConfirm';
import TransferOwnershipModal from '@/components/modals/TransferOwnershipModal';
import RiddleModal from '@/components/modals/RiddleModal';
import WordCloudModal from '@/components/modals/WordCloudModal';
import SelfiebeamModal from '@/components/modals/SelfiebeamModal';
import QVoteModal from '@/components/modals/QVoteModal';
import WeeklyCalendarModal from '@/components/modals/WeeklyCalendarModal';
import RouteSettingsModal from '@/components/modals/RouteSettingsModal';
import { ViewMode, FilterOption, QRCode as QRCodeType, Folder, RiddleContent, SelfiebeamContent, RouteConfig, MediaType } from '@/types';
import { QVoteConfig } from '@/types/qvote';
import { WeeklyCalendarConfig } from '@/types/weeklycal';
import { useAuth } from '@/contexts/AuthContext';
import { getUserQRCodes, getGlobalQRCodes, getAllQRCodes, createQRCode, deleteQRCode, updateUserStorage, updateQRCode, getAllUsers, transferCodeOwnership, getUserFolders, getAllFolders, createFolder, updateFolder, deleteFolder, moveCodeToFolder } from '@/lib/db';
import { subscribeToCodeViews, subscribeToTotalViews } from '@/lib/analytics';
import { clsx } from 'clsx';
import { useTranslations, useLocale } from 'next-intl';

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refreshUser, signInWithGoogle } = useAuth();
  const locale = useLocale() as 'he' | 'en';
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const tAuth = useTranslations('auth');
  const tModals = useTranslations('modals');
  const tErrors = useTranslations('errors');
  const tCode = useTranslations('code');
  const [codes, setCodes] = useState<QRCodeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // Default based on screen size - list for mobile, grid for desktop
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768 ? 'list' : 'grid';
    }
    return 'grid';
  });
  const [filter, setFilter] = useState<FilterOption>('mine');
  const [gridSize, setGridSize] = useState(4);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; code: QRCodeType | null }>({
    isOpen: false,
    code: null,
  });
  const [transferModal, setTransferModal] = useState<{ isOpen: boolean; code: QRCodeType | null }>({
    isOpen: false,
    code: null,
  });
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [views24h, setViews24h] = useState<Record<string, number>>({});
  const [totalViews, setTotalViews] = useState<Record<string, number>>({});
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [draggingCodeId, setDraggingCodeId] = useState<string | null>(null);
  const [replaceStatus, setReplaceStatus] = useState<{ codeId: string; status: 'success' | 'error' } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ codeId: string; progress: number } | null>(null);
  const [deleteFolderModal, setDeleteFolderModal] = useState<{ isOpen: boolean; folder: Folder | null }>({
    isOpen: false,
    folder: null,
  });
  const [dragOverRoot, setDragOverRoot] = useState(false);
  const [editingFolderName, setEditingFolderName] = useState(false);
  const [showFolderRouteSettings, setShowFolderRouteSettings] = useState(false);
  const [folderNameInput, setFolderNameInput] = useState('');
  const [uploadSectionCollapsed, setUploadSectionCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('uploadSectionCollapsed') === 'true';
    }
    return false;
  });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [riddleModalOpen, setRiddleModalOpen] = useState(false);
  const [addingRiddle, setAddingRiddle] = useState(false);
  const [wordCloudModalOpen, setWordCloudModalOpen] = useState(false);
  const [addingWordCloud, setAddingWordCloud] = useState(false);
  const [selfiebeamModalOpen, setSelfiebeamModalOpen] = useState(false);
  const [addingSelfiebeam, setAddingSelfiebeam] = useState(false);
  const [qvoteModalOpen, setQvoteModalOpen] = useState(false);
  const [addingQVote, setAddingQVote] = useState(false);
  const [weeklyCalModalOpen, setWeeklyCalModalOpen] = useState(false);
  const [addingWeeklyCal, setAddingWeeklyCal] = useState(false);

  // Set initial view mode based on screen size (list for mobile, grid for desktop)
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    setViewMode(isMobile ? 'list' : 'grid');
  }, []);

  // Handle folder param from URL (when returning from code edit)
  useEffect(() => {
    const folderParam = searchParams.get('folder');
    if (folderParam) {
      setCurrentFolderId(folderParam);
      // Clean URL without causing navigation
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [searchParams]);

  // Load user's codes, folders and owner names (or global codes for guests)
  useEffect(() => {
    // Reset state when user changes (login/logout)
    setLoading(true);
    setCodes([]);
    setFolders([]);
    setOwnerNames({});

    const loadData = async () => {
      try {
        if (user) {
          // Super admin - load ALL codes, ALL folders, and all users
          if (user.role === 'super_admin') {
            const [allCodes, allFoldersList, allUsers] = await Promise.all([
              getAllQRCodes(),
              getAllFolders(),
              getAllUsers(),
            ]);
            setCodes(allCodes);
            setFolders(allFoldersList);

            // Build owner names map
            const names: Record<string, string> = {};
            allUsers.forEach((u) => {
              names[u.id] = u.displayName;
            });
            setOwnerNames(names);
          } else {
            // Regular user - load user's codes and folders
            const [userCodes, userFolders] = await Promise.all([
              getUserQRCodes(user.id),
              getUserFolders(user.id),
            ]);
            setCodes(userCodes);
            setFolders(userFolders);
          }
        } else {
          // Guest - load only global codes
          const globalCodes = await getGlobalQRCodes();
          setCodes(globalCodes);
          setFolders([]);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  // Subscribe to real-time view counts for 24h and total views
  useEffect(() => {
    if (codes.length === 0) return;

    const codeIds = codes.map((c) => c.id);

    // Subscribe to 24h views
    const unsubscribe24h = subscribeToCodeViews(
      codeIds,
      (viewsData) => {
        setViews24h(viewsData);
      },
      (error) => {
        console.error('Error subscribing to 24h views:', error);
      }
    );

    // Subscribe to total views (real-time updates from codes collection)
    const unsubscribeTotal = subscribeToTotalViews(
      codeIds,
      (viewsData) => {
        setTotalViews(viewsData);
      },
      (error) => {
        console.error('Error subscribing to total views:', error);
      }
    );

    return () => {
      unsubscribe24h();
      unsubscribeTotal();
    };
  }, [codes]);

  const handleFileSelect = async (file: File) => {
    if (!user) return;

    setUploading(true);

    try {
      // Upload file to Vercel Blob
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.id);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const uploadData = await uploadResponse.json();

      // Create QR code in Firestore (in current folder if inside one)
      const newCode = await createQRCode(user.id, file.name, [
        {
          url: uploadData.url,
          type: uploadData.type,
          size: uploadData.size,
          order: 0,
          uploadedBy: user.id,
        },
      ], currentFolderId);

      // Update user storage
      await updateUserStorage(user.id, uploadData.size);
      await refreshUser();

      // Add to list
      setCodes((prev) => [newCode, ...prev]);

      // Navigate to edit page
      router.push(`/code/${newCode.id}`);
    } catch (error) {
      console.error('Error creating code:', error);
      alert(tErrors('createCodeError'));
    } finally {
      setUploading(false);
    }
  };

  const handleLinkAdd = async (url: string) => {
    if (!user) return;

    setUploading(true);

    try {
      // Create QR code with link (in current folder if inside one)
      const newCode = await createQRCode(user.id, tCode('newLink'), [
        {
          url,
          type: 'link',
          size: 0,
          order: 0,
          uploadedBy: user.id,
        },
      ], currentFolderId);

      // Add to list
      setCodes((prev) => [newCode, ...prev]);

      // Navigate to edit page
      router.push(`/code/${newCode.id}`);
    } catch (error) {
      console.error('Error creating code:', error);
      alert(tErrors('createCodeError'));
    } finally {
      setUploading(false);
    }
  };

  const handleWordCloudCreate = async (url: string, title?: string) => {
    if (!user) return;

    setAddingWordCloud(true);

    try {
      // Create QR code with wordcloud link (in current folder if inside one)
      const newCode = await createQRCode(user.id, title || tModals('wordCloud'), [
        {
          url,
          type: 'wordcloud',
          size: 0,
          order: 0,
          uploadedBy: user.id,
          title: title,
        },
      ], currentFolderId);

      // Add to list
      setCodes((prev) => [newCode, ...prev]);

      // Close modal and navigate to edit page
      setWordCloudModalOpen(false);
      router.push(`/code/${newCode.id}`);
    } catch (error) {
      console.error('Error creating wordcloud code:', error);
      alert(tErrors('createCodeError'));
    } finally {
      setAddingWordCloud(false);
    }
  };

  const handleRiddleCreate = async (content: RiddleContent, imageFiles: File[]) => {
    if (!user) return;

    setAddingRiddle(true);

    try {
      // Upload images if any
      const uploadedImages: string[] = [];
      let totalImageSize = 0;

      for (const file of imageFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('userId', user.id);

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload image');
        }

        const uploadData = await uploadResponse.json();
        uploadedImages.push(uploadData.url);
        totalImageSize += uploadData.size;
      }

      // Create riddle content with uploaded image URLs
      const riddleContent: RiddleContent = {
        ...content,
        images: uploadedImages,
      };

      // Create QR code with riddle (in current folder if inside one)
      const newCode = await createQRCode(user.id, content.title, [
        {
          url: '', // Riddle doesn't have a direct URL
          type: 'riddle',
          size: totalImageSize,
          order: 0,
          uploadedBy: user.id,
          title: content.title,
          riddleContent: riddleContent,
        },
      ], currentFolderId);

      // Update user storage for images
      if (totalImageSize > 0) {
        await updateUserStorage(user.id, totalImageSize);
        await refreshUser();
      }

      // Add to list
      setCodes((prev) => [newCode, ...prev]);

      // Close modal and navigate to edit page
      setRiddleModalOpen(false);
      router.push(`/code/${newCode.id}`);
    } catch (error) {
      console.error('Error creating riddle:', error);
      alert(tErrors('createRiddleError'));
    } finally {
      setAddingRiddle(false);
    }
  };

  const handleSelfiebeamCreate = async (content: SelfiebeamContent, imageFiles: File[]) => {
    if (!user) return;

    setAddingSelfiebeam(true);

    try {
      // Upload images if any
      const uploadedImages: string[] = [];
      let totalImageSize = 0;

      for (const file of imageFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('userId', user.id);

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload image');
        }

        const uploadData = await uploadResponse.json();
        uploadedImages.push(uploadData.url);
        totalImageSize += uploadData.size;
      }

      // Create selfiebeam content with uploaded image URLs (filter out undefined values for Firebase)
      const selfiebeamContent: SelfiebeamContent = {
        title: content.title,
        content: content.content,
        backgroundColor: content.backgroundColor,
        textColor: content.textColor,
        images: uploadedImages.length > 0 ? uploadedImages : [],
        galleryEnabled: content.galleryEnabled || false,
        allowAnonymous: content.allowAnonymous ?? true,
      };
      // Only add youtubeUrl if it exists
      if (content.youtubeUrl) {
        selfiebeamContent.youtubeUrl = content.youtubeUrl;
      }

      // Create QR code with selfiebeam (in current folder if inside one)
      const newCode = await createQRCode(user.id, content.title, [
        {
          url: '', // Selfiebeam doesn't have a direct URL
          type: 'selfiebeam',
          size: totalImageSize,
          order: 0,
          uploadedBy: user.id,
          title: content.title,
          selfiebeamContent: selfiebeamContent,
        },
      ], currentFolderId);

      // Update user storage for images
      if (totalImageSize > 0) {
        await updateUserStorage(user.id, totalImageSize);
        await refreshUser();
      }

      // Add to list
      setCodes((prev) => [newCode, ...prev]);

      // Close modal and navigate to edit page
      setSelfiebeamModalOpen(false);
      router.push(`/code/${newCode.id}`);
    } catch (error) {
      console.error('Error creating selfiebeam:', error);
      alert(tErrors('createSelfiebeamError'));
    } finally {
      setAddingSelfiebeam(false);
    }
  };

  const handleQVoteCreate = async (config: QVoteConfig, landingImageFile?: File) => {
    if (!user) return;

    setAddingQVote(true);

    try {
      let landingImageUrl: string | undefined;
      let totalImageSize = 0;

      // Upload landing image if provided
      if (landingImageFile) {
        const formData = new FormData();
        formData.append('file', landingImageFile);
        formData.append('userId', user.id);

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload landing image');
        }

        const uploadData = await uploadResponse.json();
        landingImageUrl = uploadData.url;
        totalImageSize += uploadData.size;
      }

      // Clean up config for Firestore (remove undefined values)
      const cleanConfig = {
        formFields: config.formFields.map(f => ({
          id: f.id,
          label: f.label,
          labelEn: f.labelEn || '',
          placeholder: f.placeholder || '',
          placeholderEn: f.placeholderEn || '',
          required: f.required,
          order: f.order,
        })),
        categories: config.categories.map(c => ({
          id: c.id,
          name: c.name,
          nameEn: c.nameEn || '',
          order: c.order,
          isActive: c.isActive,
        })),
        currentPhase: config.currentPhase,
        enableFinals: config.enableFinals,
        schedule: {},
        scheduleMode: config.scheduleMode,
        maxPhotosPerCandidate: config.maxPhotosPerCandidate,
        maxSelectionsPerVoter: config.maxSelectionsPerVoter,
        showVoteCount: config.showVoteCount,
        showNames: config.showNames,
        enableCropping: config.enableCropping,
        allowSelfRegistration: config.allowSelfRegistration,
        gamification: {
          enabled: config.gamification.enabled,
          xpPerVote: config.gamification.xpPerVote,
          xpForPackThreshold: config.gamification.xpForPackThreshold,
        },
        branding: {
          colors: {
            background: config.branding.colors.background,
            text: config.branding.colors.text,
            buttonBackground: config.branding.colors.buttonBackground,
            buttonText: config.branding.colors.buttonText,
          },
          landingImage: landingImageUrl || '',
        },
        messages: {},
      };

      // Create QR code with Q.Vote (in current folder if inside one)
      const newCode = await createQRCode(user.id, 'Q.Vote', [
        {
          url: '',
          type: 'qvote',
          size: totalImageSize,
          order: 0,
          uploadedBy: user.id,
          title: 'Q.Vote',
          qvoteConfig: cleanConfig,
        },
      ], currentFolderId);

      // Update user storage for images
      if (totalImageSize > 0) {
        await updateUserStorage(user.id, totalImageSize);
        await refreshUser();
      }

      // Add to list
      setCodes((prev) => [newCode, ...prev]);

      // Close modal and navigate to edit page
      setQvoteModalOpen(false);
      router.push(`/code/${newCode.id}`);
    } catch (error) {
      console.error('Error creating Q.Vote:', error);
      alert(tErrors('createCodeError'));
    } finally {
      setAddingQVote(false);
    }
  };

  const handleWeeklyCalCreate = async (config: WeeklyCalendarConfig) => {
    if (!user) return;

    setAddingWeeklyCal(true);

    try {
      // Create QR code with weekly calendar (in current folder if inside one)
      const newCode = await createQRCode(user.id, 'לוח פעילות', [
        {
          url: '', // Weekly calendar doesn't have a direct URL
          type: 'weeklycal',
          size: 0,
          order: 0,
          uploadedBy: user.id,
          title: 'לוח פעילות',
          weeklycalConfig: config,
        },
      ], currentFolderId);

      // Add to list
      setCodes((prev) => [newCode, ...prev]);

      // Close modal and navigate to edit page
      setWeeklyCalModalOpen(false);
      router.push(`/code/${newCode.id}`);
    } catch (error) {
      console.error('Error creating weekly calendar:', error);
      alert(tErrors('createCodeError'));
    } finally {
      setAddingWeeklyCal(false);
    }
  };

  const handleDelete = (code: QRCodeType) => {
    setDeleteModal({ isOpen: true, code });
  };

  const confirmDelete = async () => {
    if (!deleteModal.code || !user) return;

    try {
      // Calculate total size of media
      const totalSize = deleteModal.code.media
        .filter((m) => m.uploadedBy === user.id)
        .reduce((sum, m) => sum + m.size, 0);

      // Delete from Firestore
      await deleteQRCode(deleteModal.code.id);

      // Delete media from Vercel Blob
      for (const media of deleteModal.code.media) {
        if (media.type !== 'link') {
          await fetch('/api/upload', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: media.url }),
          });
        }
      }

      // Update user storage (negative to reduce)
      if (totalSize > 0) {
        await updateUserStorage(user.id, -totalSize);
        await refreshUser();
      }

      // Remove from list
      setCodes((prev) => prev.filter((c) => c.id !== deleteModal.code?.id));
    } catch (error) {
      console.error('Error deleting code:', error);
      alert(tErrors('deleteError'));
    }

    setDeleteModal({ isOpen: false, code: null });
  };

  const handleCopyLink = (shortId: string) => {
    const url = `${window.location.origin}/v/${shortId}`;
    navigator.clipboard.writeText(url);
    // TODO: Show toast notification
  };

  const handleTitleChange = async (codeId: string, newTitle: string) => {
    try {
      await updateQRCode(codeId, { title: newTitle });
      setCodes((prev) =>
        prev.map((c) => (c.id === codeId ? { ...c, title: newTitle } : c))
      );
    } catch (error) {
      console.error('Error updating title:', error);
      alert(tErrors('updateNameError'));
    }
  };

  const handleTransferOwnership = async (newOwnerId: string, newOwnerName: string) => {
    if (!transferModal.code) return;

    try {
      await transferCodeOwnership(transferModal.code.id, newOwnerId);
      // Update only the ownerId - folder stays the same
      setCodes((prev) =>
        prev.map((c) =>
          c.id === transferModal.code?.id
            ? { ...c, ownerId: newOwnerId }
            : c
        )
      );
      // Update owner names cache
      setOwnerNames((prev) => ({ ...prev, [newOwnerId]: newOwnerName }));
    } catch (error) {
      console.error('Error transferring ownership:', error);
      alert(tErrors('transferError'));
    }
  };

  // Folder handlers
  const handleCreateFolder = async () => {
    if (!user) return;
    try {
      const newFolder = await createFolder(user.id, t('newExperience'));
      setFolders((prev) => [newFolder, ...prev]);
    } catch (error) {
      console.error('Error creating folder:', error);
      alert(tErrors('createExperienceError'));
    }
  };

  const handleRenameFolder = async (folderId: string, newName: string) => {
    try {
      await updateFolder(folderId, { name: newName });
      setFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, name: newName } : f))
      );
    } catch (error) {
      console.error('Error renaming folder:', error);
      alert(tErrors('renameExperienceError'));
    }
  };

  const handleRouteConfigUpdate = (folderId: string, routeConfig: RouteConfig) => {
    // Update local state immediately (DB is already updated by the modal)
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, routeConfig } : f))
    );
  };

  const handleDeleteFolder = (folder: Folder) => {
    setDeleteFolderModal({ isOpen: true, folder });
  };

  const confirmDeleteFolder = async () => {
    if (!deleteFolderModal.folder) return;
    try {
      await deleteFolder(deleteFolderModal.folder.id);
      setFolders((prev) => prev.filter((f) => f.id !== deleteFolderModal.folder?.id));
      // Update codes that were in this folder
      setCodes((prev) =>
        prev.map((c) =>
          (c as QRCodeType & { folderId?: string }).folderId === deleteFolderModal.folder?.id
            ? { ...c, folderId: undefined } as QRCodeType
            : c
        )
      );
      if (currentFolderId === deleteFolderModal.folder.id) {
        setCurrentFolderId(null);
      }
    } catch (error) {
      console.error('Error deleting folder:', error);
      alert(tErrors('deleteExperienceError'));
    }
    setDeleteFolderModal({ isOpen: false, folder: null });
  };

  const handleMoveCodeToFolder = async (codeId: string, folderId: string | null) => {
    try {
      await moveCodeToFolder(codeId, folderId);
      setCodes((prev) =>
        prev.map((c) =>
          c.id === codeId ? { ...c, folderId } as QRCodeType : c
        )
      );
    } catch (error) {
      console.error('Error moving code:', error);
      alert(tErrors('moveCodeError'));
    }
    setDraggingCodeId(null);
    setDragOverFolderId(null);
  };

  const handleReplaceFile = async (codeId: string, code: QRCodeType, file: File) => {
    if (!user) return;

    try {
      // Show upload progress immediately
      setUploadProgress({ codeId, progress: 0 });

      // Upload new file to Vercel Blob with progress tracking
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.id);

      const uploadData = await new Promise<{ url: string; type: string; size: number; filename: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setUploadProgress({ codeId, progress });
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              reject(new Error('Invalid response'));
            }
          } else {
            reject(new Error('Upload failed'));
          }
        };

        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.open('POST', '/api/upload');
        xhr.send(formData);
      });

      // Clear progress
      setUploadProgress(null);

      // Delete old media from Vercel Blob if not a link
      const oldMedia = code.media[0];
      if (oldMedia && oldMedia.type !== 'link') {
        await fetch('/api/upload', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: oldMedia.url }),
        });

        // Update storage: subtract old size
        if (oldMedia.uploadedBy === user.id) {
          await updateUserStorage(user.id, -oldMedia.size);
        }
      }

      // Update QR code with new media
      const newMedia = {
        id: `media_${Date.now()}_0`,
        url: uploadData.url,
        type: uploadData.type as MediaType,
        size: uploadData.size,
        order: 0,
        uploadedBy: user.id,
        filename: uploadData.filename,
        createdAt: new Date(),
      };

      await updateQRCode(codeId, { media: [newMedia] });

      // Update user storage: add new size
      await updateUserStorage(user.id, uploadData.size);
      await refreshUser();

      // Update codes state with new media (stay on dashboard)
      setCodes((prev) =>
        prev.map((c) =>
          c.id === codeId ? { ...c, media: [newMedia], updatedAt: new Date() } : c
        )
      );

      // Show success indicator
      setReplaceStatus({ codeId, status: 'success' });
      setTimeout(() => setReplaceStatus(null), 3000);
    } catch (error) {
      console.error('Error replacing file:', error);
      setUploadProgress(null);
      // Show error indicator
      setReplaceStatus({ codeId, status: 'error' });
      setTimeout(() => setReplaceStatus(null), 3000);
    }
  };

  // Duplicate a code - creates new code with same media references (no actual file copy)
  const handleDuplicateCode = async (code: QRCodeType) => {
    if (!user) return;

    try {
      // Create new code with same media (just references, not copies)
      // Duplicate into the same folder as the original code
      const codeWithFolder = code as QRCodeType & { folderId?: string };
      const newCode = await createQRCode(
        user.id,
        `${code.title} ${tCode('duplicateSuffix')}`,
        code.media.map((m) => ({
          url: m.url,
          type: m.type,
          size: 0, // Don't count storage again since it's same file
          order: m.order,
          uploadedBy: user.id,
          title: m.title,
          filename: m.filename,
          pageCount: m.pageCount,
          linkUrl: m.linkUrl,
          linkTitle: m.linkTitle,
          // Deep copy of nested objects to avoid reference issues
          riddleContent: m.riddleContent ? {
            ...m.riddleContent,
            images: m.riddleContent.images ? [...m.riddleContent.images] : undefined,
          } : undefined,
          selfiebeamContent: m.selfiebeamContent ? {
            ...m.selfiebeamContent,
            images: m.selfiebeamContent.images ? [...m.selfiebeamContent.images] : undefined,
            companyLogos: m.selfiebeamContent.companyLogos ? [...m.selfiebeamContent.companyLogos] : undefined,
          } : undefined,
          schedule: m.schedule ? { ...m.schedule } : undefined,
        })),
        codeWithFolder.folderId || currentFolderId
      );

      // Add to list
      setCodes((prev) => [newCode, ...prev]);
    } catch (error) {
      console.error('Error duplicating code:', error);
      alert(tErrors('duplicateError'));
    }
  };

  // Toggle global status (admin only)
  const handleToggleGlobal = async (code: QRCodeType) => {
    if (!user || user.role !== 'super_admin') return;

    try {
      const newGlobalStatus = !code.isGlobal;
      await updateQRCode(code.id, {
        isGlobal: newGlobalStatus,
      });

      // Update local state
      setCodes((prev) =>
        prev.map((c) =>
          c.id === code.id
            ? { ...c, isGlobal: newGlobalStatus }
            : c
        )
      );
    } catch (error) {
      console.error('Error toggling global status:', error);
      alert(tErrors('globalStatusError'));
    }
  };

  // Get current folder for header
  const currentFolder = currentFolderId ? folders.find((f) => f.id === currentFolderId) : null;

  const filteredCodes = codes.filter((code) => {
    const codeWithFolder = code as QRCodeType & { folderId?: string };

    // Filter by folder
    if (user) {
      if (currentFolderId !== null) {
        // Inside a folder - show only codes in this folder
        if (codeWithFolder.folderId !== currentFolderId) {
          return false;
        }
      } else {
        // At root level - show only codes without folder
        if (codeWithFolder.folderId) {
          return false;
        }
      }
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !code.title.toLowerCase().includes(query) &&
        !code.shortId.toLowerCase().includes(query)
      ) {
        return false;
      }
    }

    // Filter by ownership (My Q vs הכל)
    if (user && filter === 'mine') {
      // "My Q" = only codes I own
      if (code.ownerId !== user.id) {
        return false;
      }
    }
    // "הכל" for super_admin = all codes
    // "הכל" for regular user = my codes + codes shared with me (already filtered by getUserQRCodes)

    return true;
  });

  // Count codes in folder based on current filter
  const getCodesInFolder = (folderId: string) => {
    return codes.filter((c) => {
      const codeWithFolder = c as QRCodeType & { folderId?: string };
      if (codeWithFolder.folderId !== folderId) return false;
      // Apply same ownership filter
      if (user && filter === 'mine' && c.ownerId !== user.id) return false;
      return true;
    }).length;
  };

  // Filter folders based on the current filter (My Q vs הכל)
  const displayFolders = folders.filter((folder) => {
    // For "My Q" filter - show only user's own folders
    if (user && filter === 'mine') {
      return folder.ownerId === user.id;
    }
    // For "הכל" filter - show all folders (super admin sees all)
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Section - hide when inside a folder */}
      {!currentFolderId && (
      <div className="text-center py-8 sm:py-10">
        <style jsx>{`
          @keyframes bounceIn {
            0% {
              opacity: 0;
              transform: scale(0.3);
            }
            50% {
              opacity: 1;
              transform: scale(1.05);
            }
            70% {
              transform: scale(0.95);
            }
            100% {
              transform: scale(1);
            }
          }
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
          @keyframes logoFadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
          @keyframes expandWidth {
            from {
              width: 0;
            }
            to {
              width: 80px;
            }
          }
          .hero-title {
            animation: bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
          }
          .hero-divider {
            opacity: 0;
            animation: fadeIn 0.3s ease-out 0.5s forwards;
          }
          .hero-divider-line {
            width: 0;
            animation: expandWidth 0.4s ease-out 0.6s forwards;
          }
          .hero-tagline {
            opacity: 0;
            animation: fadeIn 0.5s ease-out 0.5s forwards;
          }
          .hero-subtitle {
            opacity: 0;
            animation: fadeIn 0.6s ease-out 0.9s forwards;
          }
          .hero-features {
            opacity: 0;
            animation: fadeIn 0.6s ease-out 1.1s forwards;
          }
          `}</style>
        <h1 className="hero-title text-3xl sm:text-4xl md:text-5xl font-bold mb-4 tracking-tight flex items-center justify-center gap-2 flex-wrap" dir="ltr">
          <span className="text-lg sm:text-xl md:text-2xl font-normal" style={{ color: '#6b7280' }}>The</span>
          <Image
            src="/theQ.png"
            alt="Q"
            width={160}
            height={160}
            className="inline-block transition-transform duration-300 hover:scale-110 cursor-pointer opacity-0 animate-[logoFadeIn_0.4s_ease-out_0.4s_forwards]"
          />
          <span style={{ color: 'var(--text-title, #1f2937)' }}>- One Code. Endless Experiences</span>
        </h1>
        <p className="hero-tagline flex items-center justify-center gap-2 text-base sm:text-lg text-text-secondary mb-4">
          <QrCode className="w-5 h-5 text-accent" />
          {t('heroTagline')}
        </p>
        <div className="hero-divider flex justify-center mb-4">
          <div className="hero-divider-line h-1 bg-gradient-to-r from-transparent via-accent to-transparent rounded-full" />
        </div>
        <p className="hero-subtitle text-sm sm:text-base md:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
          {t('subtitle')}
        </p>
        <div className="hero-features flex flex-wrap items-center justify-center gap-3 sm:gap-6 mt-4 text-sm sm:text-base">
          <span className="flex items-center gap-1.5 text-accent font-medium">
            <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
            {t('heroFeature1')}
          </span>
          <span className="text-text-secondary hidden sm:inline">|</span>
          <span className="flex items-center gap-1.5 text-accent font-medium">
            <CalendarClock className="w-4 h-4 sm:w-5 sm:h-5" />
            {t('heroFeature2')}
          </span>
          <span className="text-text-secondary hidden sm:inline">|</span>
          <span className="flex items-center gap-1.5 text-accent font-medium">
            <Ban className="w-4 h-4 sm:w-5 sm:h-5" />
            {t('heroFeature3')}
          </span>
        </div>
      </div>
      )}

      {/* Upload Section - Collapsible (only for logged in users) */}
      {user ? (
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => {
              const newValue = !uploadSectionCollapsed;
              setUploadSectionCollapsed(newValue);
              localStorage.setItem('uploadSectionCollapsed', String(newValue));
            }}
            className="w-full flex items-center justify-between p-4 hover:bg-bg-secondary/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Upload className="w-5 h-5 text-accent" />
              <span className="font-medium text-text-primary">{t('createNew')}</span>
            </div>
            <ChevronDown className={clsx(
              "w-5 h-5 text-text-secondary transition-transform duration-200",
              !uploadSectionCollapsed && "rotate-180"
            )} />
          </button>

          <div className={clsx(
            "grid transition-all duration-200 ease-in-out",
            uploadSectionCollapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
          )}>
            <div className="overflow-hidden">
              <div className="px-4 pb-4">
                <MediaUploader
                  onFileSelect={handleFileSelect}
                  onLinkAdd={handleLinkAdd}
                  onRiddleCreate={() => setRiddleModalOpen(true)}
                  onWordCloudCreate={() => setWordCloudModalOpen(true)}
                  onSelfiebeamCreate={() => setSelfiebeamModalOpen(true)}
                  onQVoteCreate={() => setQvoteModalOpen(true)}
                  onWeeklyCalendarCreate={() => setWeeklyCalModalOpen(true)}
                  disabled={uploading}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => router.push('/login')}
          className="w-full bg-bg-card border border-border rounded-xl p-4 flex items-center justify-center gap-3 hover:bg-bg-secondary/50 transition-colors"
        >
          <Upload className="w-5 h-5 text-accent" />
          <span className="font-medium text-text-primary">{tAuth('signInToCreate')}</span>
        </button>
      )}

      {uploading && (
        <div className="flex items-center justify-center gap-2 py-4 text-accent">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>{t('creatingCode')}</span>
        </div>
      )}

      {/* Folder Header - when inside a folder */}
      {currentFolder && (
        <div className="flex items-center gap-3">
          {/* Root folder drop zone - visible when dragging */}
          <div
            className={clsx(
              'flex items-center gap-2 p-4 rounded-xl border-2 border-dashed transition-all cursor-pointer',
              dragOverRoot
                ? 'border-accent bg-accent/10 scale-105'
                : draggingCodeId
                  ? 'border-border hover:border-accent/50'
                  : 'border-transparent'
            )}
            style={{ display: draggingCodeId ? 'flex' : 'none' }}
            onDrop={(e) => {
              e.preventDefault();
              if (draggingCodeId) {
                handleMoveCodeToFolder(draggingCodeId, null);
              }
              setDragOverRoot(false);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverRoot(true);
            }}
            onDragLeave={() => setDragOverRoot(false)}
          >
            <Home className="w-6 h-6 text-accent" />
            <span className="text-sm font-medium text-accent">{t('dropHereToDashboard')}</span>
          </div>

          <div className="flex-1 flex items-center gap-3 p-4 bg-bg-card border border-border rounded-xl">
            <button
              onClick={() => setCurrentFolderId(null)}
              className="p-2 rounded-lg bg-bg-secondary text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
              title={tCommon('back')}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${currentFolder.color}20`, color: currentFolder.color }}
            >
              <FolderIcon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                {editingFolderName ? (
                  <input
                    type="text"
                    value={folderNameInput}
                    onChange={(e) => setFolderNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const trimmed = folderNameInput.trim();
                        if (trimmed && trimmed !== currentFolder.name) {
                          handleRenameFolder(currentFolder.id, trimmed);
                        }
                        setEditingFolderName(false);
                      } else if (e.key === 'Escape') {
                        setEditingFolderName(false);
                      }
                    }}
                    onBlur={() => {
                      const trimmed = folderNameInput.trim();
                      if (trimmed && trimmed !== currentFolder.name) {
                        handleRenameFolder(currentFolder.id, trimmed);
                      }
                      setEditingFolderName(false);
                    }}
                    autoFocus
                    className="text-lg font-semibold bg-bg-secondary border border-accent rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                ) : (
                  <h2
                    className="text-lg font-semibold text-text-primary cursor-pointer hover:text-accent transition-colors"
                    onClick={() => {
                      setFolderNameInput(currentFolder.name);
                      setEditingFolderName(true);
                    }}
                    title={t('clickToEditName')}
                  >
                    {currentFolder.name}
                  </h2>
                )}
                {/* Route indicator badge */}
                {currentFolder.routeConfig?.isRoute && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                    <Route className="w-3 h-3" />
                    מסלול XP
                  </span>
                )}
                {/* Prizes indicator badge */}
                {currentFolder.routeConfig?.prizesEnabled && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs font-medium">
                    <Gift className="w-3 h-3" />
                    פרסים
                  </span>
                )}
              </div>
              <p className="text-sm text-text-secondary">{filteredCodes.length} {t('codes')}</p>
            </div>
            {/* Route Settings Button */}
            <button
              onClick={() => setShowFolderRouteSettings(true)}
              className={clsx(
                "p-2 rounded-lg transition-colors",
                currentFolder.routeConfig?.isRoute
                  ? "text-green-400 hover:text-green-300 bg-green-500/10 hover:bg-green-500/20"
                  : "text-text-secondary hover:text-accent hover:bg-accent/10"
              )}
              title="הגדרות מסלול"
            >
              <Settings className="w-5 h-5" />
            </button>
            {!editingFolderName && (
              <button
                onClick={() => {
                  setFolderNameInput(currentFolder.name);
                  setEditingFolderName(true);
                }}
                className="p-2 rounded-lg text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
                title={t('editName')}
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Toolbar - All controls in one row on desktop */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        {/* View mode toggle - first on mobile, last on desktop */}
        <div className="flex bg-bg-secondary rounded-lg p-1 order-3 sm:order-4">
          <button
            onClick={() => setViewMode('grid')}
            className={clsx(
              'p-2 rounded-md transition-colors',
              viewMode === 'grid' ? 'bg-bg-card text-text-primary' : 'text-text-secondary'
            )}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={clsx(
              'p-2 rounded-md transition-colors',
              viewMode === 'list' ? 'bg-bg-card text-text-primary' : 'text-text-secondary'
            )}
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        {/* Grid size controls - hide on small screens */}
        <div className="hidden sm:flex items-center gap-1 bg-bg-secondary rounded-lg p-1 order-3">
          <button
            onClick={() => setGridSize(Math.max(1, gridSize - 1))}
            className="px-2 py-1 text-text-secondary hover:text-text-primary"
          >
            −
          </button>
          <span className="px-2 text-sm text-text-primary">{gridSize}</span>
          <button
            onClick={() => setGridSize(Math.min(6, gridSize + 1))}
            className="px-2 py-1 text-text-secondary hover:text-text-primary"
          >
            +
          </button>
        </div>

        {/* Filter tabs - only show for logged in users */}
        {user && (
          <div className="flex bg-bg-secondary rounded-lg p-1 order-1 sm:order-2">
            <button
              onClick={() => setFilter('all')}
              className={clsx(
                'flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                filter === 'all' ? 'bg-bg-card text-text-primary' : 'text-text-secondary'
              )}
            >
              {tCommon('all')}
            </button>
            <button
              onClick={() => setFilter('mine')}
              className={clsx(
                'flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                filter === 'mine' ? 'bg-accent text-white' : 'text-text-secondary'
              )}
            >
              {t('myQ')}
            </button>
          </div>
        )}

        {/* Search - takes remaining space */}
        <div className="relative flex-1 min-w-0 order-2 sm:order-1">
          <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
          <input
            type="text"
            placeholder={tCommon('search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input ps-12 w-full"
            list="codes-autocomplete"
          />
          <datalist id="codes-autocomplete">
            {codes.map((code) => (
              <option key={code.id} value={code.title} />
            ))}
          </datalist>
        </div>
      </div>

      {/* Folders Section - only show at root level for logged in users */}
      {user && !currentFolderId && displayFolders.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">{t('experiences')}</h2>
            <button
              onClick={handleCreateFolder}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10 rounded-lg transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
              {t('newExperience')}
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {displayFolders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                codesCount={getCodesInFolder(folder.id)}
                isOpen={currentFolderId === folder.id}
                isDragOver={dragOverFolderId === folder.id}
                ownerName={user?.role === 'super_admin' && folder.ownerId !== user.id ? ownerNames[folder.ownerId] : undefined}
                onOpen={() => setCurrentFolderId(folder.id)}
                onDelete={() => handleDeleteFolder(folder)}
                onRename={(newName) => handleRenameFolder(folder.id, newName)}
                onRouteConfigUpdate={handleRouteConfigUpdate}
                locale={locale}
                onDrop={() => {
                  if (draggingCodeId) {
                    handleMoveCodeToFolder(draggingCodeId, folder.id);
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverFolderId(folder.id);
                }}
                onDragLeave={() => setDragOverFolderId(null)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Create Folder Button - show when no folders exist (only for logged in users) */}
      {user && !currentFolderId && folders.length === 0 && (
        <button
          onClick={handleCreateFolder}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-text-secondary hover:text-accent border border-dashed border-border hover:border-accent rounded-xl transition-colors w-full justify-center"
        >
          <FolderPlus className="w-5 h-5" />
          {t('createExperienceToOrganize')}
        </button>
      )}

      {/* Codes Grid/List */}
      {filteredCodes.length > 0 ? (
        <div
          className={clsx(
            'grid gap-3 sm:gap-4',
            viewMode === 'list' && 'grid-cols-1'
          )}
          style={
            viewMode === 'grid'
              ? {
                  gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${Math.max(200, 320 / gridSize * 2)}px), 1fr))`,
                }
              : undefined
          }
        >
          {filteredCodes.map((code) => (
            <CodeCard
              key={code.id}
              id={code.id}
              shortId={code.shortId}
              title={code.title}
              thumbnail={code.media[0]?.type !== 'link' ? code.media[0]?.url : undefined}
              mediaType={code.media[0]?.type || 'image'}
              mediaUrl={code.media[0]?.url}
              fileName={code.media[0]?.filename || code.media[0]?.title}
              fileSize={code.media[0]?.size}
              mediaCount={code.media.length}
              views={totalViews[code.id] ?? code.views}
              views24h={views24h[code.id] || 0}
              updatedAt={code.updatedAt}
              isOwner={user?.id === code.ownerId}
              isGlobal={code.isGlobal}
              isInRoute={code.folderId ? folders.find(f => f.id === code.folderId)?.routeConfig?.isRoute : false}
              isGuest={!user}
              widgets={code.widgets}
              viewMode={viewMode}
              ownerName={ownerNames[code.ownerId] || (code.ownerId === user?.id ? user.displayName : undefined)}
              isSuperAdmin={user?.role === 'super_admin'}
              isDragging={draggingCodeId === code.id}
              replaceStatus={replaceStatus?.codeId === code.id ? replaceStatus.status : null}
              uploadProgress={uploadProgress?.codeId === code.id ? uploadProgress.progress : null}
              onDelete={() => handleDelete(code)}
              onRefresh={() => router.push(`/code/${code.id}`)}
              onReplaceFile={(file) => handleReplaceFile(code.id, code, file)}
              onPublish={() => router.push(`/code/${code.id}`)}
              onCopy={() => handleCopyLink(code.shortId)}
              onTitleChange={(newTitle) => handleTitleChange(code.id, newTitle)}
              onTransferOwnership={() => setTransferModal({ isOpen: true, code })}
              onDuplicate={() => handleDuplicateCode(code)}
              onToggleGlobal={() => handleToggleGlobal(code)}
              onDragStart={() => setDraggingCodeId(code.id)}
              onDragEnd={() => {
                setDraggingCodeId(null);
                setDragOverFolderId(null);
              }}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-bg-secondary flex items-center justify-center mx-auto mb-4">
            <Plus className="w-8 h-8 text-text-secondary" />
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-2">
            {!user
              ? t('noGlobalExperiences')
              : currentFolderId
                ? t('emptyExperience')
                : t('noCodes')}
          </h3>
          <p className="text-text-secondary">
            {!user
              ? t('signInToCreate')
              : currentFolderId
                ? t('dragCodesToExperience')
                : t('uploadOrAddLink')}
          </p>
          {!user && (
            <button
              onClick={() => router.push('/login')}
              className="mt-4 px-6 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-colors"
            >
              {tAuth('signInNow')}
            </button>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirm
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, code: null })}
        onConfirm={confirmDelete}
        title={deleteModal.code?.title || ''}
      />

      {/* Transfer Ownership Modal */}
      <TransferOwnershipModal
        isOpen={transferModal.isOpen}
        onClose={() => setTransferModal({ isOpen: false, code: null })}
        onTransfer={handleTransferOwnership}
        codeTitle={transferModal.code?.title || ''}
        currentOwnerId={transferModal.code?.ownerId || ''}
      />

      {/* Delete Folder Confirmation Modal */}
      {deleteFolderModal.isOpen && deleteFolderModal.folder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-card border border-border rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-text-primary mb-2">{tModals('deleteExperience')}</h3>
            <p className="text-text-secondary mb-4">
              {tModals('deleteExperienceConfirm', { name: deleteFolderModal.folder.name })}
              <br />
              <span className="text-sm">{tModals('codesWillMoveToDashboard')}</span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteFolderModal({ isOpen: false, folder: null })}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={confirmDeleteFolder}
                className="px-4 py-2 text-sm font-medium text-white bg-danger hover:bg-danger/90 rounded-lg transition-colors"
              >
                {tCommon('delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Storage Bar - at the bottom of the page (only for logged in users) */}
      {user && (
        <StorageBar
          used={user?.storageUsed || 0}
          limit={user?.storageLimit || 25 * 1024 * 1024}
        />
      )}

      {/* Login Modal for guests */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-card border border-border rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-text-primary mb-2 text-center">{tAuth('signInModalTitle')}</h3>
            <p className="text-text-secondary mb-6 text-center text-sm">
              {tAuth('signInModalDescription')}
            </p>

            <button
              onClick={async () => {
                try {
                  await signInWithGoogle();
                  setShowLoginModal(false);
                } catch (error) {
                  console.error('Login error:', error);
                }
              }}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white hover:bg-gray-50 text-gray-800 font-medium rounded-lg border border-gray-300 transition-colors mb-4"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {tAuth('signInWithGoogle')}
            </button>

            <button
              onClick={() => setShowLoginModal(false)}
              className="w-full py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              {tCommon('cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Riddle Modal */}
      <RiddleModal
        isOpen={riddleModalOpen}
        onClose={() => setRiddleModalOpen(false)}
        onSave={handleRiddleCreate}
        loading={addingRiddle}
      />

      {/* WordCloud Modal */}
      <WordCloudModal
        isOpen={wordCloudModalOpen}
        onClose={() => setWordCloudModalOpen(false)}
        onSave={handleWordCloudCreate}
        loading={addingWordCloud}
      />

      {/* Selfiebeam Modal */}
      <SelfiebeamModal
        isOpen={selfiebeamModalOpen}
        onClose={() => setSelfiebeamModalOpen(false)}
        onSave={handleSelfiebeamCreate}
        loading={addingSelfiebeam}
      />

      {/* Q.Vote Modal */}
      <QVoteModal
        isOpen={qvoteModalOpen}
        onClose={() => setQvoteModalOpen(false)}
        onSave={handleQVoteCreate}
        loading={addingQVote}
      />

      {/* Weekly Calendar Modal */}
      <WeeklyCalendarModal
        isOpen={weeklyCalModalOpen}
        onClose={() => setWeeklyCalModalOpen(false)}
        onSave={handleWeeklyCalCreate}
        onUploadCellImage={async (file: File) => {
          if (!user) return null;
          try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('userId', user.id);
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            if (res.ok) {
              const { url } = await res.json();
              return url;
            }
            return null;
          } catch {
            return null;
          }
        }}
        onDeleteCellImage={async (url: string) => {
          try {
            const res = await fetch('/api/upload', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url }),
            });
            return res.ok;
          } catch {
            return false;
          }
        }}
        loading={addingWeeklyCal}
      />

      {/* Route Settings Modal for current folder */}
      {currentFolder && (
        <RouteSettingsModal
          folder={currentFolder}
          isOpen={showFolderRouteSettings}
          onClose={() => setShowFolderRouteSettings(false)}
          onSave={(config) => handleRouteConfigUpdate(currentFolder.id, config)}
          locale={locale as 'he' | 'en'}
        />
      )}
    </div>
  );
}
