import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin, isAuthError } from '@/lib/auth';
import { hasValidServerApiKey } from '@/lib/server-api-key';
import { isResendConfigured, sendEmail } from '@/lib/resend';
import { buildFattalPreview } from '@/lib/content-intake/fattal';
import { loadMappedFattalTargets, resolveFattalOwnerId } from '@/lib/content-intake/fattal-server';
import { fetchPdfBuffer, replaceCodePdfWithBuffer } from '@/lib/content-intake/pdf-replacement';
import {
  createContentIntakeRun,
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
  runId?: string;
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
  runId?: unknown;
  deleteOld?: unknown;
}

const CONTENT_INTAKE_HEADERS = ['x-content-intake-key', 'x-integration-key'];
const FATTAL_REPORT_EMAIL_TO = process.env.FATTAL_REPORT_EMAIL_TO || 'info@playzone.co.il';

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

    const preview = buildFattalPreview({
      files: payload.files.map(toCandidate),
      targets,
      receivedAt: payload.receivedAt,
    });

    runId = payload.runId;
    if (runId) {
      preview.runId = runId;
      await updateContentIntakeRun(runId, {
        status: 'committing',
        preview,
        summary: preview.summary,
        suggestedReplyAfterCommitHe: preview.suggestedReplyAfterCommitHe,
      });
    } else {
      runId = await createContentIntakeRun({
        ownerId,
        ownerEmail: typeof payload.ownerEmail === 'string' ? payload.ownerEmail : undefined,
        source: payload.source || 'manual',
        receivedAt: payload.receivedAt,
        createdBy,
        status: 'committing',
        preview,
      });
      preview.runId = runId;
    }

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

    const reportEmail = await sendFattalCommitReportEmail({
      runId,
      status: finalStatus,
      preview,
      summary,
      results,
      suggestedReplyAfterCommitHe,
      receivedAt: payload.receivedAt,
    });

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

async function sendFattalCommitReportEmail(params: {
  runId: string;
  status: ContentIntakeRunStatusForReport;
  preview: ContentIntakePreview;
  summary: ReturnType<typeof buildCommitSummary>;
  results: ContentIntakeCommitResult[];
  suggestedReplyAfterCommitHe: string;
  receivedAt?: string;
}): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  if (!isResendConfigured()) {
    console.warn('[Content Intake Fattal Commit] Resend is not configured; skipping report email');
    return { sent: false, skipped: true };
  }

  const report = buildFattalReportEmail(params);
  const result = await sendEmail({
    to: FATTAL_REPORT_EMAIL_TO,
    subject: report.subject,
    html: report.html,
    text: report.text,
    idempotencyKey: `fattal-report/${params.runId}`,
  });

  if (!result.success) {
    console.error('[Content Intake Fattal Commit] Report email failed:', result.error);
    return { sent: false, error: result.error || 'Failed to send report email' };
  }

  return { sent: true };
}

type ContentIntakeRunStatusForReport = 'completed' | 'completed_with_issues';

