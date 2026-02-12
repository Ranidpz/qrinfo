import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { requireCodeOwner, isAuthError } from '@/lib/auth';

// GET: List all guests for a code
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const codeId = searchParams.get('codeId');
    const q = searchParams.get('q'); // Search query

    if (!codeId) {
      return NextResponse.json({ error: 'codeId is required' }, { status: 400 });
    }

    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;

    const db = getAdminDb();
    const guestsSnap = await db.collection('codes').doc(codeId)
      .collection('qtagGuests')
      .orderBy('registeredAt', 'desc')
      .get();

    let guests = guestsSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        phone: data.phone,
        plusOneCount: data.plusOneCount || 0,
        plusOneDetails: data.plusOneDetails || [],
        status: data.status,
        isVerified: data.isVerified || false,
        registeredAt: data.registeredAt instanceof Timestamp
          ? data.registeredAt.toDate().toISOString()
          : data.registeredAt,
        arrivedAt: data.arrivedAt instanceof Timestamp
          ? data.arrivedAt.toDate().toISOString()
          : data.arrivedAt || null,
        registeredByAdmin: data.registeredByAdmin || false,
      };
    });

    // Apply search filter
    if (q) {
      const query = q.toLowerCase();
      guests = guests.filter(g =>
        g.name.toLowerCase().includes(query) ||
        g.phone.includes(query)
      );
    }

    return NextResponse.json({ guests });
  } catch (error) {
    console.error('[QTag Guests GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch guests', details: String(error) },
      { status: 500 }
    );
  }
}

// PATCH: Update a guest
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { codeId, guestId, name, plusOneCount, status } = body;

    if (!codeId || !guestId) {
      return NextResponse.json(
        { error: 'codeId and guestId are required' },
        { status: 400 }
      );
    }

    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;

    const db = getAdminDb();
    const guestRef = db.collection('codes').doc(codeId)
      .collection('qtagGuests').doc(guestId);

    const guestDoc = await guestRef.get();
    if (!guestDoc.exists) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (name !== undefined) updates.name = name;
    if (plusOneCount !== undefined) updates.plusOneCount = Math.max(0, Math.min(10, plusOneCount));
    if (status !== undefined && ['registered', 'arrived', 'cancelled'].includes(status)) {
      const oldData = guestDoc.data()!;
      updates.status = status;

      // Update stats if status changed
      if (oldData.status !== status) {
        const statsRef = db.collection('codes').doc(codeId)
          .collection('qtagStats').doc('current');

        if (status === 'arrived' && oldData.status !== 'arrived') {
          updates.arrivedAt = FieldValue.serverTimestamp();
          updates.arrivedMarkedBy = 'admin';
          await statsRef.update({
            totalArrived: FieldValue.increment(1),
            totalArrivedGuests: FieldValue.increment(1 + (oldData.plusOneCount || 0)),
            lastUpdated: FieldValue.serverTimestamp(),
          });
        } else if (oldData.status === 'arrived' && status !== 'arrived') {
          updates.arrivedAt = null;
          await statsRef.update({
            totalArrived: FieldValue.increment(-1),
            totalArrivedGuests: FieldValue.increment(-(1 + (oldData.plusOneCount || 0))),
            lastUpdated: FieldValue.serverTimestamp(),
          });
        }
      }
    }

    await guestRef.update(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[QTag Guests PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update guest', details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE: Remove a guest
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let codeId = searchParams.get('codeId');
    let guestId = searchParams.get('guestId');

    if (!codeId || !guestId) {
      try {
        const body = await request.json();
        codeId = body.codeId || codeId;
        guestId = body.guestId || guestId;
      } catch {
        // Body parsing failed
      }
    }

    if (!codeId || !guestId) {
      return NextResponse.json(
        { error: 'codeId and guestId are required' },
        { status: 400 }
      );
    }

    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;

    const db = getAdminDb();
    const guestRef = db.collection('codes').doc(codeId)
      .collection('qtagGuests').doc(guestId);

    const guestDoc = await guestRef.get();
    if (!guestDoc.exists) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    const guestData = guestDoc.data()!;

    // Clean up token mapping
    if (guestData.qrToken) {
      try {
        await db.collection('qrTokenMappings').doc(guestData.qrToken).delete();
      } catch {
        // Non-critical
      }
    }

    // Update stats
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
  } catch (error) {
    console.error('[QTag Guests DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete guest', details: String(error) },
      { status: 500 }
    );
  }
}
