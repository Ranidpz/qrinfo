'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, LayoutGrid, List, Loader2 } from 'lucide-react';
import StorageBar from '@/components/layout/StorageBar';
import MediaUploader from '@/components/code/MediaUploader';
import CodeCard from '@/components/code/CodeCard';
import DeleteConfirm from '@/components/modals/DeleteConfirm';
import TransferOwnershipModal from '@/components/modals/TransferOwnershipModal';
import { ViewMode, FilterOption, QRCode as QRCodeType } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { getUserQRCodes, createQRCode, deleteQRCode, updateUserStorage, updateQRCode, getAllUsers, transferCodeOwnership } from '@/lib/db';
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

  // Load user's codes and owner names
  useEffect(() => {
    const loadCodes = async () => {
      if (!user) return;

      try {
        const userCodes = await getUserQRCodes(user.id);
        setCodes(userCodes);

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
        console.error('Error loading codes:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCodes();
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

  const filteredCodes = codes.filter((code) => {
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
              onDelete={() => handleDelete(code)}
              onRefresh={() => router.push(`/code/${code.id}`)}
              onPublish={() => router.push(`/code/${code.id}`)}
              onCopy={() => handleCopyLink(code.shortId)}
              onTitleChange={(newTitle) => handleTitleChange(code.id, newTitle)}
              onTransferOwnership={() => setTransferModal({ isOpen: true, code })}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-bg-secondary flex items-center justify-center mx-auto mb-4">
            <Plus className="w-8 h-8 text-text-secondary" />
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-2">אין קודים עדיין</h3>
          <p className="text-text-secondary">העלה קובץ או הוסף לינק ליצירת הקוד הראשון שלך</p>
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
    </div>
  );
}
