'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Plus, LayoutGrid, List, Loader2, FolderPlus, ArrowLeft, Folder as FolderIcon, Home, Edit2, Check, X, ChevronDown, ChevronUp, Upload } from 'lucide-react';
import StorageBar from '@/components/layout/StorageBar';
import MediaUploader from '@/components/code/MediaUploader';
import CodeCard from '@/components/code/CodeCard';
import FolderCard from '@/components/code/FolderCard';
import DeleteConfirm from '@/components/modals/DeleteConfirm';
import TransferOwnershipModal from '@/components/modals/TransferOwnershipModal';
import { ViewMode, FilterOption, QRCode as QRCodeType, Folder } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { getUserQRCodes, getGlobalQRCodes, createQRCode, deleteQRCode, updateUserStorage, updateQRCode, getAllUsers, transferCodeOwnership, getUserFolders, createFolder, updateFolder, deleteFolder, moveCodeToFolder } from '@/lib/db';
import { subscribeToCodeViews, subscribeToTotalViews } from '@/lib/analytics';
import { clsx } from 'clsx';

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refreshUser, signInWithGoogle } = useAuth();
  const [codes, setCodes] = useState<QRCodeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
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
  const [deleteFolderModal, setDeleteFolderModal] = useState<{ isOpen: boolean; folder: Folder | null }>({
    isOpen: false,
    folder: null,
  });
  const [dragOverRoot, setDragOverRoot] = useState(false);
  const [editingFolderName, setEditingFolderName] = useState(false);
  const [folderNameInput, setFolderNameInput] = useState('');
  const [uploadSectionCollapsed, setUploadSectionCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('uploadSectionCollapsed') === 'true';
    }
    return false;
  });
  const [showLoginModal, setShowLoginModal] = useState(false);

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
          // Logged in - load user's codes and folders
          const [userCodes, userFolders] = await Promise.all([
            getUserQRCodes(user.id),
            getUserFolders(user.id),
          ]);
          setCodes(userCodes);
          setFolders(userFolders);

          // Load owner names for super admin
          if (user.role === 'super_admin') {
            const allUsers = await getAllUsers();
            const names: Record<string, string> = {};
            allUsers.forEach((u) => {
              names[u.id] = u.displayName;
            });
            setOwnerNames(names);
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

      // Create QR code in Firestore
      const newCode = await createQRCode(user.id, file.name, [
        {
          url: uploadData.url,
          type: uploadData.type,
          size: uploadData.size,
          order: 0,
          uploadedBy: user.id,
        },
      ]);

      // Update user storage
      await updateUserStorage(user.id, uploadData.size);
      await refreshUser();

      // Add to list
      setCodes((prev) => [newCode, ...prev]);

      // Navigate to edit page
      router.push(`/code/${newCode.id}`);
    } catch (error) {
      console.error('Error creating code:', error);
      alert('שגיאה ביצירת הקוד. נסה שוב.');
    } finally {
      setUploading(false);
    }
  };

  const handleLinkAdd = async (url: string) => {
    if (!user) return;

    setUploading(true);

    try {
      // Create QR code with link
      const newCode = await createQRCode(user.id, 'לינק חדש', [
        {
          url,
          type: 'link',
          size: 0,
          order: 0,
          uploadedBy: user.id,
        },
      ]);

      // Add to list
      setCodes((prev) => [newCode, ...prev]);

      // Navigate to edit page
      router.push(`/code/${newCode.id}`);
    } catch (error) {
      console.error('Error creating code:', error);
      alert('שגיאה ביצירת הקוד. נסה שוב.');
    } finally {
      setUploading(false);
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
      alert('שגיאה במחיקת הקוד. נסה שוב.');
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
      alert('שגיאה בעדכון השם. נסה שוב.');
    }
  };

  const handleTransferOwnership = async (newOwnerId: string, newOwnerName: string) => {
    if (!transferModal.code) return;

    try {
      await transferCodeOwnership(transferModal.code.id, newOwnerId);
      setCodes((prev) =>
        prev.map((c) =>
          c.id === transferModal.code?.id ? { ...c, ownerId: newOwnerId } : c
        )
      );
      // Update owner names cache
      setOwnerNames((prev) => ({ ...prev, [newOwnerId]: newOwnerName }));
    } catch (error) {
      console.error('Error transferring ownership:', error);
      alert('שגיאה בהעברת הבעלות. נסה שוב.');
    }
  };

  // Folder handlers
  const handleCreateFolder = async () => {
    if (!user) return;
    try {
      const newFolder = await createFolder(user.id, 'חוויה חדשה');
      setFolders((prev) => [newFolder, ...prev]);
    } catch (error) {
      console.error('Error creating folder:', error);
      alert('שגיאה ביצירת החוויה. נסה שוב.');
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
      alert('שגיאה בשינוי שם החוויה. נסה שוב.');
    }
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
      alert('שגיאה במחיקת החוויה. נסה שוב.');
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
      alert('שגיאה בהעברת הקוד. נסה שוב.');
    }
    setDraggingCodeId(null);
    setDragOverFolderId(null);
  };

  const handleReplaceFile = async (codeId: string, code: QRCodeType, file: File) => {
    if (!user) return;

    try {
      // Upload new file to Vercel Blob
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
        type: uploadData.type,
        size: uploadData.size,
        order: 0,
        uploadedBy: user.id,
        createdAt: new Date(),
      };

      await updateQRCode(codeId, { media: [newMedia] });

      // Update user storage: add new size
      await updateUserStorage(user.id, uploadData.size);
      await refreshUser();

      // Update local state
      setCodes((prev) =>
        prev.map((c) =>
          c.id === codeId ? { ...c, media: [newMedia], updatedAt: new Date() } : c
        )
      );
    } catch (error) {
      console.error('Error replacing file:', error);
      alert('שגיאה בהחלפת הקובץ. נסה שוב.');
    }
  };

  // Duplicate a code - creates new code with same media references (no actual file copy)
  const handleDuplicateCode = async (code: QRCodeType) => {
    if (!user) return;

    try {
      // Create new code with same media (just references, not copies)
      const newCode = await createQRCode(
        user.id,
        `${code.title} (עותק)`,
        code.media.map((m) => ({
          url: m.url,
          type: m.type,
          size: 0, // Don't count storage again since it's same file
          order: m.order,
          uploadedBy: user.id,
        }))
      );

      // Add to list
      setCodes((prev) => [newCode, ...prev]);
    } catch (error) {
      console.error('Error duplicating code:', error);
      alert('שגיאה בשכפול הקוד. נסה שוב.');
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
      alert('שגיאה בשינוי סטטוס גלובלי. נסה שוב.');
    }
  };

  const filteredCodes = codes.filter((code) => {
    // Filter by folder (only for logged in users)
    if (user) {
      const codeWithFolder = code as QRCodeType & { folderId?: string };
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

    // Filter by ownership based on user role (only for logged in users)
    if (user && filter === 'mine') {
      // "שלי" = only codes I created
      if (code.ownerId !== user.id) {
        return false;
      }
    }
    // "הכל" for admin = all codes from all users (already loaded in getUserQRCodes)
    // "הכל" for regular user = my codes + codes shared with me

    return true;
  });

  // Get current folder for header
  const currentFolder = currentFolderId ? folders.find((f) => f.id === currentFolderId) : null;

  // Count codes in each folder
  const getCodesInFolder = (folderId: string) => {
    return codes.filter((c) => (c as QRCodeType & { folderId?: string }).folderId === folderId).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Section */}
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
          .hero-subtitle {
            opacity: 0;
            animation: fadeIn 0.6s ease-out 0.8s forwards;
          }
        `}</style>
        <h1 className="hero-title text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
          One Code. Endless Experiences.
        </h1>
        <div className="hero-divider flex justify-center mb-4">
          <div className="hero-divider-line h-1 bg-gradient-to-r from-transparent via-accent to-transparent rounded-full" />
        </div>
        <p className="hero-subtitle text-sm sm:text-base md:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
          מבידור, הדרכות, הגרלות ומיפוי מסעות במרחב – יוצרים קוד, מדפיסים ומעדכנים את חווית הלקוח בזמן אמת
        </p>
      </div>

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
              <span className="font-medium text-text-primary">יצירת חוויה חדשה</span>
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
          <span className="font-medium text-text-primary">התחברו כדי ליצור חוויה</span>
        </button>
      )}

      {uploading && (
        <div className="flex items-center justify-center gap-2 py-4 text-accent">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>יוצר קוד חדש...</span>
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
            <span className="text-sm font-medium text-accent">שחרר כאן להעברה לדשבורד</span>
          </div>

          <div className="flex-1 flex items-center gap-3 p-4 bg-bg-card border border-border rounded-xl">
            <button
              onClick={() => setCurrentFolderId(null)}
              className="p-2 rounded-lg bg-bg-secondary text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
              title="חזור"
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
              {editingFolderName ? (
                <div className="flex items-center gap-2">
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
                </div>
              ) : (
                <h2
                  className="text-lg font-semibold text-text-primary cursor-pointer hover:text-accent transition-colors"
                  onClick={() => {
                    setFolderNameInput(currentFolder.name);
                    setEditingFolderName(true);
                  }}
                  title="לחץ לעריכת שם"
                >
                  {currentFolder.name}
                </h2>
              )}
              <p className="text-sm text-text-secondary">{filteredCodes.length} קודים</p>
            </div>
            {!editingFolderName && (
              <button
                onClick={() => {
                  setFolderNameInput(currentFolder.name);
                  setEditingFolderName(true);
                }}
                className="p-2 rounded-lg text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
                title="ערוך שם"
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
              הכל
            </button>
            <button
              onClick={() => setFilter('mine')}
              className={clsx(
                'flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                filter === 'mine' ? 'bg-accent text-white' : 'text-text-secondary'
              )}
            >
              My Q
            </button>
          </div>
        )}

        {/* Search - takes remaining space */}
        <div className="relative flex-1 min-w-0 order-2 sm:order-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
          <input
            type="text"
            placeholder="חיפוש..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10 w-full"
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
      {user && !currentFolderId && folders.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">חוויות</h2>
            <button
              onClick={handleCreateFolder}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10 rounded-lg transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
              חוויה חדשה
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {folders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                codesCount={getCodesInFolder(folder.id)}
                isOpen={currentFolderId === folder.id}
                isDragOver={dragOverFolderId === folder.id}
                onOpen={() => setCurrentFolderId(folder.id)}
                onDelete={() => handleDeleteFolder(folder)}
                onRename={(newName) => handleRenameFolder(folder.id, newName)}
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
          צור חוויה חדשה לארגון התוכן
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
              fileName={code.media[0]?.title}
              fileSize={code.media[0]?.size}
              views={totalViews[code.id] ?? code.views}
              views24h={views24h[code.id] || 0}
              updatedAt={code.updatedAt}
              isOwner={user?.id === code.ownerId}
              isGlobal={code.isGlobal}
              isGuest={!user}
              widgets={code.widgets}
              viewMode={viewMode}
              ownerName={ownerNames[code.ownerId] || (code.ownerId === user?.id ? user.displayName : undefined)}
              isSuperAdmin={user?.role === 'super_admin'}
              isDragging={draggingCodeId === code.id}
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
              ? 'אין חוויות גלובליות כרגע'
              : currentFolderId
                ? 'החוויה ריקה'
                : 'אין קודים עדיין'}
          </h3>
          <p className="text-text-secondary">
            {!user
              ? 'התחבר כדי ליצור חוויות משלך'
              : currentFolderId
                ? 'גרור קודים לכאן כדי להוסיף אותם לחוויה'
                : 'העלה תוכן או הוסף לינק ליצירת הקוד הראשון שלך'}
          </p>
          {!user && (
            <button
              onClick={() => router.push('/login')}
              className="mt-4 px-6 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-colors"
            >
              התחברו עכשיו
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
            <h3 className="text-lg font-semibold text-text-primary mb-2">מחיקת חוויה</h3>
            <p className="text-text-secondary mb-4">
              האם אתה בטוח שברצונך למחוק את החוויה &quot;{deleteFolderModal.folder.name}&quot;?
              <br />
              <span className="text-sm">הקודים בחוויה יועברו לדשבורד.</span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteFolderModal({ isOpen: false, folder: null })}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={confirmDeleteFolder}
                className="px-4 py-2 text-sm font-medium text-white bg-danger hover:bg-danger/90 rounded-lg transition-colors"
              >
                מחק
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
            <h3 className="text-lg font-semibold text-text-primary mb-2 text-center">התחבר כדי ליצור חוויה</h3>
            <p className="text-text-secondary mb-6 text-center text-sm">
              התחבר עם חשבון Google כדי ליצור ולנהל חוויות QR משלך
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
              התחבר עם Google
            </button>

            <button
              onClick={() => setShowLoginModal(false)}
              className="w-full py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              ביטול
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
