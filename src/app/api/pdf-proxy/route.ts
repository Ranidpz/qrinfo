import { NextRequest, NextResponse } from 'next/server';

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

  // Validate URL - only allow Vercel Blob storage URLs for security
  const allowedDomains = [
    'public.blob.vercel-storage.com',
    'blob.vercel-storage.com',
  ];

  try {
    const url = new URL(pdfUrl);
    const isAllowed = allowedDomains.some(domain => url.hostname.endsWith(domain));

    if (!isAllowed) {
      return NextResponse.json(
        { error: 'URL domain not allowed' },
        { status: 403 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: 'Invalid URL' },
      { status: 400 }
    );
  }

  try {
    // Fetch the PDF from Vercel Blob storage
    const response = await fetch(pdfUrl, {
      headers: {
        'Accept': 'application/pdf',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch PDF: ${response.status}` },
        { status: response.status }
      );
    }

    // Get the PDF data
    const pdfData = await response.arrayBuffer();

    // Return the PDF with proper headers
    return new NextResponse(pdfData, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': pdfData.byteLength.toString(),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('PDF proxy error:', error);
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