function buildFattalReportEmail(params: {
  runId: string;
  status: ContentIntakeRunStatusForReport;
  preview: ContentIntakePreview;
  summary: ReturnType<typeof buildCommitSummary>;
  results: ContentIntakeCommitResult[];
  suggestedReplyAfterCommitHe: string;
  receivedAt?: string;
}) {
  const dateLabel = formatHebrewDate(params.receivedAt || params.preview.generatedAt);
  const reportSlotLabel = getFattalReportSlotLabel(params.receivedAt || params.preview.generatedAt);
  const statusLabel = params.status === 'completed' ? 'הושלם' : 'הושלם עם חוסרים / בדיקה';
  const updated = params.results.filter((result) => result.status === 'updated');
  const skippedDuplicates = params.results.filter((result) => result.status === 'skipped_duplicate');
  const skipped = params.results.filter((result) => result.status === 'skipped');
  const failed = params.results.filter((result) => result.status === 'failed');
  const missing = params.preview.missingTargets.map((item) => item.target.title);

  const text = [
    `דוח עדכון חוברות פתאל - ${dateLabel}`,
    '',
    'הבוט של פלייזון סיים עדכון חוברות פתאל.',
    `פעימת דיווח: ${reportSlotLabel}`,
    `סטטוס: ${statusLabel}`,
    `מזהה ריצה: ${params.runId}`,
    '',
    `סה"כ קבצים: ${params.summary.totalFiles}`,
    `הותאמו: ${params.summary.matched}`,
    `עודכנו בפועל: ${params.summary.updated}`,
    `כבר היו מעודכנים: ${params.summary.skippedDuplicate}`,
    `דורשים בדיקה ידנית: ${params.summary.skipped}`,
    `נכשלו: ${params.summary.failed}`,
    `חסרים: ${params.summary.missingTargets}`,
    '',
    sectionText('עודכנו', updated.map((result) => result.title || result.filename)),
    '',
    sectionText('כבר היו מעודכנים', skippedDuplicates.map((result) => result.title || result.filename)),
    '',
    sectionText('חסרים', missing),
    '',
    sectionText(
      'דורשים בדיקה ידנית',
      skipped.map((result) => `${result.filename}${result.reason ? ` - ${result.reason}` : ''}`)
    ),
    '',
    sectionText(
      'שגיאות',
      failed.map((result) => `${result.filename}${result.error ? ` - ${result.error}` : ''}`)
    ),
    '',
    'הודעה מוצעת לוואטסאפ:',
    params.suggestedReplyAfterCommitHe,
  ].join('\n');

  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; color: #111827; line-height: 1.55;">
      <h2 style="margin: 0 0 12px; color: #111827;">דוח עדכון חוברות פתאל</h2>
      <p style="margin: 0 0 16px;">הבוט של פלייזון סיים עדכון חוברות פתאל.</p>

      <table style="border-collapse: collapse; width: 100%; margin: 0 0 20px; background: #f9fafb; border: 1px solid #e5e7eb;">
        ${summaryRow('תאריך', dateLabel)}
        ${summaryRow('פעימת דיווח', reportSlotLabel)}
        ${summaryRow('סטטוס', statusLabel)}
        ${summaryRow('מזהה ריצה', params.runId)}
        ${summaryRow('סה"כ קבצים', String(params.summary.totalFiles))}
        ${summaryRow('הותאמו', String(params.summary.matched))}
        ${summaryRow('עודכנו בפועל', String(params.summary.updated))}
        ${summaryRow('כבר היו מעודכנים', String(params.summary.skippedDuplicate))}
        ${summaryRow('דורשים בדיקה ידנית', String(params.summary.skipped))}
        ${summaryRow('נכשלו', String(params.summary.failed))}
        ${summaryRow('חסרים', String(params.summary.missingTargets))}
      </table>

      ${sectionHtml('עודכנו', updated.map((result) => result.title || result.filename))}
      ${sectionHtml('כבר היו מעודכנים', skippedDuplicates.map((result) => result.title || result.filename))}
      ${sectionHtml('חסרים', missing)}
      ${sectionHtml(
        'דורשים בדיקה ידנית',
        skipped.map((result) => `${result.filename}${result.reason ? ` - ${result.reason}` : ''}`)
      )}
      ${sectionHtml(
        'שגיאות',
        failed.map((result) => `${result.filename}${result.error ? ` - ${result.error}` : ''}`)
      )}

      <h3 style="margin: 20px 0 8px; font-size: 16px;">הודעה מוצעת לוואטסאפ</h3>
      <pre style="white-space: pre-wrap; direction: rtl; text-align: right; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; font-family: Arial, sans-serif;">${escapeHtml(params.suggestedReplyAfterCommitHe)}</pre>

      <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">
        הודעה אוטומטית ממערכת The Q
      </p>
    </div>
  `;

  return {
    subject: `דוח עדכון חוברות פתאל - ${dateLabel}`,
    html,
    text,
  };
}

function sectionText(title: string, items: string[]): string {
  if (items.length === 0) return `${title}:\nאין`;
  return `${title}:\n${items.map((item, index) => `${index + 1}. ${item}`).join('\n')}`;
}

function sectionHtml(title: string, items: string[]): string {
  const body = items.length === 0
    ? '<p style="margin: 0 0 14px; color: #6b7280;">אין</p>'
    : `<ol style="margin: 0 0 14px; padding-right: 22px;">${items
      .map((item) => `<li style="margin: 4px 0;">${escapeHtml(item)}</li>`)
      .join('')}</ol>`;

  return `
    <h3 style="margin: 18px 0 8px; font-size: 16px;">${escapeHtml(title)}</h3>
    ${body}
  `;
}

function summaryRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; width: 190px;">${escapeHtml(label)}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(value)}</td>
    </tr>
  `;
}

