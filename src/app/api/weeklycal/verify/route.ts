import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { sendOTP, sendTemplateMessage, isINFORUConfigured } from '@/lib/inforu';
import { normalizePhoneNumber, isValidIsraeliMobile } from '@/lib/phone-utils';
import { generateOTPCode, hashOTPCode, getExpiryTime, verifyOTPCode } from '@/lib/verification';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_REQUESTS_PER_WINDOW = 3;
const OTP_EXPIRY_MINUTES = 5;
const MAX_VERIFY_ATTEMPTS = 5;

/**
 * Firestore-based rate limiting
 */
async function checkRateLimitFirestore(db: FirebaseFirestore.Firestore, phone: string): Promise<{ allowed: boolean; remaining: number }> {
  const now = Date.now();
  const rateLimitRef = db.collection('rateLimits').doc(`weeklycal_otp_${phone.replace(/\D/g, '')}`);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(rateLimitRef);
      const data = doc.data();

      if (!data || now > data.resetAt) {
        transaction.set(rateLimitRef, {
          phone,
          count: 1,
          resetAt: now + RATE_LIMIT_WINDOW_MS,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
      }

      if (data.count >= MAX_REQUESTS_PER_WINDOW) {
        return { allowed: false, remaining: 0 };
      }

      transaction.update(rateLimitRef, {
        count: data.count + 1,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - data.count - 1 };
    });

    return result;
  } catch (error) {
    console.error('[WeeklyCal Verify] Rate limit error:', error);
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW };
  }
}

