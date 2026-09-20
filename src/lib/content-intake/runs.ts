import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import type {
  ContentIntakeCommitResult,
  ContentIntakePreview,
  ContentIntakeRunStatus,
} from './types';

export const CONTENT_INTAKE_RUNS_COLLECTION = 'contentIntakeRuns';
export const CONTENT_INTAKE_FILE_UPDATES_COLLECTION = 'contentIntakeFileUpdates';

interface CreateRunParams {
  batchPreviewRunId?: string;
  ownerId: string;
  ownerEmail?: string;
  source?: string;
  receivedAt?: string;
  createdBy?: string;
  status: ContentIntakeRunStatus;
  preview: ContentIntakePreview;
}

interface UpdateRunParams {
  reportEmail?: { sent: boolean; skipped?: boolean; deferred?: boolean; error?: string };
  status?: ContentIntakeRunStatus;
  preview?: ContentIntakePreview;
  summary?: ContentIntakePreview['summary'];
  commitResults?: ContentIntakeCommitResult[];
  suggestedReplyAfterCommitHe?: string;
  error?: string;
}

export async function createContentIntakeRun(params: CreateRunParams): Promise<string> {
  const db = getAdminDb();
  const data = cleanFirestoreValue({
    workflow: params.preview.workflow,
    batchPreviewRunId: params.batchPreviewRunId,
    ownerId: params.ownerId,
    ownerEmail: params.ownerEmail,
    source: params.source || 'manual',
    receivedAt: params.receivedAt,
    createdBy: params.createdBy,
    status: params.status,
    preview: params.preview,
    summary: params.preview.summary,
    suggestedReplyAfterCommitHe: params.preview.suggestedReplyAfterCommitHe,
  }) as Record<string, unknown>;

  data.createdAt = FieldValue.serverTimestamp();
  data.updatedAt = FieldValue.serverTimestamp();

  const docRef = db.collection(CONTENT_INTAKE_RUNS_COLLECTION).doc();
  if (params.batchPreviewRunId) {
    const parentRef = db.collection(CONTENT_INTAKE_RUNS_COLLECTION).doc(params.batchPreviewRunId);
    await db.runTransaction(async (transaction) => {
      const parent = await transaction.get(parentRef);
      if (parent.data()?.ownerId !== params.ownerId || parent.data()?.status !== 'previewed') {
        throw new Error('Batch is closed or unavailable');
      }
      transaction.set(docRef, data);
      transaction.update(parentRef, { activeCommits: FieldValue.increment(1) });
    });
  } else {
    await docRef.set(data);
  }

  return docRef.id;
}

export async function updateContentIntakeRun(runId: string, updates: UpdateRunParams): Promise<void> {
  const db = getAdminDb();
  const data = cleanFirestoreValue({
    ...updates,
  }) as Record<string, unknown>;

  data.updatedAt = FieldValue.serverTimestamp();
  if (updates.status === 'completed' || updates.status === 'completed_with_issues' || updates.status === 'failed') {
    data.completedAt = FieldValue.serverTimestamp();
  }

  const ref = db.collection(CONTENT_INTAKE_RUNS_COLLECTION).doc(runId);
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(ref);
    const run = current.data();
    // Release a chunk exactly once, including failed commits, before finalizing a batch.
    if (run?.batchPreviewRunId && run.status === 'committing'
      && updates.status && updates.status !== 'committing') {
      transaction.update(db.collection(CONTENT_INTAKE_RUNS_COLLECTION).doc(run.batchPreviewRunId), {
        activeCommits: FieldValue.increment(-1),
      });
    }
    transaction.set(ref, data, { merge: true });
  });
}

export async function loadFattalPreviewRun(runId: string, ownerId: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(runId)) return null;
  const snapshot = await getAdminDb().collection(CONTENT_INTAKE_RUNS_COLLECTION).doc(runId).get();
  const run = snapshot.data();
  if (run?.ownerId !== ownerId || run.workflow !== 'fattal-booklets' || !run.preview) return null;
  return run as { ownerId: string; status: ContentIntakeRunStatus; preview: ContentIntakePreview; receivedAt?: string };
}

export async function hasSuccessfulFileUpdate(dedupeId: string): Promise<boolean> {
  const db = getAdminDb();
  const doc = await db.collection(CONTENT_INTAKE_FILE_UPDATES_COLLECTION).doc(dedupeId).get();
  return doc.exists && doc.data()?.status === 'updated';
}

export async function recordSuccessfulFileUpdate(params: {
  dedupeId: string;
  runId: string;
  ownerId: string;
  codeId: string;
  shortId?: string;
  filename: string;
  fileHash: string;
  source?: string;
  sourceFileId?: string;
  sourceMessageId?: string;
  detectedDate?: string;
  url: string;
  size: number;
}): Promise<void> {
  const db = getAdminDb();
  const data = cleanFirestoreValue({
    workflow: 'fattal-booklets',
    status: 'updated',
    runId: params.runId,
    ownerId: params.ownerId,
    codeId: params.codeId,
    shortId: params.shortId,
    filename: params.filename,
    fileHash: params.fileHash,
    source: params.source,
    sourceFileId: params.sourceFileId,
    sourceMessageId: params.sourceMessageId,
    detectedDate: params.detectedDate,
    url: params.url,
    size: params.size,
  }) as Record<string, unknown>;

  data.updatedAt = FieldValue.serverTimestamp();

  await db.collection(CONTENT_INTAKE_FILE_UPDATES_COLLECTION).doc(params.dedupeId).set(data, { merge: true });
}

function cleanFirestoreValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cleanFirestoreValue(item)).filter((item) => item !== undefined) as T;
  }

  if (!value || typeof value !== 'object') return value;

  if (value instanceof Date) return value.toISOString() as T;
  if (Buffer.isBuffer(value)) return undefined as T;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, nestedValue]) => [key, cleanFirestoreValue(nestedValue)])
      .filter(([, nestedValue]) => nestedValue !== undefined)
  ) as T;
}
