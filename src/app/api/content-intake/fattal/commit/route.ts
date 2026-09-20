import { createHash } from 'crypto';
import { selectBatchMatches } from '@/lib/content-intake/batch-preview';
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin, isAuthError } from '@/lib/auth';
import { hasValidServerApiKey } from '@/lib/server-api-key';
import { buildCommitReply, buildCommitSummary, hasCommitIssues, sendFattalCommitReportEmail } from '@/lib/content-intake/report';
import { buildFattalPreview } from '@/lib/content-intake/fattal';
import { loadMappedFattalTargets, resolveFattalOwnerId } from '@/lib/content-intake/fattal-server';
import { fetchPdfBuffer, replaceCodePdfWithBuffer } from '@/lib/content-intake/pdf-replacement';
import {
  createContentIntakeRun,
  loadFattalPreviewRun,
  hasSuccessfulFileUpdate,
  recordSuccessfulFileUpdate,
  updateContentIntakeRun,
} from '@/lib/content-intake/runs';
import type {
  ContentIntakeCommitResult,
  ContentIntakePreview,
  ContentIntakeSource,
  IntakeFileCandidate,
} from '@/lib/content-intake/types';

interface CommitRequestPayload {
  files: CommitFilePayload[];
  receivedAt?: string;
  ownerId?: unknown;
  ownerEmail?: unknown;
  source?: ContentIntakeSource;
  batchPreviewRunId?: string;
  deleteOld?: boolean;
}

interface CommitFilePayload extends IntakeFileCandidate {
  buffer: Buffer;
  contentType: string;
  sourceFileId?: string;
}

interface CommitJsonBody {
  files?: unknown;
  receivedAt?: unknown;
  ownerId?: unknown;
  ownerEmail?: unknown;
  source?: unknown;
  batchPreviewRunId?: unknown;
  deleteOld?: unknown;
}

