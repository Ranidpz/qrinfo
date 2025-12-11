import { notFound } from 'next/navigation';
import { getQRCodeByShortId } from '@/lib/db';
import ViewerClient from './ViewerClient';

// Force dynamic to prevent caching - always fetch fresh data
export const dynamic = 'force-dynamic';

interface ViewerPageProps {
  params: Promise<{
    shortId: string;
  }>;
}

export default async function ViewerPage({ params }: ViewerPageProps) {
  const { shortId } = await params;

  try {
    const code = await getQRCodeByShortId(shortId);

    // Debug logging
    console.log('[ViewerPage] Code loaded:', code?.title, 'folderId:', code?.folderId);

    if (!code || !code.isActive) {
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
      />
    );
  } catch (error) {
    console.error('Error loading QR code:', error);
    notFound();
  }
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

    return {
      title: `${code.title} - QR.info`,
      description: 'תוכן QR דינמי',
      openGraph: {
        title: code.title,
        description: 'תוכן QR דינמי',
        type: 'website',
        images: [
          {
            url: `${baseUrl}/theQ.png`,
            width: 800,
            height: 600,
            alt: 'The Q Logo',
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: code.title,
        description: 'תוכן QR דינמי',
        images: [`${baseUrl}/theQ.png`],
      },
    };
  } catch {
    return {
      title: 'QR.info',
    };
  }
}
