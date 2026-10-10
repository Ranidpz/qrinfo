import { NextResponse } from 'next/server';

// Install manifest for the public 10 בול demo - same stopwatch icon as a real 10 בול game (/v/)
export function GET() {
  const icon = (px: number) => `/api/og/tenbool?icon=${px}`;
  return NextResponse.json(
    {
      name: '10 בול',
      short_name: '10 בול',
      description: 'עצרו את הטיימר בדיוק על 10.00',
      start_url: '/play/10-bool',
      scope: '/play/10-bool',
      display: 'standalone',
      orientation: 'any',
      background_color: '#000000',
      theme_color: '#000000',
      icons: [
        { src: icon(192), sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: icon(512), sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: icon(512), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' } },
  );
}
