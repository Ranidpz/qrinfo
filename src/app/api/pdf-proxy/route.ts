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

  console.log('[PDF Proxy] Request received:', { pdfUrl: pdfUrl?.substring(0, 100) });

  if (!pdfUrl) {
    console.log('[PDF Proxy] Missing url parameter');
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
      console.log('[PDF Proxy] Domain not allowed:', url.hostname);
      return NextResponse.json(
        { error: 'URL domain not allowed' },
        { status: 403 }
      );
    }
    console.log('[PDF Proxy] Domain validated:', url.hostname);
  } catch (err) {
    console.log('[PDF Proxy] Invalid URL:', err);
    return NextResponse.json(
      { error: 'Invalid URL' },
      { status: 400 }
    );
  }

  try {
    console.log('[PDF Proxy] Fetching PDF from:', pdfUrl);

    // Get Range header from request if present (pdf.js often uses range requests)
    const rangeHeader = request.headers.get('Range');

    // Fetch the PDF from Vercel Blob storage
    const fetchHeaders: Record<string, string> = {
      'Accept': 'application/pdf',
    };
    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader;
    }

    const response = await fetch(pdfUrl, { headers: fetchHeaders });

    console.log('[PDF Proxy] Fetch response:', {
      status: response.status,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
    });

    if (!response.ok) {
      console.log('[PDF Proxy] Fetch failed:', response.status, response.statusText);
      return NextResponse.json(
        { error: `Failed to fetch PDF: ${response.status}` },
        { status: response.status }
      );
    }

    // Get the PDF data
    const pdfData = await response.arrayBuffer();
    console.log('[PDF Proxy] PDF data received:', pdfData.byteLength, 'bytes');

    // Return the PDF with proper headers
    return new NextResponse(pdfData, {
      status: rangeHeader ? 206 : 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': pdfData.byteLength.toString(),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Range',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
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
