import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getApps } from 'firebase-admin/app';
import { deleteAllQVoteData, recalculateStats } from '@/lib/qvote';
import { getQRCodeByShortId } from '@/lib/db';

// Helper to get admin app for auth verification
function getAdminAuth() {
  const apps = getApps();
  const adminApp = apps.find((app) => app.name === 'firebase-admin');
  if (!adminApp) throw new Error('Admin app not initialized');
  return getAuth(adminApp);
}

// POST: Reset all Q.Vote data (candidates and votes) for a code
export async function POST(request: NextRequest) {
  try {
    // --- Authentication: Verify Firebase Auth token ---
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    let uid: string;
    try {
      const decodedToken = await getAdminAuth().verifyIdToken(token);
      uid = decodedToken.uid;
    } catch {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    const { codeId, shortId, confirmReset } = await request.json();

    // Require explicit confirmation
    if (confirmReset !== 'DELETE_ALL_DATA') {
      return NextResponse.json(
        { error: 'Must confirm reset with confirmReset: "DELETE_ALL_DATA"' },
        { status: 400 }
      );
    }

    let actualCodeId = codeId;

    // If shortId provided, look up the actual codeId
    if (shortId && !codeId) {
      const code = await getQRCodeByShortId(shortId);
      if (!code) {
        return NextResponse.json(
          { error: 'Code not found' },
          { status: 404 }
        );
      }
      actualCodeId = code.id;
    }

    if (!actualCodeId) {
      return NextResponse.json(
        { error: 'codeId or shortId is required' },
        { status: 400 }
      );
    }

    // --- Authorization: Verify ownership or admin role ---
    const db = getAdminDb();
    const codeDoc = await db.collection('codes').doc(actualCodeId).get();
    if (!codeDoc.exists) {
      return NextResponse.json(
        { error: 'Code not found' },
        { status: 404 }
      );
    }

    const codeData = codeDoc.data();
    const isOwner = codeData?.ownerId === uid;

    if (!isOwner) {
      const userDoc = await db.collection('users').doc(uid).get();
      const isSuperAdmin = userDoc.data()?.role === 'super_admin';
      if (!isSuperAdmin) {
        return NextResponse.json(
          { error: 'Only the code owner or admin can reset voting data' },
          { status: 403 }
        );
      }
    }

    console.log(`[QVote Reset] User ${uid} deleting all data for code: ${actualCodeId}`);

    // Delete all candidates and votes
    await deleteAllQVoteData(actualCodeId);

    // Recalculate stats (will be 0s)
    await recalculateStats(actualCodeId);

    console.log(`[QVote Reset] Successfully deleted all data for code: ${actualCodeId}`);

    return NextResponse.json({
      success: true,
      message: 'All Q.Vote data has been deleted',
      codeId: actualCodeId,
    });
  } catch (error) {
    console.error('Q.Vote reset error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to reset Q.Vote data', details: errorMessage },
      { status: 500 }
    );
  }
}