const CONTENT_INTAKE_HEADERS = ['x-content-intake-key', 'x-integration-key'];

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let runId: string | undefined;

  try {
    const isIntegrationAuth = hasValidServerApiKey(
      request,
      'CONTENT_INTAKE_API_KEY',
      CONTENT_INTAKE_HEADERS
    );

    let createdBy: string | undefined;
    if (!isIntegrationAuth) {
      const auth = await requireSuperAdmin(request);
      if (isAuthError(auth)) return auth.response;
      createdBy = auth.uid;
    }

    const payload = await parseCommitRequest(request);
    if (payload.files.length === 0) {
      return NextResponse.json(
        { error: 'At least one PDF file is required' },
        { status: 400 }
      );
    }

    const ownerId = await resolveFattalOwnerId({
      ownerId: payload.ownerId,
      ownerEmail: payload.ownerEmail,
      integrationAuth: isIntegrationAuth,
    });
    if (!ownerId) {
      return NextResponse.json(
        { error: 'ownerId or ownerEmail is required for Fattal commit' },
        { status: 400 }
      );
    }

    const targets = await loadMappedFattalTargets(ownerId);
    if (targets.length === 0) {
      return NextResponse.json(
        { error: 'No mapped Fattal booklet QR targets found for the selected owner' },
        { status: 404 }
      );
    }

    let preview = buildFattalPreview({
      files: payload.files.map(toCandidate),
      targets,
      receivedAt: payload.receivedAt,
    });

    if (payload.batchPreviewRunId) {
      const parent = await loadFattalPreviewRun(payload.batchPreviewRunId, ownerId);
      if (!parent || parent.status !== 'previewed') {
        return NextResponse.json({ error: 'Batch preview is unavailable or closed' }, { status: 409 });
      }
      // Recompute against current targets; do not trust old target ownership or
      // allow an individual transport chunk to erase a batch-level ambiguity.
      const fullPreview = buildFattalPreview({
        files: parent.preview.matches.map((match) => match.file),
        targets,
        receivedAt: parent.receivedAt,
      });
      try {
        preview = selectBatchMatches(fullPreview, payload.files.map(toCandidate));
      } catch {
        return NextResponse.json({ error: 'Files differ from the saved batch preview' }, { status: 409 });
      }
    }

    // Client supplied run IDs must never overwrite another run's audit log.
    runId = await createContentIntakeRun({
      ownerId,
      ownerEmail: typeof payload.ownerEmail === 'string' ? payload.ownerEmail : undefined,
      source: payload.source || 'manual',
      receivedAt: payload.receivedAt,
      createdBy,
      status: 'committing',
      preview,
      batchPreviewRunId: payload.batchPreviewRunId,
    });
    preview.runId = runId;

    const results = await commitMatchedFiles({
      runId,
      ownerId,
      preview,
      files: payload.files,
      deleteOld: payload.deleteOld,
    });

    const suggestedReplyAfterCommitHe = buildCommitReply(preview, results);
    const finalStatus = hasCommitIssues(preview, results)
      ? 'completed_with_issues'
      : 'completed';
    const summary = buildCommitSummary(preview, results);

    await updateContentIntakeRun(runId, {
      status: finalStatus,
      preview,
      summary: preview.summary,
      commitResults: results,
      suggestedReplyAfterCommitHe,
    });

    const reportEmail = payload.batchPreviewRunId
      ? { sent: false, deferred: true }
      : await sendFattalCommitReportEmail({
      runId,
      status: finalStatus,
      preview,
      summary,
      results,
      suggestedReplyAfterCommitHe,
      receivedAt: payload.receivedAt,
    });

    await updateContentIntakeRun(runId, { reportEmail });

    return NextResponse.json({
      success: finalStatus === 'completed',
      runId,
      status: finalStatus,
      preview,
      summary,
      results,
      suggestedReplyAfterCommitHe,
      reportEmail,
    });
  } catch (error) {
    console.error('[Content Intake Fattal Commit] Error:', error);
    if (runId) {
      await updateContentIntakeRun(runId, {
        status: 'failed',
        error: clientSafeError(error),
      }).catch((updateError) => {
        console.error('[Content Intake Fattal Commit] Failed to mark run failed:', updateError);
      });
    }

    return NextResponse.json(
      { error: 'Failed to commit Fattal intake run' },
      { status: 500 }
    );
  }
}

async function parseCommitRequest(request: NextRequest): Promise<CommitRequestPayload> {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    return parseMultipartCommitRequest(request);
  }

  return parseJsonCommitRequest(request);
}

async function parseMultipartCommitRequest(request: NextRequest): Promise<CommitRequestPayload> {
  const formData = await request.formData();
  const source = parseSource(formData.get('source'));
  const receivedAt = parseString(formData.get('receivedAt'));
  const files = [
    ...formData.getAll('files'),
    ...formData.getAll('file'),
  ];

  return {
    files: await Promise.all(
      files
        .filter(isUploadedFile)
        .map(async (file, index) => {
          const sourceMessageId = parseString(formData.get(`sourceMessageId:${file.name}`))
            || parseString(formData.get(`sourceMessageId:${index}`))
            || parseString(formData.get('sourceMessageId'));
          const sourceFileId = parseString(formData.get(`sourceFileId:${file.name}`))
            || parseString(formData.get(`sourceFileId:${index}`))
            || parseString(formData.get('sourceFileId'));

          return {
            id: sourceFileId || sourceMessageId || `upload-${index}-${file.name}-${file.size}`,
            name: file.name,
            size: file.size,
            contentType: file.type || 'application/pdf',
            receivedAt: parseString(formData.get(`receivedAt:${file.name}`)) || parseString(formData.get(`receivedAt:${index}`)) || receivedAt,
            source,
            sourceMessageId,
            sourceFileId,
            buffer: Buffer.from(await file.arrayBuffer()),
          };
        })
    ),
    receivedAt,
    ownerId: parseString(formData.get('ownerId')),
    ownerEmail: parseString(formData.get('ownerEmail')),
    source,
    batchPreviewRunId: parseString(formData.get('batchPreviewRunId')),
    deleteOld: parseBoolean(formData.get('deleteOld'), true),
  };
}

