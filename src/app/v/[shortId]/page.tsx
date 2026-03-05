import { notFound, redirect } from 'next/navigation';
import { getQRCodeByShortId } from '@/lib/db';
import { getAdminDb } from '@/lib/firebase-admin';
import ViewerClient from './ViewerClient';

// Force dynamic to prevent caching - always fetch fresh data
export const dynamic = 'force-dynamic';

interface ViewerPageProps {
  params: Promise<{
    shortId: string;
  }>;
  searchParams: Promise<{
    station?: string;
    token?: string;
    invite?: string;
  }>;
}

// Server-side station resolver using Admin SDK
async function resolveStationServer(stationShortId: string): Promise<string | null> {
  try {
    const db = getAdminDb();

    // Fast path: check if this code has parentCodeShortId stored directly
    const codesSnapshot = await db.collection('codes')
      .where('shortId', '==', stationShortId).limit(1).get();

    if (!codesSnapshot.empty) {
      const codeData = codesSnapshot.docs[0].data();
      if (codeData.parentCodeShortId) {
        return codeData.parentCodeShortId;
      }
    }

    // Fallback: scan all codes for Q.Treasure config with this station
    // (for legacy station codes created before parentCodeShortId was stored)
    const allCodesSnapshot = await db.collection('codes').get();
    for (const codeDoc of allCodesSnapshot.docs) {
      const data = codeDoc.data();
      const qtreasureMedia = data.media?.find(
        (m: { type: string }) => m.type === 'qtreasure'
      );
      if (!qtreasureMedia?.qtreasureConfig) continue;

      const station = qtreasureMedia.qtreasureConfig.stations?.find(
        (s: { isActive: boolean; stationShortId: string }) =>
          s.isActive && s.stationShortId === stationShortId
      );
      if (station) {
        return data.shortId;
      }
    }

    return null;
  } catch (error) {
    console.error('[resolveStationServer] Error:', error);
    return null;
  }
}

export default async function ViewerPage({ params, searchParams }: ViewerPageProps) {
  const { shortId } = await params;
  const { station: stationParam, token: tokenParam } = await searchParams;

  // Resolve station redirects OUTSIDE try-catch
  // (Next.js redirect() throws a special error that must not be caught)
  let redirectTarget: string | null = null;

  try {
    const code = await getQRCodeByShortId(shortId);

    // Debug logging
    console.log('[ViewerPage] Code loaded:', code?.title, 'folderId:', code?.folderId);

    // If code not found or inactive, check if this is a station shortId
    if (!code || !code.isActive) {
      redirectTarget = await resolveStationServer(shortId);
      if (!redirectTarget) {
        notFound();
      }
    }

    // If code exists but has empty media, it might be a station QR code
    if (!redirectTarget && code && code.media.length === 0) {
      redirectTarget = await resolveStationServer(shortId);
    }

    if (!redirectTarget && code) {
      // Filter media by schedule
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      const activeMedia = code.media.filter((m) => {
        if (!m.schedule?.enabled) return true;

        const { startDate, endDate, startTime, endTime } = m.schedule;

        // Check date range
        if (startDate && now < startDate) return false;
        if (endDate && now > endDate) return false;

        // Check time range
        if (startTime && currentTime < startTime) return false;
        if (endTime && currentTime > endTime) return false;

        return true;
      });

      // Sort by order
      activeMedia.sort((a, b) => a.order - b.order);

      return (
        <ViewerClient
          media={activeMedia}
          widgets={code.widgets}
          title={code.title}
          codeId={code.id}
          shortId={code.shortId}
          ownerId={code.ownerId}
          folderId={code.folderId}
          landingPageConfig={code.landingPageConfig}
          scannedStationShortId={stationParam}
          qtagToken={tokenParam}
        />
      );
    }
  } catch (error) {
    console.error('Error loading QR code:', error);
    notFound();
  }

  // Redirect OUTSIDE try-catch (redirect() throws a special Next.js error)
  if (redirectTarget) {
    redirect(`/v/${redirectTarget}?station=${shortId}`);
  }

  notFound();
}

function getDescriptionByMediaType(mediaType: string): string {
  const descriptions: Record<string, string> = {
    qvote: 'מזמינים אתכם להצביע בתחרות 🗳️',
    qstage: 'בחרו אהבתי או לא אהבתי במופע 🎤',
    qhunt: 'מוזמנים לציד הקודים 🎯',
    qtreasure: 'מוזמנים לציד האוצר 🗺️',
    selfiebeam: 'מזמינים אתכם לשתף תמונות במסך הענק 📸',
    riddle: 'מוזמנים לפתור את החידה 🧩',
    wordcloud: 'השתתפו בסקר בענן ☁️',
    weeklycal: 'צפו בלוח האירועים 📅',
    qtag: 'הזמנה לאירוע 🎉',
    minigames: 'מוזמנים לשחק! 🎮',
  };
  return descriptions[mediaType] || 'תוכן QR דינמי';
}

export async function generateMetadata({ params, searchParams }: ViewerPageProps) {
  const { shortId } = await params;
  await searchParams;

  try {
    const code = await getQRCodeByShortId(shortId);

    if (!code) {
      return {
        title: 'לא נמצא - QR.info',
      };
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://qr.playzones.app';
    const primaryMediaType = code.media[0]?.type || 'default';
    const qgamesBranding = primaryMediaType === 'minigames' ? code.media[0]?.qgamesConfig?.branding : undefined;
    const qgamesTitle = qgamesBranding?.title;
    const description = qgamesTitle
      ? `מזמינים אתכם להשתתף ב${qgamesTitle} 🎮`
      : getDescriptionByMediaType(primaryMediaType);

    // Build OG image URL: custom upload > dynamic Q.Tag branding > default
    let ogImage: string;

    if (code.ogImage) {
      ogImage = code.ogImage;
    } else if (primaryMediaType === 'qtag' && code.media[0]?.qtagConfig) {
      const branding = code.media[0].qtagConfig.branding;
      const params = new URLSearchParams();
      params.set('bg', branding.colors.background);
      if (branding.logoUrl) {
        params.set('logo', branding.logoUrl);
      }
      ogImage = `${baseUrl}/api/og/qtag?${params.toString()}`;
    } else if (primaryMediaType === 'minigames') {
      // Q.Games: show branding logo if available, otherwise default Q logo
      const eventLogo = qgamesBranding?.eventLogo;
      if (eventLogo) {
        const ogParams = new URLSearchParams();
        ogParams.set('logo', eventLogo);
        ogImage = `${baseUrl}/api/og/qgames?${ogParams.toString()}`;
      } else {
        ogImage = `${baseUrl}/api/og/qgames`;
      }
    } else {
      ogImage = `${baseUrl}/api/og`;
    }

    const ogTitle = qgamesTitle || code.title;

    return {
      title: `${ogTitle} - QR.info`,
      description,
      manifest: `/v/${shortId}/manifest.json`,
      appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: ogTitle,
      },
      icons: {
        icon: '/favicon.svg',
        apple: '/icons/apple-touch-icon.png',
      },
      openGraph: {
        title: ogTitle,
        description,
        type: 'website',
        url: `${baseUrl}/v/${shortId}`,
        siteName: 'The Q',
        images: [
          {
            url: ogImage,
            width: 633,
            height: 633,
            alt: code.title,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: code.title,
        description,
        images: [ogImage],
      },
    };
  } catch {
    return {
      title: 'QR.info',
    };
  }
}