function getFattalReportSlotLabel(value?: string): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return 'ריצה ידנית';

  const hourInIsrael = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    hour12: false,
  }).format(date));

  if (hourInIsrael < 12) return 'פעימה 1 - 10:00';
  if (hourInIsrael < 15) return 'פעימה 2 - 12:00/14:00';
  return 'ריצה ידנית / השלמה מאוחרת';
}

function formatHebrewDate(value?: string): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toLocaleDateString('he-IL');

  return new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
            receivedAt,
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
    runId: parseString(formData.get('runId')),
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
    runId: typeof body.runId === 'string' ? body.runId : undefined,
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
    const dedupeId = buildDedupeId(match.target.codeId, fileHash, file.sourceMessageId);
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
      if (await hasSuccessfulFileUpdate(dedupeId)) {
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

function buildCommitSummary(preview: ContentIntakePreview, results: ContentIntakeCommitResult[]) {
  return {
    totalFiles: preview.summary.totalFiles,
    matched: preview.summary.matched,
    updated: results.filter((result) => result.status === 'updated').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
    skippedDuplicate: results.filter((result) => result.status === 'skipped_duplicate').length,
    failed: results.filter((result) => result.status === 'failed').length,
    missingTargets: preview.summary.missingTargets,
  };
}

function buildCommitReply(
  preview: ContentIntakePreview,
  results: ContentIntakeCommitResult[]
): string {
  const updated = results.filter((result) => result.status === 'updated');
  const skippedDuplicates = results.filter((result) => result.status === 'skipped_duplicate');
  const skipped = results.filter((result) => result.status === 'skipped');
  const failed = results.filter((result) => result.status === 'failed');
  const missingTitles = preview.missingTargets.map((missing) => missing.target.title);
  const updatedTitles = updated.map((result) => result.title).filter(Boolean);

  if (skipped.length === 0 && failed.length === 0 && missingTitles.length === 0) {
    const lines = ['תודה, בוצע ✅'];
    if (updated.length > 0) {
      lines.push(`עודכנו ${updated.length} חוברות${updatedTitles.length ? `: ${updatedTitles.join(', ')}` : ''}`);
    }
    if (skippedDuplicates.length > 0) {
      lines.push(`קבצים שכבר היו מעודכנים דולגו: ${skippedDuplicates.length}`);
    }
    return lines.join('\n');
  }

  const lines = ['תודה, עדכנתי את מה שהתקבל ✅'];
  if (updated.length > 0) {
    lines.push(`עודכנו ${updated.length} חוברות${updatedTitles.length ? `: ${updatedTitles.join(', ')}` : ''}`);
  }
  if (skippedDuplicates.length > 0) {
    lines.push(`קבצים שכבר היו מעודכנים דולגו: ${skippedDuplicates.length}`);
  }
  if (skipped.length > 0) {
    lines.push(`דורשים בדיקה ידנית: ${skipped.length} קבצים`);
  }
  if (failed.length > 0) {
    lines.push(`לא הצלחתי לעדכן: ${failed.length} קבצים`);
  }
  if (missingTitles.length > 0) {
    lines.push(`חסרים לי קבצים עבור: ${missingTitles.join(', ')}`);
  }
  return lines.join('\n');
}

function hasCommitIssues(
  preview: ContentIntakePreview,
  results: ContentIntakeCommitResult[]
): boolean {
  return preview.summary.missingTargets > 0
    || results.some((result) => result.status === 'failed' || result.status === 'skipped');
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
