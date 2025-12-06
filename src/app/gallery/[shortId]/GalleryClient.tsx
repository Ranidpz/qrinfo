'use client';

import { useState, useEffect, useRef } from 'react';
import { UserGalleryImage } from '@/types';
import { X, Trash2, Grid, Loader2 } from 'lucide-react';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

interface GalleryClientProps {
  codeId: string;
  shortId: string;
  ownerId: string;
  title: string;
  initialImages: UserGalleryImage[];
}

export default function GalleryClient({
  codeId,
  shortId,
  ownerId,
  title,
  initialImages,
}: GalleryClientProps) {
  const { user } = useAuth();
  const isOwner = user?.id === ownerId;

  const [images, setImages] = useState<UserGalleryImage[]>(initialImages);
  const [lightboxImage, setLightboxImage] = useState<UserGalleryImage | null>(null);
  const [gridColumns, setGridColumns] = useState(3);
  const [newImageIds, setNewImageIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showSlider, setShowSlider] = useState(false);
  const previousImagesRef = useRef<Set<string>>(new Set(initialImages.map(img => img.id)));

  // Real-time updates from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'codes', codeId), (docSnap) => {
      if (!docSnap.exists()) return;

      const data = docSnap.data();
      const gallery = (data.userGallery || []) as Array<{
        id: string;
        url: string;
        uploaderName: string;
        uploadedAt: { toDate?: () => Date } | Date;
      }>;

      // Convert to UserGalleryImage format
      const newImages: UserGalleryImage[] = gallery.map((img) => ({
        id: img.id,
        url: img.url,
        uploaderName: img.uploaderName,
        uploadedAt: img.uploadedAt && typeof (img.uploadedAt as { toDate?: () => Date }).toDate === 'function'
          ? (img.uploadedAt as { toDate: () => Date }).toDate()
          : new Date(img.uploadedAt as unknown as string),
      }));

      // Sort by uploadedAt descending (newest first)
      newImages.sort((a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );

      // Find new images for animation
      const newIds = new Set<string>();
      newImages.forEach((img) => {
        if (!previousImagesRef.current.has(img.id)) {
          newIds.add(img.id);
        }
      });

      if (newIds.size > 0) {
        setNewImageIds(newIds);
        // Remove animation class after animation completes
        setTimeout(() => {
          setNewImageIds(new Set());
        }, 600);
      }

      // Update previous images ref
      previousImagesRef.current = new Set(newImages.map(img => img.id));

      setImages(newImages);
    });

    return () => unsubscribe();
  }, [codeId]);

  // Handle delete image
  const handleDeleteImage = async (image: UserGalleryImage) => {
    if (!isOwner || deleting) return;

    setDeleting(image.id);

    try {
      const response = await fetch('/api/gallery', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          codeId,
          imageId: image.id,
          imageUrl: image.url,
          userId: user?.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete image');
      }

      // Close lightbox if viewing deleted image
      if (lightboxImage?.id === image.id) {
        setLightboxImage(null);
      }
    } catch (error) {
      console.error('Error deleting image:', error);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            <p className="text-sm text-white/60">
              {images.length} תמונות
            </p>
          </div>

          <button
            onClick={() => setShowSlider(!showSlider)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <Grid className="w-5 h-5" />
          </button>
        </div>

        {/* Grid Density Slider */}
        {showSlider && (
          <div className="px-4 pb-4 flex items-center gap-4">
            <span className="text-sm text-white/60">גודל רשת:</span>
            <input
              type="range"
              min="2"
              max="6"
              value={gridColumns}
              onChange={(e) => setGridColumns(Number(e.target.value))}
              className="flex-1 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-sm text-white/60 w-8">{gridColumns}</span>
          </div>
        )}
      </div>

      {/* Grid */}
      {images.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-4">
            <Grid className="w-10 h-10 text-white/40" />
          </div>
          <h2 className="text-xl font-semibold mb-2">הגלריה ריקה</h2>
          <p className="text-white/60">
            עדיין אין תמונות בגלריה הזו
          </p>
          <a
            href={`/v/${shortId}`}
            className="mt-4 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 transition-colors"
          >
            חזרה לדף
          </a>
        </div>
      ) : (
        <div
          className="grid gap-1 p-1"
          style={{
            gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
          }}
        >
          {images.map((image) => (
            <button
              key={image.id}
              onClick={() => setLightboxImage(image)}
              className={`relative aspect-square overflow-hidden bg-white/5 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                newImageIds.has(image.id) ? 'animate-bounceIn' : ''
              }`}
            >
              <img
                src={image.url}
                alt={image.uploaderName}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {/* Name overlay on hover */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 hover:opacity-100 transition-opacity">
                <p className="text-xs text-white truncate">{image.uploaderName}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setLightboxImage(null)}
        >
          {/* Close button */}
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Delete button (owner only) */}
          {isOwner && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteImage(lightboxImage);
              }}
              disabled={deleting === lightboxImage.id}
              className="absolute top-4 left-4 p-2 rounded-full bg-red-500/80 text-white hover:bg-red-500 transition-colors z-10 disabled:opacity-50"
            >
              {deleting === lightboxImage.id ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Trash2 className="w-6 h-6" />
              )}
            </button>
          )}

          {/* Image */}
          <img
            src={lightboxImage.url}
            alt={lightboxImage.uploaderName}
            className="max-w-[90vw] max-h-[80vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Info */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm">
            <p className="text-white text-sm">{lightboxImage.uploaderName}</p>
          </div>
        </div>
      )}

      {/* Animation styles */}
      <style jsx global>{`
        @keyframes bounceIn {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          50% {
            transform: scale(1.05);
          }
          70% {
            transform: scale(0.9);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-bounceIn {
          animation: bounceIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
