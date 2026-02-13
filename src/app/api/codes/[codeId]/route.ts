import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// GET /api/codes/[codeId] - Get code data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ codeId: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const { codeId } = await params;

    if (!codeId) {
      return NextResponse.json(
        { error: 'codeId is required' },
        { status: 400 }
      );
    }

    const codeRef = doc(db, 'codes', codeId);
    const codeSnap = await getDoc(codeRef);

    if (!codeSnap.exists()) {
      return NextResponse.json(
        { error: 'Code not found' },
        { status: 404 }
      );
    }

    const data = codeSnap.data();

    return NextResponse.json({
      code: {
        id: codeSnap.id,
        shortId: data.shortId,
        title: data.title,
        media: data.media,
        config: data.config,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
      },
    });
  } catch (error) {
    console.error('[API codes] Error fetching code:', error);
    return NextResponse.json(
      { error: 'Failed to fetch code' },
      { status: 500 }
    );
  }
}
