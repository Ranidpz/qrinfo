import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import { normalizePhoneNumber, isValidIsraeliMobile } from '@/lib/phone-utils';
import { generateOTPCode, hashOTPCode, verifyOTPCode } from '@/lib/verification';
import { sendOTP } from '@/lib/inforu';
import { sendQTagQRWhatsApp } from '@/lib/qtag-whatsapp';
import crypto from 'crypto';

// Generate cryptographically secure QR token for check-in
function generateQRToken(): string {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`qtag-verify:${clientIp}`, RATE_LIMITS.API);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { codeId, phone, action, code: otpCode, locale = 'he' } = body;

    if (!codeId || !phone || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!isValidIsraeliMobile(phone)) {
      return NextResponse.json(
        { error: 'Invalid phone number', errorCode: 'INVALID_PHONE' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    const db = getAdminDb();

    // Load code and Q.Tag config
    const codeDoc = await db.collection('codes').doc(codeId).get();
    if (!codeDoc.exists) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }

    const codeData = codeDoc.data()!;
    const qtagMedia = codeData.media?.find((m: { type: string }) => m.type === 'qtag');
    if (!qtagMedia?.qtagConfig?.verification?.enabled) {
      return NextResponse.json(
        { error: 'Verification not enabled' },
        { status: 400 }
      );
    }

    const verificationConfig = qtagMedia.qtagConfig.verification;
    const qtagConfig = qtagMedia.qtagConfig;
    const phoneDigits = normalizedPhone.replace(/\D/g, '');

    if (action === 'send') {
      // Rate limit per phone
      const phoneRateLimit = checkRateLimit(
        `qtag-otp:${phoneDigits}`,
        { maxRequests: 3, windowMs: 5 * 60 * 1000 }
      );
      if (!phoneRateLimit.success) {
        return NextResponse.json(
          { error: 'Too many verification attempts', errorCode: 'RATE_LIMITED' },
          { status: 429 }
        );
      }

      // Carry forward pendingRegistration from latest existing verification doc
      let pendingRegistration = null;
      const existingDocs = await db.collection('verificationCodes')
        .where('codeId', '==', codeId)
        .where('phone', '==', normalizedPhone)
        .where('type', '==', 'qtag')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (!existingDocs.empty) {
        pendingRegistration = existingDocs.docs[0].data().pendingRegistration || null;
      }

      // Generate OTP
      const otp = generateOTPCode(verificationConfig.codeLength || 4);
      const otpHash = hashOTPCode(otp);

      // Store verification code with carried-forward pending data
      const verificationRef = db.collection('verificationCodes')
        .doc(`qtag_${codeId}_${phoneDigits}_${Date.now()}`);

      await verificationRef.set({
        codeId,
        phone: normalizedPhone,
        codeHash: otpHash,
        attempts: 0,
        method: verificationConfig.method || 'whatsapp',
        status: 'pending',
        type: 'qtag',
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + (verificationConfig.codeExpiryMinutes || 5) * 60 * 1000),
        ...(pendingRegistration ? { pendingRegistration } : {}),
      });

      // Send OTP via WhatsApp/SMS
      const result = await sendOTP(
        normalizedPhone,
        otp,
        verificationConfig.method || 'whatsapp',
        locale as 'he' | 'en'
      );

      if (!result.result.success) {
        return NextResponse.json(
          { error: 'Failed to send verification code', errorCode: 'SEND_FAILED' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        method: result.methodUsed,
        expiresAt: new Date(Date.now() + (verificationConfig.codeExpiryMinutes || 5) * 60 * 1000).toISOString(),
      });
    }

    if (action === 'verify') {
      if (!otpCode) {
        return NextResponse.json(
          { error: 'Missing verification code' },
          { status: 400 }
        );
      }

      // Find the latest verification code for this phone + code combo
      const verificationDocs = await db.collection('verificationCodes')
        .where('codeId', '==', codeId)
        .where('phone', '==', normalizedPhone)
        .where('type', '==', 'qtag')
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (verificationDocs.empty) {
        return NextResponse.json(
          { error: 'No verification code found', errorCode: 'NO_CODE_FOUND' },
          { status: 400 }
        );
      }

      const verificationDoc = verificationDocs.docs[0];
      const verificationData = verificationDoc.data();

      // Check expiry
      const expiresAt = verificationData.expiresAt?.toDate?.() || new Date(verificationData.expiresAt);
      if (new Date() > expiresAt) {
        await verificationDoc.ref.update({ status: 'expired' });
        return NextResponse.json(
          { error: 'Code expired', errorCode: 'EXPIRED' },
          { status: 400 }
        );
      }

      // Check attempts
      if (verificationData.attempts >= (verificationConfig.maxAttempts || 5)) {
        await verificationDoc.ref.update({ status: 'blocked' });
        return NextResponse.json(
          { error: 'Too many failed attempts', errorCode: 'BLOCKED' },
          { status: 429 }
        );
      }

      // Verify code
      const isValid = verifyOTPCode(otpCode, verificationData.codeHash);

      if (!isValid) {
        await verificationDoc.ref.update({
          attempts: FieldValue.increment(1),
        });
        return NextResponse.json(
          { error: 'Invalid code', errorCode: 'INVALID_CODE' },
          { status: 400 }
        );
      }

      // Extract pending registration data
      const pendingData = verificationData.pendingRegistration;
      if (!pendingData) {
        return NextResponse.json(
          { error: 'Registration data not found. Please register again.', errorCode: 'NO_PENDING_DATA' },
          { status: 400 }
        );
      }

      // Re-check phone uniqueness (race condition guard)
      const existingGuest = await db.collection('codes').doc(codeId)
        .collection('qtagGuests')
        .where('phone', '==', normalizedPhone)
        .limit(1)
        .get();

      if (!existingGuest.empty) {
        return NextResponse.json(
          { error: 'Phone number already registered', errorCode: 'PHONE_EXISTS' },
          { status: 409 }
        );
      }

      // Re-check capacity
      const statsRef = db.collection('codes').doc(codeId)
        .collection('qtagStats').doc('current');
      const statsDoc = await statsRef.get();

      if (qtagConfig.maxRegistrations && qtagConfig.maxRegistrations > 0) {
        const currentCount = statsDoc.exists ? (statsDoc.data()?.totalRegistered || 0) : 0;
        if (currentCount >= qtagConfig.maxRegistrations) {
          return NextResponse.json(
            { error: 'Event is full', errorCode: 'CAPACITY_FULL' },
            { status: 409 }
          );
        }
      }

      // Create guest document, token mapping, and update stats
      const qrToken = generateQRToken();
      const guestRef = db.collection('codes').doc(codeId).collection('qtagGuests').doc();

      const guestData = {
        id: guestRef.id,
        codeId,
        name: pendingData.name,
        phone: pendingData.phone,
        plusOneCount: pendingData.plusOneCount || 0,
        plusOneDetails: pendingData.plusOneDetails || [],
        qrToken,
        isVerified: true,
        verifiedAt: FieldValue.serverTimestamp(),
        status: 'registered',
        qrSentViaWhatsApp: false,
        registeredAt: FieldValue.serverTimestamp(),
        registeredByAdmin: false,
      };

      const batch = db.batch();

      // Mark verification code as verified
      batch.update(verificationDoc.ref, {
        status: 'verified',
        verifiedAt: FieldValue.serverTimestamp(),
      });

      // Create guest
      batch.set(guestRef, guestData);

      // Create token mapping for fast check-in lookup
      batch.set(db.collection('qrTokenMappings').doc(qrToken), {
        codeId,
        guestId: guestRef.id,
        type: 'qtag',
        createdAt: FieldValue.serverTimestamp(),
      });

      // Update stats
      if (!statsDoc.exists) {
        batch.set(statsRef, {
          totalRegistered: 1,
          totalGuests: 1 + (pendingData.plusOneCount || 0),
          totalArrived: 0,
          totalArrivedGuests: 0,
          lastUpdated: FieldValue.serverTimestamp(),
        });
      } else {
        batch.update(statsRef, {
          totalRegistered: FieldValue.increment(1),
          totalGuests: FieldValue.increment(1 + (pendingData.plusOneCount || 0)),
          lastUpdated: FieldValue.serverTimestamp(),
        });
      }

      await batch.commit();

      // Fire-and-forget: Send QR link via WhatsApp
      if (qtagConfig.sendQrViaWhatsApp !== false) {
        sendQTagQRWhatsApp({
          codeId,
          guestId: guestRef.id,
          guestName: pendingData.name,
          guestPhone: normalizedPhone,
          qrToken,
          shortId: codeData.shortId,
          eventName: qtagConfig.eventName || '',
        }).catch(err => console.error('[QTag Verify] WhatsApp send error (non-blocking):', err));
      }

      return NextResponse.json({
        success: true,
        isVerified: true,
        guestId: guestRef.id,
        qrToken,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "send" or "verify"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Q.Tag verify error:', error);
    return NextResponse.json(
      { error: 'Verification failed', details: String(error) },
      { status: 500 }
    );
  }
}
