import { NextRequest, NextResponse } from 'next/server';
import { requireCodeOwner, isAuthError } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { sendQTagQRWhatsApp } from '@/lib/qtag-whatsapp';

/**
 * Admin diagnostic endpoint: Test WhatsApp QR delivery for a specific guest.
 * Requires auth (code owner only).
 *
 * POST /api/qtag/test-whatsapp
 * Body: { codeId, guestId }
 */
export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { codeId, guestId } = body;
    if (!codeId || !guestId) {
      return NextResponse.json({ error: 'Missing codeId or guestId' }, { status: 400 });
    }

    // Auth check
    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;

    const db = getAdminDb();

    // Load code data
    const codeDoc = await db.collection('codes').doc(codeId).get();
    if (!codeDoc.exists) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }
    const codeData = codeDoc.data()!;
    const qtagConfig = codeData.media?.find((m: { type: string }) => m.type === 'qtag')?.qtagConfig;

    // Load guest
    const guestDoc = await db.collection('codes').doc(codeId)
      .collection('qtagGuests').doc(guestId).get();
    if (!guestDoc.exists) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }
    const guest = guestDoc.data()!;

    // Build the params that would be sent
    const params = {
      codeId,
      guestId,
      guestName: guest.name,
      guestPhone: guest.phone,
      qrToken: guest.qrToken,
      shortId: codeData.shortId,
      eventName: qtagConfig?.eventName || '',
    };

    // Diagnostic info
    const diagnostics = {
      guestName: guest.name,
      guestPhone: guest.phone ? `${guest.phone.slice(0, 5)}****` : 'MISSING',
      qrToken: guest.qrToken ? `${guest.qrToken.slice(0, 4)}...` : 'MISSING',
      shortId: codeData.shortId || 'MISSING',
      eventName: qtagConfig?.eventName || 'MISSING',
      sendQrViaWhatsApp: qtagConfig?.sendQrViaWhatsApp,
      templateId: process.env.INFORU_TEMPLATE_QTAG_REGISTRATION || '242341 (default)',
      inforuConfigured: !!(process.env.INFORU_API_USER && process.env.INFORU_API_TOKEN),
    };

    // Send
    const result = await sendQTagQRWhatsApp(params);

    return NextResponse.json({
      diagnostics,
      result,
    });
  } catch (error) {
    console.error('[QTag TestWhatsApp] Error:', error);
    return NextResponse.json(
      { error: 'Test failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
