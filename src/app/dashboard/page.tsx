'use client';

import { useState } from 'react';
import { Search, Plus, LayoutGrid, List, FolderOpen } from 'lucide-react';
import StorageBar from '@/components/layout/StorageBar';
import MediaUploader from '@/components/code/MediaUploader';
import CodeCard from '@/components/code/CodeCard';
import DeleteConfirm from '@/components/modals/DeleteConfirm';
import { ViewMode, FilterOption, QRCode } from '@/types';
import { clsx } from 'clsx';

// Mock data - will be replaced with real data from Firebase
const mockCodes: QRCode[] = [
  {
    id: '1',
    shortId: 'abc123',
    ownerId: 'user1',
    collaborators: [],
    title: 'fotomaster.webp',
    media: [{
      id: 'm1',
      url: '/placeholder.jpg',
      type: 'image',
      size: 99.7 * 1024,
      order: 0,
      uploadedBy: 'user1',
      createdAt: new Date(),
    }],
    widgets: {},
    views: 42,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    shortId: 'def456',
    ownerId: 'user1',
    collaborators: [],
    title: 'אני',
    media: [{
      id: 'm2',
      url: '/placeholder.jpg',
      type: 'image',
      size: 148.1 * 1024,
      order: 0,
      uploadedBy: 'user1',
      createdAt: new Date(),
    }],
    widgets: { whatsapp: { enabled: true, groupLink: 'https://chat.whatsapp.com/xxx' } },
    views: 128,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '3',
    shortId: 'ghi789',
    ownerId: 'user1',
    collaborators: [],
    title: 'jpg.1_0',
    media: [{
      id: 'm3',
      url: '/placeholder.jpg',
      type: 'image',
      size: 175.3 * 1024,
      order: 0,
      uploadedBy: 'user1',
      createdAt: new Date(),
    }],
    widgets: {},
    views: 56,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '4',
    shortId: 'jkl012',
    ownerId: 'user1',
    collaborators: [],
    title: 'jpg.1_0',
    media: [{
      id: 'm4',
      url: '/placeholder.jpg',
      type: 'image',
      size: 158.9 * 1024,
      order: 0,
      uploadedBy: 'user1',
      createdAt: new Date(),
    }],
    widgets: {},
    views: 23,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export default function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filter, setFilter] = useState<FilterOption>('mine');
  const [gridSize, setGridSize] = useState(4);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; code: QRCode | null }>({
    isOpen: false,
    code: null,
  });

  // Mock storage data
  const storageUsed = 581.9 * 1024; // 581.9 KB
  const storageLimit = 50 * 1024 * 1024; // 50 MB

  const handleFileSelect = (file: File) => {
    console.log('File selected:', file);
    // TODO: Upload file and create new code
  };

  const handleLinkAdd = (url: string) => {
    console.log('Link added:', url);
    // TODO: Create new code with link
  };

  const handleDelete = (code: QRCode) => {
    setDeleteModal({ isOpen: true, code });
  };

  const confirmDelete = () => {
    if (deleteModal.code) {
      console.log('Deleting code:', deleteModal.code.id);
      // TODO: Delete code from Firebase
    }
    setDeleteModal({ isOpen: false, code: null });
  };

  const handleCopyLink = (shortId: string) => {
    const url = `${window.location.origin}/v/${shortId}`;
    navigator.clipboard.writeText(url);
    // TODO: Show toast notification
  };

  const filteredCodes = mockCodes.filter(code => {
    if (searchQuery) {
      return code.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
             code.shortId.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Storage Bar */}
      <StorageBar used={storageUsed} limit={storageLimit} />

      {/* Upload Section */}
      <MediaUploader
        onFileSelect={handleFileSelect}
        onLinkAdd={handleLinkAdd}
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type="text"
            placeholder="חיפוש..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pr-10"
          />
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
          style={viewMode === 'grid' ? {
            gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`
          } : undefined}
        >
          {filteredCodes.map((code) => (
            <CodeCard
              key={code.id}
              id={code.id}
              shortId={code.shortId}
              title={code.title}
              thumbnail={code.media[0]?.url}
              mediaType={code.media[0]?.type || 'image'}
              fileSize={code.media[0]?.size}
              views={code.views}
              isOwner={true}
              isGlobal={!!code.widgets.whatsapp?.enabled}
              onDelete={() => handleDelete(code)}
              onRefresh={() => console.log('Refresh', code.id)}
              onPublish={() => console.log('Publish', code.id)}
              onCopy={() => handleCopyLink(code.shortId)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-bg-secondary flex items-center justify-center mx-auto mb-4">
            <Plus className="w-8 h-8 text-text-secondary" />
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-2">
            אין קודים עדיין
          </h3>
          <p className="text-text-secondary">
            העלה קובץ או הוסף לינק ליצירת הקוד הראשון שלך
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
    </div>
  );
}
