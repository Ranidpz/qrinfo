'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Search, Check, X, Trash2, Loader2, Plus, Image as ImageIcon, ShieldCheck, Clock, User, Pencil,
} from 'lucide-react';
import { onSnapshot, doc, getDoc, updateDoc, arrayUnion, increment, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadQueue } from '@/lib/uploadQueue';
import { cropImageToSquareWebp } from '@/lib/imageCrop';
import { UserGalleryImage } from '@/types';

interface SelfiebeamPhotoManagerProps {
  codeId: string;
  ownerId: string;
}

type FilterMode = 'all' | 'pending' | 'approved';

interface RawGalleryEntry {
  id: string;
  url: string;
  size?: number;
  storageProvider?: UserGalleryImage['storageProvider'];
  storageKey?: string;
  storageBucket?: string;
  contentType?: string;
  uploaderName: string;
  uploadedAt: unknown;
  approved?: boolean;
  source?: 'admin' | 'participant';
}

const PAGE = 60; // lazy-load page size — grid renders more as you scroll
const ANON = ['אנונימי', 'Anonymous'];

export default function SelfiebeamPhotoManager({ codeId, ownerId }: SelfiebeamPhotoManagerProps) {
  const t = useTranslations('modals');

  const [images, setImages] = useState<UserGalleryImage[]>([]);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [approvingAll, setApprovingAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busyBulk, setBusyBulk] = useState(false);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [lastBatch, setLastBatch] = useState<{ count: number; at: Date } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live subscription to the code's gallery pool.
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'codes', codeId), (snap) => {
      if (!snap.exists()) return;
      const raw = (snap.data().userGallery || []) as RawGalleryEntry[];
      const mapped: UserGalleryImage[] = raw.map((img) => ({
        id: img.id,
        url: img.url,
        size: img.size,
        storageProvider: img.storageProvider,
        storageKey: img.storageKey,
        storageBucket: img.storageBucket,
        contentType: img.contentType,
        uploaderName: img.uploaderName,
        approved: img.approved,
        source: img.source,
        uploadedAt:
          img.uploadedAt && typeof (img.uploadedAt as { toDate?: () => Date }).toDate === 'function'
            ? (img.uploadedAt as { toDate: () => Date }).toDate()
            : new Date(img.uploadedAt as string | number),
      }));
      mapped.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      setImages(mapped);
      // Drop selections that no longer exist
      setSelectedIds((prev) => {
        if (prev.size === 0) return prev;
        const ids = new Set(mapped.map((m) => m.id));
        const next = new Set([...prev].filter((id) => ids.has(id)));
        return next.size === prev.size ? prev : next;
      });
    });
    return () => unsub();
  }, [codeId]);

  const pendingCount = useMemo(() => images.filter((i) => i.approved === false).length, [images]);
  const approvedCount = images.length - pendingCount;

  // Full filtered set (newest first — `images` is already sorted desc), then a lazily
  // grown render window so even thousands of photos stay smooth.
  const [renderLimit, setRenderLimit] = useState(PAGE);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return images
      .filter((i) => (filter === 'pending' ? i.approved === false : filter === 'approved' ? i.approved !== false : true))
      .filter((i) => (q ? (i.uploaderName || '').toLowerCase().includes(q) : true));
  }, [images, filter, search]);
  const visible = useMemo(() => filtered.slice(0, renderLimit), [filtered, renderLimit]);

  // Reset the window when the filter/search changes.
  useEffect(() => { setRenderLimit(PAGE); }, [filter, search]);

  // Infinite scroll: load the next page when scrolled near the bottom of the grid.
  const onGridScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) {
      setRenderLimit((prev) => (prev < filtered.length ? prev + PAGE : prev));
    }
  };

  // --- Bulk upload (admin seed → approved, source 'admin') ---
  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
      if (files.length === 0) return;

      setUploading({ done: 0, total: files.length });
      try {
        const items = await Promise.all(
          files.map(async (file, i) => {
            const blob = await cropImageToSquareWebp(file, { size: 1000, quality: 0.82 });
            const fd = new FormData();
            fd.append('file', blob, `seed_${Date.now()}_${i}.webp`);
            fd.append('codeId', codeId);
            fd.append('ownerId', ownerId);
            fd.append('uploaderName', '');
            return { formData: fd, label: file.name };
          })
        );

        const result = await uploadQueue.uploadBatch(items, '/api/gallery', (p) =>
          setUploading({ done: p.completed + p.failed, total: p.total })
        );

        let totalSize = 0;
        const entries = result.successful
          .map(({ data }) => (data as { image?: RawGalleryEntry }).image)
          .filter((img): img is RawGalleryEntry => !!img)
          .map((img) => {
            totalSize += img.size || 0;
            return {
              id: img.id,
              url: img.url,
              ...(img.size ? { size: img.size } : {}),
              ...(img.storageProvider ? { storageProvider: img.storageProvider } : {}),
              ...(img.storageKey ? { storageKey: img.storageKey } : {}),
              ...(img.storageBucket ? { storageBucket: img.storageBucket } : {}),
              ...(img.contentType ? { contentType: img.contentType } : {}),
              uploaderName: 'אנונימי',
              approved: true,
              source: 'admin' as const,
              uploadedAt: Timestamp.now(),
            };
          });

        if (entries.length > 0) {
          await updateDoc(doc(db, 'codes', codeId), { userGallery: arrayUnion(...entries) });
          if (totalSize > 0) {
            await updateDoc(doc(db, 'users', ownerId), { storageUsed: increment(totalSize) });
          }
          setLastBatch({ count: entries.length, at: new Date() });
        }
      } catch (err) {
        console.error('Beam photo upload failed:', err);
      } finally {
        setUploading(null);
      }
    },
    [codeId, ownerId]
  );

  const markBusy = (id: string, busy: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });

  // --- Single approve / reject ---
  const setApproval = async (id: string, approved: boolean) => {
    markBusy(id, true);
    try {
      const ref = doc(db, 'codes', codeId);
      const snap = await getDoc(ref);
      const gallery = (snap.data()?.userGallery || []) as RawGalleryEntry[];
      await updateDoc(ref, { userGallery: gallery.map((g) => (g.id === id ? { ...g, approved } : g)) });
    } catch (err) {
      console.error('Failed to update approval:', err);
    } finally {
      markBusy(id, false);
    }
  };

  const approveAllPending = async () => {
    setApprovingAll(true);
    try {
      const ref = doc(db, 'codes', codeId);
      const snap = await getDoc(ref);
      const gallery = (snap.data()?.userGallery || []) as RawGalleryEntry[];
      await updateDoc(ref, { userGallery: gallery.map((g) => (g.approved === false ? { ...g, approved: true } : g)) });
    } catch (err) {
      console.error('Failed to approve all:', err);
    } finally {
      setApprovingAll(false);
    }
  };

  const deleteImage = async (img: UserGalleryImage) => {
    markBusy(img.id, true);
    try {
      await fetch('/api/gallery', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: img.url, codeId }),
      });
      const ref = doc(db, 'codes', codeId);
      const snap = await getDoc(ref);
      const gallery = (snap.data()?.userGallery || []) as RawGalleryEntry[];
      await updateDoc(ref, { userGallery: gallery.filter((g) => g.id !== img.id) });
    } catch (err) {
      console.error('Failed to delete image:', err);
    } finally {
      markBusy(img.id, false);
    }
  };

  // --- Name editing ---
  const startEditName = (img: UserGalleryImage) => {
    setEditingNameId(img.id);
    setEditNameValue(ANON.includes(img.uploaderName) ? '' : img.uploaderName);
  };

  const saveName = async (id: string) => {
    const name = editNameValue.trim() || 'אנונימי';
    setEditingNameId(null);
    try {
      const ref = doc(db, 'codes', codeId);
      const snap = await getDoc(ref);
      const gallery = (snap.data()?.userGallery || []) as RawGalleryEntry[];
      await updateDoc(ref, { userGallery: gallery.map((g) => (g.id === id ? { ...g, uploaderName: name } : g)) });
    } catch (err) {
      console.error('Failed to save name:', err);
    }
  };

  // --- Multi-select (with Shift-click range) ---
  const lastIndexRef = useRef<number | null>(null);

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Click handler that supports Shift-click to select the whole range from the last clicked photo.
  const handleSelectClick = (index: number, shiftKey: boolean) => {
    const anchor = lastIndexRef.current;
    if (shiftKey && anchor !== null && anchor < visible.length) {
      const start = Math.min(anchor, index);
      const end = Math.max(anchor, index);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) next.add(visible[i].id);
        return next;
      });
    } else {
      toggleSelect(visible[index].id);
    }
    lastIndexRef.current = index;
  };

  const selectAllVisible = () => setSelectedIds(new Set(filtered.map((i) => i.id)));
  const clearSelection = () => {
    setSelectedIds(new Set());
    lastIndexRef.current = null;
  };

  const bulkSetApproval = async (approved: boolean) => {
    if (selectedIds.size === 0) return;
    setBusyBulk(true);
    try {
      const ref = doc(db, 'codes', codeId);
      const snap = await getDoc(ref);
      const gallery = (snap.data()?.userGallery || []) as RawGalleryEntry[];
      await updateDoc(ref, { userGallery: gallery.map((g) => (selectedIds.has(g.id) ? { ...g, approved } : g)) });
      clearSelection();
    } catch (err) {
      console.error('Bulk approval failed:', err);
    } finally {
      setBusyBulk(false);
    }
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBusyBulk(true);
    try {
      const toDelete = images.filter((i) => selectedIds.has(i.id));
      await Promise.all(
        toDelete.map((img) =>
          fetch('/api/gallery', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: img.url, codeId }),
          }).catch(() => {})
        )
      );
      const ref = doc(db, 'codes', codeId);
      const snap = await getDoc(ref);
      const gallery = (snap.data()?.userGallery || []) as RawGalleryEntry[];
      await updateDoc(ref, { userGallery: gallery.filter((g) => !selectedIds.has(g.id)) });
      clearSelection();
    } catch (err) {
      console.error('Bulk delete failed:', err);
    } finally {
      setBusyBulk(false);
    }
  };

  const filterTabs: { key: FilterMode; label: string; count: number }[] = [
    { key: 'all', label: t('selfiebeamPhotoAll'), count: images.length },
    { key: 'pending', label: t('selfiebeamPhotoPending'), count: pendingCount },
    { key: 'approved', label: t('selfiebeamPhotoApproved'), count: approvedCount },
  ];

  const selectionMode = selectedIds.size > 0;

  return (
    <div className="space-y-4">
      {/* Drop area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        className={`w-full flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
          isDragging ? 'border-accent bg-accent/10' : 'border-border hover:border-accent text-text-secondary'
        }`}
      >
        {uploading ? (
          <>
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
            <span className="text-sm">{t('selfiebeamPhotoUploading', { done: uploading.done, total: uploading.total })}</span>
          </>
        ) : (
          <>
            <Plus className="w-6 h-6" />
            <span className="text-sm">{t('selfiebeamDragPhotosHere')}</span>
          </>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
      />

      {/* Toolbar: search + filter, OR bulk-action bar when items are selected */}
      {selectionMode ? (
        <div className="flex items-center justify-between gap-2 flex-wrap bg-accent/10 border border-accent/30 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">{t('selfiebeamSelected', { count: selectedIds.size })}</span>
            <button onClick={selectAllVisible} className="text-xs text-accent hover:underline">{t('selfiebeamSelectAll')}</button>
            <button onClick={clearSelection} className="text-xs text-text-secondary hover:underline">{t('selfiebeamClearSelection')}</button>
          </div>
          <div className="flex items-center gap-1.5">
            {busyBulk && <Loader2 className="w-4 h-4 animate-spin text-text-secondary" />}
            <button onClick={() => bulkSetApproval(true)} disabled={busyBulk} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-green-500/15 text-green-500 hover:bg-green-500/25 text-sm font-medium disabled:opacity-50">
              <Check className="w-4 h-4" />{t('selfiebeamBulkApprove')}
            </button>
            <button onClick={() => bulkSetApproval(false)} disabled={busyBulk} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 text-sm font-medium disabled:opacity-50">
              <Clock className="w-4 h-4" />{t('selfiebeamBulkUnapprove')}
            </button>
            <button onClick={bulkDelete} disabled={busyBulk} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-red-500/15 text-red-500 hover:bg-red-500/25 text-sm font-medium disabled:opacity-50">
              <Trash2 className="w-4 h-4" />{t('selfiebeamBulkDelete')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('selfiebeamPhotoSearch')}
              className="input w-full ps-9"
            />
          </div>
          <div className="flex items-center gap-1 bg-bg-secondary rounded-lg p-1">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filter === tab.key ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {tab.label}
                <span className={`ms-1.5 text-xs ${filter === tab.key ? 'text-white/80' : 'text-text-secondary'}`}>{tab.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {pendingCount > 0 && !selectionMode && (
        <button
          onClick={approveAllPending}
          disabled={approvingAll}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-green-500/15 text-green-500 hover:bg-green-500/25 transition-colors text-sm font-medium disabled:opacity-50"
        >
          {approvingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          {t('selfiebeamPhotoApproveAll', { count: pendingCount })}
        </button>
      )}

      {/* Last upload batch info */}
      {lastBatch && (
        <p className="text-xs text-text-secondary flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
          {t('selfiebeamAddedBatch', {
            count: lastBatch.count,
            when: lastBatch.at.toLocaleString(undefined, {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
          })}
        </p>
      )}

      {/* Grid */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
          <ImageIcon className="w-10 h-10 mb-2 opacity-40" />
          <p className="text-sm">{t('selfiebeamPhotoEmpty')}</p>
        </div>
      ) : (
        <div onScroll={onGridScroll} className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 max-h-[52vh] overflow-y-auto pe-1">
          {visible.map((img, index) => {
            const isPending = img.approved === false;
            const isBusy = busyIds.has(img.id);
            const isSelected = selectedIds.has(img.id);
            const isEditing = editingNameId === img.id;
            const showName = img.uploaderName && !ANON.includes(img.uploaderName);
            return (
              <div
                key={img.id}
                onClick={(e) => !isEditing && handleSelectClick(index, e.shiftKey)}
                className={`relative aspect-square rounded-lg overflow-hidden bg-bg-secondary group cursor-pointer select-none ${
                  isSelected ? 'ring-2 ring-accent' : isPending ? 'ring-2 ring-amber-500' : ''
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.uploaderName}
                  className={`w-full h-full object-cover transition ${isPending ? 'opacity-60' : ''} ${isSelected ? 'scale-95' : ''}`}
                  loading="lazy"
                />

                {/* Selection checkbox (top-start) — always clickable, above the hover overlay */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleSelectClick(index, e.shiftKey); }}
                  title={t('selfiebeamSelectAll')}
                  className={`absolute top-1 start-1 z-20 w-6 h-6 rounded-md flex items-center justify-center border-2 transition-colors ${
                    isSelected ? 'bg-accent border-accent' : 'bg-black/40 border-white/70 hover:bg-black/60'
                  }`}
                >
                  {isSelected && <Check className="w-4 h-4 text-white" />}
                </button>

                {/* Pending badge (top-end) */}
                {isPending && (
                  <span className="absolute top-1 end-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500 text-white text-[9px] font-bold">
                    <Clock className="w-2.5 h-2.5" />{t('selfiebeamPhotoPending')}
                  </span>
                )}

                {/* Name (bottom) — editable */}
                {isEditing ? (
                  <div className="absolute bottom-0 inset-x-0 p-1 bg-black/80" onClick={(e) => e.stopPropagation()}>
                    <input
                      autoFocus
                      value={editNameValue}
                      onChange={(e) => setEditNameValue(e.target.value)}
                      onBlur={() => saveName(img.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveName(img.id);
                        if (e.key === 'Escape') setEditingNameId(null);
                      }}
                      placeholder={t('selfiebeamNamePlaceholder')}
                      className="w-full bg-transparent text-white text-[11px] text-center outline-none placeholder:text-white/40"
                      dir="auto"
                    />
                  </div>
                ) : (
                  <span className="absolute bottom-0 inset-x-0 px-1.5 py-1 bg-gradient-to-t from-black/85 to-transparent text-white text-[10px] truncate flex items-center gap-1">
                    {img.source === 'participant' && <User className="w-2.5 h-2.5 shrink-0 text-purple-300" />}
                    <span className={`truncate ${showName ? '' : 'text-white/50'}`}>{showName ? img.uploaderName : t('selfiebeamPhotoParticipant')}</span>
                  </span>
                )}

                {/* Hover overlay — single-item actions. The overlay background does NOT stop
                    propagation, so clicking it toggles selection; only the buttons stop it. */}
                {!isEditing && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center gap-1.5 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isBusy ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <>
                        {isPending ? (
                          <button onClick={(e) => { e.stopPropagation(); setApproval(img.id, true); }} title={t('selfiebeamPhotoApprove')} className="p-1.5 rounded-full bg-green-500 text-white hover:bg-green-600">
                            <Check className="w-4 h-4" />
                          </button>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); setApproval(img.id, false); }} title={t('selfiebeamPhotoReject')} className="p-1.5 rounded-full bg-amber-500 text-white hover:bg-amber-600">
                            <Clock className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); startEditName(img); }} title={t('selfiebeamEditName')} className="p-1.5 rounded-full bg-white/20 text-white hover:bg-white/30">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); deleteImage(img); }} title={t('selfiebeamPhotoDelete')} className="p-1.5 rounded-full bg-red-500 text-white hover:bg-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {filtered.length > visible.length && (
        <p className="text-xs text-text-secondary text-center">{t('selfiebeamPhotoCount', { shown: visible.length, count: filtered.length })}</p>
      )}
    </div>
  );
}
