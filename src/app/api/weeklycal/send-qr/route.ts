import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { sendTemplateMessage, isINFORUConfigured } from '@/lib/inforu';
import { requireCodeOwner, isAuthError } from '@/lib/auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';

/**
 * Send QR code link via WhatsApp after successful verification
 *
 * POST /api/weeklycal/send-qr
 * Body: { registrationId, codeId }
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting - prevent spam
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`send-qr:${clientIp}`, { maxRequests: 20, windowMs: 60 * 1000 });
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { registrationId, codeId, locale = 'he' } = body;

    if (!registrationId || !codeId) {
      return NextResponse.json(
        { error: 'registrationId and codeId are required' },
        { status: 400 }
      );
    }

    // Auth check: only code owner can send QR messages
    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;

    // Check INFORU configuration
    if (!isINFORUConfigured()) {
      return NextResponse.json(
        { error: 'Messaging service not configured', errorCode: 'SERVICE_NOT_CONFIGURED' },
        { status: 503 }
      );
    }

    const db = getAdminDb();

    // Get registration data
    const registrationRef = db.collection('codes').doc(codeId)
      .collection('cellRegistrations').doc(registrationId);
    const registrationDoc = await registrationRef.get();

    if (!registrationDoc.exists) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    const registration = registrationDoc.data()!;

    // Check if verified
    if (!registration.isVerified) {
      return NextResponse.json(
        { error: 'Registration not verified', errorCode: 'NOT_VERIFIED' },
        { status: 400 }
      );
    }

    // Check if phone exists
    if (!registration.phone) {
      return NextResponse.json(
        { error: 'No phone number in registration', errorCode: 'NO_PHONE' },
        { status: 400 }
      );
    }

    // Get activity/cell data for the message
    const codeRef = db.collection('codes').doc(codeId);
    const codeDoc = await codeRef.get();

    let activityName = '';
    let boothName = '';
    let activityTime = '';

    if (codeDoc.exists) {
      const codeData = codeDoc.data()!;
      // Config is stored in media[0].weeklycalConfig
      const config = codeData.media?.[0]?.weeklycalConfig;

      if (config?.boothDays) {
        // Find the booth and cell
        for (const day of config.boothDays) {
          if (day.date === registration.boothDate) {
            const booths = day.booths?.length > 0 ? day.booths : config.defaultBooths || [];
            const booth = booths.find((b: { id: string }) => b.id === registration.boothId);
            if (booth) {
              boothName = booth.name || '';
            }
            // Cells are stored at the day level, not inside booths
            const cells = day.cells || [];
            const timeSlots = day.timeSlots || [];
            const cell = cells.find((c: { id: string }) => c.id === registration.cellId);
            if (cell) {
              activityName = cell.title || '';
              // Get time from time slots
              const slot = timeSlots[cell.startSlotIndex || 0];
              activityTime = slot?.startTime && slot?.endTime
                ? `${slot.startTime}-${slot.endTime}`
                : '';
            }
            break;
          }
        }
      }
    }

    // Build the landing page URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://qr.playzones.app';
    const landingUrl = `${baseUrl}/${locale}/p/${registration.qrToken}`;

    // Send WhatsApp message with template
    // Template: booth_qr_code
    // Parameters: [#1#] name, [#2#] activity, [#3#] booth, [#4#] time, [#5#] link
    const templateParams = [
      registration.nickname || '',  // [#1#] name
      activityName,                 // [#2#] activity name
      boothName,                    // [#3#] booth name
      activityTime,                 // [#4#] time
      landingUrl,                   // [#5#] landing page URL
    ];

    const sendResult = await sendTemplateMessage(
      registration.phone,
      'booth_qr_code',
      templateParams,
      'whatsapp'
    );

    if (!sendResult.success) {
      console.error('[WeeklyCal SendQR] Failed to send WhatsApp:', sendResult.error);
      return NextResponse.json(
        { error: 'Failed to send message', errorCode: 'SEND_FAILED', details: sendResult.error },
        { status: 500 }
      );
    }

    console.log('[WeeklyCal SendQR] QR link sent successfully to', registration.phone);

    return NextResponse.json({
      success: true,
      method: 'whatsapp',
      landingUrl,
    });

  } catch (error) {
    console.error('[WeeklyCal SendQR] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send QR link' },
      { status: 500 }
    );
  }
}