async function parseJsonCommitRequest(request: NextRequest): Promise<CommitRequestPayload> {
  const body = await request.json() as CommitJsonBody;
  const source = parseSource(body.source);
  const receivedAt = typeof body.receivedAt === 'string' ? body.receivedAt : undefined;

  return {
    files: await parseJsonFiles(body.files, receivedAt, source),
    receivedAt,
    ownerId: body.ownerId,
    ownerEmail: body.ownerEmail,
    source,
    batchPreviewRunId: typeof body.batchPreviewRunId === 'string' ? body.batchPreviewRunId : undefined,
    deleteOld: typeof body.deleteOld === 'boolean' ? body.deleteOld : true,
  };
}

async function parseJsonFiles(
  value: unknown,
  defaultReceivedAt?: string,
  defaultSource?: ContentIntakeSource
): Promise<CommitFilePayload[]> {
  if (!Array.isArray(value)) return [];

  const files: CommitFilePayload[] = [];
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    const sourceUrl = typeof raw.sourceUrl === 'string' ? raw.sourceUrl.trim() : '';
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!sourceUrl || !name) continue;

    const fetched = await fetchPdfBuffer(sourceUrl, name);
    const source = parseSource(raw.source) || defaultSource;
    const receivedAt = typeof raw.receivedAt === 'string' ? raw.receivedAt : defaultReceivedAt;
    const sourceFileId = typeof raw.sourceFileId === 'string' ? raw.sourceFileId : undefined;
    const sourceMessageId = typeof raw.sourceMessageId === 'string' ? raw.sourceMessageId : undefined;

    files.push({
      id: typeof raw.id === 'string' ? raw.id : sourceFileId || sourceMessageId || `url-${index}-${name}`,
      name,
      size: typeof raw.size === 'number' ? raw.size : fetched.buffer.byteLength,
      contentType: typeof raw.contentType === 'string' ? raw.contentType : fetched.contentType,
      receivedAt,
      source,
      sourceMessageId,
      senderName: typeof raw.senderName === 'string' ? raw.senderName : undefined,
      sourceFileId,
      buffer: fetched.buffer,
    });
  }

  return files;
}

