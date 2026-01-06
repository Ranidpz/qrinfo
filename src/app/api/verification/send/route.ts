import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { sendOTP, isINFORUConfigured } from '@/lib/inforu';
import { normalizePhoneNumber, isValidIsraeliMobile } from '@/lib/phone-utils';
import { generateOTPCode, hashOTPCode, getExpiryTime } from '@/lib/verification';
import { FieldValue } from 'firebase-admin/firestore';
import { DEFAULT_MESSAGE_QUOTA } from '@/types/verification';

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_REQUESTS_PER_WINDOW = 3;

/**
 * Firestore-based rate limiting (works with serverless/multiple instances)
 * Uses a dedicated collection to track request counts per phone number
 */
async function checkRateLimitFirestore(db: FirebaseFirestore.Firestore, phone: string): Promise<{ allowed: boolean; remaining: number }> {
  const now = Date.now();
  const rateLimitRef = db.collection('rateLimits').doc(`otp_${phone.replace(/\D/g, '')}`);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(rateLimitRef);
      const data = doc.data();

      // If no record or window expired, create new window
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

      // Check if limit exceeded
      if (data.count >= MAX_REQUESTS_PER_WINDOW) {
        return { allowed: false, remaining: 0 };
      }

      // Increment counter
      transaction.update(rateLimitRef, {
        count: data.count + 1,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - data.count - 1 };
    });

    return result;
  } catch (error) {
    console.error('[RateLimit] Firestore transaction error:', error);
    // On error, allow the request but log warning
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW };
  }
}

// POST: Send OTP verification code
export async function POST(request: NextRequest) {
  try {
    const { codeId, phone, locale = 'he' } = await request.json();

    // Validate required fields
    if (!codeId || !phone) {
      return NextResponse.json(
        { error: 'codeId and phone are required' },
        { status: 400 }
      );
    }

    // Normalize and validate phone number
    const normalizedPhone = normalizePhoneNumber(phone);
    if (!isValidIsraeliMobile(normalizedPhone)) {
      return NextResponse.json(
        { error: 'Invalid Israeli mobile number', errorCode: 'INVALID_PHONE' },
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

    const db = getAdminDb();

    // Get the QR code to find verification settings and owner
    const codeDoc = await db.collection('codes').doc(codeId).get();
    if (!codeDoc.exists) {
      return NextResponse.json(
        { error: 'Code not found' },
        { status: 404 }
      );
    }

    const codeData = codeDoc.data();
    const ownerId = codeData?.ownerId;

    // Find the qvote media item
    const qvoteMedia = codeData?.media?.find((m: { type: string }) => m.type === 'qvote');
    if (!qvoteMedia?.qvoteConfig?.verification?.enabled) {
      return NextResponse.json(
        { error: 'Verification not enabled for this code', errorCode: 'VERIFICATION_DISABLED' },
        { status: 400 }
      );
    }

    const verificationConfig = qvoteMedia.qvoteConfig.verification;

    // Check if phone is in authorized list (if authorizedVotersOnly)
    if (verificationConfig.authorizedVotersOnly) {
      const authorizedVoters = verificationConfig.authorizedVoters || [];
      const isAuthorized = authorizedVoters.some(
        (v: { phone: string }) => normalizePhoneNumber(v.phone) === normalizedPhone
      );

      if (!isAuthorized) {
        return NextResponse.json(
          { error: 'Phone number not authorized to vote', errorCode: 'UNAUTHORIZED_PHONE' },
          { status: 403 }
        );
      }
    }

    // Check rate limit (Firestore-based for serverless compatibility)
    const rateLimit = await checkRateLimitFirestore(db, normalizedPhone);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a few minutes.', errorCode: 'RATE_LIMITED' },
        { status: 429 }
      );
    }

    // Check owner's message quota
    const ownerDoc = await db.collection('users').doc(ownerId).get();
    const ownerData = ownerDoc.data();
    const quota = ownerData?.messageQuota || DEFAULT_MESSAGE_QUOTA;

    if (quota.used >= quota.limit) {
      return NextResponse.json(
        { error: 'Message quota exceeded', errorCode: 'QUOTA_EXCEEDED', remaining: 0 },
        { status: 402 } // Payment Required
      );
    }

    // Generate OTP code
    const codeLength = verificationConfig.codeLength || 4;
    const otpCode = generateOTPCode(codeLength);
    const codeHash = hashOTPCode(otpCode);

    // Calculate expiry
    const expiryMinutes = verificationConfig.codeExpiryMinutes || 5;
    const expiresAt = getExpiryTime(expiryMinutes);

    // Send OTP via INFORU
    const { result, methodUsed } = await sendOTP(
      normalizedPhone,
      otpCode,
      verificationConfig.method || 'whatsapp',
      locale as 'he' | 'en'
    );

    if (!result.success) {
      // Log failed attempt
      await db.collection('messageLogs').add({
        userId: ownerId,
        codeId,
        phone: normalizedPhone,
        method: methodUsed,
        status: 'failed',
        errorMessage: result.error,
        cost: 0,
        createdAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json(
        { error: 'Failed to send verification code', errorCode: 'SEND_FAILED', details: result.error },
        { status: 500 }
      );
    }

    // Store verification code in database
    const verificationDocId = `${codeId}_${normalizedPhone.replace(/\D/g, '')}_${Date.now()}`;
    await db.collection('verificationCodes').doc(verificationDocId).set({
      id: verificationDocId,
      codeId,
      phone: normalizedPhone,
      codeHash,
      attempts: 0,
      method: methodUsed,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: expiresAt,
    });

    // Decrement quota and log message
    await db.collection('users').doc(ownerId).update({
      'messageQuota.used': FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await db.collection('messageLogs').add({
      userId: ownerId,
      codeId,
      phone: normalizedPhone,
      method: methodUsed,
      status: 'sent',
      cost: 1,
      createdAt: FieldValue.serverTimestamp(),
    });

    const newRemaining = quota.limit - quota.used - 1;

    console.log(`[Verification] OTP sent to ${normalizedPhone.substring(0, 7)}*** via ${methodUsed} for code ${codeId}`);

    return NextResponse.json({
      success: true,
      expiresAt: expiresAt.toISOString(),
      method: methodUsed,
      remainingQuota: newRemaining,
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to send verification code', details: errorMessage },
      { status: 500 }
    );
  }
}
