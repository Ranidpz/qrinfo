import { notFound } from 'next/navigation';
import { getQRCodeByShortId } from '@/lib/db';
import { cache } from 'react';
import GalleryClient from './GalleryClient';

// generateMetadata and the page both need the code: React's request-scoped cache makes that ONE
// Firestore read per view instead of two (a Selfie Beam doc with its gallery can be ~1MB).
const getCodeOnce = cache(getQRCodeByShortId);

interface GalleryPageProps {
  params: Promise<{
    shortId: string;
  }>;
}

export default async function GalleryPage({ params }: GalleryPageProps) {
  const { shortId } = await params;

  try {
    const code = await getCodeOnce(shortId);

    if (!code || !code.isActive) {
      notFound();
    }

    // Extract company logos from selfiebeam/riddle media items
    const companyLogos: string[] = [];
    let isSelfiebeam = false;
    for (const media of code.media) {
      if (media.type === 'selfiebeam') {
        isSelfiebeam = true;
        if (media.selfiebeamContent?.companyLogos) {
          companyLogos.push(...media.selfiebeamContent.companyLogos);
        }
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
        folderId={code.folderId}
        isSelfiebeam={isSelfiebeam}
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
    const code = await getCodeOnce(shortId);

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
