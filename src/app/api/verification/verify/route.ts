import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { normalizePhoneNumber } from '@/lib/phone-utils';
import { verifyOTPCode, generateSessionToken, isExpired, getExpiryTime } from '@/lib/verification';
import { FieldValue } from 'firebase-admin/firestore';

// POST: Verify OTP code
export async function POST(request: NextRequest) {
  try {
    const { codeId, phone, code } = await request.json();

    // Validate required fields
    if (!codeId || !phone || !code) {
      return NextResponse.json(
        { error: 'codeId, phone, and code are required' },
        { status: 400 }
      );
    }

    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(phone);

    const db = getAdminDb();

    // Get the QR code to find verification settings
    const codeDoc = await db.collection('codes').doc(codeId).get();
    if (!codeDoc.exists) {
      return NextResponse.json(
        { error: 'Code not found' },
        { status: 404 }
      );
    }

    const codeData = codeDoc.data();

    // Find the qvote media item
    const qvoteMedia = codeData?.media?.find((m: { type: string }) => m.type === 'qvote');
    if (!qvoteMedia?.qvoteConfig?.verification?.enabled) {
      return NextResponse.json(
        { error: 'Verification not enabled for this code' },
        { status: 400 }
      );
    }

    const verificationConfig = qvoteMedia.qvoteConfig.verification;

    // Find the latest pending verification code for this phone
    // Query without orderBy to avoid needing composite index, then sort in memory
    const verificationQuery = await db.collection('verificationCodes')
      .where('codeId', '==', codeId)
      .where('phone', '==', normalizedPhone)
      .where('status', '==', 'pending')
      .get();

    if (verificationQuery.empty) {
      return NextResponse.json(
        { error: 'No pending verification code found', errorCode: 'NO_CODE' },
        { status: 400 }
      );
    }

    // Sort by createdAt desc in memory and get the latest one
    const sortedDocs = verificationQuery.docs.sort((a, b) => {
      const aTime = a.data().createdAt?.toMillis?.() || 0;
      const bTime = b.data().createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });

    const verificationDoc = sortedDocs[0];
    const verificationData = verificationDoc.data();

    // Check if code is expired
    const expiresAt = verificationData.expiresAt?.toDate() || new Date(0);
    if (isExpired(expiresAt)) {
      await verificationDoc.ref.update({ status: 'expired' });
      return NextResponse.json(
        { error: 'Verification code expired', errorCode: 'EXPIRED' },
        { status: 400 }
      );
    }

    // Check if blocked
    if (verificationData.blockedUntil) {
      const blockedUntil = verificationData.blockedUntil.toDate();
      if (new Date() < blockedUntil) {
        return NextResponse.json(
          { error: 'Too many attempts. Please try again later.', errorCode: 'BLOCKED', blockedUntil: blockedUntil.toISOString() },
          { status: 429 }
        );
      }
    }

    // Check attempts
    const maxAttempts = verificationConfig.maxAttempts || 5;
    const currentAttempts = verificationData.attempts || 0;

    if (currentAttempts >= maxAttempts) {
      // Block for specified duration
      const blockDuration = verificationConfig.blockDurationMinutes || 30;
      const blockedUntil = getExpiryTime(blockDuration);

      await verificationDoc.ref.update({
        status: 'blocked',
        blockedUntil,
      });

      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.', errorCode: 'BLOCKED', blockedUntil: blockedUntil.toISOString() },
        { status: 429 }
      );
    }

    // Verify the code
    const isValid = verifyOTPCode(code, verificationData.codeHash);

    if (!isValid) {
      // Increment attempts
      await verificationDoc.ref.update({
        attempts: currentAttempts + 1,
      });

      const attemptsRemaining = maxAttempts - currentAttempts - 1;
      return NextResponse.json(
        { error: 'Invalid verification code', errorCode: 'INVALID_CODE', attemptsRemaining },
        { status: 400 }
      );
    }

    // Code is valid - mark as verified
    const verifiedAt = new Date();
    await verificationDoc.ref.update({
      status: 'verified',
      verifiedAt,
    });

    // Generate session token
    const sessionToken = generateSessionToken();
    const sessionExpiresAt = getExpiryTime(24 * 60); // 24 hours

    // Get max votes for this user
    let maxVotes = verificationConfig.maxVotesPerPhone || 1;

    // Check if user has custom max votes from authorized list
    if (verificationConfig.authorizedVotersOnly && verificationConfig.authorizedVoters) {
      const authorizedVoter = verificationConfig.authorizedVoters.find(
        (v: { phone: string; maxVotes?: number }) => normalizePhoneNumber(v.phone) === normalizedPhone
      );
      if (authorizedVoter?.maxVotes) {
        maxVotes = authorizedVoter.maxVotes;
      }
    }

    // Create or update verified voter record
    const voterNormalizedPhone = normalizedPhone.replace(/\D/g, '');
    const voterId = `${codeId}_${voterNormalizedPhone}`;
    const voterRef = db.collection('verifiedVoters').doc(voterId);
    const existingVoter = await voterRef.get();

    if (existingVoter.exists) {
      // Update existing voter with new session
      await voterRef.update({
        sessionToken,
        sessionExpiresAt,
        lastVerifiedAt: verifiedAt,
        updatedAt: FieldValue.serverTimestamp(),
      });

      const voterData = existingVoter.data();
      const votesRemaining = Math.max(0, maxVotes - (voterData?.votesUsed || 0));

      console.log(`[Verification] Phone ${normalizedPhone.substring(0, 7)}*** verified (existing voter) for code ${codeId}`);

      return NextResponse.json({
        success: true,
        sessionToken,
        sessionExpiresAt: sessionExpiresAt.toISOString(),
        votesUsed: voterData?.votesUsed || 0,
        votesRemaining,
        maxVotes,
      });
    }

    // Create new verified voter
    await voterRef.set({
      id: voterId,
      codeId,
      phone: normalizedPhone,
      votesUsed: 0,
      maxVotes,
      sessionToken,
      sessionExpiresAt,
      lastVerifiedAt: verifiedAt,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[Verification] Phone ${normalizedPhone.substring(0, 7)}*** verified (new voter) for code ${codeId}`);

    return NextResponse.json({
      success: true,
      sessionToken,
      sessionExpiresAt: sessionExpiresAt.toISOString(),
      votesUsed: 0,
      votesRemaining: maxVotes,
      maxVotes,
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to verify code', details: errorMessage },
      { status: 500 }
    );
  }
}
