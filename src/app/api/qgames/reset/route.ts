import { NextRequest, NextResponse } from 'next/server';
import { requireCodeOwner, isAuthError } from '@/lib/auth';
import { resetQGamesData } from '@/lib/qgames-admin';

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

    await resetQGamesData(codeId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Q.Games reset error:', error);
    return NextResponse.json(
      { success: false, error: 'Reset failed' },
      { status: 500 }
    );
  }
}
