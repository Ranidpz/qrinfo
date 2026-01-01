import { NextRequest, NextResponse } from 'next/server';

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

  // Quick test mode - if test=1, return a simple response
  if (searchParams.get('test') === '1') {
    return NextResponse.json({ status: 'ok', pdfUrl: pdfUrl?.substring(0, 50) });
  }

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

  let validatedUrl: URL;
  try {
    validatedUrl = new URL(pdfUrl);
    const isAllowed = allowedDomains.some(domain => validatedUrl.hostname.endsWith(domain));

    if (!isAllowed) {
      console.log('[PDF Proxy] Domain not allowed:', validatedUrl.hostname);
      return NextResponse.json(
        { error: 'URL domain not allowed', hostname: validatedUrl.hostname },
        { status: 403 }
      );
    }
    console.log('[PDF Proxy] Domain validated:', validatedUrl.hostname);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.log('[PDF Proxy] Invalid URL:', errMsg);
    return NextResponse.json(
      { error: 'Invalid URL', details: errMsg, rawUrl: pdfUrl?.substring(0, 100) },
      { status: 400 }
    );
  }

  try {
    console.log('[PDF Proxy] Fetching PDF from:', pdfUrl);

    // Simple fetch without range for now to test basic connectivity
    const response = await fetch(pdfUrl, {
      method: 'GET',
      headers: {
        'Accept': '*/*',
      },
    });

    console.log('[PDF Proxy] Fetch response:', {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.log('[PDF Proxy] Fetch failed:', response.status, response.statusText, errorBody);
      return NextResponse.json(
        {
          error: `Failed to fetch PDF: ${response.status}`,
          statusText: response.statusText,
          body: errorBody.substring(0, 200),
        },
        { status: response.status }
      );
    }

    // Get the PDF data
    const pdfData = await response.arrayBuffer();
    console.log('[PDF Proxy] PDF data received:', pdfData.byteLength, 'bytes');

    // Return the PDF with proper headers
    return new NextResponse(pdfData, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/pdf',
        'Content-Length': pdfData.byteLength.toString(),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[PDF Proxy] Error:', errorMessage, errorStack);
    return NextResponse.json(
      {
        error: 'Failed to fetch PDF',
        details: errorMessage,
        stack: errorStack?.substring(0, 500),
        pdfUrl: pdfUrl?.substring(0, 100),
      },
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
