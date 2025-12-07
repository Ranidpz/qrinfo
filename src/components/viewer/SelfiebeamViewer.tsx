'use client';

import { useState, useRef, useEffect } from 'react';
import { SelfiebeamContent, UserGalleryImage } from '@/types';
import { ChevronLeft, ChevronRight, X, Camera, Loader2, Check, AlertCircle, Trash2 } from 'lucide-react';
import { onSnapshot, doc, updateDoc, arrayUnion, increment, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import DOMPurify from 'isomorphic-dompurify';
import { queuedUpload } from '@/lib/uploadQueue';

interface SelfiebeamViewerProps {
  content: SelfiebeamContent;
  codeId?: string;
  shortId?: string;
  ownerId?: string;
}

// Format text with WhatsApp-style formatting (with XSS protection)
function formatContent(text: string): string {
  // First sanitize the input to remove any malicious HTML
  const sanitized = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
  // Then apply formatting
  const formatted = sanitized
    .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/~([^~]+)~/g, '<del>$1</del>');
  // Sanitize again to ensure only our tags are present
  return DOMPurify.sanitize(formatted, { ALLOWED_TAGS: ['strong', 'em', 'del'] });
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

// Compress image to WebP format
async function compressImage(file: File): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const img = await createImageBitmap(file);

  // Resize to 600x600 max (enough for selfies)
  const maxDim = 600;
  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width *= ratio;
    height *= ratio;
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  // Convert to WebP (lighter than JPEG)
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/webp', 0.7);
  });
}

export default function SelfiebeamViewer({ content, codeId, shortId, ownerId }: SelfiebeamViewerProps) {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Gallery upload state
  const [showNameModal, setShowNameModal] = useState(false);
  const [uploaderName, setUploaderName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // My uploaded images state (stored in sessionStorage by image ID)
  const [myUploadedImages, setMyUploadedImages] = useState<UserGalleryImage[]>([]);
  const [allGalleryImages, setAllGalleryImages] = useState<UserGalleryImage[]>([]);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [fadingOutImageId, setFadingOutImageId] = useState<string | null>(null);

  // Max images per user
  const MAX_USER_IMAGES = 3;

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

    // If anonymous is allowed, show name modal
    // Otherwise go straight to upload with empty name (will show as "אנונימי")
    if (!content.allowAnonymous) {
      setShowNameModal(true);
    } else {
      handleUpload(file, '');
    }
  };

  // Handle gallery upload
  const handleUpload = async (file: File, name: string) => {
    if (!codeId || !ownerId) return;

    setUploading(true);
    setShowNameModal(false);
    setUploadStatus('idle');

    try {
      // Compress image
      const compressedBlob = await compressImage(file);

      // Create form data
      const formData = new FormData();
      formData.append('file', compressedBlob, `selfie_${Date.now()}.webp`);
      formData.append('codeId', codeId);
      formData.append('ownerId', ownerId);
      formData.append('uploaderName', name || 'אנונימי');

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

      // Update owner's storage used
      const ownerRef = doc(db, 'users', ownerId);
      await updateDoc(ownerRef, {
        storageUsed: increment(data.image.size),
      });

      // Save the image ID to sessionStorage
      saveUploadedImageId(data.image.id);

      // Add to myUploadedImages immediately (no need to wait for Firestore listener)
      const newImage: UserGalleryImage = {
        id: data.image.id,
        url: data.image.url,
        uploaderName: data.image.uploaderName,
        uploadedAt: new Date(),
      };
      setMyUploadedImages(prev => [...prev, newImage]);

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

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{ backgroundColor: content.backgroundColor }}
    >
      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-start p-4 sm:p-6 md:p-8 overflow-y-auto">
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

      {/* Floating Camera Button and My Gallery */}
      {galleryEnabled && (
        <div className="fixed bottom-4 left-0 right-0 z-40 flex flex-col items-center gap-2 px-4">
          {/* My Uploaded Images Gallery - Full width on mobile */}
          {myUploadedImages.length > 0 && (
            <div className="w-full max-w-md flex justify-center gap-2 bg-black/50 backdrop-blur-sm rounded-2xl p-2">
              {myUploadedImages.map((img) => (
                <div
                  key={img.id}
                  className={`relative flex-1 max-w-[100px] transition-all duration-300 ${
                    fadingOutImageId === img.id ? 'opacity-0 scale-75' : 'opacity-100 scale-100'
                  }`}
                >
                  <img
                    src={img.url}
                    alt=""
                    className="w-full aspect-square rounded-xl object-cover border-2 border-white/30"
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

          {/* Camera Button */}
          <button
            onClick={handleCameraClick}
            disabled={uploading || !canUploadMore}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-white shadow-lg hover:shadow-xl transition-all disabled:opacity-70"
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
                ? 'מעלה...'
                : uploadStatus === 'success'
                ? 'הועלה!'
                : uploadStatus === 'error'
                ? 'שגיאה'
                : !canUploadMore
                ? 'הגעת למקסימום'
                : 'צלמו כאן'}
            </span>
          </button>
        </div>
      )}

      {/* Name Input Modal */}
      {showNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 text-center">
              הזן את שמך
            </h3>
            <p className="text-sm text-gray-500 text-center">
              השם יופיע ליד התמונה בגלריה
            </p>
            <input
              type="text"
              value={uploaderName}
              onChange={(e) => setUploaderName(e.target.value)}
              placeholder="שם או כינוי..."
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
                ביטול
              </button>
              <button
                onClick={handleNameSubmit}
                disabled={!uploaderName.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                המשך
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
