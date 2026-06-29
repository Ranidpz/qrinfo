'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations, useLocale } from 'next-intl';
import {
  Search, Check, X, Trash2, Loader2, Plus, Image as ImageIcon, ShieldCheck, Clock, User, Pencil,
  Pin, PinOff, ArrowUp, AlertTriangle, Flag,
} from 'lucide-react';
import { onSnapshot, doc, getDoc, updateDoc, arrayUnion, increment, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadQueue } from '@/lib/uploadQueue';
import { cropImageToSquareWebp } from '@/lib/imageCrop';
import { hashFile } from '@/lib/imageHash';
import { UserGalleryImage } from '@/types';
import { searchCountries, countryName, toCountryTag, type SelfiebeamCountry } from '@/lib/selfiebeam/countries';

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
  fileHash?: string;
  pinned?: boolean;
  country?: UserGalleryImage['country'];
}

const PAGE = 60; // lazy-load page size — grid renders more as you scroll
const ANON = ['אנונימי', 'Anonymous'];

// Instant, styled tooltip (no browser-default `title` delay). Rendered via a portal to
// <body> with fixed positioning so it's never clipped by the scrolling grid (overflow-hidden)
// and always sits ABOVE the trigger, on either side of the modal. Position is measured on
// hover from the trigger's bounding rect.
function IconTip({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);

  const show = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setTip({ x: r.left + r.width / 2, y: r.top }); // center-x, top edge of the trigger
  };
  const hide = () => setTip(null);

  return (
    <span ref={ref} className="inline-flex" onMouseEnter={show} onMouseLeave={hide} onClick={hide}>
      {children}
      {tip && typeof document !== 'undefined' && createPortal(
        <span
          className="pointer-events-none fixed z-[100] -translate-x-1/2 -translate-y-full mb-0 px-2 py-1 rounded-md bg-gray-900 text-white text-[11px] font-medium whitespace-nowrap shadow-lg border border-white/10"
          style={{ left: tip.x, top: tip.y - 6 }}
        >
          {label}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-gray-900" />
        </span>,
        document.body
      )}
    </span>
  );
}

