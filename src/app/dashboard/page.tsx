'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, LayoutGrid, List, Loader2, FolderPlus, ArrowLeft, Folder as FolderIcon, Home, Edit2, Check, X } from 'lucide-react';
import StorageBar from '@/components/layout/StorageBar';
import MediaUploader from '@/components/code/MediaUploader';
import CodeCard from '@/components/code/CodeCard';
import FolderCard from '@/components/code/FolderCard';
import DeleteConfirm from '@/components/modals/DeleteConfirm';
import TransferOwnershipModal from '@/components/modals/TransferOwnershipModal';
import { ViewMode, FilterOption, QRCode as QRCodeType, Folder } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { getUserQRCodes, createQRCode, deleteQRCode, updateUserStorage, updateQRCode, getAllUsers, transferCodeOwnership, getUserFolders, createFolder, updateFolder, deleteFolder, moveCodeToFolder } from '@/lib/db';
import { subscribeToCodeViews } from '@/lib/analytics';
import { clsx } from 'clsx';

export default function DashboardPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
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

  // Load user's codes, folders and owner names
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      try {
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
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  // Subscribe to real-time view counts for 24h
  useEffect(() => {
    if (codes.length === 0) return;

    const codeIds = codes.map((c) => c.id);
    const unsubscribe = subscribeToCodeViews(
      codeIds,
      (viewsData) => {
        setViews24h(viewsData);
      },
      (error) => {
        console.error('Error subscribing to views:', error);
      }
    );

    return () => {
      unsubscribe();
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
      const newFolder = await createFolder(user.id, 'ספריה חדשה');
      setFolders((prev) => [newFolder, ...prev]);
    } catch (error) {
      console.error('Error creating folder:', error);
      alert('שגיאה ביצירת הספריה. נסה שוב.');
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
      alert('שגיאה בשינוי שם הספריה. נסה שוב.');
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
      alert('שגיאה במחיקת הספריה. נסה שוב.');
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

  const filteredCodes = codes.filter((code) => {
    // Filter by folder
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

    // Filter by ownership based on user role
    if (filter === 'mine') {
      // "שלי" = only codes I created
      if (user && code.ownerId !== user.id) {
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
      {/* Storage Bar */}
      <StorageBar
        used={user?.storageUsed || 0}
        limit={user?.storageLimit || 25 * 1024 * 1024}
      />

      {/* Upload Section */}
      <MediaUploader
        onFileSelect={handleFileSelect}
        onLinkAdd={handleLinkAdd}
        disabled={uploading}
      />

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
            <span className="text-sm font-medium text-accent">שחרר כאן להעברה לראשי</span>
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

      {/* Toolbar */}
      <div className="space-y-3">
        {/* Top row - Filter tabs and Search */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Filter tabs - first on mobile */}
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
              שלי
            </button>
          </div>

          {/* Search */}
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

        {/* Bottom row - View controls (hidden on small mobile) */}
        <div className="flex items-center gap-2 justify-end">
          {/* Grid size controls - hide on small screens */}
          <div className="hidden sm:flex items-center gap-1 bg-bg-secondary rounded-lg p-1">
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

          {/* View mode toggle */}
          <div className="flex bg-bg-secondary rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={clsx(
                'p-2 rounded-md transition-colors',
                viewMode === 'list' ? 'bg-bg-card text-text-primary' : 'text-text-secondary'
              )}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={clsx(
                'p-2 rounded-md transition-colors',
                viewMode === 'grid' ? 'bg-bg-card text-text-primary' : 'text-text-secondary'
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Folders Section - only show at root level */}
      {!currentFolderId && folders.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">ספריות</h2>
            <button
              onClick={handleCreateFolder}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10 rounded-lg transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
              ספריה חדשה
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

      {/* Create Folder Button - show when no folders exist */}
      {!currentFolderId && folders.length === 0 && (
        <button
          onClick={handleCreateFolder}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-text-secondary hover:text-accent border border-dashed border-border hover:border-accent rounded-xl transition-colors w-full justify-center"
        >
          <FolderPlus className="w-5 h-5" />
          צור ספריה חדשה לארגון הקודים
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
              views={code.views}
              views24h={views24h[code.id] || 0}
              updatedAt={code.updatedAt}
              isOwner={user?.id === code.ownerId}
              isGlobal={!!code.widgets.whatsapp?.enabled}
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
            {currentFolderId ? 'הספריה ריקה' : 'אין קודים עדיין'}
          </h3>
          <p className="text-text-secondary">
            {currentFolderId
              ? 'גרור קודים לכאן כדי להוסיף אותם לספריה'
              : 'העלה קובץ או הוסף לינק ליצירת הקוד הראשון שלך'}
          </p>
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
            <h3 className="text-lg font-semibold text-text-primary mb-2">מחיקת ספריה</h3>
            <p className="text-text-secondary mb-4">
              האם אתה בטוח שברצונך למחוק את הספריה &quot;{deleteFolderModal.folder.name}&quot;?
              <br />
              <span className="text-sm">הקודים בספריה יועברו לרמה הראשית.</span>
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
    </div>
  );
}