// POST: Send or verify OTP
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, codeId, phone, registrationId, code, locale = 'he' } = body;

    if (!action || !codeId || !phone) {
      return NextResponse.json(
        { error: 'action, codeId, and phone are required' },
        { status: 400 }
      );
    }

    // Normalize and validate phone
    const normalizedPhone = normalizePhoneNumber(phone);
    if (!isValidIsraeliMobile(normalizedPhone)) {
      return NextResponse.json(
        { error: 'Invalid Israeli mobile number', errorCode: 'INVALID_PHONE' },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    // ========== SEND OTP ==========
    if (action === 'send') {
      if (!registrationId) {
        return NextResponse.json(
          { error: 'registrationId is required for send action' },
          { status: 400 }
        );
      }

      // Check INFORU configuration
      if (!isINFORUConfigured()) {
        return NextResponse.json(
          { error: 'Messaging service not configured', errorCode: 'SERVICE_NOT_CONFIGURED' },
          { status: 503 }
        );
      }

      // Check rate limit
      const rateLimit = await checkRateLimitFirestore(db, normalizedPhone);
      if (!rateLimit.allowed) {
        return NextResponse.json(
          { error: 'Too many requests', errorCode: 'RATE_LIMITED' },
          { status: 429 }
        );
      }

      // Generate OTP
      const otpCode = generateOTPCode(4);
      const salt = Math.random().toString(36).substring(2, 15);
      const codeHash = hashOTPCode(otpCode, salt);
      const expiresAt = getExpiryTime(OTP_EXPIRY_MINUTES);

      // Store verification code
      const verificationRef = db.collection('codes').doc(codeId)
        .collection('weeklycalVerifications').doc(normalizedPhone);

      await verificationRef.set({
        phone: normalizedPhone,
        registrationId,
        codeHash,
        salt,
        attempts: 0,
        status: 'pending',
        expiresAt: Timestamp.fromDate(expiresAt),
        createdAt: FieldValue.serverTimestamp(),
      });

      // Send OTP via WhatsApp/SMS
      const sendResult = await sendOTP(normalizedPhone, otpCode, 'whatsapp', locale as 'he' | 'en');

      if (!sendResult.result.success) {
        console.error('[WeeklyCal Verify] Failed to send OTP:', sendResult.result.error);
        return NextResponse.json(
          { error: 'Failed to send verification code', errorCode: 'SEND_FAILED' },
          { status: 500 }
        );
      }

      console.log('[WeeklyCal Verify] OTP sent successfully via', sendResult.methodUsed);

      return NextResponse.json({
        success: true,
        expiresAt: expiresAt.toISOString(),
        method: sendResult.methodUsed,
      });
    }

    // ========== VERIFY OTP ==========
    if (action === 'verify') {
      if (!code) {
        return NextResponse.json(
          { error: 'code is required for verify action' },
          { status: 400 }
        );
      }

      // Get verification record
      const verificationRef = db.collection('codes').doc(codeId)
        .collection('weeklycalVerifications').doc(normalizedPhone);
      const verificationDoc = await verificationRef.get();

      if (!verificationDoc.exists) {
        return NextResponse.json(
          { error: 'No pending verification found', errorCode: 'NO_CODE' },
          { status: 404 }
        );
      }

      const verificationData = verificationDoc.data()!;

      // Check if expired
      const expiresAt = verificationData.expiresAt instanceof Timestamp
        ? verificationData.expiresAt.toDate()
        : new Date(verificationData.expiresAt);

      if (new Date() > expiresAt) {
        await verificationRef.update({ status: 'expired' });
        return NextResponse.json(
          { error: 'Code expired', errorCode: 'EXPIRED' },
          { status: 400 }
        );
      }

      // Check if blocked (too many attempts)
      if (verificationData.attempts >= MAX_VERIFY_ATTEMPTS) {
        await verificationRef.update({ status: 'blocked' });
        return NextResponse.json(
          { error: 'Too many failed attempts', errorCode: 'BLOCKED' },
          { status: 429 }
        );
      }

      // Verify the code
      const isValid = verifyOTPCode(code, verificationData.codeHash, verificationData.salt);

      if (!isValid) {
        await verificationRef.update({
          attempts: FieldValue.increment(1),
        });
        return NextResponse.json(
          {
            error: 'Invalid code',
            errorCode: 'INVALID_CODE',
            attemptsRemaining: MAX_VERIFY_ATTEMPTS - verificationData.attempts - 1,
          },
          { status: 400 }
        );
      }

      // Code is valid - update verification status
      await verificationRef.update({
        status: 'verified',
        verifiedAt: FieldValue.serverTimestamp(),
      });

      // Update the registration as verified
      const regId = verificationData.registrationId;
      if (regId) {
        const registrationRef = db.collection('codes').doc(codeId)
          .collection('cellRegistrations').doc(regId);
        const regDoc = await registrationRef.get();

        if (regDoc.exists) {
          await registrationRef.update({
            isVerified: true,
            verifiedAt: FieldValue.serverTimestamp(),
          });

          const regData = regDoc.data()!;
          console.log('[WeeklyCal Verify] Registration verified:', regId, 'qrToken:', regData?.qrToken);

          // Create token mapping for easy lookup (avoids collection group query)
          if (regData?.qrToken) {
            await db.collection('qrTokenMappings').doc(regData.qrToken).set({
              codeId,
              registrationId: regId,
              createdAt: FieldValue.serverTimestamp(),
            });
          }

          // Send QR link via WhatsApp
          try {
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
                for (const day of config.boothDays) {
                  if (day.date === regData.boothDate) {
                    const booths = day.booths?.length > 0 ? day.booths : config.defaultBooths || [];
                    const booth = booths.find((b: { id: string }) => b.id === regData.boothId);
                    if (booth) {
                      boothName = booth.name || '';
                    }
                    // Cells are stored at the day level, not inside booths
                    const cells = day.cells || [];
                    const timeSlots = day.timeSlots || [];
                    const cell = cells.find((c: { id: string }) => c.id === regData.cellId);
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

            // Build landing page URL
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://qr.playzones.app';
            const landingUrl = `${baseUrl}/${locale}/p/${regData.qrToken}`;

            // Send template message with QR link
            const templateParams = [
              regData.nickname || '',   // [#1#] name
              activityName,             // [#2#] activity name
              boothName,                // [#3#] booth name
              activityTime,             // [#4#] time
              landingUrl,               // [#5#] landing page URL
            ];

            const sendResult = await sendTemplateMessage(
              normalizedPhone,
              'booth_qr_code',
              templateParams,
              'whatsapp'
            );

            if (sendResult.success) {
              console.log('[WeeklyCal Verify] QR link sent to', normalizedPhone);
            } else {
              console.error('[WeeklyCal Verify] Failed to send QR link:', sendResult.error);
            }
          } catch (sendError) {
            console.error('[WeeklyCal Verify] Error sending QR link:', sendError);
            // Don't fail the verification if QR link fails to send
          }

          return NextResponse.json({
            success: true,
            qrToken: regData?.qrToken,
            registrationId: regId,
          });
        }
      }

      return NextResponse.json({
        success: true,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "send" or "verify"' },
      { status: 400 }
    );

  } catch (error) {
    console.error('[WeeklyCal Verify] Error:', error);
    return NextResponse.json(
      { error: 'Verification failed', details: String(error) },
      { status: 500 }
    );
  }
}
