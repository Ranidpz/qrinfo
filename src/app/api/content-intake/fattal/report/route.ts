import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireSuperAdmin, isAuthError } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { authenticateIntakeKey } from '@/lib/content-intake/fattal-server';
import { resolveFattalOwnerId } from '@/lib/content-intake/fattal-server';
import { CONTENT_INTAKE_RUNS_COLLECTION, updateContentIntakeRun } from '@/lib/content-intake/runs';
import { collectBatchResults } from '@/lib/content-intake/batch-results';
import { buildCommitReply, buildCommitSummary, hasCommitIssues, sendFattalCommitReportEmail } from '@/lib/content-intake/report';
import type { ContentIntakeCommitResult, ContentIntakePreview } from '@/lib/content-intake/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Only persisted, owner-checked server results may contribute to a report.
export async function POST(request: NextRequest) {
  try {
    const integrationAuth = await authenticateIntakeKey(request);
    if (!integrationAuth) {
      const auth = await requireSuperAdmin(request);
      if (isAuthError(auth)) return auth.response;
    }
    const body = await request.json();
    if (typeof body.batchPreviewRunId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(body.batchPreviewRunId)) {
      return NextResponse.json({ error: 'Valid batchPreviewRunId is required' }, { status: 400 });
    }
    const ownerId = await resolveFattalOwnerId({ ownerId: body.ownerId, ownerEmail: body.ownerEmail, integrationAuth });
    if (!ownerId) return NextResponse.json({ error: 'Owner is unavailable' }, { status: 403 });

    const db = getAdminDb();
    const runId = body.batchPreviewRunId;
    const ref = db.collection(CONTENT_INTAKE_RUNS_COLLECTION).doc(runId);
    const report = await db.runTransaction(async (transaction) => {
      const parent = (await transaction.get(ref)).data();
      if (parent?.ownerId !== ownerId || parent.workflow !== 'fattal-booklets' || parent.batchPreviewRunId) {
        throw new Error('Batch unavailable');
      }
      if (parent.activeCommits > 0) throw new Error('Batch still running');
      const preview = parent.preview as ContentIntakePreview;
      let results: ContentIntakeCommitResult[];
      if (parent.status === 'previewed') {
        const chunks = await transaction.get(db.collection(CONTENT_INTAKE_RUNS_COLLECTION).where('batchPreviewRunId', '==', runId));
        results = collectBatchResults(preview, chunks.docs
          .filter((doc) => doc.data().ownerId === ownerId)
          .flatMap((doc) => doc.data().commitResults || []));
      } else if (parent.batchFinalized === true) {
        // A retried report uses the frozen payload and the same idempotency key.
        results = parent.commitResults;
      } else {
        throw new Error('Batch unavailable');
      }
      const status = hasCommitIssues(preview, results) ? 'completed_with_issues' as const : 'completed' as const;
      const suggestedReplyAfterCommitHe = buildCommitReply(preview, results);
      const summary = buildCommitSummary(preview, results);
      if (!parent.batchFinalized) {
        // No more chunks can start once the parent leaves previewed.
        transaction.update(ref, {
          status, batchFinalized: true,
          commitResults: JSON.parse(JSON.stringify(results)),
          suggestedReplyAfterCommitHe, summary,
          completedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        });
      }
      return { runId, status, preview, results, summary, suggestedReplyAfterCommitHe,
        receivedAt: parent.receivedAt as string | undefined,
        reportEmail: parent.reportEmail as { sent: boolean; skipped?: boolean; error?: string } | undefined };
    });
    const reportEmail = report.reportEmail?.sent ? report.reportEmail : await sendFattalCommitReportEmail(report);
    await updateContentIntakeRun(runId, { reportEmail });
    return NextResponse.json({ ...report, reportEmail, success: report.status === 'completed' });
  } catch (error) {
    console.error('[Fattal batch report]', error);
    const known = error instanceof Error && ['Batch unavailable', 'Batch still running'].includes(error.message);
    return NextResponse.json({ error: known ? error.message : 'Failed to finalize batch report' }, { status: known ? 409 : 500 });
  }
}
