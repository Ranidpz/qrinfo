import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { sendQTagQRWhatsApp } from '@/lib/qtag-whatsapp';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { normalizePhoneNumber, isValidIsraeliMobile } from '@/lib/phone-utils';

/**
 * Public endpoint: Resend QR code link via WhatsApp to a registered guest
 * The guest identifies themselves by phone number.
 * Heavily rate-limited to prevent spam.
 *
 * POST /api/qtag/resend-qr
 * Body: { codeId, phone }
 */
export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);

    // Strict rate limiting: 5 per IP per 10 minutes
    const ipLimit = checkRateLimit(`qtag-resend-self:${clientIp}`, { maxRequests: 5, windowMs: 10 * 60 * 1000 });
    if (!ipLimit.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { codeId, phone } = body;

    if (!codeId || !phone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate codeId format
    if (typeof codeId !== 'string' || !/^[a-zA-Z0-9]{10,30}$/.test(codeId)) {
      return NextResponse.json({ error: 'Invalid codeId format' }, { status: 400 });
    }

    if (!isValidIsraeliMobile(phone)) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    const phoneDigits = normalizedPhone.replace(/\D/g, '');

    // Per-phone rate limit: 2 per phone per 10 minutes
    const phoneLimit = checkRateLimit(`qtag-resend-self:${phoneDigits}`, { maxRequests: 2, windowMs: 10 * 60 * 1000 });
    if (!phoneLimit.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const db = getAdminDb();

    // Load code data
    const codeDoc = await db.collection('codes').doc(codeId).get();
    if (!codeDoc.exists) {
      return NextResponse.json({ success: true, found: false });
    }
    const codeData = codeDoc.data()!;
    const qtagConfig = codeData.media?.find((m: { type: string }) => m.type === 'qtag')?.qtagConfig;

    // Find guest by phone
    const guestSnapshot = await db.collection('codes').doc(codeId)
      .collection('qtagGuests')
      .where('phone', '==', normalizedPhone)
      .where('isVerified', '==', true)
      .limit(1)
      .get();

    if (guestSnapshot.empty) {
      return NextResponse.json({ success: true, found: false });
    }

    const guestDoc = guestSnapshot.docs[0];
    const guest = guestDoc.data();

    // Send QR via WhatsApp (awaited so Vercel doesn't terminate before it completes)
    console.log(`[QTag ResendQR] Guest found: name="${guest.name}", phone="${guest.phone}", qrToken="${guest.qrToken?.slice(0, 4)}...", shortId="${codeData.shortId}"`);
    let whatsappSent = false;
    let whatsappError: string | undefined;
    try {
      const result = await sendQTagQRWhatsApp({
        codeId,
        guestId: guestDoc.id,
        guestName: guest.name,
        guestPhone: guest.phone,
        qrToken: guest.qrToken,
        shortId: codeData.shortId,
        eventName: qtagConfig?.eventName || '',
      });
      whatsappSent = result.success;
      if (!result.success) {
        whatsappError = result.error;
        console.error('[QTag ResendQR] WhatsApp send failed:', result.error);
      }
    } catch (err) {
      console.error('[QTag ResendQR] WhatsApp send error:', err);
      whatsappError = 'Send failed';
    }

    return NextResponse.json({ success: true, found: true, whatsappSent, whatsappError });
  } catch (error) {
    console.error('[QTag ResendQR] Error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
