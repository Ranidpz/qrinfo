import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireCodeOwner, isAuthError } from '@/lib/auth';
import { sendQTagQRWhatsApp } from '@/lib/qtag-whatsapp';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

/**
 * Admin endpoint: Send or resend QR code link via WhatsApp to a guest
 *
 * POST /api/qtag/send-qr
 * Body: { codeId, guestId }
 */
export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`qtag-send-qr:${clientIp}`, { maxRequests: 20, windowMs: 60 * 1000 });
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const { codeId, guestId } = body;

    if (!codeId || !guestId) {
      return NextResponse.json({ error: 'codeId and guestId are required' }, { status: 400 });
    }

    // Auth check: only code owner can send QR messages
    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;

    const db = getAdminDb();

    // Load code data for shortId and event info
    const codeDoc = await db.collection('codes').doc(codeId).get();
    if (!codeDoc.exists) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }
    const codeData = codeDoc.data()!;
    const qtagConfig = codeData.media?.find((m: { type: string }) => m.type === 'qtag')?.qtagConfig;

    // Load guest data
    const guestDoc = await db.collection('codes').doc(codeId)
      .collection('qtagGuests').doc(guestId).get();
    if (!guestDoc.exists) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }
    const guest = guestDoc.data()!;

    if (!guest.phone) {
      return NextResponse.json(
        { error: 'Guest has no phone number', errorCode: 'NO_PHONE' },
        { status: 400 }
      );
    }

    const result = await sendQTagQRWhatsApp({
      codeId,
      guestId,
      guestName: guest.name,
      guestPhone: guest.phone,
      qrToken: guest.qrToken,
      shortId: codeData.shortId,
      eventName: qtagConfig?.eventName || '',
    });

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to send WhatsApp', details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[QTag SendQR] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send QR link', details: String(error) },
      { status: 500 }
    );
  }
}
