import { notFound, redirect } from 'next/navigation';
import { getQRCodeByShortId } from '@/lib/db';
import { resolveStationShortId } from '@/lib/qtreasure';
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
  }>;
}

export default async function ViewerPage({ params, searchParams }: ViewerPageProps) {
  const { shortId } = await params;
  const { station: stationParam, token: tokenParam } = await searchParams;

  try {
    const code = await getQRCodeByShortId(shortId);

    // Debug logging
    console.log('[ViewerPage] Code loaded:', code?.title, 'folderId:', code?.folderId);

    // If code not found, check if this is a station shortId
    if (!code || !code.isActive) {
      // Try to resolve as station shortId
      const stationInfo = await resolveStationShortId(shortId);

      if (stationInfo.found && stationInfo.mainCodeShortId) {
        // Redirect to main game with station parameter
        redirect(`/v/${stationInfo.mainCodeShortId}?station=${shortId}`);
      }

      // Not a station either - 404
      notFound();
    }

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
  } catch (error) {
    console.error('Error loading QR code:', error);
    notFound();
  }
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
  };
  return descriptions[mediaType] || 'תוכן QR דינמי';
}

export async function generateMetadata({ params }: ViewerPageProps) {
  const { shortId } = await params;

  try {
    const code = await getQRCodeByShortId(shortId);

    if (!code) {
      return {
        title: 'לא נמצא - QR.info',
      };
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://qr.playzones.app';
    const primaryMediaType = code.media[0]?.type || 'default';
    const description = getDescriptionByMediaType(primaryMediaType);

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
    } else {
      ogImage = `${baseUrl}/api/og`;
    }

    return {
      title: `${code.title} - QR.info`,
      description,
      manifest: `/v/${shortId}/manifest.json`,
      appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: code.title,
      },
      icons: {
        icon: '/favicon.svg',
        apple: '/icons/apple-touch-icon.png',
      },
      openGraph: {
        title: code.title,
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
