'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getVisitorId } from '@/lib/xp';
import { PendingPack, RouteConfig } from '@/types';
import { getBrowserLocale } from '@/lib/publicTranslations';
import { Gift, MapPin, QrCode, ArrowRight, ArrowLeft } from 'lucide-react';
import PackOpeningModal from '@/components/gamification/PackOpeningModal';

interface PacksClientProps {
  routeId: string;
}

const translations = {
  he: {
    loading: 'טוען...',
    routeNotFound: 'מסלול לא נמצא',
    prizesDisabled: 'מערכת הפרסים לא פעילה במסלול זה',
    yourPacks: 'החבילות שלך',
    packsWaiting: 'חבילות מחכות!',
    tapToOpen: 'לחץ על חבילה לפתיחה',
    noPacks: 'אין לך חבילות כרגע',
    howToGet: 'איך מקבלים חבילות?',
    step1: 'סרקו את הקודים במסלול',
    step2: 'צברו נקודות XP',
    step3: 'עלו רמה וקבלו חבילה!',
    startRoute: 'התחילו את המסלול',
    scanFirst: 'סרקו את הקוד הראשון',
    noRouteStart: 'פנו לצוות לקבלת הוראות התחלה',
  },
  en: {
    loading: 'Loading...',
    routeNotFound: 'Route not found',
    prizesDisabled: 'Prize system is not active for this route',
    yourPacks: 'Your Packs',
    packsWaiting: 'Packs waiting!',
    tapToOpen: 'Tap a pack to open',
    noPacks: "You don't have any packs yet",
    howToGet: 'How to get packs?',
    step1: 'Scan the codes on the route',
    step2: 'Earn XP points',
    step3: 'Level up and get a pack!',
    startRoute: 'Start the route',
    scanFirst: 'Scan the first code',
    noRouteStart: 'Ask staff for instructions',
  },
};

