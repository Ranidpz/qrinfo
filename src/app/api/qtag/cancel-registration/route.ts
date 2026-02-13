import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`qtag-cancel:${clientIp}`, RATE_LIMITS.API);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { qrToken, action } = body;

    if (!qrToken || !action || !['cancel', 'uncancel'].includes(action)) {
      return NextResponse.json(
        { error: 'qrToken and action (cancel/uncancel) are required' },
        { status: 400 }
      );
    }

    // Validate token format (32-char hex)
    if (!/^[A-Fa-f0-9]{32}$/.test(qrToken)) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    // Look up token mapping
    const mappingDoc = await db.collection('qrTokenMappings').doc(qrToken).get();
    if (!mappingDoc.exists) {
      return NextResponse.json(
        { error: 'Guest not found' },
        { status: 404 }
      );
    }

    const mapping = mappingDoc.data()!;
    const { codeId, guestId } = mapping;

    // Fetch guest document
    const guestRef = db.collection('codes').doc(codeId)
      .collection('qtagGuests').doc(guestId);
    const guestDoc = await guestRef.get();

    if (!guestDoc.exists) {
      return NextResponse.json(
        { error: 'Guest not found' },
        { status: 404 }
      );
    }

    const guest = guestDoc.data()!;

    if (action === 'cancel') {
      if (guest.status === 'arrived') {
        return NextResponse.json(
          { error: 'Cannot cancel after check-in' },
          { status: 400 }
        );
      }
      if (guest.status === 'cancelled') {
        return NextResponse.json({ success: true, status: 'cancelled' });
      }
      await guestRef.update({ status: 'cancelled' });
      return NextResponse.json({ success: true, status: 'cancelled' });
    }

    if (action === 'uncancel') {
      if (guest.status !== 'cancelled') {
        return NextResponse.json({ success: true, status: guest.status });
      }
      await guestRef.update({ status: 'registered' });
      return NextResponse.json({ success: true, status: 'registered' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[QTag Cancel] Error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to update registration' },
      { status: 500 }
    );
  }
}
