import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import { maskPhoneNumber } from '@/lib/phone-utils';

// GET: Check if a guest still exists by qrToken
export async function GET(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`qtag-status:${clientIp}`, RATE_LIMITS.API);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const codeId = searchParams.get('codeId');
    const token = searchParams.get('token');

    if (!codeId || !token) {
      return NextResponse.json(
        { error: 'codeId and token are required' },
        { status: 400 }
      );
    }

    // Validate token format (32-char hex)
    if (!/^[A-Fa-f0-9]{32}$/.test(token)) {
      return NextResponse.json({ exists: false });
    }

    const db = getAdminDb();

    // Look up token mapping
    const mappingDoc = await db.collection('qrTokenMappings').doc(token).get();
    if (!mappingDoc.exists) {
      return NextResponse.json({ exists: false });
    }

    const mapping = mappingDoc.data()!;
    if (mapping.codeId !== codeId) {
      return NextResponse.json({ exists: false });
    }

    // Look up guest document
    const guestDoc = await db.collection('codes').doc(codeId)
      .collection('qtagGuests').doc(mapping.guestId).get();

    if (!guestDoc.exists) {
      return NextResponse.json({ exists: false });
    }

    const guest = guestDoc.data()!;

    // Don't return data for cancelled guests
    if (guest.status === 'cancelled') {
      return NextResponse.json({ exists: false });
    }

    return NextResponse.json({
      exists: true,
      guestId: mapping.guestId,
      name: guest.name,
      phone: maskPhoneNumber(guest.phone),
      plusOneCount: guest.plusOneCount || 0,
      status: guest.status,
      qrToken: token,
    });
  } catch (error) {
    console.error('[QTag Guest Status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check guest status' },
      { status: 500 }
    );
  }
}