export default function PacksClient({ routeId }: PacksClientProps) {
  const [locale, setLocale] = useState<'he' | 'en'>('he');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routeTitle, setRouteTitle] = useState<string>('');
  const [routeStartUrl, setRouteStartUrl] = useState<string | null>(null);
  const [pendingPacks, setPendingPacks] = useState<PendingPack[]>([]);
  const [openingPack, setOpeningPack] = useState<PendingPack | null>(null);

  const t = translations[locale];
  const isRTL = locale === 'he';
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  // Get locale on mount
  useEffect(() => {
    setLocale(getBrowserLocale());
  }, []);

  // Load route and packs
  useEffect(() => {
    const loadData = async () => {
      try {
        // Get route info
        const folderDoc = await getDoc(doc(db, 'folders', routeId));

        if (!folderDoc.exists()) {
          setError(t.routeNotFound);
          setIsLoading(false);
          return;
        }

        const folderData = folderDoc.data();
        const routeConfig = folderData?.routeConfig as RouteConfig | undefined;

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

        setRouteTitle(routeConfig.routeTitle || folderData.name || '');
        setRouteStartUrl(routeConfig.routeStartUrl || null);

        // Get visitor's pending packs
        const visitorId = getVisitorId();
        if (visitorId) {
          const packsQuery = query(
            collection(db, 'pendingPacks'),
            where('visitorId', '==', visitorId),
            where('routeId', '==', routeId),
            where('opened', '==', false)
          );

          const packsSnapshot = await getDocs(packsQuery);
          const packs: PendingPack[] = [];

          packsSnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            packs.push({
              id: docSnap.id,
              visitorId: data.visitorId,
              routeId: data.routeId,
              reason: data.reason,
              earnedAt: data.earnedAt?.toDate?.() || new Date(),
              opened: data.opened,
              createdAt: data.createdAt?.toDate?.() || new Date(),
            } as PendingPack);
          });

          setPendingPacks(packs);
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Error loading packs:', err);
        setError(t.routeNotFound);
        setIsLoading(false);
      }
    };

    loadData();
  }, [routeId, t.routeNotFound, t.prizesDisabled]);

  // Handle pack opened
  const handlePackOpened = (packId: string) => {
    setPendingPacks((prev) => prev.filter((p) => p.id !== packId));
    setOpeningPack(null);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center font-assistant" dir={isRTL ? 'rtl' : 'ltr'}>
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800&display=swap');
          .font-assistant { font-family: 'Assistant', sans-serif; }
        `}</style>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xl text-white/60">{t.loading}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center font-assistant" dir={isRTL ? 'rtl' : 'ltr'}>
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800&display=swap');
          .font-assistant { font-family: 'Assistant', sans-serif; }
        `}</style>
        <div className="text-center">
          <div className="text-6xl mb-4">😢</div>
          <p className="text-xl text-white/60">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 font-assistant" dir={isRTL ? 'rtl' : 'ltr'}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800&display=swap');
        .font-assistant { font-family: 'Assistant', sans-serif; }
      `}</style>

      <div className="container mx-auto px-4 py-8 max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          {routeTitle && (
            <p className="text-white/50 text-sm mb-1">{routeTitle}</p>
          )}
          <h1 className="text-3xl font-bold text-white flex items-center justify-center gap-3">
            <Gift className="w-8 h-8 text-purple-400" />
            {t.yourPacks}
          </h1>
        </div>

        {/* Has Packs */}
        {pendingPacks.length > 0 ? (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-block px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg animate-pulse">
                {pendingPacks.length} {t.packsWaiting}
              </div>
              <p className="text-white/60 mt-2">{t.tapToOpen}</p>
            </div>

            {/* Packs Grid */}
            <div className="grid grid-cols-2 gap-4">
              {pendingPacks.map((pack) => (
                <button
                  key={pack.id}
                  onClick={() => setOpeningPack(pack)}
                  className="aspect-square rounded-2xl bg-gradient-to-br from-purple-600/30 to-pink-600/30 border border-purple-500/30 p-4 flex flex-col items-center justify-center gap-2 transition-all hover:scale-105 hover:border-purple-400/50 active:scale-95"
                >
                  <div className="text-6xl animate-bounce">🎁</div>
                  <span className="text-white/80 text-sm font-medium">
                    {locale === 'he' ? 'חבילה' : 'Pack'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* No Packs */
          <div className="space-y-8">
            <div className="text-center p-8 rounded-2xl bg-white/5 border border-white/10">
              <div className="text-6xl mb-4">📦</div>
              <h2 className="text-xl font-bold text-white mb-2">{t.noPacks}</h2>
              <p className="text-white/60">{t.howToGet}</p>
            </div>

            {/* How to get packs */}
            <div className="space-y-3">
              {[
                { emoji: '📱', text: t.step1 },
                { emoji: '⭐', text: t.step2 },
                { emoji: '🎁', text: t.step3 },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-3xl">{step.emoji}</div>
                  <div className="flex-1 text-white/80">{step.text}</div>
                  {i < 2 && <Arrow className="w-5 h-5 text-white/30" />}
                </div>
              ))}
            </div>

            {/* Start Route CTA */}
            <div className="text-center space-y-4">
              <h3 className="text-lg font-bold text-white">{t.startRoute}</h3>

              {routeStartUrl ? (
                <a
                  href={routeStartUrl}
                  className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/25"
                >
                  <QrCode className="w-6 h-6" />
                  {t.scanFirst}
                </a>
              ) : (
                <div className="flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-white/10 text-white/60">
                  <MapPin className="w-6 h-6" />
                  {t.noRouteStart}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pack Opening Modal */}
      {openingPack && (
        <PackOpeningModal
          pendingPack={openingPack}
          isOpen={true}
          locale={locale}
          onClose={() => setOpeningPack(null)}
          onOpened={(_opening) => handlePackOpened(openingPack.id)}
        />
      )}
    </div>
  );
}
