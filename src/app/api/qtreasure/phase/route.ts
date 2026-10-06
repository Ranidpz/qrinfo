import { NextRequest, NextResponse } from 'next/server';
import { QTreasurePhase } from '@/types/qtreasure';
import { updateTreasureStatus, resetTreasureRealtimeSession } from '@/lib/qtreasure-realtime';
import { requireCodeOwner, isAuthError } from '@/lib/auth';
import { patchTreasureConfig, resetTreasureSession } from '@/lib/qtreasure/store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      codeId,
      mediaId,
      phase,
      reset,
    }: { codeId: string; mediaId: string; phase: QTreasurePhase; reset?: boolean } = body;

    // Validate required fields
    if (!codeId || !mediaId || !phase) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Phase changes and session resets are owner-only.
    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;

    // Validate phase
    const validPhases: QTreasurePhase[] = ['registration', 'playing', 'completed'];
    if (!validPhases.includes(phase)) {
      return NextResponse.json({ success: false, error: 'Invalid phase' }, { status: 400 });
    }

    const patch: Record<string, unknown> = { currentPhase: phase };
    if (phase === 'playing') {
      patch.gameStartedAt = Date.now();
    } else if (phase === 'registration') {
      patch.lastResetAt = Date.now();
    }

    try {
      await patchTreasureConfig(codeId, mediaId, patch);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UPDATE_FAILED';
      const status = msg === 'CODE_NOT_FOUND' ? 404 : msg === 'MEDIA_NOT_FOUND' ? 404 : 500;
      return NextResponse.json({ success: false, error: msg }, { status });
    }

    // Update Realtime DB status + optionally clear the session
    try {
      await updateTreasureStatus(codeId, phase);
      if (reset) {
        await resetTreasureSession(codeId);
        await resetTreasureRealtimeSession(codeId);
      }
    } catch (rtdbError) {
      console.error('Error updating Realtime DB:', rtdbError);
    }

    return NextResponse.json({ success: true, phase });
  } catch (error) {
    console.error('Error changing phase:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
