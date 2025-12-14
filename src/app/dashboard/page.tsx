'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, LayoutGrid, List, FolderOpen, Loader2 } from 'lucide-react';
import StorageBar from '@/components/layout/StorageBar';
import MediaUploader from '@/components/code/MediaUploader';
import CodeCard from '@/components/code/CodeCard';
import DeleteConfirm from '@/components/modals/DeleteConfirm';
import { ViewMode, FilterOption, QRCode as QRCodeType } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { getUserQRCodes, createQRCode, deleteQRCode, updateUserStorage, updateQRCode } from '@/lib/db';
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

  // Load user's codes
  useEffect(() => {
    const loadCodes = async () => {
      if (!user) return;

      try {
        const userCodes = await getUserQRCodes(user.id);
        setCodes(userCodes);
      } catch (error) {
        console.error('Error loading codes:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCodes();
  }, [user]);

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

    // Filter by ownership
    if (filter === 'mine' && user && code.ownerId !== user.id) {
      return false;
    }

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
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
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

        {/* Grid size controls */}
        <div className="flex items-center gap-1 bg-bg-secondary rounded-lg p-1">
          <button
            onClick={() => setGridSize(Math.max(2, gridSize - 1))}
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
          <button
            className="p-2 rounded-md text-text-secondary hover:text-text-primary transition-colors"
            title="בחירה מרובה"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex bg-bg-secondary rounded-lg p-1">
          <button
            onClick={() => setFilter('all')}
            className={clsx(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              filter === 'all' ? 'bg-bg-card text-text-primary' : 'text-text-secondary'
            )}
          >
            הכל
          </button>
          <button
            onClick={() => setFilter('mine')}
            className={clsx(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              filter === 'mine' ? 'bg-accent text-white' : 'text-text-secondary'
            )}
          >
            שלי
          </button>
        </div>
      </div>

      {/* Codes Grid/List */}
      {filteredCodes.length > 0 ? (
        <div
          className={clsx(
            'grid gap-4',
            viewMode === 'grid'
              ? `grid-cols-2 sm:grid-cols-3 lg:grid-cols-${gridSize}`
              : 'grid-cols-1'
          )}
          style={
            viewMode === 'grid'
              ? {
                  gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
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
              isOwner={user?.id === code.ownerId}
              isGlobal={!!code.widgets.whatsapp?.enabled}
              onDelete={() => handleDelete(code)}
              onRefresh={() => router.push(`/code/${code.id}`)}
              onPublish={() => router.push(`/code/${code.id}`)}
              onCopy={() => handleCopyLink(code.shortId)}
              onTitleChange={(newTitle) => handleTitleChange(code.id, newTitle)}
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
    </div>
  );
}
