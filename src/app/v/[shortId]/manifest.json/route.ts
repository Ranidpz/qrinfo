import { NextRequest, NextResponse } from 'next/server';
import { getQRCodeByShortId } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shortId: string }> }
) {
  const { shortId } = await params;

  try {
    const code = await getQRCodeByShortId(shortId);

    // Get branding color from QVote config if available
    const qvoteMedia = code?.media?.find(m => m.type === 'qvote');
    const themeColor = qvoteMedia?.qvoteConfig?.branding?.colors?.buttonBackground || '#3b82f6';
    const backgroundColor = qvoteMedia?.qvoteConfig?.branding?.colors?.background || '#ffffff';

    const manifest = {
      name: code?.title || 'QR Experience',
      short_name: code?.title?.slice(0, 12) || 'QR',
      description: 'Experience powered by QR.info',
      start_url: `/v/${shortId}`,
      scope: `/v/${shortId}`,
      display: 'standalone',
      orientation: 'portrait',
      background_color: backgroundColor,
      theme_color: themeColor,
      id: `/v/${shortId}`,
      icons: [
        {
          src: '/icons/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: '/icons/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable'
        },
        {
          src: '/icons/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: '/icons/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable'
        }
      ]
    };

    return NextResponse.json(manifest, {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error generating manifest:', error);

    // Return a default manifest even on error
    return NextResponse.json({
      name: 'QR Experience',
      short_name: 'QR',
      start_url: `/v/${shortId}`,
      scope: `/v/${shortId}`,
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#3b82f6',
      id: `/v/${shortId}`,
      icons: [
        {
          src: '/icons/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: '/icons/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable'
        },
        {
          src: '/icons/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: '/icons/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable'
        }
      ]
    }, {
      headers: {
        'Content-Type': 'application/manifest+json',
      },
    });
  }
}
