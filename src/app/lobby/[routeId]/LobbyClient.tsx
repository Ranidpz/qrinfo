'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { doc, getDoc, collection, query, where, orderBy, limit, onSnapshot, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PackOpening, RARITY_CONFIG, UserGalleryImage } from '@/types';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy } from 'lucide-react';

interface LobbyClientProps {
  routeId: string;
  locale: 'he' | 'en';
}

const translations = {
  he: {
    loading: 'טוען...',
    routeNotFound: 'מסלול לא נמצא',
    prizesDisabled: 'מערכת הפרסים לא פעילה במסלול זה',
    lobbyDisabled: 'תצוגת הלובי לא מופעלת במסלול זה',
    andTheWinnersAre: 'והזוכים הם',
    waitingForWinners: 'מחכים לזוכים הראשונים',
    won: 'זכה ב:',
    scanForPrizes: 'סרקו לפתיחת פרסים',
    winner: 'יש לנו זוכה!',
    copied: 'הועתק!',
    clickToCopy: 'לחצו להעתקה',
  },
  en: {
    loading: 'Loading...',
    routeNotFound: 'Route not found',
    prizesDisabled: 'Prize system is not active for this route',
    lobbyDisabled: 'Lobby display is not enabled for this route',
    andTheWinnersAre: 'And the winners are',
    waitingForWinners: 'Waiting for the first winners',
    won: 'Won:',
    scanForPrizes: 'Scan for prizes',
    winner: 'We have a winner!',
    copied: 'Copied!',
    clickToCopy: 'Click to copy',
  },
};

