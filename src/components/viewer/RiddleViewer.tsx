'use client';

import { useState, useRef } from 'react';
import { RiddleContent } from '@/types';
import { ChevronLeft, ChevronRight, X, Camera, Loader2, Check, AlertCircle } from 'lucide-react';
import { doc, updateDoc, arrayUnion, serverTimestamp, increment, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface RiddleViewerProps {
  content: RiddleContent;
  codeId?: string;
  shortId?: string;
  ownerId?: string;
}

// Format text with WhatsApp-style formatting
function formatContent(text: string): string {
  return text
    .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/~([^~]+)~/g, '<del>$1</del>');
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

export default function RiddleViewer({ content, codeId, shortId, ownerId }: RiddleViewerProps) {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Gallery upload state
  const [showNameModal, setShowNameModal] = useState(false);
  const [uploaderName, setUploaderName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const youtubeId = content.youtubeUrl ? extractYoutubeId(content.youtubeUrl) : null;
  const hasImages = content.images && content.images.length > 0;
  const galleryEnabled = content.galleryEnabled && codeId;

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

      // Upload to Vercel Blob
      const response = await fetch('/api/gallery', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();

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

      {/* Floating Camera Button */}
      {galleryEnabled && (
        <button
          onClick={handleCameraClick}
          disabled={uploading}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-6 py-3 rounded-full bg-white shadow-lg hover:shadow-xl transition-all disabled:opacity-70"
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
              : 'צלמו כאן'}
          </span>
        </button>
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
