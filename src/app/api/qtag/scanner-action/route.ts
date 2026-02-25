import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import crypto from 'crypto';

// Scanner-specific rate limits
const SCANNER_ACTION_LIMIT = { maxRequests: 30, windowMs: 60 * 1000 };
const SCANNER_PIN_FAIL_LIMIT = { maxRequests: 10, windowMs: 5 * 60 * 1000 };

/**
 * Verify scanner PIN for the given code.
 * If the code has a PIN configured, the request must include a matching PIN.
 * If no PIN configured, allow access (same security as the scanner page itself).
 */
async function verifyScannerPin(
  db: FirebaseFirestore.Firestore,
  codeId: string,
  scannerPin: string | undefined,
  clientIp: string
): Promise<{ error: string; status: number } | { success: true }> {
  const codeDoc = await db.collection('codes').doc(codeId).get();
  if (!codeDoc.exists) {
    return { error: 'Code not found', status: 404 };
  }

  const data = codeDoc.data()!;
  const media = data.media || [];
  const qtagMedia = media.find((m: { qtagConfig?: unknown }) => m.qtagConfig);
  const expectedPin = qtagMedia?.qtagConfig?.scannerPin?.trim();

  if (expectedPin) {
    if (!scannerPin || scannerPin.trim() !== expectedPin) {
      const failLimit = checkRateLimit(
        `scanner-pin-fail:${clientIp}`,
        SCANNER_PIN_FAIL_LIMIT
      );
      if (!failLimit.success) {
        return { error: 'Too many failed attempts', status: 429 };
      }
      return { error: 'Invalid scanner PIN', status: 403 };
    }
  }

  return { success: true };
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`scanner-action:${clientIp}`, SCANNER_ACTION_LIMIT);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { codeId, action, scannerPin } = body;

    if (!codeId || !action) {
      return NextResponse.json(
        { error: 'codeId and action are required' },
        { status: 400 }
      );
    }

    if (!['quick-add', 'undo-checkin', 'delete'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const db = getAdminDb();

    const pinResult = await verifyScannerPin(db, codeId, scannerPin, clientIp);
    if ('error' in pinResult) {
      return NextResponse.json(
        { error: pinResult.error },
        { status: pinResult.status }
      );
    }

    // --- quick-add: create walk-in guest (immediately marked as arrived) ---
    if (action === 'quick-add') {
      const { name, plusOneCount = 0 } = body;
      const validPlusOne = Math.max(0, Math.min(10, Math.floor(plusOneCount || 0)));

      let guestName = name?.trim();
      if (!guestName) {
        const existingSnap = await db.collection('codes').doc(codeId)
          .collection('qtagGuests')
          .where('registeredByAdmin', '==', true)
          .count()
          .get();
        const count = existingSnap.data().count + 1;
        guestName = `אורח #${count}`;
      }

      const qrToken = crypto.randomBytes(16).toString('hex').toUpperCase();
      const guestRef = db.collection('codes').doc(codeId).collection('qtagGuests').doc();

      const guestData = {
        id: guestRef.id,
        codeId,
        name: guestName,
        phone: '',
        plusOneCount: validPlusOne,
        plusOneDetails: [],
        qrToken,
        isVerified: true,
        status: 'arrived',
        arrivedAt: FieldValue.serverTimestamp(),
        arrivedMarkedBy: 'scanner',
        qrSentViaWhatsApp: false,
        registeredAt: FieldValue.serverTimestamp(),
        registeredByAdmin: true,
      };

      const batch = db.batch();
      batch.set(guestRef, guestData);
      batch.set(db.collection('qrTokenMappings').doc(qrToken), {
        codeId,
        guestId: guestRef.id,
        type: 'qtag',
        createdAt: FieldValue.serverTimestamp(),
      });

      const statsRef = db.collection('codes').doc(codeId)
        .collection('qtagStats').doc('current');
      const statsDoc = await statsRef.get();
      const totalPeople = 1 + validPlusOne;

      if (!statsDoc.exists) {
        batch.set(statsRef, {
          totalRegistered: 1,
          totalGuests: totalPeople,
          totalArrived: 1,
          totalArrivedGuests: totalPeople,
          lastUpdated: FieldValue.serverTimestamp(),
        });
      } else {
        batch.update(statsRef, {
          totalRegistered: FieldValue.increment(1),
          totalGuests: FieldValue.increment(totalPeople),
          totalArrived: FieldValue.increment(1),
          totalArrivedGuests: FieldValue.increment(totalPeople),
          lastUpdated: FieldValue.serverTimestamp(),
        });
      }

      await batch.commit();
      return NextResponse.json({ success: true, guestId: guestRef.id });
    }

    // --- undo-checkin: revert arrival status back to registered ---
    if (action === 'undo-checkin') {
      const { guestId } = body;
      if (!guestId) {
        return NextResponse.json({ error: 'guestId is required' }, { status: 400 });
      }

      const guestRef = db.collection('codes').doc(codeId)
        .collection('qtagGuests').doc(guestId);

      await db.runTransaction(async (transaction) => {
        const statsRef = db.collection('codes').doc(codeId)
          .collection('qtagStats').doc('current');

        const [freshDoc, statsDoc] = await Promise.all([
          transaction.get(guestRef),
          transaction.get(statsRef),
        ]);

        if (!freshDoc.exists) return;
        const freshData = freshDoc.data()!;
        if (freshData.status !== 'arrived') return;

        transaction.update(guestRef, {
          status: 'registered',
          arrivedAt: null,
          arrivedMarkedBy: null,
          updatedAt: FieldValue.serverTimestamp(),
        });

        if (statsDoc.exists) {
          transaction.update(statsRef, {
            totalArrived: FieldValue.increment(-1),
            totalArrivedGuests: FieldValue.increment(-(1 + (freshData.plusOneCount || 0))),
            lastUpdated: FieldValue.serverTimestamp(),
          });
        }
      });

      return NextResponse.json({ success: true });
    }

    // --- delete: remove guest entirely ---
    if (action === 'delete') {
      const { guestId } = body;
      if (!guestId) {
        return NextResponse.json({ error: 'guestId is required' }, { status: 400 });
      }

      const guestRef = db.collection('codes').doc(codeId)
        .collection('qtagGuests').doc(guestId);
      const guestDoc = await guestRef.get();

      if (!guestDoc.exists) {
        return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
      }

      const guestData = guestDoc.data()!;

      if (guestData.qrToken) {
        try {
          await db.collection('qrTokenMappings').doc(guestData.qrToken).delete();
        } catch {
          // Non-critical
        }
      }

      const statsRef = db.collection('codes').doc(codeId)
        .collection('qtagStats').doc('current');
      const statsDoc = await statsRef.get();

      if (statsDoc.exists) {
        const decrements: Record<string, unknown> = {
          totalRegistered: FieldValue.increment(-1),
          totalGuests: FieldValue.increment(-(1 + (guestData.plusOneCount || 0))),
          lastUpdated: FieldValue.serverTimestamp(),
        };

        if (guestData.status === 'arrived') {
          decrements.totalArrived = FieldValue.increment(-1);
          decrements.totalArrivedGuests = FieldValue.increment(-(1 + (guestData.plusOneCount || 0)));
        }

        await statsRef.update(decrements);
      }

      await guestRef.delete();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[QTag Scanner Action] Error:', error);
    return NextResponse.json(
      { error: 'Operation failed' },
      { status: 500 }
    );
  }
}
