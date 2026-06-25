'use client';

import { useState, useRef, useEffect } from 'react';
import { SelfiebeamContent, UserGalleryImage } from '@/types';
import { ChevronLeft, ChevronRight, X, Camera, Loader2, Check, AlertCircle, Trash2, Pencil, RefreshCw } from 'lucide-react';
import { onSnapshot, doc, getDoc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import DOMPurify from 'isomorphic-dompurify';
import { queuedUpload } from '@/lib/uploadQueue';
import { getBrowserLocale, uploadTranslations } from '@/lib/publicTranslations';
import SquareImageCropper from '@/components/viewer/SquareImageCropper';
import CountryPicker from '@/components/viewer/CountryPicker';
import { toCountryTag, findCountryByCode, type SelfiebeamCountry, type SelfiebeamCountryTag } from '@/lib/selfiebeam/countries';

interface SelfiebeamViewerProps {
  content: SelfiebeamContent;
  codeId?: string;
  shortId?: string;
  ownerId?: string;
}

// Format text with enhanced formatting (with XSS protection)
// Simple approach - let the browser handle RTL naturally
function formatContent(text: string): string {
  // First sanitize the input to remove any malicious HTML
  const sanitized = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });

  // Helper to wrap content with alignment
  const wrapWithAlign = (content: string, align: 'right' | 'left' | 'center', extraClasses = '') => {
    const alignClass = align === 'right' ? 'text-right' : align === 'left' ? 'text-left' : 'text-center';
    const dir = align === 'right' ? 'rtl' : align === 'left' ? 'ltr' : undefined;
    return `<div class="${alignClass} ${extraClasses}" ${dir ? `dir="${dir}"` : ''}>${content}</div>`;
  };

  // Process line by line for block-level formatting
  const lines = sanitized.split('\n');
  const formattedLines = lines.map(line => {
    // Empty line = paragraph break
    if (line.trim() === '') {
      return '<div class="h-4"></div>';
    }

    // Check for alignment prefix: >> (right/RTL), << (left/LTR), >< (center)
    let align: 'right' | 'left' | 'center' | null = null;
    if (line.startsWith('>> ')) {
      align = 'right';
      line = line.slice(3);
    } else if (line.startsWith('<< ')) {
      align = 'left';
      line = line.slice(3);
    } else if (line.startsWith('>< ')) {
      align = 'center';
      line = line.slice(3);
    }

    // Headers: # ## ###
    if (line.startsWith('### ')) {
      const content = line.slice(4);
      return align
        ? wrapWithAlign(content, align, 'text-lg font-bold mt-4 mb-2')
        : `<div class="text-lg font-bold mt-4 mb-2">${content}</div>`;
    }
    if (line.startsWith('## ')) {
      const content = line.slice(3);
      return align
        ? wrapWithAlign(content, align, 'text-xl font-bold mt-4 mb-2')
        : `<div class="text-xl font-bold mt-4 mb-2">${content}</div>`;
    }
    if (line.startsWith('# ')) {
      const content = line.slice(2);
      return align
        ? wrapWithAlign(content, align, 'text-2xl font-bold mt-4 mb-2')
        : `<div class="text-2xl font-bold mt-4 mb-2">${content}</div>`;
    }

    // Bullet points: • or - at start of line - replace with colored bullet
    if (line.match(/^[•\-]\s/)) {
      const content = `<span class="text-blue-400">• </span>${line.slice(2)}`;
      return align
        ? wrapWithAlign(content, align, 'my-1')
        : `<div class="my-1">${content}</div>`;
    }

    // Numbered lists: 1. 2. 3. etc - color the number
    const numberedMatch = line.match(/^(\d+)\.\s(.+)$/);
    if (numberedMatch) {
      const content = `<span class="text-blue-400 font-bold">${numberedMatch[1]}. </span>${numberedMatch[2]}`;
      return align
        ? wrapWithAlign(content, align, 'my-1')
        : `<div class="my-1">${content}</div>`;
    }

    // Regular line
    return align ? wrapWithAlign(line, align) : `<div>${line}</div>`;
  }).join('');

  // Apply inline formatting
  const formatted = formattedLines
    // Bold: *text*
    .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
    // Italic: _text_
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    // Strikethrough: ~text~
    .replace(/~([^~]+)~/g, '<del>$1</del>')
    // Links: [text](url) or plain URLs
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 underline hover:text-blue-300">$1</a>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-400 underline hover:text-blue-300">$1</a>');

  // Sanitize again to ensure only our tags are present
  return DOMPurify.sanitize(formatted, {
    ALLOWED_TAGS: ['strong', 'em', 'del', 'a', 'div', 'span'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class']
  });
}

