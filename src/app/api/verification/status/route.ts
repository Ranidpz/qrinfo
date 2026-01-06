import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { normalizePhoneNumber } from '@/lib/phone-utils';

// GET: Check verification status for a phone
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const codeId = searchParams.get('codeId');
    const phone = searchParams.get('phone');
    const sessionToken = searchParams.get('sessionToken');

    // Validate required fields
    if (!codeId || !phone) {
      return NextResponse.json(
        { error: 'codeId and phone are required' },
        { status: 400 }
      );
    }

    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(phone);
    const voterNormalizedPhone = normalizedPhone.replace(/\D/g, '');
    const voterId = `${codeId}_${voterNormalizedPhone}`;

    const db = getAdminDb();

    // Get verified voter record
    const voterDoc = await db.collection('verifiedVoters').doc(voterId).get();

    if (!voterDoc.exists) {
      return NextResponse.json({
        isVerified: false,
        votesUsed: 0,
        votesRemaining: 0,
        maxVotes: 0,
        sessionValid: false,
      });
    }

    const voterData = voterDoc.data();

    // Check if session is valid
    let sessionValid = false;
    if (sessionToken && voterData?.sessionToken === sessionToken) {
      const sessionExpiresAt = voterData?.sessionExpiresAt?.toDate();
      if (sessionExpiresAt && new Date() < sessionExpiresAt) {
        sessionValid = true;
      }
    }

    const votesUsed = voterData?.votesUsed || 0;
    const maxVotes = voterData?.maxVotes || 1;
    const votesRemaining = Math.max(0, maxVotes - votesUsed);

    return NextResponse.json({
      isVerified: true,
      votesUsed,
      votesRemaining,
      maxVotes,
      sessionValid,
      sessionExpiresAt: voterData?.sessionExpiresAt?.toDate()?.toISOString(),
    });
  } catch (error) {
    console.error('Verification status error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to check verification status', details: errorMessage },
      { status: 500 }
    );
  }
}
