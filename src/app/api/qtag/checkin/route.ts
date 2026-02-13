import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import { maskPhoneNumber } from '@/lib/phone-utils';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - prevent brute-force token guessing
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`qtag-checkin:${clientIp}`, RATE_LIMITS.CHECKIN);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { qrToken, action } = body;

    if (!qrToken || !action) {
      return NextResponse.json(
        { error: 'qrToken and action are required' },
        { status: 400 }
      );
    }

    if (action !== 'query' && action !== 'checkin') {
      return NextResponse.json(
        { error: 'Invalid action. Use "query" or "checkin"' },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    // Step 1: Look up via qrTokenMappings (fast path)
    let codeId: string | null = null;
    let guestId: string | null = null;
    let guestDoc: FirebaseFirestore.DocumentSnapshot | null = null;

    const tokenDoc = await db.collection('qrTokenMappings').doc(qrToken).get();
    if (tokenDoc.exists) {
      const mapping = tokenDoc.data()!;
      // Only handle qtag type mappings
      if (mapping.type === 'qtag') {
        codeId = mapping.codeId;
        guestId = mapping.guestId;
        guestDoc = await db.collection('codes').doc(codeId!)
          .collection('qtagGuests').doc(guestId!).get();
      }
    }

    // Step 2: Fallback - collection group query
    if (!guestDoc || !guestDoc.exists) {
      try {
        const guestsQuery = await db.collectionGroup('qtagGuests')
          .where('qrToken', '==', qrToken)
          .limit(1)
          .get();

        if (!guestsQuery.empty) {
          guestDoc = guestsQuery.docs[0];
          codeId = guestDoc.ref.parent.parent?.id || null;
          guestId = guestDoc.id;

          // Create mapping for future lookups
          if (codeId && guestId) {
            await db.collection('qrTokenMappings').doc(qrToken).set({
              codeId,
              guestId,
              type: 'qtag',
              createdAt: FieldValue.serverTimestamp(),
            });
          }
        }
      } catch (error) {
        console.error('[QTag Checkin] Collection group query failed:', error);
      }
    }

    if (!guestDoc || !guestDoc.exists || !codeId) {
      // Stricter rate limiting on failed lookups to prevent brute-force
      const failRateLimit = checkRateLimit(`qtag-checkin-fail:${clientIp}`, RATE_LIMITS.CHECKIN_FAIL);
      if (!failRateLimit.success) {
        return NextResponse.json(
          { error: 'Too many failed attempts. Please try again later.' },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: 'Guest not found', errorCode: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const guestData = guestDoc.data()!;
    const alreadyArrived = guestData.status === 'arrived';
    const arrivedAt = guestData.arrivedAt instanceof Timestamp
      ? guestData.arrivedAt.toDate().toISOString()
      : guestData.arrivedAt || null;

    // Query action - just return guest info
    if (action === 'query') {
      return NextResponse.json({
        guest: {
          id: guestDoc.id,
          name: guestData.name,
          phone: maskPhoneNumber(guestData.phone || ''),
          plusOneCount: guestData.plusOneCount || 0,
          plusOneDetails: guestData.plusOneDetails || [],
          status: guestData.status,
          isVerified: guestData.isVerified || false,
          registeredAt: guestData.registeredAt instanceof Timestamp
            ? guestData.registeredAt.toDate().toISOString()
            : guestData.registeredAt,
          arrivedAt,
        },
        alreadyArrived,
      });
    }

    // Checkin action - use transaction for atomic check-in
    if (action === 'checkin') {
      const result = await db.runTransaction(async (transaction) => {
        const guestRef = db.collection('codes').doc(codeId!)
          .collection('qtagGuests').doc(guestId!);
        const statsRef = db.collection('codes').doc(codeId!)
          .collection('qtagStats').doc('current');

        // All reads must happen before any writes in Firestore transactions
        const [freshDoc, statsDoc] = await Promise.all([
          transaction.get(guestRef),
          transaction.get(statsRef),
        ]);

        if (!freshDoc.exists) {
          return { error: 'Guest not found' };
        }

        const freshData = freshDoc.data()!;

        if (freshData.status === 'arrived') {
          return {
            alreadyArrived: true,
            arrivedAt: freshData.arrivedAt instanceof Timestamp
              ? freshData.arrivedAt.toDate().toISOString()
              : freshData.arrivedAt,
          };
        }

        // All writes after all reads
        transaction.update(guestRef, {
          status: 'arrived',
          arrivedAt: FieldValue.serverTimestamp(),
          arrivedMarkedBy: 'scanner',
          updatedAt: FieldValue.serverTimestamp(),
        });

        if (statsDoc.exists) {
          transaction.update(statsRef, {
            totalArrived: FieldValue.increment(1),
            totalArrivedGuests: FieldValue.increment(1 + (freshData.plusOneCount || 0)),
            lastUpdated: FieldValue.serverTimestamp(),
          });
        }

        return { alreadyArrived: false };
      });

      if ('error' in result) {
        return NextResponse.json(
          { error: result.error, errorCode: 'NOT_FOUND' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        guest: {
          id: guestDoc.id,
          name: guestData.name,
          phone: maskPhoneNumber(guestData.phone || ''),
          plusOneCount: guestData.plusOneCount || 0,
          plusOneDetails: guestData.plusOneDetails || [],
          status: result.alreadyArrived ? 'arrived' : 'arrived',
          isVerified: guestData.isVerified || false,
          registeredAt: guestData.registeredAt instanceof Timestamp
            ? guestData.registeredAt.toDate().toISOString()
            : guestData.registeredAt,
          arrivedAt: result.alreadyArrived
            ? result.arrivedAt
            : new Date().toISOString(),
        },
        alreadyArrived: result.alreadyArrived,
        checkedInAt: result.alreadyArrived
          ? result.arrivedAt
          : new Date().toISOString(),
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[QTag Checkin] Error:', error);
    return NextResponse.json(
      { error: 'Check-in failed', details: String(error) },
      { status: 500 }
    );
  }
}
