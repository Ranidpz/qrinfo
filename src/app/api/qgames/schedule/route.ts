import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireCodeOwner, isAuthError } from '@/lib/auth';
import { QGamesAutoReset } from '@/types/qgames';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { codeId, autoReset } = body as { codeId: string; autoReset?: QGamesAutoReset };

    if (!codeId) {
      return NextResponse.json({ error: 'Missing codeId' }, { status: 400 });
    }

    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;

    const db = getAdminDb();
    const scheduleRef = db.collection('autoResetSchedules').doc(codeId);

    if (autoReset?.enabled && autoReset.slots.length > 0) {
      // Validate slots
      for (const slot of autoReset.slots) {
        if (slot.dayOfWeek < -1 || slot.dayOfWeek > 6) {
          return NextResponse.json({ error: 'Invalid dayOfWeek' }, { status: 400 });
        }
        if (slot.hour < 0 || slot.hour > 23 || slot.minute < 0 || slot.minute > 59) {
          return NextResponse.json({ error: 'Invalid time' }, { status: 400 });
        }
      }

      // Get owner ID from code doc
      const codeDoc = await db.collection('codes').doc(codeId).get();
      const ownerId = codeDoc.data()?.ownerId || auth.uid;

      await scheduleRef.set({
        codeId,
        ownerId,
        enabled: true,
        slots: autoReset.slots,
        lastResetAt: null,
        updatedAt: Date.now(),
      }, { merge: true });
    } else {
      // Disabled or empty — remove schedule
      const doc = await scheduleRef.get();
      if (doc.exists) {
        await scheduleRef.delete();
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Q.Games schedule error:', error);
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
  }
}
