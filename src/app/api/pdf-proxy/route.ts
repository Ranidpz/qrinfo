import { NextRequest, NextResponse } from 'next/server';
import { isOwnStorageUrl } from '@/lib/storage-guard';

const PDF_SIGNATURE = Buffer.from('%PDF-');

// Use Node.js runtime for better compatibility with fetch and large files
export const runtime = 'nodejs';
// Increase max duration for large PDFs
export const maxDuration = 30;

/**
 * PDF Proxy API Route
 *
 * This endpoint proxies PDF files from Vercel Blob storage to avoid CORS issues
 * when loading PDFs with Real3D FlipBook library.
 *
 * Usage: /api/pdf-proxy?url=<encoded-pdf-url>
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pdfUrl = searchParams.get('url');

  if (!pdfUrl) {
    return NextResponse.json(
      { error: 'Missing url parameter' },
      { status: 400 }
    );
  }

  // Only our own Blob store and our own R2 domain — never an arbitrary blob store or host.
  if (!isOwnStorageUrl(pdfUrl)) {
    return NextResponse.json({ error: 'URL not allowed' }, { status: 403 });
  }

  try {
    const response = await fetch(pdfUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/pdf' },
      redirect: 'error',
    });

    if (!response.ok) {
      console.log('[PDF Proxy] Fetch failed:', response.status);
      return NextResponse.json(
        { error: `Failed to fetch PDF: ${response.status}` },
        { status: response.status === 404 ? 404 : 502 }
      );
    }

    const pdfData = await response.arrayBuffer();

    // Serve only real PDFs: the bytes must carry the %PDF- signature near the start.
    const head = Buffer.from(pdfData.slice(0, Math.min(pdfData.byteLength, 1024)));
    if (!head.includes(PDF_SIGNATURE)) {
      return NextResponse.json({ error: 'Not a PDF' }, { status: 415 });
    }

    return new NextResponse(pdfData, {
      status: 200,
      headers: {
        // Always PDF, whatever the origin claimed — the proxy never serves HTML/SVG on our domain.
        'Content-Type': 'application/pdf',
        'Content-Length': pdfData.byteLength.toString(),
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[PDF Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch PDF' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
