'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { RiddleContent, UserGalleryImage, Visitor, PendingPack, PackOpening } from '@/types';
import { ChevronLeft, ChevronRight, X, Camera, Loader2, Check, AlertCircle, Trash2, Star, User, Pencil, Plus, Globe } from 'lucide-react';
import { onSnapshot, doc, updateDoc, arrayUnion, increment, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import DOMPurify from 'isomorphic-dompurify';
import { queuedUpload } from '@/lib/uploadQueue';
import { getBrowserLocale, uploadTranslations, gamificationTranslations, languageSwitcherTranslations } from '@/lib/publicTranslations';
import { getVisitorId, getLevelForXP, getProgressToNextLevel, formatXP, getLevelName } from '@/lib/xp';
import { getVisitor, recordPhotoUpload, recordStationScan, getFolder, removePhotoXP, updateVisitor } from '@/lib/db';
import { getPendingPacks } from '@/lib/lottery';
import { RegistrationConsentModal, XPPopup, useXPPopup } from '@/components/gamification';
import PackOpeningModal from '@/components/gamification/PackOpeningModal';
import PendingPacksBadge from '@/components/gamification/PendingPacksBadge';

interface RiddleViewerProps {
  content: RiddleContent;
  codeId?: string;
  shortId?: string;
  ownerId?: string;
  folderId?: string; // For route/XP tracking
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
  let formatted = formattedLines
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

// Compress image with mobile-friendly fallbacks
async function compressImage(file: File): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // Try createImageBitmap first (faster), fallback to Image() for HEIC/older browsers
  let imgWidth: number;
  let imgHeight: number;
  let imgSource: ImageBitmap | HTMLImageElement;

  try {
    imgSource = await createImageBitmap(file);
    imgWidth = imgSource.width;
    imgHeight = imgSource.height;
  } catch {
    // Fallback for HEIC/HEIF and older browsers
    imgSource = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
    imgWidth = imgSource.width;
    imgHeight = imgSource.height;
  }

  // Resize to 600x600 max (enough for selfies)
  const maxDim = 600;
  let width = imgWidth;
  let height = imgHeight;
  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(imgSource, 0, 0, width, height);

  // Clean up object URL if we created one
  if (imgSource instanceof HTMLImageElement) {
    URL.revokeObjectURL(imgSource.src);
  }

  // Try WebP first, fallback to JPEG for older browsers (especially iOS Safari)
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (blob && blob.size > 0) {
          resolve(blob);
        } else {
          // WebP not supported, fallback to JPEG
          canvas.toBlob(
            (jpegBlob) => resolve(jpegBlob!),
            'image/jpeg',
            0.75
          );
        }
      },
      'image/webp',
      0.7
    );
  });
}