// Extract YouTube video ID from various URL formats
function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export default function SelfiebeamViewer({ content, codeId, shortId, ownerId }: SelfiebeamViewerProps) {
  // Get browser locale for translations
  const [locale, setLocale] = useState<'he' | 'en'>('he');
  const t = uploadTranslations[locale];

  // Photographer-link token from the URL (?pk=...). Read once on mount (client-only).
  const [pkParam, setPkParam] = useState<string | null>(null);

  useEffect(() => {
    setLocale(getBrowserLocale());
    try {
      setPkParam(new URLSearchParams(window.location.search).get('pk'));
    } catch {
      // ignore — no query string
    }
  }, []);

  // Photographer mode is unlocked only via the staff link `/v/{shortId}?pk={photographerToken}`.
  const photographerMode = !!content.photographerToken && pkParam === content.photographerToken;

  // Where to remember "my uploads": a field photographer needs them to survive refresh AND
  // tab-close, so use localStorage in photographer mode. The public link uses sessionStorage so
  // a shared device doesn't keep blocking the next person at the per-visitor cap.
  const uploadsStorage = (): Storage | null => {
    if (typeof window === 'undefined') return null;
    return photographerMode ? window.localStorage : window.sessionStorage;
  };

  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Gallery upload state
  const [showNameModal, setShowNameModal] = useState(false);
  const [uploaderName, setUploaderName] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<SelfiebeamCountry | null>(null);
  const [cropperFile, setCropperFile] = useState<File | null>(null); // photo being framed
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null); // cropped, awaiting name
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // My uploaded images state (stored in sessionStorage by image ID)
  const [myUploadedImages, setMyUploadedImages] = useState<UserGalleryImage[]>([]);
  const [allGalleryImages, setAllGalleryImages] = useState<UserGalleryImage[]>([]);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [fadingOutImageId, setFadingOutImageId] = useState<string | null>(null);
  // Per-photo edit popup (tap a thumbnail): change flag, replace, or delete.
  const [editingImage, setEditingImage] = useState<UserGalleryImage | null>(null);
  const [editCountry, setEditCountry] = useState<SelfiebeamCountry | null>(null); // country shown in the edit popup
  const [editName, setEditName] = useState(''); // name shown in the edit popup
  const [confirmingDelete, setConfirmingDelete] = useState(false); // delete needs a second confirm
  const [stagedBlob, setStagedBlob] = useState<Blob | null>(null); // a re-shot photo awaiting Save in the edit popup
  const [stagedPreview, setStagedPreview] = useState<string | null>(null); // object URL for the staged photo
  const [savingEdit, setSavingEdit] = useState(false);

  // Max images per user
  const MAX_USER_IMAGES = 3;

  // Load my uploaded image IDs from storage. Read from BOTH local + session storage so a
  // photographer's list survives a refresh, a tab-close, and the storage-type switch.
  useEffect(() => {
    if (!codeId || typeof window === 'undefined') return;
    const storageKey = `gallery_uploads_${codeId}`;
    const ids = new Set<string>();
    try {
      for (const store of [window.localStorage, window.sessionStorage]) {
        const raw = store.getItem(storageKey);
        if (raw) (JSON.parse(raw) as string[]).forEach((id) => ids.add(id));
      }
    } catch { /* ignore malformed storage */ }
    if (ids.size) {
      // Filter allGalleryImages to get my uploads, but keep fading out images
      const myImages = allGalleryImages.filter(img => ids.has(img.id));
      // Only update if not currently fading out (to prevent jump)
      if (!fadingOutImageId) {
        setMyUploadedImages(myImages);
      } else {
        // Keep the fading image in the list until animation completes
        const fadingImage = myUploadedImages.find(img => img.id === fadingOutImageId);
        if (fadingImage && !myImages.find(img => img.id === fadingOutImageId)) {
          setMyUploadedImages([...myImages, fadingImage]);
        } else {
          setMyUploadedImages(myImages);
        }
      }
    }
  }, [codeId, allGalleryImages, fadingOutImageId, photographerMode]);

  // Listen to gallery images from Firestore
  useEffect(() => {
    if (!codeId) return;

    const unsubscribe = onSnapshot(doc(db, 'codes', codeId), (docSnap) => {
      if (!docSnap.exists()) return;

      const data = docSnap.data();
      const gallery = (data.userGallery || []) as Array<{
        id: string;
        url: string;
        uploaderName: string;
        uploadedAt: { toDate?: () => Date } | Date;
        country?: UserGalleryImage['country'];
      }>;

      const images: UserGalleryImage[] = gallery.map((img) => ({
        id: img.id,
        url: img.url,
        uploaderName: img.uploaderName,
        country: img.country,
        uploadedAt: img.uploadedAt && typeof (img.uploadedAt as { toDate?: () => Date }).toDate === 'function'
          ? (img.uploadedAt as { toDate: () => Date }).toDate()
          : new Date(img.uploadedAt as unknown as string),
      }));

      setAllGalleryImages(images);
    });

    return () => unsubscribe();
  }, [codeId]);

  // Save uploaded image ID to storage (localStorage in photographer mode → survives tab-close).
  const saveUploadedImageId = (imageId: string) => {
    if (!codeId) return;
    const store = uploadsStorage();
    if (!store) return;
    const storageKey = `gallery_uploads_${codeId}`;
    const savedIds = store.getItem(storageKey);
    const ids = savedIds ? JSON.parse(savedIds) as string[] : [];
    if (!ids.includes(imageId)) {
      ids.push(imageId);
      store.setItem(storageKey, JSON.stringify(ids));
    }
  };

  // Remove image ID from storage (clear from both so it doesn't linger in the other one).
  const removeUploadedImageId = (imageId: string) => {
    if (!codeId || typeof window === 'undefined') return;
    const storageKey = `gallery_uploads_${codeId}`;
    for (const store of [window.localStorage, window.sessionStorage]) {
      const savedIds = store.getItem(storageKey);
      if (savedIds) {
        const ids = (JSON.parse(savedIds) as string[]).filter(id => id !== imageId);
        store.setItem(storageKey, JSON.stringify(ids));
      }
    }
  };

  // Handle delete my uploaded image
  // Read the CURRENT raw userGallery from Firestore, apply `mutate`, and write it back.
  // Reading the raw array (not the lossy listener state) preserves every field — country,
  // approved, source, pinned, fileHash, storage*, etc. — on the entries we don't touch.
  // The `isGalleryUpdate` Firestore rule permits this (it only changes userGallery).
  type RawGalleryEntry = Record<string, unknown> & { id: string; url: string };
  const mutateGallery = async (mutate: (gallery: RawGalleryEntry[]) => RawGalleryEntry[]) => {
    if (!codeId) return;
    const codeRef = doc(db, 'codes', codeId);
    const snap = await getDoc(codeRef);
    const gallery = (snap.data()?.userGallery || []) as RawGalleryEntry[];
    await updateDoc(codeRef, { userGallery: mutate(gallery) });
  };

  const handleDeleteMyImage = async (image: UserGalleryImage) => {
    if (!codeId || !ownerId || deletingImageId) return;

    setDeletingImageId(image.id);

    try {
      // Delete the object from storage (R2/Blob)
      await fetch('/api/gallery', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: image.url }),
      });

      // Remove just this entry — all other entries keep every field intact.
      await mutateGallery((gallery) => gallery.filter((g) => g.id !== image.id));

      // Remove from sessionStorage
      removeUploadedImageId(image.id);

      // Start fade-out animation, then remove from display
      setFadingOutImageId(image.id);
      setTimeout(() => {
        setFadingOutImageId(null);
        setMyUploadedImages(prev => prev.filter(img => img.id !== image.id));
      }, 300); // Match animation duration
    } catch (error) {
      console.error('Error deleting image:', error);
    } finally {
      setDeletingImageId(null);
    }
  };

  // Close the edit popup and discard any staged (un-saved) re-shot photo.
  const closeEditImage = () => {
    setEditingImage(null);
    setStagedBlob(null);
    setStagedPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setConfirmingDelete(false);
  };

  // Single "Save" for the edit popup: commits the re-shot photo (if any), the name, and the
  // flag — all in one go — then closes.
  const saveImageEdits = async () => {
    if (!editingImage) return;
    const imageId = editingImage.id;
    const oldUrl = editingImage.url;
    const tag = editCountry ? toCountryTag(editCountry, locale) : null;
    const finalName = editName.trim() || t.anonymous;
    setSavingEdit(true);
    try {
      // 1) If the photo was re-shot, upload the new bytes first.
      type ReplacedImage = { id: string; url: string; size?: number; storageProvider?: UserGalleryImage['storageProvider']; storageKey?: string; storageBucket?: string; contentType?: string };
      let replaced: ReplacedImage | null = null;
      if (stagedBlob && codeId && ownerId) {
        const fd = new FormData();
        fd.append('file', stagedBlob, `replace_${Date.now()}.webp`);
        fd.append('codeId', codeId);
        fd.append('ownerId', ownerId);
        fd.append('uploaderName', finalName);
        const data = (await queuedUpload(fd, '/api/gallery')) as { success: boolean; image: ReplacedImage };
        if (data.success) replaced = data.image;
      }

      // 2) Commit name + flag (+ new image) on this entry, preserving everything else.
      await mutateGallery((gallery) =>
        gallery.map((g) => {
          if (g.id !== imageId) return g;
          const next: RawGalleryEntry = { ...g, uploaderName: finalName };
          if (tag) next.country = tag;
          else delete next.country;
          if (replaced) {
            next.url = replaced.url;
            if (replaced.size) next.size = replaced.size;
            if (replaced.storageProvider) next.storageProvider = replaced.storageProvider;
            if (replaced.storageKey) next.storageKey = replaced.storageKey;
            if (replaced.storageBucket) next.storageBucket = replaced.storageBucket;
            if (replaced.contentType) next.contentType = replaced.contentType;
            next.uploadedAt = Timestamp.now();
          }
          return next;
        })
      );

      // 3) Delete the old storage object if the photo was replaced (non-fatal).
      if (replaced && oldUrl && oldUrl !== replaced.url) {
        try {
          await fetch('/api/gallery', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: oldUrl }),
          });
        } catch { /* orphaned object, not user-facing */ }
      }

      setMyUploadedImages((prev) =>
        prev.map((img) =>
          img.id === imageId
            ? { ...img, uploaderName: finalName, country: tag ?? undefined, ...(replaced ? { url: replaced.url } : {}) }
            : img
        )
      );
      closeEditImage();
    } catch (error) {
      console.error('Error saving photo edits:', error);
    } finally {
      setSavingEdit(false);
    }
  };

  const youtubeId = content.youtubeUrl ? extractYoutubeId(content.youtubeUrl) : null;
  const hasImages = content.images && content.images.length > 0;
  const galleryEnabled = content.galleryEnabled && codeId;
  const maxImages = Math.max(1, Math.min(3, content.maxUploadsPerUser ?? MAX_USER_IMAGES));
  const canUploadMore = photographerMode || myUploadedImages.length < maxImages;

  const openLightbox = (index: number) => {
    setCurrentImageIndex(index);
    setLightboxImage(content.images![index]);
  };

  const closeLightbox = () => {
    setLightboxImage(null);
  };

  const goToPrevImage = () => {
    if (!content.images) return;
    const newIndex = currentImageIndex > 0 ? currentImageIndex - 1 : content.images.length - 1;
    setCurrentImageIndex(newIndex);
    setLightboxImage(content.images[newIndex]);
  };

  const goToNextImage = () => {
    if (!content.images) return;
    const newIndex = currentImageIndex < content.images.length - 1 ? currentImageIndex + 1 : 0;
    setCurrentImageIndex(newIndex);
    setLightboxImage(content.images[newIndex]);
  };

  // Handle file selection — open the framing cropper (pinch/zoom/pan)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return;
    }

    // Reset the input so picking the same file again re-triggers onChange
    e.target.value = '';
    setCropperFile(file);
  };

  // After framing: if the edit popup is open, stage the re-shot photo (committed on Save);
  // otherwise open the details modal (name + country, pre-filled with the last country pick).
  const handleCropConfirm = (blob: Blob) => {
    setCropperFile(null);
    if (editingImage) {
      setStagedBlob(blob);
      setStagedPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
      return;
    }
    setPendingBlob(blob);
    setShowNameModal(true);
  };

  // Handle gallery upload of the already-cropped 1000px square WebP
  const handleUpload = async (blob: Blob, name: string, country: SelfiebeamCountryTag | null) => {
    if (!codeId || !ownerId) return;

    setUploading(true);
    setShowNameModal(false);
    setPendingBlob(null);
    setUploadStatus('idle');

    try {
      // Create form data (blob is already a cropped, compressed WebP)
      const formData = new FormData();
      formData.append('file', blob, `selfie_${Date.now()}.webp`);
      formData.append('codeId', codeId);
      formData.append('ownerId', ownerId);
      formData.append('uploaderName', name || t.anonymous);

      // Upload to Vercel Blob using queue (handles retries automatically)
      const data = await queuedUpload(formData, '/api/gallery') as {
        success: boolean;
        image: {
          id: string;
          url: string;
          uploaderName: string;
          size: number;
          storageProvider?: UserGalleryImage['storageProvider'];
          storageKey?: string;
          storageBucket?: string;
          contentType?: string;
        };
      };

      if (!data.success) {
        throw new Error('Upload failed');
      }

      // Moderation: when auto-approve is off, the participant's photo waits for admin
      // approval before it appears on the beam. Default (autoApprove !== false) = approved.
      const approved = content.autoApprove !== false;

      // Update Firestore with the new gallery image (client-side to use auth)
      const codeRef = doc(db, 'codes', codeId);
      await updateDoc(codeRef, {
        userGallery: arrayUnion({
          id: data.image.id,
          url: data.image.url,
          size: data.image.size,
          ...(data.image.storageProvider ? { storageProvider: data.image.storageProvider } : {}),
          ...(data.image.storageKey ? { storageKey: data.image.storageKey } : {}),
          ...(data.image.storageBucket ? { storageBucket: data.image.storageBucket } : {}),
          ...(data.image.contentType ? { contentType: data.image.contentType } : {}),
          ...(country ? { country } : {}),
          uploaderName: data.image.uploaderName,
          approved,
          source: 'participant',
          uploadedAt: Timestamp.now(),
        }),
      });

      // Note: the owner's storageUsed is incremented server-side in /api/gallery (Admin SDK),
      // since unauthenticated participants cannot write to users/{ownerId} under Firestore rules.

      // Save the image ID to sessionStorage
      saveUploadedImageId(data.image.id);

      // Add to myUploadedImages immediately (no need to wait for Firestore listener)
      const newImage: UserGalleryImage = {
        id: data.image.id,
        url: data.image.url,
        size: data.image.size,
        storageProvider: data.image.storageProvider,
        storageKey: data.image.storageKey,
        storageBucket: data.image.storageBucket,
        contentType: data.image.contentType,
        ...(country ? { country } : {}),
        uploaderName: data.image.uploaderName,
        uploadedAt: new Date(),
      };
      setMyUploadedImages(prev => [...prev, newImage]);

      setUploadStatus('success');
      // Keep the country selected between shots in photographer mode; otherwise reset.
      if (!photographerMode) setSelectedCountry(null);

      // Reset after 3 seconds
      setTimeout(() => {
        setUploadStatus('idle');
        setUploaderName('');
      }, 3000);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');

      // Reset after 3 seconds
      setTimeout(() => {
        setUploadStatus('idle');
      }, 3000);
    } finally {
      setUploading(false);
    }
  };

  // Open camera button click
  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  // Submit name + country and upload the framed selfie
  const handleNameSubmit = () => {
    // Name is required only when anonymous uploads are disabled (and never in photographer mode)
    if (!photographerMode && !content.allowAnonymous && !uploaderName.trim()) return;
    if (pendingBlob) {
      const countryTag = selectedCountry ? toCountryTag(selectedCountry, locale) : null;
      handleUpload(pendingBlob, uploaderName, countryTag);
    }
  };

  // Open the per-photo edit popup, pre-selecting its current flag and name.
  const openEditImage = (image: UserGalleryImage) => {
    setStagedBlob(null);
    setStagedPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setConfirmingDelete(false);
    setEditingImage(image);
    setEditCountry(image.country?.code ? findCountryByCode(image.country.code) ?? null : null);
    // Show a blank field for the anonymous placeholder so they can type a real name.
    setEditName([t.anonymous, 'אנונימי', 'Anonymous'].includes(image.uploaderName) ? '' : image.uploaderName);
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{ backgroundColor: content.backgroundColor }}
    >
      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-start p-4 sm:p-6 md:p-8 pb-24 overflow-y-auto">
        <div className="w-full max-w-2xl mx-auto space-y-6">
          {/* Title */}
          <h1
            className="text-2xl sm:text-3xl md:text-4xl font-bold text-center"
            style={{ color: content.textColor }}
          >
            {content.title}
          </h1>

          {/* Content */}
          {content.content && (
            <div
              className="text-base sm:text-lg leading-relaxed whitespace-pre-wrap text-center"
              style={{ color: content.textColor }}
              dir="auto"
              dangerouslySetInnerHTML={{ __html: formatContent(content.content) }}
            />
          )}

          {/* ===== Capture (participant selfie) ===== */}
          {galleryEnabled && (
            <div className="flex flex-col items-center gap-4 py-4">
              <button
                onClick={handleCameraClick}
                disabled={uploading || !canUploadMore}
                className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-full flex flex-col items-center justify-center gap-2 bg-white shadow-2xl transition-all disabled:opacity-70 active:scale-95"
              >
                {uploading ? (
                  <Loader2 className="w-14 h-14 animate-spin text-gray-500" />
                ) : uploadStatus === 'success' ? (
                  <Check className="w-16 h-16 text-green-500" />
                ) : uploadStatus === 'error' ? (
                  <AlertCircle className="w-16 h-16 text-red-500" />
                ) : (
                  <Camera className="w-16 h-16 text-gray-700" />
                )}
                <span className="text-base font-semibold text-gray-700">
                  {uploading
                    ? t.uploading
                    : uploadStatus === 'success'
                    ? t.uploaded
                    : uploadStatus === 'error'
                    ? t.error
                    : !canUploadMore
                    ? t.maxReached
                    : t.takePhoto}
                </span>
              </button>

              {/* Counter */}
              <p className="text-sm font-medium opacity-90" style={{ color: content.textColor }}>
                {photographerMode
                  ? t.photographerUploadedCount.replace('{count}', String(myUploadedImages.length))
                  : t.uploadedOf
                      // Clamp so a lowered cap never shows a confusing "3 of 1".
                      .replace('{count}', String(Math.min(myUploadedImages.length, maxImages)))
                      .replace('{max}', String(maxImages))}
              </p>

              {/* My uploaded selfies — tap one to edit its flag, replace, or delete it.
                  (Photographer mode can pile up hundreds — only show the last few.) */}
              {myUploadedImages.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2.5 mt-1">
                  {(photographerMode ? myUploadedImages.slice(-8) : myUploadedImages).map((img) => (
                    <button
                      key={img.id}
                      onClick={() => openEditImage(img)}
                      disabled={deletingImageId === img.id || fadingOutImageId === img.id}
                      className={`relative transition-all duration-300 ${
                        fadingOutImageId === img.id ? 'opacity-0 scale-75' : 'opacity-100 scale-100'
                      }`}
                    >
                      <img
                        src={img.url}
                        alt=""
                        className="w-20 h-20 rounded-2xl object-cover border-2 border-white/40 shadow-lg"
                      />
                      {/* Current flag */}
                      {img.country?.flag && (
                        <span className="absolute bottom-1 left-1 rounded-[2px] overflow-hidden ring-1 ring-black/40 shadow">
                          <img src={img.country.flag} alt="" className="w-5 h-3.5 object-cover block" />
                        </span>
                      )}
                      {/* Edit hint */}
                      <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center shadow-lg">
                        {deletingImageId === img.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pencil className="w-3 h-3" />}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* YouTube Video */}
          {youtubeId && (
            <div className="w-full rounded-xl overflow-hidden shadow-2xl">
              <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                <iframe
                  src={`https://www.youtube.com/embed/${youtubeId}?rel=0`}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {/* Image Gallery */}
          {hasImages && (
            <div className="space-y-3">
              {content.images!.length === 1 ? (
                // Single image - full width
                <button
                  onClick={() => openLightbox(0)}
                  className="w-full rounded-xl overflow-hidden shadow-lg focus:outline-none focus:ring-2 focus:ring-white/50"
                >
                  <img
                    src={content.images![0]}
                    alt=""
                    className="w-full h-auto object-cover"
                  />
                </button>
              ) : content.images!.length === 2 ? (
                // Two images - side by side
                <div className="grid grid-cols-2 gap-2">
                  {content.images!.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => openLightbox(index)}
                      className="aspect-square rounded-xl overflow-hidden shadow-lg focus:outline-none focus:ring-2 focus:ring-white/50"
                    >
                      <img
                        src={img}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              ) : (
                // 3+ images - grid layout
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {content.images!.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => openLightbox(index)}
                      className="aspect-square rounded-xl overflow-hidden shadow-lg focus:outline-none focus:ring-2 focus:ring-white/50"
                    >
                      <img
                        src={img}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Navigation arrows */}
          {content.images && content.images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrevImage();
                }}
                className="absolute left-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToNextImage();
                }}
                className="absolute right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Image */}
          <img
            src={lightboxImage}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Image counter */}
          {content.images && content.images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-white/10 text-white text-sm">
              {currentImageIndex + 1} / {content.images.length}
            </div>
          )}
        </div>
      )}

      {/* Hidden file input for camera */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Selfie framing cropper (pinch / zoom / pan) */}
      {cropperFile && (
        <SquareImageCropper
          file={cropperFile}
          onCancel={() => setCropperFile(null)}
          onConfirm={handleCropConfirm}
          labels={{
            title: t.cropTitle,
            hint: t.cropHint,
            confirm: t.cropConfirm,
            cancel: t.cancel,
            processing: t.cropProcessing,
          }}
        />
      )}


      {/* Name + country details modal */}
      {showNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            dir={locale === 'he' ? 'rtl' : 'ltr'}
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4"
          >
            <h3 className="text-lg font-semibold text-gray-800 text-center">
              {t.enterYourName}
            </h3>
            <p className="text-sm text-gray-500 text-center">
              {t.nameWillAppear}
            </p>
            <input
              type="text"
              value={uploaderName}
              onChange={(e) => setUploaderName(e.target.value)}
              placeholder={t.nameOrNickname}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
              autoFocus
            />

            {/* Country picker (optional) */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-600">
                {t.countryLabel}
              </label>
              <CountryPicker
                value={selectedCountry}
                onChange={setSelectedCountry}
                locale={locale}
                labels={{
                  placeholder: t.countryPlaceholder,
                  noResults: t.countryNoResults,
                  clear: t.countryClear,
                }}
              />
              {photographerMode && (
                <p className="text-xs text-gray-400">{t.photographerPickCountry}</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowNameModal(false);
                  setPendingBlob(null);
                  // Keep the remembered country in photographer mode so the next shot is pre-filled.
                  if (!photographerMode) setSelectedCountry(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleNameSubmit}
                disabled={!photographerMode && !content.allowAnonymous && !uploaderName.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t.continue}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Per-photo edit popup — change the flag, replace the photo, or delete it. */}
      {editingImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            dir={locale === 'he' ? 'rtl' : 'ltr'}
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">{t.editPhotoTitle}</h3>
              <button onClick={closeEditImage} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tap the photo to re-shoot / pick a new one (staged until Save) */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative mx-auto block w-40 h-40 group"
            >
              <img src={stagedPreview || editingImage.url} alt="" className="w-full h-full rounded-2xl object-cover border border-gray-200" />
              {editCountry && (
                <span className="absolute bottom-1.5 left-1.5 rounded-[2px] overflow-hidden ring-1 ring-black/30 shadow">
                  <img src={editCountry.flag} alt="" className="w-7 h-5 object-cover block" />
                </span>
              )}
              <span className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white">
                <RefreshCw className="w-6 h-6" />
                <span className="text-xs font-medium">{t.replacePhoto}</span>
              </span>
            </button>
            <p className="text-xs text-gray-400 text-center -mt-1">{t.tapToReplace}</p>

            {/* Name */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-600">{t.nameLabel}</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={t.nameOrNickname}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
              />
            </div>

            {/* Flag */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-600">{t.countryLabel}</label>
              <CountryPicker
                value={editCountry}
                onChange={setEditCountry}
                locale={locale}
                labels={{ placeholder: t.countryPlaceholder, noResults: t.countryNoResults, clear: t.countryClear }}
              />
            </div>

            {confirmingDelete ? (
              <div className="space-y-2 pt-1">
                <p className="text-sm text-center text-gray-700">{t.deleteConfirm}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={() => { if (editingImage) { handleDeleteMyImage(editingImage); closeEditImage(); } }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t.deletePhoto}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setConfirmingDelete(true)}
                  disabled={savingEdit || !!deletingImageId}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {t.deletePhoto}
                </button>
                <button
                  onClick={saveImageEdits}
                  disabled={savingEdit || !!deletingImageId}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {t.saveLabel}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
