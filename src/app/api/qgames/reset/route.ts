import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireCodeOwner, isAuthError } from '@/lib/auth';
import { resetQGamesSession } from '@/lib/qgames-realtime';

export async function POST(request: NextRequest | Request) {
  try {
    const body = await request.json();
    const { codeId } = body;

    if (!codeId) {
      return NextResponse.json(
        { success: false, error: 'Missing codeId' },
        { status: 400 }
      );
    }

    // Verify ownership
    const auth = await requireCodeOwner(request as NextRequest, codeId);
    if (isAuthError(auth)) return auth.response;

    const adminDb = getAdminDb();

    // Delete all player docs
    const playersRef = adminDb
      .collection('codes').doc(codeId)
      .collection('qgames_players');
    const playerDocs = await playersRef.get();
    const batch1 = adminDb.batch();
    playerDocs.docs.forEach(doc => batch1.delete(doc.ref));
    if (!playerDocs.empty) await batch1.commit();

    // Delete all match docs
    const matchesRef = adminDb
      .collection('codes').doc(codeId)
      .collection('qgames_matches');
    const matchDocs = await matchesRef.get();
    const batch2 = adminDb.batch();
    matchDocs.docs.forEach(doc => batch2.delete(doc.ref));
    if (!matchDocs.empty) await batch2.commit();

    // Reset RTDB
    await resetQGamesSession(codeId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Q.Games reset error:', error);
    return NextResponse.json(
      { success: false, error: 'Reset failed' },
      { status: 500 }
    );
  }
}