export default function RiddleViewer({ content, codeId, shortId, ownerId, folderId }: RiddleViewerProps) {
  // Determine if language selector should be shown (when language is 'auto' or not set)
  const allowLanguageSwitch = !content.language || content.language === 'auto';

  // Get locale - use content.language if set (and not 'auto'), otherwise use browser locale
  const [locale, setLocale] = useState<'he' | 'en'>(() => {
    if (content.language && content.language !== 'auto') {
      return content.language;
    }
    return 'he'; // Default, will be updated in useEffect
  });
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const t = uploadTranslations[locale];
  const langT = languageSwitcherTranslations[locale];

  useEffect(() => {
    // Only detect browser locale if language is 'auto' or not set
    if (allowLanguageSwitch) {
      setLocale(getBrowserLocale());
    }
  }, [allowLanguageSwitch]);

  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Gallery upload state
  const [showNameModal, setShowNameModal] = useState(false);
  const [uploaderName, setUploaderName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [controlsExpanded, setControlsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Gamification state
  const [currentVisitor, setCurrentVisitor] = useState<Visitor | null>(null);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [isRoute, setIsRoute] = useState(false);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [showEditNicknameModal, setShowEditNicknameModal] = useState(false);
  const [editingNickname, setEditingNickname] = useState('');
  const [savingNickname, setSavingNickname] = useState(false);
  const { popups, showPopup, removePopup } = useXPPopup();

  // Pack opening state
  const [pendingPacks, setPendingPacks] = useState<PendingPack[]>([]);
  const [selectedPack, setSelectedPack] = useState<PendingPack | null>(null);
  const [showPackModal, setShowPackModal] = useState(false);
  const [prizesEnabled, setPrizesEnabled] = useState(false);

  // My uploaded images state (stored in sessionStorage by image ID)
  const [myUploadedImages, setMyUploadedImages] = useState<UserGalleryImage[]>([]);
  const [allGalleryImages, setAllGalleryImages] = useState<UserGalleryImage[]>([]);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [fadingOutImageId, setFadingOutImageId] = useState<string | null>(null);

  // Max images per user
  const MAX_USER_IMAGES = 3;

  // Load visitor data and check route status on mount
  useEffect(() => {
    const loadVisitorAndRoute = async () => {
      console.log('[RiddleViewer] Loading route data. folderId:', folderId, 'codeId:', codeId);

      // Check for existing visitor
      const visitorId = getVisitorId();
      if (visitorId) {
        const visitor = await getVisitor(visitorId);
        if (visitor) {
          setCurrentVisitor(visitor);
        }
      }

      // Check if this code is part of a route
      if (folderId) {
        const folder = await getFolder(folderId);
        console.log('[RiddleViewer] Folder data:', folder?.name, 'isRoute:', folder?.routeConfig?.isRoute);
        if (folder?.routeConfig?.isRoute) {
          setIsRoute(true);
          console.log('[RiddleViewer] Route is ACTIVE!');

          // Check if prizes are enabled for this route
          if (folder.routeConfig.prizesEnabled) {
            setPrizesEnabled(true);
          }

          // Record station scan for XP (if visitor exists and this is first visit)
          if (visitorId && codeId) {
            const result = await recordStationScan(visitorId, folderId, codeId, content.title);
            if (result.xpEarned > 0) {
              showPopup(result.xpEarned);
              // Refresh visitor data
              const updatedVisitor = await getVisitor(visitorId);
              if (updatedVisitor) setCurrentVisitor(updatedVisitor);
            }

            // Check for level-up pack award
            if (result.leveledUp && result.packAwarded) {
              // Fetch pending packs to show notification
              const packs = await getPendingPacks(visitorId, folderId);
              setPendingPacks(packs);
            }
          }
        }
      }
    };

    loadVisitorAndRoute();
  }, [folderId, codeId, showPopup]);

  // Fetch pending packs when visitor changes
  useEffect(() => {
    const fetchPendingPacks = async () => {
      if (currentVisitor && folderId && prizesEnabled) {
        const packs = await getPendingPacks(currentVisitor.id, folderId);
        setPendingPacks(packs);
      }
    };

    fetchPendingPacks();
  }, [currentVisitor, folderId, prizesEnabled]);

  // Load my uploaded image IDs from sessionStorage on mount
  useEffect(() => {
    if (!codeId) return;
    const storageKey = `gallery_uploads_${codeId}`;
    const savedIds = sessionStorage.getItem(storageKey);
    if (savedIds) {
      const ids = JSON.parse(savedIds) as string[];
      // Filter allGalleryImages to get my uploads, but keep fading out images
      const myImages = allGalleryImages.filter(img => ids.includes(img.id));
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
  }, [codeId, allGalleryImages, fadingOutImageId]);

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
      }>;

      const images: UserGalleryImage[] = gallery.map((img) => ({
        id: img.id,
        url: img.url,
        uploaderName: img.uploaderName,
        uploadedAt: img.uploadedAt && typeof (img.uploadedAt as { toDate?: () => Date }).toDate === 'function'
          ? (img.uploadedAt as { toDate: () => Date }).toDate()
          : new Date(img.uploadedAt as unknown as string),
      }));

      setAllGalleryImages(images);
    });

    return () => unsubscribe();
  }, [codeId]);

  // Save uploaded image ID to sessionStorage
  const saveUploadedImageId = (imageId: string) => {
    if (!codeId) return;
    const storageKey = `gallery_uploads_${codeId}`;
    const savedIds = sessionStorage.getItem(storageKey);
    const ids = savedIds ? JSON.parse(savedIds) as string[] : [];
    if (!ids.includes(imageId)) {
      ids.push(imageId);
      sessionStorage.setItem(storageKey, JSON.stringify(ids));
    }
  };

  // Remove image ID from sessionStorage
  const removeUploadedImageId = (imageId: string) => {
    if (!codeId) return;
    const storageKey = `gallery_uploads_${codeId}`;
    const savedIds = sessionStorage.getItem(storageKey);
    if (savedIds) {
      const ids = (JSON.parse(savedIds) as string[]).filter(id => id !== imageId);
      sessionStorage.setItem(storageKey, JSON.stringify(ids));
    }
  };

  // Handle delete my uploaded image
  const handleDeleteMyImage = async (image: UserGalleryImage) => {
    if (!codeId || !ownerId || deletingImageId) return;

    setDeletingImageId(image.id);

    try {
      // Delete from Vercel Blob
      await fetch('/api/gallery', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: image.url }),
      });

      // Remove from Firestore
      const codeRef = doc(db, 'codes', codeId);
      const currentGallery = allGalleryImages.filter(img => img.id !== image.id);
      await updateDoc(codeRef, {
        userGallery: currentGallery.map(img => ({
          id: img.id,
          url: img.url,
          uploaderName: img.uploaderName,
          uploadedAt: Timestamp.fromDate(new Date(img.uploadedAt)),
        })),
      });

      // Remove XP for photo deletion (if visitor is registered and this is a route)
      if (currentVisitor && folderId && isRoute) {
        const result = await removePhotoXP(currentVisitor.id, folderId);
        if (result.xpRemoved > 0) {
          // Show negative XP popup
          showPopup(-result.xpRemoved);
          // Refresh visitor data
          const updatedVisitor = await getVisitor(currentVisitor.id);
          if (updatedVisitor) setCurrentVisitor(updatedVisitor);
        }
      }

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

  const youtubeId = content.youtubeUrl ? extractYoutubeId(content.youtubeUrl) : null;
  const hasImages = content.images && content.images.length > 0;
  const galleryEnabled = content.galleryEnabled && codeId;
  const canUploadMore = myUploadedImages.length < MAX_USER_IMAGES;

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

  // Handle file selection for gallery
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return;
    }

    setSelectedFile(file);

    // Check if visitor needs to register (for XP tracking)
    if (!currentVisitor && isRoute) {
      // Store the file and show registration modal
      setPendingUploadFile(file);
      setShowRegistrationModal(true);
      return;
    }

    // If anonymous is allowed, show name modal
    // Otherwise go straight to upload with empty name (will show as "אנונימי")
    if (!content.allowAnonymous) {
      setShowNameModal(true);
    } else {
      handleUpload(file, currentVisitor?.nickname || '');
    }
  };

  // Handle registration completion
  const handleRegistrationComplete = useCallback((visitor: Visitor) => {
    setCurrentVisitor(visitor);
    setShowRegistrationModal(false);

    // If there's a pending upload, continue with it
    if (pendingUploadFile) {
      setSelectedFile(pendingUploadFile);
      setPendingUploadFile(null);
      // Continue to name modal or direct upload
      if (!content.allowAnonymous) {
        setShowNameModal(true);
        setUploaderName(visitor.nickname);
      } else {
        handleUpload(pendingUploadFile, visitor.nickname);
      }
    }
  }, [pendingUploadFile, content.allowAnonymous]);

  // Handle gallery upload
  const handleUpload = async (file: File, name: string) => {
    if (!codeId || !ownerId) return;

    setUploading(true);
    setShowNameModal(false);
    setUploadStatus('idle');

    try {
      // Compress image
      const compressedBlob = await compressImage(file);

      // Create form data with correct extension based on actual format
      const formData = new FormData();
      const ext = compressedBlob.type === 'image/webp' ? 'webp' : 'jpg';
      formData.append('file', compressedBlob, `selfie_${Date.now()}.${ext}`);
      formData.append('codeId', codeId);
      formData.append('ownerId', ownerId);
      formData.append('uploaderName', name || t.anonymous);
      if (currentVisitor?.id) {
        formData.append('visitorId', currentVisitor.id);
      }

      // Upload to Vercel Blob using queue (handles retries automatically)
      const data = await queuedUpload(formData, '/api/gallery') as {
        success: boolean;
        image: {
          id: string;
          url: string;
          uploaderName: string;
          size: number;
        };
      };

      if (!data.success) {
        throw new Error('Upload failed');
      }

      // Update Firestore with the new gallery image (client-side to use auth)
      const codeRef = doc(db, 'codes', codeId);
      await updateDoc(codeRef, {
        userGallery: arrayUnion({
          id: data.image.id,
          url: data.image.url,
          uploaderName: data.image.uploaderName,
          uploadedAt: Timestamp.now(),
        }),
      });

      // Update owner's storage used (may fail for anonymous users, non-blocking)
      try {
        const ownerRef = doc(db, 'users', ownerId);
        await updateDoc(ownerRef, {
          storageUsed: increment(data.image.size),
        });
      } catch (storageError) {
        console.log('Storage tracking skipped (anonymous user):', storageError);
      }

      // Save the image ID to sessionStorage
      saveUploadedImageId(data.image.id);

      // Add to myUploadedImages immediately (no need to wait for Firestore listener)
      const newImage: UserGalleryImage = {
        id: data.image.id,
        url: data.image.url,
        uploaderName: data.image.uploaderName,
        uploadedAt: new Date(),
        visitorId: currentVisitor?.id,
      };
      setMyUploadedImages(prev => [...prev, newImage]);

      // Record XP for photo upload (if visitor is registered and this is a route)
      if (currentVisitor && folderId && isRoute) {
        const result = await recordPhotoUpload(currentVisitor.id, folderId);
        if (result.xpEarned > 0) {
          showPopup(result.xpEarned);
          // Refresh visitor data
          const updatedVisitor = await getVisitor(currentVisitor.id);
          if (updatedVisitor) setCurrentVisitor(updatedVisitor);
        }

        // Check for level-up pack award
        if (result.leveledUp && result.packAwarded) {
          // Fetch pending packs to show notification
          const packs = await getPendingPacks(currentVisitor.id, folderId);
          setPendingPacks(packs);
        }
      }

      setUploadStatus('success');

      // Reset after 3 seconds
      setTimeout(() => {
        setUploadStatus('idle');
        setSelectedFile(null);
        setUploaderName('');
      }, 3000);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');

      // Reset after 3 seconds
      setTimeout(() => {
        setUploadStatus('idle');
        setSelectedFile(null);
      }, 3000);
    } finally {
      setUploading(false);
    }
  };

  // Open camera button click
  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  // Submit name and upload
  const handleNameSubmit = () => {
    if (selectedFile) {
      handleUpload(selectedFile, uploaderName);
    }
  };

  // Handle opening edit nickname modal
  const handleEditNickname = () => {
    if (currentVisitor) {
      setEditingNickname(currentVisitor.nickname);
      setShowEditNicknameModal(true);
    }
  };

  // Handle saving nickname
  const handleSaveNickname = async () => {
    if (!currentVisitor || !editingNickname.trim() || savingNickname) return;

    setSavingNickname(true);
    try {
      const trimmedNickname = editingNickname.trim();
      // Update visitor collection
      await updateVisitor(currentVisitor.id, { nickname: trimmedNickname });

      // Also update visitorProgress so leaderboard shows updated name immediately
      if (folderId) {
        const progressId = `${currentVisitor.id}_${folderId}`;
        try {
          await updateDoc(doc(db, 'visitorProgress', progressId), { nickname: trimmedNickname });
        } catch (progressError) {
          // Progress might not exist yet, that's ok
          console.log('Could not update progress nickname:', progressError);
        }
      }

      // Refresh visitor data
      const updatedVisitor = await getVisitor(currentVisitor.id);
      if (updatedVisitor) setCurrentVisitor(updatedVisitor);
      setShowEditNicknameModal(false);
    } catch (error) {
      console.error('Error updating nickname:', error);
    } finally {
      setSavingNickname(false);
    }
  };

  // Handle opening pending packs
  const handleOpenPack = () => {
    if (pendingPacks.length > 0) {
      setSelectedPack(pendingPacks[0]);
      setShowPackModal(true);
    }
  };

  // Handle pack opened
  const handlePackOpened = async (opening: PackOpening) => {
    console.log('[RiddleViewer] Pack opened:', opening);
    // Remove the opened pack from pending list
    setPendingPacks(prev => prev.filter(p => p.id !== selectedPack?.id));
    setSelectedPack(null);

    // Refresh visitor data (pendingPackCount updated)
    if (currentVisitor) {
      const updatedVisitor = await getVisitor(currentVisitor.id);
      if (updatedVisitor) setCurrentVisitor(updatedVisitor);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{ backgroundColor: content.backgroundColor }}
      dir={locale === 'he' ? 'rtl' : 'ltr'}
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

      {/* Floating Action Button (FAB) - Collapsible Controls */}
      {galleryEnabled && (
        <>
          {/* Backdrop when expanded */}
          {controlsExpanded && (
            <div
              className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm transition-opacity duration-300"
              onClick={() => setControlsExpanded(false)}
            />
          )}

          {/* Collapsible Controls Container */}
          <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
            {/* Expanded Controls */}
            <div
              className={`flex flex-col items-end gap-3 transition-all duration-300 origin-bottom-right ${
                controlsExpanded
                  ? 'opacity-100 scale-100 translate-y-0'
                  : 'opacity-0 scale-75 translate-y-4 pointer-events-none'
              }`}
            >
              {/* Pending Packs Badge */}
              {pendingPacks.length > 0 && prizesEnabled && (
                <PendingPacksBadge
                  pendingPacks={pendingPacks}
                  onClick={handleOpenPack}
                  locale={locale}
                />
              )}

              {/* My Uploaded Images Gallery */}
              {myUploadedImages.length > 0 && (
                <div className="flex gap-2 bg-black/60 backdrop-blur-sm rounded-2xl p-2">
                  {myUploadedImages.map((img) => (
                    <div
                      key={img.id}
                      className={`relative transition-all duration-300 ${
                        fadingOutImageId === img.id ? 'opacity-0 scale-75' : 'opacity-100 scale-100'
                      }`}
                    >
                      <img
                        src={img.url}
                        alt=""
                        className="w-16 h-16 rounded-xl object-cover border-2 border-white/30"
                      />
                      <button
                        onClick={() => handleDeleteMyImage(img)}
                        disabled={deletingImageId === img.id || fadingOutImageId === img.id}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg disabled:opacity-50"
                      >
                        {deletingImageId === img.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Visitor Badge - show when registered */}
              {currentVisitor && isRoute && (
                <button
                  onClick={handleEditNickname}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/90 backdrop-blur-sm border border-white/20 shadow-lg hover:bg-slate-700/90 transition-all"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-white font-medium text-sm">
                    {currentVisitor.nickname}
                  </span>
                  <Pencil className="w-4 h-4 text-white/60 flex-shrink-0" />
                </button>
              )}

              {/* XP Info Button (green star) - only show when route is active */}
              {isRoute && (
                <button
                  onClick={() => setShowInstructionsModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 text-white shadow-lg hover:shadow-xl transition-all"
                  title={gamificationTranslations[locale].gameInstructions}
                >
                  <Star className="w-5 h-5 fill-current" />
                  <span className="text-sm font-medium">{gamificationTranslations[locale].howToPlay}</span>
                </button>
              )}

              {/* Camera Button */}
              <button
                onClick={handleCameraClick}
                disabled={uploading || !canUploadMore}
                className="flex items-center gap-2 px-5 py-3 rounded-full bg-white shadow-lg hover:shadow-xl transition-all disabled:opacity-70"
              >
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-gray-600" />
                ) : uploadStatus === 'success' ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : uploadStatus === 'error' ? (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                ) : (
                  <Camera className="w-5 h-5 text-gray-600" />
                )}
                <span className="text-sm font-medium text-gray-700">
                  {uploading
                    ? t.uploading
                    : uploadStatus === 'success'
                    ? t.uploaded
                    : uploadStatus === 'error'
                    ? t.error
                    : !canUploadMore
                    ? t.maxReached
                    : gamificationTranslations[locale].takePhotoHere}
                </span>
              </button>
            </div>

            {/* Main FAB Toggle Button */}
            <button
              onClick={() => setControlsExpanded(!controlsExpanded)}
              className={`w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center ${
                controlsExpanded
                  ? 'bg-slate-800 text-white rotate-45'
                  : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
              }`}
            >
              {controlsExpanded ? (
                <Plus className="w-7 h-7" />
              ) : uploading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : myUploadedImages.length > 0 ? (
                <Camera className="w-6 h-6" />
              ) : (
                <Camera className="w-6 h-6" />
              )}
            </button>
          </div>
        </>
      )}

      {/* Language Switcher - shown when language is 'auto' or not set */}
      {allowLanguageSwitch && (
        <div className="fixed bottom-6 left-6 z-40">
          {/* Language Menu */}
          {showLanguageMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-30"
                onClick={() => setShowLanguageMenu(false)}
              />
              {/* Menu */}
              <div className="absolute bottom-14 left-0 bg-slate-800/95 backdrop-blur-sm rounded-2xl shadow-xl border border-white/10 overflow-hidden min-w-[140px] z-40">
                <button
                  onClick={() => {
                    setLocale('he');
                    setShowLanguageMenu(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-start transition-colors ${
                    locale === 'he'
                      ? 'bg-accent/20 text-accent'
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  <span className="text-lg">🇮🇱</span>
                  <span className="text-sm font-medium">{langT.hebrew}</span>
                </button>
                <button
                  onClick={() => {
                    setLocale('en');
                    setShowLanguageMenu(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-start transition-colors ${
                    locale === 'en'
                      ? 'bg-accent/20 text-accent'
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  <span className="text-lg">🇺🇸</span>
                  <span className="text-sm font-medium">{langT.english}</span>
                </button>
              </div>
            </>
          )}

          {/* Language Toggle Button */}
          <button
            onClick={() => setShowLanguageMenu(!showLanguageMenu)}
            className="w-12 h-12 rounded-full bg-slate-800/90 backdrop-blur-sm border border-white/20 shadow-lg hover:bg-slate-700/90 transition-all flex items-center justify-center"
            title={langT.selectLanguage}
          >
            <Globe className="w-5 h-5 text-white" />
          </button>
        </div>
      )}

      {/* Name Input Modal */}
      {showNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
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
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowNameModal(false);
                  setSelectedFile(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleNameSubmit}
                disabled={!uploaderName.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t.continue}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Registration/Consent Modal for XP tracking */}
      <RegistrationConsentModal
        isOpen={showRegistrationModal}
        onClose={() => {
          setShowRegistrationModal(false);
          setPendingUploadFile(null);
          setSelectedFile(null);
        }}
        onComplete={handleRegistrationComplete}
        locale={locale}
        requireConsent={true}
      />

      {/* Game Instructions Modal */}
      {showInstructionsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowInstructionsModal(false)}
        >
          <div
            className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-5 border border-white/10"
            onClick={(e) => e.stopPropagation()}
            dir={locale === 'he' ? 'rtl' : 'ltr'}
          >
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="text-4xl mb-2">🎮</div>
              <h3 className="text-xl font-bold text-white">
                {gamificationTranslations[locale].howToPlay}
              </h3>
            </div>

            {/* Instructions */}
            <div className="space-y-4">
              {/* Step 1 */}
              <div className="flex items-start gap-3 bg-white/5 rounded-xl p-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <span className="text-lg">🔍</span>
                </div>
                <div className="text-start">
                  <p className="text-white/90 text-sm font-medium">
                    {gamificationTranslations[locale].findTheCode}
                  </p>
                  <p className="text-white/60 text-xs">
                    {gamificationTranslations[locale].scanAndFollow}
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3 bg-white/5 rounded-xl p-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <span className="text-lg">📸</span>
                </div>
                <div className="text-start">
                  <p className="text-white/90 text-sm font-medium">
                    {gamificationTranslations[locale].uploadYourSelfie}
                  </p>
                  <p className="text-white/60 text-xs">
                    {gamificationTranslations[locale].toEarnPoints}
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3 bg-white/5 rounded-xl p-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <span className="text-lg">🏆</span>
                </div>
                <div className="text-start">
                  <p className="text-white/90 text-sm font-medium">
                    {gamificationTranslations[locale].earnPoints}
                  </p>
                  <p className="text-white/60 text-xs">
                    {gamificationTranslations[locale].toOpenPacks}
                  </p>
                </div>
              </div>
            </div>

            {/* XP Values */}
            <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-xl p-4 border border-emerald-500/20">
              <h4 className="text-sm font-semibold text-emerald-400 mb-3 text-center">
                {gamificationTranslations[locale].scoring}
              </h4>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-white/5 rounded-lg p-2">
                  <div className="text-emerald-400 font-bold">+10 XP</div>
                  <div className="text-white/60 text-xs">
                    {gamificationTranslations[locale].stationScan}
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <div className="text-emerald-400 font-bold">+25 XP</div>
                  <div className="text-white/60 text-xs">
                    {gamificationTranslations[locale].eachPhoto}
                  </div>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowInstructionsModal(false)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-white font-semibold shadow-lg hover:shadow-emerald-500/25 transition-all"
            >
              {gamificationTranslations[locale].gotItLetsPlay}
            </button>
          </div>
        </div>
      )}

      {/* Edit Nickname Modal */}
      {showEditNicknameModal && currentVisitor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowEditNicknameModal(false)}
          style={{ touchAction: 'none' }}
        >
          <div
            className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-5 border border-white/10"
            onClick={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            dir={locale === 'he' ? 'rtl' : 'ltr'}
            style={{ touchAction: 'auto', userSelect: 'text', WebkitUserSelect: 'text' }}
          >
            {/* Header with Level Badge */}
            <div className="text-center space-y-2">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-4xl shadow-lg shadow-emerald-500/30">
                {getLevelForXP(currentVisitor.totalXP).emoji}
              </div>
              <h3 className="text-xl font-bold text-white">
                {gamificationTranslations[locale].myProfile}
              </h3>
            </div>

            {/* Player Stats */}
            <div className="bg-white/5 rounded-2xl p-4 space-y-3 border border-white/10">
              {/* Level */}
              <div className="flex items-center justify-between">
                <span className="text-white/60 text-sm">
                  {gamificationTranslations[locale].level}
                </span>
                <span className="text-white font-semibold flex items-center gap-2">
                  <span>{getLevelForXP(currentVisitor.totalXP).emoji}</span>
                  <span>{getLevelName(getLevelForXP(currentVisitor.totalXP), locale)}</span>
                </span>
              </div>

              {/* XP */}
              <div className="flex items-center justify-between">
                <span className="text-white/60 text-sm">
                  {gamificationTranslations[locale].points}
                </span>
                <span className="text-emerald-400 font-bold text-lg">
                  {formatXP(currentVisitor.totalXP, locale)} XP
                </span>
              </div>

              {/* Progress Bar to Next Level */}
              {getLevelForXP(currentVisitor.totalXP).maxXP !== Infinity && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/40">
                      {gamificationTranslations[locale].toNextLevel}
                    </span>
                    <span className="text-white/60">
                      {getProgressToNextLevel(currentVisitor.totalXP)}%
                    </span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full transition-all duration-500 ${locale === 'he' ? 'mr-auto' : 'ml-0'}`}
                      style={{ width: `${getProgressToNextLevel(currentVisitor.totalXP)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Name Input */}
            <div className="space-y-2 text-start">
              <label className="text-white/60 text-sm block">
                {gamificationTranslations[locale].myNameOnLeaderboard}
              </label>
              <input
                type="text"
                value={editingNickname}
                onChange={(e) => setEditingNickname(e.target.value)}
                placeholder={gamificationTranslations[locale].enterName}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 text-start select-text"
                autoFocus
                maxLength={20}
                dir={locale === 'he' ? 'rtl' : 'ltr'}
                style={{ touchAction: 'auto', userSelect: 'text', WebkitUserSelect: 'text' }}
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowEditNicknameModal(false)}
                className="flex-1 py-3 rounded-xl bg-white/10 text-white/80 font-medium hover:bg-white/20 transition-all"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleSaveNickname}
                disabled={!editingNickname.trim() || savingNickname}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-white font-semibold shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {savingNickname ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  gamificationTranslations[locale].save
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* XP Popups */}
      {popups.map((popup) => (
        <XPPopup
          key={popup.id}
          xp={popup.xp}
          locale={locale}
          onComplete={() => removePopup(popup.id)}
        />
      ))}

      {/* Pack Opening Modal */}
      {selectedPack && (
        <PackOpeningModal
          pendingPack={selectedPack}
          isOpen={showPackModal}
          onClose={() => {
            setShowPackModal(false);
            setSelectedPack(null);
          }}
          onOpened={handlePackOpened}
          locale={locale}
        />
      )}
    </div>
  );
}
