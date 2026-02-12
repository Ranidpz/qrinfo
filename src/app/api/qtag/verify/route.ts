import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import { normalizePhoneNumber, isValidIsraeliMobile } from '@/lib/phone-utils';
import { generateOTPCode, hashOTPCode, verifyOTPCode } from '@/lib/verification';
import { sendOTP } from '@/lib/inforu';

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

    const { codeId, phone, action, code: otpCode, guestId, locale = 'he' } = body;

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

      // Generate OTP
      const otp = generateOTPCode(verificationConfig.codeLength || 4);
      const otpHash = hashOTPCode(otp);

      // Store verification code
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
      if (!otpCode || !guestId) {
        return NextResponse.json(
          { error: 'Missing code or guestId' },
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

      // Mark verification code as verified
      await verificationDoc.ref.update({
        status: 'verified',
        verifiedAt: FieldValue.serverTimestamp(),
      });

      // Mark guest as verified
      const guestRef = db.collection('codes').doc(codeId)
        .collection('qtagGuests').doc(guestId);
      const guestDoc = await guestRef.get();

      if (!guestDoc.exists) {
        return NextResponse.json(
          { error: 'Guest not found' },
          { status: 404 }
        );
      }

      await guestRef.update({
        isVerified: true,
        verifiedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        isVerified: true,
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
