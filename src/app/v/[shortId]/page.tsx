import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getQRCodeByShortId, incrementViews } from '@/lib/db';
import ViewerClient from './ViewerClient';

interface ViewerPageProps {
  params: Promise<{
    shortId: string;
  }>;
}

export default async function ViewerPage({ params }: ViewerPageProps) {
  const { shortId } = await params;

  // Get user agent from headers for analytics
  const headersList = await headers();
  const userAgent = headersList.get('user-agent') || 'unknown';

  try {
    const code = await getQRCodeByShortId(shortId);

    if (!code || !code.isActive) {
      notFound();
    }

    // Increment views and log analytics (fire and forget)
    incrementViews(code.id, code.shortId, code.ownerId, userAgent).catch(console.error);

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

    return {
      title: `${code.title} - QR.info`,
      description: 'תוכן QR דינמי',
      openGraph: {
        title: code.title,
        type: 'website',
      },
    };
  } catch {
    return {
      title: 'QR.info',
    };
  }
}
