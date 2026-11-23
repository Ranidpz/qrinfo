// /g/{code}/manifest.json — the install manifest of a gnome's landing page (קוד הגמדים).
// A group may add the game to its home screen while still on /g/{code} (it just scanned a gnome
// with the phone's camera). Without a manifest iOS would make that page the app and treat the
// game page /v/{shortId} as "outside" (browser frame on top). So the gnome page carries the SAME
// app as /v/{shortId}: same id, start_url /v/{shortId}, scope the whole site.

import { NextRequest, NextResponse } from 'next/server';
import { lookupGnome } from '@/lib/thecode/store';

export const dynamic = 'force-dynamic';

const ICONS = [
  { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
  { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];

export async function GET(_request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let raw = code;
  try { raw = decodeURIComponent(code); } catch { /* keep the raw segment */ }
  let start = `/g/${encodeURIComponent(raw.slice(0, 40))}`;
  let id = start;
  let name = 'קוד הגמדים';
  try {
    const hit = await lookupGnome(raw.slice(0, 40));
    if (hit.ok && hit.shortId) {
      start = `/v/${hit.shortId}`;
      id = start;
      name = hit.title || name;
    }
  } catch (error) {
    console.error('thecode gnome manifest error:', error);
  }
  return NextResponse.json({
    name,
    short_name: name.slice(0, 12),
    description: 'קוד הגמדים',
    start_url: start,
    scope: '/',
    id,
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0B1030',
    theme_color: '#0B1030',
    icons: ICONS,
  }, { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=300' } });
}