// Per-photo country flag picker for the editor. A toolbar button opens a dark, editor-themed
// dropdown (portaled to <body> so the scrolling grid never clips it) with search + flag list.
function EditorCountryControl({
  current,
  onPick,
  locale,
  labels,
}: {
  current?: UserGalleryImage['country'];
  onPick: (country: SelfiebeamCountry | null) => void;
  locale: 'he' | 'en';
  labels: { tip: string; search: string; remove: string; noResults: string };
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ x: number; bottom: number } | null>(null);
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchCountries(query), [query]);
  const dir = locale === 'he' ? 'rtl' : 'ltr';

  const open = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setQuery('');
    setPos({ x: r.left + r.width / 2, bottom: window.innerHeight - r.top + 8 });
  };
  const close = () => setPos(null);

  return (
    <>
      <IconTip label={labels.tip}>
        <button
          ref={btnRef}
          onClick={(e) => { e.stopPropagation(); if (pos) close(); else open(); }}
          className="p-1 rounded-md bg-white/25 text-white hover:bg-white/40 flex items-center justify-center"
        >
          {current?.flag ? (
            <img src={current.flag} alt="" className="w-3.5 h-2.5 object-cover rounded-[1px]" />
          ) : (
            <Flag className="w-3.5 h-3.5" />
          )}
        </button>
      </IconTip>
      {pos && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[99]" onClick={(e) => { e.stopPropagation(); close(); }} />
          <div
            dir={dir}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-[100] -translate-x-1/2 w-56 max-h-72 overflow-hidden rounded-lg bg-bg-card border border-border shadow-xl flex flex-col"
            style={{ left: pos.x, bottom: pos.bottom }}
          >
            <div className="p-2 border-b border-border">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={labels.search}
                className="w-full px-2.5 py-1.5 text-sm bg-black/20 border border-border rounded-md text-text-primary placeholder:text-text-secondary outline-none focus:border-accent"
              />
            </div>
            <div className="overflow-y-auto">
              {current && (
                <button
                  onClick={() => { onPick(null); close(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-white/5"
                >
                  <X className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-start">{labels.remove}</span>
                </button>
              )}
              {results.length === 0 ? (
                <div className="px-3 py-3 text-xs text-text-secondary text-center">{labels.noResults}</div>
              ) : (
                results.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => { onPick(c); close(); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-white/5 ${current?.code === c.code ? 'bg-accent/15' : ''}`}
                  >
                    <img src={c.flag} alt="" className="w-6 h-4 object-cover rounded-[2px] shrink-0" />
                    <span className="truncate text-start flex-1">{countryName(c, locale)}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

export default function SelfiebeamPhotoManager({ codeId, ownerId }: SelfiebeamPhotoManagerProps) {
  const t = useTranslations('modals');
  const locale = (useLocale() === 'he' ? 'he' : 'en') as 'he' | 'en';

  const [images, setImages] = useState<UserGalleryImage[]>([]);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [approvingAll, setApprovingAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busyBulk, setBusyBulk] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  // Drag-to-replace: a new file dropped onto an existing photo, awaiting confirm.
  const [replaceTarget, setReplaceTarget] = useState<{ target: UserGalleryImage; file: File } | null>(null);
  const [replacePreview, setReplacePreview] = useState<string>('');
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [lastBatch, setLastBatch] = useState<{ count: number; at: Date } | null>(null);
  const [pendingDupes, setPendingDupes] = useState<File[] | null>(null);
  const [dupeThumbs, setDupeThumbs] = useState<string[]>([]);
  const [skipInfo, setSkipInfo] = useState<{ uploaded: number; skipped: number } | null>(null);
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
        fileHash: img.fileHash,
        pinned: img.pinned,
        country: img.country,
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

  // Build small previews for the duplicates banner (first 6 only). The files are already in
  // memory, so object URLs are instant and free — just remember to revoke them on cleanup.
  const DUPE_THUMB_MAX = 6;
  useEffect(() => {
    if (!pendingDupes || pendingDupes.length === 0) {
      setDupeThumbs([]);
      return;
    }
    const urls = pendingDupes.slice(0, DUPE_THUMB_MAX).map((f) => URL.createObjectURL(f));
    setDupeThumbs(urls);
    return () => { urls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [pendingDupes]);

  // Revoke the replace-preview object URL if the component unmounts mid-flow.
  const replacePreviewRef = useRef('');
  useEffect(() => { replacePreviewRef.current = replacePreview; }, [replacePreview]);
  useEffect(() => () => { if (replacePreviewRef.current) URL.revokeObjectURL(replacePreviewRef.current); }, []);

  // Infinite scroll: load the next page when scrolled near the bottom of the grid.
  const onGridScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) {
      setRenderLimit((prev) => (prev < filtered.length ? prev + PAGE : prev));
    }
  };

  // --- Bulk upload (admin seed → approved, source 'admin') ---
  // Dedup key is the SHA-256 of the ORIGINAL file bytes (see lib/imageHash). Same content ⇒
  // skipped even if renamed; a different image that happens to share a name still uploads.
  // `allowDuplicates` is the "upload anyway" override path.
  const handleFiles = useCallback(
    async (fileList: FileList | File[], allowDuplicates = false) => {
      const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
      if (files.length === 0) return;

      setUploading({ done: 0, total: files.length });
      setSkipInfo(null);
      try {
        // 1) Hash original bytes, then split into new vs already-seen (existing pool + this batch).
        const hashes = await Promise.all(files.map((f) => hashFile(f)));
        const existing = new Set(
          images.map((i) => i.fileHash).filter((h): h is string => !!h)
        );
        const batchSeen = new Set<string>();
        const newFiles: File[] = [];
        const newHashes: string[] = [];
        const dupes: File[] = [];
        files.forEach((file, i) => {
          const h = hashes[i];
          if (!allowDuplicates && (existing.has(h) || batchSeen.has(h))) {
            dupes.push(file);
            return;
          }
          batchSeen.add(h);
          newFiles.push(file);
          newHashes.push(h);
        });

        // 2) Upload only the new ones. `successful` carries each item's original index,
        //    so we can attach the right fileHash back to each entry.
        let uploadedCount = 0;
        if (newFiles.length > 0) {
          setUploading({ done: 0, total: newFiles.length });
          const items = await Promise.all(
            newFiles.map(async (file, i) => {
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
            .map(({ index, data }) => {
              const img = (data as { image?: RawGalleryEntry }).image;
              if (!img) return null;
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
                fileHash: newHashes[index],
                uploadedAt: Timestamp.now(),
              };
            })
            .filter((e): e is NonNullable<typeof e> => !!e);

          if (entries.length > 0) {
            await updateDoc(doc(db, 'codes', codeId), { userGallery: arrayUnion(...entries) });
            if (totalSize > 0) {
              await updateDoc(doc(db, 'users', ownerId), { storageUsed: increment(totalSize) });
            }
            uploadedCount = entries.length;
            setLastBatch({ count: entries.length, at: new Date() });
          }
        }

        // 3) Surface duplicates so the operator can skip (default) or "upload anyway".
        setPendingDupes(dupes.length > 0 ? dupes : null);
        setSkipInfo({ uploaded: uploadedCount, skipped: dupes.length });
      } catch (err) {
        console.error('Beam photo upload failed:', err);
      } finally {
        setUploading(null);
      }
    },
    [codeId, ownerId, images]
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

  // Reclaim a user's storage quota after deletes. Admin-seed entries carry `size`; older
  // rows without it contribute 0. Guard against ever pushing storageUsed below zero.
  const reclaimStorage = async (entries: RawGalleryEntry[]) => {
    const freed = entries.reduce((sum, e) => sum + (e.size || 0), 0);
    if (freed <= 0) return;
    try {
      await updateDoc(doc(db, 'users', ownerId), { storageUsed: increment(-freed) });
    } catch (err) {
      console.error('Failed to reclaim storage:', err);
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
      const removed = gallery.filter((g) => g.id === img.id);
      await updateDoc(ref, { userGallery: gallery.filter((g) => g.id !== img.id) });
      await reclaimStorage(removed);
    } catch (err) {
      console.error('Failed to delete image:', err);
    } finally {
      markBusy(img.id, false);
    }
  };

  // --- Drag-to-replace: drop a new image on an existing photo to swap it in place. ---
  // Opens a confirm modal; on confirm we upload the new file, swap it into the SAME gallery
  // slot (preserving position + pinned state), then delete the old object from storage and
  // reconcile the owner's quota. The new file inherits the old one's pinned flag.
  const openReplace = (target: UserGalleryImage, file: File) => {
    if (replacePreview) URL.revokeObjectURL(replacePreview);
    setReplacePreview(URL.createObjectURL(file));
    setReplaceTarget({ target, file });
  };

  const cancelReplace = () => {
    if (replacePreview) URL.revokeObjectURL(replacePreview);
    setReplacePreview('');
    setReplaceTarget(null);
  };

  const confirmReplace = async () => {
    if (!replaceTarget) return;
    const { target, file } = replaceTarget;
    setReplacing(true);
    markBusy(target.id, true);
    try {
      // 1) Upload the replacement through the same path as a normal admin add.
      const fileHash = await hashFile(file);
      const blob = await cropImageToSquareWebp(file, { size: 1000, quality: 0.82 });
      const fd = new FormData();
      fd.append('file', blob, `replace_${Date.now()}.webp`);
      fd.append('codeId', codeId);
      fd.append('ownerId', ownerId);
      fd.append('uploaderName', '');
      const res = await fetch('/api/gallery', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`Replace upload failed: ${res.status}`);
      const data = (await res.json()) as { image?: RawGalleryEntry };
      const up = data.image;
      if (!up) throw new Error('Replace upload returned no image');

      // 2) Swap the new entry into the old one's slot (keep position + pinned + name).
      const ref = doc(db, 'codes', codeId);
      const snap = await getDoc(ref);
      const gallery = (snap.data()?.userGallery || []) as RawGalleryEntry[];
      const oldEntry = gallery.find((g) => g.id === target.id);
      const newEntry: RawGalleryEntry = {
        id: up.id,
        url: up.url,
        ...(up.size ? { size: up.size } : {}),
        ...(up.storageProvider ? { storageProvider: up.storageProvider } : {}),
        ...(up.storageKey ? { storageKey: up.storageKey } : {}),
        ...(up.storageBucket ? { storageBucket: up.storageBucket } : {}),
        ...(up.contentType ? { contentType: up.contentType } : {}),
        uploaderName: oldEntry?.uploaderName || 'אנונימי',
        approved: true,
        source: 'admin',
        fileHash,
        ...(oldEntry?.pinned ? { pinned: true } : {}),
        ...(oldEntry?.country ? { country: oldEntry.country } : {}),
        uploadedAt: Timestamp.now(),
      };
      await updateDoc(ref, {
        userGallery: gallery.map((g) => (g.id === target.id ? newEntry : g)),
      });

      // 3) Delete the old object from storage and reconcile quota (added new, removed old).
      if (target.url) {
        await fetch('/api/gallery', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: target.url, codeId }),
        }).catch(() => {});
      }
      const delta = (up.size || 0) - (oldEntry?.size || 0);
      if (delta !== 0) {
        await updateDoc(doc(db, 'users', ownerId), { storageUsed: increment(delta) }).catch(() => {});
      }
      cancelReplace();
    } catch (err) {
      console.error('Failed to replace image:', err);
    } finally {
      markBusy(target.id, false);
      setReplacing(false);
    }
  };

  // --- Boost: re-surface old photos by bumping uploadedAt to now (no re-upload, no duplicate). ---
  const boostImages = async (ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    try {
      const ref = doc(db, 'codes', codeId);
      const snap = await getDoc(ref);
      const gallery = (snap.data()?.userGallery || []) as RawGalleryEntry[];
      const now = Timestamp.now();
      await updateDoc(ref, {
        userGallery: gallery.map((g) => (idSet.has(g.id) ? { ...g, uploadedAt: now } : g)),
      });
    } catch (err) {
      console.error('Failed to boost images:', err);
    }
  };

  // --- Pin: keep an image always present on the beam (like a logo). ---
  const setPinned = async (ids: string[], pinned: boolean) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    try {
      const ref = doc(db, 'codes', codeId);
      const snap = await getDoc(ref);
      const gallery = (snap.data()?.userGallery || []) as RawGalleryEntry[];
      await updateDoc(ref, {
        userGallery: gallery.map((g) => (idSet.has(g.id) ? { ...g, pinned } : g)),
      });
    } catch (err) {
      console.error('Failed to update pin:', err);
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

  // --- Country flag editing (admin can set/change the flag shown on a photo) ---
  const setPhotoCountry = async (id: string, country: SelfiebeamCountry | null) => {
    const tag = country ? toCountryTag(country, locale) : null;
    try {
      const ref = doc(db, 'codes', codeId);
      const snap = await getDoc(ref);
      const gallery = (snap.data()?.userGallery || []) as RawGalleryEntry[];
      await updateDoc(ref, {
        userGallery: gallery.map((g) => {
          if (g.id !== id) return g;
          const next: RawGalleryEntry = { ...g };
          if (tag) next.country = tag;
          else delete next.country;
          return next;
        }),
      });
    } catch (err) {
      console.error('Failed to set country:', err);
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
    setShowBulkDeleteConfirm(false);
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
      const removed = gallery.filter((g) => selectedIds.has(g.id));
      await updateDoc(ref, { userGallery: gallery.filter((g) => !selectedIds.has(g.id)) });
      await reclaimStorage(removed);
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
  const selectedAllPinned =
    selectionMode && images.filter((i) => selectedIds.has(i.id)).every((i) => i.pinned);

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

      {/* Storage ceiling warning — userGallery is one Firestore doc (~3-4k entries max). */}
      {images.length >= 2500 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{t('selfiebeamCeilingWarning', { count: images.length })}</span>
        </div>
      )}

      {/* Dedup result + "upload anyway" override for the photos detected as already present. */}
      {skipInfo && (skipInfo.uploaded > 0 || skipInfo.skipped > 0) && (
        <p className="text-xs text-text-secondary flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
          {t('selfiebeamDedupResult', { uploaded: skipInfo.uploaded, skipped: skipInfo.skipped })}
        </p>
      )}
      {pendingDupes && pendingDupes.length > 0 && (
        <div className="flex flex-col gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm text-text-primary">{t('selfiebeamDupesFound', { count: pendingDupes.length })}</span>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPendingDupes(null)} className="px-2.5 py-1.5 rounded-md bg-bg-secondary text-text-secondary hover:text-text-primary text-sm font-medium">
                {t('selfiebeamDupesSkip')}
              </button>
              <button onClick={() => { const d = pendingDupes; setPendingDupes(null); handleFiles(d, true); }} className="px-2.5 py-1.5 rounded-md bg-accent/15 text-accent hover:bg-accent/25 text-sm font-medium">
                {t('selfiebeamDupesUploadAnyway')}
              </button>
            </div>
          </div>
          {/* Small previews so you know WHICH photos before choosing "upload anyway". */}
          {dupeThumbs.length > 0 && (
            <div className="flex items-center gap-1.5">
              {dupeThumbs.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt="" className="w-10 h-10 rounded object-cover border border-amber-500/30" />
              ))}
              {pendingDupes.length > dupeThumbs.length && (
                <span className="text-xs text-text-secondary ms-0.5">{t('selfiebeamDupesMore', { count: pendingDupes.length - dupeThumbs.length })}</span>
              )}
            </div>
          )}
        </div>
      )}

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
            <button
              onClick={async () => { setBusyBulk(true); try { await boostImages([...selectedIds]); clearSelection(); } finally { setBusyBulk(false); } }}
              disabled={busyBulk}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-accent/15 text-accent hover:bg-accent/25 text-sm font-medium disabled:opacity-50"
            >
              <ArrowUp className="w-4 h-4" />{t('selfiebeamBulkBoost')}
            </button>
            <button
              onClick={async () => { setBusyBulk(true); try { await setPinned([...selectedIds], !selectedAllPinned); clearSelection(); } finally { setBusyBulk(false); } }}
              disabled={busyBulk}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-sky-500/15 text-sky-500 hover:bg-sky-500/25 text-sm font-medium disabled:opacity-50"
            >
              {selectedAllPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
              {selectedAllPinned ? t('selfiebeamBulkUnpin') : t('selfiebeamBulkPin')}
            </button>
            <button onClick={() => setShowBulkDeleteConfirm(true)} disabled={busyBulk} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-red-500/15 text-red-500 hover:bg-red-500/25 text-sm font-medium disabled:opacity-50">
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

      {/* Hint: dragging a file onto a single photo swaps it (only shown when there are photos). */}
      {visible.length > 0 && (
        <p className="text-xs text-text-secondary flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 shrink-0 text-accent" />
          {t('selfiebeamReplaceTip')}
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
            const isPinned = img.pinned;
            const isBusy = busyIds.has(img.id);
            const isSelected = selectedIds.has(img.id);
            const isEditing = editingNameId === img.id;
            const showName = img.uploaderName && !ANON.includes(img.uploaderName);
            const isDragOver = dragOverId === img.id;
            return (
              <div
                key={img.id}
                onClick={(e) => !isEditing && handleSelectClick(index, e.shiftKey)}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverId(img.id); }}
                onDragLeave={(e) => { e.preventDefault(); if (dragOverId === img.id) setDragOverId(null); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverId(null);
                  const f = Array.from(e.dataTransfer.files).find((file) => file.type.startsWith('image/'));
                  if (f) openReplace(img, f);
                }}
                className={`relative aspect-square rounded-lg overflow-hidden bg-bg-secondary group cursor-pointer select-none ${
                  isDragOver ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg-card' : isSelected ? 'ring-2 ring-accent' : isPending ? 'ring-2 ring-amber-500' : ''
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

                {/* Pinned badge (top-end) — shown for approved pinned photos */}
                {isPinned && !isPending && (
                  <span className="absolute top-1 end-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-sky-500 text-white text-[9px] font-bold">
                    <Pin className="w-2.5 h-2.5" />{t('selfiebeamPinnedBadge')}
                  </span>
                )}

                {/* Country flag badge (top-start, beside the select checkbox) */}
                {img.country?.flag && (
                  <span className="absolute top-1 start-8 z-10 rounded-[2px] overflow-hidden shadow ring-1 ring-black/40 pointer-events-none">
                    <img src={img.country.flag} alt={img.country.name} className="w-6 h-4 object-cover block" />
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

                {/* Drag-over hint — when a file is dragged onto this photo, show "drop to replace". */}
                {isDragOver && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 bg-accent/40 backdrop-blur-[1px] pointer-events-none">
                    <ImageIcon className="w-6 h-6 text-white" />
                    <span className="text-[11px] font-bold text-white px-1.5 text-center">{t('selfiebeamReplaceHint')}</span>
                  </div>
                )}

                {/* Hover toolbar — a compact panel pinned to the bottom edge so it never covers
                    or crops the photo. pointer-events only on hover, so the invisible bar doesn't
                    swallow card-selection clicks; the buttons themselves stopPropagation. */}
                {!isEditing && (
                  <div className="absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-center justify-center gap-1 px-1 py-1.5 bg-gradient-to-t from-black/90 via-black/70 to-transparent opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
                    {isBusy ? (
                      <Loader2 className="w-4 h-4 my-0.5 text-white animate-spin" />
                    ) : (
                      <>
                        {isPending ? (
                          <IconTip label={t('selfiebeamTipApprove')}>
                            <button onClick={(e) => { e.stopPropagation(); setApproval(img.id, true); }} className="p-1 rounded-md bg-green-500 text-white hover:bg-green-600">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </IconTip>
                        ) : (
                          <IconTip label={t('selfiebeamTipReject')}>
                            <button onClick={(e) => { e.stopPropagation(); setApproval(img.id, false); }} className="p-1 rounded-md bg-amber-500 text-white hover:bg-amber-600">
                              <Clock className="w-3.5 h-3.5" />
                            </button>
                          </IconTip>
                        )}
                        <IconTip label={t('selfiebeamTipEdit')}>
                          <button onClick={(e) => { e.stopPropagation(); startEditName(img); }} className="p-1 rounded-md bg-white/25 text-white hover:bg-white/40">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </IconTip>
                        <EditorCountryControl
                          current={img.country}
                          onPick={(c) => setPhotoCountry(img.id, c)}
                          locale={locale}
                          labels={{
                            tip: t('selfiebeamTipCountry'),
                            search: t('selfiebeamCountrySearch'),
                            remove: t('selfiebeamCountryRemove'),
                            noResults: t('selfiebeamCountryNoResults'),
                          }}
                        />
                        <IconTip label={t('selfiebeamTipBoost')}>
                          <button onClick={(e) => { e.stopPropagation(); boostImages([img.id]); }} className="p-1 rounded-md bg-accent text-white hover:opacity-90">
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                        </IconTip>
                        <IconTip label={isPinned ? t('selfiebeamTipUnpin') : t('selfiebeamTipPin')}>
                          <button onClick={(e) => { e.stopPropagation(); setPinned([img.id], !isPinned); }} className="p-1 rounded-md bg-sky-500 text-white hover:bg-sky-600">
                            {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                          </button>
                        </IconTip>
                        <IconTip label={t('selfiebeamTipDelete')}>
                          <button onClick={(e) => { e.stopPropagation(); deleteImage(img); }} className="p-1 rounded-md bg-red-500 text-white hover:bg-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </IconTip>
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

      {/* Bulk-delete confirmation — explicit modal, matching the delete-all dialog on the beam. */}
      {showBulkDeleteConfirm && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowBulkDeleteConfirm(false)}
        >
          <div
            className="bg-bg-card border border-border rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary">{t('selfiebeamBulkDeleteTitle')}</h3>
              <p className="text-sm text-text-secondary mt-2">
                {t('selfiebeamBulkDeleteWarning', { count: selectedIds.size })}
                <br />
                {t('selfiebeamCannotUndo')}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-bg-secondary text-text-primary hover:opacity-90 transition-colors"
              >
                {t('selfiebeamCancel')}
              </button>
              <button
                onClick={bulkDelete}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                {t('selfiebeamBulkDelete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drag-to-replace confirmation — shows old → new previews; confirm swaps in place
          and permanently deletes the old file from storage. */}
      {replaceTarget && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !replacing && cancelReplace()}
        >
          <div
            className="bg-bg-card border border-border rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <h3 className="text-lg font-semibold text-text-primary">{t('selfiebeamReplaceTitle')}</h3>
              <p className="text-sm text-text-secondary mt-1">{t('selfiebeamReplaceWarning')}</p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <div className="text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={replaceTarget.target.url} alt="" className="w-24 h-24 rounded-lg object-cover border border-border opacity-60" />
                <span className="text-[11px] text-text-secondary mt-1 block">{t('selfiebeamReplaceOld')}</span>
              </div>
              <ArrowUp className="w-5 h-5 text-accent rotate-90 rtl:-rotate-90 shrink-0" />
              <div className="text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={replacePreview} alt="" className="w-24 h-24 rounded-lg object-cover border-2 border-accent" />
                <span className="text-[11px] text-accent font-medium mt-1 block">{t('selfiebeamReplaceNew')}</span>
              </div>
            </div>
            <p className="text-xs text-text-secondary text-center">{t('selfiebeamCannotUndo')}</p>
            <div className="flex gap-3">
              <button
                onClick={cancelReplace}
                disabled={replacing}
                className="flex-1 px-4 py-2.5 rounded-lg bg-bg-secondary text-text-primary hover:opacity-90 transition-colors disabled:opacity-50"
              >
                {t('selfiebeamCancel')}
              </button>
              <button
                onClick={confirmReplace}
                disabled={replacing}
                className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-white hover:opacity-90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {replacing && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('selfiebeamReplaceConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
