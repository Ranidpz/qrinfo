'use client';

import { useState } from 'react';
import { RiddleContent } from '@/types';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface RiddleViewerProps {
  content: RiddleContent;
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

export default function RiddleViewer({ content }: RiddleViewerProps) {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const youtubeId = content.youtubeUrl ? extractYoutubeId(content.youtubeUrl) : null;
  const hasImages = content.images && content.images.length > 0;

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
    </div>
  );
}
