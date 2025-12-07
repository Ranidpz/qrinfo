import { notFound } from 'next/navigation';
import { getQRCodeByShortId } from '@/lib/db';
import GalleryClient from './GalleryClient';

interface GalleryPageProps {
  params: Promise<{
    shortId: string;
  }>;
}

export default async function GalleryPage({ params }: GalleryPageProps) {
  const { shortId } = await params;

  try {
    const code = await getQRCodeByShortId(shortId);

    if (!code || !code.isActive) {
      notFound();
    }

    // Extract company logos from selfiebeam/riddle media items
    const companyLogos: string[] = [];
    for (const media of code.media) {
      if (media.type === 'selfiebeam' && media.selfiebeamContent?.companyLogos) {
        companyLogos.push(...media.selfiebeamContent.companyLogos);
      }
    }

    return (
      <GalleryClient
        codeId={code.id}
        shortId={code.shortId}
        ownerId={code.ownerId}
        title={code.title}
        initialImages={code.userGallery || []}
        initialSettings={code.gallerySettings}
        companyLogos={companyLogos}
      />
    );
  } catch (error) {
    console.error('Error loading gallery:', error);
    notFound();
  }
}

export async function generateMetadata({ params }: GalleryPageProps) {
  const { shortId } = await params;

  try {
    const code = await getQRCodeByShortId(shortId);

    if (!code) {
      return {
        title: 'גלריה - QR.info',
      };
    }

    return {
      title: `גלריה - ${code.title} - QR.info`,
      description: 'גלריית תמונות משתתפים',
    };
  } catch {
    return {
      title: 'גלריה - QR.info',
    };
  }
}
