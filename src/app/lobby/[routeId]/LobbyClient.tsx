'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import WinnersDisplay from '@/components/lobby/WinnersDisplay';

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
  },
  en: {
    loading: 'Loading...',
    routeNotFound: 'Route not found',
    prizesDisabled: 'Prize system is not active for this route',
    lobbyDisabled: 'Lobby display is not enabled for this route',
  },
};

export default function LobbyClient({ routeId, locale }: LobbyClientProps) {
  const t = translations[locale];

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routeTitle, setRouteTitle] = useState<string>('');

  // Verify route exists and has lobby display enabled
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
        setIsLoading(false);
      } catch (err) {
        console.error('Error checking route:', err);
        setError(t.routeNotFound);
        setIsLoading(false);
      }
    };

    checkRoute();
  }, [routeId, t]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😢</div>
          <p className="text-xl text-white/60">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      {/* Route Title */}
      {routeTitle && (
        <div className="text-center mb-4">
          <p className="text-white/40 text-lg">{routeTitle}</p>
        </div>
      )}

      {/* Winners Display */}
      <WinnersDisplay routeId={routeId} locale={locale} />
    </div>
  );
}