export default function LobbyClient({ routeId, locale }: LobbyClientProps) {
  const t = translations[locale];
  const isRTL = locale === 'he';

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routeTitle, setRouteTitle] = useState<string>('');
  const [winners, setWinners] = useState<PackOpening[]>([]);
  const [celebratingWinner, setCelebratingWinner] = useState<PackOpening | null>(null);
  const [seenWinnerIds, setSeenWinnerIds] = useState<Set<string>>(new Set());
  const [galleryImages, setGalleryImages] = useState<UserGalleryImage[]>([]);
  const [copied, setCopied] = useState(false);

  // Shuffle grid background state
  const gridColumns = 5;
  const [gridRows, setGridRows] = useState(4);
  const [visibleSlots, setVisibleSlots] = useState<Map<number, UserGalleryImage>>(new Map());
  const [fadingOutSlot, setFadingOutSlot] = useState<number | null>(null);
  const [animatingSlot, setAnimatingSlot] = useState<number | null>(null);
  const currentlyAssignedRef = useRef<Map<number, string>>(new Map());
  const shuffleIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const imagesRef = useRef<UserGalleryImage[]>([]);

  // Verify route and get gallery images
  useEffect(() => {
    const checkRoute = async () => {
      try {
        const folderDoc = await getDoc(doc(db, 'folders', routeId));

        if (!folderDoc.exists()) {
          setError(t.routeNotFound);
          setIsLoading(false);
          return;
        }

        const folderData = folderDoc.data();
        const routeConfig = folderData?.routeConfig;

        if (!routeConfig?.isRoute) {
          setError(t.routeNotFound);
          setIsLoading(false);
          return;
        }

        if (!routeConfig?.prizesEnabled) {
          setError(t.prizesDisabled);
          setIsLoading(false);
          return;
        }

        if (!routeConfig?.lobbyDisplayEnabled) {
          setError(t.lobbyDisabled);
          setIsLoading(false);
          return;
        }

        setRouteTitle(routeConfig.routeTitle || folderData.name || '');

        // Get all codes in folder for gallery images
        const codesQuery = query(
          collection(db, 'codes'),
          where('folderId', '==', routeId)
        );
        const codesSnapshot = await getDocs(codesQuery);

        const allImages: UserGalleryImage[] = [];
        codesSnapshot.forEach((codeDoc) => {
          const codeData = codeDoc.data();
          const gallery = codeData.userGallery || [];
          gallery.forEach((img: { id: string; url: string; uploaderName: string; uploadedAt: unknown }) => {
            allImages.push({
              id: img.id,
              url: img.url,
              uploaderName: img.uploaderName,
              uploadedAt: img.uploadedAt instanceof Timestamp ? img.uploadedAt.toDate() : new Date(),
            });
          });
        });

        // Shuffle images for variety
        const shuffled = allImages.sort(() => Math.random() - 0.5);
        setGalleryImages(shuffled);
        imagesRef.current = shuffled;

        setIsLoading(false);
      } catch (err) {
        console.error('Error checking route:', err);
        setError(t.routeNotFound);
        setIsLoading(false);
      }
    };

    checkRoute();
  }, [routeId, t]);

  // Calculate grid rows based on screen aspect ratio
  useEffect(() => {
    const calculateGridRows = () => {
      const cellWidth = window.innerWidth / gridColumns;
      const rows = Math.floor(window.innerHeight / cellWidth);
      setGridRows(Math.max(rows, 3)); // Minimum 3 rows
    };
    calculateGridRows();
    window.addEventListener('resize', calculateGridRows);
    return () => window.removeEventListener('resize', calculateGridRows);
  }, []);

  const gridSize = gridColumns * gridRows;

  // Get adjacent slots for preventing same image next to each other
  const getAdjacentSlots = useCallback((slotIndex: number): number[] => {
    const adjacent: number[] = [];
    const row = Math.floor(slotIndex / gridColumns);
    const col = slotIndex % gridColumns;

    if (row > 0) adjacent.push(slotIndex - gridColumns); // Up
    if (slotIndex + gridColumns < gridSize) adjacent.push(slotIndex + gridColumns); // Down
    if (col > 0) adjacent.push(slotIndex - 1); // Left
    if (col < gridColumns - 1) adjacent.push(slotIndex + 1); // Right

    return adjacent;
  }, [gridSize]);

  // Get random image for a slot avoiding adjacent duplicates
  const getImageForSlot = useCallback((slotIndex: number, excludeImageId?: string): UserGalleryImage | null => {
    const currentImages = imagesRef.current;
    if (currentImages.length === 0) return null;

    const adjacentSlots = getAdjacentSlots(slotIndex);
    const adjacentImageIds = new Set<string>();
    adjacentSlots.forEach(adj => {
      const imgId = currentlyAssignedRef.current.get(adj);
      if (imgId) adjacentImageIds.add(imgId);
    });

    const validImages = currentImages.filter(img =>
      img.id !== excludeImageId && !adjacentImageIds.has(img.id)
    );

    if (validImages.length > 0) {
      return validImages[Math.floor(Math.random() * validImages.length)];
    }

    const fallbackImages = currentImages.filter(img => img.id !== excludeImageId);
    if (fallbackImages.length > 0) {
      return fallbackImages[Math.floor(Math.random() * fallbackImages.length)];
    }

    return currentImages[0];
  }, [getAdjacentSlots]);

  // Shuffle mode effect - fills grid then swaps images
  useEffect(() => {
    if (isLoading || error || galleryImages.length === 0) {
      if (shuffleIntervalRef.current) {
        clearInterval(shuffleIntervalRef.current);
        shuffleIntervalRef.current = null;
      }
      return;
    }

    let phase: 'filling' | 'swapping' = 'filling';

    const runInterval = () => {
      if (phase === 'filling') {
        const emptySlots: number[] = [];
        for (let i = 0; i < gridSize; i++) {
          if (!currentlyAssignedRef.current.has(i)) {
            emptySlots.push(i);
          }
        }

        if (emptySlots.length === 0) {
          phase = 'swapping';
          if (shuffleIntervalRef.current) {
            clearInterval(shuffleIntervalRef.current);
          }
          shuffleIntervalRef.current = setInterval(runInterval, 3000);
          return;
        }

        const slotToFill = emptySlots[Math.floor(Math.random() * emptySlots.length)];
        const image = getImageForSlot(slotToFill);

        if (image) {
          currentlyAssignedRef.current.set(slotToFill, image.id);
          setVisibleSlots(prev => {
            const updated = new Map(prev);
            updated.set(slotToFill, image);
            return updated;
          });
          setAnimatingSlot(slotToFill);
          setTimeout(() => setAnimatingSlot(null), 300);
        }
      } else {
        const slotToReplace = Math.floor(Math.random() * gridSize);
        const currentImageId = currentlyAssignedRef.current.get(slotToReplace);
        const newImage = getImageForSlot(slotToReplace, currentImageId);

        if (newImage && newImage.id !== currentImageId) {
          setFadingOutSlot(slotToReplace);

          setTimeout(() => {
            currentlyAssignedRef.current.set(slotToReplace, newImage.id);
            setVisibleSlots(prev => {
              const updated = new Map(prev);
              updated.set(slotToReplace, newImage);
              return updated;
            });
            setFadingOutSlot(null);
            setAnimatingSlot(slotToReplace);
            setTimeout(() => setAnimatingSlot(null), 300);
          }, 400);
        }
      }
    };

    shuffleIntervalRef.current = setInterval(runInterval, 200);

    return () => {
      if (shuffleIntervalRef.current) {
        clearInterval(shuffleIntervalRef.current);
        shuffleIntervalRef.current = null;
      }
    };
  }, [isLoading, error, galleryImages.length, gridSize, getImageForSlot]);

  // Copy URL to clipboard
  const handleCopyUrl = useCallback(() => {
    const url = `${window.location.origin}/packs/${routeId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [routeId]);

  // Listen to winners in real-time
  useEffect(() => {
    if (isLoading || error) return;

    const q = query(
      collection(db, 'packOpenings'),
      where('routeId', '==', routeId),
      where('prizeRarity', 'in', ['epic', 'legendary']),
      orderBy('openedAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newWinners: PackOpening[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        newWinners.push({
          id: doc.id,
          ...data,
          openedAt: data.openedAt instanceof Timestamp ? data.openedAt.toDate() : new Date(data.openedAt),
          redeemedAt: data.redeemedAt instanceof Timestamp ? data.redeemedAt.toDate() : undefined,
        } as PackOpening);
      });

      // Check for new winners to celebrate
      const newWinnerToShow = newWinners.find((w) => !seenWinnerIds.has(w.id));
      if (newWinnerToShow && seenWinnerIds.size > 0) {
        setCelebratingWinner(newWinnerToShow);
        setTimeout(() => setCelebratingWinner(null), 10000);
      }

      setSeenWinnerIds((prev) => {
        const updated = new Set(prev);
        newWinners.forEach((w) => updated.add(w.id));
        return updated;
      });

      setWinners(newWinners);
    });

    return () => unsubscribe();
  }, [routeId, isLoading, error, seenWinnerIds.size]);

  // Format time ago
  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return locale === 'he' ? 'הרגע' : 'Just now';
    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return locale === 'he' ? `לפני ${minutes} דק'` : `${minutes}m ago`;
    }
    if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      return locale === 'he' ? `לפני ${hours} שעות` : `${hours}h ago`;
    }
    const days = Math.floor(seconds / 86400);
    return locale === 'he' ? `לפני ${days} ימים` : `${days}d ago`;
  };

  const packsUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/packs/${routeId}`
    : '';

  // Loading state
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center font-assistant" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <p className="text-2xl text-white/60">{t.loading}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center font-assistant" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="text-center">
          <div className="text-8xl mb-6">😢</div>
          <p className="text-2xl text-white/60">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden font-assistant" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Google Font */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800&display=swap');
        .font-assistant {
          font-family: 'Assistant', sans-serif;
        }
      `}</style>

      {/* Gallery Grid Background with Shuffle effect */}
      <div className="absolute inset-0">
        {galleryImages.length > 0 ? (
          <div
            className="w-full h-full grid gap-0"
            style={{
              gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
              gridTemplateRows: `repeat(${gridRows}, 1fr)`,
            }}
          >
            {Array.from({ length: gridSize }, (_, slotIndex) => {
              const image = visibleSlots.get(slotIndex);
              const isAnimating = animatingSlot === slotIndex;
              const isFadingOut = fadingOutSlot === slotIndex;

              return (
                <div
                  key={slotIndex}
                  className="relative overflow-hidden bg-slate-900"
                >
                  {image && (
                    <img
                      src={image.url}
                      alt=""
                      className={`w-full h-full object-cover transition-opacity duration-400 ${
                        isFadingOut ? 'opacity-0' : isAnimating ? 'animate-quickFadeIn' : 'opacity-100'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Fallback gradient if no images */
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900" />
        )}

        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* Main Content - Glassmorphism Card */}
      <div className="relative h-full flex items-center justify-center p-8">
        <div className="w-full max-w-5xl">
          {/* Winners Card */}
          <div className="bg-black/40 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-white/10 text-center bg-gradient-to-r from-blue-600/20 via-cyan-600/20 to-blue-600/20">
              {routeTitle && (
                <p className="text-white/50 text-lg mb-1">{routeTitle}</p>
              )}
              <h1 className="text-4xl md:text-5xl font-bold text-white flex items-center justify-center gap-2">
                🏆 {t.andTheWinnersAre}
                <span className="inline-flex">
                  <span className="animate-dot1">.</span>
                  <span className="animate-dot2">.</span>
                  <span className="animate-dot3">.</span>
                </span>
              </h1>
            </div>

            {/* Winners List */}
            <div className="p-6 max-h-[50vh] overflow-y-auto">
              {winners.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-8xl mb-6 animate-bounce">🎁</div>
                  <p className="text-2xl text-white/60">{t.waitingForWinners}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {winners.map((winner, index) => {
                    const config = RARITY_CONFIG[winner.prizeRarity];
                    const isFirst = index === 0;

                    return (
                      <div
                        key={winner.id}
                        className={`relative p-5 rounded-2xl backdrop-blur-sm border transition-all duration-500 ${isFirst ? 'bg-gradient-to-r from-blue-900/60 to-cyan-900/60 border-blue-500/50 scale-[1.02]' : 'bg-white/5 border-white/10'}`}
                        style={{
                          boxShadow: isFirst ? `0 0 40px ${config.color}50` : undefined,
                        }}
                      >
                        <div className="flex items-center gap-5">
                          {/* Rarity Icon */}
                          <div
                            className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
                            style={{
                              background: `linear-gradient(135deg, ${config.bgColor}, ${config.color})`,
                              boxShadow: `0 0 25px ${config.color}60`,
                            }}
                          >
                            {config.emoji}
                          </div>

                          {/* Winner Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1 flex-wrap">
                              <span className="text-xl font-bold text-white truncate">
                                {winner.visitorNickname}
                              </span>
                              <span
                                className="px-3 py-1 rounded-full text-sm font-bold flex-shrink-0"
                                style={{ backgroundColor: config.color, color: 'white' }}
                              >
                                {locale === 'he' ? config.name : config.nameEn}
                              </span>
                            </div>
                            <p className="text-lg text-white/80">
                              {t.won}{' '}
                              <span className="font-bold" style={{ color: config.color }}>
                                {locale === 'he' ? winner.prizeName : winner.prizeNameEn}
                              </span>
                            </p>
                          </div>

                          {/* Time */}
                          <div className="text-white/40 text-base flex-shrink-0">
                            {formatTimeAgo(winner.openedAt)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* QR Code Section */}
            {packsUrl && (
              <div className="p-6 border-t border-white/10 bg-white/5">
                <div className="flex items-center justify-center gap-6">
                  <button
                    onClick={handleCopyUrl}
                    className="bg-white p-3 rounded-xl shadow-lg hover:scale-105 transition-transform cursor-pointer relative group"
                    title={t.clickToCopy}
                  >
                    <QRCodeSVG
                      value={packsUrl}
                      size={120}
                      level="H"
                      includeMargin={false}
                    />
                    {/* Copy overlay */}
                    <div className={`absolute inset-0 rounded-xl flex items-center justify-center transition-all ${
                      copied
                        ? 'bg-green-500/90'
                        : 'bg-black/0 group-hover:bg-black/30'
                    }`}>
                      {copied ? (
                        <div className="flex items-center gap-2 text-white font-bold">
                          <Check className="w-6 h-6" />
                          <span>{t.copied}</span>
                        </div>
                      ) : (
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 text-white font-bold">
                          <Copy className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                  </button>
                  <div className="text-center">
                    <p className="text-xl font-bold text-white mb-1">
                      {t.scanForPrizes}
                    </p>
                    <p className="text-sm text-white/40">
                      {routeTitle}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Winner Celebration Overlay */}
      {celebratingWinner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-fadeIn">
          {/* Confetti */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 50 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-4 h-4 rounded-full animate-confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: '-20px',
                  backgroundColor: ['#F59E0B', '#8B5CF6', '#EC4899', '#10B981', '#3B82F6'][Math.floor(Math.random() * 5)],
                  animationDelay: `${Math.random() * 3}s`,
                  animationDuration: `${3 + Math.random() * 2}s`,
                }}
              />
            ))}
          </div>

          {/* Winner Info */}
          <div className="text-center z-10">
            <div
              className="inline-block px-10 py-4 rounded-full text-3xl font-bold text-white mb-8 animate-bounce"
              style={{
                background: `linear-gradient(135deg, ${RARITY_CONFIG[celebratingWinner.prizeRarity].bgColor}, ${RARITY_CONFIG[celebratingWinner.prizeRarity].color})`,
                boxShadow: `0 0 60px ${RARITY_CONFIG[celebratingWinner.prizeRarity].color}80`,
              }}
            >
              {RARITY_CONFIG[celebratingWinner.prizeRarity].emoji} {t.winner} {RARITY_CONFIG[celebratingWinner.prizeRarity].emoji}
            </div>

            <h1 className="text-7xl font-black text-white mb-6 animate-pulse">
              {celebratingWinner.visitorNickname}
            </h1>

            <div
              className="inline-block px-10 py-6 rounded-2xl"
              style={{
                background: `linear-gradient(135deg, ${RARITY_CONFIG[celebratingWinner.prizeRarity].bgColor}40, ${RARITY_CONFIG[celebratingWinner.prizeRarity].color}40)`,
                border: `3px solid ${RARITY_CONFIG[celebratingWinner.prizeRarity].color}`,
              }}
            >
              <h2 className="text-5xl font-bold text-white">
                {locale === 'he' ? celebratingWinner.prizeName : celebratingWinner.prizeNameEn}
              </h2>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti linear forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        @keyframes quickFadeIn {
          0% {
            opacity: 0;
            transform: scale(1.05);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-quickFadeIn {
          animation: quickFadeIn 0.4s ease-out;
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        .animate-dot1 {
          animation: dotPulse 1.5s ease-in-out infinite;
          animation-delay: 0s;
        }
        .animate-dot2 {
          animation: dotPulse 1.5s ease-in-out infinite;
          animation-delay: 0.3s;
        }
        .animate-dot3 {
          animation: dotPulse 1.5s ease-in-out infinite;
          animation-delay: 0.6s;
        }
      `}</style>
    </div>
  );
}