async function commitMatchedFiles(params: {
  runId: string;
  ownerId: string;
  preview: ContentIntakePreview;
  files: CommitFilePayload[];
  deleteOld?: boolean;
}): Promise<ContentIntakeCommitResult[]> {
  const results: ContentIntakeCommitResult[] = [];

  for (const [index, match] of params.preview.matches.entries()) {
    const file = params.files[index];
    const filename = match.file.name;

    if (!file) {
      results.push({
        fileId: match.file.id,
        filename,
        status: 'failed',
        error: 'Uploaded file payload was not found',
      });
      continue;
    }

    if (match.status !== 'matched' || !match.target) {
      results.push({
        fileId: match.file.id,
        filename,
        status: 'skipped',
        codeId: match.target?.codeId,
        shortId: match.target?.shortId,
        title: match.target?.title,
        detectedDate: match.detectedDate.value,
        reason: match.status,
      });
      continue;
    }

    const fileHash = createHash('sha256').update(file.buffer).digest('hex');
    const dedupeId = buildDedupeId(match.target.codeId, fileHash);
    const legacyDedupeId = file.sourceMessageId ? buildDedupeId(match.target.codeId, fileHash, file.sourceMessageId) : dedupeId;
    const resultBase = {
      fileId: match.file.id,
      filename,
      codeId: match.target.codeId,
      shortId: match.target.shortId,
      title: match.target.title,
      dedupeId,
      detectedDate: match.detectedDate.value,
    };

    try {
      if (await hasSuccessfulFileUpdate(dedupeId)
        || (legacyDedupeId !== dedupeId && await hasSuccessfulFileUpdate(legacyDedupeId))) {
        results.push({
          ...resultBase,
          status: 'skipped_duplicate',
          reason: 'This exact file was already committed for this QR target',
        });
        continue;
      }

      const updated = await replaceCodePdfWithBuffer(
        match.target.codeId,
        {
          buffer: file.buffer,
          filename,
          contentType: file.contentType,
          source: file.source || 'manual',
          sourceFileId: file.sourceFileId,
          sourceMessageId: file.sourceMessageId,
          detectedDate: match.detectedDate.value,
          deleteOld: params.deleteOld,
          workflow: 'fattal-booklets',
        },
        { expectedOwnerId: params.ownerId }
      );

      await recordSuccessfulFileUpdate({
        dedupeId,
        runId: params.runId,
        ownerId: params.ownerId,
        codeId: match.target.codeId,
        shortId: match.target.shortId,
        filename,
        fileHash,
        source: file.source || 'manual',
        sourceFileId: file.sourceFileId,
        sourceMessageId: file.sourceMessageId,
        detectedDate: match.detectedDate.value,
        url: updated.url,
        size: updated.size,
      });

      results.push({
        ...resultBase,
        status: 'updated',
        url: updated.url,
        size: updated.size,
        storageDelta: updated.storageDelta,
        pageCount: updated.pageCount,
        warning: updated.warning,
      });
    } catch (error) {
      console.error('[Content Intake Fattal Commit] File update failed:', {
        codeId: match.target.codeId,
        filename,
        error,
      });
      results.push({
        ...resultBase,
        status: 'failed',
        error: clientSafeError(error),
      });
    }
  }

  return results;
}

function toCandidate(file: CommitFilePayload): IntakeFileCandidate {
  return {
    id: file.id,
    name: file.name,
    size: file.size,
    contentType: file.contentType,
    receivedAt: file.receivedAt,
    source: file.source,
    sourceMessageId: file.sourceMessageId,
    senderName: file.senderName,
  };
}

function buildDedupeId(codeId: string, fileHash: string, sourceMessageId?: string): string {
  const basis = `${sourceMessageId || 'no-message'}:${fileHash}`;
  const digest = createHash('sha256').update(basis).digest('hex');
  return `fattal-booklets_${codeId}_${digest}`;
}

function parseSource(value: unknown): ContentIntakeSource | undefined {
  if (
    value === 'whatsapp'
    || value === 'email'
    || value === 'drive'
    || value === 'manual'
    || value === 'api'
  ) {
    return value;
  }
  return undefined;
}

function parseString(value: FormDataEntryValue | null): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function parseBoolean(value: FormDataEntryValue | null, fallback: boolean): boolean {
  if (value === null) return fallback;
  if (typeof value !== 'string') return fallback;
  if (value === 'false' || value === '0') return false;
  if (value === 'true' || value === '1') return true;
  return fallback;
}

function isUploadedFile(value: FormDataEntryValue): value is File {
  return typeof value === 'object'
    && value !== null
    && 'arrayBuffer' in value
    && 'name' in value
    && typeof (value as File).name === 'string';
}

function clientSafeError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (
    message.startsWith('Only PDF files')
    || message.startsWith('PDF exceeds')
    || message.startsWith('Failed to fetch sourceUrl')
    || message.startsWith('sourceUrl must')
    || message === 'Code not found'
    || message === 'Code owner is missing'
    || message === 'Code owner does not match Fattal owner'
    || message === 'Owner user not found'
    || message === 'Target media not found'
    || message === 'Target media is not a PDF'
    || message === 'Storage quota exceeded'
  ) {
    return message;
  }

  return 'Update failed';
}
