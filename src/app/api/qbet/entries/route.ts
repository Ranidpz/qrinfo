import { NextRequest, NextResponse } from 'next/server';
import { requireCodeOwner, isAuthError } from '@/lib/auth';
import { listEntries, deleteEntry, deleteAllEntries } from '@/lib/qbet/store';
import type { QBetEntry } from '@/lib/qbet/types';

// Admin endpoint (owner only): list all entries for the Excel export + the
// registrants table in the settings modal. Full phone numbers are intentionally
// returned — the owner needs them to contact the winners.
export async function GET(request: NextRequest) {
  try {
    const codeId = request.nextUrl.searchParams.get('codeId');
    if (!codeId) {
      return NextResponse.json({ error: 'Missing codeId' }, { status: 400 });
    }

    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;

    const rows = await listEntries(codeId);
    const entries: QBetEntry[] = rows.map((row) => ({
      id: row.id,
      fullName: row.fullName,
      phone: row.phone,
      verified: row.verified,
      predictionHome: row.predictionHome,
      predictionAway: row.predictionAway,
      predictedAt: row.predictedAt,
      createdAt: row.createdAt || '',
    }));

    return NextResponse.json({ entries });
  } catch (error) {
    console.error('QBet entries GET error:', error);
    return NextResponse.json({ error: 'Failed to load entries' }, { status: 500 });
  }
}

// Admin endpoint (owner only): remove a single entry (e.g. test registrations).
export async function DELETE(request: NextRequest) {
  try {
    const codeId = request.nextUrl.searchParams.get('codeId');
    const entryId = request.nextUrl.searchParams.get('entryId');
    const deleteAll = request.nextUrl.searchParams.get('all') === 'true';
    // entryId is only required for a single-entry delete.
    if (!codeId || (!entryId && !deleteAll)) {
      return NextResponse.json({ error: 'Missing codeId or entryId' }, { status: 400 });
    }

    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;

    if (deleteAll) {
      const deleted = await deleteAllEntries(codeId);
      return NextResponse.json({ success: true, deleted });
    }

    await deleteEntry(codeId, entryId!);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('QBet entries DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 });
  }
}
